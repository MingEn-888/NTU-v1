"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Globe,
  Check,
  Fuel,
  Timer,
  Wallet,
  ArrowRightLeft,
  Coins,
  ChevronDown,
  Cpu,
  Sparkles,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { formatAddress } from "@/lib/utils";

export interface EcosystemInfo {
  id: string;
  name: string;
  symbol: string;
  /** EVM chain id — null for non-EVM ecosystems (e.g. Solana). */
  chainId: number | null;
  vm: "EVM" | "Solana";
  gas: string;
  gasLabel: string;
  avgTime: string;
  assets: string[];
  accent: string; // tailwind classes for the logo chip
}

/**
 * Multi-ecosystem Web3 network selector — Ethereum, Solana, Polygon, BNB Chain
 * and other supported ecosystems, with wallet status, supported assets, gas
 * fees, processing time and cross-chain routing awareness.
 */
export const ECOSYSTEMS: EcosystemInfo[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    chainId: 1,
    vm: "EVM",
    gas: "12 gwei",
    gasLabel: "~$2.40",
    avgTime: "~12s",
    assets: ["ETH", "USDC", "USDT", "DAI"],
    accent: "from-[#627EEA] to-[#9db8ff]",
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    chainId: null,
    vm: "Solana",
    gas: "0.000005 SOL",
    gasLabel: "~$0.0008",
    avgTime: "~0.4s",
    assets: ["SOL", "USDC", "USDT", "RAY"],
    accent: "from-[#9945FF] to-[#14F195]",
  },
  {
    id: "polygon",
    name: "Polygon",
    symbol: "POL",
    chainId: 137,
    vm: "EVM",
    gas: "45 gwei",
    gasLabel: "~$0.02",
    avgTime: "~2s",
    assets: ["POL", "USDC", "USDT", "WETH"],
    accent: "from-[#8247E5] to-[#A85CFF]",
  },
  {
    id: "bnb",
    name: "BNB Chain",
    symbol: "BNB",
    chainId: 56,
    vm: "EVM",
    gas: "3 gwei",
    gasLabel: "~$0.03",
    avgTime: "~3s",
    assets: ["BNB", "USDC", "USDT", "BUSD"],
    accent: "from-[#F0B90B] to-[#FFD24A]",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    symbol: "ETH",
    chainId: 42161,
    vm: "EVM",
    gas: "0.1 gwei",
    gasLabel: "~$0.02",
    avgTime: "~0.3s",
    assets: ["ETH", "USDC", "USDT", "ARB"],
    accent: "from-[#28A0F0] to-[#5AB8F7]",
  },
  {
    id: "optimism",
    name: "Optimism",
    symbol: "ETH",
    chainId: 10,
    vm: "EVM",
    gas: "0.01 gwei",
    gasLabel: "~$0.01",
    avgTime: "~2s",
    assets: ["ETH", "USDC", "USDT", "OP"],
    accent: "from-[#FF0420] to-[#FF6B7E]",
  },
  {
    id: "base",
    name: "Base",
    symbol: "ETH",
    chainId: 8453,
    vm: "EVM",
    gas: "0.05 gwei",
    gasLabel: "~$0.01",
    avgTime: "~2s",
    assets: ["ETH", "USDC", "USDT"],
    accent: "from-[#0052FF] to-[#4D82FF]",
  },
  {
    id: "avalanche",
    name: "Avalanche",
    symbol: "AVAX",
    chainId: 43114,
    vm: "EVM",
    gas: "25 nAVAX",
    gasLabel: "~$0.02",
    avgTime: "~1s",
    assets: ["AVAX", "USDC", "USDT"],
    accent: "from-[#E84142] to-[#FF7A7B]",
  },
];

function byChainId(id: number | null): EcosystemInfo | undefined {
  return ECOSYSTEMS.find((e) => e.chainId === id);
}

/** A shared network pill used in the navbar (compact). */
export function NetworkSelectorChip({ className = "" }: { className?: string }) {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const active = wallet.isConnected ? byChainId(wallet.chainId) : undefined;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Network selector"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass-input border text-[12px] font-semibold text-gray-300 hover:text-gray-100 hover:border-brand-400/50 transition-all"
      >
        <span
          className={`h-5 w-5 rounded-md bg-gradient-to-br flex items-center justify-center text-[8px] font-extrabold text-on-accent ${active?.accent ?? "from-brand-500 to-brand-accent"}`}
        >
          {active?.symbol?.slice(0, 1) ?? "W"}
        </span>
        <span className="hidden lg:inline">{active?.name ?? "Network"}</span>
        <ChevronDown className="h-3 w-3 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 glass-dropdown rounded-2xl overflow-hidden z-50 animate-scale-in">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-[13px] font-extrabold text-gray-100">Ecosystems</span>
            <span className="text-[10px] text-gray-500">
              {wallet.isConnected ? "Wallet connected" : "Wallet not connected"}
            </span>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-1.5">
            {ECOSYSTEMS.map((e) => {
              const isActive = wallet.chainId === e.chainId;
              return (
                <button
                  key={e.id}
                  onClick={() => {
                    if (e.chainId !== null && !isActive) {
                      wallet.switchNetwork(e.chainId).catch(() => {});
                    }
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isActive
                      ? "bg-brand-500/15 border border-brand-500/40"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span
                    className={`h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-[10px] font-extrabold text-on-accent shrink-0 ${e.accent}`}
                  >
                    {e.symbol.slice(0, 2)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-bold text-gray-100">{e.name}</span>
                      {e.vm === "Solana" && (
                        <span className="px-1 py-0.5 rounded bg-mint-300/15 text-mint-300 text-[8px] font-bold uppercase">
                          SVM
                        </span>
                      )}
                    </span>
                    <span className="block text-[10px] text-gray-500">
                      {e.gas} · {e.avgTime} · {e.assets.slice(0, 3).join(" · ")}
                    </span>
                  </span>
                  {isActive && <Check className="h-4 w-4 text-emerald-300 shrink-0" />}
                  {e.chainId !== null && !isActive && (
                    <span className="text-[9px] text-gray-500 shrink-0">switch</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-gray-500">Cross-chain routing available</span>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-cyan hover:text-brand-300"
            >
              Compare routes <ArrowRightLeft className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Full multi-ecosystem panel (home / settings). */
export function EcosystemNetworkPanel({ className = "" }: { className?: string }) {
  const wallet = useWallet();
  const active = wallet.isConnected ? byChainId(wallet.chainId) : undefined;

  const switchTo = (e: EcosystemInfo) => {
    if (e.chainId === null) return; // non-EVM — show status only
    if (wallet.chainId === e.chainId) return;
    wallet.switchNetwork(e.chainId).catch(() => {});
  };

  const summary = useMemo(
    () => ({
      total: ECOSYSTEMS.length,
      evm: ECOSYSTEMS.filter((e) => e.vm === "EVM").length,
      assets: new Set(ECOSYSTEMS.flatMap((e) => e.assets)).size,
    }),
    []
  );

  return (
    <div className={`glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-glass ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-cyan">
              <Globe className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-100">Multi-Ecosystem Network Selector</h3>
              <p className="text-[10px] text-gray-500 font-medium">Ethereum · Solana · Polygon · BNB Chain · more</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            {wallet.isConnected ? "Connected" : "Read-only"}
          </span>
        </div>

        {/* Wallet status strip */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold uppercase">
              <Wallet className="h-3 w-3 text-brand-cyan" /> Wallet
            </div>
            <div className="text-[12.5px] font-bold text-gray-100 truncate mt-0.5">
              {wallet.isConnected ? formatAddress(wallet.address || "") : "Not connected"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold uppercase">
              <Cpu className="h-3 w-3 text-brand-cyan" /> Active
            </div>
            <div className="text-[12.5px] font-bold text-gray-100 capitalize mt-0.5">
              {active?.name ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Ecosystem list */}
      <div className="divide-y divide-white/5">
        {ECOSYSTEMS.map((e) => {
          const isActive = wallet.chainId === e.chainId;
          return (
            <button
              key={e.id}
              onClick={() => switchTo(e)}
              disabled={e.chainId === null}
              className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                isActive ? "bg-brand-500/10" : "hover:bg-white/5"
              } ${e.chainId === null ? "cursor-default" : ""}`}
            >
              <span
                className={`h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-[11px] font-extrabold text-on-accent shrink-0 ${e.accent}`}
              >
                {e.symbol.slice(0, 2)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-gray-100">{e.name}</span>
                  {e.vm === "Solana" && (
                    <span className="px-1.5 py-0.5 rounded-md bg-mint-300/15 text-mint-300 text-[8px] font-bold uppercase tracking-wide">
                      SVM
                    </span>
                  )}
                  {isActive && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[8px] font-bold uppercase tracking-wide">
                      Active
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Fuel className="h-3 w-3 text-mint-300" />
                    {e.gas} <span className="opacity-70">{e.gasLabel}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3 text-brand-cyan" />
                    {e.avgTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Coins className="h-3 w-3 text-brand-300" />
                    {e.assets.join(", ")}
                  </span>
                </div>
              </div>
              {isActive ? (
                <Check className="h-4 w-4 text-emerald-300 shrink-0" />
              ) : (
                <span className="text-[9px] text-gray-600 shrink-0">
                  {e.chainId === null ? "SVM watch" : "Switch"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer summary + cross-chain CTA */}
      <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>{summary.total} ecosystems</span>
          <span className="h-1 w-1 rounded-full bg-white/10" />
          <span>{summary.evm} EVM switchable</span>
          <span className="h-1 w-1 rounded-full bg-white/10" />
          <span>{summary.assets} assets</span>
        </div>
        <Link
          href="/"
          className="sm:ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-500/15 border border-brand-500/40 text-brand-200 text-[11px] font-bold hover:bg-brand-500/25 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Compare routes & gas
        </Link>
      </div>
    </div>
  );
}
