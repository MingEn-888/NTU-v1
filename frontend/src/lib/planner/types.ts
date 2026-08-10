// =============================================================================
// PayMaster Phase 6 — Transaction Planner Engine (domain types)
//
// The planner converts a *validated* StructuredIntent (Phase 5) + treasury
// context into one or more CandidateExecutionPlan objects. Every candidate plan
// is an ordered list of deterministic blockchain operations (PlanStep).
//
// Trust boundary (the LLM NEVER emits a blockchain transaction):
//   Validated Intent + Treasury Context
//     -> LLM proposes HIGH-LEVEL strategies only (route types, never txns)
//     -> deterministic builder materialises ordered PlanStep objects
//     -> deterministic scoring picks the recommended plan
// The step model below is the ONLY representation of an executable operation.
// =============================================================================

/** Lifecycle of a single plan step as it moves through the pipeline. */
export type PlanStepStatus = "PENDING" | "EXECUTING" | "COMPLETED" | "FAILED" | "BLOCKED";

export const PLAN_STEP_STATUSES = ["PENDING", "EXECUTING", "COMPLETED", "FAILED", "BLOCKED"] as const;

/**
 * The only blockchain operations the planner can emit. Deliberately closed —
 * new actions require code, never free-form LLM output.
 */
export type PlanActionType =
  | "CHECK_ALLOWANCE" // off-chain read: verify ERC20 allowance for the router
  | "APPROVE" // on-chain: grant spend allowance for an ERC20 input token
  | "SWAP" // on-chain: swap one asset for another via an aggregated DEX
  | "BRIDGE" // on-chain: move an asset across chains (sourceChain -> destinationChain)
  | "TRANSFER" // on-chain: send the settlement asset to the recipient
  | "CONFIRM"; // off-chain: await block confirmation & reconcile the ledger

export const PLAN_ACTION_TYPES = [
  "CHECK_ALLOWANCE",
  "APPROVE",
  "SWAP",
  "BRIDGE",
  "TRANSFER",
  "CONFIRM",
] as const;

/**
 * High-level strategy families the LLM is allowed to propose. Each maps to a
 * deterministic step builder — the LLM can pick a strategy, never the steps.
 */
export type PlanRouteType =
  | "native_direct" // pay settlement asset directly on one chain (1 tx)
  | "native_swap" // swap treasury asset -> settlement asset, then pay (2 tx)
  | "bridge_then_pay" // bridge settlement asset to cheaper chain, then pay
  | "bridge_then_swap_pay"; // bridge, swap to settlement asset, then pay

export const PLAN_ROUTE_TYPES = [
  "native_direct",
  "native_swap",
  "bridge_then_pay",
  "bridge_then_swap_pay",
] as const;

/** A chain reference (deterministic registry — see catalog.ts). */
export interface ChainRef {
  chainId: number;
  name: string;
  symbol: string;
}

/**
 * STEP MODEL — the canonical unit of execution.
 * Every candidate plan is built exclusively from these objects.
 */
export interface PlanStep {
  /** Stable deterministic id, e.g. "planB-s2-swap". */
  id: string;
  /** 1-based execution order within the plan. */
  order: number;
  actionType: PlanActionType;
  title: string;
  description: string;
  /** Chain this step operates on (null for generic confirmations). */
  sourceChain: ChainRef | null;
  /** Chain funds are delivered to (only BRIDGE steps set this). */
  destinationChain: ChainRef | null;
  /** Token symbol being moved by this step (e.g. ETH, USDC, USDT). */
  tok: string;
  /** Estimated gas cost in USD. */
  estimatedGas: number;
  /** Estimated duration in seconds. */
  estimatedDuration: number;
  /** 1-based orders of prerequisite steps that must complete first. */
  deps: number[];
  status: PlanStepStatus;
}

/** A complete candidate execution plan produced by the planner. */
export interface CandidateExecutionPlan {
  id: string;
  name: string;
  /** Which deterministic strategy family produced these steps. */
  strategy: PlanRouteType;
  description: string;
  /** Ordered deterministic blockchain operations. */
  steps: PlanStep[];
  totalEstimatedGas: number;
  totalEstimatedDuration: number;
  transactionCount: number;
  riskScore: number;
  totalScore: number;
  isRecommended: boolean;
  /** Human-readable deterministic reasons for selection/ranking. */
  reasoning: string[];
}

/** Treasury asset summary fed to the planner (subset of useTreasury). */
export interface PlannerTreasuryAsset {
  symbol: string;
  balance: string;
  usdValue: number;
}

/** Treasury context required to plan a payment. */
export interface PlannerTreasuryContext {
  availableAssets: PlannerTreasuryAsset[];
  supportedChains: ChainRef[];
  preferredChain: string;
  totalEstimatedUSDValue: number;
}

/** Validated planner input (POST /api/planner body, after Zod). */
export interface PlannerRequest {
  intent: import("../ai/intent-schema").StructuredIntent;
  treasury: PlannerTreasuryContext;
  businessId?: string;
  model?: string;
  forceFallback?: boolean;
}

/** Result of the planning pass returned to callers / the API. */
export interface PlannerResult {
  plans: CandidateExecutionPlan[];
  /** "llm" = strategies proposed by the LLM, "deterministic" = pure code. */
  source: "llm" | "deterministic";
  recommendedPlanId: string | null;
  fxRate: number;
  settlementAsset: string;
  settlementAmount: number;
}

export type PlannerErrorCode =
  | "EMPTY_INTENT"
  | "INCOMPLETE_INTENT"
  | "INVALID_TREASURY"
  | "NO_PLANS"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED";

/** Typed error thrown by the planner service. */
export class PlannerError extends Error {
  constructor(
    public readonly code: PlannerErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "PlannerError";
  }
}
