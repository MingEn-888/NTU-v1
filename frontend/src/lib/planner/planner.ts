// =============================================================================
// IBAP Phase 6 — Transaction Planner Engine (service)
//
// FLOW:  Validated Intent  ->  Treasury Context  ->  Payment Plan Generator
//        ->  Candidate Execution Plans
//
// The LLM (optional) only proposes HIGH-LEVEL strategies (which route families
// to consider). Every blockchain step is then built by the deterministic
// builders below using the catalog in catalog.ts. Free-form LLM output can
// NEVER become a blockchain transaction.
//
// No OPENAI_API_KEY / LLM failure / invalid strategy  ->  graceful fallback to
// the fully deterministic candidate generator (source: "deterministic").
// =============================================================================

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import {
  chainById,
  durationFor,
  gasFor,
  isNativeAsset,
  pickCheaperChain,
  resolveChainId,
  riskForAction,
  riskForChain,
} from "./catalog";
import { RawStrategySchema, PlannerResultSchema } from "./schema";
import type { RawStrategy } from "./schema";
import type {
  CandidateExecutionPlan,
  ChainRef,
  PlanActionType,
  PlanRouteType,
  PlanStep,
  PlannerRequest,
  PlannerResult,
  PlannerTreasuryContext,
} from "./types";
import { PlannerError } from "./types";
import { CURRENCY_CONFIG } from "../payment/intentParser";
import type { StructuredIntent } from "../ai/intent-schema";

// Re-exported for schema.ts / callers (single source of truth in types.ts).
export { PLAN_ACTION_TYPES, PLAN_ROUTE_TYPES, PLAN_STEP_STATUSES } from "./types";

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtAmount(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function displayRecipient(intent: StructuredIntent): string {
  if (intent.recipient) return intent.recipient;
  if (intent.recipientAddress) {
    const a = intent.recipientAddress;
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
  }
  return "recipient";
}

// -----------------------------------------------------------------------------
// Settlement computation (FX + asset)
// -----------------------------------------------------------------------------

export interface Settlement {
  settlementAsset: string;
  settlementAmount: number;
  fxRate: number;
}

export function computeSettlement(intent: StructuredIntent): Settlement {
  const currency = intent.currency?.toUpperCase() ?? "";
  const cfg = CURRENCY_CONFIG[currency];
  const fxRate = cfg?.fxRate ?? 1;
  const settlementAsset = cfg?.requestedCurrency ?? (currency || "USDC");
  let amount = intent.amount;
  // swap intent without an explicit payment amount -> approximate with the swap input
  if ((amount === null || amount === undefined) && typeof intent.sourceAmount === "number") {
    amount = intent.sourceAmount;
  }
  return {
    settlementAsset,
    settlementAmount: round2((amount ?? 0) / fxRate),
    fxRate,
  };
}

// -----------------------------------------------------------------------------
// Funding asset selection (what the treasury spends to fund the payment)
// -----------------------------------------------------------------------------

export function pickFundingAsset(
  intent: StructuredIntent,
  treasury: PlannerTreasuryContext,
  settlementAsset: string
): string | null {
  if (intent.action === "swap_and_payment") {
    return intent.sourceCurrency?.toUpperCase() || null;
  }
  const settle = (settlementAsset || "USDC").toUpperCase();
  const assets = (treasury.availableAssets || [])
    .map((a) => (a.symbol || "").toUpperCase())
    .filter(Boolean);
  if (!assets.length) return null;
  const preferredChainId = resolveChainId(treasury.preferredChain) ?? 137;
  const native = chainById(preferredChainId)?.symbol.toUpperCase();
  if (native && native !== settle && assets.includes(native)) return native;
  return assets.find((a) => a !== settle) ?? null;
}

// -----------------------------------------------------------------------------
// Step factory
// -----------------------------------------------------------------------------

interface StepOpts {
  planId: string;
  order: number;
  actionType: PlanActionType;
  title: string;
  description: string;
  sourceChain: ChainRef | null;
  destinationChain?: ChainRef | null;
  tok: string;
  estimatedGas: number;
  estimatedDuration: number;
  deps: number[];
}

function mkStep(o: StepOpts): PlanStep {
  return {
    id: `${o.planId}-s${o.order}-${o.actionType.toLowerCase()}`,
    order: o.order,
    actionType: o.actionType,
    title: o.title,
    description: o.description,
    sourceChain: o.sourceChain,
    destinationChain: o.destinationChain ?? null,
    tok: o.tok,
    estimatedGas: round2(o.estimatedGas),
    estimatedDuration: Math.round(o.estimatedDuration),
    deps: o.deps,
    status: "PENDING",
  };
}

// -----------------------------------------------------------------------------
// Deterministic step builders (one per strategy family)
// -----------------------------------------------------------------------------

function buildDirectPaySteps(
  planId: string,
  intent: StructuredIntent,
  settlement: Settlement,
  chain: ChainRef
): PlanStep[] {
  const asset = settlement.settlementAsset;
  const amt = fmtAmount(settlement.settlementAmount);
  const recipient = displayRecipient(intent);
  const steps: PlanStep[] = [];
  let order = 0;

  if (!isNativeAsset(asset)) {
    steps.push(
      mkStep({
        planId,
        order: ++order,
        actionType: "CHECK_ALLOWANCE",
        title: "Verify treasury allowance",
        description: `Confirm the treasury vault has granted the payment router ${amt} ${asset} allowance on ${chain.name}.`,
        sourceChain: chain,
        tok: asset,
        estimatedGas: 0,
        estimatedDuration: 2,
        deps: [],
      })
    );
  }

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "TRANSFER",
      title: `Transfer ${amt} ${asset} to ${recipient}`,
      description: `Send ${amt} ${asset} from the treasury vault on ${chain.name} to ${recipient} in a single transaction.`,
      sourceChain: chain,
      tok: asset,
      estimatedGas: gasFor(chain.chainId, "transfer"),
      estimatedDuration: durationFor(chain.chainId, "transfer"),
      deps: steps.length ? [steps[steps.length - 1].order] : [],
    })
  );

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "CONFIRM",
      title: "Confirm on-chain settlement",
      description: `Await ${chain.name} block confirmation and reconcile the treasury ledger.`,
      sourceChain: chain,
      tok: asset,
      estimatedGas: gasFor(chain.chainId, "confirm"),
      estimatedDuration: durationFor(chain.chainId, "confirm"),
      deps: [steps[steps.length - 1].order],
    })
  );

  return steps;
}

function buildSwapThenPaySteps(
  planId: string,
  intent: StructuredIntent,
  settlement: Settlement,
  fundingAsset: string,
  chain: ChainRef
): PlanStep[] {
  const funding = fundingAsset.toUpperCase();
  const settle = settlement.settlementAsset.toUpperCase();
  const amt = fmtAmount(settlement.settlementAmount);
  const recipient = displayRecipient(intent);
  const steps: PlanStep[] = [];
  let order = 0;

  if (!isNativeAsset(funding)) {
    steps.push(
      mkStep({
        planId,
        order: ++order,
        actionType: "CHECK_ALLOWANCE",
        title: "Verify swap allowance",
        description: `Confirm the treasury vault allowance of ${funding} for the swap router on ${chain.name}.`,
        sourceChain: chain,
        tok: funding,
        estimatedGas: 0,
        estimatedDuration: 2,
        deps: [],
      })
    );
    steps.push(
      mkStep({
        planId,
        order: ++order,
        actionType: "APPROVE",
        title: `Approve ${funding} spend`,
        description: `Grant the swap router spend allowance for ${funding} on ${chain.name}.`,
        sourceChain: chain,
        tok: funding,
        estimatedGas: gasFor(chain.chainId, "approve"),
        estimatedDuration: durationFor(chain.chainId, "approve"),
        deps: [steps[steps.length - 1].order],
      })
    );
  }

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "SWAP",
      title: `Swap ${funding} → ${settle}`,
      description: `Convert treasury ${funding} to ${settle} on ${chain.name} via an aggregated DEX with a 0.3% slippage budget.`,
      sourceChain: chain,
      tok: funding,
      estimatedGas: gasFor(chain.chainId, "swap"),
      estimatedDuration: durationFor(chain.chainId, "swap"),
      deps: steps.length ? [steps[steps.length - 1].order] : [],
    })
  );

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "TRANSFER",
      title: `Transfer ${amt} ${settle} to ${recipient}`,
      description: `Send ${amt} ${settle} from the treasury vault on ${chain.name} to ${recipient}.`,
      sourceChain: chain,
      tok: settle,
      estimatedGas: gasFor(chain.chainId, "transfer"),
      estimatedDuration: durationFor(chain.chainId, "transfer"),
      deps: [steps[steps.length - 1].order],
    })
  );

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "CONFIRM",
      title: "Confirm on-chain settlement",
      description: `Await ${chain.name} block confirmation and reconcile the treasury ledger.`,
      sourceChain: chain,
      tok: settle,
      estimatedGas: gasFor(chain.chainId, "confirm"),
      estimatedDuration: durationFor(chain.chainId, "confirm"),
      deps: [steps[steps.length - 1].order],
    })
  );

  return steps;
}

function buildBridgeThenPaySteps(
  planId: string,
  intent: StructuredIntent,
  settlement: Settlement,
  from: ChainRef,
  to: ChainRef
): PlanStep[] {
  const asset = settlement.settlementAsset;
  const amt = fmtAmount(settlement.settlementAmount);
  const recipient = displayRecipient(intent);
  const steps: PlanStep[] = [];
  let order = 0;

  if (!isNativeAsset(asset)) {
    steps.push(
      mkStep({
        planId,
        order: ++order,
        actionType: "CHECK_ALLOWANCE",
        title: "Verify bridge allowance",
        description: `Confirm the treasury vault allowance of ${asset} for the bridge on ${from.name}.`,
        sourceChain: from,
        tok: asset,
        estimatedGas: 0,
        estimatedDuration: 2,
        deps: [],
      })
    );
  }

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "BRIDGE",
      title: `Bridge ${asset} ${from.name} → ${to.name}`,
      description: `Move ${amt} ${asset} from ${from.name} to ${to.name} via a canonical bridge.`,
      sourceChain: from,
      destinationChain: to,
      tok: asset,
      estimatedGas: gasFor(from.chainId, "bridgeOut") + gasFor(to.chainId, "bridgeIn"),
      estimatedDuration: durationFor(from.chainId, "bridgeOut") + durationFor(to.chainId, "bridgeIn"),
      deps: steps.length ? [steps[steps.length - 1].order] : [],
    })
  );

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "TRANSFER",
      title: `Transfer ${amt} ${asset} to ${recipient} (${to.name})`,
      description: `Send ${amt} ${asset} from the treasury vault on ${to.name} to ${recipient}.`,
      sourceChain: to,
      tok: asset,
      estimatedGas: gasFor(to.chainId, "transfer"),
      estimatedDuration: durationFor(to.chainId, "transfer"),
      deps: [steps[steps.length - 1].order],
    })
  );

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "CONFIRM",
      title: "Confirm on-chain settlement",
      description: `Await ${to.name} block confirmation and reconcile the treasury ledger.`,
      sourceChain: to,
      tok: asset,
      estimatedGas: gasFor(to.chainId, "confirm"),
      estimatedDuration: durationFor(to.chainId, "confirm"),
      deps: [steps[steps.length - 1].order],
    })
  );

  return steps;
}

function buildBridgeThenSwapPaySteps(
  planId: string,
  intent: StructuredIntent,
  settlement: Settlement,
  fundingAsset: string,
  from: ChainRef,
  to: ChainRef
): PlanStep[] {
  const funding = fundingAsset.toUpperCase();
  const settle = settlement.settlementAsset.toUpperCase();
  const amt = fmtAmount(settlement.settlementAmount);
  const recipient = displayRecipient(intent);
  const steps: PlanStep[] = [];
  let order = 0;

  if (!isNativeAsset(funding)) {
    steps.push(
      mkStep({
        planId,
        order: ++order,
        actionType: "CHECK_ALLOWANCE",
        title: "Verify bridge allowance",
        description: `Confirm the treasury vault allowance of ${funding} for the bridge on ${from.name}.`,
        sourceChain: from,
        tok: funding,
        estimatedGas: 0,
        estimatedDuration: 2,
        deps: [],
      })
    );
    steps.push(
      mkStep({
        planId,
        order: ++order,
        actionType: "APPROVE",
        title: `Approve ${funding} spend`,
        description: `Grant the bridge spend allowance for ${funding} on ${from.name}.`,
        sourceChain: from,
        tok: funding,
        estimatedGas: gasFor(from.chainId, "approve"),
        estimatedDuration: durationFor(from.chainId, "approve"),
        deps: [steps[steps.length - 1].order],
      })
    );
  }

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "BRIDGE",
      title: `Bridge ${funding} ${from.name} → ${to.name}`,
      description: `Move treasury ${funding} from ${from.name} to ${to.name} via a canonical bridge.`,
      sourceChain: from,
      destinationChain: to,
      tok: funding,
      estimatedGas: gasFor(from.chainId, "bridgeOut") + gasFor(to.chainId, "bridgeIn"),
      estimatedDuration: durationFor(from.chainId, "bridgeOut") + durationFor(to.chainId, "bridgeIn"),
      deps: steps.length ? [steps[steps.length - 1].order] : [],
    })
  );

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "SWAP",
      title: `Swap ${funding} → ${settle} (${to.name})`,
      description: `Convert ${funding} to ${settle} on ${to.name} via an aggregated DEX with a 0.3% slippage budget.`,
      sourceChain: to,
      tok: funding,
      estimatedGas: gasFor(to.chainId, "swap"),
      estimatedDuration: durationFor(to.chainId, "swap"),
      deps: [steps[steps.length - 1].order],
    })
  );

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "TRANSFER",
      title: `Transfer ${amt} ${settle} to ${recipient}`,
      description: `Send ${amt} ${settle} from the treasury vault on ${to.name} to ${recipient}.`,
      sourceChain: to,
      tok: settle,
      estimatedGas: gasFor(to.chainId, "transfer"),
      estimatedDuration: durationFor(to.chainId, "transfer"),
      deps: [steps[steps.length - 1].order],
    })
  );

  steps.push(
    mkStep({
      planId,
      order: ++order,
      actionType: "CONFIRM",
      title: "Confirm on-chain settlement",
      description: `Await ${to.name} block confirmation and reconcile the treasury ledger.`,
      sourceChain: to,
      tok: settle,
      estimatedGas: gasFor(to.chainId, "confirm"),
      estimatedDuration: durationFor(to.chainId, "confirm"),
      deps: [steps[steps.length - 1].order],
    })
  );

  return steps;
}

// -----------------------------------------------------------------------------
// Plan assembly + deterministic scoring
// -----------------------------------------------------------------------------

function computeRiskScore(steps: PlanStep[]): number {
  let risk = 0;
  for (const s of steps) {
    risk += riskForAction(s.actionType);
    if (s.sourceChain) risk += riskForChain(s.sourceChain.chainId);
  }
  return Math.min(100, Math.round(risk));
}

function computeTotalScore(gas: number, duration: number, risk: number): number {
  const gasPenalty = Math.min(30, gas * 3);
  const durationPenalty = Math.min(20, duration / 40);
  const riskPenalty = Math.min(25, risk * 0.25);
  return Math.max(0, Math.round(100 - gasPenalty - durationPenalty - riskPenalty));
}

function mkPlan(opts: {
  id: string;
  name: string;
  strategy: PlanRouteType;
  description: string;
  steps: PlanStep[];
  reasoning: string[];
}): CandidateExecutionPlan {
  const totalEstimatedGas = round2(opts.steps.reduce((s, x) => s + x.estimatedGas, 0));
  const totalEstimatedDuration = opts.steps.reduce((s, x) => s + x.estimatedDuration, 0);
  const transactionCount = opts.steps.filter((s) =>
    ["APPROVE", "SWAP", "BRIDGE", "TRANSFER"].includes(s.actionType)
  ).length;
  const riskScore = computeRiskScore(opts.steps);
  const totalScore = computeTotalScore(totalEstimatedGas, totalEstimatedDuration, riskScore);
  return {
    id: opts.id,
    name: opts.name,
    strategy: opts.strategy,
    description: opts.description,
    steps: opts.steps,
    totalEstimatedGas,
    totalEstimatedDuration,
    transactionCount,
    riskScore,
    totalScore,
    isRecommended: false,
    reasoning: opts.reasoning,
  };
}

/** Deterministic ranking: best score, fewest txns, lowest gas. Mutates isRecommended. */
export function rankPlans(plans: CandidateExecutionPlan[]): CandidateExecutionPlan[] {
  plans.sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      a.transactionCount - b.transactionCount ||
      a.totalEstimatedGas - b.totalEstimatedGas ||
      a.id.localeCompare(b.id)
  );
  plans.forEach((p, i) => {
    p.isRecommended = i === 0;
  });
  return plans;
}

// -----------------------------------------------------------------------------
// Deterministic candidate generator (no LLM)
// -----------------------------------------------------------------------------

export function generateCandidates(
  intent: StructuredIntent,
  treasury: PlannerTreasuryContext,
  settlement: Settlement
): CandidateExecutionPlan[] {
  const preferredChainId = resolveChainId(treasury.preferredChain) ?? 137;
  const preferred = chainById(preferredChainId);
  if (!preferred) {
    throw new PlannerError("INVALID_TREASURY", `Unknown preferred chain: ${treasury.preferredChain}`);
  }
  const targetChainId = intent.targetChain ? resolveChainId(intent.targetChain) : null;
  const altChainId = targetChainId ?? pickCheaperChain(preferredChainId);
  const alt = chainById(altChainId);
  const funding = pickFundingAsset(intent, treasury, settlement.settlementAsset);

  const candidates: CandidateExecutionPlan[] = [];
  const settle = settlement.settlementAsset.toUpperCase();

  // Plan A — settle on the preferred chain (direct or swap-then-pay).
  if (funding && funding !== settle) {
    candidates.push(
      mkPlan({
        id: "planA",
        name: `${preferred.name} swap & transfer`,
        strategy: "native_swap",
        description: `Swap treasury ${funding} to ${settle} on ${preferred.name}, then transfer to the recipient.`,
        steps: buildSwapThenPaySteps("planA", intent, settlement, funding, preferred),
        reasoning: [
          `Treasury holds ${funding} but the payment settles in ${settle}; a swap then transfer completes in 2 transactions on ${preferred.name}.`,
        ],
      })
    );
  } else {
    candidates.push(
      mkPlan({
        id: "planA",
        name: `${preferred.name} direct transfer`,
        strategy: "native_direct",
        description: `Pay ${settle} directly to the recipient on ${preferred.name} in a single transaction.`,
        steps: buildDirectPaySteps("planA", intent, settlement, preferred),
        reasoning: [
          `Treasury already holds ${settle}; a single-chain transfer is the simplest, lowest-risk path on ${preferred.name}.`,
        ],
      })
    );
  }

  // Plan B — bridge to the cheaper / requested chain, then pay.
  if (alt && alt.chainId !== preferred.chainId) {
    if (funding && funding !== settle) {
      candidates.push(
        mkPlan({
          id: "planB",
          name: `Bridge to ${alt.name}, swap & transfer`,
          strategy: "bridge_then_swap_pay",
          description: `Bridge ${funding} to ${alt.name}, swap to ${settle}, then transfer to the recipient.`,
          steps: buildBridgeThenSwapPaySteps("planB", intent, settlement, funding, preferred, alt),
          reasoning: [
            `Bridging ${funding} to ${alt.name} then swapping to ${settle} minimises settlement gas fees.`,
          ],
        })
      );
    } else {
      candidates.push(
        mkPlan({
          id: "planB",
          name: `Bridge to ${alt.name} & transfer`,
          strategy: "bridge_then_pay",
          description: `Bridge ${settle} to ${alt.name}, then transfer to the recipient on the cheaper chain.`,
          steps: buildBridgeThenPaySteps("planB", intent, settlement, preferred, alt),
          reasoning: [
            `Settling on ${alt.name} reduces gas cost versus ${preferred.name} for the ${settle} transfer.`,
          ],
        })
      );
    }
  }

  return rankPlans(candidates);
}

// -----------------------------------------------------------------------------
// LLM strategy proposal (optional) + materialisation
// -----------------------------------------------------------------------------

export const PLANNER_SYSTEM_PROMPT = `
You are the IBAP Payment Planner strategist, a component of an Intent-Based
Agentic Payment (IBAP) treasury system.

Your ONLY job is to propose candidate HIGH-LEVEL execution strategies for a
validated payment intent, given the treasury context. You NEVER emit blockchain
transactions, step sequences, token addresses or contract calls — deterministic
code builds those. Free-form output from you can never become a transaction.

CORE RULES (non-negotiable):
1. Propose 2-4 candidate plans. Each plan MUST pick exactly one routeType from
   the fixed set below:
   - "native_direct": pay the settlement asset directly on one chain (1 tx).
   - "native_swap": swap a treasury asset to the settlement asset, then pay.
   - "bridge_then_pay": bridge the settlement asset to a cheaper chain, then pay.
   - "bridge_then_swap_pay": bridge a treasury asset, swap to the settlement
     asset, then pay.
2. "id" must be a short unique slug like "planA", "plan-bridge-polygon".
3. "name" is a short display label; "description" explains the approach in one
   sentence. These are display-only.
4. Choose routeTypes that fit the intent: if the intent already pays in a
   treasury-held asset prefer "native_direct"; if a swap is needed use
   "native_swap"; if a cross-chain delivery is requested or cheaper settlement
   is sensible include a bridge strategy.
5. "reasoning": 1-3 short reasons for the candidate set.
6. Output ONLY the JSON object matching the schema. No commentary, no markdown,
   no code fences.

Input format: { "intent": {...validated fields...}, "treasury": { "availableAssets":
[{symbol, balance, usdValue}], "preferredChain": "...", "totalEstimatedUSDValue": n } }

Example intent: pay 2500 USDC to a vendor, treasury holds ETH on ethereum.
Valid response: {"plans":[{"id":"planA","name":"Ethereum swap & transfer",
"description":"Swap ETH to USDC on Ethereum then transfer to the recipient.",
"routeType":"native_swap"},{"id":"planB","name":"Polygon bridge & settle",
"description":"Bridge ETH to Polygon, swap to USDC, then transfer.",
"routeType":"bridge_then_swap_pay"}],"reasoning":["Treasury holds ETH but the
payment is in USDC","Bridging to Polygon lowers gas cost"]}
`.trim();

/**
 * Ask the LLM which strategy families to consider. Returns validated proposals
 * or null (graceful fallback). Throws PlannerError("RATE_LIMITED") on 429.
 */
async function proposeStrategiesWithLLM(
  intent: StructuredIntent,
  treasury: PlannerTreasuryContext,
  model?: string
): Promise<RawStrategy | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  let completion;
  try {
    completion = await client.chat.completions.parse({
      model: model || process.env.OPENAI_PLANNER_MODEL || "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            intent: {
              action: intent.action,
              recipient: intent.recipient,
              recipientAddress: intent.recipientAddress,
              amount: intent.amount,
              currency: intent.currency,
              sourceCurrency: intent.sourceCurrency,
              sourceAmount: intent.sourceAmount,
              targetChain: intent.targetChain,
              purpose: intent.purpose,
              dueDate: intent.dueDate,
            },
            treasury: {
              availableAssets: treasury.availableAssets,
              preferredChain: treasury.preferredChain,
              totalEstimatedUSDValue: treasury.totalEstimatedUSDValue,
            },
          }),
        },
      ],
      response_format: zodResponseFormat(RawStrategySchema, "execution_strategies"),
    });
  } catch (err) {
    if ((err as { status?: number })?.status === 429) {
      throw new PlannerError("RATE_LIMITED", "OpenAI rate limit reached during planning — please retry shortly.", {
        status: 429,
      });
    }
    console.error("[IBAP-planner] OpenAI strategy proposal failed, using deterministic candidates:", err);
    return null;
  }

  const message = completion.choices[0]?.message;
  if (message?.refusal || !message?.parsed) return null;
  const parsed = RawStrategySchema.safeParse(message.parsed);
  return parsed.success ? parsed.data : null;
}

/** Map validated LLM proposals to deterministic plans (guard rails included). */
export function materializePlans(
  intent: StructuredIntent,
  treasury: PlannerTreasuryContext,
  settlement: Settlement,
  proposals: RawStrategy
): CandidateExecutionPlan[] {
  const preferredChainId = resolveChainId(treasury.preferredChain) ?? 137;
  const preferred = chainById(preferredChainId);
  if (!preferred) return generateCandidates(intent, treasury, settlement);
  const targetChainId = intent.targetChain ? resolveChainId(intent.targetChain) : null;
  const altChainId = targetChainId ?? pickCheaperChain(preferredChainId);
  const alt = chainById(altChainId);
  const funding = pickFundingAsset(intent, treasury, settlement.settlementAsset);
  const settle = settlement.settlementAsset.toUpperCase();

  const seen = new Set<string>();
  const plans: CandidateExecutionPlan[] = [];
  for (const p of proposals.plans) {
    const key = `${p.routeType}:${preferred.chainId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const plan = buildPlanFromProposal(p, intent, settlement, funding, settle, preferred, alt);
    if (plan) plans.push(plan);
  }

  return plans.length ? rankPlans(plans) : generateCandidates(intent, treasury, settlement);
}

function buildPlanFromProposal(
  p: RawStrategy["plans"][number],
  intent: StructuredIntent,
  settlement: Settlement,
  funding: string | null,
  settle: string,
  preferred: ChainRef,
  alt: ChainRef | null
): CandidateExecutionPlan | null {
  const hasAlt = !!alt && alt.chainId !== preferred.chainId;
  const baseReasoning = [
    `Strategy "${p.name}" proposed by the planner and materialised deterministically.`,
    ...proposalReasoning(p.description),
  ];
  let steps: PlanStep[] | null = null;
  let strategy: PlanRouteType = p.routeType;

  switch (p.routeType) {
    case "native_direct":
      steps = buildDirectPaySteps(p.id, intent, settlement, preferred);
      break;
    case "native_swap":
      if (funding && funding !== settle) {
        steps = buildSwapThenPaySteps(p.id, intent, settlement, funding, preferred);
      } else {
        strategy = "native_direct";
        steps = buildDirectPaySteps(p.id, intent, settlement, preferred);
      }
      break;
    case "bridge_then_pay":
      if (hasAlt) steps = buildBridgeThenPaySteps(p.id, intent, settlement, preferred, alt!);
      break;
    case "bridge_then_swap_pay":
      if (hasAlt && funding && funding !== settle) {
        steps = buildBridgeThenSwapPaySteps(p.id, intent, settlement, funding, preferred, alt!);
      } else if (hasAlt) {
        strategy = "bridge_then_pay";
        steps = buildBridgeThenPaySteps(p.id, intent, settlement, preferred, alt!);
      }
      break;
  }

  if (!steps) return null;
  return mkPlan({
    id: p.id,
    name: p.name,
    strategy,
    description: p.description,
    steps,
    reasoning: baseReasoning,
  });
}

function proposalReasoning(description: string): string[] {
  const d = description.trim();
  return d ? [`${d.charAt(0).toUpperCase()}${d.slice(1)}`] : [];
}

// -----------------------------------------------------------------------------
// Public entrypoint
// -----------------------------------------------------------------------------

export async function generateExecutionPlans(input: PlannerRequest): Promise<PlannerResult> {
  const { intent, treasury } = input;
  if (!intent) {
    throw new PlannerError("EMPTY_INTENT", "A validated intent is required to plan a payment.");
  }
  if (!treasury || !Array.isArray(treasury.availableAssets)) {
    throw new PlannerError("INVALID_TREASURY", "Treasury context is required to plan a payment.");
  }

  // Completeness gate — only a validated, complete intent can be planned.
  const issues: string[] = [];
  if (!intent.recipientAddress) issues.push("recipient wallet address");
  if (intent.action === "swap_and_payment") {
    if (!intent.sourceCurrency) issues.push("asset to swap from");
    if (intent.sourceAmount === null && intent.amount === null) issues.push("swap amount");
    if (!intent.currency) issues.push("payment currency");
  } else {
    if (intent.amount === null || intent.amount === undefined) issues.push("payment amount");
    if (!intent.currency) issues.push("currency");
  }
  if (intent.action === "bridge_and_payment" && !intent.targetChain) issues.push("target chain");
  if (issues.length) {
    throw new PlannerError(
      "INCOMPLETE_INTENT",
      `Intent is not ready for planning; missing: ${issues.join(", ")}`,
      { issues }
    );
  }

  const settlement = computeSettlement(intent);
  if (settlement.settlementAmount <= 0) {
    throw new PlannerError("INVALID_TREASURY", "Settlement amount must be positive.", {
      settlement,
    });
  }

  // Optional LLM strategy proposal; deterministic fallback otherwise.
  let proposals: RawStrategy | null = null;
  if (!input.forceFallback) {
    try {
      proposals = await proposeStrategiesWithLLM(intent, treasury, input.model);
    } catch (err) {
      if (err instanceof PlannerError && err.code === "RATE_LIMITED") throw err;
      proposals = null;
    }
  }

  const plans = proposals
    ? materializePlans(intent, treasury, settlement, proposals)
    : generateCandidates(intent, treasury, settlement);

  if (!plans.length) {
    throw new PlannerError("NO_PLANS", "No viable execution plan could be generated for this intent.", {});
  }

  const recommended = plans.find((p) => p.isRecommended) ?? plans[0];
  const source = proposals ? "llm" : "deterministic";

  // Final shape guarantee — this throws if any step deviates from the model.
  const result = PlannerResultSchema.parse({
    plans,
    source,
    recommendedPlanId: recommended.id,
    fxRate: settlement.fxRate,
    settlementAsset: settlement.settlementAsset,
    settlementAmount: settlement.settlementAmount,
  });
  return result;
}
