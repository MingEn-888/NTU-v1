// =============================================================================
// IBAP Phase 8 — Adapters: build a SimulationRequest from upstream plans
//
// The risk engine takes a normalized SimulationRequest. These adapters convert
// the Phase 4 (PaymentPlan) and Phase 6 (CandidateExecutionPlan) representations
// into that normalized shape so the same deterministic engine evaluates every
// route that reaches the approval gate.
// =============================================================================

import type {
  CandidateExecutionPlan,
  PlannerTreasuryContext,
} from "../planner/types";
import type { ParsedPaymentIntent, PaymentPlan } from "../payment/types";
import type {
  SimulationAlternative,
  SimulationRequest,
  SimulationStep,
  SimulationTreasury,
} from "./types";
import { SLIPPAGE_BPS_DEFAULT } from "./catalog";

// -----------------------------------------------------------------------------
// Action-type normalization (Phase 4 plan vocabulary -> canonical risk set)
// -----------------------------------------------------------------------------

const ACTION_TYPE_MAP: Record<string, string> = {
  CHECK_ALLOWANCE: "CHECK_ALLOWANCE",
  APPROVE: "APPROVE",
  SWAP: "SWAP",
  BRIDGE: "BRIDGE",
  TRANSFER: "TRANSFER",
  CONFIRM: "CONFIRM",
  // Phase 4 planGenerator vocabulary:
  EXECUTE_PAYMENT: "TRANSFER",
  CONFIRM_SETTLEMENT: "CONFIRM",
};

/** Map any upstream action type onto the canonical risk-engine set. */
export function normalizeActionType(action: string): string {
  const upper = (action || "").toUpperCase();
  return ACTION_TYPE_MAP[upper] ?? "TRANSFER";
}

// -----------------------------------------------------------------------------
// Treasury context -> SimulationTreasury
// -----------------------------------------------------------------------------

export interface SimulationTreasuryLike {
  availableAssets?: { symbol: string; balance?: string; usdValue?: number }[];
  supportedChains?: { name: string }[] | string[];
  preferredChain?: string | null;
  nativeGasBalance?: string;
  totalEstimatedUSDValue?: number;
}

export function toSimulationTreasury(t?: SimulationTreasuryLike | null): SimulationTreasury {
  const chains = Array.isArray(t?.supportedChains)
    ? (t.supportedChains as (string | { name: string })[]).map((c) =>
        typeof c === "string" ? c : (c as { name: string }).name || ""
      )
    : [];
  return {
    availableAssets: (t?.availableAssets || []).map((a) => ({
      symbol: a.symbol,
      balance: a.balance ?? "0",
      usdValue: a.usdValue ?? 0,
    })),
    supportedChains: chains.filter(Boolean),
    preferredChain: t?.preferredChain ?? null,
    nativeGasBalance: t?.nativeGasBalance,
    totalEstimatedUSDValue: t?.totalEstimatedUSDValue,
  };
}

// -----------------------------------------------------------------------------
// Phase 4 adapter — PaymentPlan (chat flow)
// -----------------------------------------------------------------------------

export function simulationRequestFromPlan(
  intent: ParsedPaymentIntent,
  plan: PaymentPlan,
  treasury?: SimulationTreasuryLike | null
): SimulationRequest {
  const recommended = plan.routes.find((r) => r.isRecommended) ?? plan.routes[0];
  const hasSwap = plan.steps.some((s) => s.actionType === "SWAP" || s.actionType.includes("SWAP"));

  const steps: SimulationStep[] = plan.steps.map((s) => ({
    order: s.stepOrder,
    actionType: normalizeActionType(s.actionType),
    title: s.title,
    chain: recommended?.chain ?? null,
    token: plan.settlementAsset,
  }));

  const alternatives: SimulationAlternative[] = plan.routes
    .filter((r) => r.id !== recommended?.id)
    .map((r) => ({
      routeId: r.id,
      name: r.routeName,
      chainSequence: [r.chain],
      estimatedGas: r.estimatedGas,
      estimatedDuration: r.estimatedTime,
      transactionCount: r.transactionCount,
    }));

  return {
    payment: {
      recipient: intent.recipientName || intent.recipientAddress,
      recipientAddress: intent.recipientAddress,
      token: plan.settlementAsset,
      amount: plan.settlementAmount,
    },
    route: {
      routeId: recommended?.id || "recommended",
      name: recommended?.routeName || "Recommended route",
      chainSequence: recommended ? [recommended.chain] : [],
      tokenSequence: [plan.settlementAsset],
      transactionCount: recommended?.transactionCount ?? 1,
      estimatedGas: recommended?.estimatedGas ?? plan.totalEstimatedGas,
      estimatedDuration: recommended?.estimatedTime ?? plan.estimatedDuration,
      strategy: null,
    },
    steps,
    treasury: toSimulationTreasury(treasury),
    slippageBps: hasSwap ? SLIPPAGE_BPS_DEFAULT : 0,
    alternatives,
  };
}

// -----------------------------------------------------------------------------
// Phase 6 adapter — CandidateExecutionPlan[]
// -----------------------------------------------------------------------------

export interface ExecutionPlanPayment {
  recipient: string | null;
  recipientAddress: string | null;
  token: string;
  amount: number;
}

export function simulationRequestFromExecutionPlans(
  plans: CandidateExecutionPlan[],
  payment: ExecutionPlanPayment,
  treasury?: PlannerTreasuryContext | null
): SimulationRequest[] {
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

    const steps: SimulationStep[] = plan.steps.map((s) => ({
      order: s.order,
      actionType: s.actionType,
      title: s.title,
      chain: s.sourceChain?.name ?? s.destinationChain?.name ?? chainSequence[0],
      token: s.tok,
      estimatedGas: s.estimatedGas,
      estimatedDuration: s.estimatedDuration,
    }));

    const hasSwap = plan.steps.some((s) => s.actionType === "SWAP");

    return {
      payment: {
        recipient: payment.recipient,
        recipientAddress: payment.recipientAddress,
        token: payment.token,
        amount: payment.amount,
      },
      route: {
        routeId: plan.id,
        name: plan.name,
        chainSequence,
        tokenSequence,
        transactionCount: plan.transactionCount,
        estimatedGas: plan.totalEstimatedGas,
        estimatedDuration: plan.totalEstimatedDuration,
        strategy: plan.strategy,
      },
      steps,
      treasury: treasury
        ? {
            availableAssets: (treasury.availableAssets || []).map((a) => ({
              symbol: a.symbol,
              balance: a.balance,
              usdValue: a.usdValue,
            })),
            supportedChains: (treasury.supportedChains || []).map((c) => c.name),
            preferredChain: treasury.preferredChain,
            totalEstimatedUSDValue: treasury.totalEstimatedUSDValue,
          }
        : { availableAssets: [], supportedChains: [] },
      slippageBps: hasSwap ? SLIPPAGE_BPS_DEFAULT : 0,
      alternatives: plans
        .filter((p) => p.id !== plan.id)
        .map((p) => ({
          routeId: p.id,
          name: p.name,
          chainSequence: [p.name],
          estimatedGas: p.totalEstimatedGas,
          estimatedDuration: p.totalEstimatedDuration,
          transactionCount: p.transactionCount,
        })),
    };
  });
}
