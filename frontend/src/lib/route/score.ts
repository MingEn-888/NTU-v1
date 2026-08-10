// =============================================================================
// PayMaster Phase 7 — Deterministic Route Optimization (weighted scoring model)
//
//   Score(r) = wg*Gas(r) + wt*Time(r) + ws*Steps(r) + wr*Risk(r)
//
//   wg + wt + ws + wr = 1, each factor normalized to [0,1] (0 = best).
//   LOWER SCORE IS BETTER.
//
// A small, deterministic chain-preference bonus is then subtracted from the
// raw score when a route settles on the preferred/requested chain, so the
// model breaks near-ties in favour of the treasury's preferred chain without
// adding a fifth weight.
// =============================================================================

import {
  CHAIN_PREFERENCE_BONUS,
  INFEASIBLE_PENALTY,
  SCORE_EPSILON,
  resolveWeights,
} from "./catalog";
import {
  computeFactorBreakdowns,
  computeSavings,
  round2,
  round4,
} from "./normalize";
import { resolveChainId, PLANNER_CHAINS } from "../planner/catalog";
import type {
  CandidateRoute,
  ChainPreference,
  OptimizedRoute,
  RouteFactorBreakdown,
  RouteWeights,
} from "./types";

/**
 * Compute the normalized factor breakdowns for a set of candidate routes.
 * Values are clamped to sane domains first so one bad route cannot distort the
 * entire ranking.
 *
 * Infeasible routes (treasury cannot fund them) are RETAINED and scored with a
 * deterministic `INFEASIBLE_PENALTY` added to their raw score. They always sort
 * behind every feasible route and can never be recommended.
 */
export function scoreRoutes(
  routes: CandidateRoute[],
  weightsInput: Partial<RouteWeights> | undefined,
  preferredChainId: number | null,
  baselineGas: number,
  infeasibleIds: Set<string> = new Set()
): { routes: OptimizedRoute[]; weights: RouteWeights } {
  const weights = resolveWeights(weightsInput);
  if (!routes.length) {
    return { routes: [], weights };
  }

  // --- 1. Clamp raw factors into sane domains -------------------------------
  const gas = routes.map((r) => clamp(r.estimatedGas, 0, 100_000));
  const time = routes.map((r) => clamp(r.estimatedDuration, 0, 7 * 24 * 3600));
  const steps = routes.map((r) => clamp(r.transactionCount, 0, 100));
  const risk = routes.map((r) => clamp(r.riskScore, 0, 100));

  // --- 2. Normalize each factor to [0,1] across the candidate set ------------
  const breakdowns: RouteFactorBreakdown[] = computeFactorBreakdowns({
    gas,
    time,
    steps,
    risk,
  });

  // --- 3. Weighted scoring + savings + chain preference + feasibility --------
  const scored = routes.map((route, i) => {
    const b = breakdowns[i];
    const contributions = {
      gas: round4(weights.gas * b.gas),
      time: round4(weights.time * b.time),
      steps: round4(weights.steps * b.steps),
      risk: round4(weights.risk * b.risk),
    };
    const rawScore = round4(
      contributions.gas + contributions.time + contributions.steps + contributions.risk
    );

    const infeasible = infeasibleIds.has(route.routeId);
    // Infeasible routes keep their normalized factors but pay a fixed penalty so
    // they rank behind every fundable route.
    const normalizedScore = round4(
      Math.max(0, rawScore - (infeasible ? 0 : chainPreference(route, preferredChainId).bonusApplied) + (infeasible ? INFEASIBLE_PENALTY : 0))
    );

    const savings = computeSavings(route.estimatedGas, baselineGas);

    return {
      route,
      b,
      contributions,
      rawScore,
      normalizedScore,
      preference: chainPreference(route, preferredChainId),
      infeasible,
      savings,
    };
  });

  // --- 4. Rank: feasible first, then lower score; tie-break deterministically.
  scored.sort(
    (a, b) =>
      Number(a.infeasible) - Number(b.infeasible) ||
      a.normalizedScore - b.normalizedScore ||
      a.route.estimatedGas - b.route.estimatedGas ||
      a.route.transactionCount - b.route.transactionCount ||
      a.route.estimatedDuration - b.route.estimatedDuration ||
      a.route.routeId.localeCompare(b.route.routeId)
  );

  const best = scored.find((s) => !s.infeasible)?.normalizedScore ?? scored[0]?.normalizedScore ?? 0;
  const optimized = scored.map((s, i) => {
    const isBest = !s.infeasible && Math.abs(s.normalizedScore - best) <= SCORE_EPSILON && i === 0;
    return {
      routeId: s.route.routeId,
      name: s.route.name || s.route.routeId,
      description: s.route.description || "",
      chainSequence: s.route.chainSequence,
      tokenSequence: s.route.tokenSequence,
      transactionCount: s.route.transactionCount,
      estimatedGas: round2(s.route.estimatedGas),
      estimatedDuration: Math.round(s.route.estimatedDuration),
      riskScore: round2(s.route.riskScore),
      normalizedScore: s.normalizedScore,
      optimizationScore: round2(Math.max(0, (1 - s.normalizedScore) * 100)),
      estimatedSavings: s.savings,
      rank: i + 1,
      recommendationReason: recommendationReason(
        s.route,
        s.b,
        s.normalizedScore,
        isBest,
        s.preference,
        s.infeasible
      ),
      isRecommended: isBest,
      infeasible: s.infeasible,
      factorBreakdown: s.b,
      contributions: s.contributions,
      chainPreference: s.preference,
      strategy: s.route.strategy ?? null,
      source: s.route.source ?? null,
    };
  });

  return { routes: optimized, weights };
}

/** Resolve the treasury preferred / intent target chain to a canonical id. */
export function resolvePreferredChainId(
  preferredChain: string | null | undefined,
  targetChain: string | null | undefined
): number | null {
  const fromPref = preferredChain ? resolveChainId(preferredChain) : null;
  if (fromPref !== null) return fromPref;
  return targetChain ? resolveChainId(targetChain) : null;
}

/** Whether a route's terminal chain matches the preferred chain id. */
export function routeMatchesPreferredChain(
  route: CandidateRoute,
  preferredChainId: number | null
): boolean {
  if (preferredChainId === null) return false;
  const terminal = route.chainSequence[route.chainSequence.length - 1];
  const terminalId = terminal ? resolveChainId(terminal) : null;
  return terminalId === preferredChainId;
}

/** Deterministic chain-preference adjustment for a route. */
function chainPreference(route: CandidateRoute, preferredChainId: number | null): ChainPreference {
  const matches = routeMatchesPreferredChain(route, preferredChainId);
  return {
    preferredChainId,
    matches,
    bonusApplied: matches ? CHAIN_PREFERENCE_BONUS : 0,
  };
}

/** Clamp helper local to the scorer. */
function clamp(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Human-readable chain label for a chain name/alias. */
function chainLabel(name: string): string {
  const id = resolveChainId(name);
  if (id !== null && PLANNER_CHAINS[id]) return PLANNER_CHAINS[id].name;
  return name;
}

/**
 * Deterministic recommendation reason. Composed from the normalized factors
 * (which factors the route wins / loses) plus whether it settles on the
 * preferred chain. Infeasible routes are flagged as such. Never free-form
 * text — pure code.
 */
function recommendationReason(
  route: CandidateRoute,
  b: RouteFactorBreakdown,
  score: number,
  isBest: boolean,
  preference: ChainPreference,
  infeasible: boolean
): string {
  const parts: string[] = [];

  if (infeasible) {
    parts.push(`Cannot be funded by the treasury (needs ${(route.fundingAsset || "funding").toUpperCase()})`);
    parts.push(`penalized +${INFEASIBLE_PENALTY}`);
  }

  const bestFactors: string[] = [];
  const worstFactors: string[] = [];
  if (b.gas <= SCORE_EPSILON) bestFactors.push("cheapest gas");
  else if (b.gas >= 1 - SCORE_EPSILON) worstFactors.push("most expensive");
  if (b.time <= SCORE_EPSILON) bestFactors.push("fastest");
  else if (b.time >= 1 - SCORE_EPSILON) worstFactors.push("slowest");
  if (b.steps <= SCORE_EPSILON) bestFactors.push("fewest steps");
  else if (b.steps >= 1 - SCORE_EPSILON) worstFactors.push("most steps");
  if (b.risk <= SCORE_EPSILON) bestFactors.push("lowest risk");
  else if (b.risk >= 1 - SCORE_EPSILON) worstFactors.push("highest risk");

  if (isBest) {
    parts.push(`Best score ${score.toFixed(3)} in the candidate set`);
  } else {
    parts.push(`Normalized score ${score.toFixed(3)}`);
  }
  if (bestFactors.length) parts.push(`best on ${bestFactors.join(", ")}`);
  if (worstFactors.length) parts.push(`worst on ${worstFactors.join(", ")}`);
  if (!infeasible && preference.matches) {
    const label = preference.preferredChainId !== null ? PLANNER_CHAINS[preference.preferredChainId]?.name : null;
    parts.push(`settles on preferred chain${label ? ` (${label})` : ""}`);
  }
  const terminal = route.chainSequence[route.chainSequence.length - 1];
  parts.push(`route: ${chainLabel(terminal)} via ${route.transactionCount} tx · $${route.estimatedGas.toFixed(2)} gas`);

  return parts.join(" · ");
}
