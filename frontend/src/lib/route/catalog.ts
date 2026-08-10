// =============================================================================
// PayMaster Phase 7 — Deterministic Route Optimization (catalog & constants)
//
// The default weights below are the SINGLE source of truth for how the engine
// trades cost against safety. Nothing in this file is influenced by the LLM —
// two identical route sets always produce identical rankings.
//
// -----------------------------------------------------------------------------
// WHY THESE DEFAULT WEIGHTS EXIST
//
//   Score(r) = wg*Gas(r) + wt*Time(r) + ws*Steps(r) + wr*Risk(r)  (sum = 1)
//
//   gas   0.40 — Gas is the direct, recurring monetary cost of a payment and
//                the largest controllable lever. A business treasury pays this
//                on every execution, so it dominates the model.
//   risk  0.25 — Funds safety is the second priority. A bridge or swap route
//                adds counterparty, slippage and bridge-failure risk; a route
//                that is cheap but can lose the payment is unacceptable. Risk
//                outranks speed because a lost payment is irrecoverable.
//   time  0.20 — Business payments often have due dates (Phase 5 intent), so
//                settlement speed matters — but confirmation times are bounded
//                and rarely worth sacrificing safety. It sits below risk.
//   steps 0.15 — Fewer transactions shrink the failure surface and operational
//                overhead. Steps already correlate with gas and risk, so it is
//                deliberately the lightest weight to avoid double counting.
// =============================================================================

import type { RouteWeights } from "./types";

/** Default weights — see header for the rationale. Sums to exactly 1. */
export const DEFAULT_ROUTE_WEIGHTS: RouteWeights = {
  gas: 0.4,
  time: 0.2,
  steps: 0.15,
  risk: 0.25,
};

/**
 * Soft bonus subtracted from the raw weighted score when a route's terminal
 * chain matches the treasury preferred chain or the intent target chain.
 *
 * Chain preference is intentionally a SMALL, deterministic adjustment, not a
 * fifth weight: the four primary weights are fixed by the model (sum = 1).
 * It only breaks near-ties between otherwise equal routes.
 */
export const CHAIN_PREFERENCE_BONUS = 0.02;

/**
 * Deterministic penalty added to the raw score of a route that the treasury
 * cannot fund (e.g. its funding asset is not held). Infeasible routes are
 * RETAINED in the candidate set and ranked with this penalty — they are never
 * excluded outright — so the model still reports them, but they sort behind
 * every feasible route and can never be recommended.
 */
export const INFEASIBLE_PENALTY = 0.25;

/** Float comparison tolerance used when breaking ties deterministically. */
export const SCORE_EPSILON = 1e-6;

/** Minimum and maximum risk scores accepted for a candidate route. */
export const RISK_SCORE_MIN = 0;
export const RISK_SCORE_MAX = 100;

/** Bounds for a single candidate route factor value. */
export const MAX_GAS_USD = 100_000;
export const MAX_DURATION_SECONDS = 7 * 24 * 3600; // one week
export const MAX_TRANSACTIONS = 100;

/**
 * Normalize partial user-supplied weights so they sum to exactly 1. Missing
 * factors keep their default proportion; if every factor is missing the full
 * default set is returned.
 */
export function resolveWeights(partial: Partial<RouteWeights> | undefined): RouteWeights {
  const base = { ...DEFAULT_ROUTE_WEIGHTS, ...(partial ?? {}) };
  const sum = base.gas + base.time + base.steps + base.risk;
  if (!isFinite(sum) || sum <= 0) return { ...DEFAULT_ROUTE_WEIGHTS };
  return {
    gas: base.gas / sum,
    time: base.time / sum,
    steps: base.steps / sum,
    risk: base.risk / sum,
  };
}
