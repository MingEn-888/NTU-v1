"use client";

import React from "react";
import {
  Landmark,
  Wallet,
  CircleDollarSign,
  Fuel,
  Network,
  ArrowUpRight,
} from "lucide-react";
import type { TreasurySummary } from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/utils";
import { BlockSkeleton } from "./ui";

// =============================================================================
// Treasury Overview — the funding position the payment agent draws from.
// Total value / spendable USDC / native gas / supported chains.
// =============================================================================

export function TreasuryOverview({
  treasury,
  isLoading,
}: {
  treasury: TreasurySummary | null;
  isLoading?: boolean;
}) {
  if (isLoading || !treasury) {
    return (
      <div className="glass-panel rounded-2xl border border-white/10 p-6">
        <BlockSkeleton className="h-20 w-40" />
        <BlockSkeleton className="h-16 mt-6" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[0, 1, 2].map((i) => (
            <BlockSkeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-16 w-56 h-56 bg-brand-cyan/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-accent flex items-center justify-center shadow-glow">
              <Landmark className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Corporate Treasury
              </div>
              <div className="text-[14px] font-extrabold text-white tracking-tight leading-tight">
                {treasury.businessName}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            {treasury.isWalletAssociated ? "Wallet linked" : "Read-only"}
          </span>
        </div>

        {/* Total value */}
        <div className="mt-6 p-5 rounded-2xl bg-black/40 border border-white/5 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-4 opacity-[0.04]">
            <CircleDollarSign className="h-32 w-32 text-white" />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Total Treasury Value
          </div>
          <div className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1 tabular-nums">
            {formatCurrency(treasury.totalValueUsd)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-brand-cyan mt-2">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>
              Preferred settlement chain:{" "}
              <strong className="text-white capitalize">{treasury.preferredChain}</strong>
            </span>
          </div>
        </div>

        {/* Key balances */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <BalanceBlock
            icon={<CircleDollarSign className="h-4 w-4" />}
            accent="text-brand-cyan bg-brand-cyan/10 border-brand-cyan/25"
            label="Available USDC"
            value={formatCurrency(treasury.availableUsdc)}
            sub="Spendable now"
          />
          <BalanceBlock
            icon={<Fuel className="h-4 w-4" />}
            accent="text-brand-accent bg-brand-accent/10 border-brand-accent/25"
            label="Native Gas Balance"
            value={`${treasury.nativeGasBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${treasury.nativeSymbol}`}
            sub={`On ${treasury.preferredChain}`}
          />
          <BalanceBlock
            icon={<Network className="h-4 w-4" />}
            accent="text-brand-400 bg-brand-500/10 border-brand-500/25"
            label="Supported Chains"
            value={String(treasury.supportedChains.length)}
            sub="Networks in route graph"
          />
        </div>

        {/* Supported chains */}
        <div className="mt-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            Supported chains
          </div>
          <div className="flex flex-wrap gap-2">
            {treasury.supportedChains.map((c) => {
              const active = c.name.toLowerCase() === treasury.preferredChain;
              return (
                <span
                  key={c.id}
                  className={
                    active
                      ? "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-brand-500/20 border border-brand-500/40"
                      : "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 bg-white/5 border border-white/10"
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
                  {c.label}
                  <span className="text-[9px] opacity-70 tabular-nums">{c.symbol}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceBlock({
  icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-3.5 rounded-xl bg-black/25 border border-white/5 hover:border-white/10 transition-colors">
      <div className={`h-7 w-7 rounded-lg border flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mt-2.5">{label}</div>
      <div className="text-[15px] font-extrabold text-white tracking-tight mt-0.5 truncate tabular-nums">
        {value}
      </div>
      <div className="text-[10px] text-gray-600 font-medium capitalize">{sub}</div>
    </div>
  );
}

export function TreasuryBalanceIcon() {
  return <Wallet className="h-4 w-4" />;
}
