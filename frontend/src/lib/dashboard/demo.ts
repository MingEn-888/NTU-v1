// =============================================================================
// Phase 11 — Deterministic offline demo payload for the PayMaster dashboard.
//
// When Supabase is not configured (or unreachable) the /api/dashboard route
// returns this payload so the dashboard still demonstrates the full business
// payment automation surface. The demo builds SYNTHETIC raw rows and runs them
// through the exact same analytics.ts math as the live path — so every number
// shown is computed, never hand-typed.
// =============================================================================

import { computeApprovals, computeOperationCounts, computeOptimization, computeRecentPayments, computeRouteAnalytics, computeTreasury } from "./analytics";
import type { DashboardData, PaymentStatus } from "./types";
import type { PaymentPlanRow, PaymentRequestRow, RouteOptionRow, TxnRow, WalletRow } from "./queries";

const NOW = Date.now();
const H = 3600 * 1000;
const D = 24 * H;

// --- Business context ---------------------------------------------------------

const DEMO_BUSINESS = {
  id: "b2000000-0000-0000-0000-000000000001",
  business_name: "TechCorp Solutions Sdn Bhd",
  default_chain: "polygon",
};

const DEMO_WALLET: WalletRow = {
  id: "b3000000-0000-0000-0000-000000000001",
  business_id: DEMO_BUSINESS.id,
  address: "0x3c44cdd470368a0623a22d2c4022878d3f9905e5",
  ens: "techcorp-treasury.eth",
  chain_id: 137,
  native_balance: 1250.5,
  updated_at: new Date(NOW - 2 * H).toISOString(),
};

// --- Payment operations catalog ------------------------------------------------
// Realistic business settlement operations — invoices, contractor payouts,
// vendor settlements and treasury transfers (no consumer shortcuts).

interface DemoTemplate {
  recipient: string;
  address: string;
  purpose: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  chain: string; // route chain
  routeName: string;
  gasCost: number;
  savings: number;
  duration: number;
  txns: number;
  riskScore: number;
  hoursAgo: number;
}

const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    recipient: "Alice Tan (Software Vendor)",
    address: "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
    purpose: "Invoice INV-1024 — development retainer",
    amount: 2500,
    currency: "MYR",
    status: "COMPLETED",
    chain: "polygon",
    routeName: "Polygon direct",
    gasCost: 0.45,
    savings: 12.5,
    duration: 15,
    txns: 1,
    riskScore: 5,
    hoursAgo: 2 * H,
  },
  {
    recipient: "Priya Raghavan (Contractor)",
    address: "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
    purpose: "Contractor payment — UI sprint",
    amount: 1200,
    currency: "USD",
    status: "COMPLETED",
    chain: "arbitrum",
    routeName: "Arbitrum USDC direct",
    gasCost: 0.18,
    savings: 21.3,
    duration: 8,
    txns: 1,
    riskScore: 8,
    hoursAgo: 26 * H,
  },
  {
    recipient: "Nimbus Cloud Infra",
    address: "0xffcf8fdee72ac11b5c542428b35eef5769c409f0",
    purpose: "Vendor settlement — monthly hosting",
    amount: 850,
    currency: "USD",
    status: "COMPLETED",
    chain: "polygon",
    routeName: "Polygon direct",
    gasCost: 0.39,
    savings: 9.1,
    duration: 14,
    txns: 1,
    riskScore: 4,
    hoursAgo: 3 * D + 4 * H,
  },
  {
    recipient: "David Okafor (Field Engineer)",
    address: "0x22d491bde2303f2f43325b2108d26f1eaba1e32b",
    purpose: "Equipment reimbursement — site kit",
    amount: 450,
    currency: "USD",
    status: "COMPLETED",
    chain: "base",
    routeName: "Base USDC direct",
    gasCost: 0.09,
    savings: 6.7,
    duration: 6,
    txns: 1,
    riskScore: 3,
    hoursAgo: 4 * D + 10 * H,
  },
  {
    recipient: "Meridian Logistics",
    address: "0xe11ba2b4d45eaed5996cd0823791e0c93114882d",
    purpose: "Supplier settlement — freight INV-2077",
    amount: 1900,
    currency: "SGD",
    status: "COMPLETED",
    chain: "ethereum",
    routeName: "Ethereum bridge → direct",
    gasCost: 8.4,
    savings: 14.8,
    duration: 95,
    txns: 3,
    riskScore: 28,
    hoursAgo: 6 * D + 2 * H,
  },
  {
    recipient: "Treasury Vault (Ops)",
    address: "0xf3f2c02f8d0c9f5e7e1a4b9c0d1e2f3a4b5c6d7e",
    purpose: "Treasury transfer — working capital top-up",
    amount: 15000,
    currency: "USDC",
    status: "COMPLETED",
    chain: "arbitrum",
    routeName: "Arbitrum USDC direct",
    gasCost: 0.22,
    savings: 18.9,
    duration: 9,
    txns: 1,
    riskScore: 6,
    hoursAgo: 8 * D + 6 * H,
  },
  {
    recipient: "Azure Agency (Retainer)",
    address: "0xd6a6a8e2c5d3b4a1f2e9c8d7b6a5f4e3d2c1b0a9",
    purpose: "Vendor settlement — marketing retainer",
    amount: 975,
    currency: "USD",
    status: "COMPLETED",
    chain: "polygon",
    routeName: "Polygon direct",
    gasCost: 0.41,
    savings: 7.4,
    duration: 13,
    txns: 1,
    riskScore: 5,
    hoursAgo: 10 * D,
  },
  {
    recipient: "Helios Renewables",
    address: "0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d",
    purpose: "Contractor payment — solar install batch",
    amount: 3200,
    currency: "USD",
    status: "COMPLETED",
    chain: "optimism",
    routeName: "Optimism USDC direct",
    gasCost: 0.31,
    savings: 11.2,
    duration: 11,
    txns: 1,
    riskScore: 7,
    hoursAgo: 12 * D,
  },
  {
    recipient: "Elara Consulting",
    address: "0x5e5c4c4b4a494847464544434241403f3e3d3c3b",
    purpose: "Invoice INV-3102 — advisory",
    amount: 1500,
    currency: "USD",
    status: "PENDING_APPROVAL",
    chain: "polygon",
    routeName: "Polygon direct",
    gasCost: 0.4,
    savings: 10.6,
    duration: 14,
    txns: 1,
    riskScore: 12,
    hoursAgo: 3 * H,
  },
  {
    recipient: "Kai Distributors",
    address: "0x9f8e7d6c5b4a392817263514a1b2c3d4e5f60718",
    purpose: "Vendor settlement — bulk order",
    amount: 6800,
    currency: "MYR",
    status: "PENDING_APPROVAL",
    chain: "ethereum",
    routeName: "Ethereum bridge → USDC",
    gasCost: 9.2,
    savings: 26.4,
    duration: 110,
    txns: 3,
    riskScore: 47,
    hoursAgo: 5 * H,
  },
  {
    recipient: "Northwind Freight Co.",
    address: "0x8a7b6c5d4e3f22109a8b7c6d5e4f3a2b1c0d9e8f",
    purpose: "Invoice INV-3155 — customs & clearance",
    amount: 2400,
    currency: "USD",
    status: "PENDING_APPROVAL",
    chain: "arbitrum",
    routeName: "Arbitrum USDC direct",
    gasCost: 0.19,
    savings: 15.1,
    duration: 8,
    txns: 1,
    riskScore: 71,
    hoursAgo: 7 * H,
  },
  {
    recipient: "Lumen Tech Labs",
    address: "0x7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e",
    purpose: "Contractor payment — QA sprint",
    amount: 620,
    currency: "USD",
    status: "PLANNING",
    chain: "polygon",
    routeName: "Polygon direct",
    gasCost: 0.38,
    savings: 8.3,
    duration: 12,
    txns: 1,
    riskScore: 9,
    hoursAgo: 2 * H,
  },
];

// --- Synthetic raw rows -------------------------------------------------------

function buildRows() {
  const requests: PaymentRequestRow[] = [];
  const plans: PaymentPlanRow[] = [];
  const routes: RouteOptionRow[] = [];
  const txns: TxnRow[] = [];

  DEMO_TEMPLATES.forEach((t, i) => {
    const createdAt = new Date(NOW - t.hoursAgo).toISOString();
    const reqId = `demo-req-${i + 1}`;
    const planId = `demo-plan-${i + 1}`;
    const routeId = `demo-route-${i + 1}`;

    requests.push({
      id: reqId,
      business_id: DEMO_BUSINESS.id,
      description: t.purpose,
      recipient_name: t.recipient,
      recipient_address: t.address,
      amount: t.amount,
      currency: t.currency,
      due_date: t.status === "PENDING_APPROVAL" ? new Date(NOW + 3 * D).toISOString() : null,
      status: t.status,
      source: "CHAT",
      created_at: createdAt,
      updated_at: createdAt,
    });

    plans.push({
      id: planId,
      payment_request_id: reqId,
      selected_route_id: routeId,
      total_estimated_gas: t.gasCost,
      estimated_duration: t.duration,
      savings: t.savings,
      explanation: `${t.routeName} selected with estimated savings of $${t.savings.toFixed(2)}.`,
      risk_score: t.riskScore,
      created_at: createdAt,
    });

    routes.push({
      id: routeId,
      payment_plan_id: planId,
      route_name: t.routeName,
      chain: t.chain,
      estimated_gas: t.gasCost,
      estimated_time: t.duration,
      transaction_count: t.txns,
      risk_score: t.riskScore,
      total_score: Math.round(t.riskScore / 2 + t.txns * 5),
      savings: t.savings,
      is_recommended: true,
      created_at: createdAt,
    });

    if (t.status === "COMPLETED") {
      txns.push({
        id: `demo-txn-${i + 1}`,
        payment_request_id: reqId,
        payment_plan_id: planId,
        hash: `0x${String(i + 1).padStart(64, "0")}deadbeef`,
        status: "CONFIRMED",
        chain_id: chainIdOf(t.chain),
        gas_used: Math.round(t.gasCost * 100_000),
        gas_cost: t.gasCost,
        created_at: createdAt,
        confirmed_at: new Date(NOW - t.hoursAgo + 60_000).toISOString(),
        explorer_url: null,
      });
    }
  });

  return { requests, plans, routes, txns };
}

function chainIdOf(chain: string): number {
  switch (chain) {
    case "ethereum":
      return 1;
    case "polygon":
      return 137;
    case "arbitrum":
      return 42161;
    case "optimism":
      return 10;
    case "base":
      return 8453;
    default:
      return 137;
  }
}

// --- Public builder -----------------------------------------------------------

export function buildDemoDashboard(reason: string): DashboardData {
  const { requests, plans, routes, txns } = buildRows();
  const generatedAt = new Date().toISOString();

  return {
    treasury: computeTreasury(DEMO_WALLET, DEMO_BUSINESS.business_name, DEMO_BUSINESS.default_chain),
    operations: computeOperationCounts(requests),
    recentPayments: computeRecentPayments(requests, txns, plans),
    optimization: computeOptimization(requests, txns, plans, routes),
    routeAnalytics: computeRouteAnalytics(requests, txns, plans, routes, 14),
    approvals: computeApprovals(requests, plans, routes),
    isFallback: true,
    fallbackReason: reason,
    generatedAt,
  };
}
