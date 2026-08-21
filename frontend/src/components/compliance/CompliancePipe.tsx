"use client";

import React from "react";
import {
  MessageSquareText,
  UserCheck,
  Activity,
  Gauge,
  ScrollText,
  FileCheck2,
  CheckCircle2,
  UserRoundCheck,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceAssessment } from "@/lib/compliance/types";
import { TONE_STYLES, ToneBadge, type Tone } from "./ui";

// =============================================================================
// CompliancePipe — renders the full compliance pipeline for a transfer:
//
//   Intent -> Counterparty -> Monitoring -> Risk -> Policy -> Travel Rule
//   -> Decision -> Approval -> Execution
//
// Every stage is coloured GREEN (passed) / YELLOW (review) / RED (blocked).
// The pipe makes the compliance journey fully transparent to the operator.
// =============================================================================

interface PipeStageDef {
  id: string;
  label: string;
  icon: React.ElementType;
  tone: Tone;
  status: string;
  detail?: string;
}

function stagesFromAssessment(a: ComplianceAssessment): PipeStageDef[] {
  const screeningTone: Tone =
    a.screening.verdict === "PASS" ? "green" : a.screening.verdict === "REVIEW" ? "yellow" : "red";
  const monitoringTone: Tone = a.monitoring.hasHighAnomaly
    ? "red"
    : a.monitoring.signals.length > 0
    ? "yellow"
    : "green";
  const riskTone: Tone =
    a.risk.level === "LOW" ? "green" : a.risk.level === "MEDIUM" ? "yellow" : "red";
  const policyTone: Tone =
    a.policy.decision === "ALLOW" ? "green" : a.policy.decision === "REVIEW" ? "yellow" : "red";
  const travelTone: Tone = a.travelRule.complete ? "green" : "yellow";
  const decisionTone: Tone =
    a.decision === "ALLOW" ? "green" : a.decision === "REVIEW" ? "yellow" : "red";

  return [
    {
      id: "intent",
      label: "Intent",
      icon: MessageSquareText,
      tone: "green",
      status: "Parsed",
      detail: a.intent,
    },
    {
      id: "counterparty",
      label: "Counterparty",
      icon: UserCheck,
      tone: screeningTone,
      status: a.screening.verdict,
      detail: `${a.screening.riskScore}/100`,
    },
    {
      id: "monitoring",
      label: "Monitoring",
      icon: Activity,
      tone: monitoringTone,
      status: a.monitoring.signals.length === 0 ? "Normal" : `${a.monitoring.signals.length} signal(s)`,
      detail: a.monitoring.anomalyLevel,
    },
    {
      id: "risk",
      label: "Risk Score",
      icon: Gauge,
      tone: riskTone,
      status: `${Math.round(a.risk.score)}/100`,
      detail: a.risk.level,
    },
    {
      id: "policy",
      label: "Policy",
      icon: ScrollText,
      tone: policyTone,
      status: a.policy.violations.length === 0 ? "Pass" : `${a.policy.violations.length} violation(s)`,
      detail: a.policy.decision,
    },
    {
      id: "travel_rule",
      label: "Travel Rule",
      icon: FileCheck2,
      tone: travelTone,
      status: a.travelRule.status,
      detail: a.travelRule.complete ? "Complete" : `${a.travelRule.missingFields.length} missing`,
    },
    {
      id: "decision",
      label: "Decision",
      icon: CheckCircle2,
      tone: decisionTone,
      status: a.decision,
    },
    {
      id: "approval",
      label: "Approval",
      icon: UserRoundCheck,
      tone: a.decision === "BLOCK" ? "red" : "yellow",
      status: a.decision === "BLOCK" ? "Not required" : a.decision === "REVIEW" ? "Required" : "Gate",
    },
    {
      id: "execution",
      label: "Execution",
      icon: Rocket,
      tone: a.executionAllowed ? "green" : "red",
      status: a.executionAllowed ? "Permitted" : "Prevented",
    },
  ];
}

export function CompliancePipe({ assessment }: { assessment: ComplianceAssessment }) {
  const stages = stagesFromAssessment(assessment);

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
          <span className="h-2 w-2 rounded-full bg-brand-cyan animate-pulse" />
          Compliance Pipeline
        </div>
        <ToneBadge tone={stages.find((s) => s.id === "decision")?.tone ?? "gray"}>{assessment.decision}</ToneBadge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
        {stages.map((s, i) => {
          const Icon = s.icon;
          const tone = TONE_STYLES[s.tone];
          return (
            <div key={s.id} className="relative">
              <div
                className={cn(
                  "h-full rounded-xl border p-2.5 flex flex-col gap-1.5 transition-colors",
                  tone.bg,
                  tone.border
                )}
              >
                <div className="flex items-center justify-between">
                  <Icon className={cn("h-3.5 w-3.5", tone.text)} />
                  <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{s.label}</div>
                <div className={cn("text-[10px] font-extrabold leading-tight", tone.text)}>{s.status}</div>
                {s.detail && <div className="text-[9px] text-gray-500 truncate">{s.detail}</div>}
              </div>
              {i < stages.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-1.5 z-10 h-px w-3 bg-white/15" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
