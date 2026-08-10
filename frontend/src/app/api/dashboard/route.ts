// =============================================================================
// GET /api/dashboard — Phase 11 IBAP Business Payment Operations Dashboard.
//
// Aggregates treasury, payment operations, optimization metrics, route
// analytics and the approval queue for a business in a single payload.
//
// Offline behaviour (mirrors the rest of the app): when Supabase is not
// configured OR any query fails, this endpoint returns a deterministic seeded
// demo payload ({ isFallback: true, fallbackReason }) instead of a 500, so the
// dashboard is always demonstrable.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { fetchRawDashboardData } from "@/lib/dashboard/queries";
import {
  computeApprovals,
  computeOperationCounts,
  computeOptimization,
  computeRecentPayments,
  computeRouteAnalytics,
  computeTreasury,
} from "@/lib/dashboard/analytics";
import { buildDemoDashboard } from "@/lib/dashboard/demo";
import type { DashboardData } from "@/lib/dashboard/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Seeded TechCorp business (mirrors supabase/seed.sql).
const DEFAULT_BUSINESS_ID = "b2000000-0000-0000-0000-000000000001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId") || DEFAULT_BUSINESS_ID;

  const fallback = (reason: string, status = 200) => {
    const demo = buildDemoDashboard(reason);
    return NextResponse.json(demo, { status });
  };

  // Not configured -> deterministic demo so the dashboard is never blank.
  if (!isSupabaseConfigured()) {
    return fallback("Supabase is not configured — showing seeded demo data");
  }

  const supabase = getSupabaseAdmin();
  try {
    const raw = await fetchRawDashboardData(supabase, businessId);

    const profile = raw.businessProfile;
    const wallet = raw.wallet;
    const businessName = profile?.business_name ?? "TechCorp Solutions Sdn Bhd";
    const preferredChain = profile?.default_chain ?? "polygon";

    const data: DashboardData = {
      treasury: computeTreasury(wallet, businessName, preferredChain),
      operations: computeOperationCounts(raw.paymentRequests),
      recentPayments: computeRecentPayments(raw.paymentRequests, raw.txns, raw.paymentPlans),
      optimization: computeOptimization(
        raw.paymentRequests,
        raw.txns,
        raw.paymentPlans,
        raw.routeOptions
      ),
      routeAnalytics: computeRouteAnalytics(
        raw.paymentRequests,
        raw.txns,
        raw.paymentPlans,
        raw.routeOptions,
        14
      ),
      approvals: computeApprovals(raw.paymentRequests, raw.paymentPlans, raw.routeOptions),
      isFallback: false,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(data);
  } catch (err: any) {
    console.warn("[IBAP-dashboard] Supabase unreachable, serving seeded demo:", err?.message);
    return fallback(`Supabase unreachable: ${err?.message ?? "unknown error"}`);
  }
}
