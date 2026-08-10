"use client";

import React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ReceiptText, ExternalLink } from "lucide-react";
import type { RecentPayment, PaymentStatus } from "@/lib/dashboard/types";
import { formatCurrency, formatAddress } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";
import { BlockSkeleton, TextSkeleton } from "@/components/dashboard/ui";
import { SectionEmptyState } from "@/components/dashboard/states";

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  COMPLETED: { label: "Completed", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
  PENDING_APPROVAL: { label: "Awaiting Approval", cls: "text-brand-cyan bg-brand-cyan/10 border-brand-cyan/30", dot: "bg-brand-cyan" },
  PLANNING: { label: "Planning", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400" },
  DRAFT: { label: "Draft", cls: "text-gray-400 bg-white/5 border-white/10", dot: "bg-gray-400" },
  APPROVED: { label: "Approved", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400" },
  EXECUTING: { label: "Processing", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400" },
  FAILED: { label: "Failed", cls: "text-red-300 bg-red-500/10 border-red-500/30", dot: "bg-red-400" },
  CANCELLED: { label: "Cancelled", cls: "text-gray-500 bg-white/5 border-white/10", dot: "bg-gray-500" },
};

function statusMeta(status: PaymentStatus) {
  return STATUS_META[status] ?? STATUS_META.DRAFT;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? `Today, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PaymentActivity({
  payments,
  isLoading,
}: {
  payments: RecentPayment[] | null;
  isLoading?: boolean;
}) {
  const { mask } = usePrivacy();

  if (isLoading || !payments) {
    return (
      <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <BlockSkeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <TextSkeleton className="h-3 w-40" />
              <TextSkeleton className="h-2.5 w-24" />
            </div>
            <TextSkeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-brand-cyan" />
          <h3 className="text-[13px] font-extrabold text-gray-100 tracking-tight">Payment Activity</h3>
          <span className="text-[10px] text-gray-500">{payments.length} recent</span>
        </div>
        <Link
          href="/payments"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-cyan hover:text-brand-300"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {payments.length === 0 ? (
        <div className="px-5 pb-5">
          <SectionEmptyState
            title="No payments yet"
            description="Issue your first business payment through the assistant above — it will appear here."
          />
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {payments.map((p) => {
            const meta = statusMeta(p.status);
            const amount = `${p.currency} ${p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
            return (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
                <span className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500/25 to-mint-300/25 border border-white/10 flex items-center justify-center text-[13px] font-extrabold text-brand-cyan shrink-0">
                  {p.recipientName.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-bold text-gray-100 truncate">
                      {p.recipientName}
                    </span>
                    {p.explorerUrl && (
                      <a href={p.explorerUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-brand-cyan">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                    {p.purpose}
                    <span className="text-gray-600">·</span>
                    <span className="font-mono">{p.chain}</span>
                    <span className="text-gray-600">·</span>
                    <span className="tabular-nums">{timeLabel(p.createdAt)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-1 text-[12.5px] font-extrabold text-gray-100 tabular-nums">
                    <ArrowDownLeft className="h-3 w-3 text-brand-cyan" />
                    {mask(amount)}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase mt-1 ${meta.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <ArrowDownLeft className="h-3 w-3" /> Net shown in USDC-equivalent
        </span>
        <span className="font-mono">{payments.length} payments</span>
      </div>
    </div>
  );
}
