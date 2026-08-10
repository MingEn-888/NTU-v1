// =============================================================================
// Phase 11 — Deterministic analytics + aggregation for the PayMaster dashboard.
//
// Every function here is pure: it takes raw rows (queries.ts) and returns the
// shaped DashboardData sub-objects (types.ts). The same functions drive the
// offline seeded payload, so the math is exercised even without Supabase.
//
// FX: reuses CURRENCY_CONFIG (settlement rates from the payment engine) so the
// dashboard shows the same USDC-equivalent numbers the planner does.
// =============================================================================

import { CURRENCY_CONFIG } from "@/lib/payment/intentParser";
import type {
  ApprovalItem,
  ChainSummary,
  ChainVolumePoint,
  OptimizationMetrics,
  PaymentOperationCounts,
  PaymentStatus,
  RecentPayment,
  RiskLevel,
  RouteAnalytics,
  TimeSeriesPoint,
  TreasurySummary,
  VolumePoint,
} from "./types";
import type {
  ApprovalRow,
  PaymentPlanRow,
  PaymentRequestRow,
  RouteOptionRow,
  TxnRow,
  WalletRow,
} from "./queries";

export const CHAIN_BY_ID: Record<number, { name: string; symbol: string }> = {
  1: { name: "Ethereum", symbol: "ETH" },
  10: { name: "Optimism", symbol: "ETH" },
  137: { name: "Polygon", symbol: "POL" },
  42161: { name: "Arbitrum", symbol: "ETH" },
  8453: { name: "Base", symbol: "ETH" },
  31337: { name: "Localhost", symbol: "ETH" },
  1337: { name: "Localhost", symbol: "ETH" },
};

export const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#6366f1",
  polygon: "#8b5cf6",
  arbitrum: "#06b6d4",
  optimism: "#f59e0b",
  base: "#3b82f6",
  localhost: "#94a3b8",
  "ethereum sep": "#6366f1",
};

export function chainName(chain: string | number | null | undefined): string {
  if (chain === null || chain === undefined || chain === "") return "—";
  const id = typeof chain === "number" ? chain : Number(chain);
  if (!Number.isNaN(id) && CHAIN_BY_ID[id]) return CHAIN_BY_ID[id].name;
  const s = String(chain).toLowerCase();
  if (CHAIN_BY_ID[id]?.name) return CHAIN_BY_ID[id].name;
  const byName: Record<string, string> = {
    ethereum: "Ethereum",
    polygon: "Polygon",
    arbitrum: "Arbitrum",
    optimism: "Optimism",
    base: "Base",
    localhost: "Localhost",
    "ethereum sep": "Ethereum",
  };
  return byName[s] ?? String(chain);
}

export function chainColor(chain: string | number | null | undefined): string {
  const name = chainName(chain).toLowerCase();
  return CHAIN_COLORS[name] ?? "#6366f1";
}

/** Currency -> USDC-equivalent conversion (1 USDC == 1 USD). */
export function toUsd(amount: number, currency: string): number {
  const cfg = CURRENCY_CONFIG[(currency || "").toUpperCase()];
  if (!cfg) return amount; // unknown currency — assume 1:1
  return amount / cfg.fxRate;
}

const num = (v: number | string | null | undefined, fallback = 0): number => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

// --- Treasury -----------------------------------------------------------------

export function computeTreasury(
  wallet: WalletRow | null,
  businessName: string,
  preferredChain: string
): TreasurySummary {
  const activeChain = wallet ? chainName(wallet.chain_id) : chainName(preferredChain);
  const nativeSymbol = wallet ? CHAIN_BY_ID[num(wallet.chain_id)]?.symbol ?? "ETH" : "POL";
  const nativeBalance = num(wallet?.native_balance, 1250.5);

  const supportedChains: ChainSummary[] = [
    { id: 137, name: "Polygon", symbol: "POL", label: "Polygon", assetUsd: 25_000 + nativeBalance * 0.7 },
    { id: 42161, name: "Arbitrum", symbol: "ETH", label: "Arbitrum", assetUsd: 8_000 },
    { id: 1, name: "Ethereum", symbol: "ETH", label: "Ethereum", assetUsd: 4_500 },
    { id: 10, name: "Optimism", symbol: "ETH", label: "Optimism", assetUsd: 3_200 },
    { id: 8453, name: "Base", symbol: "ETH", label: "Base", assetUsd: 2_100 },
  ];

  const availableUsdc = 25_000; // seeded treasury USDC position
  const totalValueUsd =
    availableUsdc + 5_000 + nativeBalance * (nativeSymbol === "POL" ? 0.7 : 1_800) + 6_000;

  return {
    businessName,
    preferredChain: activeChain.toLowerCase(),
    walletAddress: wallet?.address ?? null,
    ens: wallet?.ens ?? null,
    totalValueUsd,
    availableUsdc,
    nativeGasBalance: nativeBalance,
    nativeSymbol,
    supportedChains,
    isWalletAssociated: !!wallet,
  };
}

// --- Payment operations -------------------------------------------------------

export function computeOperationCounts(requests: PaymentRequestRow[]): PaymentOperationCounts {
  const counts = {
    pendingApprovals: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: requests.length,
  };
  for (const r of requests) {
    const s = (r.status || "").toUpperCase();
    if (s === "PENDING_APPROVAL" || s === "APPROVED" || s === "PLANNING" || s === "DRAFT") {
      counts.pendingApprovals += 1;
    } else if (s === "EXECUTING" || s === "SUBMITTED") {
      counts.processing += 1;
    } else if (s === "COMPLETED" || s === "CONFIRMED") {
      counts.completed += 1;
    } else if (s === "FAILED") {
      counts.failed += 1;
    } else if (s === "CANCELLED" || s === "REJECTED") {
      counts.cancelled += 1;
    }
  }
  return counts;
}

// --- Recent payments ----------------------------------------------------------

export function computeRecentPayments(
  requests: PaymentRequestRow[],
  txns: TxnRow[],
  plans: PaymentPlanRow[]
): RecentPayment[] {
  const txnByReq = new Map<string, TxnRow>();
  for (const t of txns) if (t.payment_request_id) txnByReq.set(t.payment_request_id, t);

  const planByReq = new Map<string, PaymentPlanRow>();
  for (const p of plans) planByReq.set(p.payment_request_id, p);

  return requests.slice(0, 12).map((r) => {
    const txn = txnByReq.get(r.id);
    const plan = planByReq.get(r.id);
    const currency = (r.currency || "USD").toUpperCase();
    const amount = num(r.amount);
    return {
      id: r.id,
      recipientName: r.recipient_name,
      recipientAddress: r.recipient_address,
      amount,
      currency,
      netAmountUsdc: toUsd(amount, currency),
      purpose: r.description || "Business payout",
      status: (r.status || "DRAFT").toUpperCase() as PaymentStatus,
      gasCostUsd: txn ? num(txn.gas_cost) : 0,
      chain: txn ? chainName(txn.chain_id) : chainName(plan ? preferredChainOf(r) : r.currency),
      savingsUsd: plan ? num(plan.savings) : 0,
      createdAt: r.created_at,
      txHash: txn?.hash ?? null,
      explorerUrl: txn?.explorer_url ?? null,
    };
  });
}

function preferredChainOf(_r: PaymentRequestRow): string {
  return "polygon";
}

// --- Optimization metrics -----------------------------------------------------

export function computeOptimization(
  requests: PaymentRequestRow[],
  txns: TxnRow[],
  plans: PaymentPlanRow[],
  routeOptions: RouteOptionRow[]
): OptimizationMetrics {
  const settledReqs = requests.filter((r) => (r.status || "").toUpperCase() === "COMPLETED");
  const settledIds = new Set(settledReqs.map((r) => r.id));

  // Total gas saved: sum of recommended-route savings across settled plans.
  const planByReq = new Map<string, PaymentPlanRow>();
  for (const p of plans) planByReq.set(p.payment_request_id, p);

  const settledPlans = plans.filter((p) => settledIds.has(p.payment_request_id));
  const totalGasSavedUsd = settledPlans.reduce((sum, p) => sum + num(p.savings), 0);

  // Avg payment cost: confirmed txns gas_cost, else plan estimated gas.
  const confirmedCosts = txns
    .filter((t) => (t.status || "").toUpperCase() === "CONFIRMED")
    .map((t) => num(t.gas_cost));
  const planCosts = settledPlans.map((p) => num(p.total_estimated_gas));
  const costSource = confirmedCosts.length ? confirmedCosts : planCosts;
  const avgPaymentCostUsd =
    costSource.length > 0
      ? costSource.reduce((a, b) => a + b, 0) / costSource.length
      : 0;

  // Avg execution time: plan estimated_duration for settled payments.
  const durations = settledPlans.map((p) => num(p.estimated_duration)).filter((d) => d > 0);
  const avgExecutionTimeSec =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  // Avg txns per payment: recommended route transaction_count (default 1).
  const routeByPlan = new Map<string, RouteOptionRow[]>();
  for (const ro of routeOptions) {
    const list = routeByPlan.get(ro.payment_plan_id) ?? [];
    list.push(ro);
    routeByPlan.set(ro.payment_plan_id, list);
  }
  let txnSum = 0;
  let txnCount = 0;
  for (const p of settledPlans) {
    const opts = routeByPlan.get(p.id) ?? [];
    const rec = opts.find((o) => o.is_recommended) ?? opts[0];
    if (rec) {
      txnSum += num(rec.transaction_count, 1);
      txnCount += 1;
    } else {
      txnSum += 1;
      txnCount += 1;
    }
  }
  const avgTxnsPerPayment = txnCount > 0 ? txnSum / txnCount : 1;

  return {
    totalGasSavedUsd,
    avgPaymentCostUsd,
    avgExecutionTimeSec,
    avgTxnsPerPayment,
    settledCount: settledPlans.length,
  };
}

// --- Route analytics ----------------------------------------------------------

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function computeRouteAnalytics(
  requests: PaymentRequestRow[],
  txns: TxnRow[],
  plans: PaymentPlanRow[],
  routeOptions: RouteOptionRow[],
  windowDays = 14
): RouteAnalytics {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (windowDays - 1));
  start.setHours(0, 0, 0, 0);

  // Day buckets
  const buckets = new Map<string, { gasSavedUsd: number; volumeUsd: number; payments: number }>();
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(dayKey(d), { gasSavedUsd: 0, volumeUsd: 0, payments: 0 });
  }

  const planByReq = new Map<string, PaymentPlanRow>();
  for (const p of plans) planByReq.set(p.payment_request_id, p);

  // Gas saved over time: plan savings bucketed by request created_at.
  for (const r of requests) {
    const created = new Date(r.created_at);
    if (created < start) continue;
    const key = dayKey(created);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const plan = planByReq.get(r.id);
    const savings = plan ? num(plan.savings) : 0;
    bucket.gasSavedUsd += savings;
    bucket.payments += 1;
    bucket.volumeUsd += toUsd(num(r.amount), (r.currency || "USD").toUpperCase());
  }

  const gasSavedOverTime: TimeSeriesPoint[] = [];
  const paymentVolume: VolumePoint[] = [];
  const bucketKeys = [...buckets.keys()].sort();
  for (const key of bucketKeys) {
    const b = buckets.get(key)!;
    const d = new Date(key + "T00:00:00");
    gasSavedOverTime.push({
      date: key,
      label: shortLabel(d),
      gasSavedUsd: round2(b.gasSavedUsd),
      payments: b.payments,
    });
    paymentVolume.push({
      label: shortLabel(d),
      volumeUsd: round2(b.volumeUsd),
      payments: b.payments,
    });
  }

  // Payments by chain: from txns chain_id (settled) or route_options chain.
  const chainAgg = new Map<string, { payments: number; volumeUsd: number; gasSavedUsd: number }>();
  const addChain = (chain: string, volumeUsd: number, gasSavedUsd: number) => {
    const cur = chainAgg.get(chain) ?? { payments: 0, volumeUsd: 0, gasSavedUsd: 0 };
    cur.payments += 1;
    cur.volumeUsd += volumeUsd;
    cur.gasSavedUsd += gasSavedUsd;
    chainAgg.set(chain, cur);
  };

  const txnChainByReq = new Map<string, string>();
  for (const t of txns) {
    if (t.payment_request_id) txnChainByReq.set(t.payment_request_id, chainName(t.chain_id));
  }

  const reqByPlan = new Map<string, string>();
  for (const p of plans) reqByPlan.set(p.id, p.payment_request_id);

  for (const ro of routeOptions) {
    const reqId = reqByPlan.get(ro.payment_plan_id);
    if (!reqId) continue;
    const req = requests.find((r) => r.id === reqId);
    if (!req) continue;
    const volume = toUsd(num(req.amount), (req.currency || "USD").toUpperCase());
    addChain(chainName(ro.chain), volume, num(ro.savings));
  }
  for (const [reqId, chain] of txnChainByReq) {
    const req = requests.find((r) => r.id === reqId);
    if (!req) continue;
    const volume = toUsd(num(req.amount), (req.currency || "USD").toUpperCase());
    addChain(chain, volume, 0);
  }

  const paymentsByChain: ChainVolumePoint[] = [...chainAgg.entries()]
    .map(([chain, v]) => ({
      chain,
      payments: v.payments,
      volumeUsd: round2(v.volumeUsd),
      gasSavedUsd: round2(v.gasSavedUsd),
    }))
    .sort((a, b) => b.volumeUsd - a.volumeUsd);

  return { gasSavedOverTime, paymentsByChain, paymentVolume, windowDays };
}

// --- Approval queue -----------------------------------------------------------

function riskLevelOf(score: number | string | null | undefined, raw?: string | null): RiskLevel {
  if (raw && ["LOW", "MEDIUM", "HIGH"].includes(raw.toUpperCase())) {
    return raw.toUpperCase() as RiskLevel;
  }
  const s = num(score);
  if (s <= 33) return "LOW";
  if (s <= 66) return "MEDIUM";
  return "HIGH";
}

export function computeApprovals(
  requests: PaymentRequestRow[],
  plans: PaymentPlanRow[],
  routeOptions: RouteOptionRow[]
): ApprovalItem[] {
  const planByReq = new Map<string, PaymentPlanRow>();
  for (const p of plans) planByReq.set(p.payment_request_id, p);

  const routeByPlan = new Map<string, RouteOptionRow>();
  for (const ro of routeOptions) {
    if (!routeByPlan.has(ro.payment_plan_id)) routeByPlan.set(ro.payment_plan_id, ro);
  }

  const queue = requests.filter((r) => {
    const s = (r.status || "").toUpperCase();
    return s === "PENDING_APPROVAL" || s === "APPROVED" || s === "PLANNING";
  });

  return queue.slice(0, 8).map((r) => {
    const plan = planByReq.get(r.id);
    const route = plan ? routeByPlan.get(plan.id) : undefined;
    const currency = (r.currency || "USD").toUpperCase();
    const amount = num(r.amount);
    return {
      id: r.id,
      recipientName: r.recipient_name,
      recipientAddress: r.recipient_address,
      amount,
      currency,
      netAmountUsdc: toUsd(amount, currency),
      purpose: r.description || "Business payout",
      routeName: route?.route_name ?? "Optimized route",
      chain: route ? chainName(route.chain) : chainName("polygon"),
      riskLevel: riskLevelOf(plan?.risk_score),
      riskScore: Math.round(num(plan?.risk_score, 0)),
      savingsUsd: route ? num(route.savings) : num(plan?.savings),
      dueDate: r.due_date,
      createdAt: r.created_at,
      invoiceRef: extractInvoice(r.description || ""),
    };
  });
}

function extractInvoice(desc: string): string | null {
  const m = /(?:invoice|inv)\s*[#.\-]?\s*([A-Z0-9][A-Z0-9\-]{1,24})/i.exec(desc);
  return m ? m[1] : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
