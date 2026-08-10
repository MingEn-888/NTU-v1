// =============================================================================
// Phase 11 — dashboard data-layer self-test (no Supabase / no key needed).
// Runs the deterministic demo builder + aggregation math and asserts the
// shapes the /api/dashboard route and the UI rely on.
//
//   npx tsx scripts/dashboard-selftest.ts   (after `npx tsc --noEmit`)
// =============================================================================

import {
  buildDemoDashboard,
  computeApprovals,
  computeOperationCounts,
  computeOptimization,
  computeRecentPayments,
  computeRouteAnalytics,
  computeTreasury,
  toUsd,
} from "../src/lib/dashboard";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ""}`);
  }
}

console.log("IBAP Phase 11 dashboard self-test\n");

// --- FX conversion ------------------------------------------------------------
console.log("FX conversion (reuses CURRENCY_CONFIG rates)");
check("RM 2,500 -> 568.18 USDC", Math.abs(toUsd(2500, "MYR") - 568.18) < 0.02);
check("SGD 1,900 -> 1407.41 USDC", Math.abs(toUsd(1900, "SGD") - 1407.41) < 0.02);
check("USDC 1,000 -> 1,000", toUsd(1000, "USDC") === 1000);
check("Unknown currency assumed 1:1", toUsd(500, "XYZ") === 500);

// --- Demo builder -------------------------------------------------------------
console.log("\nDemo dashboard builder (deterministic, offline)");
const demo = buildDemoDashboard("selftest");
check("treasury present", !!demo.treasury);
check("treasury totalValueUsd > 0", demo.treasury.totalValueUsd > 0);
check("availableUsdc == 25000", demo.treasury.availableUsdc === 25000);
check("nativeGasBalance == 1250.5", demo.treasury.nativeGasBalance === 1250.5);
check("supportedChains length >= 5", demo.treasury.supportedChains.length >= 5);
check("operations.completed >= 8", demo.operations.completed >= 8, demo.operations);
check("operations.pendingApprovals >= 3", demo.operations.pendingApprovals >= 3, demo.operations);
check("recentPayments has rows", demo.recentPayments.length > 0);
check("approvals queue non-empty", demo.approvals.length > 0, demo.approvals.length);
check("optimization.totalGasSavedUsd > 0", demo.optimization.totalGasSavedUsd > 0, demo.optimization);
check("optimization.avgTxnsPerPayment >= 1", demo.optimization.avgTxnsPerPayment >= 1);
check("gasSavedOverTime == 14 buckets", demo.routeAnalytics.gasSavedOverTime.length === 14, demo.routeAnalytics.gasSavedOverTime.length);
check("paymentVolume == 14 buckets", demo.routeAnalytics.paymentVolume.length === 14);
check("paymentsByChain non-empty", demo.routeAnalytics.paymentsByChain.length > 0, demo.routeAnalytics.paymentsByChain);
check("isFallback true in offline demo", demo.isFallback === true);
check("generatedAt set", !!demo.generatedAt);

// --- Recent payment shape -----------------------------------------------------
console.log("\nRecent payment shape");
const first = demo.recentPayments[0];
check("has recipientName", !!first?.recipientName);
check("has netAmountUsdc", typeof first?.netAmountUsdc === "number");
check("has status", !!first?.status);
check("has purpose", !!first?.purpose);
check("has createdAt", !!first?.createdAt);

// --- Approval item shape ------------------------------------------------------
console.log("\nApproval item shape");
const approval = demo.approvals[0];
check("has routeName", !!approval?.routeName);
check("riskLevel in {LOW,MEDIUM,HIGH}", ["LOW", "MEDIUM", "HIGH"].includes(approval?.riskLevel ?? ""));
check("has savingsUsd", typeof approval?.savingsUsd === "number");
check("has netAmountUsdc", typeof approval?.netAmountUsdc === "number");

// --- Determinism --------------------------------------------------------------
console.log("\nDeterminism (same input -> same output)");
const demo2 = buildDemoDashboard("selftest-again");
check(
  "totalGasSavedUsd identical",
  demo.optimization.totalGasSavedUsd === demo2.optimization.totalGasSavedUsd
);
check(
  "paymentsByChain identical",
  JSON.stringify(demo.routeAnalytics.paymentsByChain) === JSON.stringify(demo2.routeAnalytics.paymentsByChain)
);

// --- Individual functions on empty input ---------------------------------------
console.log("\nEmpty-input safety (no crashes)");
const emptyRows = { paymentRequests: [], txns: [], paymentPlans: [], routeOptions: [], approvals: [] as any[] };
check("computeOperationCounts([])", computeOperationCounts([]).total === 0);
check("computeRecentPayments([])", computeRecentPayments([], [], []).length === 0);
check("computeOptimization([]) zeros", computeOptimization([], [], [], []).avgPaymentCostUsd === 0);
check("computeRouteAnalytics([]) buckets", computeRouteAnalytics([], [], [], [], 14).gasSavedOverTime.length === 14);
check("computeApprovals([])", computeApprovals([], [], []).length === 0);
check("computeTreasury(null) works", computeTreasury(null, "X", "polygon").totalValueUsd > 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
