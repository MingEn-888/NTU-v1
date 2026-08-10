// =============================================================================
// IBAP Phase 8 — Deterministic risk scoring & classification
//
//   RiskScore = CheckPoints  (0-50)   <- 7 checks (PASS=0 / WARN=half / FAIL=full)
//             + RoutePoints  (0-25)   <- bridge/swap/approve structure
//             + AmountPoints (0-25)   <- payout size exposure
//
// Classification:  0-33  LOW  |  34-66  MEDIUM  |  67-100  HIGH
//
// Every function here is pure and deterministic. The engine NEVER blocks a
// HIGH-risk payment — it reports the score and level so the human can make an
// informed decision at the approval gate.
// =============================================================================

import {
  AMOUNT_RISK_TIERS,
  MAX_AMOUNT_SCORE,
  MAX_RISK_SCORE,
  MAX_ROUTE_SCORE,
  RISK_LEVEL_LOW_MAX,
  RISK_LEVEL_MEDIUM_MAX,
  ROUTE_APPROVE_POINTS,
  ROUTE_BASE_POINTS,
  ROUTE_BRIDGE_POINTS,
  ROUTE_MAX_SWAPS,
  ROUTE_SWAP_POINTS,
} from "./catalog";
import type {
  RiskCheckResult,
  RiskContributionBreakdown,
  RiskLevel,
  SimulationRequest,
} from "./types";

// -----------------------------------------------------------------------------
// Route structure points (0-25)
// -----------------------------------------------------------------------------

export function computeRoutePoints(req: SimulationRequest): number {
  const actions = (req.steps || []).map((s) => s.actionType);
  let points = ROUTE_BASE_POINTS;

  const swapCount = actions.filter((a) => a === "SWAP").length;
  points += Math.min(swapCount, ROUTE_MAX_SWAPS) * ROUTE_SWAP_POINTS;

  if (actions.includes("BRIDGE")) points += ROUTE_BRIDGE_POINTS;
  if (actions.includes("APPROVE")) points += ROUTE_APPROVE_POINTS;

  return Math.min(MAX_ROUTE_SCORE, points);
}

// -----------------------------------------------------------------------------
// Payout-size exposure points (0-25)
// -----------------------------------------------------------------------------

export function computeAmountPoints(amount: number): number {
  if (!isFinite(amount) || amount <= 0) return 0;
  for (const tier of AMOUNT_RISK_TIERS) {
    if (amount > tier.aboveUsd) return tier.points;
  }
  return 0;
}

// -----------------------------------------------------------------------------
// Full breakdown + total score
// -----------------------------------------------------------------------------

export interface RiskScoreBreakdown {
  checks: RiskContributionBreakdown;
  routePoints: number;
  amountPoints: number;
  total: number;
}

export function computeRiskBreakdown(
  req: SimulationRequest,
  checks: RiskCheckResult[]
): RiskScoreBreakdown {
  const byId = new Map(checks.map((c) => [c.id, c]));
  const get = (id: RiskCheckResult["id"]) => byId.get(id)?.score ?? 0;

  const checksBreakdown: RiskContributionBreakdown = {
    balance: get("balance"),
    gas: get("gas"),
    recipient: get("recipient"),
    network: get("network"),
    slippage: get("slippage"),
    route: get("route"),
    complexity: get("complexity"),
    amount: 0, // filled below
    total: 0,
  };

  const routePoints = computeRoutePoints(req);
  const amountPoints = computeAmountPoints(req.payment.amount);

  const raw =
    checksBreakdown.balance +
    checksBreakdown.gas +
    checksBreakdown.recipient +
    checksBreakdown.network +
    checksBreakdown.slippage +
    checksBreakdown.complexity +
    routePoints +
    amountPoints;

  const total = Math.min(MAX_RISK_SCORE, Math.round(raw * 10) / 10);
  checksBreakdown.amount = Math.min(MAX_AMOUNT_SCORE, amountPoints);
  checksBreakdown.total = total;

  return { checks: checksBreakdown, routePoints, amountPoints, total };
}

// -----------------------------------------------------------------------------
// Classification
// -----------------------------------------------------------------------------

export function classifyRisk(score: number): RiskLevel {
  if (!isFinite(score) || score <= RISK_LEVEL_LOW_MAX) return "LOW";
  if (score <= RISK_LEVEL_MEDIUM_MAX) return "MEDIUM";
  return "HIGH";
}

// -----------------------------------------------------------------------------
// Warnings aggregation
// -----------------------------------------------------------------------------

export function buildWarnings(checks: RiskCheckResult[], level: RiskLevel): string[] {
  const warnings: string[] = [];

  for (const c of checks) {
    if (c.status === "FAIL") {
      warnings.push(`${c.label}: ${c.message}`);
    } else if (c.status === "WARN") {
      warnings.push(`${c.label}: ${c.message}`);
    }
  }

  if (level === "HIGH") {
    warnings.push(
      "HIGH risk — the engine will NOT auto-execute. Explicit human approval with acknowledgement is required."
    );
  } else if (level === "MEDIUM") {
    warnings.push("MEDIUM risk — review the flagged checks carefully before approving.");
  }

  return warnings;
}
