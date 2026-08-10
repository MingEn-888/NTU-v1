"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentStatus, RiskLevel } from "@/lib/dashboard/types";

// =============================================================================
// Shared UI primitives for the IBAP dashboard — reusable across every section
// so the whole surface keeps one consistent fintech design language.
// =============================================================================

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center shrink-0">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-white tracking-tight leading-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// --- Metric / stat card -------------------------------------------------------

const ACCENTS = {
  brand: "text-brand-400 bg-brand-500/15 border-brand-500/25",
  cyan: "text-brand-cyan bg-brand-cyan/10 border-brand-cyan/25",
  accent: "text-brand-accent bg-brand-accent/15 border-brand-accent/25",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  amber: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  rose: "text-rose-400 bg-rose-500/10 border-rose-500/25",
  slate: "text-gray-300 bg-white/5 border-white/10",
} as const;

export type AccentKey = keyof typeof ACCENTS;

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "brand",
  trend,
  trendUp = true,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: AccentKey;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <div className="glass-card rounded-2xl border border-white/7 p-4 relative overflow-hidden group">
      <div className="flex items-start justify-between">
        <div className={cn("h-9 w-9 rounded-xl border flex items-center justify-center", ACCENTS[accent])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md",
              trendUp ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
            )}
          >
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend}
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
        <div className="text-xl md:text-2xl font-extrabold text-white tracking-tight mt-0.5 tabular-nums">
          {value}
        </div>
        {sub && <div className="text-[11px] text-gray-500 mt-1 font-medium">{sub}</div>}
      </div>
    </div>
  );
}

// --- Status pill --------------------------------------------------------------

const STATUS_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  DRAFT: { label: "Draft", cls: "text-gray-400 bg-white/5 border-white/10", dot: "bg-gray-400" },
  PLANNING: { label: "Planning", cls: "text-brand-cyan bg-brand-cyan/10 border-brand-cyan/25", dot: "bg-brand-cyan" },
  PENDING_APPROVAL: { label: "Pending", cls: "text-amber-400 bg-amber-500/10 border-amber-500/25", dot: "bg-amber-400" },
  APPROVED: { label: "Approved", cls: "text-brand-400 bg-brand-500/10 border-brand-500/25", dot: "bg-brand-400" },
  EXECUTING: { label: "Processing", cls: "text-violet-400 bg-violet-500/10 border-violet-500/25", dot: "bg-violet-400" },
  SUBMITTED: { label: "Processing", cls: "text-violet-400 bg-violet-500/10 border-violet-500/25", dot: "bg-violet-400" },
  COMPLETED: { label: "Completed", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25", dot: "bg-emerald-400" },
  CONFIRMED: { label: "Completed", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25", dot: "bg-emerald-400" },
  FAILED: { label: "Failed", cls: "text-rose-400 bg-rose-500/10 border-rose-500/25", dot: "bg-rose-400" },
  CANCELLED: { label: "Cancelled", cls: "text-gray-500 bg-white/5 border-white/10", dot: "bg-gray-500" },
  REJECTED: { label: "Rejected", cls: "text-gray-500 bg-white/5 border-white/10", dot: "bg-gray-500" },
};

export function StatusPill({ status }: { status: PaymentStatus | string }) {
  const s = STATUS_STYLE[(status || "").toUpperCase()] ?? STATUS_STYLE.DRAFT;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border",
        s.cls
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

// --- Risk badge ---------------------------------------------------------------

const RISK_STYLE: Record<RiskLevel, string> = {
  LOW: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  HIGH: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border",
        RISK_STYLE[level]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level}
      {typeof score === "number" && <span className="opacity-70 font-semibold">· {score}</span>}
    </span>
  );
}

// --- Skeleton -----------------------------------------------------------------

export function BlockSkeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-2xl bg-white/5 border border-white/5 animate-pulse", className)} />;
}

export function TextSkeleton({ className }: { className?: string }) {
  return <div className={cn("rounded bg-white/10 animate-pulse", className)} />;
}
