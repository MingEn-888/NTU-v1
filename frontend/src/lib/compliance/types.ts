// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · domain types
//
// This layer sits BETWEEN the user's transaction intent and blockchain
// execution. It evaluates every transfer through a deterministic compliance
// pipeline:
//
//   User Intent
//     -> Intent Parser (existing Phase 5)
//     -> Transaction Planner (existing Phase 6/7)
//     -> Compliance Layer:
//          1. Counterparty Screening   (mock/simulated, deterministic)
//          2. Transaction Monitoring   (deterministic rules + statistics)
//          3. Unified Risk Score 0-100 (counterparty + monitoring + amount +
//                                       asset + policy + travel rule)
//          4. Policy Engine            (configurable deterministic policies)
//          5. Travel Rule              (simulated information-completeness)
//     -> Risk Decision:  ALLOW | REVIEW | BLOCK
//     -> Human Approval (if required)
//     -> Blockchain Execution (existing Phase 9/10)
//     -> Audit Trail
//
// TRUST BOUNDARY (same as the rest of PayMaster):
//   - The LLM NEVER decides ALLOW/REVIEW/BLOCK. It may only EXPLAIN a decision
//     and RECOMMEND actions after the deterministic engine has decided.
//   - BLOCK prevents execution. REVIEW requires human approval. ALLOW still
//     passes through the existing human approval gate for execution.
//   - Screening, sanctions, KYC and Travel Rule data are SIMULATED for this
//     prototype — they are NOT real external verification.
// =============================================================================

/** Final compliance decision produced by the deterministic policy engine. */
export type ComplianceDecision = "ALLOW" | "REVIEW" | "BLOCK";

/** Unified compliance risk levels (extends the Phase 8 risk levels). */
export type ComplianceRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Counterparty screening verdict. */
export type ScreeningVerdict = "PASS" | "REVIEW" | "BLOCK";

/** Verification status of a counterparty profile. */
export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED";

/** Screening status of a counterparty profile. */
export type ScreeningStatus = "NOT_SCREENED" | "CLEARED" | "FLAGGED";

/** Direction a counterparty risk rating moves. */
export type WalletRisk = "LOW" | "MEDIUM" | "HIGH";

// ---------------------------------------------------------------------------
// Counterparty screening
// ---------------------------------------------------------------------------

/** Simulated profile the screening engine maintains per wallet address. */
export interface CounterpartyProfile {
  /** Normalized 0x wallet address. */
  address: string;
  /** Human-readable label if known (company / person name). */
  name: string | null;
  /** KYC / counterparty verification status (SIMULATED). */
  verificationStatus: VerificationStatus;
  /** Whether sanctions screening has been run and passed. */
  sanctionsScreened: boolean;
  /** Overall wallet risk rating (SIMULATED). */
  walletRisk: WalletRisk;
  /** Wallet age in days. */
  walletAgeDays: number;
  /** Transactions observed from/to this wallet (SIMULATED history). */
  txnHistoryCount: number;
  /** Average historical transaction size in USD (SIMULATED behaviour). */
  avgTxnSizeUsd: number;
  /** Recent daily transaction count (SIMULATED behaviour). */
  recentDailyTxns: number;
  /** Suspicious activity indicators observed (SIMULATED). */
  suspiciousIndicators: string[];
  /** Whether this profile is part of the trusted vendor directory. */
  isKnownVendor: boolean;
  /** Optional free-form note. */
  note?: string;
}

/** Result of screening one counterparty. */
export interface CounterpartyScreening {
  /** Verdict from screening alone. */
  verdict: ScreeningVerdict;
  /** 0-100 counterparty risk score (higher = riskier). */
  riskScore: number;
  /** Profile the screening was based on. */
  profile: CounterpartyProfile;
  /** Whether the screening result is SIMULATED (prototype, not real verification). */
  simulated: true;
  /** Human-readable summary of why this verdict was reached. */
  summary: string;
  /** Reasons contributing to the risk score. */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Transaction monitoring
// ---------------------------------------------------------------------------

/** A monitoring signal emitted by the deterministic monitoring engine. */
export interface MonitoringSignal {
  /** Machine-readable signal code, e.g. "UNUSUAL_AMOUNT". */
  signal: string;
  /** LOW | MEDIUM | HIGH | CRITICAL severity of the anomaly. */
  severity: ComplianceRiskLevel;
  /** Human-readable description of the anomaly. */
  description: string;
}

/** Monitoring context for a single counterparty used for deviation checks. */
export interface MonitoringHistory {
  /** Average historical txn size in USD. */
  avgTxnSizeUsd: number;
  /** Average daily transaction count. */
  avgDailyTxnCount: number;
  /** Average txn interval in minutes. */
  avgIntervalMin: number;
  /** Typical txns per counterparty. */
  knownRecipients: string[];
  /** Typical assets used by this customer. */
  knownAssets: string[];
  /** Typical chains used. */
  knownChains: string[];
}

/** Result of running the transaction monitoring engine. */
export interface MonitoringResult {
  /** Signals detected (empty = no anomalies). */
  signals: MonitoringSignal[];
  /** Aggregate 0-100 monitoring risk contribution. */
  riskScore: number;
  /** Overall anomaly level (highest signal severity, else LOW). */
  anomalyLevel: ComplianceRiskLevel;
  /** True when at least one signal is HIGH or CRITICAL. */
  hasHighAnomaly: boolean;
}

// ---------------------------------------------------------------------------
// Unified compliance risk score
// ---------------------------------------------------------------------------

/** Contribution breakdown for the unified 0-100 compliance risk score. */
export interface ComplianceRiskBreakdown {
  counterparty: number;
  monitoring: number;
  amount: number;
  asset: number;
  policy: number;
  travelRule: number;
  total: number;
}

/** Unified compliance risk result. */
export interface ComplianceRiskResult {
  /** 0-100 unified risk score. */
  score: number;
  level: ComplianceRiskLevel;
  breakdown: ComplianceRiskBreakdown;
  /** Human-readable reasons contributing to the score (for transparency). */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Policy engine
// ---------------------------------------------------------------------------

/** Policy effect on the final decision. */
export type PolicyEffect = "ALLOW" | "REVIEW" | "BLOCK";

/** A single configurable treasury/compliance policy. */
export interface PolicyDefinition {
  /** Machine-readable policy id, e.g. "max_single_txn". */
  id: string;
  /** Human-readable policy name, e.g. "Maximum single transaction". */
  name: string;
  /** Category the policy belongs to. */
  category: "limits" | "assets" | "networks" | "exposure" | "reserves" | "travel_rule" | "counterparty" | "approval";
  /** Human-readable description of what the policy enforces. */
  description: string;
  /** Human-readable statement of the configured limit. */
  limitLabel: string;
  /** Effect when the policy is violated. */
  effect: PolicyEffect;
  /** Whether the policy is currently enabled. */
  enabled: boolean;
}

/** Result of evaluating ONE policy against a transfer. */
export interface PolicyResult {
  policy: PolicyDefinition;
  /** true when the transfer complies with this policy. */
  passed: boolean;
  /** Short reason (e.g. "$80,000 exceeds the $50,000 limit"). */
  reason: string;
}

/** Final output of the policy engine for a transfer. */
export interface PolicyEngineResult {
  /** Aggregated final decision. BLOCK wins over REVIEW wins over ALLOW. */
  decision: ComplianceDecision;
  /** Every evaluated policy + outcome (transparency). */
  results: PolicyResult[];
  /** Violated policies that require action. */
  violations: PolicyResult[];
}

// ---------------------------------------------------------------------------
// Travel Rule
// ---------------------------------------------------------------------------

/** Required information field in the Travel Rule workflow. */
export type TravelRuleField =
  | "originator_name"
  | "originator_address"
  | "originator_vasp"
  | "beneficiary_name"
  | "beneficiary_address"
  | "beneficiary_vasp";

/** Status of the travel rule workflow. */
export type TravelRuleStatus = "READY" | "INCOMPLETE";

/** Simulated Travel Rule workflow result for a DPT transfer. */
export interface TravelRuleResult {
  status: TravelRuleStatus;
  /** Fields that are complete (✓). */
  presentFields: TravelRuleField[];
  /** Fields that are missing (✗) — shown clearly in the UI. */
  missingFields: TravelRuleField[];
  /** Whether all required info was provided. */
  complete: boolean;
  /** Effect the incomplete status has on the decision. */
  effect: PolicyEffect;
  /** Simulated — this prototype does not connect to a real Travel Rule network. */
  simulated: true;
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

/** One auditable compliance decision event. */
export interface ComplianceAuditEvent {
  /** e.g. "TX-82931" — business reference of the transfer. */
  txnReference: string;
  /** Business/customer identifier. */
  customerId: string;
  /** Original user intent text. */
  intent: string;
  recipient: string;
  recipientAddress: string;
  asset: string;
  amountUsd: number;
  /** Counterparty screening result snapshot. */
  screening: { verdict: ScreeningVerdict; riskScore: number } | null;
  /** Monitoring signals snapshot. */
  monitoringSignals: MonitoringSignal[];
  /** Unified risk score snapshot. */
  riskScore: number;
  riskLevel: ComplianceRiskLevel;
  /** Policy engine snapshot. */
  policy: { decision: ComplianceDecision; violations: string[] };
  /** Travel Rule snapshot. */
  travelRule: { status: TravelRuleStatus; missing: TravelRuleField[] };
  /** FINAL deterministic decision. */
  decision: ComplianceDecision;
  /** Reviewer (human) — set when a REVIEW was manually decided. */
  reviewer: string | null;
  /** Execution status: PENDING_APPROVAL / APPROVED / EXECUTED / BLOCKED / REJECTED. */
  executionStatus: string;
  /** Blockchain tx hash when executed. */
  txHash: string | null;
  /** Timestamp (ISO). */
  timestamp: string;
  /** The AI explanation (if generated) — never the decision-maker. */
  aiExplanation: string | null;
}

// ---------------------------------------------------------------------------
// Full assessment (orchestrator output)
// ---------------------------------------------------------------------------

/** The complete compliance assessment for one transfer. */
export interface ComplianceAssessment {
  /** Deterministic id of the assessment. */
  assessmentId: string;
  /** Business reference for the transfer (e.g. TX-xxxxx). */
  txnReference: string;
  /** Original intent text. */
  intent: string;
  /** Unified pipeline stages in order. */
  stages: ComplianceStageStatus[];
  screening: CounterpartyScreening;
  monitoring: MonitoringResult;
  risk: ComplianceRiskResult;
  policy: PolicyEngineResult;
  travelRule: TravelRuleResult;
  /** FINAL decision — the deterministic policy engine's call. */
  decision: ComplianceDecision;
  /** Why this decision was reached (aggregated reasons). */
  decisionReasons: string[];
  /** Whether human approval is required (REVIEW or BLOCK-with-appeal). */
  humanApprovalRequired: boolean;
  /** Whether execution is permitted (only ALLOW). */
  executionAllowed: boolean;
  /** Simulated data disclaimer (prototype compliance layer). */
  disclaimer: string;
  /** AI explanation of the decision (generated AFTER the decision). */
  aiExplanation: string | null;
  aiExplanationSource: "ai" | "deterministic" | null;
  timestamp: string;
}

/** Status of one compliance pipeline stage. */
export type ComplianceStageStatus =
  | "intent"
  | "counterparty"
  | "monitoring"
  | "risk"
  | "policy"
  | "travel_rule"
  | "decision"
  | "approval"
  | "execution";
