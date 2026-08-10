// =============================================================================
// PayMaster Phase 6 — Planner Zod schemas
//
// Every input to POST /api/planner is validated here, and every object the
// planner emits is shape-checked before it can leave the service boundary. This
// guarantees that a free-form / malicious request body can never become a
// blockchain step, and that an LLM strategy can never bypass the step model.
// =============================================================================

import { z } from "zod";
import { StructuredIntentSchema } from "../ai/intent-schema";
import {
  PLAN_ACTION_TYPES,
  PLAN_ROUTE_TYPES,
  PLAN_STEP_STATUSES,
} from "./types";

export const ChainRefSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string().min(1).max(40),
  symbol: z.string().min(1).max(12),
});

export const PlannerTreasuryAssetSchema = z.object({
  symbol: z.string().min(1).max(12),
  balance: z.string(),
  usdValue: z.number().nonnegative(),
});

export const PlannerTreasuryContextSchema = z.object({
  availableAssets: z.array(PlannerTreasuryAssetSchema).max(50),
  supportedChains: z.array(ChainRefSchema).max(50),
  preferredChain: z.string().min(1).max(24),
  totalEstimatedUSDValue: z.number().nonnegative(),
});

/** POST /api/planner request body. `intent` is the Phase 5 StructuredIntent. */
export const PlannerRequestSchema = z.object({
  intent: StructuredIntentSchema,
  treasury: PlannerTreasuryContextSchema,
  businessId: z.string().max(64).optional(),
  model: z.string().max(64).optional(),
  forceFallback: z.boolean().optional(),
});

// -----------------------------------------------------------------------------
// Output shape — the step model is the only thing that may leave the service.
// -----------------------------------------------------------------------------

export const PlanStepSchema = z.object({
  id: z.string().min(1).max(64),
  order: z.number().int().positive(),
  actionType: z.enum(PLAN_ACTION_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  sourceChain: ChainRefSchema.nullable(),
  destinationChain: ChainRefSchema.nullable(),
  tok: z.string().min(1).max(16),
  estimatedGas: z.number().nonnegative(),
  estimatedDuration: z.number().nonnegative(),
  deps: z.array(z.number().int().positive()),
  status: z.enum(PLAN_STEP_STATUSES),
});

export const CandidateExecutionPlanSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  strategy: z.enum(PLAN_ROUTE_TYPES),
  description: z.string().min(1).max(500),
  steps: z.array(PlanStepSchema).min(1),
  totalEstimatedGas: z.number().nonnegative(),
  totalEstimatedDuration: z.number().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
  riskScore: z.number().min(0).max(100),
  totalScore: z.number().min(0).max(100),
  isRecommended: z.boolean(),
  reasoning: z.array(z.string()).max(12),
});

export const PlannerResultSchema = z.object({
  plans: z.array(CandidateExecutionPlanSchema).min(1),
  source: z.enum(["llm", "deterministic"]),
  recommendedPlanId: z.string().nullable(),
  fxRate: z.number().nonnegative(),
  settlementAsset: z.string().min(1).max(12),
  settlementAmount: z.number().nonnegative(),
});

export type PlannerRequestInput = z.infer<typeof PlannerRequestSchema>;
export type PlannerResultOutput = z.infer<typeof PlannerResultSchema>;

/**
 * Raw LLM strategy proposal schema. The LLM may ONLY propose which strategy
 * families to consider (native_direct / native_swap / bridge_then_pay /
 * bridge_then_swap_pay) plus display metadata — it never emits blockchain steps.
 */
export const RawStrategySchema = z.object({
  plans: z
    .array(
      z.object({
        id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/, "invalid strategy id"),
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().min(1).max(400),
        routeType: z.enum(PLAN_ROUTE_TYPES),
      })
    )
    .min(1)
    .max(4),
  reasoning: z.array(z.string().trim().max(200)).max(6),
});

export type RawStrategy = z.infer<typeof RawStrategySchema>;
