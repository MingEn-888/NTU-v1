"use client";

import React from "react";
import { UserCheck, ShieldCheck, ShieldAlert, TriangleAlert, BadgeCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CounterpartyScreening } from "@/lib/compliance/types";
import { ScreeningBadge, RiskBar, ToneBadge, TONE_STYLES } from "./ui";

// =============================================================================
// CounterpartyPanel — shows WHY a counterparty was flagged / cleared.
// Reveals verification status, sanctions screening, wallet risk, wallet age,
// transaction history and the reasons behind the screening verdict.
// =============================================================================

function InfoRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "green" | "yellow" | "red" | "gray" | "blue" }) {
  const t = tone ? TONE_STYLES[tone] : TONE_STYLES.gray;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-[11px] text-gray-500 font-medium">{label}</span>
      <span className={cn("text-[11px] font-bold flex items-center gap-1.5", t.text)}>{value}</span>
    </div>
  );
}

export function CounterpartyPanel({ screening }: { screening: CounterpartyScreening }) {
  const p = screening.profile;
  const verified = p.verificationStatus === "VERIFIED";

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
          <UserCheck className="h-4 w-4 text-brand-cyan" />
          Counterparty Screening
        </div>
        <ScreeningBadge verdict={screening.verdict} />
      </div>

      {/* Recipient identity */}
      <div className="p-3 rounded-xl bg-black/25 border border-white/5 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center border shrink-0",
              verified ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            )}
          >
            {verified ? <BadgeCheck className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-white truncate">{p.name || "Unknown wallet"}</div>
            <div className="text-[10px] font-mono text-gray-500 truncate">{p.address}</div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <ToneBadge tone={verified ? "green" : "yellow"}>KYC: {p.verificationStatus}</ToneBadge>
          <ToneBadge tone={p.sanctionsScreened ? "green" : "red"}>
            <ShieldCheck className="h-3 w-3" /> Sanctions: {p.sanctionsScreened ? "Pass" : "Not screened"}
          </ToneBadge>
          <ToneBadge tone={p.walletRisk === "HIGH" ? "red" : p.walletRisk === "MEDIUM" ? "yellow" : "green"}>
            <ShieldAlert className="h-3 w-3" /> Wallet risk: {p.walletRisk}
          </ToneBadge>
        </div>
      </div>

      {/* Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          <span>Counterparty Risk Score</span>
          <span className={cn("tabular-nums font-extrabold", TONE_STYLES[screening.verdict === "PASS" ? "green" : screening.verdict === "REVIEW" ? "yellow" : "red"].text)}>
            {screening.riskScore} / 100
          </span>
        </div>
        <RiskBar
          score={screening.riskScore}
          tone={screening.verdict === "PASS" ? "green" : screening.verdict === "REVIEW" ? "yellow" : "red"}
        />
      </div>

      {/* Key attributes */}
      <div className="rounded-xl bg-black/25 border border-white/5 p-3 mb-3">
        <InfoRow label="Wallet age" value={<span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{p.walletAgeDays} days</span>} />
        <InfoRow label="Transaction history" value={`${p.txnHistoryCount} txns`} />
        <InfoRow label="Avg txn size" value={`$${p.avgTxnSizeUsd.toLocaleString()}`} />
        <InfoRow label="Recent daily txns" value={`${p.recentDailyTxns}`} />
        <InfoRow label="Known vendor" value={p.isKnownVendor ? "Yes" : "No"} tone={p.isKnownVendor ? "green" : "yellow"} />
      </div>

      {/* Reasons */}
      {screening.reasons.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Why this verdict</div>
          <ul className="space-y-1.5">
            {screening.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-gray-300 leading-snug">
                <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", TONE_STYLES[screening.verdict === "PASS" ? "green" : screening.verdict === "REVIEW" ? "yellow" : "red"].dot)} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[9px] text-gray-600 leading-relaxed">
        Simulated screening for prototype — no external verification performed.
      </p>
    </div>
  );
}
