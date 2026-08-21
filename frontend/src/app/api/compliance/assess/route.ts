// =============================================================================
// POST /api/compliance/assess — DPT Treasury Compliance Layer endpoint.
//
// Runs the full deterministic compliance pipeline for one transfer:
//   intent -> counterparty screening -> monitoring -> unified risk ->
//   policy engine -> travel rule -> DECISION (ALLOW | REVIEW | BLOCK)
//
// The FINAL decision is ALWAYS the deterministic policy engine's call:
//   - ALLOW  -> executionAllowed = true  (still requires human approval to exec)
//   - REVIEW -> humanApprovalRequired = true
//   - BLOCK  -> executionAllowed = false (prevents execution)
//
// The LLM may only add an EXPLANATION after the decision (best-effort; falls
// back to a deterministic explanation when no Gemini key / on failure).
//
// The audit event is persisted best-effort (when Supabase is configured) so an
// unconfigured/offline demo still works — exactly like /api/execution.
//
// Body:  ComplianceRequest (see src/lib/compliance/schema.ts)
// 200:   { success: true, assessment, auditEvent, persisted }
// 422:   { success: false, error: { code, message, issues? } }
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { ComplianceRequestSchema } from "@/lib/compliance/schema";
import { runCompliancePipeline, buildAuditEvent } from "@/lib/compliance/orchestrator";
import { buildComplianceExplanation } from "@/lib/compliance/explain";
import { geminiText, isGeminiConfigured } from "@/lib/ai/gemini";
import type { ComplianceAssessment, ComplianceAuditEvent } from "@/lib/compliance/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128 * 1024;

function errorResponse(code: string, message: string, details?: unknown, status = 400) {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return errorResponse("BODY_TOO_LARGE", `Request body exceeds the ${MAX_BODY_BYTES}-byte limit.`, undefined, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse("INVALID_JSON", "Request body is not valid JSON.");
    }

    const parsed = ComplianceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_FAILED",
        "Request body failed validation.",
        { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        422
      );
    }

    // 1. Run the deterministic compliance pipeline.
    const assessment: ComplianceAssessment = runCompliancePipeline(parsed.data);

    // 2. Attach an explanation AFTER the decision.
    //    Try the LLM (prose only, post-decision); fall back to deterministic.
    let aiExplanation: string | null = null;
    let aiExplanationSource: "ai" | "deterministic" | null = null;
    const deterministicExplanation = buildComplianceExplanation(assessment);

    if (isGeminiConfigured()) {
      try {
        const llm = await geminiText({
          system:
            "You are the compliance advisor for a digital asset treasury prototype. " +
            "You NEVER decide compliance. A deterministic engine has already made the decision. " +
            "Explain the decision in 2-3 plain-English sentences, referencing ONLY the facts provided. " +
            "Do not invent financial figures, do not change the decision, do not claim real regulatory verification.",
          user: JSON.stringify({
            decision: assessment.decision,
            decisionReasons: assessment.decisionReasons,
            riskScore: assessment.risk.score,
            riskLevel: assessment.risk.level,
            screening: assessment.screening.summary,
            signals: assessment.monitoring.signals.map((s) => s.description),
            policyViolations: assessment.policy.violations.map((v) => v.reason),
            travelRule: assessment.travelRule.complete ? "READY" : "INCOMPLETE",
          }),
          model: process.env.GEMINI_COMPLIANCE_MODEL || undefined,
        });
        if (llm && llm.trim().length > 0) {
          aiExplanation = llm.trim();
          aiExplanationSource = "ai";
        }
      } catch (err) {
        console.error("[PayMaster-compliance] LLM explanation failed, using deterministic:", err);
      }
    }

    if (!aiExplanation) {
      aiExplanation = deterministicExplanation;
      aiExplanationSource = "deterministic";
    }

    // 3. Final assessment with explanation baked in.
    const finalAssessment: ComplianceAssessment = {
      ...assessment,
      aiExplanation,
      aiExplanationSource,
    };

    // 4. Build the audit event and persist best-effort.
    const auditEvent: ComplianceAuditEvent = buildAuditEvent(finalAssessment, parsed.data);

    let persisted = false;
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from("compliance_audit_log").insert({
          business_id: parsed.data.businessId ?? null,
          txn_reference: auditEvent.txnReference,
          customer_id: auditEvent.customerId,
          intent: auditEvent.intent,
          recipient: auditEvent.recipient,
          recipient_address: auditEvent.recipientAddress,
          asset: auditEvent.asset,
          amount_usd: auditEvent.amountUsd,
          screening_verdict: auditEvent.screening?.verdict ?? null,
          screening_risk_score: auditEvent.screening?.riskScore ?? null,
          monitoring_signals: auditEvent.monitoringSignals,
          risk_score: auditEvent.riskScore,
          risk_level: auditEvent.riskLevel,
          policy_decision: auditEvent.policy.decision,
          policy_violations: auditEvent.policy.violations,
          travel_rule_status: auditEvent.travelRule.status,
          travel_rule_missing: auditEvent.travelRule.missing,
          decision: auditEvent.decision,
          reviewer: auditEvent.reviewer,
          execution_status: auditEvent.executionStatus,
          tx_hash: auditEvent.txHash,
          ai_explanation: auditEvent.aiExplanation,
          timestamp: auditEvent.timestamp,
        });
        persisted = !error;
        if (error) console.error("[PayMaster-compliance] audit persist error:", error.message);
      } catch (err) {
        console.error("[PayMaster-compliance] audit persist failed:", err);
      }
    }

    return NextResponse.json({ success: true, assessment: finalAssessment, auditEvent, persisted });
  } catch (err) {
    console.error("[PayMaster-compliance] /api/compliance/assess unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse("INTERNAL", message, undefined, 500);
  }
}
