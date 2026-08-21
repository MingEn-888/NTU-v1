"use client";

import React from "react";
import { Gauge, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceRiskResult } from "@/lib/compliance/types";
import { RiskLevelBadge, RiskBar, TONE_STYLES } from "./ui";

// =============================================================================
// RiskSummaryPanel — the transparent unified 0-100 compliance risk score.
// Shows every contributing factor (counterparty / monitoring / amount / asset /
// policy / travel rule) and the reasons behind the score.
// =============================================================================

type FactorKey = Exclude<keyof ComplianceRiskResult["breakdown"], "total">;

const FACTOR_LABELS: { key: FactorKey; label: string }[] = [
  { key: "counterparty", label: "Counterparty" },
  { key: "monitoring", label: "Monitoring" },
  { key: "amount", label: "Transfer amount" },
  { key: "asset", label: "Asset risk" },
  { key: "policy", label: "Policy" },
  { key: "travelRule", label: "Travel Rule" },
];

const FACTOR_MAX: Record<FactorKey, number> = {
  counterparty: 25,
  monitoring: 20,
  amount: 20,
  asset: 15,
  policy: 15,
  travelRule: 5,
};

export function RiskSummaryPanel({ risk }: { risk: ComplianceRiskResult }) {
  const tone = risk.level === "LOW" ? "green" : risk.level === "MEDIUM" ? "yellow" : "red";

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
          <Gauge className="h-4 w-4 text-brand-cyan" />
          Compliance Risk Score
        </div>
        <RiskLevelBadge level={risk.level} score={risk.score} />
      </div>

      {/* Big score */}
      <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-center mb-4">
        <div className={cn("text-4xl font-extrabold tracking-tight tabular-nums", TONE_STYLES[tone].text)}>
          {Math.round(risk.score)}
          <span className="text-lg text-gray-500 font-bold">/100</span>
        </div>
        <div className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", TONE_STYLES[tone].text)}>
          {risk.level} Risk
        </div>
        <RiskBar score={risk.score} tone={tone} className="mt-3" />
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2 mb-3">
        {FACTOR_LABELS.map(({ key, label }) => {
          const value = risk.breakdown[key];
          const max = FACTOR_MAX[key];
          const pct = Math.min(100, (value / max) * 100);
          const active = value > 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 mb-1">
                <span>{label}</span>
                <span className={cn("tabular-nums", active ? "text-gray-200" : "")}>
                  {value.toFixed(1)} / {max}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    active ? (key === "travelRule" ? "bg-amber-500" : TONE_STYLES[tone].dot === "bg-emerald-400" ? "bg-emerald-500" : "bg-amber-500") : "bg-white/5"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Reasons */}
      <div className="rounded-xl bg-black/25 border border-white/5 p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
          <Info className="h-3 w-3" /> Reasons
        </div>
        <ul className="space-y-1.5">
          {risk.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-gray-300 leading-snug">
              <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", TONE_STYLES[tone].dot)} />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
