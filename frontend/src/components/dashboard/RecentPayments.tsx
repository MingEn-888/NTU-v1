"use client";

import React from "react";
import { ReceiptText, ArrowDownLeft, ExternalLink } from "lucide-react";
import type { RecentPayment } from "@/lib/dashboard/types";
import { formatCurrency, formatAddress } from "@/lib/utils";
import { StatusPill, SectionHeader, BlockSkeleton, TextSkeleton } from "./ui";
import { SectionEmptyState } from "./states";

// =============================================================================
// Recent Payments — the treasury ledger of settled + in-flight operations.
// =============================================================================

const RECENT_COLUMNS = ["Recipient", "Amount", "Purpose", "Net", "Status", "Gas", "Date"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentPayments({
  payments,
  isLoading,
}: {
  payments: RecentPayment[] | null;
  isLoading?: boolean;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-5 pt-5">
        <SectionHeader
          icon={ReceiptText}
          title="Recent Payments"
          subtitle="Latest treasury operations"
          action={
            <span className="text-[10px] font-bold text-gray-500 tabular-nums">
              {payments?.length ?? 0} shown
            </span>
          }
        />
      </div>

      {isLoading || !payments ? (
        <div className="px-5 pb-5 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
              <BlockSkeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <TextSkeleton className="h-3 w-40" />
                <TextSkeleton className="h-2.5 w-24" />
              </div>
              <TextSkeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="p-5">
          <SectionEmptyState
            title="No payments yet"
            description="Issue your first business payment through the AI agent above — it will appear here once approved."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/8">
                {RECENT_COLUMNS.map((c) => (
                  <th
                    key={c}
                    className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payments.map((p) => (
                <tr key={p.id} className="group hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-500/25 to-brand-accent/25 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="text-[12px] font-extrabold text-brand-200">
                          {p.recipientName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-bold text-white truncate max-w-[180px]">
                          {p.recipientName}
                        </div>
                        <div className="text-[10px] text-gray-600 font-mono flex items-center gap-1">
                          {formatAddress(p.recipientAddress)}
                          {p.explorerUrl && (
                            <a
                              href={p.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-400 hover:text-brand-300"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12.5px] font-bold text-white tabular-nums whitespace-nowrap">
                    {p.currency === "USDC" || p.currency === "USDT"
                      ? `${p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${p.currency}`
                      : `${p.currency} ${p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-gray-400 max-w-[220px] truncate">
                    {p.purpose}
                  </td>
                  <td className="px-5 py-3">
                    <div className="inline-flex items-center gap-1 text-[12px] font-bold text-brand-cyan tabular-nums">
                      <ArrowDownLeft className="h-3 w-3" />
                      {formatCurrency(p.netAmountUsdc)}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-[11.5px] text-gray-400 tabular-nums whitespace-nowrap">
                    {p.gasCostUsd > 0 ? formatCurrency(p.gasCostUsd) : "—"}
                  </td>
                  <td className="px-5 py-3 text-[11.5px] text-gray-500 tabular-nums whitespace-nowrap">
                    {formatDate(p.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
