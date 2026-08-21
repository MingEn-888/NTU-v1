// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · Orchestrator
//
// Runs the FULL compliance pipeline for one transfer and produces the final
// ComplianceAssessment:
//
//   intent -> counterparty screening -> monitoring -> unified risk ->
//   policy engine -> travel rule -> DECISION -> (approval/execution gating)
//
// The FINAL decision is ALWAYS the deterministic policy engine's call.
//   - ALLOW  -> executionAllowed = true  (still passes through human approval)
//   - REVIEW -> humanApprovalRequired = true
//   - BLOCK  -> executionAllowed = false (prevents execution)
//
// An AI explanation may be attached AFTER the decision (LLM never decides).
// =============================================================================

import { COMPLIANCE_DISCLAIMER } from "./catalog";
import { screenCounterparty } from "./counterparty";
import { monitorTransaction, type MonitoringInput } from "./monitoring";
import { assessRisk, type RiskInput } from "./risk";
import { evaluatePolicies, type PolicyInput } from "./policy";
import { evaluateTravelRule, defaultTravelRulePayloadFor, type TravelRulePayload } from "./travelRule";
import type {
  ComplianceAssessment,
  ComplianceAuditEvent,
  ComplianceDecision,
  MonitoringSignal,
} from "./types";

// ---------------------------------------------------------------------------
// Orchestrator input (a single transfer to assess)
// ---------------------------------------------------------------------------

export interface ComplianceRequest {
  /** Original user intent text (e.g. "Pay supplier $50,000 USDC"). */
  intent: string;
  /** Recipient label if known. */
  recipient?: string | null;
  /** Recipient wallet address (0x). */
  recipientAddress: string;
  /** Settlement asset symbol (e.g. USDC). */
  asset: string;
  /** Transfer amount in USD. */
  amountUsd: number;
  /** Chain/network the transfer is routed on (e.g. polygon). */
  network: string;
  /** Customer / business identifier. */
  customerId: string;
  /** Reference for the transfer (e.g. TX-82931). */
  txnReference?: string;
  /** Simulated Travel Rule payload for this transfer. */
  travelRulePayload?: TravelRulePayload;
  /** Simulated monitoring history override (defaults to DEFAULT_MONITORING_HISTORY). */
  monitoringHistory?: MonitoringInput["history"];
  /** Simulated daily volume already settled today (USD). */
  dailyVolumeUsd?: number;
  /** Simulated outstanding exposure to this counterparty (USD). */
  counterpartyExposureUsd?: number;
  /** Treasury asset allocation (symbol -> share 0-1). */
  allocation?: Record<string, number>;
  /** Stablecoin share of treasury (0-1). */
  stablecoinShare?: number;
  /** Transaction timestamp (ms) for monitoring timing checks. */
  timestamp?: number;
  /** Repeated identical transfers count today (simulated). */
  repeatTxnCount?: number;
  /** Daily txn count today (simulated). */
  dailyTxnCount?: number;
}

function buildTxnReference(req: ComplianceRequest, index: number): string {
  if (req.txnReference) return req.txnReference;
  // Deterministic pseudo-reference from the customer + a running index.
  return `TX-${(index + 1).toString().padStart(5, "0")}`;
}

/**
 * Run the full compliance pipeline. Pure deterministic except for the optional
 * AI explanation, which is attached after the decision and never influences it.
 */
export function runCompliancePipeline(
  req: ComplianceRequest,
  opts: { txnIndex?: number; aiExplanation?: string | null; aiExplanationSource?: "ai" | "deterministic" | null } = {}
): ComplianceAssessment {
  const txnReference = buildTxnReference(req, opts.txnIndex ?? 0);

  // 1. Counterparty screening.
  const screening = screenCounterparty(req.recipientAddress);

  // 2. Transaction monitoring.
  const monitoring = monitorTransaction({
    amountUsd: req.amountUsd,
    recipientAddress: req.recipientAddress,
    asset: req.asset,
    network: req.network,
    timestamp: req.timestamp ?? Date.now(),
    history: req.monitoringHistory ?? {
      avgTxnSizeUsd: 5000,
      avgDailyTxnCount: 2,
      avgIntervalMin: 720,
      knownRecipients: [
        "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
        "0x3c44cdd470368a0623a22d2c4022878d3f9905e5",
      ],
      knownAssets: ["USDC", "USDT"],
      knownChains: ["polygon", "ethereum"],
    },
    repeatTxnCount: req.repeatTxnCount,
    dailyTxnCount: req.dailyTxnCount,
  });

  // 3. Travel Rule (evaluated before policy so the policy engine can use it).
  //    Default payload derives from the counterparty screening: verified
  //    counterparties carry complete simulated Travel Rule info, others none.
  const travelRule = evaluateTravelRule(
    req.travelRulePayload ?? defaultTravelRulePayloadFor(screening),
    req.amountUsd
  );

  // 4. Policy engine (deterministic final decision).
  const policy = evaluatePolicies({
    amountUsd: req.amountUsd,
    asset: req.asset,
    network: req.network,
    screening,
    travelRule,
    counterpartyExposureUsd: req.counterpartyExposureUsd ?? 0,
    dailyVolumeUsd: req.dailyVolumeUsd ?? 0,
    allocation: req.allocation ?? {},
    stablecoinShare: req.stablecoinShare ?? 0.5,
  });

  // 5. Unified risk score.
  const riskInput: RiskInput = {
    screening,
    monitoring,
    amountUsd: req.amountUsd,
    asset: req.asset,
    policy,
    travelRule,
  };
  const risk = assessRisk(riskInput);

  // 6. Final decision + gating.
  const decision: ComplianceDecision = policy.decision;
  const executionAllowed = decision === "ALLOW";
  const humanApprovalRequired = decision === "REVIEW";

  // 7. Aggregate decision reasons (transparency).
  const decisionReasons: string[] = [];
  if (screening.verdict !== "PASS")
    decisionReasons.push(`Counterparty screening: ${screening.verdict} (${screening.riskScore}/100)`);
  if (monitoring.signals.length > 0)
    decisionReasons.push(`${monitoring.signals.length} monitoring signal(s) detected`);
  if (policy.violations.length > 0)
    decisionReasons.push(...policy.violations.map((v) => `${v.policy.name}: ${v.reason}`));
  if (!travelRule.complete)
    decisionReasons.push(
      `Travel Rule info incomplete (${travelRule.missingFields.length} field(s) missing)`
    );
  if (decisionReasons.length === 0)
    decisionReasons.push("Transfer complies with all configured treasury & compliance policies");

  const stages: ComplianceAssessment["stages"] = [
    "intent",
    "counterparty",
    "monitoring",
    "risk",
    "policy",
    "travel_rule",
    "decision",
  ];

  return {
    assessmentId: `ca_${txnReference.replace(/\W/g, "_").toLowerCase()}`,
    txnReference,
    intent: req.intent,
    stages,
    screening,
    monitoring,
    risk,
    policy,
    travelRule,
    decision,
    decisionReasons,
    humanApprovalRequired,
    executionAllowed,
    disclaimer: COMPLIANCE_DISCLAIMER,
    aiExplanation: opts.aiExplanation ?? null,
    aiExplanationSource: opts.aiExplanationSource ?? null,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Audit event builder — every compliance decision becomes an audit record.
// ---------------------------------------------------------------------------

export function buildAuditEvent(assessment: ComplianceAssessment, req: ComplianceRequest): ComplianceAuditEvent {
  return {
    txnReference: assessment.txnReference,
    customerId: req.customerId,
    intent: req.intent,
    recipient: req.recipient ?? "",
    recipientAddress: req.recipientAddress,
    asset: req.asset,
    amountUsd: req.amountUsd,
    screening: {
      verdict: assessment.screening.verdict,
      riskScore: assessment.screening.riskScore,
    },
    monitoringSignals: assessment.monitoring.signals as MonitoringSignal[],
    riskScore: assessment.risk.score,
    riskLevel: assessment.risk.level,
    policy: {
      decision: assessment.policy.decision,
      violations: assessment.policy.violations.map((v) => v.policy.name),
    },
    travelRule: {
      status: assessment.travelRule.status,
      missing: assessment.travelRule.missingFields,
    },
    decision: assessment.decision,
    reviewer: null,
    executionStatus: assessment.decision === "BLOCK" ? "BLOCKED" : "PENDING_APPROVAL",
    txHash: null,
    timestamp: assessment.timestamp,
    aiExplanation: assessment.aiExplanation,
  };
}
