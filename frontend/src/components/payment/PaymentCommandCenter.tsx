"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquareText,
  FileText,
  Route,
  ShieldCheck,
  Landmark,
  Wallet,
  CheckCircle2,
  Loader2,
  Activity,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTreasury } from "@/hooks/useTreasury";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { RiskSimulationPanel } from "@/components/risk/RiskSimulationPanel";
import type { OperationStage } from "@/lib/payment/types";
import { formatAddress } from "@/lib/utils";

// Seeded TechCorp business profile (fallback so the demo works with seed data).
const DEFAULT_BUSINESS_ID = "b2000000-0000-0000-0000-000000000001";

const STAGES: { key: OperationStage; label: string; hint: string; icon: React.ElementType }[] = [
  { key: "natural_language", label: "Describe", hint: "Business payment in plain words", icon: MessageSquareText },
  { key: "payment_request", label: "Payment Request", hint: "Structured operation", icon: FileText },
  { key: "payment_plan", label: "Payment Plan", hint: "Route · risk · cost", icon: Route },
  { key: "approval", label: "Approval", hint: "Authorise with wallet", icon: ShieldCheck },
];

function stageIndex(stage: OperationStage): number {
  switch (stage) {
    case "natural_language":
      return 0;
    case "payment_request":
      return 1;
    case "payment_plan":
      return 2;
    case "approval":
    case "executing":
      return 3;
    case "complete":
      return 4;
  }
}

export function PaymentCommandCenter() {
  const wallet = useWallet();
  const treasury = useTreasury(wallet.address, wallet.chainId, wallet.balance, wallet.tokenBalances);
  const [stage, setStage] = useState<OperationStage>("natural_language");

  // Phase 11 — deep-linked from the dashboard AI command bar (?prompt=) and the
  // approval queue (?review=). The prompt is pre-filled into the agent chat.
  const searchParams = useSearchParams();
  const initialPrompt = useMemo(() => {
    const p = searchParams?.get("prompt");
    return p ? p : undefined;
  }, [searchParams]);

  const businessId = useMemo(
    () => treasury.businessProfile?.id || DEFAULT_BUSINESS_ID,
    [treasury.businessProfile]
  );

  const currentIdx = stageIndex(stage);
  const isExecuting = stage === "executing";

  return (
    <div className="space-y-6">
      {/* ======================= Header ======================= */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-6 border border-white/10 shadow-glass">
        <div className="absolute -top-16 -right-16 w-72 h-72 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-5 justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-accent to-brand-cyan flex items-center justify-center shadow-glow">
              <MessageSquareText className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                  IBAP <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-cyan">Payment Operations</span>
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-full">
                  Phase 4
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-1">
                Describe a payment — the agent handles intent, routing, risk & approval.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div>
                <div className="text-[10px] font-semibold uppercase text-gray-500 leading-none">Agent Status</div>
                <div className="text-[12px] font-bold text-emerald-300 leading-tight">
                  {isExecuting ? "Signing Transaction" : "Online · Awaiting Instructions"}
                </div>
              </div>
            </div>

            <button
              onClick={wallet.isConnected ? wallet.disconnect : wallet.connect}
              disabled={wallet.isConnecting}
              className={`px-4 py-2.5 rounded-xl text-[12px] font-bold flex items-center gap-2 transition-all ${
                wallet.isConnected
                  ? "bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                  : "bg-gradient-to-r from-brand-600 to-brand-accent text-white shadow-glow hover:from-brand-500 hover:to-brand-600"
              }`}
            >
              {wallet.isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {wallet.isConnected ? formatAddress(wallet.address || "") : "Connect Wallet"}
            </button>
          </div>
        </div>
      </div>

      {/* ======================= Pipeline Stepper ======================= */}
      <div className="glass-panel rounded-2xl border border-white/10 p-4">
        <div className="flex items-center">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const isDone = currentIdx > i;
            const isActive = currentIdx === i && !isExecuting;
            const isExecutingStep = currentIdx === i && isExecuting;
            return (
              <React.Fragment key={s.key}>
                {i > 0 && (
                  <div className={`flex-1 h-px mx-2 ${isDone ? "bg-gradient-to-r from-brand-500 to-brand-cyan" : "bg-white/10"}`} />
                )}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center border transition-all ${
                      isDone
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : isActive
                        ? "bg-brand-500/20 border-brand-500/50 text-brand-300 shadow-glow"
                        : isExecutingStep
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse"
                        : "bg-white/5 border-white/10 text-gray-500"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="text-center">
                    <div
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isDone || isActive || isExecutingStep ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {s.label}
                    </div>
                    <div className="text-[9px] text-gray-600 hidden sm:block">{s.hint}</div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ======================= Main Grid ======================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat window */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-white/10 shadow-glass overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-brand-500/15 border border-brand-500/30 text-brand-400">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-white leading-tight">Agent Conversation</div>
                <div className="text-[10px] text-gray-500 font-medium">
                  {treasury.businessProfile?.business_name || "TechCorp Solutions Sdn Bhd"}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-gray-500">Source: CHAT</span>
          </div>
          <div className="h-[560px] md:h-[600px] p-4 md:p-5 flex flex-col">
            <ChatWindow
              businessId={businessId}
              businessName={treasury.businessProfile?.business_name}
              wallet={{
                isConnected: wallet.isConnected,
                isConnecting: wallet.isConnecting,
                address: wallet.address,
                chainId: wallet.chainId,
                connect: wallet.connect,
                executePayment: wallet.executePayment,
                executeSmartWalletBatch: wallet.executeSmartWalletBatch,
                executeSmartWalletPlan: wallet.executeSmartWalletPlan,
              }}
              onOperationStageChange={setStage}
              simulationContext={treasury.treasuryContext}
              initialPrompt={initialPrompt}
            />
          </div>
        </div>

        {/* Treasury / Operation context */}
        <div className="space-y-6">
          <TreasuryMiniCard
            businessName={treasury.businessProfile?.business_name || "TechCorp Solutions Sdn Bhd"}
            preferredChain={treasury.preferredChain}
            totalUsd={treasury.totalEstimatedUSDValue}
            assetCount={treasury.availableAssets?.length || 0}
            walletConnected={wallet.isConnected}
          />
          <OperationStatusCard stage={stage} />
        </div>
      </div>

      {/* ======================= Phase 8 preview ======================= */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Phase 8 · Risk &amp; Simulation preview
          </div>
          <div className="h-px flex-1 bg-white/5" />
        </div>
        <RiskSimulationPanel />
      </div>
    </div>
  );
}

function TreasuryMiniCard({
  businessName,
  preferredChain,
  totalUsd,
  assetCount,
  walletConnected,
}: {
  businessName: string;
  preferredChain: string;
  totalUsd: number;
  assetCount: number;
  walletConnected: boolean;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Treasury Context</div>
            <div className="text-[13px] font-bold text-white truncate max-w-[170px]">{businessName}</div>
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${
            walletConnected ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" : "bg-white/5 text-gray-500 border border-white/10"
          }`}
        >
          {walletConnected ? "Signed" : "Read-only"}
        </span>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Estimated Value</div>
        <div className="text-2xl font-extrabold text-white">
          ${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="text-[10px] text-gray-500 font-semibold uppercase">Preferred Chain</div>
          <div className="text-[13px] font-bold text-brand-cyan capitalize">{preferredChain}</div>
        </div>
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="text-[10px] text-gray-500 font-semibold uppercase">Funded Assets</div>
          <div className="text-[13px] font-bold text-white">{assetCount}</div>
        </div>
      </div>

      <div className="text-[10px] text-gray-600 leading-relaxed">
        All payouts are routed from this treasury vault. Settlement currencies are converted at live indicative rates.
      </div>
    </div>
  );
}

function OperationStatusCard({ stage }: { stage: OperationStage }) {
  const statusByStage: Record<OperationStage, { label: string; desc: string; color: string }> = {
    natural_language: {
      label: "Awaiting instruction",
      desc: "Describe a business payment in plain language to begin.",
      color: "text-gray-300 border-white/10 bg-white/[0.03]",
    },
    payment_request: {
      label: "Payment request detected",
      desc: "Intent parsed into a structured operation. Generate a payment plan to continue.",
      color: "text-brand-cyan border-brand-cyan/30 bg-brand-cyan/10",
    },
    payment_plan: {
      label: "Payment plan ready",
      desc: "Route, cost, steps & risk assessed. Approve to execute from the treasury.",
      color: "text-violet-300 border-violet-400/30 bg-violet-500/10",
    },
    approval: {
      label: "Awaiting approval",
      desc: "Authorise the payout in your wallet. Nothing is sent until you sign.",
      color: "text-amber-300 border-amber-400/30 bg-amber-500/10",
    },
    executing: {
      label: "Executing…",
      desc: "Signing transaction in MetaMask. Please review the details carefully.",
      color: "text-amber-300 border-amber-400/30 bg-amber-500/10",
    },
    complete: {
      label: "Operation complete",
      desc: "Payment settled on-chain. A new instruction can start the next operation.",
      color: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
    },
  };

  const s = statusByStage[stage];

  return (
    <div className={`rounded-2xl border p-5 space-y-2 ${s.color}`}>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
        <div className="text-[13px] font-bold">{s.label}</div>
      </div>
      <p className="text-[12px] leading-relaxed opacity-80">{s.desc}</p>
    </div>
  );
}
