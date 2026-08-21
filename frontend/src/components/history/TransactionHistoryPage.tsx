"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTreasury } from "@/hooks/useTreasury";
import type { DashboardData } from "@/lib/dashboard/types";
import { SpendingInsights } from "@/components/business/SpendingInsights";
import { OptimizationMetrics } from "@/components/dashboard/OptimizationMetrics";
import { RouteAnalytics } from "@/components/dashboard/RouteAnalytics";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import { RecentComplianceDecisions } from "@/components/compliance/RecentComplianceDecisions";
import {
  DashboardSkeleton,
  DemoBanner,
  LiveBadge,
  SectionErrorState,
} from "@/components/dashboard/states";

// Seeded TechCorp business (mirrors supabase/seed.sql) so the page always has
// a context, exactly like the dashboard.
const DEFAULT_BUSINESS_ID = "b2000000-0000-0000-0000-000000000001";

/**
 * Transaction History — dedicated ledger surface.
 * Analytics first (spending insights, optimization metrics, route analytics),
 * followed by the full searchable/filterable payment history table.
 */
export function TransactionHistoryPage() {
  const wallet = useWallet();
  const treasury = useTreasury(wallet.address, wallet.chainId, wallet.balance, wallet.tokenBalances);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const businessId = useMemo(
    () => treasury.businessProfile?.id || DEFAULT_BUSINESS_ID,
    [treasury.businessProfile]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?businessId=${encodeURIComponent(businessId)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Dashboard request failed (${res.status})`);
      setData((await res.json()) as DashboardData);
    } catch (err: any) {
      console.error("[PayMaster-history] Failed to load:", err);
      setError(err?.message || "Failed to load transaction history.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const businessName = treasury.businessProfile?.business_name || data?.treasury.businessName;

  return (
    <div className="space-y-6 pb-16">
      {/* ======================= Page header ======================= */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-accent to-brand-cyan flex items-center justify-center shadow-glow">
          <History className="h-6 w-6 text-on-accent" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
              Transaction History
            </h1>
            <LiveBadge />
          </div>
          <p className="text-gray-500 text-[13px] mt-0.5">
            {businessName || "Corporate Treasury"} · analytics first, full ledger below
          </p>
        </div>
      </div>

      {data?.isFallback && <DemoBanner reason={data.fallbackReason} />}

      {/* ======================= Analytics (first) ======================= */}
      {loading ? (
        <DashboardSkeleton />
      ) : error || !data ? (
        <SectionErrorState
          title="History unavailable"
          description={error || "The treasury store didn't respond. Try refreshing the page."}
          onRetry={load}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <SpendingInsights
                optimization={data.optimization}
                routeAnalytics={data.routeAnalytics}
              />
            </div>
            <OptimizationMetrics metrics={data.optimization} />
          </div>
          <RouteAnalytics analytics={data.routeAnalytics} />
        </>
      )}

      {/* ======================= Transaction history ======================= */}
      <PaymentHistory />

      {/* ======================= Compliance decisions ======================= */}
      <RecentComplianceDecisions />
    </div>
  );
}
