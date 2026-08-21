"use client";

import React from "react";
import { Fuel, ReceiptText, Timer, Layers, type LucideIcon } from "lucide-react";
import type { OptimizationMetrics as Metrics } from "@/lib/dashboard/types";
import { formatCurrency } from "@/lib/utils";
import { StatCard, type AccentKey, BlockSkeleton } from "./ui";

// =============================================================================
// Optimization Metrics — the deterministic savings the route engine delivered.
// =============================================================================

export function OptimizationMetrics({
  metrics,
  isLoading,
}: {
  metrics: Metrics | null;
  isLoading?: boolean;
}) {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <BlockSkeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const cards: {
    icon: LucideIcon;
    label: string;
    value: string;
    sub: string;
    accent: AccentKey;
  }[] = [
    {
      icon: Fuel,
      label: "Total Gas Saved",
      value: formatCurrency(metrics.totalGasSavedUsd),
      sub: `Across ${metrics.settledCount} settled payments`,
      accent: "emerald",
    },
    {
      icon: ReceiptText,
      label: "Avg Payment Cost",
      value: formatCurrency(metrics.avgPaymentCostUsd),
      sub: "Gas + fees per settlement",
      accent: "cyan",
    },
    {
      icon: Timer,
      label: "Avg Execution Time",
      value: `${Math.round(metrics.avgExecutionTimeSec)}s`,
      sub: "Request → confirmed",
      accent: "brand",
    },
    {
      icon: Layers,
      label: "Avg Txns / Payment",
      value: metrics.avgTxnsPerPayment.toFixed(1),
      sub: "Steps per settlement",
      accent: "accent",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((c) => (
        <StatCard
          key={c.label}
          icon={c.icon}
          label={c.label}
          value={c.value}
          sub={c.sub}
          accent={c.accent}
        />
      ))}
    </div>
  );
}
