"use client";

import React from "react";
import { ScrollText, CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PolicyEngineResult, PolicyResult } from "@/lib/compliance/types";
import { DecisionBadge, TONE_STYLES } from "./ui";

// =============================================================================
// PolicyPanel — shows the deterministic policy evaluation for a transfer.
// Every configured policy + pass/violation, and the aggregated final decision.
// =============================================================================

function toneFor(r: PolicyResult): "green" | "yellow" | "red" {
  if (r.passed) return "green";
  return r.policy.effect === "BLOCK" ? "red" : "yellow";
}

export function PolicyPanel({ policy }: { policy: PolicyEngineResult }) {
  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
          <ScrollText className="h-4 w-4 text-brand-cyan" />
          Policy Engine
        </div>
        <DecisionBadge decision={policy.decision} />
      </div>

      <div className="text-[11px] text-gray-400 leading-relaxed mb-3">
        {policy.violations.length === 0
          ? "All configured treasury & compliance policies passed."
          : `${policy.violations.length} policy violation(s) — review the flagged rules below.`}
      </div>

      {/* Violations first */}
      {policy.violations.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Violations</div>
          {policy.violations.map((r) => {
            const t = toneFor(r);
            const Icon = r.policy.effect === "BLOCK" ? Ban : AlertTriangle;
            return (
              <div
                key={r.policy.id}
                className={cn(
                  "flex items-start gap-2.5 px-3 py-2.5 rounded-xl border",
                  t === "red" ? "bg-red-500/5 border-red-500/20" : "bg-amber-500/5 border-amber-500/20"
                )}
              >
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", t === "red" ? "text-red-400" : "text-amber-400")} />
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-white">{r.policy.name}</div>
                  <div className="text-[11px] text-gray-400 leading-snug">{r.reason}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    Limit: {r.policy.limitLabel} · Effect: {r.policy.effect}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Passing policies */}
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
        Passing policies ({policy.results.filter((r) => r.passed).length}/{policy.results.length})
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {policy.results
          .filter((r) => r.passed)
          .map((r) => (
            <div key={r.policy.id} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-gray-200">{r.policy.name}</div>
                <div className="text-[9px] text-gray-500 leading-snug truncate">{r.reason}</div>
              </div>
            </div>
          ))}
      </div>

      <p className="mt-3 text-[9px] text-gray-600 leading-relaxed">
        Deterministic policy engine — the LLM cannot override this decision.
      </p>
    </div>
  );
}
