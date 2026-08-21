// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · Unified Risk Scoring
//
// Builds a transparent 0-100 compliance risk score from deterministic inputs:
//   + Counterparty screening risk   (0-25)
//   + Transaction monitoring risk   (0-20)
//   + Transfer amount exposure      (0-20)
//   + Asset risk                    (0-15)
//   + Policy violations             (0-15)
//   + Travel Rule incompleteness    (0-5)
//
// Classification: 0-29 LOW | 30-59 MEDIUM | 60-79 HIGH | 80-100 CRITICAL
//
// Transparency: the result carries the exact reasons that contributed so the
// UI can explain WHY a transfer scored the way it did.
//
// NOTE: This is a COMPLIANCE risk score, distinct from the Phase 8 execution
// risk engine. Both coexist: Phase 8 evaluates execution mechanics; this score
// evaluates regulatory / treasury compliance.
// =============================================================================

import {
  MAX_AMOUNT_SCORE,
  MAX_ASSET_SCORE,
  MAX_COMPLIANCE_SCORE,
  MAX_COUNTERPARTY_SCORE,
  MAX_MONITORING_SCORE,
  MAX_POLICY_SCORE,
  MAX_TRAVEL_RULE_SCORE,
  assetRiskOf,
  classifyComplianceRisk,
  isAllowedAsset,
} from "./catalog";
import type {
  ComplianceRiskBreakdown,
  ComplianceRiskResult,
  CounterpartyScreening,
  MonitoringResult,
  PolicyEngineResult,
  TravelRuleResult,
} from "./types";

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, n));
}

export interface RiskInput {
  screening: CounterpartyScreening;
  monitoring: MonitoringResult;
  /** Transfer amount in USD. */
  amountUsd: number;
  /** Settlement asset symbol. */
  asset: string;
  policy: PolicyEngineResult;
  travelRule: TravelRuleResult;
}

/** Amount exposure tier points (max 20). */
export function amountPoints(amountUsd: number): number {
  if (!isFinite(amountUsd) || amountUsd <= 0) return 0;
  if (amountUsd > 250_000) return 20;
  if (amountUsd > 100_000) return 16;
  if (amountUsd > 50_000) return 12;
  if (amountUsd > 25_000) return 9;
  if (amountUsd > 10_000) return 6;
  if (amountUsd > 1_000) return 3;
  return 0;
}

/** Asset risk points (max 15) — from the deterministic asset risk table. */
export function assetPoints(asset: string): number {
  const raw = assetRiskOf(asset); // 0-10
  // Scale 0-10 -> 0-15, block exotic/unlisted assets harder.
  const base = (raw / 10) * 15;
  if (!isAllowedAsset(asset)) return 15; // unlisted asset = max asset risk
  return clamp(base, MAX_ASSET_SCORE);
}

/** Policy violation points (max 15): each violated policy adds weight. */
export function policyPoints(policy: PolicyEngineResult): number {
  let points = 0;
  for (const v of policy.violations) {
    if (v.policy.effect === "BLOCK") points += 8;
    else if (v.policy.effect === "REVIEW") points += 5;
    else points += 2;
  }
  return clamp(points, MAX_POLICY_SCORE);
}

/** Travel Rule incompleteness points (max 5). */
export function travelRulePoints(tr: TravelRuleResult): number {
  if (tr.complete) return 0;
  // Every missing field adds weight; incomplete above threshold -> 5.
  return clamp(tr.missingFields.length * 2, MAX_TRAVEL_RULE_SCORE);
}

/**
 * Build the unified compliance risk score + human-readable reasons.
 */
export function assessRisk(input: RiskInput): ComplianceRiskResult {
  const counterparty = clamp(input.screening.riskScore * (MAX_COUNTERPARTY_SCORE / 100), MAX_COUNTERPARTY_SCORE);
  const monitoring = clamp(input.monitoring.riskScore, MAX_MONITORING_SCORE);
  const amount = clamp(amountPoints(input.amountUsd), MAX_AMOUNT_SCORE);
  const asset = clamp(assetPoints(input.asset), MAX_ASSET_SCORE);
  const policy = clamp(policyPoints(input.policy), MAX_POLICY_SCORE);
  const travelRule = clamp(travelRulePoints(input.travelRule), MAX_TRAVEL_RULE_SCORE);

  const total = Math.min(
    MAX_COMPLIANCE_SCORE,
    Math.round(
      (counterparty + monitoring + amount + asset + policy + travelRule) * 10
    ) / 10
  );

  const level = classifyComplianceRisk(total);

  const breakdown: ComplianceRiskBreakdown = {
    counterparty,
    monitoring,
    amount,
    asset,
    policy,
    travelRule,
    total,
  };

  const reasons: string[] = [];
  if (counterparty > 0) reasons.push(`Counterparty risk (${Math.round(counterparty)})`);
  if (monitoring > 0) reasons.push(`Transaction monitoring signals (${Math.round(monitoring)})`);
  if (amount > 0) reasons.push(`Transfer amount exposure (${Math.round(amount)})`);
  if (asset > 0) reasons.push(`Asset risk (${Math.round(asset)})`);
  if (policy > 0) reasons.push(`Policy violations (${Math.round(policy)})`);
  if (travelRule > 0) reasons.push(`Travel Rule information incomplete (${Math.round(travelRule)})`);
  if (reasons.length === 0) reasons.push("No material risk factors identified");

  return { score: total, level, breakdown, reasons };
}
