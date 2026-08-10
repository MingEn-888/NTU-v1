"use client";

import React, { useState } from "react";
import { Zap, Wallet, Activity, ShieldCheck, ChevronDown } from "lucide-react";
import { formatAddress } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { UserProfile } from "@/components/profile/UserProfile";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NetworkSelectorChip } from "@/components/web3/NetworkSelector";

export const Navbar: React.FC = () => {
  const { isConnected, isConnecting, address, connect, disconnect } = useWallet();

  const handleConnect = async () => {
    try {
      if (isConnected) {
        disconnect();
      } else {
        await connect();
      }
    } catch (err) {
      // connect() already surfaces a friendly error in the wallet state;
      // swallow here so an unhandled rejection never bubbles to the console.
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-navbar w-full px-4 md:px-6 py-3 flex items-center justify-between gap-3">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-accent to-mint-300 flex items-center justify-center shadow-glow">
          <Zap className="h-5 w-5 text-on-accent" />
        </div>
        <div className="hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-gray-100 glow-text">
              PayMaster
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-full">
              v3.0
            </span>
          </div>
          <p className="text-xs text-gray-400 font-medium">AI Financial Assistant</p>
        </div>
      </div>

      {/* Global Search */}
      <div className="hidden md:block flex-1 max-w-md mx-auto">
        <GlobalSearch className="w-full justify-start" />
      </div>

      {/* Center Status Indicators */}
      <div className="hidden lg:flex items-center gap-2.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium">Route Optimizer: Deterministic</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300">
          <Activity className="h-3.5 w-3.5 text-brand-cyan" />
          <span>Selection: <strong className="text-gray-100">Lower score wins</strong></span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-emerald" />
          <span>Arbitrum / Polygon</span>
        </div>

        {/* Network selector (multi-ecosystem) */}
        <NetworkSelectorChip className="hidden sm:block" />

        {/* Global theme switch */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationCenter />

        {/* User profile */}
        <UserProfile />

        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
            isConnected
              ? "bg-brand-500/20 text-brand-100 border border-brand-500/40 hover:bg-brand-500/30"
              : "bg-gradient-to-r from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-600 text-on-accent shadow-glow"
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>
            {isConnecting
              ? "Connecting..."
              : isConnected
              ? formatAddress(address || "")
              : "Connect Wallet"}
          </span>
          {isConnected && <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
        </button>
      </div>
    </header>
  );
};
