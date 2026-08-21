"use client";

import React, { useEffect } from "react";
import { ShieldCheck, ShieldAlert, Ban, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompliance } from "@/hooks/useCompliance";
import { simulatedPrice } from "@/lib/compliance/catalog";
import type { ComplianceAssessment } from "@/lib/compliance/types";
import type { ParsedPaymentIntent, PaymentPlan } from "@/lib/payment/types";
import type { SimulationTreasuryLike } from "@/lib/risk/adapter";
import { CompliancePipe } from "./CompliancePipe";
import { DecisionBadge, ToneBadge } from "./ui";

// =============================================================================
// ComplianceGate — drops the DPT compliance layer into the existing payment
// flow. Runs the deterministic compliance pipeline for the detected intent +
// plan BEFORE the human approval gate:
//
//   ALLOW  -> execution permitted (proceeds to normal approval + SmartWallet)
//   REVIEW -> human approval required (existing gate handles this)
//   BLOCK  -> execution PREVENTED — the approval/execution path is disabled
//
// Reports the assessment upward via onResult so the parent can gate execution.
// =============================================================================

export function ComplianceGate({
  intent,
  plan,
  simulationContext,
  businessId,
  onResult,
}: {
  intent: ParsedPaymentIntent;
  plan: PaymentPlan;
  simulationContext?: SimulationTreasuryLike | null;
  businessId?: string | null;
  onResult?: (a: ComplianceAssessment | null) => void;
}) {
  const recommended = plan.routes.find((r) => r.isRecommended) ?? plan.routes[0];
  const asset = plan.settlementAsset;
  const amountUsd = Math.round(plan.settlementAmount * simulatedPrice(asset) * 100) / 100;
  const network = recommended?.chain || simulationContext?.preferredChain || "polygon";

  const { assessment, loading, error } = useCompliance({
    intent: intent.rawInput || `Pay ${intent.recipientName || intent.recipientAddress || "recipient"} ${plan.settlementAmount} ${asset}`,
    recipient: intent.recipientName || intent.recipientAddress,
    recipientAddress: intent.recipientAddress || "",
    asset,
    amountUsd,
    network,
    customerId: "cust_techcorp",
    businessId: businessId ?? undefined,
    enabled: Boolean(intent.recipientAddress),
  });

  useEffect(() => {
    onResult?.(assessment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment?.assessmentId]);

  if (!intent.recipientAddress) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-[11px] text-amber-200/90 leading-snug">
          Compliance screening requires a recipient wallet address — confirm the address to run the compliance pipeline.
        </div>
      </div>
    );
  }

  if (loading && !assessment) {
    return (
      <div className="glass-panel rounded-2xl border border-white/10 p-4">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white">
          <Loader2 className="h-4 w-4 animate-spin text-brand-cyan" />
          Running compliance pipeline…
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
        <ShieldAlert className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
        <div className="text-[11px] text-red-300 leading-snug">Compliance assessment failed: {error}</div>
      </div>
    );
  }

  if (!assessment) return null;

  const tone = assessment.decision === "ALLOW" ? "green" : assessment.decision === "REVIEW" ? "yellow" : "red";
  const Icon = assessment.decision === "ALLOW" ? ShieldCheck : assessment.decision === "REVIEW" ? ShieldAlert : Ban;

  return (
    <div className="space-y-3">
      {/* Decision banner */}
      <div
        className={cn(
          "flex items-start gap-3 p-3.5 rounded-xl border",
          tone === "green"
            ? "bg-emerald-500/5 border-emerald-500/25"
            : tone === "yellow"
            ? "bg-amber-500/5 border-amber-500/25"
            : "bg-red-500/5 border-red-500/25"
        )}
      >
        <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", tone === "green" ? "text-emerald-400" : tone === "yellow" ? "text-amber-400" : "text-red-400")} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[12px] font-extrabold", tone === "green" ? "text-emerald-300" : tone === "yellow" ? "text-amber-300" : "text-red-300")}>
              Compliance decision: {assessment.decision}
            </span>
            <DecisionBadge decision={assessment.decision} />
          </div>
          <div className="text-[11px] text-gray-400 leading-snug mt-1">
            {assessment.decision === "ALLOW"
              ? "Transfer complies with all treasury & compliance policies."
              : assessment.decision === "REVIEW"
              ? "This transfer is flagged for manual review — a human must approve before execution."
              : "Execution is prevented by compliance policy. This transfer cannot be executed."}
          </div>
          {assessment.aiExplanation && (
            <div className="text-[11px] text-gray-500 leading-snug mt-1.5">{assessment.aiExplanation}</div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 items-end shrink-0">
          <ToneBadge tone={assessment.risk.level === "LOW" ? "green" : assessment.risk.level === "MEDIUM" ? "yellow" : "red"}>
            Risk {Math.round(assessment.risk.score)}/100
          </ToneBadge>
          <ToneBadge tone={assessment.executionAllowed ? "green" : "red"}>
            {assessment.executionAllowed ? "Execution permitted" : "Execution prevented"}
          </ToneBadge>
        </div>
      </div>

      <CompliancePipe assessment={assessment} />
    </div>
  );
}
