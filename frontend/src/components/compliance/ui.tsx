"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, Ban, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceDecision, ComplianceRiskLevel, ScreeningVerdict } from "@/lib/compliance/types";

// =============================================================================
// Shared UI primitives for the DPT Treasury Compliance Layer.
// GREEN = PASS/ALLOW · YELLOW = REVIEW · RED = BLOCK/FAIL — consistent across
// every compliance panel so the states are always recognisable.
// =============================================================================

export type Tone = "green" | "yellow" | "red" | "gray" | "blue";

export const TONE_STYLES: Record<Tone, { badge: string; dot: string; text: string; bg: string; border: string }> = {
  green: {
    badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  yellow: {
    badge: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    dot: "bg-amber-400",
    text: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  red: {
    badge: "text-red-300 bg-red-500/10 border-red-500/30",
    dot: "bg-red-400",
    text: "text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
  gray: {
    badge: "text-gray-300 bg-white/5 border-white/10",
    dot: "bg-gray-400",
    text: "text-gray-400",
    bg: "bg-white/5",
    border: "border-white/10",
  },
  blue: {
    badge: "text-brand-cyan bg-brand-cyan/10 border-brand-cyan/30",
    dot: "bg-brand-cyan",
    text: "text-brand-cyan",
    bg: "bg-brand-cyan/10",
    border: "border-brand-cyan/30",
  },
};

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide",
        TONE_STYLES[tone].badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", TONE_STYLES[tone].dot)} />
      {children}
    </span>
  );
}

export const DECISION_META: Record<ComplianceDecision, { tone: Tone; icon: LucideIcon; label: string }> = {
  ALLOW: { tone: "green", icon: ShieldCheck, label: "Allow" },
  REVIEW: { tone: "yellow", icon: ShieldAlert, label: "Review" },
  BLOCK: { tone: "red", icon: Ban, label: "Block" },
};

export function DecisionBadge({ decision, className }: { decision: ComplianceDecision; className?: string }) {
  const meta = DECISION_META[decision];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide",
        TONE_STYLES[meta.tone].badge,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export const RISK_META: Record<ComplianceRiskLevel, { tone: Tone; label: string }> = {
  LOW: { tone: "green", label: "Low" },
  MEDIUM: { tone: "yellow", label: "Medium" },
  HIGH: { tone: "red", label: "High" },
  CRITICAL: { tone: "red", label: "Critical" },
};

export function RiskLevelBadge({ level, score, className }: { level: ComplianceRiskLevel; score?: number; className?: string }) {
  const meta = RISK_META[level];
  return (
    <ToneBadge tone={meta.tone} className={className}>
      {meta.label}
      {typeof score === "number" && <span className="opacity-70 font-semibold tabular-nums">· {Math.round(score)}</span>}
    </ToneBadge>
  );
}

export const SCREENING_META: Record<ScreeningVerdict, { tone: Tone; label: string }> = {
  PASS: { tone: "green", label: "Pass" },
  REVIEW: { tone: "yellow", label: "Review" },
  BLOCK: { tone: "red", label: "Block" },
};

export function ScreeningBadge({ verdict, className }: { verdict: ScreeningVerdict; className?: string }) {
  const meta = SCREENING_META[verdict];
  return (
    <ToneBadge tone={meta.tone} className={className}>
      {meta.label}
    </ToneBadge>
  );
}

/** Simple 0-100 risk bar coloured by tone. */
export function RiskBar({ score, tone, className }: { score: number; tone?: Tone; className?: string }) {
  const resolved: Tone = tone ?? (score <= 29 ? "green" : score <= 59 ? "yellow" : score <= 79 ? "red" : "red");
  const meta = TONE_STYLES[resolved];
  return (
    <div className={cn("h-1.5 rounded-full bg-white/5 overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all", resolved === "green" ? "bg-emerald-500" : resolved === "yellow" ? "bg-amber-500" : "bg-red-500")}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}
