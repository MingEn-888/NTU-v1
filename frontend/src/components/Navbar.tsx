"use client";

import React, { useState } from "react";
import { Zap, Wallet, Activity, ShieldCheck, ChevronDown } from "lucide-react";
import { formatAddress } from "@/lib/utils";

export const Navbar: React.FC = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [mockAddress] = useState("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");

  const toggleWallet = () => {
    setWalletConnected((prev) => !prev);
  };

  return (
    <header className="sticky top-0 z-50 glass-navbar w-full px-6 py-3.5 flex items-center justify-between">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-500 via-brand-accent to-brand-cyan flex items-center justify-center shadow-glow">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-white glow-text">
              INTENT<span className="text-brand-500">FLOW</span>
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-brand-500/20 text-brand-500 border border-brand-500/30 rounded-full">
              v1.0 MVP
            </span>
          </div>
          <p className="text-xs text-gray-400 font-medium">Agentic Cross-Chain Router</p>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="hidden md:flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/5 text-xs text-gray-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium">Agent Solver: Active</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/5 text-xs text-gray-300">
          <Activity className="h-3.5 w-3.5 text-brand-cyan" />
          <span>Avg Route Latency: <strong className="text-white">420ms</strong></span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-emerald" />
          <span>Arbitrum / Polygon</span>
        </div>

        <button
          onClick={toggleWallet}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
            walletConnected
              ? "bg-brand-500/20 text-brand-100 border border-brand-500/40 hover:bg-brand-500/30"
              : "bg-gradient-to-r from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-600 text-white shadow-glow"
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>{walletConnected ? formatAddress(mockAddress) : "Connect Wallet"}</span>
          {walletConnected && <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
        </button>
      </div>
    </header>
  );
};
