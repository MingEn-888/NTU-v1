"use client";

import React from "react";
import { FileCheck2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TravelRuleResult } from "@/lib/compliance/types";
import { TRAVEL_RULE_FIELD_LABELS } from "@/lib/compliance/travelRule";
import { ToneBadge } from "./ui";

// =============================================================================
// TravelRulePanel — shows the Travel Rule information-completeness workflow.
// READY (green) when all required fields are present; INCOMPLETE (yellow/red)
// shows EXACTLY which fields are missing so the operator can action them.
// =============================================================================

export function TravelRulePanel({ travelRule }: { travelRule: TravelRuleResult }) {
  const complete = travelRule.complete;
  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
          <FileCheck2 className="h-4 w-4 text-brand-cyan" />
          Travel Rule
        </div>
        <ToneBadge tone={complete ? "green" : travelRule.effect === "BLOCK" ? "red" : "yellow"}>
          {travelRule.status}
        </ToneBadge>
      </div>

      <div className="text-[11px] text-gray-400 leading-relaxed mb-3">
        {complete
          ? "All required Travel Rule information has been provided for this transfer."
          : `Travel Rule information is incomplete — ${travelRule.missingFields.length} required field(s) missing.`}
      </div>

      {/* Field completeness list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {Object.entries(TRAVEL_RULE_FIELD_LABELS).map(([key, label]) => {
          const present = travelRule.presentFields.includes(key as keyof typeof TRAVEL_RULE_FIELD_LABELS);
          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-semibold",
                present
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/5 border-red-500/20 text-red-300"
              )}
            >
              {present ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{label}</span>
              <span className="ml-auto text-[9px] uppercase tracking-wider opacity-60">{present ? "✓" : "missing"}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <ToneBadge tone={complete ? "green" : travelRule.effect === "BLOCK" ? "red" : "yellow"}>
          Policy effect: {travelRule.effect}
        </ToneBadge>
      </div>

      <p className="mt-3 text-[9px] text-gray-600 leading-relaxed">
        Simulated Travel Rule workflow for prototype — no real Travel Rule network connectivity.
      </p>
    </div>
  );
}
