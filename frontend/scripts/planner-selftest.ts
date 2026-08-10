// =============================================================================
// IBAP Phase 6 — Transaction Planner Engine self-test
// Exercises the deterministic planner core (no OpenAI key needed):
//   - candidate generation for payment / swap / bridge intents
//   - the STEP MODEL completeness & dependency invariants
//   - settlement (FX) math
//   - incompleteness gate (security)
//   - determinism (same input -> identical plans)
//   - LLM-proposal materialisation with guard rails
//   - Zod shape validation of the final result
//   cd frontend && npx tsx scripts/planner-selftest.ts
// =============================================================================

import {
  computeSettlement,
  generateCandidates,
  generateExecutionPlans,
  materializePlans,
  pickFundingAsset,
} from "../src/lib/planner/planner";
import { PlannerResultSchema } from "../src/lib/planner/schema";
import type { RawStrategy } from "../src/lib/planner/schema";
import { PlannerError } from "../src/lib/planner/types";
import type {
  CandidateExecutionPlan,
  PlanStep,
  PlannerTreasuryContext,
} from "../src/lib/planner/types";
import type { StructuredIntent } from "../src/lib/ai/intent-schema";

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
  check(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const ALICE = "0x71c7656ec7ab88b098defb751b7401b5f6d8976f";

function makeIntent(overrides: Partial<StructuredIntent> = {}): StructuredIntent {
  return {
    action: "payment",
    recipient: "Alice",
    recipientAddress: ALICE,
    amount: 2500,
    currency: "USDC",
    sourceCurrency: null,
    sourceAmount: null,
    targetChain: null,
    purpose: "Invoice INV-1024",
    dueDate: "Friday",
    confidence: 0.93,
    missingInformation: [],
    rawInput: "Pay Alice 2500 USDC",
    source: "llm",
    ...overrides,
  };
}

function makeTreasury(overrides: Partial<PlannerTreasuryContext> = {}): PlannerTreasuryContext {
  return {
    availableAssets: [
      { symbol: "ETH", balance: "12.5", usdValue: 22500 },
      { symbol: "USDC", balance: "25000", usdValue: 25000 },
    ],
    supportedChains: [
      { chainId: 1, name: "Ethereum", symbol: "ETH" },
      { chainId: 137, name: "Polygon", symbol: "POL" },
      { chainId: 42161, name: "Arbitrum", symbol: "ETH" },
      { chainId: 10, name: "Optimism", symbol: "ETH" },
      { chainId: 8453, name: "Base", symbol: "ETH" },
    ],
    preferredChain: "ethereum",
    totalEstimatedUSDValue: 47500,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// STEP MODEL invariant checks
// -----------------------------------------------------------------------------

const STEP_FIELDS = [
  "id",
  "order",
  "actionType",
  "title",
  "description",
  "sourceChain",
  "destinationChain",
  "tok",
  "estimatedGas",
  "estimatedDuration",
  "deps",
  "status",
];

function validateStepModel(plan: CandidateExecutionPlan): string[] {
  const problems: string[] = [];
  const orders = plan.steps.map((s) => s.order);
  for (const s of plan.steps) {
    for (const f of STEP_FIELDS) {
      if (!(f in s)) problems.push(`${plan.id} step ${s.order} missing field "${f}"`);
    }
    if (s.id !== `${plan.id}-s${s.order}-${s.actionType.toLowerCase()}`) {
      problems.push(`${plan.id} step ${s.order} has non-deterministic id "${s.id}"`);
    }
    if (s.status !== "PENDING") problems.push(`${plan.id} step ${s.order} status should be PENDING`);
    if (!(s.estimatedGas >= 0)) problems.push(`${plan.id} step ${s.order} gas must be >= 0`);
    if (!(s.estimatedDuration >= 0)) problems.push(`${plan.id} step ${s.order} duration must be >= 0`);
    for (const d of s.deps) {
      if (!orders.includes(d) || d >= s.order) {
        problems.push(`${plan.id} step ${s.order} has invalid dep ${d}`);
      }
    }
  }
  // sequential 1..N
  for (let i = 1; i <= plan.steps.length; i++) {
    if (!orders.includes(i)) problems.push(`${plan.id} is missing step order ${i}`);
  }
  return problems;
}

// -----------------------------------------------------------------------------
// Test: example intent "Pay Alice 2500 USDC" with ETH in treasury (Ethereum)
// -----------------------------------------------------------------------------

async function testExamplePayment() {
  const intent = makeIntent();
  const treasury = makeTreasury();

  const result = await generateExecutionPlans({ intent, treasury, forceFallback: true });

  check("example: deterministic source", result.source === "deterministic");
  check("example: 2 candidate plans", result.plans.length === 2, `got ${result.plans.length}`);
  assertEqual("example: settlementAsset", result.settlementAsset, "USDC");
  assertEqual("example: settlementAmount", result.settlementAmount, 2500);

  const planA = result.plans.find((p) => p.strategy === "native_swap");
  const planB = result.plans.find((p) => p.strategy === "bridge_then_swap_pay");
  check("example: Plan A is native_swap (ETH -> USDC)", !!planA);
  check("example: Plan B is bridge_then_swap_pay (Polygon)", !!planB);

  if (planA) {
    const types = planA.steps.map((s) => s.actionType);
    assertEqual("example: Plan A steps [SWAP, TRANSFER, CONFIRM]", types, ["SWAP", "TRANSFER", "CONFIRM"]);
    check("example: Plan A step model valid", validateStepModel(planA).length === 0, validateStepModel(planA).join("; "));
  }
  if (planB) {
    const types = planB.steps.map((s) => s.actionType);
    assertEqual("example: Plan B steps [BRIDGE, SWAP, TRANSFER, CONFIRM]", types, [
      "BRIDGE",
      "SWAP",
      "TRANSFER",
      "CONFIRM",
    ]);
    const bridge = planB.steps.find((s) => s.actionType === "BRIDGE");
    check("example: Plan B bridge source=ethereum dest=polygon",
      !!bridge && bridge.sourceChain?.chainId === 1 && bridge.destinationChain?.chainId === 137);
    check("example: Plan B step model valid", validateStepModel(planB).length === 0, validateStepModel(planB).join("; "));
  }

  check("example: exactly one recommended plan", result.plans.filter((p) => p.isRecommended).length === 1);
  check("example: recommended is Plan A", result.recommendedPlanId === "planA", `got ${result.recommendedPlanId}`);
  check("example: recommended has best score",
    result.plans[0].totalScore >= result.plans[1].totalScore);

  // Determinism
  const again = await generateExecutionPlans({ intent, treasury, forceFallback: true });
  assertEqual("example: deterministic across runs", JSON.stringify(again), JSON.stringify(result));

  // Zod shape guarantee
  const zodOk = PlannerResultSchema.safeParse(result).success;
  check("example: result passes Zod shape", zodOk);
}

// -----------------------------------------------------------------------------
// Test: direct USDC payment when treasury holds only USDC
// -----------------------------------------------------------------------------

async function testDirectPayment() {
  const intent = makeIntent();
  const treasury = makeTreasury({
    availableAssets: [{ symbol: "USDC", balance: "25000", usdValue: 25000 }],
  });

  const result = await generateExecutionPlans({ intent, treasury, forceFallback: true });
  const planA = result.plans.find((p) => p.strategy === "native_direct");
  const planB = result.plans.find((p) => p.strategy === "bridge_then_pay");
  check("direct: Plan A is native_direct", !!planA);
  check("direct: Plan B is bridge_then_pay", !!planB);
  if (planA) {
    const types = planA.steps.map((s) => s.actionType);
    assertEqual("direct: Plan A steps [CHECK_ALLOWANCE, TRANSFER, CONFIRM]", types, [
      "CHECK_ALLOWANCE",
      "TRANSFER",
      "CONFIRM",
    ]);
    check("direct: Plan A step model valid", validateStepModel(planA).length === 0, validateStepModel(planA).join("; "));
  }
  check("direct: recommended is direct plan", result.recommendedPlanId === "planA");
}

// -----------------------------------------------------------------------------
// Test: fiat settlement (MYR -> USDC) & swap intent
// -----------------------------------------------------------------------------

async function testFiatAndSwap() {
  const fiatIntent = makeIntent({ currency: "MYR" });
  const settlement = computeSettlement(fiatIntent);
  assertEqual("fiat: fxRate MYR->USDC", settlement.fxRate, 4.4);
  assertEqual("fiat: settlement amount 2500/4.4", settlement.settlementAmount, 568.18);
  assertEqual("fiat: settlement asset", settlement.settlementAsset, "USDC");

  const swapIntent = makeIntent({
    action: "swap_and_payment",
    amount: null,
    currency: "USDC",
    sourceCurrency: "USDT",
    sourceAmount: 5000,
  });
  const treasury = makeTreasury({
    availableAssets: [
      { symbol: "USDT", balance: "5000", usdValue: 5000 },
      { symbol: "ETH", balance: "12.5", usdValue: 22500 },
    ],
  });
  const result = await generateExecutionPlans({ intent: swapIntent, treasury, forceFallback: true });
  assertEqual("swap: settlement asset", result.settlementAsset, "USDC");
  assertEqual("swap: settlement amount from sourceAmount", result.settlementAmount, 5000);
  const planA = result.plans.find((p) => p.strategy === "native_swap");
  if (planA) {
    const types = planA.steps.map((s) => s.actionType);
    assertEqual("swap: Plan A steps with approve", types, [
      "CHECK_ALLOWANCE",
      "APPROVE",
      "SWAP",
      "TRANSFER",
      "CONFIRM",
    ]);
    check("swap: funding picked USDT", pickFundingAsset(swapIntent, treasury, result.settlementAsset) === "USDT");
    check("swap: step model valid", validateStepModel(planA).length === 0, validateStepModel(planA).join("; "));
  }
}

// -----------------------------------------------------------------------------
// Test: bridge intent targets Polygon
// -----------------------------------------------------------------------------

async function testBridgeIntent() {
  const intent = makeIntent({ action: "bridge_and_payment", targetChain: "polygon" });
  const treasury = makeTreasury();
  const result = await generateExecutionPlans({ intent, treasury, forceFallback: true });
  // Alt chain must be polygon regardless of preferred chain
  const bridgePlans = result.plans.filter((p) => p.strategy.startsWith("bridge"));
  check("bridge: has bridge candidates", bridgePlans.length > 0);
  for (const plan of bridgePlans) {
    const bridge = plan.steps.find((s) => s.actionType === "BRIDGE");
    check("bridge: destination chain is polygon", !!bridge && bridge.destinationChain?.chainId === 137);
  }
}

// -----------------------------------------------------------------------------
// Test: incompleteness gate (security)
// -----------------------------------------------------------------------------

async function testIncompleteGate() {
  const missingAddress = makeIntent({ recipientAddress: null, confidence: 0.5 });
  let threw = false;
  try {
    await generateExecutionPlans({ intent: missingAddress, treasury: makeTreasury(), forceFallback: true });
  } catch (err) {
    threw = err instanceof PlannerError && err.code === "INCOMPLETE_INTENT";
  }
  check("gate: missing recipient address blocked", threw);

  const missingAmount = makeIntent({ amount: null, confidence: 0.4 });
  threw = false;
  try {
    await generateExecutionPlans({ intent: missingAmount, treasury: makeTreasury(), forceFallback: true });
  } catch (err) {
    threw = err instanceof PlannerError && err.code === "INCOMPLETE_INTENT";
  }
  check("gate: missing amount blocked", threw);
}

// -----------------------------------------------------------------------------
// Test: LLM proposal materialisation with guard rails
// -----------------------------------------------------------------------------

async function testMaterialiseProposals() {
  const intent = makeIntent();
  const treasury = makeTreasury();
  const settlement = computeSettlement(intent);

  const proposals: RawStrategy = {
    plans: [
      { id: "planA", name: "Ethereum swap & transfer", description: "Swap ETH to USDC on Ethereum then transfer.", routeType: "native_swap" },
      { id: "planB", name: "Polygon bridge & settle", description: "Bridge ETH to Polygon, swap to USDC, transfer.", routeType: "bridge_then_swap_pay" },
      { id: "planC", name: "Direct USDC transfer", description: "Pay USDC directly on Ethereum.", routeType: "native_direct" },
      { id: "planD", name: "Duplicate of A", description: "Duplicate", routeType: "native_swap" }, // duplicate -> deduped
    ],
    reasoning: ["Treasury holds ETH but payment is in USDC", "Bridging to Polygon lowers gas"],
  };

  const plans = materializePlans(intent, treasury, settlement, proposals);
  check("llm: 3 distinct plans (duplicate deduped)", plans.length === 3, `got ${plans.length}`);
  check("llm: exactly one recommended", plans.filter((p) => p.isRecommended).length === 1);
  for (const plan of plans) {
    check(`llm: ${plan.id} step model valid`, validateStepModel(plan).length === 0, validateStepModel(plan).join("; "));
  }
  const planA = plans.find((p) => p.id === "planA");
  check("llm: planA kept native_swap", !!planA && planA.strategy === "native_swap");

  // Guard rail: native_swap proposal but no swap possible -> coerced to native_direct
  const usdcOnlyTreasury = makeTreasury({
    availableAssets: [{ symbol: "USDC", balance: "25000", usdValue: 25000 }],
  });
  const coerced = materializePlans(intent, usdcOnlyTreasury, settlement, {
    plans: [
      { id: "planA", name: "Swap", description: "Swap", routeType: "native_swap" },
    ],
    reasoning: [],
  });
  check("llm-guard: native_swap coerced to native_direct", coerced.length === 1 && coerced[0].strategy === "native_direct");
}

// -----------------------------------------------------------------------------
// Test: pure deterministic candidate generator (no async)
// -----------------------------------------------------------------------------

function testGenerateCandidates() {
  const intent = makeIntent();
  const treasury = makeTreasury();
  const settlement = computeSettlement(intent);
  const plans = generateCandidates(intent, treasury, settlement);
  check("candidates: 2 plans", plans.length === 2);
  check("candidates: all have >1 steps", plans.every((p) => p.steps.length >= 2));
  check("candidates: recommended flagged", plans.some((p) => p.isRecommended));
  const totalGas = plans[0].steps.reduce((s, x) => s + x.estimatedGas, 0);
  assertEqual("candidates: total gas equals sum of steps", plans[0].totalEstimatedGas, Math.round(totalGas * 100) / 100);
}

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

async function main() {
  console.log("=== IBAP Phase 6 — Planner Engine self-test ===\n");

  await testExamplePayment();
  await testDirectPayment();
  await testFiatAndSwap();
  await testBridgeIntent();
  await testIncompleteGate();
  await testMaterialiseProposals();
  testGenerateCandidates();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.error("\nFailures:");
    failures.forEach((f) => console.error(f));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Self-test crashed:", err);
  process.exit(1);
});
