"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Play,
  MessageSquareText,
  BrainCircuit,
  Landmark,
  Route,
  Calculator,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  FlaskConical,
  Sparkles,
  PenLine,
  Wallet as WalletIcon,
  BadgeCheck,
  History,
  ExternalLink,
  ChevronDown,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTreasury } from "@/hooks/useTreasury";
import { runDemoPipeline, DEFAULT_DEMO_INSTRUCTION, DEMO_CHAIN_ID } from "@/lib/demo/engine";
import { DEMO_STAGES, type DemoPipelineResult } from "@/lib/demo/types";
import { currencySymbol } from "@/lib/payment/planGenerator";
import { buildExplorerUrl } from "@/lib/payment/execution";
import { Banner } from "@/components/ui/banner";
import { SkeletonText } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn, formatAddress } from "@/lib/utils";
import { CompliancePipe } from "@/components/compliance/CompliancePipe";
import { CounterpartyPanel } from "@/components/compliance/CounterpartyPanel";
import { MonitoringPanel } from "@/components/compliance/MonitoringPanel";
import { RiskSummaryPanel } from "@/components/compliance/RiskSummaryPanel";
import { PolicyPanel } from "@/components/compliance/PolicyPanel";
import { TravelRulePanel } from "@/components/compliance/TravelRulePanel";
import { DecisionBadge, ToneBadge } from "@/components/compliance/ui";

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const RISK_TONE: Record<string, "emerald" | "amber" | "red"> = {
  LOW: "emerald",
  MEDIUM: "amber",
  HIGH: "red",
};

/** The 9-step primary workflow map — compliance merged into one layer, route optimization AFTER it. */
const WORKFLOW_STEPS: { label: string; sub?: string[]; description: string }[] = [
  {
    label: "Payment Instruction",
    description:
      "The operator types a business payment in plain English — no forms, no addresses to look up. The agent understands business language such as “Pay Alice $2,500 for invoice INV-1024 by Friday.”",
  },
  {
    label: "AI Intent",
    description:
      "The sentence is converted into a structured, validated intent. Recipient, amount, currency, invoice and deadline are extracted deterministically — payees resolve only against the verified vendor directory, never invented.",
  },
  {
    label: "Payment Plan",
    description:
      "The treasury is checked and the payment is planned: the requested currency is settled into USDC at the configured FX rate, and the vault must hold enough to fund the payout.",
  },
  {
    label: "Compliance Layer",
    sub: ["Counterparty Screening", "Transaction Monitoring", "Compliance Risk", "Policy Engine", "Travel Rule"],
    description:
      "The DPT compliance layer screens the transfer deterministically — counterparty screening, transaction monitoring, a unified compliance risk score, the policy engine and the Travel Rule. The engines decide ALLOW / REVIEW / BLOCK; the LLM never does.",
  },
  {
    label: "Route Optimization",
    description:
      "Multi-chain candidate routes are built and scored by a deterministic weighted model (gas, time, steps, risk). The lowest score wins — the AI does not choose the route, the math does.",
  },
  {
    label: "Risk Decision",
    description:
      "Execution mechanics are evaluated (7 checks) and the compliance decision is set. HIGH risk is flagged for a human; BLOCK prevents execution entirely.",
  },
  {
    label: "Human Approval",
    description:
      "Nothing executes automatically. The operator reviews recipient, amount, route, compliance decision and risk — and signs before anything moves.",
  },
  {
    label: "Blockchain Execution",
    description:
      "The approved plan becomes a validated, nonce-protected SmartWallet payload. The contract receives validated parameters only and never trusts the LLM.",
  },
  {
    label: "Audit",
    description:
      "Every stage is recorded with its source — AI-parsed intent, deterministic math, compliance decisions, human approval and on-chain events — as an immutable per-transaction record.",
  },
];

function CheckPill({ status }: { status: "PASS" | "WARN" | "FAIL" }) {
  const cls =
    status === "PASS"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
      : status === "WARN"
      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
      : "bg-rose-500/10 text-rose-300 border-rose-500/30";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>{status}</span>;
}

export function DemoWalkthrough() {
  const wallet = useWallet();
  const treasury = useTreasury(wallet.address, wallet.chainId, wallet.balance, wallet.tokenBalances);

  const [data, setData] = useState<DemoPipelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [highRiskAck, setHighRiskAck] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [workflowActive, setWorkflowActive] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runDemoPipeline({
        treasury: {
          availableAssets: treasury.availableAssets?.map((a) => ({
            symbol: a.symbol,
            balance: typeof a.balance === "string" ? a.balance : String(a.balance ?? ""),
            usdValue: a.usdValue ?? 0,
          })),
          supportedChains: treasury.supportedChains?.map((c) => (typeof c === "string" ? c : c.name)),
          preferredChain: treasury.preferredChain,
          totalEstimatedUSDValue: treasury.totalEstimatedUSDValue,
        },
      });
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Demo pipeline failed to run.");
    } finally {
      setLoading(false);
    }
  }, [treasury.availableAssets, treasury.supportedChains, treasury.preferredChain, treasury.totalEstimatedUSDValue]);

  useEffect(() => {
    load();
  }, [load]);

  const riskLevel = data?.simulation.riskLevel ?? "LOW";
  const riskTone = RISK_TONE[riskLevel] ?? "emerald";
  const isHighRisk = riskLevel === "HIGH";
  const complianceDecision = data?.compliance.decision ?? "ALLOW";
  const complianceBlocked = complianceDecision === "BLOCK";
  const approvalEnabled = (!isHighRisk || highRiskAck) && !complianceBlocked;

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const auditCount = useMemo(() => data?.audit.length ?? 0, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-2xl border border-white/10 p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-brand-500/60 animate-pulse" />
            <SkeletonText lines={2} className="flex-1 max-w-md" />
          </div>
          <SkeletonText lines={6} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl border border-white/10 p-6"><SkeletonText lines={8} /></div>
          <div className="glass-panel rounded-2xl border border-white/10 p-6"><SkeletonText lines={8} /></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Banner tone="error" title="Demo unavailable" message={error || "The demo pipeline could not be prepared."}>
        <button onClick={load} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-200 hover:text-white">
          <Loader2 className="h-3 w-3" /> Retry
        </button>
      </Banner>
    );
  }

  const { intent, settlement, plan, optimization, recommendedRoute, simulation, compliance, executionPlan, audit } = data;
  const explorerUrl = buildExplorerUrl(DEMO_CHAIN_ID, data.simulatedTxHash);
  return (
    <div className="space-y-8 pb-20">
      {/* ======================= Header ======================= */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-6 md:p-8 border border-white/10 shadow-glass">
        <div className="absolute -top-16 -right-16 w-72 h-72 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold">
            <Play className="h-3.5 w-3.5" />
            Product Demo · End-to-end pipeline
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            From instruction to audited transaction
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-3xl leading-relaxed">
            One realistic business scenario, run through the exact deterministic engines the live product
            uses. Watch PayMaster parse the intent, run it through the DPT compliance layer (counterparty
            screening, monitoring, compliance risk, policy, Travel Rule), optimize the route, evaluate
            execution risk, then prepare a SmartWallet execution — with a human signature required before
            anything moves.
          </p>

          <div className="p-4 rounded-2xl bg-black/30 border border-brand-500/30 flex items-start gap-3">
            <MessageSquareText className="h-5 w-5 text-brand-300 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Scenario</div>
              <div className="text-white font-semibold text-sm md:text-base">&ldquo;{data.instruction}&rdquo;</div>
            </div>
            <Link
              href={`/operations?prompt=${encodeURIComponent(DEFAULT_DEMO_INSTRUCTION)}`}
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500/20 border border-brand-500/40 text-brand-200 text-[11px] font-bold hover:bg-brand-500/30 transition-colors"
            >
              Try in live agent <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ======================= Pipeline map ======================= */}
      <div className="glass-panel rounded-2xl border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Route className="h-4 w-4 text-brand-cyan" />
          <h2 className="text-sm font-extrabold text-white">Primary workflow</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
          {WORKFLOW_STEPS.map((step, i) => {
            const active = workflowActive === i;
            return (
              <div key={step.label} className="relative flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setWorkflowActive((cur) => (cur === i ? null : i))}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2.5 text-center transition-all",
                    step.sub
                      ? active
                        ? "bg-brand-500/25 border-brand-500/60 shadow-glow"
                        : "bg-brand-500/10 border-brand-500/40 hover:bg-brand-500/20"
                      : active
                      ? "bg-brand-500/20 border-brand-500/50"
                      : "bg-white/[0.03] border-white/10 hover:bg-white/[0.07]"
                  )}
                >
                  <div className="text-[11px] font-bold text-brand-400">{String(i + 1).padStart(2, "0")}</div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-200 leading-tight">{step.label}</div>
                  {step.sub && (
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                      {step.sub.map((s) => (
                        <span
                          key={s}
                          className="px-1.5 py-0.5 rounded bg-brand-500/20 border border-brand-500/30 text-[9px] font-bold text-brand-300 leading-none"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-1.5 text-[10px] font-bold text-brand-400/80">
                    {active ? "▲ close" : "▼ expand"}
                  </div>
                </button>

                {i < WORKFLOW_STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-gray-600 shrink-0 hidden lg:block" />}
              </div>
            );
          })}
        </div>

        {/* Click-to-expand detail */}
        {workflowActive !== null && (
          <div className="mt-3 animate-fade-in rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-brand-400">{String(workflowActive + 1).padStart(2, "0")}</span>
                  <span className="text-base font-extrabold text-white">{WORKFLOW_STEPS[workflowActive].label}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-gray-300 leading-relaxed">{WORKFLOW_STEPS[workflowActive].description}</p>
              </div>
              <button
                type="button"
                onClick={() => setWorkflowActive(null)}
                className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-brand-400 hover:bg-white/5 hover:text-white"
              >
                ✕ close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================= 14 stages ======================= */}
      <div className="space-y-4">
        {/* 1 — Instruction */}
        <Stage n={1} title="Natural-language instruction" icon={<MessageSquareText className="h-4 w-4" />} sub={`“${data.instruction}”`}>
          <p className="text-sm text-gray-300">
            The operator types a payment instruction in plain English. No forms, no addresses to look up —
            the agent understands business language.
          </p>
          <div className="mt-3 p-3.5 rounded-xl bg-black/30 border border-white/10 font-mono text-sm text-white">
            {data.instruction}
          </div>
        </Stage>

        {/* 2 — Intent */}
        <Stage n={2} title="AI intent extraction" icon={<BrainCircuit className="h-4 w-4" />} sub={`${intent.action} · ${intent.recipientName ?? "—"} · ${currencySymbol(intent.currency)}${fmtNum(intent.amount ?? 0)} · INV-${intent.invoiceNumber ?? "—"} · ${(intent.confidence * 100).toFixed(0)}%`}>
          <p className="text-sm text-gray-300 mb-3">
            The agent converts the sentence into a structured, validated intent. Every field is checked —
            payees resolve only against the verified vendor directory, never invented.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Action" value={intent.action} />
            <Field label="Recipient" value={`${intent.recipientName ?? "—"}`} sub={intent.recipientAddress ? formatAddress(intent.recipientAddress) : "—"} />
            <Field label="Amount" value={`${currencySymbol(intent.currency)}${fmtNum(intent.amount ?? 0)}`} sub={`≈ ${fmtNum(settlement.settlementAmount)} ${settlement.settlementAsset}`} />
            <Field label="Invoice" value={intent.invoiceNumber ? `INV-${intent.invoiceNumber}` : "—"} />
            <Field label="Due" value={intent.deadlineLabel ?? "—"} sub={intent.deadlineDate ? new Date(intent.deadlineDate).toLocaleDateString() : undefined} />
            <Field label="Confidence" value={`${(intent.confidence * 100).toFixed(0)}%`} />
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              <span>Confidence</span>
              <span>{(intent.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-cyan"
                style={{ width: `${Math.min(100, intent.confidence * 100)}%` }}
              />
            </div>
          </div>
        </Stage>

        {/* 3 — Treasury */}
        <Stage n={3} title="Treasury check" icon={<Landmark className="h-4 w-4" />} sub={`${currencySymbol(intent.currency)}${fmtNum(intent.amount ?? 0)} → ${fmtNum(settlement.settlementAmount)} ${settlement.settlementAsset} @ FX ${fmtNum(settlement.fxRate)}`}>
          <p className="text-sm text-gray-300 mb-3">
            The treasury vault is checked deterministically. The requested currency is settled as USDC at
            the configured FX rate — the treasury must hold enough to fund the payout.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Requested" value={`${currencySymbol(intent.currency)}${fmtNum(intent.amount ?? 0)}`} />
            <Field label="FX rate" value={`${fmtNum(settlement.fxRate)} ${currencySymbol(intent.currency)} → ${settlement.settlementAsset}`} />
            <Field label="Settlement" value={`${fmtNum(settlement.settlementAmount)} ${settlement.settlementAsset}`} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Treasury holds:</span>
            {treasury.availableAssets?.map((a) => (
              <Badge key={a.symbol} tone={a.symbol.toUpperCase() === settlement.settlementAsset ? "emerald" : "neutral"}>
                {a.symbol} · {typeof a.balance === "number" ? fmtNum(a.balance) : a.balance ?? "0"}
              </Badge>
            ))}
          </div>
        </Stage>

        {/* 4 — Compliance layer (merged: screening, monitoring, compliance risk, policy, travel rule) */}
        <Stage n={4} title="Compliance layer" icon={<ShieldCheck className="h-4 w-4" />} sub={`${compliance.screening.verdict} · ${compliance.monitoring.signals.length === 0 ? "normal" : `${compliance.monitoring.signals.length} signal(s)`} · ${Math.round(compliance.risk.score)}/100 ${compliance.risk.level} · ${compliance.travelRule.status} · ${compliance.decision}`}>
          <p className="text-sm text-gray-300 mb-4">
            Before any route is chosen or money moves, the deterministic compliance layer screens the
            transfer: counterparty screening, transaction monitoring, a unified compliance risk score, the
            policy engine and the Travel Rule. The LLM never decides — the engines do.
          </p>

          {/* Full compliance pipe */}
          <CompliancePipe assessment={compliance} />

          {/* Five deterministic sub-workflows */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <CounterpartyPanel screening={compliance.screening} />
            <MonitoringPanel monitoring={compliance.monitoring} />
            <RiskSummaryPanel risk={compliance.risk} />
            <div className="space-y-4">
              <PolicyPanel policy={compliance.policy} />
              <TravelRulePanel travelRule={compliance.travelRule} />
            </div>
          </div>

          {/* Decision + reasons */}
          <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Why this decision</div>
            <ul className="space-y-1.5">
              {compliance.decisionReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-gray-300 leading-snug">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-cyan shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <ToneBadge tone={compliance.humanApprovalRequired ? "yellow" : "green"}>
                {compliance.humanApprovalRequired ? "Human approval required" : "No review required"}
              </ToneBadge>
              <ToneBadge tone={compliance.executionAllowed ? "green" : "red"}>
                {compliance.executionAllowed ? "Execution permitted" : "Execution prevented"}
              </ToneBadge>
            </div>
          </div>
        </Stage>

        {/* 5 — Candidate routes (route optimization runs AFTER the compliance layer) */}
        <Stage n={5} title="Candidate routes" icon={<Route className="h-4 w-4" />} sub={`${plan.routes.length} strategies · ${plan.routes.map((r) => r.chain).join(" · ")}`}>
          <p className="text-sm text-gray-300 mb-3">
            The planner builds viable multi-chain strategies. The LLM may propose strategy families, but the
            routes themselves are constructed deterministically.
          </p>
          <div className="space-y-2">
            {plan.routes.map((r) => (
              <div
                key={r.id}
                className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border ${
                  r.isRecommended ? "bg-brand-500/10 border-brand-500/40" : "bg-white/[0.03] border-white/10"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-white">{r.routeName}</div>
                  <div className="text-[11px] text-gray-500 capitalize">{r.chain} · {r.transactionCount} tx</div>
                </div>
                <MiniStat label="Gas" value={fmtUsd(r.estimatedGas)} />
                <MiniStat label="Time" value={`${r.estimatedTime}s`} />
                <MiniStat label="Risk" value={`${r.riskScore}/100`} />
                {r.isRecommended && <Badge tone="brand">Recommended</Badge>}
              </div>
            ))}
          </div>
        </Stage>

        {/* 6 — Scoring */}
        <Stage n={6} title="Mathematical route scoring" icon={<Calculator className="h-4 w-4" />} sub="Score(r) = 0.40·Gas + 0.20·Time + 0.15·Steps + 0.25·Risk (lower wins)">
          <p className="text-sm text-gray-300 mb-3">
            Every candidate is scored by a deterministic weighted model — the AI does not choose the route,
            the math does.
          </p>
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 font-mono text-xs text-gray-300 mb-4">
            Score(r) = 0.40·Gas + 0.20·Time + 0.15·Steps + 0.25·Risk&nbsp;&nbsp;<span className="text-gray-500">(lower is better)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-[10px] uppercase tracking-wider text-left">
                  <th className="pb-2 font-bold">Route</th>
                  <th className="pb-2 font-bold text-right">Gas</th>
                  <th className="pb-2 font-bold text-right">Time</th>
                  <th className="pb-2 font-bold text-right">Steps</th>
                  <th className="pb-2 font-bold text-right">Risk</th>
                  <th className="pb-2 font-bold text-right">Score</th>
                  <th className="pb-2 font-bold text-right">Rank</th>
                </tr>
              </thead>
              <tbody>
                {optimization.routes.map((r) => (
                  <tr key={r.routeId} className="border-t border-white/5">
                    <td className="py-2.5 font-semibold text-gray-200 pr-3">{r.name}</td>
                    <td className="py-2.5 text-right tabular">{r.factorBreakdown.gas.toFixed(2)}</td>
                    <td className="py-2.5 text-right tabular">{r.factorBreakdown.time.toFixed(2)}</td>
                    <td className="py-2.5 text-right tabular">{r.factorBreakdown.steps.toFixed(2)}</td>
                    <td className="py-2.5 text-right tabular">{r.factorBreakdown.risk.toFixed(2)}</td>
                    <td className="py-2.5 text-right tabular font-bold text-white">{(r.normalizedScore * 100).toFixed(1)}</td>
                    <td className="py-2.5 text-right">{r.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Stage>

        {/* 7 — Recommended */}
        <Stage n={7} title="Recommended route" icon={<CheckCircle2 className="h-4 w-4" />} sub={recommendedRoute ? `${recommendedRoute.name} · score ${(recommendedRoute.normalizedScore * 100).toFixed(1)}` : "No feasible route"}>
          {recommendedRoute ? (
            <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/40 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-extrabold text-white">{recommendedRoute.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {recommendedRoute.chainSequence.join(" → ")} · {recommendedRoute.transactionCount} on-chain tx
                  </div>
                </div>
                <Badge tone="brand">Score {(recommendedRoute.normalizedScore * 100).toFixed(1)}</Badge>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{recommendedRoute.recommendationReason}</p>
              <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                <span className="px-2 py-1 rounded-lg bg-black/25 border border-white/10">Gas {fmtUsd(recommendedRoute.estimatedGas)}</span>
                <span className="px-2 py-1 rounded-lg bg-black/25 border border-white/10">~{recommendedRoute.estimatedDuration}s</span>
                <span className="px-2 py-1 rounded-lg bg-black/25 border border-white/10">
                  Saves {fmtUsd(recommendedRoute.estimatedSavings)} vs baseline
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No feasible route was found.</p>
          )}
        </Stage>

        {/* 8 — Risk */}
        <Stage n={8} title="Risk assessment" icon={<ShieldAlert className="h-4 w-4" />} sub={`${simulation.riskScore}/100 · ${riskLevel} · ${simulation.checks.length} deterministic checks`}>
          <p className="text-sm text-gray-300 mb-3">
            Seven deterministic checks evaluate the execution mechanics of the payment. HIGH risk is never
            blocked — it is flagged so a human decides. Regulatory &amp; treasury compliance is checked
            separately by the compliance layer in stage 4.
          </p>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="text-3xl font-extrabold text-white tabular">{simulation.riskScore}<span className="text-sm text-gray-500 font-semibold">/100</span></div>
            <Badge tone={riskTone}>{riskLevel}</Badge>
            <span className="text-xs text-gray-500">{simulation.approval.note}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {simulation.checks.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div>
                  <div className="text-[12px] font-semibold text-gray-200">{c.label}</div>
                  <div className="text-[11px] text-gray-500">{c.message}</div>
                </div>
                <CheckPill status={c.status} />
              </div>
            ))}
          </div>
        </Stage>

        {/* 9 — Simulation */}
        <Stage n={9} title="Transaction simulation" icon={<FlaskConical className="h-4 w-4" />} sub={`${simulation.totals.transactionCount} tx · gas ${fmtUsd(simulation.totals.estimatedGasUsd)} · total ${fmtUsd(simulation.totals.estimatedTotalCostUsd)}`}>
          <p className="text-sm text-gray-300 mb-3">
            The payment is simulated before execution: expected result, gas, bridge fees, slippage and
            total cost — all deterministic.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MiniStat label="Transactions" value={`${simulation.totals.transactionCount}`} />
            <MiniStat label="Gas" value={fmtUsd(simulation.totals.estimatedGasUsd)} />
            <MiniStat label="Bridge fee" value={fmtUsd(simulation.totals.estimatedBridgeFeeUsd)} />
            <MiniStat label="Slippage" value={fmtUsd(simulation.totals.estimatedSlippageUsd)} />
            <MiniStat label="Total cost" value={fmtUsd(simulation.totals.estimatedTotalCostUsd)} accent />
          </div>
          <div className="mt-4 p-3.5 rounded-xl bg-black/30 border border-white/10 text-xs text-gray-300 leading-relaxed">
            {simulation.expectedResult}
          </div>
        </Stage>

        {/* 10 — Explanation */}
        <Stage n={10} title="AI explanation" icon={<Sparkles className="h-4 w-4" />} sub="Plain-English summary — only references validated data">
          <p className="text-sm text-gray-300 mb-3">
            The agent explains the payment in plain English — but it can only reference figures that already
            exist in the validated simulation. The AI explains verified data; it never invents numbers.
          </p>
          <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20 text-sm text-gray-200 leading-relaxed">
            {simulation.explanation}
          </div>
          <div className="mt-2 text-[10px] text-gray-500">
            Source: <Badge tone={simulation.explanationSource === "ai" ? "brand" : "neutral"}>{simulation.explanationSource}</Badge>{" "}
            · numbers stripped of AI-authored figures by design
          </div>
        </Stage>

        {/* 11 — Approval */}
        <Stage n={11} title="Human approval" icon={<PenLine className="h-4 w-4" />} sub={`${complianceDecision} · ${complianceBlocked ? "approval disabled" : "signature required"}`}>
          <p className="text-sm text-gray-300 mb-3">
            Nothing executes automatically. The operator reviews the recipient, amount, route, compliance
            decision and risk — and signs. {isHighRisk && "This is a HIGH-risk payment, so an explicit acknowledgement is required."}
            {complianceBlocked && " This transfer is BLOCKED by compliance policy — the approval path is disabled."}
          </p>
          <div className="p-4 rounded-xl bg-black/25 border border-white/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            <div><div className="text-[10px] text-gray-500 font-bold uppercase">To</div><div className="text-gray-200 font-semibold truncate">{formatAddress(intent.recipientAddress ?? "")}</div></div>
            <div><div className="text-[10px] text-gray-500 font-bold uppercase">Amount</div><div className="text-gray-200 font-semibold">{fmtNum(settlement.settlementAmount)} {settlement.settlementAsset}</div></div>
            <div><div className="text-[10px] text-gray-500 font-bold uppercase">Route</div><div className="text-gray-200 font-semibold">{recommendedRoute?.name ?? "—"}</div></div>
            <div><div className="text-[10px] text-gray-500 font-bold uppercase">Execution risk</div><div className="text-gray-200 font-semibold">{simulation.riskScore}/100 · {riskLevel}</div></div>
            <div><div className="text-[10px] text-gray-500 font-bold uppercase">Compliance</div><div className="text-gray-200 font-semibold"><DecisionBadge decision={complianceDecision} /></div></div>
          </div>

          {complianceBlocked ? (
            <div className="mt-4">
              <Banner tone="error" title="Blocked by compliance" message="This transfer was BLOCKED by the deterministic compliance layer — the approval/execution path is disabled." />
            </div>
          ) : approved ? (
            <div className="mt-4 animate-fade-in">
              <Banner tone="success" title="Approved" message={`Approval recorded for ${fmtNum(settlement.settlementAmount)} ${settlement.settlementAsset} to ${intent.recipientName}.`} />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {isHighRisk && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highRiskAck}
                    onChange={(e) => setHighRiskAck(e.target.checked)}
                    className="mt-0.5 accent-rose-500"
                  />
                  <span>I acknowledge this is a HIGH-risk payment and I authorise the payout.</span>
                </label>
              )}
              <button
                onClick={() => setApproved(true)}
                disabled={!approvalEnabled}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-on-accent text-sm font-bold shadow-glow-emerald hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <BadgeCheck className="h-4 w-4" />
                Approve &amp; sign {isHighRisk && !highRiskAck ? "(acknowledge first)" : "(simulated)"}
              </button>
              <span className="text-[10px] text-gray-500 ml-2">Demo: signing is simulated — no wallet prompt, no funds move.</span>
            </div>
          )}
        </Stage>

        {/* 12 — SmartWallet execution */}
        <Stage n={12} title="SmartWallet execution" icon={<WalletIcon className="h-4 w-4" />} sub={`transferToken(${executionPlan.tokenAddress ? formatAddress(executionPlan.tokenAddress) : "native"}, ${executionPlan.amountWei} wei) · nonce-protected`}>
          <p className="text-sm text-gray-300 mb-3">
            The approved plan becomes a validated SmartWallet payload. Every mutative call is gated by an
            incrementing nonce (replay protection) and re-entrancy guard.
          </p>
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-2 text-[11px] font-mono">
            <div className="text-gray-500">SmartWallet <span className="text-brand-300">{formatAddress(executionPlan.smartWalletAddress)}</span> · chain {executionPlan.chainId}</div>
            {executionPlan.steps.filter((s) => s.tx).map((s) => (
              <div key={s.order} className="text-gray-300">
                <span className="text-brand-400">{s.actionType}</span> → {s.tx?.kind === "transferToken" ? (
                  <span>transferToken({executionPlan.tokenAddress ? formatAddress(executionPlan.tokenAddress) : "native"}, {executionPlan.amountWei} wei)</span>
                ) : s.tx?.kind === "executeTransaction" ? (
                  <span>executeTransaction(value={executionPlan.amountWei} wei)</span>
                ) : (
                  <span>approveToken({s.tx?.spender ? formatAddress(s.tx.spender) : "—"})</span>
                )}
                <span className="text-gray-600"> // nonce-incremented</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-500">
            The SmartWallet executes on-chain only after a human signature. The contract never trusts the LLM —
            it receives validated parameters only.
          </p>
        </Stage>

        {/* 13 — Confirmation */}
        <Stage n={13} title="Transaction confirmation" icon={<BadgeCheck className="h-4 w-4" />} sub={approved ? "CONFIRMED (SIMULATED)" : "Awaiting approval (stage 11)"}>
          {approved ? (
            <div className="space-y-3 animate-fade-in">
              <Banner tone="success" title="Transaction confirmed" message="Status CONFIRMED (SIMULATED in this demo — no funds moved on-chain)." />
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-black/25 border border-white/10">
                <span className="text-[11px] font-mono text-gray-400 truncate">{data.simulatedTxHash}</span>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-300 hover:text-white"
                  >
                    View on explorer <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Awaiting the approval in stage 11 — confirmation is only shown once a human signs.
            </p>
          )}
        </Stage>

        {/* 14 — Audit */}
        <Stage n={14} title="Audit history" icon={<History className="h-4 w-4" />} sub={`${auditCount} deterministic entries · AI / math / human / chain`}>
          <p className="text-sm text-gray-300 mb-3">
            Every stage is recorded with its source: AI-parsed intent, deterministic math, compliance
            decisions, human approval and on-chain events. Fully auditable.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-[10px] uppercase tracking-wider text-left">
                  <th className="pb-2 font-bold">#</th>
                  <th className="pb-2 font-bold">Event</th>
                  <th className="pb-2 font-bold">Detail</th>
                  <th className="pb-2 font-bold">Source</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="py-2 pr-2 text-gray-500">{String(e.stage).padStart(2, "0")}</td>
                    <td className="py-2 pr-3 font-semibold text-gray-200 whitespace-nowrap">{e.label}</td>
                    <td className="py-2 pr-3 text-gray-400">{e.detail}</td>
                    <td className="py-2"><Badge tone={e.source === "human" ? "amber" : e.source === "chain" ? "cyan" : e.source === "ai" ? "violet" : "neutral"}>{e.source}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-gray-500">{auditCount} deterministic audit entries · immutable per-tx record in the treasury store.</p>
        </Stage>
      </div>

      {/* ======================= CTA ======================= */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center glass-panel rounded-2xl border border-white/10 p-5">
        <div className="flex-1">
          <div className="text-sm font-extrabold text-white">See it live</div>
          <p className="text-xs text-gray-500">Run this exact instruction through the interactive agent — connect a wallet to execute for real.</p>
        </div>
        <Link
          href={`/operations?prompt=${encodeURIComponent(DEFAULT_DEMO_INSTRUCTION)}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-brand-accent to-brand-cyan text-on-accent text-sm font-bold shadow-glow hover:from-brand-500 hover:to-brand-500 transition-all"
        >
          <Play className="h-4 w-4" /> Open Financial Assistant
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-bold hover:bg-white/10 hover:text-white transition-all"
        >
          Business dashboard
        </Link>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Stage wrapper — numbered card with collapsible body
// -----------------------------------------------------------------------------

function Stage({
  n,
  title,
  icon,
  sub,
  children,
}: {
  n: number;
  title: string;
  icon: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden animate-fade-in">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-500/25 to-brand-cyan/20 border border-brand-500/30 flex items-center justify-center text-brand-300 text-xs font-extrabold shrink-0">
          {String(n).padStart(2, "0")}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-brand-400">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-white leading-tight">{title}</div>
            {sub && <div className="mt-0.5 truncate text-[11px] text-gray-500 leading-tight">{sub}</div>}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-[13px] font-bold text-white mt-0.5 truncate">{value}</div>
      {sub && <div className="text-[11px] text-gray-500 font-mono truncate">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border ${accent ? "bg-brand-500/10 border-brand-500/40" : "bg-black/25 border-white/10"}`}>
      <div className="text-[10px] text-gray-500 font-bold uppercase">{label}</div>
      <div className={`text-sm font-extrabold tabular ${accent ? "text-brand-200" : "text-white"}`}>{value}</div>
    </div>
  );
}
