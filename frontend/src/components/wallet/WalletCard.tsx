"use client";

import React, { useState } from "react";
import { Wallet, LogOut, Copy, Check, Shield, AlertTriangle } from "lucide-react";
import { formatAddress } from "@/lib/utils";

interface WalletCardProps {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  ensName: string | null;
  chainId: number | null;
  balance: string;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  preferredChain: string;
  isWalletAssociated: boolean;
  associateWallet: () => Promise<any>;
  isSyncing: boolean;
}

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  137: "Polygon",
  42161: "Arbitrum One",
  10: "Optimism",
  8453: "Base",
  31337: "Local Hardhat"
};

export default function WalletCard({
  isConnected,
  isConnecting,
  address,
  ensName,
  chainId,
  balance,
  error,
  connect,
  disconnect,
  preferredChain,
  isWalletAssociated,
  associateWallet,
  isSyncing
}: WalletCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch {
      // connect() surfaces errors via the `error` prop — no unhandled rejection.
    }
  };

  const handleAssociate = async () => {
    try {
      await associateWallet();
    } catch {
      // associateWallet() surfaces errors via isSyncing/error state.
    }
  };

  const currentChainName = chainId ? CHAIN_NAMES[chainId] || `Unknown (ID: ${chainId})` : "None";
  
  // Check if connected network matches the business's preferred chain
  const isNetworkMatch = chainId
    ? (preferredChain === "polygon" && chainId === 137) ||
      (preferredChain === "ethereum" && chainId === 1) ||
      (preferredChain === "arbitrum" && chainId === 42161) ||
      (preferredChain === "optimism" && chainId === 10) ||
      (preferredChain === "base" && chainId === 8453) ||
      chainId === 31337 // Local Hardhat bypasses
    : false;

  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden space-y-5 shadow-glass">
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-500">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Business Wallet</h3>
            <p className="text-[10px] text-gray-400 font-medium">MetaMask Treasury Login</p>
          </div>
        </div>

        {/* Connection Status Badge */}
        {isConnected ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulseFast" />
            <span>Connected</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
            <span>Disconnected</span>
          </span>
        )}
      </div>

      {/* Body / Info */}
      {isConnected && address ? (
        <div className="space-y-4">
          {/* Address & ENS Row */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-gray-400">Account Address</span>
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                title="Copy Address"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="text-sm font-mono font-bold text-white truncate">{address}</div>
            {ensName && (
              <div className="text-xs text-brand-cyan font-semibold flex items-center gap-1">
                <span>ENS:</span>
                <span>{ensName}</span>
              </div>
            )}
          </div>

          {/* Native Balance & Network Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-black/25 border border-white/5 space-y-1">
              <span className="text-[10px] font-semibold uppercase text-gray-400">Native Balance</span>
              <div className="text-base font-bold text-white">
                {balance} <span className="text-xs text-brand-cyan">{chainId === 137 ? "POL" : "ETH"}</span>
              </div>
            </div>
            
            <div className="p-3.5 rounded-xl bg-black/25 border border-white/5 space-y-1">
              <span className="text-[10px] font-semibold uppercase text-gray-400">Active Network</span>
              <div className="text-xs font-bold text-white truncate">{currentChainName}</div>
            </div>
          </div>

          {/* Network Matching & Treasury Sync Status */}
          <div className="space-y-2">
            {!isNetworkMatch && chainId !== 31337 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Mismatched Network! Preferred: <strong className="uppercase">{preferredChain}</strong></span>
              </div>
            )}

            {isWalletAssociated ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                <Shield className="h-4 w-4 shrink-0" />
                <span>Synced with TechCorp Treasury Profile</span>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/20 flex items-center justify-between">
                <span className="text-xs text-gray-300">Wallet not associated yet</span>
                <button
                  onClick={handleAssociate}
                  disabled={isSyncing}
                  className="px-3 py-1 rounded bg-brand-500 text-on-accent text-xs font-semibold hover:bg-brand-600 disabled:opacity-50 transition-all shadow-glow"
                >
                  {isSyncing ? "Syncing..." : "Sync Wallet"}
                </button>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={disconnect}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-gray-300 hover:text-red-200 text-sm font-bold transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Disconnect Wallet</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 leading-relaxed">
            Connect your MetaMask treasury wallet to access the business payment dashboard, verify token balances, and approve smart contract intents.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 via-brand-accent to-brand-cyan hover:from-brand-500 hover:to-brand-cyan text-on-accent text-sm font-bold shadow-glow hover:shadow-glow-cyan disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Connecting MetaMask...</span>
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" />
                <span>Connect Treasury Wallet</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
