"use client";

// =============================================================================
// PayMaster Phase 10 — Explicit Human Approval Interface.
//
// The final, unmistakable gate between the AI planning pipeline and on-chain
// movement. Shows EVERYTHING the operator is about to sign:
//   Recipient · Amount · Token · Selected Route · Gas Savings · Risk ·
//   Execution Steps · AI Explanation
// and requires an explicit [Approve & exec] / [Reject] decision.
//
// Nothing is sent to the SmartWallet until [Approve & exec] is pressed. This
// component never executes on its own — it only surfaces the decision.
// =============================================================================

import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  Fuel,
  Lock,
  Route,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  XCircle,
} from "lucide-react";
import type { ExecutionPlan } from "@/lib/execution/types";
import type { SimulationResult } from "@/lib/risk/types";
import { cn } from "@/lib/utils";

export interface ApprovalPanelProps {
  /** The validated execution plan waiting for a human decision. */
  plan: ExecutionPlan;
  /** Phase 8 simulation result (risk score + AI explanation + route). */
  simulation?: SimulationResult | null;
  /** True while the transaction is being prepared/sent. */
  approving?: boolean;
  disabled?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  className?: string;
}

function fmtUsd(n: number | undefined | null): string {
  const v = Number(n ?? 0);
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortAddr(addr: string, digits = 4): string {
  if (!addr) return "—";
  if (addr.length <= digits * 2 + 2) return addr;
  return `${addr.slice(0, digits + 2)}…${addr.slice(-digits)}`;
}

function routeLabel(simulation?: SimulationResult | null, plan?: ExecutionPlan): string {
  const seq = simulation?.route.chainSequence;
  if (seq && seq.length) {
    return seq.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(" → ");
  }
  return plan?.routeId || "Recommended route";
}

const ACTION_TONE: Record<string, string> = {
  TRANSFER: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  EXECUTE_PAYMENT: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  APPROVE: "bg-brand-500/15 border-brand-500/40 text-brand-300",
  SWAP: "bg-violet-500/15 border-violet-500/40 text-violet-300",
  BRIDGE: "bg-cyan-500/15 border-cyan-500/40 text-cyan-300",
  CHECK_ALLOWANCE: "bg-white/10 border-white/15 text-gray-300",
  CONFIRM: "bg-white/10 border-white/15 text-gray-300",
  CONFIRM_SETTLEMENT: "bg-white/10 border-white/15 text-gray-300",
};

export function ApprovalPanel({
  plan,
  simulation,
  approving,
  disabled,
  onApprove,
  onReject,
  className,
}: ApprovalPanelProps) {
  const riskLevel = simulation?.riskLevel ?? null;
  const riskScore = simulation?.riskScore ?? null;
  const executableCount = plan.steps.filter((s) => s.tx).length;

  return (
    <div className={cn("rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#1a1520] to-[#0d0f1c] p-4 space-y-4", className)}>
      {/* ------------------------- Header ------------------------- */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-brand-accent flex items-center justify-center shadow-glow">
          <Lock className="h-5 w-5 text-on-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-white tracking-tight">Final Approval Required</h3>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
              Phase 10
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Review every detail below — approving signs &amp; executes through the SmartWallet.
          </p>
        </div>
      </div>

      {/* ------------------------- Summary tiles ------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            <User className="h-3 w-3" /> Recipient
          </div>
          <div className="text-[13px] font-bold text-white truncate">{plan.recipient || "—"}</div>
          <div className="text-[10px] font-mono text-gray-500 truncate">{shortAddr(plan.recipientAddress)}</div>
        </div>
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            <Coins className="h-3 w-3" /> Amount · Token
          </div>
          <div className="text-[13px] font-bold text-white">
            {Number(plan.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} {plan.token || "native"}
          </div>
          <div className="text-[10px] text-gray-500 truncate font-mono">
            {plan.tokenAddress ? shortAddr(plan.tokenAddress, 6) : "native asset"}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            <Route className="h-3 w-3" /> Selected Route
          </div>
          <div className="text-[13px] font-bold text-white capitalize">{routeLabel(simulation, plan)}</div>
          <div className="text-[10px] text-gray-500">{executableCount} on-chain op{executableCount === 1 ? "" : "s"}</div>
        </div>
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            <Fuel className="h-3 w-3" /> Gas
          </div>
          <div className="text-[13px] font-bold text-brand-cyan">{fmtUsd(plan.estimatedGasUsd)}</div>
          <div className="text-[10px] text-gray-500">estimated</div>
        </div>
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Gas Savings
          </div>
          <div className="text-[13px] font-bold text-emerald-300">{fmtUsd(plan.estimatedSavingsUsd)}</div>
          <div className="text-[10px] text-gray-500">vs baseline route</div>
        </div>
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            {riskLevel === "LOW" ? (
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-3 w-3 text-amber-400" />
            )}{" "}
            Risk
          </div>
          <div
            className={cn(
              "text-[13px] font-bold",
              riskLevel === "LOW" ? "text-emerald-300" : riskLevel === "HIGH" ? "text-red-300" : "text-amber-300"
            )}
          >
            {riskLevel || "n/a"}
            {typeof riskScore === "number" ? ` · ${riskScore}/100` : ""}
          </div>
          <div className="text-[10px] text-gray-500">deterministic score</div>
        </div>
      </div>

      {/* ------------------------- Execution steps ------------------------- */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
          <Sparkles className="h-3 w-3 text-brand-cyan" /> Execution Steps ({plan.steps.length})
        </div>
        <div className="space-y-1.5">
          {plan.steps.map((s) => {
            const executable = !!s.tx;
            return (
              <div
                key={s.order}
                className={cn(
                  "flex items-start gap-2.5 p-2.5 rounded-xl border",
                  executable ? "border-brand-500/25 bg-brand-500/5" : "border-white/5 bg-black/25"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 h-5 w-5 rounded-lg flex items-center justify-center text-[9px] font-bold border shrink-0",
                    ACTION_TONE[s.actionType] ?? "bg-white/10 border-white/15 text-gray-300"
                  )}
                >
                  {s.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-gray-100">{s.title}</span>
                    <span className="text-[9px] font-mono uppercase text-gray-600">{s.actionType}</span>
                    {executable && (
                      <span className="px-1.5 py-0.5 rounded bg-brand-500/20 border border-brand-500/40 text-[9px] font-bold uppercase text-brand-300">
                        Will execute
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{s.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------- AI explanation ------------------------- */}
      {simulation?.explanation && (
        <div className="rounded-xl bg-gradient-to-br from-[#151a30] to-[#0d0f1c] border border-white/10 p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand-cyan" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300">AI explanation</span>
            <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-300">
              <Lock className="h-2.5 w-2.5" />
              numbers from validated data
            </span>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed">{simulation.explanation}</p>
        </div>
      )}

      {/* ------------------------- Warnings ------------------------- */}
      {simulation && simulation.warnings.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-[11px] text-amber-200/90 leading-snug">
            {simulation.warnings.length} warning(s) — review the risk panel above before approving.
          </div>
        </div>
      )}

      {/* ------------------------- Decisions ------------------------- */}
      <div className="border-t border-white/10 pt-3.5 flex gap-2">
        <button
          onClick={onReject}
          disabled={approving || disabled}
          className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-300 text-[12px] font-bold flex items-center gap-2 transition-all disabled:opacity-40"
        >
          <ThumbsDown className="h-4 w-4" />
          Reject
        </button>
        <button
          onClick={onApprove}
          disabled={approving || disabled}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-on-accent text-[13px] font-bold flex items-center justify-center gap-2 shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {approving ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Executing…
            </>
          ) : (
            <>
              <ThumbsUp className="h-4 w-4" />
              Approve &amp; exec
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* ------------------------- Safety footnote ------------------------- */}
      <div className="flex items-center gap-2 text-[10px] text-gray-600">
        <XCircle className="h-3 w-3 text-gray-600" />
        The AI never executes on its own. Your signature authorizes the SmartWallet to run the exact steps above.
      </div>
    </div>
  );
}
