"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search, ReceiptText, Filter, ArrowDownLeft, ExternalLink, SlidersHorizontal } from "lucide-react";
import type { DashboardData, PaymentStatus } from "@/lib/dashboard/types";
import { formatCurrency, formatAddress } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";
import { StatusPill } from "@/components/dashboard/ui";
import { DashboardSkeleton, DemoBanner, SectionErrorState, SectionEmptyState } from "@/components/dashboard/states";
import { useWallet } from "@/hooks/useWallet";
import { useTreasury } from "@/hooks/useTreasury";

const DEFAULT_BUSINESS_ID = "b2000000-0000-0000-0000-000000000001";

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "ALL" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Awaiting Approval", value: "PENDING_APPROVAL" },
  { label: "Pending", value: "PENDING" },
  { label: "Failed", value: "FAILED" },
];

function shortId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9-]/g, "");
  return clean.length <= 14 ? clean : clean.slice(0, 8).toUpperCase() + "…";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Full payment history — search + status/method filters, premium table. */
export function PaymentHistory() {
  const wallet = useWallet();
  const treasury = useTreasury(wallet.address, wallet.chainId, wallet.balance, wallet.tokenBalances);
  const { mask } = usePrivacy();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [chain, setChain] = useState("ALL");

  const businessId = useMemo(
    () => treasury.businessProfile?.id || DEFAULT_BUSINESS_ID,
    [treasury.businessProfile]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard?businessId=${encodeURIComponent(businessId)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Dashboard request failed (${res.status})`);
        const payload = (await res.json()) as DashboardData;
        if (!cancelled) setData(payload);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load payment history.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const chains = useMemo(() => {
    const set = new Set<string>((data?.recentPayments ?? []).map((p) => p.chain));
    return Array.from(set);
  }, [data]);

  const filtered = useMemo(() => {
    let list = data?.recentPayments ?? [];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.recipientName.toLowerCase().includes(q) ||
          p.purpose.toLowerCase().includes(q) ||
          p.recipientAddress.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }
    if (status !== "ALL") {
      list = list.filter((p) => {
        if (status === "PENDING") {
          return ["PLANNING", "DRAFT", "APPROVED", "EXECUTING"].includes(p.status);
        }
        return p.status === status;
      });
    }
    if (chain !== "ALL") list = list.filter((p) => p.chain === chain);
    return list;
  }, [data, query, status, chain]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-6 border border-white/10 shadow-glass">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-accent to-mint-300 flex items-center justify-center shadow-glow">
            <ReceiptText className="h-6 w-6 text-on-accent" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-100 tracking-tight">
              Payment History
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Full treasury ledger — filter by status, payment method or recipient.
            </p>
          </div>
        </div>
      </div>

      {data?.isFallback && <DemoBanner reason={data.fallbackReason} />}

      {loading ? (
        <DashboardSkeleton />
      ) : error || !data ? (
        <SectionErrorState
          title="Payment history unavailable"
          description={error || "The treasury store didn't respond. Try refreshing."}
          onRetry={() => window.location.reload()}
        />
      ) : (
        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
          {/* Filters bar */}
          <div className="p-4 border-b border-white/10 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipient, purpose, address…"
                className="w-full pl-9 pr-3 py-2 rounded-xl glass-input border text-[13px] placeholder:text-gray-500 focus:outline-none focus:border-brand-500/50"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <SlidersHorizontal className="h-4 w-4 text-gray-500 hidden sm:block" />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter by status"
                className="px-3 py-2 rounded-xl glass-input border text-[12px] font-semibold focus:outline-none focus:border-brand-500/50"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                aria-label="Filter by payment method"
                className="px-3 py-2 rounded-xl glass-input border text-[12px] font-semibold focus:outline-none focus:border-brand-500/50"
              >
                <option value="ALL">All methods</option>
                {chains.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-gray-500 tabular-nums">
                {filtered.length} of {(data.recentPayments ?? []).length}
              </span>
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="p-6">
              <SectionEmptyState
                title="No matching payments"
                description="Try adjusting your search or filters — or create a new payment from the dashboard."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Payment", "Recipient", "Amount", "Purpose", "Rail", "Net", "Gas", "Status", "Date"].map((c) => (
                      <th key={c} className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((p) => (
                    <tr key={p.id} className="group hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3 text-[11px] font-mono text-gray-500 whitespace-nowrap">
                        {shortId(p.id)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500/25 to-mint-300/25 border border-white/10 flex items-center justify-center text-[11px] font-extrabold text-brand-cyan shrink-0">
                            {p.recipientName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-bold text-gray-100 truncate max-w-[140px]">
                              {p.recipientName}
                            </div>
                            <div className="text-[10px] text-gray-600 font-mono flex items-center gap-1">
                              {formatAddress(p.recipientAddress)}
                              {p.explorerUrl && (
                                <a href={p.explorerUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-brand-cyan">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[12.5px] font-bold text-gray-100 tabular-nums whitespace-nowrap">
                        {mask(`${p.currency} ${p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-gray-400 max-w-[200px] truncate">{p.purpose}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 text-[9px] font-bold text-brand-cyan uppercase">
                          {p.chain}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="inline-flex items-center gap-1 text-[12px] font-bold text-brand-cyan tabular-nums">
                          <ArrowDownLeft className="h-3 w-3" />
                          {mask(formatCurrency(p.netAmountUsdc))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[11.5px] text-gray-400 tabular-nums whitespace-nowrap">
                        {p.gasCostUsd > 0 ? mask(formatCurrency(p.gasCostUsd)) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={p.status} />
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

          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filtered live from the treasury store
            </span>
            <span>{filtered.length} payments</span>
          </div>
        </div>
      )}
    </div>
  );
}
