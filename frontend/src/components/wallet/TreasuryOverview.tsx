"use client";

import React, { useMemo } from "react";
import { DollarSign, Landmark, ArrowRight, ShieldAlert, Cpu } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Asset, BusinessProfile } from "@/hooks/useTreasury";

interface TreasuryOverviewProps {
  businessProfile: BusinessProfile | null;
  availableAssets: Asset[];
  totalEstimatedUSDValue: number;
  isLoading: boolean;
  preferredChain: string;
  isWalletConnected: boolean;
}

export default function TreasuryOverview({
  businessProfile,
  availableAssets,
  totalEstimatedUSDValue,
  isLoading,
  preferredChain,
  isWalletConnected
}: TreasuryOverviewProps) {
  
  // Calculate percentage weight for each asset for the visual bar chart
  const assetWeights = useMemo(() => {
    if (totalEstimatedUSDValue === 0) return [];
    return availableAssets.map((asset) => ({
      symbol: asset.symbol,
      weight: (asset.usdValue / totalEstimatedUSDValue) * 100,
      color:
        asset.symbol === "USDC"
          ? "bg-brand-500"
          : asset.symbol === "USDT"
          ? "bg-brand-cyan"
          : "bg-brand-accent",
    }));
  }, [availableAssets, totalEstimatedUSDValue]);

  if (isLoading) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4 animate-pulse shadow-glass">
        <div className="h-6 w-32 bg-white/10 rounded" />
        <div className="h-10 w-48 bg-white/10 rounded" />
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden space-y-6 shadow-glass">
      {/* Background decorations */}
      <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-brand-cyan/10 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-gray-400">
            <Landmark className="h-4 w-4 text-brand-cyan" />
            <span className="text-xs font-bold uppercase tracking-wider">Corporate Treasury</span>
          </div>
          <h2 className="text-lg font-extrabold text-white">
            {businessProfile?.business_name || "Treasury Portfolio"}
          </h2>
        </div>

        {!isWalletConnected && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-semibold text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Read-Only Demo Mode</span>
          </div>
        )}
      </div>

      {/* Main Valuations Display */}
      <div className="p-5 rounded-2xl bg-black/45 border border-white/5 space-y-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <DollarSign className="h-24 w-24 text-white" />
        </div>
        <span className="text-xs font-semibold text-gray-400 uppercase">Estimated USD Valuation</span>
        <div className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-none">
          {formatCurrency(totalEstimatedUSDValue)}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-brand-cyan pt-1">
          <Cpu className="h-3.5 w-3.5" />
          <span>Active Context Preferred Chain: <strong className="uppercase text-white">{preferredChain}</strong></span>
        </div>
      </div>

      {/* Visual Weight Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-400 font-semibold px-0.5">
          <span>Asset Breakdown</span>
          <span>USD Weights (%)</span>
        </div>
        <div className="h-3.5 w-full rounded-full bg-white/5 border border-white/10 flex overflow-hidden p-[2px]">
          {assetWeights.map((aw, idx) => (
            <div
              key={aw.symbol + idx}
              style={{ width: `${aw.weight}%` }}
              className={`h-full rounded-full first:rounded-l-full last:rounded-r-full transition-all duration-300 ${aw.color}`}
              title={`${aw.symbol}: ${aw.weight.toFixed(1)}%`}
            />
          ))}
        </div>
      </div>

      {/* Assets List */}
      <div className="space-y-2.5">
        {availableAssets.map((asset) => {
          const isUSDC = asset.symbol === "USDC";
          const isUSDT = asset.symbol === "USDT";
          const dotColor = isUSDC ? "bg-brand-500" : isUSDT ? "bg-brand-cyan" : "bg-brand-accent";

          return (
            <div
              key={asset.symbol}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-white/10 hover:bg-white/10 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{asset.symbol}</span>
                    <span className="text-[10px] font-semibold text-gray-400 group-hover:text-gray-200">
                      ({asset.chain})
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 font-medium">{asset.name}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-extrabold text-white">
                  {parseFloat(asset.balance).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                </div>
                <div className="text-xs text-gray-400 font-medium">
                  {formatCurrency(asset.usdValue)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom hint for AI routing */}
      <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
        <span>AI Planning & Route Context</span>
        <div className="flex items-center gap-1 text-brand-500 font-semibold">
          <span>Active</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
