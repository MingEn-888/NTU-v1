"use client";

import React, { useEffect, useState } from "react";
import { Landmark, TrendingUp, TrendingDown, Droplets, AlertTriangle, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortfolioSnapshot } from "@/lib/compliance/portfolio";
import { changeLabel, priceOf } from "@/lib/compliance/portfolio";
import { RiskLevelBadge, RiskBar, ToneBadge, TONE_STYLES } from "./ui";

// =============================================================================
// PortfolioMonitor — DPT Portfolio Monitoring.
// Total treasury value, asset allocation %, price/24h change/volatility/
// liquidity per asset, stablecoin reserve, concentration + portfolio risk and
// treasury warnings. Deterministic; prices/volatility are simulated.
// =============================================================================

const ALLOC_COLORS = ["bg-brand-500", "bg-brand-accent", "bg-brand-cyan", "bg-emerald-500", "bg-amber-500", "bg-violet-500"];

export function PortfolioMonitor() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/compliance/portfolio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setSnapshot(d.snapshot ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading || !snapshot) {
    return (
      <div className="glass-panel rounded-2xl border border-white/10 p-5">
        <div className="h-20 rounded-2xl bg-white/5 animate-pulse" />
        <div className="grid grid-cols-3 gap-3 mt-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const total = snapshot.totalValueUsd;
  const riskTone = snapshot.portfolioRisk === "LOW" ? "green" : snapshot.portfolioRisk === "MEDIUM" ? "yellow" : "red";

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
          <Landmark className="h-4 w-4 text-brand-cyan" />
          DPT Portfolio Monitoring
        </div>
        <RiskLevelBadge level={snapshot.portfolioRisk} />
      </div>

      {/* Total treasury */}
      <div className="p-4 rounded-2xl bg-black/30 border border-white/5 mb-4 relative overflow-hidden">
        <div className="absolute -right-3 -bottom-4 opacity-[0.05]">
          <Percent className="h-28 w-28 text-white" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total Treasury Value</div>
        <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight tabular-nums">
          ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ToneBadge tone="blue">Stablecoin reserve: {(snapshot.stablecoinShare * 100).toFixed(0)}%</ToneBadge>
          <ToneBadge tone={snapshot.maxConcentration > 0.4 ? "yellow" : "green"}>
            Max concentration: {snapshot.maxConcentrationAsset ?? "—"} {(snapshot.maxConcentration * 100).toFixed(0)}%
          </ToneBadge>
        </div>
      </div>

      {/* Allocation bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          <span>Asset allocation</span>
          <span>DPT {(snapshot.dptShare * 100).toFixed(0)}% · Stable {(snapshot.stablecoinShare * 100).toFixed(0)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/5 overflow-hidden flex">
          {snapshot.assets.map((a, i) => (
            <div
              key={a.symbol}
              className={cn("h-full", ALLOC_COLORS[i % ALLOC_COLORS.length])}
              style={{ width: `${a.allocation * 100}%` }}
              title={`${a.symbol} ${(a.allocation * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {snapshot.assets.map((a, i) => (
            <span key={a.symbol} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
              <span className={cn("h-2 w-2 rounded-full", ALLOC_COLORS[i % ALLOC_COLORS.length])} />
              {a.symbol} {(a.allocation * 100).toFixed(1)}%
            </span>
          ))}
        </div>
      </div>

      {/* Asset table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-gray-500 border-b border-white/5">
              <th className="py-2 pr-3 font-bold">Asset</th>
              <th className="py-2 pr-3 font-bold">Value</th>
              <th className="py-2 pr-3 font-bold">Alloc</th>
              <th className="py-2 pr-3 font-bold">Price</th>
              <th className="py-2 pr-3 font-bold">24h</th>
              <th className="py-2 pr-3 font-bold">Volatility</th>
              <th className="py-2 pr-3 font-bold">Liquidity</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.assets.map((a) => (
              <tr key={a.symbol} className="border-b border-white/5 last:border-0">
                <td className="py-2 pr-3">
                  <span className="text-[11px] font-bold text-white">{a.symbol}</span>
                  {a.isStablecoin && <span className="ml-1.5 text-[8px] uppercase text-emerald-400 font-bold">stable</span>}
                </td>
                <td className="py-2 pr-3 text-[11px] text-gray-300 tabular-nums">
                  ${a.usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="py-2 pr-3 text-[11px] text-gray-300 tabular-nums">{(a.allocation * 100).toFixed(1)}%</td>
                <td className="py-2 pr-3 text-[11px] text-gray-300 tabular-nums">${priceOf(a.symbol).toLocaleString()}</td>
                <td className="py-2 pr-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-bold tabular-nums",
                      a.change24h >= 0 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {a.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {changeLabel(a.change24h)}
                  </span>
                </td>
                <td className="py-2 pr-3 text-[11px] text-gray-400 tabular-nums">{(a.volatility * 100).toFixed(0)}%</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <Droplets className={cn("h-3 w-3", a.liquidity >= 70 ? "text-emerald-400" : a.liquidity >= 50 ? "text-amber-400" : "text-red-400")} />
                    <span className="text-[10px] text-gray-400 tabular-nums">{a.liquidity}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Portfolio risk */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          <span>Portfolio risk</span>
          <span className={cn("tabular-nums font-bold", TONE_STYLES[riskTone].text)}>{snapshot.portfolioRisk}</span>
        </div>
        <RiskBar score={snapshot.portfolioRisk === "LOW" ? 15 : snapshot.portfolioRisk === "MEDIUM" ? 50 : 80} tone={riskTone} />
      </div>

      {/* Warnings */}
      {snapshot.warnings.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Treasury warnings</div>
          {snapshot.warnings.map((w, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 px-3 py-2.5 rounded-xl border",
                w.severity === "HIGH" ? "bg-red-500/5 border-red-500/20" : "bg-amber-500/5 border-amber-500/20"
              )}
            >
              <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", w.severity === "HIGH" ? "text-red-400" : "text-amber-400")} />
              <div className="min-w-0">
                <div className="text-[11px] text-gray-300 leading-snug">{w.message}</div>
                <div className="text-[9px] text-gray-500 mt-0.5 uppercase">{w.kind.replace(/_/g, " ")}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 text-[12px] font-semibold">
          No treasury warnings — allocations, reserves and liquidity are within policy.
        </div>
      )}

      <p className="mt-3 text-[9px] text-gray-600 leading-relaxed">
        Simulated market data for prototype — prices, volatility and liquidity are reference estimates.
      </p>
    </div>
  );
}
