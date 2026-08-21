// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · decision explanation
//
// The LLM never decides compliance. After the deterministic policy engine has
// produced its decision, this module can attach an EXPLANATION. The primary
// path is deterministic (buildComplianceExplanation) — grounded ONLY in the
// validated assessment figures. An LLM may polish the qualitative prose via
// geminiText, but the decision and every number are fixed beforehand.
// =============================================================================

import { decisionTone } from "./policy";
import type { ComplianceAssessment } from "./types";

/**
 * Deterministic plain-English explanation of a compliance decision, built
 * exclusively from validated assessment data. Every figure comes from the
 * assessment — the LLM is never allowed to invent numbers.
 */
export function buildComplianceExplanation(a: ComplianceAssessment): string {
  const parts: string[] = [];

  const decisionWord =
    a.decision === "ALLOW" ? "allowed" : a.decision === "REVIEW" ? "flagged for review" : "blocked";

  parts.push(
    `This transfer was ${decisionWord} by the deterministic policy engine (${a.decision}).`
  );

  // Counterparty screening.
  const s = a.screening;
  parts.push(
    s.verdict === "PASS"
      ? `Counterparty screening passed (${s.riskScore}/100, simulated).`
      : `Counterparty screening ${s.verdict.toLowerCase()} (${s.riskScore}/100, simulated): ${s.profile.verificationStatus === "VERIFIED" ? "verified" : "unverified"}${
          s.profile.walletRisk === "HIGH" ? ", high wallet risk" : ""
        }.`
  );

  // Monitoring signals.
  if (a.monitoring.signals.length > 0) {
    const top = a.monitoring.signals
      .filter((sig) => sig.severity === "HIGH" || sig.severity === "CRITICAL")
      .map((sig) => sig.signal);
    parts.push(
      `Monitoring detected ${a.monitoring.signals.length} signal(s)${
        top.length > 0 ? `, including ${top.join(", ")}` : ""
      }.`
    );
  } else {
    parts.push("Transaction monitoring found no anomalies.");
  }

  // Unified risk.
  parts.push(
    `Unified compliance risk score: ${Math.round(a.risk.score)}/100 (${a.risk.level}).`
  );

  // Policy violations.
  if (a.policy.violations.length > 0) {
    parts.push(
      `Policy violations: ${a.policy.violations.map((v) => `${v.policy.name} (${v.reason})`).join("; ")}.`
    );
  } else {
    parts.push("All configured treasury & compliance policies passed.");
  }

  // Travel rule.
  parts.push(
    a.travelRule.complete
      ? "Travel Rule information is complete (READY)."
      : `Travel Rule information is INCOMPLETE — missing: ${a.travelRule.missingFields
          .map((f) => f.replace(/_/g, " "))
          .join(", ")}.`
  );

  // Recommendation (deterministic).
  if (a.decision === "ALLOW") {
    parts.push("The transfer may proceed to the human approval gate before execution.");
  } else if (a.decision === "REVIEW") {
    parts.push(
      `Manual review is required before this transfer can be executed. A human must approve the transfer to proceed.`
    );
  } else {
    parts.push("Execution is prevented by compliance policy. This transfer cannot be executed.");
  }

  return parts.join(" ");
}

/** Tone label used by the UI to colour the decision (GREEN/YELLOW/RED). */
export { decisionTone };
