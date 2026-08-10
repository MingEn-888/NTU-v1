"use client";

// =============================================================================
// IBAP Phase 10 — Execution Flow Timeline.
//
// Renders the full safe execution lifecycle as a single vertical timeline:
//     ✓ Payment understood → ✓ Route optimized → ✓ Risk checked
//     → ✓ Approved → ● Executing → ○ Confirmed
//
// The timeline makes it visually explicit that a human approval sits between
// the (deterministic) AI planning pipeline and any on-chain movement, and that
// blockchain execution is the FINAL stage — never a step the AI takes itself.
// =============================================================================

import React from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  MessageSquareText,
  Route,
  ShieldCheck,
  ThumbsUp,
  Zap,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ExecutionFlowStage =
  | "understood"
  | "route_optimized"
  | "risk_checked"
  | "approved"
  | "executing"
  | "confirmed";

export interface ExecutionFlowTimelineProps {
  /** The current (latest) stage of the execution flow. */
  stage: ExecutionFlowStage;
  /** True when execution failed — renders the executing step as ✗ red. */
  failed?: boolean;
  error?: string | null;
  txHash?: string | null;
  explorerUrl?: string | null;
  className?: string;
}

const STAGES: { key: ExecutionFlowStage; label: string; hint: string; icon: React.ElementType }[] = [
  { key: "understood", label: "Payment understood", hint: "Intent parsed", icon: MessageSquareText },
  { key: "route_optimized", label: "Route optimized", hint: "Deterministic scoring", icon: Route },
  { key: "risk_checked", label: "Risk checked", hint: "7 checks · 0-100", icon: ShieldCheck },
  { key: "approved", label: "Approved", hint: "Human signature", icon: ThumbsUp },
  { key: "executing", label: "Executing", hint: "SmartWallet on-chain", icon: Zap },
  { key: "confirmed", label: "Confirmed", hint: "Receipt mined", icon: CheckCircle2 },
];

function shortHash(hash: string): string {
  if (!hash) return "";
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function ExecutionFlowTimeline({
  stage,
  failed,
  error,
  txHash,
  explorerUrl,
  className,
}: ExecutionFlowTimelineProps) {
  const currentIdx = STAGES.findIndex((s) => s.key === stage);
  const failedIdx = failed ? STAGES.findIndex((s) => s.key === "executing") : -1;

  return (
    <div className={cn("rounded-2xl glass-panel border border-white/10 p-4 space-y-1", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          <Zap className="h-3.5 w-3.5 text-brand-cyan" />
          Execution Timeline
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-full">
          Phase 10
        </span>
      </div>

      <div className="space-y-0">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const isDone = currentIdx > i;
          const isCurrent = currentIdx === i;
          const isFailedHere = failedIdx === i;
          const isPending = !isDone && !isCurrent;

          let icon: React.ReactNode;
          if (isFailedHere && failed) {
            icon = <XCircle className="h-4 w-4 text-red-400" />;
          } else if (isDone || (isCurrent && s.key === "confirmed")) {
            icon = <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
          } else if (isCurrent && s.key === "executing") {
            icon = <Loader2 className="h-4 w-4 text-amber-300 animate-spin" />;
          } else if (isCurrent) {
            icon = <Icon className="h-4 w-4 text-brand-300 animate-pulse" />;
          } else {
            icon = <Circle className="h-4 w-4 text-gray-600" />;
          }

          const dotCls = isFailedHere && failed
            ? "bg-red-500/20 border-red-500/40 text-red-300"
            : isDone || (isCurrent && s.key === "confirmed")
            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
            : isCurrent && s.key === "executing"
            ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
            : isCurrent
            ? "bg-brand-500/20 border-brand-500/50 text-brand-300"
            : "bg-white/5 border-white/10 text-gray-600";

          return (
            <div key={s.key} className="flex gap-3">
              {/* Connector + dot */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 transition-all",
                    dotCls,
                    isCurrent && s.key === "executing" && "shadow-glow"
                  )}
                >
                  {icon}
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    className={cn(
                      "w-px flex-1 min-h-4 my-0.5",
                      isDone || (isCurrent && i < currentIdx)
                        ? "bg-gradient-to-b from-emerald-500/60 to-emerald-500/20"
                        : "bg-white/10"
                    )}
                  />
                )}
              </div>
              {/* Label */}
              <div className="pb-3 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-[12px] font-bold",
                      isFailedHere && failed
                        ? "text-red-300"
                        : isDone || (isCurrent && s.key === "confirmed")
                        ? "text-emerald-300"
                        : isCurrent
                        ? "text-white"
                        : "text-gray-500"
                    )}
                  >
                    {s.label}
                  </span>
                  {isFailedHere && failed && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-[9px] font-bold uppercase text-red-300">
                      Failed
                    </span>
                  )}
                  {isCurrent && s.key === "executing" && !failed && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-[9px] font-bold uppercase text-amber-300 animate-pulse">
                      In progress
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "text-[10px] leading-snug",
                    isCurrent || isDone ? "text-gray-500" : "text-gray-700"
                  )}
                >
                  {s.hint}
                </div>
                {s.key === "confirmed" && txHash && (
                  <div className="mt-1 flex items-center gap-2 text-[10px]">
                    {explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-brand-cyan hover:text-brand-300 font-semibold underline decoration-dotted"
                      >
                        {shortHash(txHash)} ↗
                      </a>
                    ) : (
                      <span className="font-mono text-gray-500">{shortHash(txHash)}</span>
                    )}
                  </div>
                )}
                {isFailedHere && failed && error && (
                  <p className="mt-1 text-[10px] text-red-300/90 leading-snug">{error}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
