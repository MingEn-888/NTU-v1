"use client";

import React from "react";
import { Check, ShieldAlert, Cpu, ArrowRightLeft } from "lucide-react";
import { ChainConfig } from "@/hooks/useTreasury";

interface NetworkSelectorProps {
  currentChainId: number | null;
  supportedChains: ChainConfig[];
  preferredChain: string;
  switchNetwork: (chainId: number) => Promise<void>;
  isWalletConnected: boolean;
}

export default function NetworkSelector({
  currentChainId,
  supportedChains,
  preferredChain,
  switchNetwork,
  isWalletConnected
}: NetworkSelectorProps) {
  
  // Maps preferred chain string to Chain ID
  const preferredChainId = React.useMemo(() => {
    switch (preferredChain.toLowerCase()) {
      case "ethereum":
        return 1;
      case "polygon":
        return 137;
      case "arbitrum":
        return 42161;
      case "optimism":
        return 10;
      case "base":
        return 8453;
      default:
        return 137;
    }
  }, [preferredChain]);

  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden space-y-5 shadow-glass">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <ArrowRightLeft className="h-5 w-5 text-brand-accent" />
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Network Selector</h3>
            <p className="text-[10px] text-gray-400 font-medium">Switch Active Routing Chain</p>
          </div>
        </div>
        <Cpu className="h-4 w-4 text-brand-accent animate-pulse" />
      </div>

      {!isWalletConnected && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Connect wallet to enable network switching.</span>
        </div>
      )}

      {/* Network List */}
      <div className="space-y-2">
        {supportedChains.map((chain) => {
          const isConnected = currentChainId === chain.id;
          const isPreferred = preferredChainId === chain.id;

          return (
            <button
              key={chain.id}
              onClick={() => {
                if (isWalletConnected && !isConnected) {
                  switchNetwork(chain.id).catch(() => {
                    // switchNetwork() already surfaces errors via wallet state.
                  });
                }
              }}
              disabled={!isWalletConnected || isConnected}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-200 ${
                isConnected
                  ? "bg-brand-500/20 border-brand-500/50 shadow-glow text-white font-bold"
                  : isWalletConnected
                  ? "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10 text-gray-300"
                  : "bg-white/5 border-transparent text-gray-400 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Network Icon Circle */}
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase ${
                    isConnected
                      ? "bg-brand-500 text-white"
                      : "bg-white/10 text-gray-300"
                  }`}
                >
                  {chain.name.substring(0, 2)}
                </div>
                
                <div>
                  <div className="text-sm font-bold">{chain.name}</div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">
                    Chain ID: {chain.id}
                  </div>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-1.5">
                {isPreferred && (
                  <span className="px-2 py-0.5 rounded bg-brand-cyan/20 border border-brand-cyan/30 text-[9px] font-bold text-brand-cyan uppercase tracking-wider">
                    Preferred
                  </span>
                )}
                {isConnected && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                    <Check className="h-3 w-3" />
                    Active
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
