"use client";

// =============================================================================
// PayMaster Phase 6 — Payment Plan Execution Timeline
//
// Renders the candidate execution plans produced by POST /api/planner as an
// animated vertical timeline of deterministic blockchain steps. Communicates
// progress: PENDING (dim), EXECUTING (amber pulse + marching-dash connector),
// COMPLETED (emerald pop), FAILED (red).
// =============================================================================

import React, { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Flag,
  Fuel,
  Layers,
  Loader2,
  Repeat,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import type { CandidateExecutionPlan, PlanActionType, PlanStep } from "@/lib/planner/types";
import { cn } from "@/lib/utils";

export type TimelineExecutionStatus = "idle" | "running" | "complete" | "failed";

export interface ExecutionTimelineProps {
  plans: CandidateExecutionPlan[];
  /** Controlled selected plan id (falls back to internal state / recommended). */
  selectedPlanId?: string;
  onSelectPlan?: (planId: string) => void;
  /** Order (1-based) of the currently executing step. */
  activeStepOrder?: number;
  executionStatus?: TimelineExecutionStatus;
  className?: string;
}

const ACTION_ICONS: Record<PlanActionType, React.ElementType> = {
  CHECK_ALLOWANCE: ShieldCheck,
  APPROVE: BadgeCheck,
  SWAP: ArrowRightLeft,
  BRIDGE: Repeat,
  TRANSFER: Send,
  CONFIRM: Flag,
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatGas(usd: number): string {
  return `$${usd.toFixed(usd >= 1 ? 2 : 3)}`;
}

function shortDeps(deps: number[]): string {
  if (!deps.length) return "no deps";
  return `after step ${deps.join(", ")}`;
}

type StepVisualState = "pending" | "executing" | "completed" | "failed";

export function ExecutionTimeline({
  plans,
  selectedPlanId,
  onSelectPlan,
  activeStepOrder = 0,
  executionStatus = "idle",
  className,
}: ExecutionTimelineProps) {
  const recommendedId = useMemo(() => plans.find((p) => p.isRecommended)?.id ?? plans[0]?.id, [plans]);
  const [internalId, setInternalId] = useState<string | null>(null);

  const selectedId = selectedPlanId ?? internalId ?? recommendedId;
  const selected = plans.find((p) => p.id === selectedId) ?? plans[0] ?? null;

  const selectPlan = (id: string) => {
    setInternalId(id);
    onSelectPlan?.(id);
  };

  const stepVisual = (step: PlanStep): StepVisualState => {
    const isActive = step.order === activeStepOrder;
    if (executionStatus === "complete") return "completed";
    if (executionStatus === "failed" && isActive) return "failed";
    if (executionStatus === "running" && isActive) return "executing";
    switch (step.status) {
      case "COMPLETED":
        return "completed";
      case "FAILED":
        return "failed";
      case "EXECUTING":
        return "executing";
      default:
        return "pending";
    }
  };

  return (
    <div className={cn("glass-panel rounded-2xl border border-white/10 p-5 space-y-5", className)}>
      {/* ------------------------- Header ------------------------- */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 via-brand-accent to-brand-cyan flex items-center justify-center shadow-glow">
            <Route className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white tracking-tight">Payment Plan</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-full">
                Phase 6
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {plans.length
                ? `${plans.length} candidate ${plans.length === 1 ? "strategy" : "strategies"} · deterministic blockchain steps`
                : "No execution plan yet"}
            </p>
          </div>
        </div>

        {selected && (
          <div className="flex items-center gap-2">
            {selected.isRecommended && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                <Zap className="h-3 w-3" /> RECOMMENDED
              </span>
            )}
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300">
              <Sparkles className="h-3 w-3 text-brand-300" />
              {plans[0] && selected && plans[0] === selected ? "Best score" : "Candidate"}
            </span>
          </div>
        )}
      </div>

      {!plans.length ? (
        /* ------------------------- Empty state ------------------------- */
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Route className="h-6 w-6 text-gray-500" />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-300">No candidate plans</p>
          <p className="mt-1 text-xs text-gray-500 max-w-xs">
            Describe a payment and run the planner to generate executable execution plans.
          </p>
        </div>
      ) : (
        <>
          {/* -------------------- Plan selector tabs -------------------- */}
          {plans.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {plans.map((plan, idx) => {
                const active = plan.id === selected?.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => selectPlan(plan.id)}
                    className={cn(
                      "shrink-0 px-3 py-2 rounded-xl border text-left transition-all",
                      active
                        ? "bg-brand-500/15 border-brand-500/50 shadow-glow"
                        : "bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-5 w-5 rounded-lg flex items-center justify-center text-[10px] font-extrabold",
                          active ? "bg-gradient-to-br from-brand-500 to-brand-accent text-white" : "bg-white/10 text-gray-400"
                        )}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div>
                        <div className={cn("text-[11px] font-bold leading-tight", active ? "text-white" : "text-gray-300")}>
                          {plan.name}
                        </div>
                        <div className="text-[9px] text-gray-500 leading-tight">
                          {plan.transactionCount} tx · {formatGas(plan.totalEstimatedGas)}
                        </div>
                      </div>
                      {plan.isRecommended && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 animate-step-pop" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <>
              {/* -------------------- Plan summary -------------------- */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <SummaryChip icon={Fuel} label="Est. Gas" value={formatGas(selected.totalEstimatedGas)} />
                <SummaryChip icon={Clock} label="Duration" value={formatDuration(selected.totalEstimatedDuration)} />
                <SummaryChip icon={Layers} label="Transactions" value={`${selected.transactionCount}`} />
                <SummaryChip
                  icon={ShieldCheck}
                  label="Risk"
                  value={`${selected.riskScore}/100`}
                  tone={selected.riskScore >= 50 ? "high" : selected.riskScore >= 25 ? "med" : "low"}
                />
              </div>

              {/* -------------------- Timeline -------------------- */}
              <ol className="relative">
                {selected.steps.map((step, i) => {
                  const state = stepVisual(step);
                  const Icon = ACTION_ICONS[step.actionType] ?? Zap;
                  const isLast = i === selected.steps.length - 1;
                  return (
                    <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {/* Connector line */}
                      {!isLast && (
                        <span
                          className={cn(
                            "absolute left-[15px] top-9 bottom-0 w-0.5 rounded-full",
                            state === "completed"
                              ? "bg-gradient-to-b from-emerald-500/70 to-brand-cyan/60"
                              : state === "executing"
                                ? "flow-line-dash"
                                : "bg-white/10"
                          )}
                          aria-hidden
                        />
                      )}

                      {/* Step node */}
                      <div
                        className={cn(
                          "relative z-10 mt-0.5 h-8 w-8 shrink-0 rounded-full border flex items-center justify-center transition-all",
                          state === "completed" &&
                            "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.35)]",
                          state === "executing" &&
                            "bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.35)] animate-exec-pulse",
                          state === "failed" && "bg-red-500/15 border-red-500/50 text-red-400",
                          state === "pending" && "bg-white/5 border-white/15 text-gray-500"
                        )}
                      >
                        {state === "executing" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : state === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 animate-step-pop" />
                        ) : state === "failed" ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>

                      {/* Step content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                            Step {step.order}
                          </span>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide border",
                              state === "executing"
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                                : state === "completed"
                                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                  : state === "failed"
                                    ? "bg-red-500/15 border-red-500/40 text-red-400"
                                    : "bg-white/5 border-white/10 text-gray-400"
                            )}
                          >
                            {step.actionType}
                          </span>
                          <span
                            className={cn(
                              "flex items-center gap-1 text-[9px] font-bold",
                              state === "executing"
                                ? "text-amber-300"
                                : state === "completed"
                                  ? "text-emerald-300"
                                  : state === "failed"
                                    ? "text-red-400"
                                    : "text-gray-500"
                            )}
                          >
                            {state === "executing" && "EXECUTING"}
                            {state === "completed" && "COMPLETED"}
                            {state === "failed" && "FAILED"}
                            {state === "pending" && "PENDING"}
                          </span>
                        </div>

                        <p
                          className={cn(
                            "text-sm font-semibold mt-0.5",
                            state === "pending" ? "text-gray-300" : "text-white"
                          )}
                        >
                          {step.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{step.description}</p>

                        {/* Step meta chips */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <MetaChip label="Chain" value={step.sourceChain?.name ?? "—"} />
                          <MetaChip label="Token" value={step.tok} />
                          <MetaChip label="Gas" value={formatGas(step.estimatedGas)} />
                          <MetaChip label="Est." value={formatDuration(step.estimatedDuration)} />
                          <MetaChip label="Deps" value={shortDeps(step.deps)} />
                          {step.destinationChain && (
                            <MetaChip label="→" value={step.destinationChain.name} accent />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* -------------------- Reasoning -------------------- */}
              {selected.reasoning.length > 0 && (
                <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Why this plan
                  </div>
                  {selected.reasoning.map((r, i) => (
                    <p key={i} className="text-xs text-gray-300 flex gap-1.5">
                      <span className="text-brand-400 shrink-0">•</span>
                      {r}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SummaryChip({
  icon: Icon,
  label,
  value,
  tone = "low",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "low" | "med" | "high";
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 flex items-center gap-2.5">
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          tone === "high"
            ? "bg-red-500/10 text-red-400"
            : tone === "med"
              ? "bg-amber-500/10 text-amber-400"
              : "bg-brand-500/10 text-brand-300"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
        <div className="text-[13px] font-extrabold text-white truncate">{value}</div>
      </div>
    </div>
  );
}

function MetaChip({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1",
        accent
          ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
          : "bg-white/5 border-white/10 text-gray-400"
      )}
    >
      <span className="text-gray-500">{label}</span> {value}
    </span>
  );
}
