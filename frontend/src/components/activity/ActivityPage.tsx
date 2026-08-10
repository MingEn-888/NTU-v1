"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Activity as ActivityIcon, ReceiptText } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import { PaymentActivity } from "@/components/business/PaymentActivity";
import { DashboardSkeleton, DemoBanner, SectionErrorState } from "@/components/dashboard/states";
import { useWallet } from "@/hooks/useWallet";
import { useTreasury } from "@/hooks/useTreasury";

const DEFAULT_BUSINESS_ID = "b2000000-0000-0000-0000-000000000001";

/** Activity — the full live feed of treasury payment activity. */
export function ActivityPage() {
  const wallet = useWallet();
  const treasury = useTreasury(wallet.address, wallet.chainId, wallet.balance, wallet.tokenBalances);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const businessId = useMemo(
    () => treasury.businessProfile?.id || DEFAULT_BUSINESS_ID,
    [treasury.businessProfile]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard?businessId=${encodeURIComponent(businessId)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Dashboard request failed (${res.status})`);
        const payload = (await res.json()) as DashboardData;
        if (!cancelled) setData(payload);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load activity.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const businessName = treasury.businessProfile?.business_name || data?.treasury.businessName;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-6 border border-white/10 shadow-glass">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-mint-300/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-accent to-mint-300 flex items-center justify-center shadow-glow">
            <ActivityIcon className="h-6 w-6 text-on-accent" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-gray-100 tracking-tight">
              Activity
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {businessName ? `${businessName} · ` : ""}Live feed of every treasury payment.
            </p>
          </div>
        </div>
      </div>

      {data?.isFallback && <DemoBanner reason={data.fallbackReason} />}

      {loading ? (
        <DashboardSkeleton />
      ) : error || !data ? (
        <SectionErrorState
          title="Activity unavailable"
          description={error || "The treasury store didn't respond. Try refreshing."}
          onRetry={() => window.location.reload()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 items-start">
          <PaymentActivity payments={data.recentPayments} />

          <div className="flex items-center gap-2 px-5 py-3 rounded-2xl glass-panel border border-white/10 text-[10px] text-gray-500">
            <ReceiptText className="h-3.5 w-3.5 text-brand-cyan" />
            <span>
              For the full ledger with search &amp; filters, open{" "}
              <a href="/payments" className="font-bold text-brand-cyan hover:text-brand-300">
                Payments
              </a>
              .
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
