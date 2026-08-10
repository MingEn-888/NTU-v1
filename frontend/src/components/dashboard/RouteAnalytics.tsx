"use client";

import React from "react";
import {
  BarChart as ReBar,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, Globe2, Activity } from "lucide-react";
import type { RouteAnalytics as RouteAnalyticsData } from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/utils";
import { SectionHeader, BlockSkeleton, TextSkeleton } from "./ui";
import { SectionEmptyState } from "./states";

// =============================================================================
// Route Analytics — Recharts visualizations of the deterministic optimizer:
// gas saved over time, payments by chain and payment volume.
// =============================================================================

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#3b82f6", "#10b981"];

function ChartTooltip({ active, payload, label, prefix = "$", suffix = "" }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl bg-[#0b0d15] border border-white/10 shadow-glass px-3.5 py-2.5 text-[11px]">
      {label && <div className="text-gray-400 font-semibold mb-1.5">{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6 text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.payload?.fill }} />
            {entry.name}
          </span>
          <span className="font-bold text-white tabular-nums">
            {typeof entry.value === "number"
              ? `${prefix}${entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RouteAnalytics({
  analytics,
  isLoading,
}: {
  analytics: RouteAnalyticsData | null;
  isLoading?: boolean;
}) {
  const hasData = !!analytics && (analytics.gasSavedOverTime.length > 0 || analytics.paymentsByChain.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-9 w-9 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center">
          <TrendingUp className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-white tracking-tight leading-tight">Route Analytics</h3>
          <p className="text-[11px] text-gray-500">Deterministic optimizer · last {analytics?.windowDays ?? 14} days</p>
        </div>
      </div>

      {isLoading || !analytics ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <BlockSkeleton className="h-72 lg:col-span-2" />
          <BlockSkeleton className="h-72" />
        </div>
      ) : !hasData ? (
        <SectionEmptyState
          icon={Activity}
          title="No route analytics yet"
          description="Run a payment through the AI agent and approve it — optimization & chain analytics will appear here."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gas saved over time */}
            <div className="lg:col-span-2 glass-panel rounded-2xl border border-white/10 p-5">
              <SectionHeader
                icon={TrendingUp}
                title="Gas Saved Over Time"
                subtitle="USD saved via deterministic route selection"
                action={
                  <span className="text-[10px] font-bold text-emerald-400 tabular-nums">
                    {formatCurrency(
                      analytics.gasSavedOverTime.reduce((s, p) => s + p.gasSavedUsd, 0)
                    )}{" "}
                    total
                  </span>
                }
              />
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.gasSavedOverTime} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="gasSavedUsd"
                      name="Gas saved"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#gasGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payments by chain */}
            <div className="glass-panel rounded-2xl border border-white/10 p-5">
              <SectionHeader
                icon={Globe2}
                title="Payments By Chain"
                subtitle="Settlement distribution"
              />
              {analytics.paymentsByChain.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-gray-600 text-[12px]">
                  No chain data yet
                </div>
              ) : (
                <>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.paymentsByChain}
                          dataKey="payments"
                          nameKey="chain"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={70}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {analytics.paymentsByChain.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip prefix="" suffix=" payments" />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {analytics.paymentsByChain.slice(0, 5).map((c, i) => (
                      <div key={c.chain} className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-2 text-gray-400 font-medium">
                          <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          {c.chain}
                        </span>
                        <span className="text-gray-500 tabular-nums">
                          {c.payments} · {formatCurrency(c.volumeUsd)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment volume */}
          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <SectionHeader
              icon={Activity}
              title="Payment Volume"
              subtitle="USD-equivalent settled per day"
              action={
                <span className="text-[10px] font-bold text-brand-cyan tabular-nums">
                  {formatCurrency(analytics.paymentVolume.reduce((s, p) => s + p.volumeUsd, 0))}{" "}
                  total
                </span>
              }
            />
            {analytics.paymentVolume.every((p) => p.volumeUsd === 0) ? (
              <div className="h-48 flex items-center justify-center text-gray-600 text-[12px]">
                No volume in this window
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBar data={analytics.paymentVolume} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="volumeUsd" name="Volume" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {analytics.paymentVolume.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </ReBar>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <TextSkeleton className="h-4 w-40" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BlockSkeleton className="h-72 lg:col-span-2" />
        <BlockSkeleton className="h-72" />
      </div>
      <BlockSkeleton className="h-56" />
    </div>
  );
}
