// =============================================================================
// IBAP Phase 7 — Deterministic Route Optimization Engine (service)
//
// FLOW:
//   Candidate Routes (from the Phase 6 planner — optionally LLM-proposed
//   strategies — or provided directly by a caller)
//     -> feasibility gate (treasury balance)
//     -> deterministic normalization (each factor -> [0,1])
//     -> deterministic weighted scoring (LOWER IS BETTER)
//     -> deterministic ranking + recommendation reason
//
// The LLM's ONLY role is to have proposed candidate *strategies* upstream.
// The final route decision is made HERE, deterministically, by the
// mathematical model — never by the LLM.
//
// Public API:
//   optimizeRoutes(input)          — full pipeline (validate -> gate -> score)
//   fromPlannerPlans(plans, ...)   — adapter that turns Phase 6
//                                    CandidateExecutionPlan[] into CandidateRoute[]
// =============================================================================

import { RouteOptimizerRequestSchema, RouteOptimizerResultSchema } from "./schema";
import type { RouteOptimizerRequestInput } from "./schema";
import { scoreRoutes, resolvePreferredChainId } from "./score";
import type {
  CandidateRoute,
  OptimizedRoute,
  RouteOptimizerRequest,
  RouteOptimizerResult,
  RouteTreasuryContext,
} from "./types";
import { RouteOptimizerError } from "./types";
import type { CandidateExecutionPlan } from "../planner/types";

// -----------------------------------------------------------------------------
// Planner adapter — Phase 6 CandidateExecutionPlan[] -> CandidateRoute[]
// -----------------------------------------------------------------------------

/**
 * Convert Phase 6 candidate execution plans into route-optimizer candidates.
 * Chain/token sequences are derived deterministically from the plan steps
 * (deduplicated consecutive hops, so "Bridge + Transfer on Polygon" yields
 * ["Ethereum", "Polygon"] not a duplicated Polygon).
 */
export function fromPlannerPlans(plans: CandidateExecutionPlan[]): CandidateRoute[] {
  return plans.map((plan) => {
    const chainSequence: string[] = [];
    const tokenSequence: string[] = [];
    for (const step of plan.steps) {
      if (step.sourceChain) {
        const name = step.sourceChain.name;
        if (chainSequence[chainSequence.length - 1] !== name) chainSequence.push(name);
      }
      if (step.destinationChain) {
        const name = step.destinationChain.name;
        if (chainSequence[chainSequence.length - 1] !== name) chainSequence.push(name);
      }
      const tok = step.tok;
      if (tokenSequence[tokenSequence.length - 1] !== tok) tokenSequence.push(tok);
    }
    if (!chainSequence.length) chainSequence.push("unknown");

    const onChain = plan.steps.find((s) =>
      ["CHECK_ALLOWANCE", "APPROVE", "SWAP", "BRIDGE", "TRANSFER"].includes(s.actionType)
    );
    return {
      routeId: plan.id,
      name: plan.name,
      description: plan.description,
      chainSequence,
      tokenSequence,
      transactionCount: plan.transactionCount,
      estimatedGas: plan.totalEstimatedGas,
      estimatedDuration: plan.totalEstimatedDuration,
      riskScore: plan.riskScore,
      fundingAsset: onChain?.tok ?? tokenSequence[0],
      strategy: plan.strategy,
      source: "deterministic" as const,
    };
  });
}

// -----------------------------------------------------------------------------
// Feasibility gate — treasury balance
// -----------------------------------------------------------------------------

/**
 * Filter candidate routes to those the treasury can actually fund.
 * A route is infeasible when its funding asset is a non-native token that is
 * absent from `treasury.availableAssets`. Native gas assets (ETH/POL) are
 * always considered spendable (the treasury keeps a gas reserve).
 */
export function gateByTreasury(
  routes: CandidateRoute[],
  treasury: RouteTreasuryContext | undefined
): { feasible: CandidateRoute[]; infeasible: CandidateRoute[]; warnings: string[] } {
  if (!treasury || !Array.isArray(treasury.availableAssets) || !treasury.availableAssets.length) {
    return { feasible: routes, infeasible: [], warnings: [] };
  }

  const held = new Set(
    treasury.availableAssets.map((a) => (a.symbol || "").toUpperCase()).filter(Boolean)
  );
  const feasible: CandidateRoute[] = [];
  const infeasible: CandidateRoute[] = [];
  const warnings: string[] = [];

  for (const route of routes) {
    const funding = (route.fundingAsset || "").toUpperCase();
    if (funding === "ETH" || funding === "POL" || held.has(funding) || !funding) {
      feasible.push(route);
    } else {
      infeasible.push(route);
      warnings.push(
        `Route "${route.routeId}" needs ${funding} which the treasury does not hold — retained with an infeasibility penalty.`
      );
    }
  }

  return { feasible, infeasible, warnings };
}

// -----------------------------------------------------------------------------
// Public entrypoint
// -----------------------------------------------------------------------------

export function optimizeRoutes(input: RouteOptimizerRequest): RouteOptimizerResult {
  if (!input.routes || !input.routes.length) {
    throw new RouteOptimizerError("EMPTY_ROUTES", "At least one candidate route is required.");
  }

  // Validate the request shape up front (Zod).
  const parsed = RouteOptimizerRequestSchema.safeParse(input as unknown as RouteOptimizerRequestInput);
  if (!parsed.success) {
    throw new RouteOptimizerError("VALIDATION_FAILED", "Request failed Zod validation.", {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  // Optional weights validation (all non-negative and at least one positive).
  if (input.weights) {
    const w = input.weights;
    const values = [w.gas, w.time, w.steps, w.risk].filter((v) => typeof v === "number") as number[];
    if (values.some((v) => v < 0) || values.every((v) => v === 0)) {
      throw new RouteOptimizerError(
        "INVALID_WEIGHTS",
        "Weights must be non-negative and at least one weight must be positive."
      );
    }
  }

  // Feasibility gate (treasury balance). Infeasible routes are NOT excluded —
  // they are retained and scored with a deterministic penalty so the engine
  // always reports the full candidate set, but can never recommend an
  // unfundable route.
  const { infeasible, warnings } = gateByTreasury(input.routes, input.treasury);
  const infeasibleIds = new Set(infeasible.map((r) => r.routeId));
  if (infeasibleIds.size) {
    warnings.push(
      `${infeasibleIds.size} route(s) cannot be funded by the treasury — retained with an infeasibility penalty.`
    );
  }

  const preferredChainId = resolvePreferredChainId(
    input.treasury?.preferredChain,
    input.treasury?.targetChain
  );

  // Savings baseline spans every candidate (feasible + infeasible) so savings
  // remain comparable across the full candidate set.
  const baselineGas =
    input.baselineGas != null && input.baselineGas >= 0
      ? input.baselineGas
      : Math.max(...input.routes.map((r) => r.estimatedGas), 0);

  const { routes: ranked, weights } = scoreRoutes(
    input.routes,
    input.weights,
    preferredChainId,
    baselineGas,
    infeasibleIds
  );

  if (!ranked.length) {
    throw new RouteOptimizerError("NO_FEASIBLE_ROUTES", "No route could be scored.");
  }

  const recommendedRouteId = ranked[0]?.isRecommended ? ranked[0].routeId : null;

  // Final shape guarantee — throws if any route deviates from the model.
  const result = RouteOptimizerResultSchema.parse({
    routes: ranked as OptimizedRoute[],
    recommendedRouteId,
    weights,
    baselineGas,
    warnings,
    source: "optimizer",
  });
  return result;
}
