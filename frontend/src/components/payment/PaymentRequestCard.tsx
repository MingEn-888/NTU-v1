"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  User,
  Landmark,
  ReceiptText,
  CalendarClock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Route,
  Clock,
  Wallet,
  Zap,
  ExternalLink,
} from "lucide-react";
import type { ParsedPaymentIntent, PaymentPlan, PaymentStep, RiskAssessment } from "@/lib/payment/types";
import { currencySymbol } from "@/lib/payment/planGenerator";
import { RiskSimulationPanel } from "@/components/risk/RiskSimulationPanel";
import { simulationRequestFromPlan } from "@/lib/risk/adapter";
import type { SimulationTreasuryLike } from "@/lib/risk/adapter";
import type { SimulationResult } from "@/lib/risk/types";
import type { ExecutionPlan } from "@/lib/execution/types";
import { ApprovalPanel } from "@/components/execution/ApprovalPanel";
import { ExecutionFlowTimeline, type ExecutionFlowStage } from "@/components/execution/ExecutionFlowTimeline";

export type PaymentCardPhase = "detected" | "plan" | "executing" | "complete" | "failed";

interface PaymentRequestCardProps {
  intent: ParsedPaymentIntent;
  plan?: PaymentPlan | null;
  phase: PaymentCardPhase;
  generatingPlan?: boolean;
  onGeneratePlan?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  txHash?: string | null;
  explorerUrl?: string | null;
  error?: string | null;
  /** Treasury context (assets / chains / gas) used by the Phase 8 risk engine. */
  simulationContext?: SimulationTreasuryLike | null;
  /** Phase 10 — validated execution plan ready for the explicit approval gate. */
  executionPlan?: ExecutionPlan | null;
}

const PHASE_META: Record<PaymentCardPhase, { label: string; className: string; dot: string }> = {
  detected: {
    label: "Payment Request Detected",
    className: "text-brand-cyan border-brand-cyan/30 bg-brand-cyan/10",
    dot: "bg-brand-cyan",
  },
  plan: {
    label: "Payment Plan Ready",
    className: "text-violet-300 border-violet-400/30 bg-violet-500/10",
    dot: "bg-violet-400",
  },
  executing: {
    label: "Awaiting Wallet Approval",
    className: "text-amber-300 border-amber-400/30 bg-amber-500/10",
    dot: "bg-amber-400 animate-pulse",
  },
  complete: {
    label: "Payment Completed",
    className: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
    dot: "bg-emerald-400",
  },
  failed: {
    label: "Execution Failed",
    className: "text-red-300 border-red-400/30 bg-red-500/10",
    dot: "bg-red-400",
  },
};

function RiskBadge({ risk }: { risk: RiskAssessment["overallRisk"] }) {
  const color =
    risk === "LOW"
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
      : risk === "MEDIUM"
      ? "text-amber-300 border-amber-400/30 bg-amber-500/10"
      : risk === "HIGH"
      ? "text-orange-300 border-orange-400/30 bg-orange-500/10"
      : "text-red-300 border-red-400/30 bg-red-500/10";
  const Icon = risk === "LOW" ? ShieldCheck : ShieldAlert;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${color}`}>
      <Icon className="h-3 w-3" />
      {risk} Risk
    </span>
  );
}

function StepRow({ step, index }: { step: PaymentStep; index: number }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${
          step.status === "COMPLETED"
            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
            : step.status === "EXECUTING"
            ? "bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse"
            : "bg-white/5 border-white/10 text-gray-400"
        }`}
      >
        {step.status === "COMPLETED" ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-gray-200">{step.title}</div>
        <div className="text-[11px] text-gray-500 leading-snug">{step.description}</div>
      </div>
    </div>
  );
}

export default function PaymentRequestCard({
  intent,
  plan,
  phase,
  generatingPlan,
  onGeneratePlan,
  onApprove,
  onReject,
  txHash,
  explorerUrl,
  error,
  simulationContext,
  executionPlan,
}: PaymentRequestCardProps) {
  const meta = PHASE_META[phase];

  // Phase 8 — build the normalized simulation request from the intent + plan.
  const simRequest = useMemo(() => {
    if (!plan) return null;
    return simulationRequestFromPlan(intent, plan, simulationContext);
  }, [intent, plan, simulationContext]);

  // Phase 8 — the RiskSimulationPanel evaluates the request and reports the
  // result upward (onResultChange) so the SAME SimulationResult feeds the
  // Phase 10 approval panel (risk score + AI explanation).
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  useEffect(() => {
    setSimulation(null);
  }, [JSON.stringify(simRequest)]);

  // Phase 10 — explicit approval gate state. "Confirm & Sign" on the risk panel
  // arms this; the ApprovalPanel then requires [Approve & exec] / [Reject].
  const [approvalArmed, setApprovalArmed] = useState(false);
  useEffect(() => {
    setApprovalArmed(false);
  }, [plan, phase]);

  // Derive the execution timeline stage from the card phase + approval state.
  const timelineStage: ExecutionFlowStage =
    phase === "complete"
      ? "confirmed"
      : phase === "failed" || phase === "executing"
      ? "executing"
      : approvalArmed
      ? "approved"
      : phase === "plan"
      ? "risk_checked"
      : "understood";

  const amountText =
    intent.amount !== null && intent.currency
      ? `${currencySymbol(intent.currency)} ${intent.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : "—";

  const fmtDate = (iso: string | null) => {
    if (!iso) return "Flexible";
    return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  const initials = (intent.recipientName || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-gradient-to-b from-[#14162a] to-[#0d0f1c] shadow-glass overflow-hidden">
      {/* Header strip */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-500/15 border border-brand-500/30 text-brand-400">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-white leading-tight">Business Payment Operation</div>
            <div className="text-[10px] text-gray-500 font-medium">IBAP · Intent Parsed</div>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${meta.className}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Recipient + Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500/30 to-brand-cyan/30 border border-brand-500/30 flex items-center justify-center text-brand-200 font-bold text-sm shrink-0">
              {intentsAvatar(intent, initials)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <User className="h-3 w-3" /> Recipient
              </div>
              <div className="text-[15px] font-bold text-white truncate">
                {intent.recipientName || intent.recipientAddress || "Unspecified"}
              </div>
              {intent.recipientAddress && (
                <div className="text-[10px] font-mono text-gray-500 truncate">{shortAddr(intent.recipientAddress)}</div>
              )}
              {!intent.recipientAddress && intent.recipientName && (
                <div className="text-[10px] text-amber-300/80 font-medium">Address not on file — needs confirmation</div>
              )}
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Amount</div>
            <div className="text-xl font-extrabold text-white leading-tight">
              {amountText}
            </div>
            {plan && plan.settlementAsset !== intent.currency && (
              <div className="text-[11px] text-brand-cyan font-semibold">
                ≈ {plan.settlementAmount.toLocaleString("en-US")} {plan.settlementAsset}
              </div>
            )}
          </div>
        </div>

        {/* Purpose + Deadline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-black/30 border border-white/5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              <ReceiptText className="h-3 w-3" /> Purpose
            </div>
            <div className="text-[13px] font-semibold text-gray-200">
              {intent.purpose || "General payment"}
            </div>
            {intent.invoiceNumber && (
              <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[10px] font-bold">
                <ReceiptText className="h-2.5 w-2.5" /> INV-{intent.invoiceNumber}
              </span>
            )}
          </div>
          <div className="p-3 rounded-xl bg-black/30 border border-white/5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              <CalendarClock className="h-3 w-3" /> Deadline
            </div>
            <div className="text-[13px] font-semibold text-gray-200">
              {intent.deadlineLabel ? `${intent.deadlineLabel} · ${fmtDate(intent.deadlineDate)}` : "Flexible"}
            </div>
            {intent.deadlineDate && (
              <div className="text-[10px] text-gray-500">Settle before this date</div>
            )}
          </div>
        </div>

        {/* Confidence */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
            <span>Intent Confidence</span>
            <span className={intent.confidence >= 0.7 ? "text-emerald-300" : "text-amber-300"}>
              {Math.round(intent.confidence * 100)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                intent.confidence >= 0.7
                  ? "bg-gradient-to-r from-brand-500 to-brand-cyan"
                  : "bg-gradient-to-r from-amber-500 to-amber-400"
              }`}
              style={{ width: `${Math.round(intent.confidence * 100)}%` }}
            />
          </div>
        </div>

        {/* Missing info */}
        {intent.missingInformation.length > 0 && phase !== "complete" && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-[11px] text-amber-200/90 leading-snug">
              {intent.missingInformation.join(" · ")}
            </div>
          </div>
        )}

        {/* PLAN SECTION */}
        {plan && phase !== "detected" && (
          <div className="space-y-4 border-t border-white/10 pt-4">
            {/* Phase 10 — full execution timeline (understood → confirmed). */}
            <ExecutionFlowTimeline
              stage={timelineStage}
              failed={phase === "failed"}
              error={error}
              txHash={txHash}
              explorerUrl={explorerUrl}
            />

            {/* Settlement summary */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-[12px] text-gray-300">
                <Wallet className="h-4 w-4 text-brand-cyan" />
                <span className="font-semibold text-white">{plan.settlementAmount.toLocaleString("en-US")} {plan.settlementAsset}</span>
                <span className="text-gray-500">from treasury</span>
              </div>
              <RiskBadge risk={plan.risk.overallRisk} />
            </div>

            {/* Routes */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <Route className="h-3 w-3" /> Route Options
              </div>
              {plan.routes.map((r) => (
                <div
                  key={r.id}
                  className={`p-2.5 rounded-xl border flex items-center gap-3 ${
                    r.isRecommended
                      ? "border-brand-500/40 bg-brand-500/10"
                      : "border-white/5 bg-black/25"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${r.isRecommended ? "bg-brand-500/20 text-brand-300" : "bg-white/5 text-gray-400"}`}>
                    <Zap className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-gray-100 flex items-center gap-2">
                      {r.routeName}
                      {r.isRecommended && (
                        <span className="px-1.5 py-0.5 rounded bg-brand-500/30 text-brand-200 text-[9px] font-bold uppercase">Recommended</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {r.chain} · {r.transactionCount} tx · ~{r.estimatedTime}s
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] font-bold text-gray-200">${r.estimatedGas.toFixed(3)}</div>
                    <div className="text-[9px] text-gray-500">score {r.totalScore}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <Sparkles className="h-3 w-3" /> Execution Steps
              </div>
              <div className="space-y-2.5">
                {plan.steps.map((s, i) => (
                  <StepRow key={i} step={s} index={i} />
                ))}
              </div>
            </div>

            {/* Plan rationale */}
            <p className="text-[11px] text-gray-400 leading-relaxed bg-black/25 border border-white/5 rounded-xl p-3">
              {plan.explanation}
            </p>

            {/* Phase 8 — Risk evaluation & simulation BEFORE approval. The
                engine never auto-executes: the human must Review Payment, then
                Confirm & Sign, and finally Approve & exec in the Phase 10 gate. */}
            {phase === "plan" && simRequest && (
              <>
                <RiskSimulationPanel
                  request={simRequest}
                  onResultChange={setSimulation}
                  onReview={approvalArmed ? undefined : () => setApprovalArmed(true)}
                  onReject={approvalArmed ? undefined : onReject}
                />

                {/* Phase 10 — explicit human approval interface. Nothing is sent
                    to the SmartWallet until [Approve & exec] is pressed. */}
                {approvalArmed && executionPlan && (
                  <ApprovalPanel
                    plan={executionPlan}
                    simulation={simulation}
                    approving={false}
                    onApprove={() => {
                      setApprovalArmed(false);
                      onApprove?.();
                    }}
                    onReject={onReject}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* STATUS / ERROR MESSAGES */}
        {phase === "executing" && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <span className="h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <span className="text-[12px] text-amber-200 font-medium">
              Signing transaction in wallet — please review and confirm in MetaMask…
            </span>
          </div>
        )}

        {phase === "complete" && txHash && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-300 text-[12px] font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              <span>Payment settled on-chain</span>
            </div>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-brand-cyan hover:text-brand-300 font-semibold"
              >
                <span className="font-mono">{shortAddr(txHash, 6)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-[10px] font-mono text-gray-400 truncate max-w-[180px]">{txHash}</span>
            )}
          </div>
        )}

        {phase === "failed" && error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <div className="text-[12px] text-red-200 leading-snug">{error}</div>
          </div>
        )}

        {/* ACTIONS */}
        {phase === "detected" && (
          <button
            onClick={onGeneratePlan}
            disabled={generatingPlan}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-brand-accent to-brand-cyan hover:from-brand-500 hover:to-brand-500 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-glow disabled:opacity-50 transition-all"
          >
            {generatingPlan ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Generating Payment Plan…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Payment Plan
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        )}

        {/* Phase 8 — approval is now handled by the RiskSimulationPanel above:
            Review Payment -> Confirm & Sign (explicit human approval, no auto-exec). */}
      </div>
    </div>
  );
}

function intentsAvatar(intent: ParsedPaymentIntent, initials: string) {
  // Render a small per-action icon glyph: pay vs settle vs reimburse
  if (intent.action === "SETTLE_INVOICE") return <ReceiptText className="h-5 w-5" />;
  if (intent.action === "REIMBURSE") return <ArrowRight className="h-5 w-5" />;
  return <span>{initials}</span>;
}

function shortAddr(addr: string, digits = 4): string {
  if (!addr) return "";
  if (addr.length <= digits * 2 + 2) return addr;
  return `${addr.slice(0, digits + 2)}…${addr.slice(-digits)}`;
}
