"use client";

// =============================================================================
// IBAP Phase 8 — Risk Evaluation & Transaction Simulation · UI Panel
//
// Evaluates a payment plan BEFORE human approval:
//   - renders the 7 deterministic risk checks (PASS / WARN / FAIL)
//   - shows the deterministic 0-100 risk score + LOW / MEDIUM / HIGH badge
//   - displays the transaction simulation (recipient, token, amount, route,
//     gas, estimated total cost, txn count, warnings, expected result)
//   - shows the plain-English explanation grounded ONLY in validated data
//   - provides the explicit "Review Payment" human-approval gate.
//     The engine NEVER auto-executes — nothing is signed until the human
//     explicitly confirms.
//
// Modes:
//   - `result` prop   -> renders a controlled simulation result.
//   - `request` prop  -> POSTs to /api/risk/simulate when the request changes.
//   - neither         -> runs the built-in demo simulation (Route A vs B) so
//                        the panel always shows meaningful content.
// =============================================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  Eye,
  Fuel,
  Gauge,
  Layers,
  Loader2,
  Lock,
  Route,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import type {
  RiskCheckResult,
  SimulationRequest,
  SimulationResult,
  SimulationTreasury,
} from "@/lib/risk/types";
import { cn } from "@/lib/utils";

export interface RiskSimulationPanelProps {
  /** Simulation request to evaluate via POST /api/risk/simulate. */
  request?: SimulationRequest;
  /** Controlled simulation result (skips the API call). */
  result?: SimulationResult | null;
  loading?: boolean;
  error?: string | null;
  /** Human-approval callbacks (the engine never executes on its own). */
  onReview?: () => void;
  onReject?: () => void;
  /** Fired whenever the evaluated result changes (used by Phase 10 to share
   *  the same SimulationResult with the ApprovalPanel / execution timeline). */
  onResultChange?: (result: SimulationResult | null) => void;
  /** External execution state to reflect (executing / complete / failed). */
  approvalState?: "pending" | "reviewing" | "executing" | "complete" | "failed";
  /** Re-label the primary approval button (default "Review Payment"). */
  reviewLabel?: string;
  compact?: boolean;
  className?: string;
}

// -----------------------------------------------------------------------------
// Demo simulation — the canonical Phase 7 worked example:
//   Route A  Ethereum direct            Gas $18  Time 20s  1 tx   USDC 1,200
//   Route B  Ethereum -> Polygon USDC   Gas $4   Time 90s  3 tx   USDC 1,200
// -----------------------------------------------------------------------------

const DEMO_TREASURY: SimulationTreasury = {
  availableAssets: [
    { symbol: "USDC", balance: "25000", usdValue: 25000 },
    { symbol: "ETH", balance: "12.5", usdValue: 22500 },
  ],
  supportedChains: ["ethereum", "polygon", "arbitrum", "optimism", "base"],
  preferredChain: "ethereum",
  nativeGasBalance: "12.5",
  totalEstimatedUSDValue: 47500,
};

const DEMO_ROUTE_B: SimulationRequest = {
  payment: {
    recipient: "Acme Vendor",
    recipientAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    token: "USDC",
    amount: 1200,
  },
  route: {
    routeId: "routeB",
    name: "Ethereum → Polygon · USDC settle",
    chainSequence: ["ethereum", "polygon"],
    tokenSequence: ["USDC", "USDC"],
    transactionCount: 3,
    estimatedGas: 4,
    estimatedDuration: 90,
    strategy: "bridge_then_pay",
  },
  steps: [
    { order: 1, actionType: "CHECK_ALLOWANCE", title: "Verify treasury allowance", chain: "ethereum", token: "USDC" },
    { order: 2, actionType: "BRIDGE", title: "Bridge USDC to Polygon", chain: "ethereum", token: "USDC" },
    { order: 3, actionType: "TRANSFER", title: "Transfer USDC to Acme Vendor", chain: "polygon", token: "USDC" },
  ],
  treasury: DEMO_TREASURY,
  alternatives: [
    {
      routeId: "routeA",
      name: "Ethereum direct transfer",
      chainSequence: ["ethereum"],
      estimatedGas: 18,
      estimatedDuration: 20,
      transactionCount: 1,
    },
  ],
  sourceLabel: "demo",
};

// -----------------------------------------------------------------------------
// Small formatting helpers
// -----------------------------------------------------------------------------

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtAmount(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function recipientLabel(r: SimulationResult): string {
  if (r.payment.recipient) return r.payment.recipient;
  return r.payment.recipientAddress ? shortAddr(r.payment.recipientAddress) : "Unspecified";
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function CheckRow({ check }: { check: RiskCheckResult }) {
  const tone =
    check.status === "PASS"
      ? { icon: CheckCircle2, cls: "text-emerald-300", chip: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" }
      : check.status === "WARN"
      ? { icon: AlertTriangle, cls: "text-amber-300", chip: "bg-amber-500/15 border-amber-500/40 text-amber-300" }
      : { icon: XCircle, cls: "text-red-400", chip: "bg-red-500/15 border-red-500/40 text-red-300" };
  const Icon = tone.icon;
  return (
    <div className="flex items-start gap-2.5 py-2">
      <div
        className={cn(
          "mt-0.5 h-6 w-6 shrink-0 rounded-lg flex items-center justify-center border",
          tone.chip
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-gray-200">{check.label}</span>
          <span className={cn("text-[10px] font-mono font-bold", tone.cls)}>
            {check.status}
            {check.score > 0 ? ` · +${check.score}` : ""}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{check.message}</p>
        {check.detail && <p className="text-[9px] text-gray-600 leading-snug mt-0.5">{check.detail}</p>}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: string }) {
  return (
    <div className="p-3 rounded-xl bg-black/25 border border-white/5">
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("text-[13px] font-bold text-white truncate", accent)}>{value}</div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export function RiskSimulationPanel({
  request,
  result: resultProp,
  loading: loadingProp,
  error: errorProp,
  onReview,
  onReject,
  onResultChange,
  approvalState: approvalStateProp,
  reviewLabel = "Review Payment",
  compact,
  className,
}: RiskSimulationPanelProps) {
  const [localResult, setLocalResult] = useState<SimulationResult | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [highRiskAck, setHighRiskAck] = useState(false);

  const controlled = resultProp !== undefined && resultProp !== null;
  const result = resultProp ?? localResult;
  const loading = loadingProp ?? localLoading;
  const error = errorProp ?? localError;

  const activeRequest = request ?? DEMO_ROUTE_B;

  // Auto-evaluate the request whenever it changes (or once for the demo).
  useEffect(() => {
    if (controlled) return;
    let cancelled = false;
    setLocalLoading(true);
    setLocalError(null);
    fetch("/api/risk/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activeRequest),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || "Simulation failed");
        return data.result as SimulationResult;
      })
      .then((r) => {
        if (cancelled) return;
        setLocalResult(r);
        setReviewing(false);
        onResultChange?.(r);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLocalError(err instanceof Error ? err.message : "Simulation failed");
        onResultChange?.(null);
      })
      .finally(() => {
        if (!cancelled) setLocalLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, JSON.stringify(activeRequest)]);

  // Report the result upward in controlled mode so Phase 10 can reuse the same
  // SimulationResult (risk score + AI explanation) in the approval panel.
  useEffect(() => {
    if (resultProp !== undefined) onResultChange?.(resultProp ?? null);
  }, [resultProp, onResultChange]);

  // Reset the acknowledgement when a new result arrives.
  useEffect(() => {
    setHighRiskAck(false);
  }, [result?.simulationId]);

  const approvalState = approvalStateProp ?? (reviewing ? "reviewing" : "pending");

  const checks = useMemo(() => result?.checks ?? [], [result]);
  const levelTone: Record<string, string> = {
    LOW: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
    MEDIUM: "text-amber-300 border-amber-400/30 bg-amber-500/10",
    HIGH: "text-red-300 border-red-400/30 bg-red-500/10",
  };
  const LevelIcon = result?.riskLevel === "LOW" ? ShieldCheck : ShieldAlert;

  return (
    <div className={cn("glass-panel rounded-2xl border border-white/10 p-4 md:p-5 space-y-4", className)}>
      {/* ------------------------- Header ------------------------- */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 via-brand-accent to-brand-cyan flex items-center justify-center shadow-glow">
            <Gauge className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white tracking-tight">Risk & Simulation</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-full">
                Phase 8
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Deterministic pre-execution risk evaluation · human approval required
            </p>
          </div>
        </div>
        {result && (
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide", levelTone[result.riskLevel])}>
            <LevelIcon className="h-3.5 w-3.5" />
            {result.riskLevel} Risk · {result.riskScore}/100
          </div>
        )}
      </div>

      {/* ------------------------- Loading ------------------------- */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
          Evaluating payment & simulating execution…
        </div>
      )}

      {/* ------------------------- Error ------------------------- */}
      {!loading && error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* ------------------------- Result ------------------------- */}
      {!loading && !error && result && (
        <>
          {/* Risk gauge */}
          <div className="rounded-xl bg-black/25 border border-white/10 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Deterministic risk score</span>
              <span className="text-[10px] font-mono text-gray-500">
                checks {Math.round(result.riskBreakdown.total - result.riskBreakdown.amount)} · route + amount {Math.round(result.riskBreakdown.amount)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
              <div className="h-full bg-emerald-400/80 transition-all" style={{ width: `${Math.min(100, (result.riskScore / 100) * 100)}%` }} />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-gray-600 mt-1">
              <span>LOW 0</span>
              <span>33</span>
              <span>MEDIUM</span>
              <span>66</span>
              <span>HIGH 100</span>
            </div>
          </div>

          {/* Check matrix */}
          <div className="rounded-xl bg-black/25 border border-white/10 px-3.5 py-1 divide-y divide-white/5">
            <div className="flex items-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <ShieldCheck className="h-3 w-3 text-brand-cyan" /> Risk checks (7)
            </div>
            {checks.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </div>

          {/* Simulation summary */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
              <Sparkles className="h-3 w-3 text-brand-cyan" /> Simulated execution
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile icon={User} label="Recipient" value={recipientLabel(result)} accent={result.payment.recipientAddress ? "" : "text-amber-300"} />
              <StatTile icon={Coins} label="Token · Amount" value={`${fmtAmount(result.payment.amount)} ${result.payment.token}`} />
              <StatTile icon={Route} label="Route" value={result.route.chainSequence.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(" → ")} />
              <StatTile icon={Fuel} label="Gas" value={fmtUsd(result.totals.estimatedGasUsd)} />
              <StatTile icon={Layers} label="Transactions" value={`${result.totals.transactionCount} tx`} />
              <StatTile icon={Wallet} label="Total cost" value={fmtUsd(result.totals.estimatedTotalCostUsd)} accent="text-brand-cyan" />
              <StatTile icon={Gauge} label="Duration" value={fmtDuration(result.totals.estimatedDuration)} />
              <StatTile icon={Lock} label="Approval" value="Required" accent="text-amber-300" />
            </div>

            {/* Expected result */}
            <div className="mt-2 p-3 rounded-xl bg-brand-500/5 border border-brand-500/20">
              <div className="text-[9px] font-bold uppercase tracking-wider text-brand-300 mb-1">Expected result</div>
              <p className="text-[11px] text-gray-300 leading-relaxed">{result.expectedResult}</p>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className={cn(
              "rounded-xl border p-3 space-y-1.5",
              result.riskLevel === "HIGH"
                ? "bg-red-500/10 border-red-500/30"
                : result.riskLevel === "MEDIUM"
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-amber-500/5 border-amber-500/20"
            )}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Warnings ({result.warnings.length})
              </div>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-gray-300 leading-snug flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}

          {/* AI explanation — numbers only from validated data */}
          <div className="rounded-xl bg-gradient-to-br from-[#151a30] to-[#0d0f1c] border border-white/10 p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-cyan" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300">AI explanation</span>
              <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-300">
                <Lock className="h-2.5 w-2.5" />
                {result.explanationSource === "ai" ? "AI prose · numbers from data" : "deterministic · validated data only"}
              </span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">{result.explanation}</p>
          </div>
        </>
      )}

      {/* ------------------------- Approval gate ------------------------- */}
      {!loading && !error && result && (onReview || onReject) && (
        <div className="border-t border-white/10 pt-3.5">
          {approvalState === "executing" ? (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-200 text-[12px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing transaction in your wallet — review the details in MetaMask…
            </div>
          ) : approvalState === "complete" ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[12px] font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Payment approved and signed — nothing is sent until the transaction confirms.
            </div>
          ) : approvalState === "failed" ? (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-[12px]">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" /> Transaction rejected or failed. No funds were moved.
            </div>
          ) : reviewing ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-black/25 border border-white/10 p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Eye className="h-3 w-3" /> Final review — confirm before signing
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <div className="text-gray-500">Recipient</div>
                  <div className="text-gray-200 font-semibold truncate">{recipientLabel(result)}</div>
                  <div className="text-gray-500">Amount</div>
                  <div className="text-gray-200 font-semibold">{fmtAmount(result.payment.amount)} {result.payment.token}</div>
                  <div className="text-gray-500">Estimated total cost</div>
                  <div className="text-gray-200 font-semibold">{fmtUsd(result.totals.estimatedTotalCostUsd)}</div>
                  <div className="text-gray-500">Risk</div>
                  <div className={cn("font-bold", result.riskLevel === "HIGH" ? "text-red-300" : result.riskLevel === "MEDIUM" ? "text-amber-300" : "text-emerald-300")}>
                    {result.riskLevel} · {result.riskScore}/100
                  </div>
                  <div className="text-gray-500">Transactions</div>
                  <div className="text-gray-200 font-semibold">{result.totals.transactionCount} tx</div>
                </div>
                {result.warnings.length > 0 && (
                  <p className="text-[10px] text-amber-200/80 mt-1">⚠ {result.warnings.length} warning(s) — see above before signing.</p>
                )}
              </div>

              {result.riskLevel === "HIGH" && (
                <label className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highRiskAck}
                    onChange={(e) => setHighRiskAck(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 accent-red-500"
                  />
                  <span className="text-[11px] text-red-200 leading-snug">
                    I acknowledge this is a HIGH-risk payment and I take responsibility for approving it.
                  </span>
                </label>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setReviewing(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[12px] font-bold transition-all"
                >
                  Back
                </button>
                <button
                  onClick={onReview}
                  disabled={result.riskLevel === "HIGH" && !highRiskAck}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Sign
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {onReject && (
                <button
                  onClick={onReject}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[12px] font-bold transition-all"
                >
                  Reject
                </button>
              )}
              <button
                onClick={() => setReviewing(true)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-brand-accent to-brand-cyan hover:from-brand-500 hover:to-brand-500 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-glow transition-all"
              >
                <Eye className="h-4 w-4" />
                {reviewLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------- Footnote ------------------------- */}
      {!loading && !error && result && (
        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          <Lock className="h-3 w-3 text-gray-600" />
          Risk is deterministic and evaluated before approval. This engine never auto-executes — a human signature is always required.
        </div>
      )}
    </div>
  );
}
