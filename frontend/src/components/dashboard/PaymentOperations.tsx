"use client";

import React from "react";
import {
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import type { PaymentOperationCounts } from "@/lib/dashboard/types";
import { BlockSkeleton } from "./ui";

// =============================================================================
// Payment Operations — live pipeline snapshot: pending approvals, processing,
// completed and failed operations.
// =============================================================================

export function PaymentOperations({
  counts,
  isLoading,
}: {
  counts: PaymentOperationCounts | null;
  isLoading?: boolean;
}) {
  if (isLoading || !counts) {
    return (
      <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4">
        <BlockSkeleton className="h-4 w-36" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <BlockSkeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      key: "pending",
      label: "Pending Approvals",
      value: counts.pendingApprovals,
      sub: "Awaiting human review",
      icon: ClipboardCheck,
      accent: "text-amber-400 bg-amber-500/10 border-amber-500/30",
      bar: "bg-amber-400",
    },
    {
      key: "processing",
      label: "Payments Processing",
      value: counts.processing,
      sub: "Executing on-chain",
      icon: Loader2,
      accent: "text-violet-400 bg-violet-500/10 border-violet-500/30",
      bar: "bg-violet-400",
    },
    {
      key: "completed",
      label: "Completed Payments",
      value: counts.completed,
      sub: "Settled & confirmed",
      icon: CheckCircle2,
      accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
      bar: "bg-emerald-400",
    },
    {
      key: "failed",
      label: "Failed Payments",
      value: counts.failed,
      sub: "Require investigation",
      icon: XCircle,
      accent: "text-rose-400 bg-rose-500/10 border-rose-500/30",
      bar: "bg-rose-400",
    },
  ];

  const total = Math.max(counts.total, 1);

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400">
            <ArrowRight className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-white leading-tight">Payment Operations</div>
            <div className="text-[10px] text-gray-500 font-medium">Pipeline this period</div>
          </div>
        </div>
        <span className="text-[10px] font-bold text-gray-500 tabular-nums">{counts.total} total</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const pct = Math.round((c.value / total) * 100);
          return (
            <div
              key={c.key}
              className="p-3.5 rounded-xl bg-black/25 border border-white/5 hover:border-white/10 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center ${c.accent}`}>
                  <Icon
                    className={`h-4 w-4 ${c.key === "processing" ? "animate-spin" : ""}`}
                  />
                </div>
                <span className="text-[9px] font-bold text-gray-600 tabular-nums">{pct}%</span>
              </div>
              <div className="text-2xl font-extrabold text-white mt-2.5 tabular-nums">{c.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">
                {c.label}
              </div>
              <div className="text-[9px] text-gray-600 font-medium">{c.sub}</div>
              <div className="h-0.5 w-full rounded-full bg-white/5 mt-2.5 overflow-hidden">
                <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
