// =============================================================================
// PayMaster Phase 13 — Yield Automation Engine self-test
// Exercises the deterministic yield engine (no API key, no chain needed):
//   - wei <-> human unit conversion
//   - expected annual yield math
//   - deterministic sweep (idle USDC above buffer -> DEPOSIT suggestion)
//   - no-idle / not-deployed failure modes
//   - WITHDRAW redeem math
//   - SmartWallet-compatible payload + ExecutionPlan encoding
//   - Zod validation of the suggestion output
//   cd frontend && npx tsx scripts/yield-selftest.ts
// =============================================================================

import {
  buildYieldExecutionPayload,
  buildYieldExecutionPlan,
  computeExpectedAnnualYieldUsd,
  fromWei,
  suggestYieldAllocation,
  suggestYieldWithdrawal,
  toWei,
} from "../src/lib/yield/engine";
import { pickBestStrategy, scoreStrategy, YIELD_STRATEGIES } from "../src/lib/yield/catalog";
import { YieldSuggestionSchema } from "../src/lib/yield/schema";
import { YieldEngineError } from "../src/lib/yield/types";
import type { YieldTreasuryContext } from "../src/lib/yield/types";

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

function assertClose(name: string, actual: number, expected: number, tol = 0.001) {
  check(name, Math.abs(actual - expected) <= tol, `expected ~${expected}, got ${actual}`);
}

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------
const treasury: YieldTreasuryContext = {
  totalEstimatedUSDValue: 25000,
  preferredChain: "polygon",
  availableAssets: [
    { symbol: "USDC", balance: "25000.00", usdValue: 25000, chain: "Polygon" },
    { symbol: "POL", balance: "1250.50", usdValue: 875.35, chain: "Polygon" },
  ],
};

// -----------------------------------------------------------------------------
// 1. Unit conversion
// -----------------------------------------------------------------------------
{
  const wei = toWei(20000, 6);
  check("toWei(20000, 6) returns 20000000000", wei === "20000000000", wei);
  assertClose("fromWei roundtrip", fromWei(wei, 6), 20000);
}

// -----------------------------------------------------------------------------
// 2. Annual yield math
// -----------------------------------------------------------------------------
{
  assertClose("5% APY on $20,000", computeExpectedAnnualYieldUsd(20000, 500), 1000);
  assertClose("4.5% APY on $10,000", computeExpectedAnnualYieldUsd(10000, 450), 450);
}

// -----------------------------------------------------------------------------
// 3. Deterministic sweep
// -----------------------------------------------------------------------------
{
  const result = suggestYieldAllocation(treasury, { chainId: 31337 });
  check("sweep returns one suggestion", result.suggestions.length === 1);
  check("source is deterministic", result.source === "deterministic");
  assertClose("buffer = 20% of $25,000", result.bufferUsd, 5000);
  assertClose("idle = $20,000", result.idleUsd, 20000);

  const s = result.suggestions[0];
  check("suggestion action is DEPOSIT", s.action === "DEPOSIT");
  check("deposit amount is $20,000", s.amount === "20000", s.amount);
  check("requiresApproval is true", s.requiresApproval === true);
  check("vault address is set", s.vaultAddress.startsWith("0x") && s.vaultAddress.length === 42);
  assertClose("expected annual yield $1,000", s.expectedAnnualYieldUsd, 1000);

  // Output shape-guarded by Zod.
  const shaped = YieldSuggestionSchema.parse(result);
  check("Zod accepts the suggestion output", shaped.suggestions.length === 1);
}

// -----------------------------------------------------------------------------
// 4. Failure modes
// -----------------------------------------------------------------------------
{
  // No idle capital when USDC <= buffer.
  const lowTreasury: YieldTreasuryContext = {
    totalEstimatedUSDValue: 1000,
    availableAssets: [{ symbol: "USDC", balance: "100.00", usdValue: 100 }],
  };
  const result = suggestYieldAllocation(lowTreasury, { chainId: 31337 });
  check("no-idle -> zero suggestions", result.suggestions.length === 0);
  assertClose("no-idle -> idle 0", result.idleUsd, 0);

  // Not deployed on chain 1.
  let threw = false;
  try {
    suggestYieldAllocation(treasury, { chainId: 1 });
  } catch (e) {
    threw = e instanceof YieldEngineError && e.code === "NOT_DEPLOYED";
  }
  check("undeployed chain throws NOT_DEPLOYED", threw);
}

// -----------------------------------------------------------------------------
// 5. Withdraw redeem
// -----------------------------------------------------------------------------
{
  const strategy = YIELD_STRATEGIES.find((s) => s.chainId === 31337)!;
  const w = suggestYieldWithdrawal(strategy, 5000);
  check("withdraw returns a WITHDRAW allocation", w?.action === "WITHDRAW");
  check("withdraw shares = needed USD", w?.shares === "5000", w?.shares);
  check("withdraw requires approval", w?.requiresApproval === true);

  const none = suggestYieldWithdrawal(strategy, 0);
  check("zero need -> null", none === null);
}

// -----------------------------------------------------------------------------
// 6. Payload + ExecutionPlan encoding
// -----------------------------------------------------------------------------
{
  const result = suggestYieldAllocation(treasury, { chainId: 31337 });
  const allocation = result.suggestions[0];
  const payload = buildYieldExecutionPayload(allocation);
  check("deposit payload targets the vault", payload.target === allocation.vaultAddress);
  check("deposit payload data is hex calldata", payload.data.startsWith("0x") && payload.data.length > 2);
  check("deposit payload value is 0", payload.value === "0");

  const plan = buildYieldExecutionPlan({
    allocation,
    chainId: 31337,
    smartWalletAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    tokenAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  });
  check("yield plan has 2 steps (approve + deposit)", plan.steps.length === 2);
  check("step 1 is approveToken", plan.steps[0].tx?.kind === "approveToken");
  check("step 2 is executeTransaction to vault", plan.steps[1].tx?.kind === "executeTransaction" && plan.steps[1].tx?.to === allocation.vaultAddress);
  check("step 2 actionType is STAKE", plan.steps[1].actionType === "STAKE");
}

// -----------------------------------------------------------------------------
// 7. Strategy catalog determinism
// -----------------------------------------------------------------------------
{
  const best = pickBestStrategy("USDC", 31337);
  check("pickBestStrategy picks the localhost vault", best?.id === "usdc-localhost-treasury");
  check("scoreStrategy is finite", Number.isFinite(scoreStrategy(YIELD_STRATEGIES[0])));
}

// -----------------------------------------------------------------------------
console.log(`\n[yield-selftest] ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
