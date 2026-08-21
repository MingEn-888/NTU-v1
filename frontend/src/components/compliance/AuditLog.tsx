"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search, Filter, ChevronDown, ScrollText, RefreshCw, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceAuditEvent, ComplianceDecision, ComplianceRiskLevel } from "@/lib/compliance/types";
import { DecisionBadge, RiskLevelBadge, ToneBadge } from "./ui";

// =============================================================================
// AuditLog — the compliance audit trail. Every compliance decision is logged so
// the question "why was this transfer approved or blocked?" is answerable.
// Filters: date, customer, txn reference, risk level, decision, asset.
// =============================================================================

const INPUT_STYLES =
  "w-full px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-[11px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-brand-500/50";

const RISK_OPTIONS: (ComplianceRiskLevel | "")[] = ["", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const DECISION_OPTIONS: (ComplianceDecision | "")[] = ["", "ALLOW", "REVIEW", "BLOCK"];

function shortAddr(addr: string | null) {
  if (!addr) return "—";
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AuditLog() {
  const [events, setEvents] = useState<ComplianceAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [date, setDate] = useState("");
  const [customer, setCustomer] = useState("");
  const [txn, setTxn] = useState("");
  const [risk, setRisk] = useState<ComplianceRiskLevel | "">("");
  const [decision, setDecision] = useState<ComplianceDecision | "">("");
  const [asset, setAsset] = useState("");

  // Expanded row
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (customer) params.set("customer", customer);
      if (txn) params.set("txn", txn);
      if (risk) params.set("risk", risk);
      if (decision) params.set("decision", decision);
      if (asset) params.set("asset", asset);
      const res = await fetch(`/api/compliance/audit?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
      setEvents(data.events || []);
      setIsFallback(Boolean(data.isFallback));
    } catch (err: any) {
      console.error("[PayMaster-audit] Failed to load:", err);
      setError(err?.message || "Failed to load audit log.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [date, customer, txn, risk, decision, asset]);

  useEffect(() => {
    load();
  }, [load]);

  const clearFilters = () => {
    setDate("");
    setCustomer("");
    setTxn("");
    setRisk("");
    setDecision("");
    setAsset("");
  };

  const hasFilters = Boolean(date || customer || txn || risk || decision || asset);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="glass-panel rounded-2xl border border-white/10 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
            <Filter className="h-4 w-4 text-brand-cyan" />
            Filters
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button onClick={clearFilters} className="text-[10px] font-bold text-brand-cyan hover:text-brand-300">
                Clear
              </button>
            )}
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">Date</label>
            <input className={INPUT_STYLES} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">Customer</label>
            <input className={INPUT_STYLES} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="cust_…" />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">Transaction</label>
            <input className={INPUT_STYLES} value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="TX-…" />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">Risk level</label>
            <select className={INPUT_STYLES} value={risk} onChange={(e) => setRisk(e.target.value as ComplianceRiskLevel | "")}>
              {RISK_OPTIONS.map((r) => (
                <option key={r || "all"} value={r} className="bg-[#12141d]">
                  {r || "All"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">Decision</label>
            <select className={INPUT_STYLES} value={decision} onChange={(e) => setDecision(e.target.value as ComplianceDecision | "")}>
              {DECISION_OPTIONS.map((d) => (
                <option key={d || "all"} value={d} className="bg-[#12141d]">
                  {d || "All"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">Asset</label>
            <input className={cn(INPUT_STYLES, "uppercase")} value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="USDC" />
          </div>
        </div>
      </div>

      {isFallback && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px] font-semibold">
          <Search className="h-3.5 w-3.5" />
          Supabase unavailable — showing simulated compliance audit events generated by the real engines.
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-[12px] font-semibold">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/10 p-8 text-center">
          <FileSearch className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <div className="text-[13px] font-bold text-gray-400">No audit events found</div>
          <div className="text-[11px] text-gray-600 mt-1">Try adjusting the filters.</div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-gray-500 border-b border-white/10 bg-black/30">
                  <th className="py-2.5 px-4 font-bold">Time</th>
                  <th className="py-2.5 px-3 font-bold">Txn</th>
                  <th className="py-2.5 px-3 font-bold">Customer</th>
                  <th className="py-2.5 px-3 font-bold">Recipient</th>
                  <th className="py-2.5 px-3 font-bold">Asset</th>
                  <th className="py-2.5 px-3 font-bold">Amount</th>
                  <th className="py-2.5 px-3 font-bold">Risk</th>
                  <th className="py-2.5 px-3 font-bold">Decision</th>
                  <th className="py-2.5 px-3 font-bold">Execution</th>
                  <th className="py-2.5 px-3 font-bold" />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <React.Fragment key={`${e.txnReference}-${e.timestamp}`}>
                    <tr
                      onClick={() => setExpanded(expanded === e.txnReference ? null : e.txnReference)}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4 text-[11px] text-gray-400 whitespace-nowrap tabular-nums">{fmtTime(e.timestamp)}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-cyan">
                          <ScrollText className="h-3 w-3" />
                          {e.txnReference}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[10px] font-mono text-gray-400">{e.customerId}</td>
                      <td className="py-2.5 px-3 text-[11px] text-gray-300">
                        <div className="truncate max-w-[140px]">{e.recipient || "—"}</div>
                        <div className="text-[9px] font-mono text-gray-600">{shortAddr(e.recipientAddress)}</div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-bold text-gray-200">{e.asset || "—"}</td>
                      <td className="py-2.5 px-3 text-[11px] text-gray-300 tabular-nums">${(e.amountUsd ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <RiskLevelBadge level={e.riskLevel ?? "LOW"} score={e.riskScore} />
                      </td>
                      <td className="py-2.5 px-3">
                        <DecisionBadge decision={e.decision ?? "REVIEW"} />
                      </td>
                      <td className="py-2.5 px-3">
                        <ToneBadge tone={e.executionStatus === "BLOCKED" ? "red" : e.executionStatus === "PENDING_APPROVAL" ? "yellow" : "green"}>
                          {(e.executionStatus || "PENDING_APPROVAL").replace(/_/g, " ")}
                        </ToneBadge>
                      </td>
                      <td className="py-2.5 px-3">
                        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-500 transition-transform", expanded === e.txnReference && "rotate-180")} />
                      </td>
                    </tr>
                    {expanded === e.txnReference && (
                      <tr className="bg-black/20">
                        <td colSpan={10} className="p-4">
                          <AuditDetail event={e} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Expanded audit detail — the "why" behind every decision.
// -----------------------------------------------------------------------------

function AuditDetail({ event }: { event: ComplianceAuditEvent }) {
  const intent = event.intent || "—";
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-black/25 border border-white/5">
        <FileSearch className="h-4 w-4 text-brand-cyan mt-0.5 shrink-0" />
        <div className="text-[12px] text-gray-300 leading-relaxed">{intent}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-2">Counterparty screening</div>
          <div className="flex items-center gap-2">
            <ScreeningChip verdict={event.screening?.verdict ?? "REVIEW"} />
            <span className="text-[11px] text-gray-400 tabular-nums">Score: {event.screening?.riskScore ?? "—"}/100</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-2">Travel Rule</div>
          <ToneBadge tone={event.travelRule.status === "READY" ? "green" : "yellow"}>{event.travelRule.status}</ToneBadge>
          {event.travelRule.missing.length > 0 && (
            <div className="text-[10px] text-amber-300 mt-1.5">Missing: {event.travelRule.missing.join(", ")}</div>
          )}
        </div>
      </div>

      {event.monitoringSignals.length > 0 && (
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            Monitoring signals ({event.monitoringSignals.length})
          </div>
          <ul className="space-y-1">
            {event.monitoringSignals.map((s, i) => (
              <li key={i} className="text-[11px] text-gray-300">
                <span className="font-mono font-bold text-gray-200">{s.signal}</span> <span className="text-gray-500">· {s.severity}</span> — {s.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-3 rounded-xl bg-black/25 border border-white/5">
        <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-2">Policy violations</div>
        {event.policy.violations.length === 0 ? (
          <div className="text-[11px] text-emerald-300">No policy violations.</div>
        ) : (
          <ul className="space-y-1">
            {event.policy.violations.map((v, i) => (
              <li key={i} className="text-[11px] text-amber-200">• {v}</li>
            ))}
          </ul>
        )}
      </div>

      {event.txHash && (
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">Blockchain</div>
          <div className="text-[11px] font-mono text-brand-cyan">{event.txHash}</div>
        </div>
      )}

      {event.aiExplanation && (
        <div className="p-3 rounded-xl bg-black/25 border border-white/5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1">Explanation</div>
          <div className="text-[11px] text-gray-300 leading-relaxed">{event.aiExplanation}</div>
        </div>
      )}
    </div>
  );
}

function ScreeningChip({ verdict }: { verdict: string }) {
  return (
    <ToneBadge tone={verdict === "PASS" ? "green" : verdict === "BLOCK" ? "red" : "yellow"}>{verdict}</ToneBadge>
  );
}
