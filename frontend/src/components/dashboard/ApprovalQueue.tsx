"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowUpRight, Clock, Fuel } from "lucide-react";
import type { ApprovalItem } from "@/lib/dashboard/types";
import { formatCurrency, formatAddress } from "@/lib/utils";
import { RiskBadge, SectionHeader, BlockSkeleton, TextSkeleton } from "./ui";
import { SectionEmptyState } from "./states";

// =============================================================================
// Approval Queue — payments that require explicit human approval before any
// funds move. Each card surfaces recipient, amount, route, risk and savings.
// =============================================================================

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ApprovalQueue({
  approvals,
  isLoading,
}: {
  approvals: ApprovalItem[] | null;
  isLoading?: boolean;
}) {
  const router = useRouter();

  const review = (item: ApprovalItem) => {
    // Deep-link into the Payment Operations console, which hosts the Phase 10
    // human approval gate, with the review context attached.
    router.push(
      `/operations?review=${encodeURIComponent(item.id)}&prompt=${encodeURIComponent(
        `Review pending payout to ${item.recipientName} for ${item.purpose}.`
      )}`
    );
  };

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <SectionHeader
        icon={ShieldCheck}
        title="Approval Queue"
        subtitle="Human sign-off required"
        action={
          approvals && approvals.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
              <Clock className="h-3 w-3" />
              {approvals.length} waiting
            </span>
          ) : undefined
        }
      />

      {isLoading || !approvals ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-white/7 p-4">
              <div className="flex items-center justify-between">
                <BlockSkeleton className="h-9 w-9 rounded-full" />
                <BlockSkeleton className="h-5 w-16" />
              </div>
              <div className="mt-3 space-y-2">
                <TextSkeleton className="h-3.5 w-44" />
                <TextSkeleton className="h-3 w-32" />
                <TextSkeleton className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <SectionEmptyState
          icon={ShieldCheck}
          title="Queue is clear"
          description="No payments awaiting review. New operations will land here when they need your sign-off."
        />
      ) : (
        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-0.5">
          {approvals.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-white/7 bg-white/[0.02] hover:border-brand-500/30 hover:bg-brand-500/[0.04] transition-colors p-4"
            >
              {/* Recipient + amount */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-500/25 to-brand-accent/25 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-[12px] font-extrabold text-brand-200">
                      {a.recipientName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold text-white truncate max-w-[150px]">
                      {a.recipientName}
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono">
                      {formatAddress(a.recipientAddress)}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[15px] font-extrabold text-white tabular-nums">
                    {a.currency === "USDC"
                      ? `${a.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                      : `${a.currency} ${a.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  </div>
                  <div className="text-[10px] text-brand-cyan font-bold tabular-nums">
                    {formatCurrency(a.netAmountUsdc)} net
                  </div>
                </div>
              </div>

              {/* Purpose + meta */}
              <div className="mt-2.5 text-[11px] text-gray-400 line-clamp-1">{a.purpose}</div>
              {a.invoiceRef && (
                <div className="mt-0.5 text-[10px] text-gray-600 font-semibold">
                  Ref: {a.invoiceRef}
                </div>
              )}

              {/* Route · risk · savings */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-gray-300">
                  <ArrowUpRight className="h-3 w-3 text-brand-cyan" />
                  {a.routeName} · {a.chain}
                </span>
                <RiskBadge level={a.riskLevel} score={a.riskScore} />
                {a.savingsUsd > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-300">
                    <Fuel className="h-3 w-3" />
                    saves {formatCurrency(a.savingsUsd)}
                  </span>
                )}
              </div>

              {/* Review CTA */}
              <div className="mt-3.5 flex items-center justify-between">
                <span className="text-[10px] text-gray-600 font-medium">{timeAgo(a.createdAt)}</span>
                <button
                  onClick={() => review(a)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold text-on-accent bg-gradient-to-r from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-600 transition-colors shadow-glow"
                >
                  Review
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
