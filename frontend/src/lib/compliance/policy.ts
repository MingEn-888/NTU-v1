// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · Policy Engine
//
// The policy engine is the DETERMINISTIC decision-maker of the compliance
// layer. It evaluates a transfer against every configured treasury/compliance
// rule and returns exactly one final decision:
//
//   ALLOW  -> compliant, may proceed to the human approval gate + execution
//   REVIEW -> policy violation that requires human review/approval
//   BLOCK  -> policy violation that PREVENTS execution
//
// The LLM can never override this decision. Policies are configurable in
// catalog.ts (hard-coded defaults) and evaluated in a fixed order.
//
// Aggregation: BLOCK > REVIEW > ALLOW.
// =============================================================================

import {
  BLOCKLIST,
  POLICIES,
  POLICY_LIMITS,
  SUPPORTED_NETWORKS,
  aggregatePolicyDecision,
  isAllowedAsset,
  isStablecoin,
} from "./catalog";
import type {
  ComplianceDecision,
  CounterpartyScreening,
  PolicyEngineResult,
  PolicyResult,
  TravelRuleResult,
} from "./types";

// ---------------------------------------------------------------------------
// Policy evaluation inputs
// ---------------------------------------------------------------------------

export interface PolicyInput {
  /** Transfer amount in USD. */
  amountUsd: number;
  /** Settlement asset symbol (e.g. USDC / ETH / XYZ). */
  asset: string;
  /** Chain/network the transfer is routed on. */
  network: string;
  /** Counterparty screening result. */
  screening: CounterpartyScreening;
  /** Travel Rule workflow result. */
  travelRule: TravelRuleResult;
  /** Outstanding exposure to this counterparty in USD (simulated). */
  counterpartyExposureUsd: number;
  /** Today's total transfer volume for this customer in USD (simulated). */
  dailyVolumeUsd: number;
  /** Treasury asset allocation percentages (symbol -> % of treasury). */
  allocation: Record<string, number>;
  /** Stablecoin share of the treasury (0-1). */
  stablecoinShare: number;
}

function buildResult(
  policy: (typeof POLICIES)[number],
  passed: boolean,
  reason: string
): PolicyResult {
  return { policy, passed, reason };
}

/**
 * Evaluate the transfer against ALL enabled policies. Returns the aggregated
 * final decision (BLOCK > REVIEW > ALLOW) plus every individual result for
 * full transparency.
 */
export function evaluatePolicies(input: PolicyInput): PolicyEngineResult {
  const results: PolicyResult[] = [];
  const effects: ("ALLOW" | "REVIEW" | "BLOCK")[] = [];

  for (const p of POLICIES) {
    if (!p.enabled) continue;

    // --- limits: max_single_txn ------------------------------------------
    if (p.id === "max_single_txn") {
      const ok = input.amountUsd <= POLICY_LIMITS.maxSingleTxnUsd;
      results.push(
        buildResult(
          p,
          ok,
          ok
            ? `$${input.amountUsd.toLocaleString()} within the $${POLICY_LIMITS.maxSingleTxnUsd.toLocaleString()} ceiling`
            : `$${input.amountUsd.toLocaleString()} exceeds the $${POLICY_LIMITS.maxSingleTxnUsd.toLocaleString()} single-transaction ceiling`
        )
      );
      effects.push(ok ? "ALLOW" : p.effect);
    }

    // --- limits: max_daily_txn -------------------------------------------
    if (p.id === "max_daily_txn") {
      const ok = input.dailyVolumeUsd + input.amountUsd <= POLICY_LIMITS.maxDailyTxnUsd;
      results.push(
        buildResult(
          p,
          ok,
          ok
            ? `Daily volume $${(input.dailyVolumeUsd + input.amountUsd).toLocaleString()} within the $${POLICY_LIMITS.maxDailyTxnUsd.toLocaleString()} ceiling`
            : `Daily volume $${(input.dailyVolumeUsd + input.amountUsd).toLocaleString()} exceeds the $${POLICY_LIMITS.maxDailyTxnUsd.toLocaleString()} ceiling`
        )
      );
      effects.push(ok ? "ALLOW" : p.effect);
    }

    // --- assets: allowed_assets ------------------------------------------
    if (p.id === "allowed_assets") {
      const ok = isAllowedAsset(input.asset);
      results.push(
        buildResult(
          p,
          ok,
          ok
            ? `${input.asset.toUpperCase()} is an allowed DPT asset`
            : `${input.asset.toUpperCase()} is NOT an allowed DPT asset`
        )
      );
      effects.push(ok ? "ALLOW" : "BLOCK");
    }

    // --- networks: allowed_networks --------------------------------------
    if (p.id === "allowed_networks") {
      const ok = SUPPORTED_NETWORKS.includes(input.network.toLowerCase());
      results.push(
        buildResult(
          p,
          ok,
          ok
            ? `${input.network} is a supported network`
            : `${input.network} is not a supported network`
        )
      );
      effects.push(ok ? "ALLOW" : p.effect);
    }

    // --- exposure: max_counterparty_exposure -----------------------------
    if (p.id === "max_counterparty_exposure") {
      const ok = input.counterpartyExposureUsd + input.amountUsd <= POLICY_LIMITS.maxCounterpartyExposureUsd;
      results.push(
        buildResult(
          p,
          ok,
          ok
            ? `Counterparty exposure $${(input.counterpartyExposureUsd + input.amountUsd).toLocaleString()} within the $${POLICY_LIMITS.maxCounterpartyExposureUsd.toLocaleString()} ceiling`
            : `Counterparty exposure $${(input.counterpartyExposureUsd + input.amountUsd).toLocaleString()} exceeds the $${POLICY_LIMITS.maxCounterpartyExposureUsd.toLocaleString()} ceiling`
        )
      );
      effects.push(ok ? "ALLOW" : p.effect);
    }

    // --- exposure: max_asset_concentration -------------------------------
    if (p.id === "max_asset_concentration") {
      // Concentration limits apply to NON-stablecoin assets only — stablecoins
      // are the treasury reserve and may exceed the concentration ceiling.
      const isStable = isStablecoin(input.asset);
      const pct = input.allocation[input.asset.toUpperCase()] ?? 0;
      const ok = isStable || pct <= POLICY_LIMITS.maxAssetConcentrationPct;
      results.push(
        buildResult(
          p,
          ok,
          isStable
            ? `${input.asset.toUpperCase()} is a stablecoin reserve asset (concentration exempt)`
            : ok
            ? `${input.asset.toUpperCase()} allocation ${(pct * 100).toFixed(0)}% within the ${(POLICY_LIMITS.maxAssetConcentrationPct * 100).toFixed(0)}% ceiling`
            : `${input.asset.toUpperCase()} allocation ${(pct * 100).toFixed(0)}% exceeds the ${(POLICY_LIMITS.maxAssetConcentrationPct * 100).toFixed(0)}% ceiling`
        )
      );
      effects.push(ok ? "ALLOW" : p.effect);
    }

    // --- reserves: min_stablecoin_reserve --------------------------------
    if (p.id === "min_stablecoin_reserve") {
      const ok = input.stablecoinShare >= POLICY_LIMITS.minStablecoinReservePct;
      results.push(
        buildResult(
          p,
          ok,
          ok
            ? `Stablecoin reserve ${(input.stablecoinShare * 100).toFixed(0)}% above the ${(POLICY_LIMITS.minStablecoinReservePct * 100).toFixed(0)}% minimum`
            : `Stablecoin reserve ${(input.stablecoinShare * 100).toFixed(0)}% below the ${(POLICY_LIMITS.minStablecoinReservePct * 100).toFixed(0)}% minimum`
        )
      );
      effects.push(ok ? "ALLOW" : p.effect);
    }

    // --- counterparty: high_risk_counterparty ----------------------------
    if (p.id === "high_risk_counterparty") {
      const score = input.screening.riskScore;
      const ok = score < POLICY_LIMITS.highRiskCounterpartyReview;
      const blocked = score >= POLICY_LIMITS.highRiskCounterpartyBlock;
      results.push(
        buildResult(
          p,
          ok,
          blocked
            ? `Counterparty risk ${score}/100 exceeds the ${POLICY_LIMITS.highRiskCounterpartyBlock} block threshold`
            : ok
            ? `Counterparty risk ${score}/100 below the review threshold`
            : `Counterparty risk ${score}/100 exceeds the ${POLICY_LIMITS.highRiskCounterpartyReview} review threshold`
        )
      );
      effects.push(blocked ? "BLOCK" : ok ? "ALLOW" : p.effect);
    }

    // --- travel_rule: travel_rule_required -------------------------------
    if (p.id === "travel_rule_required") {
      if (input.amountUsd > POLICY_LIMITS.travelRuleBlockThresholdUsd && !input.travelRule.complete) {
        results.push(
          buildResult(
            p,
            false,
            `Travel Rule info incomplete for a $${input.amountUsd.toLocaleString()} transfer — BLOCKED`
          )
        );
        effects.push("BLOCK");
      } else if (input.amountUsd > POLICY_LIMITS.travelRuleThresholdUsd && !input.travelRule.complete) {
        results.push(
          buildResult(
            p,
            false,
            `Travel Rule info incomplete for a transfer above $${POLICY_LIMITS.travelRuleThresholdUsd.toLocaleString()} — REVIEW required`
          )
        );
        effects.push("REVIEW");
      } else {
        results.push(
          buildResult(
            p,
            true,
            `Travel Rule information complete for this transfer`
          )
        );
        effects.push("ALLOW");
      }
    }

    // --- approval: manual_approval_threshold -----------------------------
    if (p.id === "manual_approval_threshold") {
      const ok = input.amountUsd <= POLICY_LIMITS.manualApprovalThresholdUsd;
      results.push(
        buildResult(
          p,
          ok,
          ok
            ? `$${input.amountUsd.toLocaleString()} below the $${POLICY_LIMITS.manualApprovalThresholdUsd.toLocaleString()} manual-approval threshold`
            : `$${input.amountUsd.toLocaleString()} requires manual approval (above $${POLICY_LIMITS.manualApprovalThresholdUsd.toLocaleString()})`
        )
      );
      effects.push(ok ? "ALLOW" : p.effect);
    }

    // --- counterparty: blocklist -----------------------------------------
    if (p.id === "blocklist") {
      const blocked = BLOCKLIST.includes(input.screening.profile.address.toLowerCase());
      results.push(
        buildResult(
          p,
          !blocked,
          blocked
            ? `Counterparty ${input.screening.profile.address} is blocklisted — BLOCKED`
            : "Counterparty is not on the blocklist"
        )
      );
      effects.push(blocked ? "BLOCK" : "ALLOW");
    }
  }

  const decision = aggregatePolicyDecision(effects);
  const violations = results.filter((r) => !r.passed);

  return { decision, results, violations };
}

/** Decision tone for the UI (GREEN / YELLOW / RED). */
export function decisionTone(decision: ComplianceDecision): "green" | "yellow" | "red" {
  return decision === "ALLOW" ? "green" : decision === "REVIEW" ? "yellow" : "red";
}
