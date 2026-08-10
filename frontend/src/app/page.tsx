"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  DollarSign,
  Fuel,
  Route,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
  CheckCircle,
  XCircle,
  ExternalLink,
  LayoutDashboard,
  MessageSquareText
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTreasury } from "@/hooks/useTreasury";
import WalletCard from "@/components/wallet/WalletCard";
import TreasuryOverview from "@/components/wallet/TreasuryOverview";
import NetworkSelector from "@/components/wallet/NetworkSelector";

export default function Home() {
  const wallet = useWallet();
  const treasury = useTreasury(
    wallet.address,
    wallet.chainId,
    wallet.balance,
    wallet.tokenBalances
  );

  // Intent builder form inputs
  const [recipient, setRecipient] = useState("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
  const [amount, setAmount] = useState("0.001");
  const [activeTab, setActiveTab] = useState<"standard" | "smart">("smart");

  // Execution states
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  // Trigger standard payout execution
  const handleExecutePayment = async () => {
    if (!wallet.isConnected) {
      await wallet.connect();
      return;
    }

    setExecuting(true);
    setTxHash(null);
    setExecError(null);

    try {
      const receipt = await wallet.executePayment(recipient, amount);
      setTxHash(receipt.hash || receipt.transactionHash);
      await treasury.refreshTreasury();
    } catch (err: any) {
      console.error(err);
      setExecError(err.message || "Payment execution failed");
    } finally {
      setExecuting(false);
    }
  };

  // Trigger Smart Wallet batch intent execution
  const handleExecuteSmartIntent = async () => {
    if (!wallet.isConnected) {
      await wallet.connect();
      return;
    }

    setExecuting(true);
    setTxHash(null);
    setExecError(null);

    try {
      // Create a batch step: Transfer native tokens to the recipient
      const steps = [
        {
          targetContract: recipient, // Native transfer executes as simple call to target address
          callData: "0x",
          value: amount
        }
      ];

      const receipt = await wallet.executeSmartWalletBatch(
        "b5000000-0000-0000-0000-000000000001", // Demo intent ID from seed data
        recipient,
        steps
      );
      setTxHash(receipt.hash || receipt.transactionHash);
      await treasury.refreshTreasury();
    } catch (err: any) {
      console.error(err);
      setExecError(err.message || "Smart Wallet Execution failed. Make sure IntentRouter contract is deployed.");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Banner Card */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-8 border border-white/10 shadow-glass">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-brand-cyan/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-500 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI parses intent · Math selects the route</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Intent-Based <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 via-brand-accent to-brand-cyan">Payment Router</span>
          </h1>

          <p className="text-gray-300 text-sm md:text-base leading-relaxed">
            Describe a payment in plain language. IBAP parses the intent into a structured request, generates
            candidate routes, then a deterministic weighted model selects the cheapest, safest route. The AI only
            interprets — you approve before any funds move, and the selected route executes deterministically.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-brand-accent to-brand-cyan text-white text-sm font-bold shadow-glow hover:from-brand-500 hover:to-brand-500 transition-all"
            >
              <LayoutDashboard className="h-4 w-4" />
              Business Payments Dashboard
            </Link>
            <Link
              href="/operations"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-bold hover:bg-white/10 hover:text-white transition-all"
            >
              <MessageSquareText className="h-4 w-4" />
              Open AI Payment Operations
            </Link>
            <span className="text-[11px] text-gray-500 font-medium">
              Describe a payment · Get a plan · Approve & execute
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Total Volume Executed</span>
            <DollarSign className="h-4 w-4 text-brand-500" />
          </div>
          <div className="text-2xl font-bold text-white">$1,482,900</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+24.8% vs last week</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Avg Gas Saved</span>
            <Fuel className="h-4 w-4 text-brand-cyan" />
          </div>
          <div className="text-2xl font-bold text-white">38.4%</div>
          <div className="text-xs text-gray-400">Optimal batch routing</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Route Selection</span>
            <Cpu className="h-4 w-4 text-brand-accent" />
          </div>
          <div className="text-2xl font-bold text-white">Deterministic</div>
          <div className="text-xs text-emerald-400">Weighted · lower score wins</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-medium">Execution Success</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">99.4%</div>
          <div className="text-xs text-gray-400">Atomic rollback protection</div>
        </div>
      </div>

      {/* SECTION: Treasury Command Center (Phase 3 Core UI) */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
          <LandmarkIcon className="h-5 w-5 text-brand-cyan" />
          <span>Treasury Command Center</span>
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wallet Connection */}
          <WalletCard
            isConnected={wallet.isConnected}
            isConnecting={wallet.isConnecting}
            address={wallet.address}
            ensName={wallet.ensName}
            chainId={wallet.chainId}
            balance={wallet.balance}
            error={wallet.error}
            connect={wallet.connect}
            disconnect={wallet.disconnect}
            preferredChain={treasury.preferredChain}
            isWalletAssociated={treasury.treasuryContext.isWalletAssociated}
            associateWallet={treasury.associateWallet}
            isSyncing={treasury.isSyncing}
          />

          {/* Treasury Valuations */}
          <TreasuryOverview
            businessProfile={treasury.businessProfile}
            availableAssets={treasury.availableAssets}
            totalEstimatedUSDValue={treasury.totalEstimatedUSDValue}
            isLoading={treasury.isLoading}
            preferredChain={treasury.preferredChain}
            isWalletConnected={wallet.isConnected}
          />

          {/* Network Selector */}
          <NetworkSelector
            currentChainId={wallet.chainId}
            supportedChains={treasury.supportedChains}
            preferredChain={treasury.preferredChain}
            switchNetwork={wallet.switchNetwork}
            isWalletConnected={wallet.isConnected}
          />
        </div>
      </div>

      {/* Quick Intent Preview & Routing Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Intent Dispatch Card */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Zap className="h-5 w-5 text-brand-500" />
              <h2 className="text-lg font-bold text-white">Execution Playground</h2>
            </div>
            <span className="text-xs text-gray-400">Trigger live MetaMask payouts</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab("smart")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "smart"
                  ? "bg-brand-500/20 text-white border border-brand-500/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Smart Wallet (Batch Contract)
            </button>
            <button
              onClick={() => setActiveTab("standard")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "standard"
                  ? "bg-brand-500/20 text-white border border-brand-500/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Standard Payout (Direct Transfer)
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full p-3.5 rounded-xl glass-input text-sm focus:outline-none text-white font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase">Amount (Native Asset)</label>
              <div className="p-3.5 rounded-xl glass-input flex items-center justify-between">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-transparent text-lg font-bold w-full focus:outline-none text-white"
                />
                <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-bold text-white uppercase">
                  {wallet.chainId === 137 ? "POL" : "ETH"}
                </span>
              </div>
            </div>
          </div>

          {/* Execution feedback */}
          {executing && (
            <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20 flex items-center gap-3">
              <span className="animate-spin h-5 w-5 border-2 border-brand-500 border-t-transparent rounded-full" />
              <span className="text-xs text-gray-300">Confirm transaction request in MetaMask...</span>
            </div>
          )}

          {txHash && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <CheckCircle className="h-4 w-4" />
                <span>Transaction Confirmed!</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-mono truncate mr-4">{txHash}</span>
                <a
                  href={
                    wallet.chainId === 137
                      ? `https://polygonscan.com/tx/${txHash}`
                      : `https://sepolia.etherscan.io/tx/${txHash}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-cyan hover:underline flex items-center gap-1 font-semibold shrink-0"
                >
                  <span>Explorer</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {execError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-1">
              <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                <XCircle className="h-4 w-4" />
                <span>Execution Failed</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed truncate">{execError}</p>
            </div>
          )}

          {/* Action Trigger */}
          {wallet.isConnected ? (
            <button
              onClick={activeTab === "smart" ? handleExecuteSmartIntent : handleExecutePayment}
              disabled={executing}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-600 via-brand-accent to-brand-cyan hover:from-brand-500 hover:to-brand-accent text-white font-bold text-sm shadow-glow disabled:opacity-50 transition-all"
            >
              {executing ? "Processing Transaction..." : activeTab === "smart" ? "Execute Smart Intent Batch" : "Execute Standard Transfer"}
            </button>
          ) : (
            <button
              onClick={wallet.connect}
              className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-bold text-sm transition-all"
            >
              Connect Wallet to Enable Execution
            </button>
          )}
        </div>

        {/* Routing Pipeline */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <Route className="h-5 w-5 text-brand-cyan" />
              <h2 className="text-lg font-bold text-white">Routing Pipeline</h2>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl glass-card text-xs space-y-1">
                <div className="flex items-center justify-between text-gray-300 font-semibold">
                  <span>1 · Intent Parsing</span>
                  <span className="text-emerald-400">AI interpret</span>
                </div>
                <p className="text-gray-400 text-[11px]">Natural language to a structured, validated intent</p>
              </div>

              <div className="p-3 rounded-xl glass-card text-xs space-y-1">
                <div className="flex items-center justify-between text-gray-300 font-semibold">
                  <span>2 · Candidate Routes</span>
                  <span className="text-emerald-400">Generated</span>
                </div>
                <p className="text-gray-400 text-[11px]">Planner builds viable multi-chain strategies</p>
              </div>

              <div className="p-3 rounded-xl glass-card text-xs space-y-1">
                <div className="flex items-center justify-between text-gray-300 font-semibold">
                  <span>3 · Deterministic Scoring</span>
                  <span className="text-brand-cyan">Math decides</span>
                </div>
                <p className="text-gray-400 text-[11px]">Weighted model selects the best route — not the AI</p>
              </div>

              <div className="p-3 rounded-xl glass-card text-xs space-y-1">
                <div className="flex items-center justify-between text-gray-300 font-semibold">
                  <span>4 · Approval & Execute</span>
                  <span className="text-emerald-400">You sign</span>
                </div>
                <p className="text-gray-400 text-[11px]">Human approval, then the contract executes</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 text-center">
            <span className="text-xs text-gray-400">Phase 3 Web3 Integration Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small icon helper
function LandmarkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M5 21V10" />
      <path d="M9 21V10" />
      <path d="M13 21V10" />
      <path d="M17 21V10" />
      <path d="M2 10L12 3L22 10" />
    </svg>
  );
}
