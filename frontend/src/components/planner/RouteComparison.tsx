"use client";

// =============================================================================
// PayMaster Phase 7 — Deterministic Route Optimization · Route Comparison
//
// Renders the output of POST /api/route/optim: every candidate payment route
// scored by the normalized weighted model (LOWER IS BETTER), ranked best-first,
// with the recommended route highlighted.
//
// Modes:
//   - `routes` prop     -> renders pre-optimized routes (controlled).
//   - `plans` prop      -> calls the optimizer API with the Phase 6 plans.
//   - neither           -> renders the built-in demo candidates (A vs B) so the
//                          component always shows meaningful content.
// =============================================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Crown,
  Fuel,
  Gauge,
  Layers,
  Loader2,
  RotateCw,
  Route,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import type { CandidateExecutionPlan } from "@/lib/planner/types";
import { fromPlannerPlans, optimizeRoutes } from "@/lib/route/optimizer";
import type {
  OptimizedRoute,
  RouteOptimizerRequest,
  RouteOptimizerResult,
  RouteTreasuryContext,
  RouteWeights,
} from "@/lib/route/types";
import { cn } from "@/lib/utils";

export interface RouteComparisonProps {
  /** Pre-optimized routes (result of the engine / API). */
  routes?: OptimizedRoute[];
  /** Phase 6 candidate plans to optimize via the API. */
  plans?: CandidateExecutionPlan[];
  /** Treasury context forwarded to the optimizer (chain preference + balance gate). */
  treasuryContext?: RouteTreasuryContext;
  loading?: boolean;
  error?: string | null;
  /** Callback with the freshly optimized result (if plans were provided). */
  onOptimized?: (result: RouteOptimizerResult) => void;
  className?: string;
}

// -----------------------------------------------------------------------------
// Demo candidates — the canonical worked example from the spec:
//   Route A  Ethereum direct            Gas $18  Time 20s  Steps 1  Risk Low
//   Route B  Ethereum -> Polygon USDC   Gas $4   Time 90s  Steps 3  Risk Medium
// -----------------------------------------------------------------------------

const DEMO_TREASURY: RouteTreasuryContext = {
  preferredChain: "ethereum",
  targetChain: null,
  availableAssets: [
    { symbol: "USDC", balance: "25000", usdValue: 25000 },
    { symbol: "ETH", balance: "12.5", usdValue: 22500 },
  ],
};

const DEMO_REQUEST: RouteOptimizerRequest = {
  routes: [
    {
      routeId: "routeA",
      name: "Ethereum direct transfer",
      description: "Pay USDC directly on Ethereum in a single transaction.",
      chainSequence: ["ethereum"],
      tokenSequence: ["USDC"],
      transactionCount: 1,
      estimatedGas: 18,
      estimatedDuration: 20,
      riskScore: 8,
      fundingAsset: "USDC",
      strategy: "native_direct",
      source: "deterministic",
    },
    {
      routeId: "routeB",
      name: "Ethereum → Polygon · USDC settle",
      description: "Bridge USDC to Polygon then pay — cheaper gas, slower, riskier.",
      chainSequence: ["ethereum", "polygon"],
      tokenSequence: ["USDC", "USDC"],
      transactionCount: 3,
      estimatedGas: 4,
      estimatedDuration: 90,
      riskScore: 35,
      fundingAsset: "USDC",
      strategy: "bridge_then_pay",
      source: "deterministic",
    },
  ],
  treasury: DEMO_TREASURY,
};

const WEIGHT_COLORS: Record<keyof RouteWeights, string> = {
  gas: "bg-brand-500",
  time: "bg-brand-cyan",
  steps: "bg-brand-accent",
  risk: "bg-emerald-500",
};

const WEIGHT_LABELS: Record<keyof RouteWeights, string> = {
  gas: "Gas",
  time: "Time",
  steps: "Steps",
  risk: "Risk",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatGas(usd: number): string {
  return `$${usd.toFixed(usd >= 1 ? 2 : 3)}`;
}

function riskTone(score: number): string {
  if (score >= 50) return "text-red-400";
  if (score >= 25) return "text-amber-300";
  return "text-emerald-300";
}

/** Tiny normalized factor bar (0 = best … 1 = worst). */
function FactorBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round((1 - value) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-[9px] font-bold uppercase tracking-wide text-gray-500">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 text-right text-[9px] font-mono text-gray-400">{value.toFixed(2)}</span>
    </div>
  );
}

export function RouteComparison({
  routes: routesProp,
  plans,
  treasuryContext,
  loading: loadingProp,
  error: errorProp,
  onOptimized,
  className,
}: RouteComparisonProps) {
  const [localRoutes, setLocalRoutes] = useState<OptimizedRoute[] | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>("demo");
  const [refreshKey, setRefreshKey] = useState(0);

  const loading = loadingProp ?? localLoading;
  const error = errorProp ?? localError;

  // Auto-optimize Phase 6 plans whenever they change and no routes are supplied.
  useEffect(() => {
    if (routesProp) {
      setLocalRoutes(null);
      return;
    }
    if (!plans || !plans.length) return;
    let cancelled = false;
    setLocalLoading(true);
    setLocalError(null);
    const request: RouteOptimizerRequest = {
      routes: fromPlannerPlans(plans),
      treasury: treasuryContext,
    };
    fetch("/api/route/optim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || "Optimization failed");
        }
        return data.result as RouteOptimizerResult;
      })
      .then((result) => {
        if (cancelled) return;
        setLocalRoutes(result.routes);
        setSourceLabel(result.source);
        onOptimized?.(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLocalError(err instanceof Error ? err.message : "Optimization failed");
      })
      .finally(() => {
        if (!cancelled) setLocalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plans, routesProp, treasuryContext, onOptimized, refreshKey]);

  // Demo mode: deterministic in-browser run of the spec's worked example.
  const demoResult = useMemo(() => {
    if (routesProp || (plans && plans.length) || localRoutes) return null;
    return optimizeRoutes(DEMO_REQUEST);
  }, [routesProp, plans, localRoutes]);

  const routes = useMemo(() => {
    if (routesProp) return routesProp;
    if (localRoutes) return localRoutes;
    return demoResult?.routes ?? [];
  }, [routesProp, localRoutes, demoResult]);

  const weights: RouteWeights = demoResult?.weights ?? {
    gas: 0.4,
    time: 0.2,
    steps: 0.15,
    risk: 0.25,
  };

  const recommended = routes.find((r) => r.isRecommended) ?? routes[0];
  const hasFeasible = routes.some((r) => !r.infeasible);

  // Gas-saving / speed leaders for the optimisation badges.
  const feasible = routes.filter((r) => !r.infeasible);
  const cheapest = useMemo(() => {
    if (!feasible.length) return undefined;
    return feasible.reduce((a, b) => (b.estimatedGas < a.estimatedGas ? b : a));
  }, [feasible]);
  const fastest = useMemo(() => {
    if (!feasible.length) return undefined;
    return feasible.reduce((a, b) => (b.estimatedDuration < a.estimatedDuration ? b : a));
  }, [feasible]);
  const maxGas = useMemo(() => Math.max(...routes.map((r) => r.estimatedGas), 0.001), [routes]);

  const reRun = () => {
    setLocalError(null);
    if (plans && plans.length) {
      setLocalLoading(true);
      setLocalRoutes(null);
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className={cn("glass-panel rounded-2xl border border-white/10 p-5 space-y-5", className)}>
      {/* ------------------------- Header ------------------------- */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-600 via-brand-accent to-mint-300 flex items-center justify-center shadow-glow">
            <Route className="h-5 w-5 text-on-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white tracking-tight">Route Optimization</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-full">
                Phase 7
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Deterministic weighted scoring · lower score wins · final decision by math, not AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300">
            <Sparkles className="h-3 w-3 text-brand-300" />
            {routesProp ? "Optimized" : plans?.length ? "Planner candidates" : "Demo candidates"}
          </span>
          {plans && plans.length > 0 && !loading && (
            <button
              onClick={reRun}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <RotateCw className="h-3 w-3" />
              Re-run
            </button>
          )}
        </div>
      </div>

      {/* ------------------------- Weights model ------------------------- */}
      <div className="rounded-xl bg-black/25 border border-white/10 p-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Scoring model · Score(r) = wg·Gas + wt·Time + ws·Steps + wr·Risk
          </span>
          <span className="text-[9px] font-mono text-gray-500">Σ w = 1.00</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(WEIGHT_LABELS) as (keyof RouteWeights)[]).map((k) => (
            <div key={k}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-gray-300">{WEIGHT_LABELS[k]}</span>
                <span className="text-[10px] font-mono text-gray-400">{(weights[k] * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn("h-full rounded-full", WEIGHT_COLORS[k])}
                  style={{ width: `${Math.round(weights[k] * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------- Status / empty ------------------------- */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
          Optimizing {plans?.length ?? 0} candidate routes…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && !routes.length && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Route className="h-6 w-6 text-gray-500" />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-300">No routes to compare</p>
          <p className="mt-1 text-xs text-gray-500 max-w-xs">
            Run the planner or provide candidate routes to see the optimizer ranking.
          </p>
        </div>
      )}

      {/* ------------------------- Recommended banner ------------------------- */}
      {!loading && !error && recommended && !recommended.infeasible && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-mint-300 flex items-center justify-center shadow-glow">
            <Crown className="h-4.5 w-4.5 text-on-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                Recommended route
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-200 text-[9px] font-extrabold uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5" /> Optimized
              </span>
            </div>
            <p className="text-sm font-bold text-gray-100 mt-0.5">
              {recommended.name}
              <span className="ml-2 text-[10px] font-mono font-normal text-emerald-300/80">
                score {recommended.normalizedScore.toFixed(3)}
              </span>
            </p>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed">{recommended.recommendationReason}</p>
            {recommended.estimatedSavings > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                <TrendingDown className="h-3.5 w-3.5" />
                Saves {formatGas(recommended.estimatedSavings)} vs highest-gas route
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !error && !hasFeasible && routes.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <ShieldCheck className="h-4.5 w-4.5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
              No fundable route
            </div>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed">
              None of the candidate routes can be funded from the current treasury balance. All are retained with
              an infeasibility penalty so you can still compare them.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------- Route table ------------------------- */}
      {!loading && !error && routes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wider text-gray-500 border-b border-white/10">
                <th className="py-2 pr-3">Route</th>
                <th className="py-2 pr-3">Gas</th>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Steps</th>
                <th className="py-2 pr-3">Risk</th>
                <th className="py-2 pr-3">Savings</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => {
                const isRec = route.isRecommended;
                const chainChips = route.chainSequence.map((c) => c.toLowerCase());
                return (
                  <tr
                    key={route.routeId}
                    className={cn(
                      "border-b border-white/5 align-top",
                      isRec ? "bg-emerald-500/[0.06]" : route.infeasible ? "opacity-70" : "hover:bg-white/[0.03]"
                    )}
                  >
                    {/* Route */}
                    <td className="py-3 pr-3">
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-0.5 h-5 w-5 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-extrabold",
                            isRec
                              ? "bg-gradient-to-br from-emerald-500 to-mint-300 text-on-accent"
                              : "bg-white/10 text-gray-400"
                          )}
                        >
                          {route.rank}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn("text-xs font-bold", isRec ? "text-emerald-200" : "text-gray-100")}>
                              {route.name}
                            </span>
                            {isRec && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 animate-step-pop" />}
                            {isRec && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-500/20 border border-brand-500/40 text-brand-200 text-[8px] font-extrabold uppercase tracking-wider">
                                <Sparkles className="h-2.5 w-2.5" /> Optimized
                              </span>
                            )}
                            {!isRec && cheapest && route.routeId === cheapest.routeId && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-mint-300/15 border border-mint-300/40 text-mint-300 text-[8px] font-extrabold uppercase tracking-wider">
                                <Fuel className="h-2.5 w-2.5" /> Cheapest gas
                              </span>
                            )}
                            {!isRec && fastest && route.routeId === fastest.routeId && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-cyan/15 border border-brand-cyan/40 text-brand-cyan text-[8px] font-extrabold uppercase tracking-wider">
                                <Clock className="h-2.5 w-2.5" /> Fastest
                              </span>
                            )}
                            {route.infeasible && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/40 text-[9px] font-bold text-red-300">
                                <ShieldCheck className="h-2.5 w-2.5" /> UNFUNDED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {chainChips.map((c, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && <ArrowRight className="h-3 w-3 text-gray-600" />}
                                <span className="px-1.5 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 text-[9px] font-bold text-brand-300">
                                  {c}
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {route.tokenSequence.map((t, i) => (
                              <span key={i} className="text-[9px] font-mono text-gray-500">
                                {i > 0 && "→"}
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Gas */}
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1 text-xs font-semibold text-white">
                        <Fuel className="h-3 w-3 text-gray-500" />
                        {formatGas(route.estimatedGas)}
                      </div>
                      {route.factorBreakdown.gas > 0.5 && (
                        <span className="text-[9px] text-amber-300/80">gas heavy</span>
                      )}
                    </td>

                    {/* Time */}
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1 text-xs font-semibold text-white">
                        <Clock className="h-3 w-3 text-gray-500" />
                        {formatDuration(route.estimatedDuration)}
                      </div>
                    </td>

                    {/* Steps */}
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1 text-xs font-semibold text-white">
                        <Layers className="h-3 w-3 text-gray-500" />
                        {route.transactionCount} tx
                      </div>
                    </td>

                    {/* Risk */}
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1 text-xs font-semibold">
                        <ShieldCheck className="h-3 w-3 text-gray-500" />
                        <span className={riskTone(route.riskScore)}>{route.riskScore}/100</span>
                      </div>
                      {route.chainPreference.matches && (
                        <span className="flex items-center gap-0.5 text-[9px] text-brand-300/80">
                          <Gauge className="h-2.5 w-2.5" /> pref. chain
                        </span>
                      )}
                    </td>

                    {/* Savings — gas-saving indicator */}
                    <td className="py-3 pr-3">
                      {route.estimatedSavings > 0 ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold shadow-glow-emerald">
                            <TrendingDown className="h-3 w-3" />
                            {formatGas(route.estimatedSavings)}
                          </span>
                          <div className="mt-1 text-[9px] text-emerald-300/70">
                            {Math.round((1 - route.estimatedGas / maxGas) * 100)}% less gas
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>

                    {/* Score */}
                    <td className="py-3 pr-3">
                      <div className="text-xs font-bold font-mono text-white">{route.normalizedScore.toFixed(3)}</div>
                      <div className="text-[9px] text-gray-500">opt. {route.optimizationScore.toFixed(0)}/100</div>
                      <div className="mt-1 h-1 w-16 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            route.optimizationScore >= 75
                              ? "bg-emerald-400"
                              : route.optimizationScore >= 50
                                ? "bg-brand-cyan"
                                : "bg-amber-400"
                          )}
                          style={{ width: `${Math.round(route.optimizationScore)}%` }}
                        />
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="py-3">
                      <p className="text-[11px] text-gray-300 leading-relaxed max-w-[260px]">
                        {route.recommendationReason}
                      </p>
                      <div className="mt-2 space-y-1">
                        <FactorBar label="Gas" value={route.factorBreakdown.gas} color="bg-brand-500" />
                        <FactorBar label="Time" value={route.factorBreakdown.time} color="bg-brand-cyan" />
                        <FactorBar label="Steps" value={route.factorBreakdown.steps} color="bg-brand-accent" />
                        <FactorBar label="Risk" value={route.factorBreakdown.risk} color="bg-emerald-500" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------- Footnote ------------------------- */}
      {!loading && !error && routes.length > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <ArrowRightLeft className="h-3 w-3 text-gray-600" />
          {sourceLabel === "optimizer"
            ? "Candidates ranked by the deterministic engine — AI proposed strategies upstream, math made the final call."
            : "Candidates ranked by the deterministic engine · lower normalized score = better"}
        </div>
      )}
    </div>
  );
}
