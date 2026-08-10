"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, LayoutDashboard } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTreasury } from "@/hooks/useTreasury";
import type { DashboardData } from "@/lib/dashboard/types";
import { TreasuryOverview } from "./TreasuryOverview";
import { PaymentOperations } from "./PaymentOperations";
import { AIAgentCommand } from "./AIAgentCommand";
import { RecentPayments } from "./RecentPayments";
import { OptimizationMetrics } from "./OptimizationMetrics";
import { RouteAnalytics } from "./RouteAnalytics";
import { ApprovalQueue } from "./ApprovalQueue";
import { DashboardSkeleton, DemoBanner, LiveBadge, SectionErrorState } from "./states";

// Seeded TechCorp business (mirrors supabase/seed.sql) so the dashboard always
// has a context, exactly like the rest of the app.
const DEFAULT_BUSINESS_ID = "b2000000-0000-0000-0000-000000000001";

// =============================================================================
// IBAP Business Payment Operations Dashboard — Phase 11.
// Fetches the aggregated /api/dashboard payload and lays out the full
// operations surface: AI command bar, treasury, operations, optimization,
// route analytics, recent payments and the human approval queue.
// =============================================================================

export function DashboardPage() {
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

  const load = useCallback(async (silent = false) => {
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
      console.error("[IBAP-dashboard] Failed to load:", err);
      setError(err?.message || "Failed to load dashboard data.");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const businessName = treasury.businessProfile?.business_name || data?.treasury.businessName;

  return (
    <div className="space-y-6 pb-16">
      {/* ======================= Page header ======================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-accent to-brand-cyan flex items-center justify-center shadow-glow">
            <LayoutDashboard className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                Business Payments
              </h1>
              <LiveBadge />
            </div>
            <p className="text-gray-500 text-[13px] mt-0.5">
              {businessName || "Corporate Treasury"} · Intent-based payment automation
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50"
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
          onRetry={handleRefresh}
        />
      ) : (
        <>
          {/* ======================= AI Payment Agent ======================= */}
          <AIAgentCommand businessName={businessName} />

          {/* ======================= Treasury + Operations ======================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TreasuryOverview treasury={data.treasury} />
            </div>
            <PaymentOperations counts={data.operations} />
          </div>

          {/* ======================= Optimization Metrics ======================= */}
          <OptimizationMetrics metrics={data.optimization} />

          {/* ======================= Route Analytics ======================= */}
          <RouteAnalytics analytics={data.routeAnalytics} />

          {/* ======================= Recents + Approvals ======================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <RecentPayments payments={data.recentPayments} />
            </div>
            <ApprovalQueue approvals={data.approvals} />
          </div>
        </>
      )}
    </div>
  );
}
