// =============================================================================
// IBAP Phase 7 — Route Optimizer Zod schemas
//
// Every input to POST /api/route/optim is validated here, and every route the
// optimizer emits is shape-checked before it can leave the service boundary.
// This guarantees that free-form / malicious input can never become a ranked
// recommendation, and that the deterministic selection is always the final
// decision — not the LLM.
// =============================================================================

import { z } from "zod";

export const RouteWeightsSchema = z.object({
  gas: z.number().min(0).max(1000),
  time: z.number().min(0).max(1000),
  steps: z.number().min(0).max(1000),
  risk: z.number().min(0).max(1000),
});

export const RouteWeightsPartialSchema = RouteWeightsSchema.partial();

export const RouteTreasuryAssetSchema = z.object({
  symbol: z.string().min(1).max(12),
  balance: z.string().optional(),
  usdValue: z.number().nonnegative().optional(),
});

export const RouteTreasuryContextSchema = z.object({
  preferredChain: z.string().min(1).max(40).nullable().optional(),
  targetChain: z.string().min(1).max(40).nullable().optional(),
  availableAssets: z.array(RouteTreasuryAssetSchema).max(50).optional(),
});

const RouteIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/, "invalid route id");

export const CandidateRouteSchema = z.object({
  routeId: RouteIdSchema,
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  chainSequence: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  tokenSequence: z.array(z.string().trim().min(1).max(16)).min(1).max(8),
  transactionCount: z.number().int().min(0).max(100),
  estimatedGas: z.number().min(0).max(100_000),
  estimatedDuration: z.number().min(0).max(7 * 24 * 3600),
  riskScore: z.number().min(0).max(100),
  fundingAsset: z.string().trim().min(1).max(16).nullable().optional(),
  strategy: z
    .enum(["native_direct", "native_swap", "bridge_then_pay", "bridge_then_swap_pay"])
    .nullable()
    .optional(),
  source: z.enum(["llm", "deterministic", "manual"]).nullable().optional(),
});

/** POST /api/route/optim request body. */
export const RouteOptimizerRequestSchema = z.object({
  routes: z.array(CandidateRouteSchema).min(1).max(12),
  weights: RouteWeightsPartialSchema.optional(),
  treasury: RouteTreasuryContextSchema.optional(),
  baselineGas: z.number().min(0).max(100_000).nullable().optional(),
  sourceLabel: z.string().trim().min(1).max(64).nullable().optional(),
});

// -----------------------------------------------------------------------------
// Output shape — the optimized route is the only thing that may leave the
// service, and every field is shape-checked before return.
// -----------------------------------------------------------------------------

export const ChainPreferenceSchema = z.object({
  preferredChainId: z.number().int().nullable(),
  matches: z.boolean(),
  bonusApplied: z.number().nonnegative(),
});

export const RouteFactorBreakdownSchema = z.object({
  gas: z.number().min(0).max(1),
  time: z.number().min(0).max(1),
  steps: z.number().min(0).max(1),
  risk: z.number().min(0).max(1),
});

export const RouteFactorContributionsSchema = RouteFactorBreakdownSchema;

export const OptimizedRouteSchema = z.object({
  routeId: RouteIdSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(500),
  chainSequence: z.array(z.string().min(1).max(40)).min(1),
  tokenSequence: z.array(z.string().min(1).max(16)).min(1),
  transactionCount: z.number().int().min(0),
  estimatedGas: z.number().nonnegative(),
  estimatedDuration: z.number().nonnegative(),
  riskScore: z.number().min(0).max(100),
  normalizedScore: z.number().min(0).max(1),
  optimizationScore: z.number().min(0).max(100),
  estimatedSavings: z.number().nonnegative(),
  rank: z.number().int().positive(),
  recommendationReason: z.string().min(1).max(500),
  isRecommended: z.boolean(),
  infeasible: z.boolean(),
  factorBreakdown: RouteFactorBreakdownSchema,
  contributions: RouteFactorContributionsSchema,
  chainPreference: ChainPreferenceSchema,
  strategy: z.string().nullable(),
  source: z.enum(["llm", "deterministic", "manual"]).nullable(),
});

export const RouteOptimizerResultSchema = z.object({
  routes: z.array(OptimizedRouteSchema).min(1),
  recommendedRouteId: z.string().nullable(),
  weights: RouteWeightsSchema,
  baselineGas: z.number().nonnegative(),
  warnings: z.array(z.string()).max(20),
  source: z.literal("optimizer"),
});

export type RouteOptimizerRequestInput = z.infer<typeof RouteOptimizerRequestSchema>;
export type RouteOptimizerResultOutput = z.infer<typeof RouteOptimizerResultSchema>;
