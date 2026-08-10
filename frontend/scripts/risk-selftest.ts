// =============================================================================
// IBAP Phase 8 — Risk Evaluation & Transaction Simulation Engine self-test
// Exercises the risk engine core (no OpenAI key needed):
//   - all 7 risk checks (PASS / WARN / FAIL) individually
//   - deterministic risk scoring + LOW / MEDIUM / HIGH classification
//   - simulation totals (gas / bridge fee / slippage / total cost)
//   - expected result + warnings aggregation
//   - plain-English explanation grounded in validated data
//   - approval gate (required / canProceed / HIGH acknowledgement)
//   - determinism (identical input -> identical output)
//   - Zod validation (request + final result shape)
//   - Phase 4 plan adapter (chat flow)
//   cd frontend && npx tsx scripts/risk-selftest.ts
// =============================================================================

import {
  checkBalance,
  checkComplexity,
  checkGas,
  checkNetwork,
  checkRecipient,
  checkRoute,
  checkSlippage,
  runRiskChecks,
} from "../src/lib/risk/checks";
import { classifyRisk, computeRiskBreakdown, computeRoutePoints } from "../src/lib/risk/score";
import {
  buildApprovalGate,
  buildExpectedResult,
  computeTotals,
  simulate,
  simulationIdOf,
} from "../src/lib/risk/simulate";
import { buildDeterministicExplanation } from "../src/lib/risk/explain";
import { SimulationRequestSchema, SimulationResultSchema } from "../src/lib/risk/schema";
import { RiskEngineError } from "../src/lib/risk/types";
import type { SimulationRequest, SimulationResult, SimulationTreasury } from "../src/lib/risk/types";
import { simulationRequestFromPlan } from "../src/lib/risk/adapter";
import type { ParsedPaymentIntent, PaymentPlan } from "../src/lib/payment/types";

// -----------------------------------------------------------------------------
// Tiny test harness
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

function assertClose(name: string, actual: number, expected: number, tol = 0.01) {
  check(name, Math.abs(actual - expected) <= tol, `expected ~${expected}, got ${actual}`);
}

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const VALID_ADDR = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

const TREASURY: SimulationTreasury = {
  availableAssets: [
    { symbol: "USDC", balance: "25000", usdValue: 25000 },
    { symbol: "ETH", balance: "12.5", usdValue: 22500 },
  ],
  supportedChains: ["ethereum", "polygon", "arbitrum", "optimism", "base"],
  preferredChain: "ethereum",
  nativeGasBalance: "12.5",
  totalEstimatedUSDValue: 47500,
};

function baseRequest(overrides: Partial<SimulationRequest> = {}): SimulationRequest {
  return {
    payment: {
      recipient: "Acme Vendor",
      recipientAddress: VALID_ADDR,
      token: "USDC",
      amount: 1200,
    },
    route: {
      routeId: "routeB",
      name: "Ethereum → Polygon · USDC settle",
      chainSequence: ["ethereum", "polygon"],
      tokenSequence: ["USDC", "USDC"],
      transactionCount: 3,
      estimatedGas: 4,
      estimatedDuration: 90,
      strategy: "bridge_then_pay",
    },
    steps: [
      { order: 1, actionType: "CHECK_ALLOWANCE", title: "Verify allowance", chain: "ethereum", token: "USDC" },
      { order: 2, actionType: "BRIDGE", title: "Bridge to Polygon", chain: "ethereum", token: "USDC" },
      { order: 3, actionType: "TRANSFER", title: "Transfer to vendor", chain: "polygon", token: "USDC" },
    ],
    treasury: TREASURY,
    ...overrides,
  };
}

/** Minimal LOW-risk direct payment. */
function lowRiskRequest(): SimulationRequest {
  return {
    payment: { recipient: "Alice", recipientAddress: VALID_ADDR, token: "USDC", amount: 1200 },
    route: {
      routeId: "routeA",
      name: "Ethereum direct transfer",
      chainSequence: ["ethereum"],
      tokenSequence: ["USDC"],
      transactionCount: 1,
      estimatedGas: 18,
      estimatedDuration: 20,
      strategy: "native_direct",
    },
    steps: [
      { order: 1, actionType: "TRANSFER", title: "Transfer USDC", chain: "ethereum", token: "USDC" },
      { order: 2, actionType: "CONFIRM", title: "Confirm settlement", chain: "ethereum", token: "USDC" },
    ],
    treasury: TREASURY,
    walletGasBalanceUsd: 50,
  };
}

/** MEDIUM-risk bridge+swap payment. */
function mediumRiskRequest(): SimulationRequest {
  return {
    payment: { recipient: "Bob", recipientAddress: null, token: "USDC", amount: 30000 },
    route: {
      routeId: "planB",
      name: "Bridge + swap + pay",
      chainSequence: ["ethereum", "polygon"],
      tokenSequence: ["USDC", "USDC"],
      transactionCount: 4,
      estimatedGas: 4,
      estimatedDuration: 120,
      strategy: "bridge_then_swap_pay",
    },
    steps: [
      { order: 1, actionType: "CHECK_ALLOWANCE", title: "Verify allowance", chain: "ethereum", token: "USDC" },
      { order: 2, actionType: "APPROVE", title: "Approve spend", chain: "ethereum", token: "USDC" },
      { order: 3, actionType: "SWAP", title: "Swap USDC", chain: "ethereum", token: "USDC" },
      { order: 4, actionType: "BRIDGE", title: "Bridge", chain: "ethereum", token: "USDC" },
      { order: 5, actionType: "TRANSFER", title: "Transfer", chain: "polygon", token: "USDC" },
    ],
    treasury: TREASURY,
    slippageBps: 80,
    walletGasBalanceUsd: 5,
  };
}

/** HIGH-risk payment: every hard check fails, huge amount, bridge+swap. */
function highRiskRequest(): SimulationRequest {
  return {
    payment: { recipient: "Eve", recipientAddress: "0x123", token: "USDC", amount: 300000 },
    route: {
      routeId: "planH",
      name: "Bridge + double swap",
      chainSequence: ["ethereum", "moonchain"],
      tokenSequence: ["USDC", "USDC"],
      transactionCount: 6,
      estimatedGas: 40,
      estimatedDuration: 300,
      strategy: "bridge_then_swap_pay",
    },
    steps: [
      { order: 1, actionType: "APPROVE", title: "Approve", chain: "ethereum", token: "USDC" },
      { order: 2, actionType: "SWAP", title: "Swap 1", chain: "ethereum", token: "USDC" },
      { order: 3, actionType: "BRIDGE", title: "Bridge", chain: "ethereum", token: "USDC" },
      { order: 4, actionType: "SWAP", title: "Swap 2", chain: "moonchain", token: "USDC" },
      { order: 5, actionType: "TRANSFER", title: "Transfer", chain: "moonchain", token: "USDC" },
      { order: 6, actionType: "TRANSFER", title: "Transfer 2", chain: "moonchain", token: "USDC" },
    ],
    treasury: {
      availableAssets: [{ symbol: "DAI", balance: "1000", usdValue: 1000 }],
      supportedChains: ["ethereum"],
      preferredChain: "ethereum",
      nativeGasBalance: "0.1",
    },
    slippageBps: 150,
    walletGasBalanceUsd: 5,
  };
}

// -----------------------------------------------------------------------------
// 1) Individual risk checks
// -----------------------------------------------------------------------------

function testChecks() {
  // balance
  const bPass = checkBalance(lowRiskRequest());
  assertEqual("balance: sufficient -> PASS", bPass.status, "PASS");
  const bWarn = checkBalance(baseRequest({ payment: { recipient: "X", recipientAddress: null, token: "USDC", amount: 60000 } }));
  assertEqual("balance: insufficient -> WARN", bWarn.status, "WARN");
  const bFail = checkBalance(baseRequest({ treasury: { ...TREASURY, availableAssets: [{ symbol: "DAI", balance: "1000", usdValue: 1000 }] } }));
  assertEqual("balance: asset missing -> FAIL", bFail.status, "FAIL");

  // gas
  const gPass = checkGas(lowRiskRequest());
  assertEqual("gas: 50 vs 18 (2x buffer) -> PASS", gPass.status, "PASS");
  const gWarn = checkGas(mediumRiskRequest());
  assertEqual("gas: thin buffer -> WARN", gWarn.status, "WARN");
  const gFail = checkGas(highRiskRequest());
  assertEqual("gas: below fee -> FAIL", gFail.status, "FAIL");

  // recipient
  const rPass = checkRecipient(baseRequest());
  assertEqual("recipient: valid 0x -> PASS", rPass.status, "PASS");
  const rWarn = checkRecipient(baseRequest({ payment: { recipient: "Bob", recipientAddress: null, token: "USDC", amount: 1200 } }));
  assertEqual("recipient: no address -> WARN", rWarn.status, "WARN");
  const rFail = checkRecipient(baseRequest({ payment: { recipient: "Eve", recipientAddress: "not-an-address", token: "USDC", amount: 1200 } }));
  assertEqual("recipient: invalid -> FAIL", rFail.status, "FAIL");

  // network
  const nPass = checkNetwork(lowRiskRequest());
  assertEqual("network: supported -> PASS", nPass.status, "PASS");
  const nFail = checkNetwork(highRiskRequest());
  assertEqual("network: unsupported -> FAIL", nFail.status, "FAIL");

  // slippage
  const sPass = checkSlippage(lowRiskRequest());
  assertEqual("slippage: no swap -> PASS", sPass.status, "PASS");
  const sWarn = checkSlippage(mediumRiskRequest());
  assertEqual("slippage: 80bps -> WARN", sWarn.status, "WARN");
  const sFail = checkSlippage(highRiskRequest());
  assertEqual("slippage: 150bps -> FAIL", sFail.status, "FAIL");

  // route
  const routePass = checkRoute(lowRiskRequest());
  assertEqual("route: direct -> PASS", routePass.status, "PASS");
  const routeWarn = checkRoute({
    ...baseRequest(),
    steps: [
      { order: 1, actionType: "SWAP", title: "Swap", chain: "ethereum", token: "USDC" },
      { order: 2, actionType: "TRANSFER", title: "Transfer", chain: "ethereum", token: "USDC" },
    ],
  });
  assertEqual("route: swap only -> WARN", routeWarn.status, "WARN");
  const routeFail = checkRoute(baseRequest());
  assertEqual("route: bridge -> FAIL", routeFail.status, "FAIL");

  // complexity
  const cPass = checkComplexity(lowRiskRequest());
  assertEqual("complexity: 1 tx -> PASS", cPass.status, "PASS");
  const cWarn = checkComplexity(mediumRiskRequest());
  assertEqual("complexity: 4 tx -> WARN", cWarn.status, "WARN");
  const cFail = checkComplexity(highRiskRequest());
  assertEqual("complexity: 6 tx -> FAIL", cFail.status, "FAIL");
}

// -----------------------------------------------------------------------------
// 2) Scoring + classification
// -----------------------------------------------------------------------------

function testScoring() {
  const lowChecks = runRiskChecks(lowRiskRequest());
  const lowBreak = computeRiskBreakdown(lowRiskRequest(), lowChecks);
  assertEqual("score: LOW total = 10 (direct, 1.2k)", lowBreak.total, 10);
  assertEqual("score: LOW level", classifyRisk(lowBreak.total), "LOW");
  assertEqual("score: LOW checks all PASS (0 points)", lowBreak.checks.balance + lowBreak.checks.gas + lowBreak.checks.recipient + lowBreak.checks.network + lowBreak.checks.slippage + lowBreak.checks.complexity, 0);
  assertEqual("score: LOW route points = 2 (base only)", lowBreak.routePoints, 2);
  assertEqual("score: LOW amount points = 8 (1.2k tier)", lowBreak.checks.amount, 8);

  const medChecks = runRiskChecks(mediumRiskRequest());
  const medBreak = computeRiskBreakdown(mediumRiskRequest(), medChecks);
  assertEqual("score: MEDIUM level", classifyRisk(medBreak.total), "MEDIUM");
  check("score: MEDIUM total within 34-66", medBreak.total >= 34 && medBreak.total <= 66, `got ${medBreak.total}`);
  assertEqual("score: MEDIUM route points capped at 25", medBreak.routePoints, 25);
  assertClose("score: MEDIUM amount points = 14 (30k tier)", medBreak.checks.amount, 14);

  const hiChecks = runRiskChecks(highRiskRequest());
  const hiBreak = computeRiskBreakdown(highRiskRequest(), hiChecks);
  assertEqual("score: HIGH level", classifyRisk(hiBreak.total), "HIGH");
  assertEqual("score: HIGH total = 100", hiBreak.total, 100);
  assertEqual("score: HIGH route points capped at 25", hiBreak.routePoints, 25);
  assertEqual("score: HIGH amount points = 25 (300k tier)", hiBreak.checks.amount, 25);
  check("score: HIGH has FAIL checks", hiChecks.some((c) => c.status === "FAIL"));
}

// -----------------------------------------------------------------------------
// 3) Determinism
// -----------------------------------------------------------------------------

async function testDeterminism() {
  const one = await simulate(baseRequest());
  const two = await simulate(baseRequest());
  assertEqual("determinism: identical output", JSON.stringify(two), JSON.stringify(one));
  assertEqual("determinism: simulationId stable", simulationIdOf(baseRequest()), simulationIdOf(baseRequest()));
}

// -----------------------------------------------------------------------------
// 4) Totals
// -----------------------------------------------------------------------------

function testTotals() {
  const t = computeTotals(baseRequest());
  assertEqual("totals: gas 4", t.estimatedGasUsd, 4);
  assertEqual("totals: bridge fee 12 (ethereum source hop)", t.estimatedBridgeFeeUsd, 12);
  assertEqual("totals: no slippage (no swap)", t.estimatedSlippageUsd, 0);
  assertEqual("totals: total = 16", t.estimatedTotalCostUsd, 16);
  assertEqual("totals: duration 90", t.estimatedDuration, 90);
  assertEqual("totals: 3 tx", t.transactionCount, 3);

  const swap = computeTotals({ ...baseRequest(), steps: [{ order: 1, actionType: "SWAP", title: "Swap", chain: "ethereum", token: "USDC" }], slippageBps: 30 });
  assertClose("totals: swap slippage 1200 * 30bps = 3.60", swap.estimatedSlippageUsd, 3.6);
  assertClose("totals: swap total = gas 4 + slippage 3.6", swap.estimatedTotalCostUsd, 7.6);
}

// -----------------------------------------------------------------------------
// 5) Expected result + warnings
// -----------------------------------------------------------------------------

async function testExpectedAndWarnings() {
  const res = await simulate(mediumRiskRequest());
  check("expected: mentions amount", res.expectedResult.includes("30,000"));
  check("expected: mentions token", res.expectedResult.includes("USDC"));
  check("expected: mentions tx count", res.expectedResult.includes("transaction"));
  check("expected: mentions total cost", res.expectedResult.includes("$"));
  check("warnings: MEDIUM emits warnings", res.warnings.length > 0);
  check("warnings: recipient warn surfaced", res.warnings.some((w) => w.includes("Recipient")));

  const high = await simulate(highRiskRequest());
  check("warnings: HIGH emits high-risk warning", high.warnings.some((w) => w.includes("HIGH")));
}

// -----------------------------------------------------------------------------
// 6) Explanation — grounded in validated data only
// -----------------------------------------------------------------------------

async function testExplanation() {
  const res = await simulate(baseRequest());
  assertEqual("explain: deterministic source", res.explanationSource, "deterministic");
  check("explain: mentions risk level", res.explanation.includes(res.riskLevel));
  check("explain: mentions validated amount", res.explanation.includes("1,200"));
  check("explain: mentions validated token", res.explanation.includes("USDC"));
  check("explain: mentions total cost figure", res.explanation.includes("$"));

  // Deterministic builder is pure.
  const again = buildDeterministicExplanation(baseRequest(), res);
  assertEqual("explain: deterministic builder stable", res.explanation, again);
}

// -----------------------------------------------------------------------------
// 7) Approval gate — never auto-executes
// -----------------------------------------------------------------------------

async function testApprovalGate() {
  for (const req of [lowRiskRequest(), mediumRiskRequest(), highRiskRequest()]) {
    const res = await simulate(req);
    assertEqual(`approval: ${res.riskLevel} requires human approval`, res.approval.required, true);
    assertEqual(`approval: ${res.riskLevel} can proceed to review`, res.approval.canProceed, true);
    assertEqual(`approval: ${res.riskLevel} status PENDING`, res.approval.status, "PENDING");
  }
  const high = await simulate(highRiskRequest());
  assertEqual("approval: HIGH requires acknowledgement", high.approval.highRiskAcknowledged, true);
  const low = await simulate(lowRiskRequest());
  assertEqual("approval: LOW no forced acknowledgement", low.approval.highRiskAcknowledged, false);

  const gate = buildApprovalGate("HIGH");
  assertEqual("approval: gate never auto-executes", gate.required, true);
}

// -----------------------------------------------------------------------------
// 8) Zod validation + result shape
// -----------------------------------------------------------------------------

function testValidation() {
  const ok = SimulationRequestSchema.safeParse(baseRequest());
  check("zod: valid request passes", ok.success === true);

  const bad = SimulationRequestSchema.safeParse({ ...baseRequest(), payment: { ...baseRequest().payment, amount: -5 } });
  check("zod: negative amount rejected", bad.success === false);
}

async function testResultShape() {
  const res = await simulate(mediumRiskRequest());
  const parsed = SimulationResultSchema.safeParse(res);
  check("zod: result matches SimulationResultSchema", parsed.success === true);
  assertEqual("zod: exactly 7 checks", res.checks.length, 7);
  assertEqual("zod: source is 'risk'", res.source, "risk");
}

async function testEngineError() {
  // Zod rejects non-positive amounts first -> VALIDATION_FAILED.
  let threwValidation = false;
  try {
    await simulate({ ...baseRequest(), payment: { recipient: "X", recipientAddress: null, token: "USDC", amount: 0 } });
  } catch (err) {
    threwValidation = err instanceof RiskEngineError && err.code === "VALIDATION_FAILED";
  }
  check("error: non-positive amount rejected (VALIDATION_FAILED)", threwValidation);

  // The EMPTY_PAYMENT guard is defensive for callers that bypass Zod.
  const empty = baseRequest() as SimulationRequest;
  (empty.payment as { amount: number }).amount = 0;
  let threwEmpty = false;
  try {
    // Cast through unknown so the pre-validated object reaches the guard.
    await simulate(empty as unknown as SimulationRequest);
  } catch (err) {
    threwEmpty = err instanceof RiskEngineError && err.code === "VALIDATION_FAILED";
  }
  check("error: empty payment caught by validation guard", threwEmpty);
}

// -----------------------------------------------------------------------------
// 9) Phase 4 plan adapter (chat flow)
// -----------------------------------------------------------------------------

function testAdapter() {
  const intent: ParsedPaymentIntent = {
    detected: true,
    action: "PAY_VENDOR",
    recipientName: "Alice",
    recipientAddress: VALID_ADDR,
    amount: 2500,
    currency: "RM",
    requestedCurrency: "USDC",
    purpose: "Invoice INV-1024",
    invoiceNumber: "1024",
    deadlineLabel: "Friday",
    deadlineDate: null,
    confidence: 0.93,
    missingInformation: [],
    rawInput: "Pay Alice RM2,500 for invoice INV-1024 by Friday.",
  };

  const plan: PaymentPlan = {
    settlementAsset: "USDC",
    settlementAmount: 568.18,
    fxRate: 4.4,
    totalEstimatedGas: 0.045,
    estimatedDuration: 15,
    savings: 12.5,
    explanation: "Polygon Native USDC Direct Transfer selected.",
    routes: [
      {
        id: "route-polygon",
        routeName: "Polygon Native USDC Direct Transfer",
        chain: "polygon",
        estimatedGas: 0.045,
        estimatedTime: 15,
        transactionCount: 1,
        riskScore: 5,
        totalScore: 95,
        savings: 12.5,
        isRecommended: true,
      },
      {
        id: "route-eth",
        routeName: "Ethereum Mainnet Bridge & Pay",
        chain: "ethereum",
        estimatedGas: 4.8,
        estimatedTime: 180,
        transactionCount: 2,
        riskScore: 18,
        totalScore: 72,
        savings: 0,
        isRecommended: false,
      },
    ],
    steps: [
      { stepOrder: 1, actionType: "CHECK_ALLOWANCE", title: "Verify allowance", description: "x", status: "PENDING" },
      { stepOrder: 2, actionType: "EXECUTE_PAYMENT", title: "Transfer", description: "x", status: "PENDING" },
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
  };

  const req = simulationRequestFromPlan(intent, plan, TREASURY);
  assertEqual("adapter: settlement token", req.payment.token, "USDC");
  assertEqual("adapter: recipient", req.payment.recipient, "Alice");
  assertEqual("adapter: recommended route", req.route.name, "Polygon Native USDC Direct Transfer");
  assertEqual("adapter: 1 alternative", req.alternatives?.length, 1);
  check("adapter: produces a valid request", SimulationRequestSchema.safeParse(req).success === true);
}

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

async function main() {
  console.log("IBAP Phase 8 — Risk & Simulation Engine self-test\n");

  testChecks();
  testScoring();
  await testDeterminism();
  testTotals();
  await testExpectedAndWarnings();
  await testExplanation();
  await testApprovalGate();
  testValidation();
  await testResultShape();
  await testEngineError();
  testAdapter();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("\nFailures:");
    failures.forEach((f) => console.error(f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
