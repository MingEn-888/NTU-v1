"use client";

import React from "react";
import { Activity, BellRing, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonitoringResult } from "@/lib/compliance/types";
import { ToneBadge, type Tone } from "./ui";

// =============================================================================
// MonitoringPanel — surfaces transaction monitoring signals. Deterministic
// rules only; the LLM is never involved in anomaly detection.
// =============================================================================

function toneForSeverity(severity: MonitoringResult["anomalyLevel"]): Tone {
  return severity === "LOW" ? "green" : severity === "MEDIUM" ? "yellow" : "red";
}

export function MonitoringPanel({ monitoring }: { monitoring: MonitoringResult }) {
  const tone = toneForSeverity(monitoring.anomalyLevel);

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
          <Activity className="h-4 w-4 text-brand-cyan" />
          Transaction Monitoring
        </div>
        <ToneBadge tone={tone}>{monitoring.anomalyLevel}</ToneBadge>
      </div>

      {monitoring.signals.length === 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 text-[12px] font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          No anomalies detected — transaction behaviour looks normal.
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            {monitoring.signals.length} signal(s) detected
          </div>
          {monitoring.signals.map((s, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2.5 px-3 py-2.5 rounded-xl border",
                s.severity === "HIGH" || s.severity === "CRITICAL"
                  ? "bg-red-500/5 border-red-500/20"
                  : s.severity === "MEDIUM"
                  ? "bg-amber-500/5 border-amber-500/20"
                  : "bg-brand-500/5 border-brand-500/15"
              )}
            >
              <BellRing
                className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  s.severity === "HIGH" || s.severity === "CRITICAL"
                    ? "text-red-400"
                    : s.severity === "MEDIUM"
                    ? "text-amber-400"
                    : "text-brand-cyan"
                )}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-gray-200">{s.signal}</span>
                  <ToneBadge tone={s.severity === "HIGH" || s.severity === "CRITICAL" ? "red" : s.severity === "MEDIUM" ? "yellow" : "green"} className="!px-1.5 !py-0">
                    {s.severity}
                  </ToneBadge>
                </div>
                <div className="text-[11px] text-gray-400 leading-snug mt-0.5">{s.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
