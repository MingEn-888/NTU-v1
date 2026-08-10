// =============================================================================
// PayMaster Phase 7 — Deterministic Route Optimization Engine self-test
// Exercises the optimizer core (no OpenAI key needed):
//   - normalization functions (min-max, savings, clamps)
//   - weight resolution (user weights re-normalized to sum 1)
//   - the documented weighted scoring model (Route A vs Route B)
//   - configurable weights (gas-heavy flips the recommendation)
//   - deterministic ranking & chain-preference bonus
//   - treasury feasibility gate (balance constraint)
//   - Zod validation of the request and the final result
//   - planner -> optimizer adapter (chain/token sequence extraction)
//   cd frontend && npx tsx scripts/route-selftest.ts
// =============================================================================

import { DEFAULT_ROUTE_WEIGHTS, CHAIN_PREFERENCE_BONUS, resolveWeights } from "../src/lib/route/catalog";
import {
  clampFactor,
  computeFactorBreakdowns,
  computeSavings,
  minMaxNormalize,
  normalizeArray,
  round2,
} from "../src/lib/route/normalize";
import { routeMatchesPreferredChain, resolvePreferredChainId, scoreRoutes } from "../src/lib/route/score";
import { fromPlannerPlans, gateByTreasury, optimizeRoutes } from "../src/lib/route/optimizer";
import { RouteOptimizerResultSchema } from "../src/lib/route/schema";
import { RouteOptimizerError } from "../src/lib/route/types";
import type { CandidateRoute, RouteOptimizerRequest } from "../src/lib/route/types";
import type { CandidateExecutionPlan, PlanStep } from "../src/lib/planner/types";

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

function assertClose(name: string, actual: number, expected: number, tol = 0.001) {
  check(name, Math.abs(actual - expected) <= tol, `expected ~${expected}, got ${actual}`);
}

// -----------------------------------------------------------------------------
// Fixtures — the canonical worked example from the spec:
//   Route A  Ethereum direct            Gas $18  Time 20s  Steps 1  Risk Low(8)
//   Route B  Ethereum -> Polygon USDC   Gas $4   Time 90s  Steps 3  Risk Med(35)
// -----------------------------------------------------------------------------

const ROUTE_A: CandidateRoute = {
  routeId: "routeA",
  name: "Ethereum direct transfer",
  description: "Pay USDC directly on Ethereum.",
  chainSequence: ["ethereum"],
  tokenSequence: ["USDC"],
  transactionCount: 1,
  estimatedGas: 18,
  estimatedDuration: 20,
  riskScore: 8,
  fundingAsset: "USDC",
  strategy: "native_direct",
  source: "deterministic",
};

const ROUTE_B: CandidateRoute = {
  routeId: "routeB",
  name: "Ethereum → Polygon · USDC settle",
  description: "Bridge USDC to Polygon then pay.",
  chainSequence: ["ethereum", "polygon"],
  tokenSequence: ["USDC", "USDC"],
  transactionCount: 3,
  estimatedGas: 4,
  estimatedDuration: 90,
  riskScore: 35,
  fundingAsset: "USDC",
  strategy: "bridge_then_pay",
  source: "deterministic",
};

function exampleRequest(overrides: Partial<RouteOptimizerRequest> = {}): RouteOptimizerRequest {
  return {
    routes: [ROUTE_A, ROUTE_B],
    treasury: { preferredChain: "ethereum", targetChain: null, availableAssets: [{ symbol: "USDC", usdValue: 25000 }] },
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// 1) Normalization functions
// -----------------------------------------------------------------------------

function testNormalization() {
  // min-max: 0 = best, 1 = worst
  assertEqual("norm: min value -> 0", minMaxNormalize(4, 4, 18), 0);
  assertEqual("norm: max value -> 1", minMaxNormalize(18, 4, 18), 1);
  assertClose("norm: midpoint -> 0.5", minMaxNormalize(11, 4, 18), 0.5);
  assertEqual("norm: flat range -> 0", minMaxNormalize(10, 10, 10), 0);
  assertEqual("norm: below min clamped -> 0", minMaxNormalize(1, 4, 18), 0);
  assertEqual("norm: above max clamped -> 1", minMaxNormalize(100, 4, 18), 1);

  // array normalization
  assertEqual("normArray: basic", normalizeArray([4, 11, 18]), [0, 0.5, 1]);
  assertEqual("normArray: empty", normalizeArray([]), []);
  assertEqual("normArray: flat", normalizeArray([5, 5, 5]), [0, 0, 0]);

  // savings
  assertEqual("savings: cheapest vs max baseline", computeSavings(4, 18), 14);
  assertEqual("savings: max route -> 0", computeSavings(18, 18), 0);
  assertEqual("savings: never negative", computeSavings(18, 4), 0);

  // clamps
  assertEqual("clamp: negative -> 0", clampFactor(-5, 0, 100), 0);
  assertEqual("clamp: NaN -> min", clampFactor(NaN, 0, 100), 0);
  assertEqual("clamp: over -> max", clampFactor(1000, 0, 100), 100);

  // factor breakdown helper
  const breakdown = computeFactorBreakdowns({ gas: [18, 4], time: [20, 90], steps: [1, 3], risk: [8, 35] });
  assertEqual("breakdown: route A gas worst (1)", breakdown[0].gas, 1);
  assertEqual("breakdown: route B gas best (0)", breakdown[1].gas, 0);
  assertEqual("breakdown: route A time best (0)", breakdown[0].time, 0);
  assertEqual("breakdown: route B time worst (1)", breakdown[1].time, 1);
}

// -----------------------------------------------------------------------------
// 2) Weight resolution
// -----------------------------------------------------------------------------

function testWeights() {
  const d = resolveWeights(undefined);
  assertClose("weights: default gas", d.gas, 0.4);
  assertClose("weights: default time", d.time, 0.2);
  assertClose("weights: default steps", d.steps, 0.15);
  assertClose("weights: default risk", d.risk, 0.25);
  assertClose("weights: default sum = 1", d.gas + d.time + d.steps + d.risk, 1);

  const partial = resolveWeights({ gas: 0.8 });
  assertClose("weights: partial re-normalized", partial.gas + partial.time + partial.steps + partial.risk, 1);
  assertClose("weights: partial gas dominates", partial.gas, 0.8 / (0.8 + 0.2 + 0.15 + 0.25));

  const custom = resolveWeights({ gas: 0.9, time: 0.03, steps: 0.02, risk: 0.05 });
  assertClose("weights: custom sum = 1", custom.gas + custom.time + custom.steps + custom.risk, 1);
  assertClose("weights: custom gas", custom.gas, 0.9);

  assertEqual("weights: DEFAULT_ROUTE_WEIGHTS sum 1",
    Math.round((DEFAULT_ROUTE_WEIGHTS.gas + DEFAULT_ROUTE_WEIGHTS.time + DEFAULT_ROUTE_WEIGHTS.steps + DEFAULT_ROUTE_WEIGHTS.risk) * 1e9) / 1e9,
    1);
}

// -----------------------------------------------------------------------------
// 3) The documented weighted scoring model
// -----------------------------------------------------------------------------

function testScoringModel() {
  // Preferred chain = ethereum -> Route A (settles on Ethereum) gets the bonus.
  const result = optimizeRoutes(exampleRequest());

  check("model: 2 routes ranked", result.routes.length === 2, `got ${result.routes.length}`);
  check("model: recommended = routeA", result.recommendedRouteId === "routeA", `got ${result.recommendedRouteId}`);
  assertClose("model: routeA score 0.38 (0.40 - 0.02 preference)", result.routes[0].normalizedScore, 0.38);
  assertClose("model: routeB score 0.60", result.routes[1].normalizedScore, 0.60);
  assertEqual("model: routeA rank 1", result.routes[0].rank, 1);
  assertEqual("model: routeB rank 2", result.routes[1].rank, 2);

  const a = result.routes[0];
  const b = result.routes[1];
  assertEqual("model: routeA savings $0 (baseline)", a.estimatedSavings, 0);
  assertEqual("model: routeB saves $14", b.estimatedSavings, 14);
  assertClose("model: routeA optimizationScore", a.optimizationScore, 62);
  assertClose("model: routeB optimizationScore", b.optimizationScore, 40);

  // Factor contributions check: wg*Gas + wt*Time + ws*Steps + wr*Risk
  const contribA = a.contributions.gas + a.contributions.time + a.contributions.steps + a.contributions.risk;
  assertClose("model: sum of contributions = raw score", contribA, 0.4);
  assertClose("model: preference bonus applied on A", a.chainPreference.bonusApplied, CHAIN_PREFERENCE_BONUS);
  check("model: routeA matches preferred chain", a.chainPreference.matches === true);
  check("model: routeB does not match preferred chain", b.chainPreference.matches === false);

  // Reason strings are non-empty and deterministic.
  check("model: reason present", a.recommendationReason.length > 3);
  check("model: reason mentions score", a.recommendationReason.includes("score"));
}

// -----------------------------------------------------------------------------
// 4) No chain preference / default weights (raw scores 0.40 vs 0.60)
// -----------------------------------------------------------------------------

function testNoPreference() {
  const result = optimizeRoutes(
    exampleRequest({ treasury: { preferredChain: null, targetChain: null } })
  );
  assertClose("nopref: routeA raw score 0.40", result.routes[0].normalizedScore, 0.40);
  assertClose("nopref: routeB raw score 0.60", result.routes[1].normalizedScore, 0.60);
  assertClose("nopref: no bonus applied", result.routes[0].chainPreference.bonusApplied, 0);
}

// -----------------------------------------------------------------------------
// 5) Configurable weights — gas-heavy flips the recommendation to routeB
// -----------------------------------------------------------------------------

function testCustomWeights() {
  const result = optimizeRoutes(
    exampleRequest({
      weights: { gas: 0.9, time: 0.03, steps: 0.02, risk: 0.05 },
    })
  );
  check("custom: gas-heavy recommends routeB", result.recommendedRouteId === "routeB", `got ${result.recommendedRouteId}`);
  assertClose("custom: routeA score 0.88", result.routes[1].normalizedScore, 0.88, 0.002);
  assertClose("custom: routeB score 0.10", result.routes[0].normalizedScore, 0.10);
}

// -----------------------------------------------------------------------------
// 6) Determinism — same input, identical output
// -----------------------------------------------------------------------------

function testDeterminism() {
  const one = optimizeRoutes(exampleRequest());
  const two = optimizeRoutes(exampleRequest());
  assertEqual("determinism: identical output", JSON.stringify(two), JSON.stringify(one));
}

// -----------------------------------------------------------------------------
// 7) Treasury feasibility gate — infeasible routes are RETAINED with a penalty
// -----------------------------------------------------------------------------

function testFeasibilityGate() {
  // The gate identifies which routes the treasury can fund.
  const needsDai: CandidateRoute = {
    ...ROUTE_A,
    routeId: "routeDai",
    fundingAsset: "DAI",
  };
  const { feasible, infeasible, warnings } = gateByTreasury(
    [ROUTE_A, needsDai],
    { preferredChain: "ethereum", availableAssets: [{ symbol: "USDC", usdValue: 25000 }] }
  );
  check("gate: feasible keeps USDC route", feasible.some((r) => r.routeId === "routeA"));
  check("gate: DAI route infeasible", infeasible.some((r) => r.routeId === "routeDai"));
  check("gate: warning emitted", warnings.length === 1);

  // Native gas assets are always spendable.
  const native: CandidateRoute = { ...ROUTE_A, routeId: "native", fundingAsset: "ETH" };
  const g2 = gateByTreasury([native], { preferredChain: "ethereum", availableAssets: [{ symbol: "USDC" }] });
  check("gate: native ETH always feasible", g2.feasible.some((r) => r.routeId === "native"));

  // Infeasible routes are NOT excluded — retained, penalized, ranked last.
  const result = optimizeRoutes({
    routes: [ROUTE_A, needsDai],
    treasury: { preferredChain: "ethereum", availableAssets: [{ symbol: "USDC", usdValue: 25000 }] },
  });
  check("penalty: both routes retained", result.routes.length === 2, `got ${result.routes.length}`);
  check("penalty: recommended is feasible routeA", result.recommendedRouteId === "routeA", `got ${result.recommendedRouteId}`);
  check("penalty: routeA feasible", result.routes[0].routeId === "routeA" && result.routes[0].infeasible === false);
  check("penalty: routeDai retained + infeasible", result.routes[1].routeId === "routeDai" && result.routes[1].infeasible === true);
  assertClose("penalty: routeDai score 0.25 (0.00 + 0.25 penalty)", result.routes[1].normalizedScore, 0.25);
  assertClose("penalty: routeA score 0 (best)", result.routes[0].normalizedScore, 0);
  check("penalty: routeDai not recommended", result.routes[1].isRecommended === false);
  check("penalty: reason flags funding gap", result.routes[1].recommendationReason.includes("Cannot be funded"));

  // Every route infeasible -> still returned, no route recommended.
  const allBad = optimizeRoutes({
    routes: [needsDai],
    treasury: { preferredChain: "ethereum", availableAssets: [{ symbol: "USDC" }] },
  });
  check("penalty: all-infeasible still returns the route", allBad.routes.length === 1 && allBad.routes[0].infeasible === true);
  check("penalty: no recommendation when none fundable", allBad.recommendedRouteId === null);
}

// -----------------------------------------------------------------------------
// 8) Zod validation
// -----------------------------------------------------------------------------

function testValidation() {
  // Final result passes the shape guarantee.
  const result = optimizeRoutes(exampleRequest());
  check("validation: result passes Zod shape", RouteOptimizerResultSchema.safeParse(result).success);

  // Negative gas is rejected by the request schema.
  let threw = false;
  try {
    optimizeRoutes(exampleRequest({ routes: [{ ...ROUTE_A, estimatedGas: -1 }, ROUTE_B] }));
  } catch (e) {
    threw = e instanceof RouteOptimizerError && e.code === "VALIDATION_FAILED";
  }
  check("validation: negative gas rejected", threw);

  // Empty routes rejected.
  threw = false;
  try {
    optimizeRoutes(exampleRequest({ routes: [] }));
  } catch (e) {
    threw = e instanceof RouteOptimizerError && e.code === "EMPTY_ROUTES";
  }
  check("validation: empty routes rejected", threw);

  // All-zero weights rejected.
  threw = false;
  try {
    optimizeRoutes(exampleRequest({ weights: { gas: 0, time: 0, steps: 0, risk: 0 } }));
  } catch (e) {
    threw = e instanceof RouteOptimizerError && e.code === "INVALID_WEIGHTS";
  }
  check("validation: zero weights rejected", threw);
}

// -----------------------------------------------------------------------------
// 9) Planner adapter — CandidateExecutionPlan -> CandidateRoute
// -----------------------------------------------------------------------------

function mkStep(partial: Partial<PlanStep> & Pick<PlanStep, "id" | "order" | "actionType" | "tok">): PlanStep {
  return {
    title: partial.title ?? partial.actionType,
    description: partial.description ?? "",
    sourceChain: partial.sourceChain ?? null,
    destinationChain: partial.destinationChain ?? null,
    estimatedGas: partial.estimatedGas ?? 0,
    estimatedDuration: partial.estimatedDuration ?? 0,
    deps: partial.deps ?? [],
    status: "PENDING",
    ...partial,
  } as PlanStep;
}

function mkPlan(id: string, steps: PlanStep[]): CandidateExecutionPlan {
  return {
    id,
    name: id,
    strategy: "native_swap",
    description: "plan",
    steps,
    totalEstimatedGas: steps.reduce((s, x) => s + x.estimatedGas, 0),
    totalEstimatedDuration: steps.reduce((s, x) => s + x.estimatedDuration, 0),
    transactionCount: steps.filter((s) => ["APPROVE", "SWAP", "BRIDGE", "TRANSFER"].includes(s.actionType)).length,
    riskScore: 10,
    totalScore: 90,
    isRecommended: true,
    reasoning: ["fixture"],
  };
}

const ETHEREUM = { chainId: 1, name: "Ethereum", symbol: "ETH" };
const POLYGON = { chainId: 137, name: "Polygon", symbol: "POL" };

function testAdapter() {
  // native_swap plan: SWAP ETH->USDC (Ethereum), TRANSFER USDC (Ethereum)
  const swapPlan = mkPlan("planA", [
    mkStep({ id: "planA-s1-swap", order: 1, actionType: "SWAP", tok: "ETH", sourceChain: ETHEREUM, estimatedGas: 4.2 }),
    mkStep({ id: "planA-s2-transfer", order: 2, actionType: "TRANSFER", tok: "USDC", sourceChain: ETHEREUM, estimatedGas: 3.2 }),
    mkStep({ id: "planA-s3-confirm", order: 3, actionType: "CONFIRM", tok: "USDC", sourceChain: ETHEREUM }),
  ]);
  const [r1] = fromPlannerPlans([swapPlan]);
  assertEqual("adapter: chain sequence deduped", r1.chainSequence, ["Ethereum"]);
  assertEqual("adapter: token sequence", r1.tokenSequence, ["ETH", "USDC"]);
  assertEqual("adapter: funding asset = first on-chain tok", r1.fundingAsset, "ETH");
  assertEqual("adapter: tx count", r1.transactionCount, 2);

  // bridge plan: BRIDGE USDC Ethereum->Polygon, TRANSFER USDC Polygon
  const bridgePlan = mkPlan("planB", [
    mkStep({
      id: "planB-s1-bridge",
      order: 1,
      actionType: "BRIDGE",
      tok: "USDC",
      sourceChain: ETHEREUM,
      destinationChain: POLYGON,
    }),
    mkStep({ id: "planB-s2-transfer", order: 2, actionType: "TRANSFER", tok: "USDC", sourceChain: POLYGON }),
  ]);
  const [r2] = fromPlannerPlans([bridgePlan]);
  assertEqual("adapter: bridge chain sequence", r2.chainSequence, ["Ethereum", "Polygon"]);
  assertEqual("adapter: bridge token sequence deduped", r2.tokenSequence, ["USDC"]);
}

// -----------------------------------------------------------------------------
// 10) Chain-preference helpers
// -----------------------------------------------------------------------------

function testPreferenceHelpers() {
  assertEqual("pref: resolve ethereum", resolvePreferredChainId("ethereum", null), 1);
  assertEqual("pref: fall back to target chain", resolvePreferredChainId(null, "polygon"), 137);
  assertEqual("pref: preferred wins over target", resolvePreferredChainId("base", "polygon"), 8453);
  assertEqual("pref: unknown -> null", resolvePreferredChainId("solana", null), null);

  check("pref: routeA matches ethereum", routeMatchesPreferredChain(ROUTE_A, 1) === true);
  check("pref: routeB terminal polygon != ethereum", routeMatchesPreferredChain(ROUTE_B, 1) === false);
  check("pref: routeB matches polygon", routeMatchesPreferredChain(ROUTE_B, 137) === true);
}

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

testNormalization();
testWeights();
testScoringModel();
testNoPreference();
testCustomWeights();
testDeterminism();
testFeasibilityGate();
testValidation();
testAdapter();
testPreferenceHelpers();

console.log(`\nRoute optimizer self-test: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error("\nFailures:");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("All route optimizer checks passed.");
