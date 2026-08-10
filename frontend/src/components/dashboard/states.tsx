"use client";

import React from "react";
import {
  AlertTriangle,
  Boxes,
  Inbox,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { BlockSkeleton } from "./ui";

// =============================================================================
// Reusable loading / empty / error states for every dashboard section.
// =============================================================================

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Command bar */}
      <BlockSkeleton className="h-36" />
      {/* Treasury + operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BlockSkeleton className="h-72 lg:col-span-2" />
        <BlockSkeleton className="h-72" />
      </div>
      {/* Optimization strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <BlockSkeleton key={i} className="h-28" />
        ))}
      </div>
      {/* Route analytics */}
      <BlockSkeleton className="h-80" />
      {/* Recents + approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BlockSkeleton className="h-96 lg:col-span-2" />
        <BlockSkeleton className="h-96" />
      </div>
    </div>
  );
}

export function SectionEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
      <div className="h-12 w-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-[13px] font-bold text-white">{title}</div>
      <p className="text-[12px] text-gray-500 max-w-xs mt-1.5 leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionErrorState({
  title = "Couldn't load this section",
  description = "The treasury store didn't respond. Check connectivity and try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04]">
      <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center mb-3">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="text-[13px] font-bold text-white">{title}</div>
      <p className="text-[12px] text-gray-500 max-w-xs mt-1.5 leading-relaxed">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white bg-brand-600 hover:bg-brand-500 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

export function LiveBadge({ label = "Live operations" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
      </span>
      {label}
    </span>
  );
}

export function DemoBanner({ reason }: { reason?: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/8 border border-amber-500/25 text-amber-200/90 text-[12px] leading-relaxed">
      <Boxes className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
      <span>
        <strong className="font-bold text-amber-300">Demo data</strong>
        {reason ? ` — ${reason}. ` : " "}
        Numbers are illustrative; connect Supabase to see live treasury activity.
      </span>
    </div>
  );
}
