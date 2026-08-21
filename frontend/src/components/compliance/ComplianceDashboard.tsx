"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ScrollText, Ban, AlertTriangle, Gauge, Info } from "lucide-react";
import type { ComplianceAuditEvent } from "@/lib/compliance/types";
import { ComplianceAssess } from "./ComplianceAssess";
import { PortfolioMonitor } from "./PortfolioMonitor";
import { TONE_STYLES } from "./ui";
import { cn } from "@/lib/utils";

// =============================================================================
// ComplianceDashboard — the DPT Treasury Compliance surface.
// Evaluates transfers through the deterministic compliance pipe, monitors the
// DPT portfolio and links to the full audit trail.
// =============================================================================

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "blue",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: "green" | "yellow" | "red" | "blue";
}) {
  return (
    <div className="glass-card rounded-2xl border border-white/7 p-4">
      <div className={cn("h-9 w-9 rounded-xl border flex items-center justify-center mb-2.5", TONE_STYLES[tone].badge)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-xl font-extrabold text-white tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

export function ComplianceDashboard() {
  const [events, setEvents] = useState<ComplianceAuditEvent[]>([]);

  useEffect(() => {
    fetch("/api/compliance/audit?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => {});
  }, []);

  const allowed = events.filter((e) => e.decision === "ALLOW").length;
  const reviewed = events.filter((e) => e.decision === "REVIEW").length;
  const blocked = events.filter((e) => e.decision === "BLOCK").length;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-brand-500 to-brand-accent flex items-center justify-center shadow-glow">
            <ShieldCheck className="h-6 w-6 text-on-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">Compliance</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Deterministic
              </span>
            </div>
            <p className="text-gray-500 text-[13px] mt-0.5">DPT Treasury Compliance · screening · monitoring · policy · travel rule</p>
          </div>
        </div>
        <Link
          href="/compliance/audit"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          <ScrollText className="h-3.5 w-3.5" />
          Audit Log
        </Link>
      </div>

      {/* Prototype disclaimer */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-brand-500/5 border border-brand-500/20">
        <Info className="h-4 w-4 text-brand-cyan mt-0.5 shrink-0" />
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Prototype demonstrating <strong className="text-gray-200">MAS-aligned compliance controls</strong> for digital asset
          treasury operations. This is a compliance-readiness prototype, not a licensed payment institution or regulated DPT
          service provider. All screening, KYC, sanctions and Travel Rule data are <strong className="text-gray-200">simulated</strong>.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Gauge} label="Avg risk score" value={events.length ? `${Math.round(events.reduce((s, e) => s + e.riskScore, 0) / events.length)}/100` : "—"} tone="blue" />
        <StatTile icon={ShieldCheck} label="Allowed" value={allowed} tone="green" />
        <StatTile icon={AlertTriangle} label="Under review" value={reviewed} tone="yellow" />
        <StatTile icon={Ban} label="Blocked" value={blocked} tone="red" />
      </div>

      {/* Assess + Portfolio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <ComplianceAssess />
        </div>
        <div className="space-y-5">
          <PortfolioMonitor />
        </div>
      </div>
    </div>
  );
}
