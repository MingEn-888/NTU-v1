"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollText, ShieldCheck, FileSearch, ChevronRight } from "lucide-react";
import type { ComplianceAuditEvent } from "@/lib/compliance/types";
import { DecisionBadge, RiskLevelBadge } from "./ui";

// =============================================================================
// RecentComplianceDecisions — the latest compliance decisions table (audit
// trail preview). Lives on the Tx History surface with shortcuts back to the
// Compliance dashboard and the full audit log.
//
// Data comes from GET /api/compliance/audit (live Supabase rows when available,
// else the deterministic simulated demo dataset).
// =============================================================================

export function RecentComplianceDecisions({ limit = 6 }: { limit?: number }) {
  const [events, setEvents] = useState<ComplianceAuditEvent[]>([]);

  useEffect(() => {
    fetch("/api/compliance/audit?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents((d.events || []).slice(0, limit)))
      .catch(() => {});
  }, [limit]);

  if (events.length === 0) return null;

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
          <ScrollText className="h-4 w-4 text-brand-cyan" />
          Recent compliance decisions
        </div>
        <Link href="/compliance/audit" className="text-[10px] font-bold text-brand-cyan hover:text-brand-300">
          View full audit log →
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-gray-500 border-b border-white/10">
              <th className="py-2 pr-3 font-bold">Txn</th>
              <th className="py-2 pr-3 font-bold">Recipient</th>
              <th className="py-2 pr-3 font-bold">Asset</th>
              <th className="py-2 pr-3 font-bold">Amount</th>
              <th className="py-2 pr-3 font-bold">Risk</th>
              <th className="py-2 pr-3 font-bold">Decision</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={`${e.txnReference}-${e.timestamp}`} className="border-b border-white/5 last:border-0">
                <td className="py-2.5 pr-3 text-[11px] font-bold text-brand-cyan">{e.txnReference || "—"}</td>
                <td className="py-2.5 pr-3 text-[11px] text-gray-300 truncate max-w-[140px]">{e.recipient || "—"}</td>
                <td className="py-2.5 pr-3 text-[11px] font-bold text-gray-200">{e.asset || "—"}</td>
                <td className="py-2.5 pr-3 text-[11px] text-gray-300 tabular-nums">
                  ${(e.amountUsd ?? 0).toLocaleString()}
                </td>
                <td className="py-2.5 pr-3">
                  <RiskLevelBadge level={e.riskLevel ?? "LOW"} score={e.riskScore} />
                </td>
                <td className="py-2.5 pr-3">
                  <DecisionBadge decision={e.decision ?? "REVIEW"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Shortcuts back to the compliance surface */}
      <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mr-1">Compliance</span>
        <Link
          href="/compliance"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-brand-cyan bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/25 transition-colors"
        >
          <ShieldCheck className="h-3 w-3" />
          Compliance dashboard
          <ChevronRight className="h-3 w-3" />
        </Link>
        <Link
          href="/compliance/audit"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          <FileSearch className="h-3 w-3" />
          Full audit log
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
