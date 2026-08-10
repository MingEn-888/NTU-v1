// =============================================================================
// Phase 11 — Supabase queries for the PayMaster Business Payment Operations
// Dashboard. Server-side only (uses the service-role admin client). Each query
// returns raw rows; the deterministic aggregation lives in analytics.ts so the
// same math can be unit-tested / reused for the offline demo payload.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// --- Raw row shapes (loosely typed — we never persist these back) -------------

export interface PaymentRequestRow {
  id: string;
  business_id: string;
  description: string | null;
  recipient_name: string;
  recipient_address: string;
  amount: number | string;
  currency: string;
  due_date: string | null;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface TxnRow {
  id: string;
  payment_request_id: string | null;
  payment_plan_id: string | null;
  hash: string | null;
  status: string;
  chain_id: number | string;
  gas_used: number | string | null;
  gas_cost: number | string | null;
  created_at: string;
  confirmed_at: string | null;
  explorer_url: string | null;
}

export interface PaymentPlanRow {
  id: string;
  payment_request_id: string;
  selected_route_id: string | null;
  total_estimated_gas: number | string | null;
  estimated_duration: number | string | null;
  savings: number | string | null;
  explanation: string | null;
  risk_score: number | string | null;
  created_at: string;
}

export interface RouteOptionRow {
  id: string;
  payment_plan_id: string;
  route_name: string;
  chain: string;
  estimated_gas: number | string | null;
  estimated_time: number | string | null;
  transaction_count: number | string | null;
  risk_score: number | string | null;
  total_score: number | string | null;
  savings: number | string | null;
  is_recommended: boolean | null;
  created_at: string;
}

export interface ApprovalRow {
  id: string;
  payment_request_id: string;
  status: string;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  payment_request: {
    id: string;
    description: string | null;
    recipient_name: string;
    recipient_address: string;
    amount: number | string;
    currency: string;
    due_date: string | null;
    status: string;
    created_at: string;
  } | null;
}

export interface WalletRow {
  id: string;
  business_id: string;
  address: string;
  ens: string | null;
  chain_id: number | string;
  native_balance: number | string | null;
  updated_at: string;
}

export interface BusinessProfileRow {
  id: string;
  owner_user_id: string;
  business_name: string;
  default_chain: string;
  created_at: string;
  updated_at: string;
}

// --- Query bundle -------------------------------------------------------------

export interface RawDashboardData {
  businessProfile: BusinessProfileRow | null;
  wallet: WalletRow | null;
  paymentRequests: PaymentRequestRow[];
  txns: TxnRow[];
  paymentPlans: PaymentPlanRow[];
  routeOptions: RouteOptionRow[];
  approvals: ApprovalRow[];
}

/**
 * Fetch every row the dashboard needs for a business in a small number of
 * batched queries. Uses the service-role admin client, so RLS is bypassed —
 * the /api/dashboard route is the only caller and it is gated by businessId.
 */
export async function fetchRawDashboardData(
  supabase: SupabaseClient,
  businessId: string
): Promise<RawDashboardData> {
  const empty: RawDashboardData = {
    businessProfile: null,
    wallet: null,
    paymentRequests: [],
    txns: [],
    paymentPlans: [],
    routeOptions: [],
    approvals: [],
  };

  // 1. Business profile + treasury wallet.
  const [profileRes, walletRes] = await Promise.all([
    supabase.from("business_profiles").select("*").eq("id", businessId).maybeSingle(),
    supabase.from("wallets").select("*").eq("business_id", businessId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const businessProfile = (profileRes.data as BusinessProfileRow | null) ?? null;
  const wallet = (walletRes.data as WalletRow | null) ?? null;

  // 2. Payment requests (lifecycle + recents + volumes).
  const { data: paymentRequests } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  // 3. Transactions (chain + gas analytics), joined to their payment request.
  const { data: txns } = await supabase
    .from("txns")
    .select("*, payment_requests!inner(business_id)")
    .eq("payment_requests.business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  // 4. Payment plans (savings / duration / risk) for this business.
  const { data: paymentPlans } = await supabase
    .from("payment_plans")
    .select("*, payment_requests!inner(business_id)")
    .eq("payment_requests.business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  // 5. Route options (chain + gas-saved analytics) for this business.
  const { data: routeOptions } = await supabase
    .from("route_options")
    .select("*, payment_plans!inner(payment_requests!inner(business_id))")
    .eq("payment_plans.payment_requests.business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(300);

  // 6. Approvals awaiting human review, joined to the payment request.
  const { data: approvals } = await supabase
    .from("approvals")
    .select("*, payment_request:payment_requests!inner(business_id)")
    .eq("payment_requests.business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    businessProfile,
    wallet,
    paymentRequests: (paymentRequests as PaymentRequestRow[] | null) ?? [],
    txns: ((txns as Array<TxnRow & { payment_requests?: { business_id: string } }> | null) ?? [])
      .map(({ payment_requests: _pr, ...rest }) => rest as TxnRow),
    paymentPlans: ((paymentPlans as Array<PaymentPlanRow & { payment_requests?: { business_id: string } }> | null) ?? [])
      .map(({ payment_requests: _pr, ...rest }) => rest as PaymentPlanRow),
    routeOptions: ((routeOptions as Array<RouteOptionRow & { payment_plans?: unknown }> | null) ?? [])
      .map(({ payment_plans: _pp, ...rest }) => rest as RouteOptionRow),
    approvals: ((approvals as Array<ApprovalRow & { payment_requests?: unknown }> | null) ?? [])
      .map(({ payment_requests: _pr, ...rest }) => rest as ApprovalRow),
  };
}
