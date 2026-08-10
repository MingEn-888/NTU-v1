"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Workflow } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTreasury } from "@/hooks/useTreasury";
import type { DashboardData } from "@/lib/dashboard/types";
import { TopBar } from "./TopBar";
import { TreasuryHero } from "./TreasuryHero";
import { QuickActions } from "./QuickActions";
import { PaymentCommand } from "./PaymentCommand";
import { SettlementRails } from "./SettlementRails";
import { SpendingInsights } from "./SpendingInsights";
import { PaymentActivity } from "./PaymentActivity";
import { ApprovalQueue } from "@/components/dashboard/ApprovalQueue";
import { OptimizationMetrics } from "@/components/dashboard/OptimizationMetrics";
import { RouteAnalytics } from "@/components/dashboard/RouteAnalytics";
import {
  DashboardSkeleton,
  DemoBanner,
  LiveBadge,
  SectionErrorState,
} from "@/components/dashboard/states";

const DEFAULT_BUSINESS_ID = "b2000000-0000-0000-0000-000000000001";

const FLOW = [
  "Describe",
  "Intent",
  "Treasury check",
  "Plan",
  "Route",
  "Risk",
  "Approval",
  "Execute",
  "Audit",
];

/**
 * Business operations dashboard — premium fintech arrangement.
 * Treasury hero → quick actions → AI payment command → settlement rails →
 * spending insights → payment activity + human approval queue.
 */
export function BusinessDashboard() {
  const wallet = useWallet();
  const treasury = useTreasury(wallet.address, wallet.chainId, wallet.balance, wallet.tokenBalances);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const businessId = useMemo(
    () => treasury.businessProfile?.id || DEFAULT_BUSINESS_ID,
    [treasury.businessProfile]
  );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dashboard?businessId=${encodeURIComponent(businessId)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Dashboard request failed (${res.status})`);
        const payload = (await res.json()) as DashboardData;
        setData(payload);
      } catch (err: any) {
        console.error("[PayMaster-dashboard] Failed to load:", err);
        setError(err?.message || "Failed to load dashboard data.");
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [businessId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const businessName =
    treasury.businessProfile?.business_name || data?.treasury.businessName || "Acme Technologies";

  return (
    <div className="space-y-6 pb-16">
      {/* ======================= Top bar (greeting + privacy) ======================= */}
      <TopBar businessName={businessName} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg md:text-xl font-extrabold text-gray-100 tracking-tight">
            Business Payments
          </h1>
          <LiveBadge />
        </div>
        <button
          onClick={() => {
            setRefreshing(true);
            load(true);
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {data?.isFallback && <DemoBanner reason={data.fallbackReason} />}

      {loading ? (
        <DashboardSkeleton />
      ) : error || !data ? (
        <SectionErrorState
          title="Dashboard unavailable"
          description={error || "The treasury store didn't respond. Try refreshing the page."}
          onRetry={() => load()}
        />
      ) : (
        <>
          {/* ======================= Treasury hero ======================= */}
          <TreasuryHero treasury={data.treasury} approvals={data.approvals} />

          {/* ======================= Quick actions ======================= */}
          <QuickActions />

          {/* ======================= AI command + settlement rails ======================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PaymentCommand businessName={businessName} />
            </div>
            <SettlementRails />
          </div>

          {/* ======================= Activity + approvals ======================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <PaymentActivity payments={data.recentPayments} />
            </div>
            <ApprovalQueue approvals={data.approvals} />
          </div>

          {/* ======================= Insights + analytics ======================= */}
          <div id="analytics" className="scroll-mt-24">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <SpendingInsights optimization={data.optimization} routeAnalytics={data.routeAnalytics} />
              </div>
              <OptimizationMetrics metrics={data.optimization} />
            </div>
            <div className="mt-6">
              <RouteAnalytics analytics={data.routeAnalytics} />
            </div>
          </div>

          {/* ======================= Workflow strip ======================= */}
          <div className="glass-panel rounded-2xl border border-white/10 px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Workflow className="h-4 w-4 text-brand-cyan" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Payment workflow
              </span>
              <span className="ml-auto text-[10px] text-gray-500">you approve before anything moves</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {FLOW.map((step, i) => (
                <React.Fragment key={step}>
                  {i > 0 && <span className="h-1 w-1 rounded-full bg-brand-400/40" />}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      i <= 1
                        ? "bg-brand-500/15 border-brand-500/30 text-brand-cyan"
                        : i >= 6
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-white/5 border-white/10 text-gray-400"
                    }`}
                  >
                    {step}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
