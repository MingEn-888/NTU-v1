// =============================================================================
// PayMaster Phase 8 — Risk Evaluation & Transaction Simulation Engine (service)
//
// FLOW:
//   Selected Route + Treasury + Wallet + Recipient  (validated by Zod)
//     -> 7 deterministic risk checks
//     -> deterministic 0-100 risk score + LOW/MEDIUM/HIGH classification
//     -> transaction simulation totals (gas / bridge fee / slippage / total
//        cost / duration / txn count)
//     -> expected result + warnings
//     -> plain-English explanation grounded ONLY in validated data
//     -> explicit human approval gate (NO auto blockchain execution)
//
// Public API:
//   simulate(request)   — full pipeline (validate -> checks -> score ->
//                         simulate -> explain). Deterministic; the optional LLM
//                         only polishes prose, never produces numbers.
// =============================================================================

import { runRiskChecks } from "./checks";
import { bridgeFeeFor, normalizeChainName, SLIPPAGE_BPS_DEFAULT } from "./catalog";
import { generateExplanation } from "./explain";
import { buildWarnings, classifyRisk, computeRiskBreakdown } from "./score";
import { SimulationRequestSchema, SimulationResultSchema } from "./schema";
import type { SimulationRequestInput } from "./schema";
import type {
  ApprovalGate,
  RiskLevel,
  SimulationRequest,
  SimulationResult,
  SimulationStep,
  SimulationTotals,
} from "./types";
import { RiskEngineError } from "./types";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function shortAddr(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function displayRecipient(payment: SimulationRequest["payment"]): string {
  if (payment.recipient) return payment.recipient;
  if (payment.recipientAddress) return shortAddr(payment.recipientAddress);
  return "recipient";
}

/** Deterministic simulation id from the request (stable across identical inputs). */
export function simulationIdOf(req: SimulationRequest): string {
  const key = JSON.stringify({
    p: req.payment,
    r: req.route,
    s: req.steps,
  });
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return `sim-${Math.abs(hash).toString(36).padStart(6, "0")}`;
}

// -----------------------------------------------------------------------------
// Simulation totals
// -----------------------------------------------------------------------------

export function computeTotals(req: SimulationRequest): SimulationTotals {
  const gasUsd = req.route.estimatedGas;

  // Bridge fee: sum BRIDGE step fees (deterministic per chain).
  let bridgeFee = 0;
  for (const step of req.steps) {
    if (step.actionType === "BRIDGE") {
      bridgeFee += bridgeFeeFor(step.chain ?? req.route.chainSequence[0]);
    }
  }

  // Slippage cost only applies when the route performs a swap.
  const hasSwap = req.steps.some((s) => s.actionType === "SWAP");
  const bps = req.slippageBps ?? (hasSwap ? SLIPPAGE_BPS_DEFAULT : 0);
  const slippageUsd = hasSwap ? round2((req.payment.amount * bps) / 10000) : 0;

  return {
    estimatedGasUsd: round2(gasUsd),
    estimatedBridgeFeeUsd: round2(bridgeFee),
    estimatedSlippageUsd: slippageUsd,
    estimatedTotalCostUsd: round2(gasUsd + bridgeFee + slippageUsd),
    estimatedDuration: Math.round(req.route.estimatedDuration),
    transactionCount: req.route.transactionCount,
  };
}

// -----------------------------------------------------------------------------
// Expected result (plain-English, deterministic)
// -----------------------------------------------------------------------------

export function buildExpectedResult(req: SimulationRequest, totals: SimulationTotals): string {
  const payment = req.payment;
  const route = req.route;
  const chain = (route.chainSequence || []).join(" → ") || "the settlement chain";

  const costBits: string[] = [`gas ${fmtUsd(totals.estimatedGasUsd)}`];
  if (totals.estimatedBridgeFeeUsd > 0) costBits.push(`bridge fee ${fmtUsd(totals.estimatedBridgeFeeUsd)}`);
  if (totals.estimatedSlippageUsd > 0) costBits.push(`slippage ${fmtUsd(totals.estimatedSlippageUsd)}`);

  return (
    `${fmtAmt(payment.amount)} ${payment.token} will be delivered to ${displayRecipient(payment)} after ` +
    `${totals.transactionCount} on-chain transaction${totals.transactionCount === 1 ? "" : "s"} on ${chain} ` +
    `(~${fmtDuration(totals.estimatedDuration)}). Estimated total cost ${fmtUsd(
      totals.estimatedTotalCostUsd
    )} (${costBits.join(" + ")}).`
  );
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtAmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtDuration(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

// -----------------------------------------------------------------------------
// Approval gate — the engine NEVER executes; every payment needs a human sign
// -----------------------------------------------------------------------------

export function buildApprovalGate(level: RiskLevel): ApprovalGate {
  if (level === "HIGH") {
    return {
      required: true,
      status: "PENDING",
      canProceed: true, // HIGH risk is NOT blocked — the human decides.
      note: "HIGH risk — the engine will not auto-execute. Read the warnings and confirm this payout explicitly before signing.",
      highRiskAcknowledged: true,
    };
  }
  return {
    required: true,
    status: "PENDING",
    canProceed: true,
    note:
      level === "MEDIUM"
        ? "MEDIUM risk — review the flagged checks. Nothing is sent until you approve in your wallet."
        : "LOW risk — the payment is cleared for review. Nothing is sent until you approve in your wallet.",
    highRiskAcknowledged: false,
  };
}

// -----------------------------------------------------------------------------
// Public entrypoint
// -----------------------------------------------------------------------------

export async function simulate(input: SimulationRequest): Promise<SimulationResult> {
  // 1. Validate the request up front (Zod).
  const parsed = SimulationRequestSchema.safeParse(input as unknown as SimulationRequestInput);
  if (!parsed.success) {
    throw new RiskEngineError("VALIDATION_FAILED", "Request failed Zod validation.", {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const req = parsed.data as unknown as SimulationRequest;

  // 2. Business rules.
  if (!req.payment || req.payment.amount <= 0) {
    throw new RiskEngineError("EMPTY_PAYMENT", "A payment with a positive amount is required.");
  }
  if (!req.route || !req.route.chainSequence?.length || !req.route.tokenSequence?.length) {
    throw new RiskEngineError("INVALID_ROUTE", "A route with chain and token sequences is required.");
  }

  // 3. Run the 7 deterministic checks.
  const checks = runRiskChecks(req);

  // 4. Deterministic score + classification.
  const { checks: breakdown, total: riskScore } = computeRiskBreakdown(req, checks);
  const riskLevel = classifyRisk(riskScore);

  // 5. Simulation totals + expected result + warnings.
  const totals = computeTotals(req);
  const expectedResult = buildExpectedResult(req, totals);
  const warnings = buildWarnings(checks, riskLevel);

  // 6. Plain-English explanation grounded in validated data.
  const explanation = await generateExplanation(req, {
    payment: req.payment,
    route: req.route,
    steps: req.steps,
    checks,
    riskScore,
    riskLevel,
    riskBreakdown: breakdown,
    totals,
    warnings,
    expectedResult,
    explanation: "",
    explanationSource: "deterministic",
    approval: buildApprovalGate(riskLevel),
    simulationId: simulationIdOf(req),
    source: "risk",
  });

  // 7. Assemble the final result and shape-check it before it can leave.
  const result = SimulationResultSchema.parse({
    simulationId: simulationIdOf(req),
    payment: req.payment,
    route: req.route,
    steps: req.steps as SimulationStep[],
    checks,
    riskScore,
    riskLevel,
    riskBreakdown: breakdown,
    totals,
    warnings,
    expectedResult,
    explanation: explanation.text,
    explanationSource: explanation.source,
    approval: buildApprovalGate(riskLevel),
    source: "risk",
  } as SimulationResult);

  return result;
}
