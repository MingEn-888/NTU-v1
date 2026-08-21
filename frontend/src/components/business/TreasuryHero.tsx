"use client";

import React from "react";
import Link from "next/link";
import {
  Plus,
  Landmark,
  ArrowUpRight,
  CircleDollarSign,
  Fuel,
  Clock3,
  Wallet,
  Sparkles,
} from "lucide-react";
import type { TreasurySummary, ApprovalItem } from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/utils";
import { usePrivacy } from "@/lib/privacy";

interface TreasuryHeroProps {
  treasury: TreasurySummary | null;
  approvals?: ApprovalItem[] | null;
  isLoading?: boolean;
}

function Skeleton() {
  return (
    <div className="rounded-3xl glass-panel border border-white/10 p-6 md:p-8 space-y-5 overflow-hidden">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-10 w-56" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Premium treasury overview — the "balance card" of a business account.
 * Gradient surface, Total / Available / Pending / Native gas, privacy-aware.
 */
export function TreasuryHero({ treasury, approvals, isLoading }: TreasuryHeroProps) {
  const { hidden, mask } = usePrivacy();

  if (isLoading || !treasury) return <Skeleton />;

  const pendingUsd = (approvals ?? []).reduce((s, a) => s + (a.netAmountUsdc || 0), 0);

  const stat = (
    label: string,
    value: string,
    icon: React.ElementType,
    tone: string,
    sub?: string
  ) => (
    <div className="rounded-2xl bg-black/20 border border-white/10 px-3.5 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
        <span className={tone}>{React.createElement(icon, { className: "h-3 w-3" })}</span>
        {label}
      </div>
      <div className="text-[15px] md:text-[17px] font-extrabold text-on-accent tabular-nums mt-1">
        {mask(value)}
      </div>
      {sub && <div className="text-[9px] text-white/60 mt-0.5">{mask(sub)}</div>}
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-glass">
      {/* Gradient surface — purple → mint (light) / deep purple (dark) */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-accent to-mint-400 opacity-95" />
      <div className="absolute -top-20 -right-16 w-72 h-72 bg-mint-200/40 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-white/10 rounded-full blur-3xl" />

      <div className="relative p-6 md:p-8 space-y-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-on-accent">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                  Total Treasury
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-400/20 border border-emerald-300/40 text-[9px] font-bold uppercase text-emerald-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="text-3xl md:text-4xl font-extrabold text-on-accent tracking-tight tabular-nums mt-1">
                {mask(formatCurrency(treasury.totalValueUsd))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/operations"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-white text-[12px] font-extrabold shadow-lg hover:bg-brand-500/20 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Funds
            </Link>
            <Link
              href="/operations"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 text-on-accent text-[12px] font-extrabold hover:bg-white/25 transition-colors"
            >
              View Treasury <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stat(
            "Available",
            formatCurrency(treasury.availableUsdc),
            Wallet,
            "text-emerald-200",
            "USDC spendable"
          )}
          {stat(
            "Pending payments",
            formatCurrency(pendingUsd),
            Clock3,
            "text-amber-200",
            "awaiting approval"
          )}
          {stat(
            `Native gas · ${treasury.nativeSymbol || "POL"}`,
            `${treasury.nativeGasBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${treasury.nativeSymbol || "POL"}`,
            Fuel,
            "text-brand-200"
          )}
          {stat(
            "Preferred chain",
            treasury.preferredChain?.toLowerCase() === "polygon"
              ? "Polygon"
              : (treasury.preferredChain || "Polygon").toLowerCase(),
            Sparkles,
            "text-mint-200",
            "routing default"
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[10px] text-white/70">
            <CircleDollarSign className="h-3.5 w-3.5" />
            <span>
              {treasury.supportedChains?.length ?? 0} chains ·{" "}
              {hidden ? "amounts hidden" : "balances in USD (indicative)"}
            </span>
          </div>
          <span className="text-[10px] text-white/70 font-mono truncate max-w-[220px]">
            {hidden ? "••••••••" : treasury.walletAddress || "Treasury vault"}
          </span>
        </div>
      </div>
    </div>
  );
}
