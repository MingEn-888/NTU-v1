"use client";

import React, { useState } from "react";
import { PlayCircle, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceAssessment } from "@/lib/compliance/types";
import { CompliancePipe } from "./CompliancePipe";
import { CounterpartyPanel } from "./CounterpartyPanel";
import { MonitoringPanel } from "./MonitoringPanel";
import { RiskSummaryPanel } from "./RiskSummaryPanel";
import { PolicyPanel } from "./PolicyPanel";
import { TravelRulePanel } from "./TravelRulePanel";
import { DecisionBadge, ToneBadge } from "./ui";

// =============================================================================
// ComplianceAssess — the interactive compliance evaluation tool.
// Describe a transfer; the deterministic engines screen the counterparty,
// monitor the transaction, score the risk, evaluate policies and check the
// Travel Rule — then render the FULL compliance pipe + every panel.
// =============================================================================

const SAMPLE_SCENARIOS = [
  { label: "Normal vendor payment", preset: "Pay Acme Suppliers $5,000 USDC for invoice INV-1024." },
  { label: "Large manual approval", preset: "Pay contractor $50,000 USDC for project retainer." },
  { label: "New high-risk counterparty", preset: "Pay new supplier $12,000 USDT on Ethereum." },
  { label: "Blocked counterparty", preset: "Pay 0x000000000000000000000000000000000000dEaD $500." },
  { label: "Unknown asset", preset: "Pay Acme 500 XYZ tokens worth $3,000." },
];

const INPUT_STYLES =
  "w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-[12px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30";

export function ComplianceAssess() {
  const [intent, setIntent] = useState(SAMPLE_SCENARIOS[0].preset);
  const [recipientAddress, setRecipientAddress] = useState("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
  const [amountUsd, setAmountUsd] = useState("5000");
  const [asset, setAsset] = useState("USDC");
  const [network, setNetwork] = useState("polygon");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<ComplianceAssessment | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compliance/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          recipient: null,
          recipientAddress,
          asset,
          amountUsd: Number(amountUsd),
          network,
          customerId: "cust_techcorp",
          businessId: "b2000000-0000-0000-0000-000000000001",
          txnReference: `TX-${Math.floor(10000 + Math.random() * 89999)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
      setAssessment(data.assessment);
      setPersisted(data.persisted);
    } catch (err: any) {
      setError(err?.message || "Compliance assessment failed.");
      setAssessment(null);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: string) => {
    setIntent(preset);
    // Heuristic default recipient for the demo scenarios.
    if (preset.includes("0x000000000000000000000000000000000000dEaD")) {
      setRecipientAddress("0x000000000000000000000000000000000000dEaD");
      setAmountUsd("500");
      setAsset("USDC");
      setNetwork("polygon");
    } else if (preset.includes("new supplier")) {
      setRecipientAddress("0x90F79bf6EB2c4f870365E785982E1f101E93b906");
      setAmountUsd("12000");
      setAsset("USDT");
      setNetwork("ethereum");
    } else if (preset.includes("XYZ")) {
      setRecipientAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
      setAmountUsd("3000");
      setAsset("XYZ");
      setNetwork("polygon");
    } else if (preset.includes("$50,000")) {
      setRecipientAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
      setAmountUsd("50000");
      setAsset("USDC");
      setNetwork("polygon");
    } else {
      setRecipientAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
      setAmountUsd("5000");
      setAsset("USDC");
      setNetwork("polygon");
    }
  };

  return (
    <div className="space-y-5">
      {/* Assess input */}
      <div className="glass-panel rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
            <PlayCircle className="h-4 w-4 text-brand-cyan" />
            Evaluate a Transfer
          </div>
          <span className="text-[10px] text-gray-500 font-semibold">Deterministic compliance pipeline</span>
        </div>

        {/* Preset scenarios */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {SAMPLE_SCENARIOS.map((s) => (
            <button
              key={s.label}
              onClick={() => applyPreset(s.preset)}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Transaction intent
            </label>
            <input className={INPUT_STYLES} value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="Describe the transfer…" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Recipient address (0x)
              </label>
              <input
                className={cn(INPUT_STYLES, "font-mono")}
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="0x…"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Amount (USD)
              </label>
              <input
                className={cn(INPUT_STYLES, "tabular-nums")}
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                type="number"
                min="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Asset</label>
                <input className={cn(INPUT_STYLES, "uppercase")} value={asset} onChange={(e) => setAsset(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Network</label>
                <input className={INPUT_STYLES} value={network} onChange={(e) => setNetwork(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold text-on-accent bg-gradient-to-r from-brand-500 to-brand-accent hover:opacity-90 transition-opacity shadow-glow disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {loading ? "Evaluating…" : "Run Compliance Assessment"}
        </button>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-[12px] font-semibold">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {assessment && (
        <div className="space-y-5">
          {/* Decision banner */}
          <div
            className={cn(
              "rounded-2xl border p-5",
              assessment.decision === "ALLOW"
                ? "bg-emerald-500/10 border-emerald-500/30"
                : assessment.decision === "REVIEW"
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-red-500/10 border-red-500/30"
            )}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <DecisionBadge decision={assessment.decision} className="!px-3 !py-1.5 !text-[12px]" />
                <div>
                  <div className="text-[13px] font-bold text-white">{assessment.txnReference}</div>
                  <div className="text-[10px] text-gray-400">{assessment.intent}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ToneBadge tone={assessment.humanApprovalRequired ? "yellow" : "green"}>
                  {assessment.humanApprovalRequired ? "Human approval required" : "No review required"}
                </ToneBadge>
                <ToneBadge tone={assessment.executionAllowed ? "green" : "red"}>
                  {assessment.executionAllowed ? "Execution permitted" : "Execution prevented"}
                </ToneBadge>
              </div>
            </div>
            {assessment.aiExplanation && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-black/25 border border-white/5">
                <Sparkles className="h-4 w-4 text-brand-cyan mt-0.5 shrink-0" />
                <div className="text-[12px] text-gray-300 leading-relaxed">{assessment.aiExplanation}</div>
              </div>
            )}
            {typeof persisted === "boolean" && (
              <div className="mt-2 text-[10px] text-gray-500">
                {persisted ? "Audit record persisted." : "Audit record not persisted (Supabase unavailable — demo mode)."}
              </div>
            )}
          </div>

          {/* Compliance pipe */}
          <CompliancePipe assessment={assessment} />

          {/* Decision reasons */}
          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Why this decision</div>
            <ul className="space-y-1.5">
              {assessment.decisionReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-gray-300 leading-snug">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-cyan shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {/* Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <CounterpartyPanel screening={assessment.screening} />
            <MonitoringPanel monitoring={assessment.monitoring} />
            <RiskSummaryPanel risk={assessment.risk} />
            <div className="space-y-5">
              <PolicyPanel policy={assessment.policy} />
              <TravelRulePanel travelRule={assessment.travelRule} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
