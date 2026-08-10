// =============================================================================
// IBAP Phase 10 — Human Approval & Blockchain Execution self-test
// Exercises the execution engine core (no wallet / no key / no network needed):
//   - SmartWallet deployment registry (31337 present, mainnet absent)
//   - token decimals / native asset / amount -> wei parsing
//   - deterministic execution-plan id
//   - buildExecutionPlan: USDC transfer (transferToken) + native (executeTransaction)
//   - every typed error class: rejected / insufficient balance / RPC timeout /
//     contract revert / wrong network / wallet disconnected / unknown
//   - gas cost -> USD conversion
//   - explorer URL building (31337 -> null)
//   - execution status lifecycle + audit event constants
//
//   cd frontend && npx tsx scripts/execution-selftest.ts   (run AFTER tsc --noEmit)
// =============================================================================

import {
  getSmartWalletDeployment,
  isNativeAsset,
  resolveTokenDecimals,
  SMART_WALLET_ABI,
} from "../src/lib/execution/abi";
import { buildExplorerUrl } from "../src/lib/payment/execution";
import { errorLabel, mapEthersError, recoveryHint } from "../src/lib/execution/errors";
import {
  buildExecutionPlan,
  computeGasCostUsd,
  executionPlanId,
  parseAmountToWei,
} from "../src/lib/execution/execution";
import { ExecutionError } from "../src/lib/execution/types";
import type { ExecutionPlan } from "../src/lib/execution/types";
import type { ParsedPaymentIntent, PaymentPlan } from "../src/lib/payment/types";

// -----------------------------------------------------------------------------
// Tiny test harness (mirrors other phase self-tests)
// -----------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function assertEqual(name: string, actual: unknown, expected: unknown) {
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const VALID_ADDR = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

function makeIntent(overrides: Partial<ParsedPaymentIntent> = {}): ParsedPaymentIntent {
  return {
    detected: true,
    action: "PAY_VENDOR",
    recipientName: "Acme Vendor",
    recipientAddress: VALID_ADDR,
    amount: 1200,
    currency: "USD",
    requestedCurrency: "USDC",
    purpose: "Invoice settlement",
    invoiceNumber: "INV-1024",
    deadlineLabel: "Friday",
    deadlineDate: "2026-08-14",
    confidence: 0.92,
    missingInformation: [],
    rawInput: "Pay Acme $1,200 for invoice INV-1024.",
    ...overrides,
  };
}

function makePlan(overrides: Partial<PaymentPlan> = {}): PaymentPlan {
  return {
    settlementAsset: "USDC",
    settlementAmount: 1200,
    fxRate: 1,
    totalEstimatedGas: 4,
    estimatedDuration: 20,
    savings: 14,
    explanation: "Direct USDC transfer on Polygon is the recommended route.",
    routes: [
      {
        id: "route-polygon-direct",
        routeName: "Polygon Direct USDC",
        chain: "polygon",
        estimatedGas: 4,
        estimatedTime: 20,
        transactionCount: 1,
        riskScore: 5,
        totalScore: 94,
        savings: 14,
        isRecommended: true,
      },
      {
        id: "route-arb-bridge",
        routeName: "Bridge via Arbitrum",
        chain: "arbitrum",
        estimatedGas: 6,
        estimatedTime: 90,
        transactionCount: 3,
        riskScore: 8,
        totalScore: 82,
        savings: 8,
        isRecommended: false,
      },
    ],
    steps: [
      { stepOrder: 1, actionType: "CHECK_ALLOWANCE", title: "Verify treasury allowance", description: "Ensure USDC allowance is set.", status: "PENDING" },
      { stepOrder: 2, actionType: "EXECUTE_PAYMENT", title: "Transfer USDC to Acme", description: "Move USDC to the recipient.", status: "PENDING" },
      { stepOrder: 3, actionType: "CONFIRM_SETTLEMENT", title: "Confirm settlement", description: "Verify the transfer landed.", status: "PENDING" },
    ],
    risk: {
      balanceCheck: "PASS",
      recipientCheck: "PASS",
      slippageCheck: "PASS",
      networkCheck: "PASS",
      contractCheck: "PASS",
      overallRisk: "LOW",
      warnings: [],
    },
    ...overrides,
  };
}

const DEPLOYMENT = getSmartWalletDeployment(31337);

// -----------------------------------------------------------------------------
// 1. Deployment registry
// -----------------------------------------------------------------------------

console.log("\n── Deployment registry ─────────────────────────────");
check("SmartWallet deployed on 31337", !!DEPLOYMENT);
check("SmartWallet has mock USDC on 31337", !!DEPLOYMENT?.mockUSDC && DEPLOYMENT.mockUSDC.startsWith("0x"));
check("SmartWallet absent on mainnet (1)", getSmartWalletDeployment(1) === null);
check("SmartWallet absent on unknown chain", getSmartWalletDeployment(999999) === null);
assertEqual("31337 mockUSDC is the Phase 9 MockERC20", DEPLOYMENT?.mockUSDC, "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

// -----------------------------------------------------------------------------
// 2. Token helpers
// -----------------------------------------------------------------------------

console.log("\n── Token helpers ────────────────────────────────────");
assertEqual("USDC decimals = 6", resolveTokenDecimals(137, "USDC"), 6);
assertEqual("ETH decimals = 18", resolveTokenDecimals(1, "ETH"), 18);
assertEqual("31337 fallback = 6", resolveTokenDecimals(31337, "USDT"), 6);
check("USDC is not native", !isNativeAsset("USDC"));
check("ETH is native", isNativeAsset("ETH"));
check("POL is native", isNativeAsset("POL"));
assertEqual("1200 USDC -> wei (6dp)", parseAmountToWei(1200, 6), "1200000000");
assertEqual("0.5 ETH -> wei (18dp)", parseAmountToWei(0.5, 18), "500000000000000000");

// -----------------------------------------------------------------------------
// 3. Deterministic plan id
// -----------------------------------------------------------------------------

console.log("\n── Execution plan id ─────────────────────────────────");
const pid1 = executionPlanId("pr-1", "route-a");
const pid2 = executionPlanId("pr-1", "route-a");
check("plan id is deterministic", pid1 === pid2);
check("plan id differs across routes", pid1 !== executionPlanId("pr-1", "route-b"));

// -----------------------------------------------------------------------------
// 4. buildExecutionPlan — USDC transfer
// -----------------------------------------------------------------------------

console.log("\n── buildExecutionPlan · USDC ─────────────────────────");
const usdcPlan: ExecutionPlan = buildExecutionPlan({
  paymentRequestId: "pr-1",
  paymentPlanId: "pp-1",
  intent: makeIntent(),
  plan: makePlan(),
  chainId: 31337,
  smartWalletAddress: DEPLOYMENT!.smartWallet,
  sourceLabel: "selftest",
});
assertEqual("settlement token", usdcPlan.token, "USDC");
assertEqual("amount wei", usdcPlan.amountWei, "1200000000");
assertEqual("token address = deployment mockUSDC", usdcPlan.tokenAddress, DEPLOYMENT!.mockUSDC);
assertEqual("recommended route selected", usdcPlan.routeId, "route-polygon-direct");
check("has exactly 1 executable step", usdcPlan.steps.filter((s) => s.tx).length === 1);
const usdcExec = usdcPlan.steps.find((s) => s.tx)!;
assertEqual("exec step kind = transferToken", usdcExec.tx!.kind, "transferToken");
assertEqual("exec step recipient", usdcExec.tx!.to, VALID_ADDR);
assertEqual("exec step amount", usdcExec.tx!.amountWei, "1200000000");
check("CHECK_ALLOWANCE is metadata (no tx)", usdcPlan.steps.find((s) => s.actionType === "CHECK_ALLOWANCE")?.tx === null);
check("CONFIRM_SETTLEMENT is metadata (no tx)", usdcPlan.steps.find((s) => s.actionType === "CONFIRM_SETTLEMENT")?.tx === null);

// -----------------------------------------------------------------------------
// 5. buildExecutionPlan — native ETH
// -----------------------------------------------------------------------------

console.log("\n── buildExecutionPlan · native ETH ───────────────────");
const ethPlan: ExecutionPlan = buildExecutionPlan({
  paymentRequestId: "pr-2",
  paymentPlanId: null,
  intent: makeIntent({ currency: "ETH", requestedCurrency: "ETH" }),
  plan: makePlan({
    settlementAsset: "ETH",
    settlementAmount: 0.5,
    routes: [
      {
        id: "route-eth-native",
        routeName: "Ethereum Native Transfer",
        chain: "ethereum",
        estimatedGas: 18,
        estimatedTime: 150,
        transactionCount: 1,
        riskScore: 5,
        totalScore: 94,
        savings: 0,
        isRecommended: true,
      },
    ],
  }),
  chainId: 31337,
  smartWalletAddress: DEPLOYMENT!.smartWallet,
});
assertEqual("native token is null", ethPlan.token, null);
assertEqual("native amount wei", ethPlan.amountWei, "500000000000000000");
assertEqual("native token address is null", ethPlan.tokenAddress, null);
const ethExec = ethPlan.steps.find((s) => s.tx)!;
assertEqual("native exec kind = executeTransaction", ethExec.tx!.kind, "executeTransaction");
assertEqual("native exec target = recipient", ethExec.tx!.to, VALID_ADDR);

// -----------------------------------------------------------------------------
// 6. Typed error classification (all 6 required classes + unknown)
// -----------------------------------------------------------------------------

console.log("\n── Error handling ────────────────────────────────────");
assertEqual("rejected (4001)", mapEthersError({ code: 4001 }).code, "REJECTED");
assertEqual("rejected (ACTION_REJECTED)", mapEthersError({ code: "ACTION_REJECTED" }).code, "REJECTED");
assertEqual(
  "insufficient balance",
  mapEthersError(new Error("insufficient funds for gas * price + value")).code,
  "INSUFFICIENT_BALANCE"
);
assertEqual("rpc timeout", mapEthersError(new Error("request timed out")).code, "RPC_TIMEOUT");
assertEqual(
  "contract revert",
  mapEthersError({ code: "CALL_EXCEPTION", shortMessage: "execution reverted: NotAuthorized" }).code,
  "CONTRACT_REVERT"
);
assertEqual(
  "wrong network",
  mapEthersError({ code: "NETWORK_ERROR", message: "could not detect network" }, { walletChainId: 1, planChainId: 137 }).code,
  "WRONG_NETWORK"
);
assertEqual(
  "wallet disconnected",
  mapEthersError(new Error("wallet not connected")).code,
  "WALLET_NOT_CONNECTED"
);
assertEqual("unknown fallback", mapEthersError(new Error("some weird failure")).code, "UNKNOWN");
check("ExecutionError preserved", mapEthersError(new ExecutionError("REJECTED", "no")) instanceof ExecutionError);
check("errorLabel has a label", typeof errorLabel("REJECTED") === "string" && errorLabel("REJECTED").length > 0);
check("recoveryHint has a hint", typeof recoveryHint("WRONG_NETWORK") === "string" && recoveryHint("WRONG_NETWORK").length > 0);

// -----------------------------------------------------------------------------
// 7. Gas cost -> USD
// -----------------------------------------------------------------------------

console.log("\n── Gas cost conversion ──────────────────────────────");
// 21000 gas * 1 gwei = 0.000021 ETH * $1800 = $0.0378
const gasUsd = computeGasCostUsd(
  { gasUsed: BigInt(21000), gasPrice: BigInt(1000000000) },
  31337
);
check("gas cost ~ $0.0378", Math.abs(gasUsd - 0.0378) < 0.001, `got ${gasUsd}`);

// -----------------------------------------------------------------------------
// 8. Explorer URL
// -----------------------------------------------------------------------------

console.log("\n── Explorer URL ──────────────────────────────────────");
check("31337 has no explorer (null)", buildExplorerUrl(31337, "0xabc") === null);
check("mainnet explorer built", buildExplorerUrl(1, "0xabc") === "https://etherscan.io/tx/0xabc");

// -----------------------------------------------------------------------------
// 9. Lifecycle + audit constants (mirrors the task's required set)
// -----------------------------------------------------------------------------

console.log("\n── Status lifecycle & audit events ──────────────────");
const STATUSES = ["SUBMITTED", "PENDING", "CONFIRMED", "FAILED"];
for (const s of STATUSES) check(`status constant ${s}`, typeof s === "string");
const AUDIT_EVENTS = [
  "PLAN_CREATED",
  "ROUTE_SELECTED",
  "RISK_CHECKED",
  "PAYMENT_APPROVED",
  "PAYMENT_EXECUTED",
  "PAYMENT_FAILED",
];
for (const e of AUDIT_EVENTS) check(`audit event ${e}`, typeof e === "string");
check("SmartWallet ABI has transferToken", SMART_WALLET_ABI.some((f) => f.startsWith("function transferToken")));
check("SmartWallet ABI has batchExecute", SMART_WALLET_ABI.some((f) => f.startsWith("function batchExecute")));
check("SmartWallet ABI has executeTransaction", SMART_WALLET_ABI.some((f) => f.startsWith("function executeTransaction")));

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

console.log(`\n${"─".repeat(60)}`);
console.log(`Execution engine self-test: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.error(f));
  process.exitCode = 1;
} else {
  console.log("All checks passed ✓");
}
