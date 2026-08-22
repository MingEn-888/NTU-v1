"use client";

import React, { useState } from "react";
import {
  MessageSquareText,
  UserCheck,
  Gauge,
  ScrollText,
  FileCheck2,
  CheckCircle2,
  UserRoundCheck,
  Rocket,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceAssessment } from "@/lib/compliance/types";
import { TONE_STYLES, ToneBadge, type Tone } from "./ui";

// =============================================================================
// CompliancePipe — compact 3-phase compliance stepper.
//
//   Pre-Check   (Intent · Counterparty · Risk)
//   Compliance  (Policy · Travel Rule · Decision)
//   Execution   (Approval · Execution)
//
// Instead of a wall of 9 cards, each phase is a thin horizontal group of pills.
// A pill shows only the abbreviated stage title + a status badge; the micro-data
// (risk score, level, missing fields, reasons…) is hidden and revealed on hover.
// GREEN = passed · YELLOW = review · RED = blocked.
// =============================================================================

interface PipeStepDef {
  id: string;
  label: string;
  short: string;
  icon: React.ElementType;
  tone: Tone;
  status: string;
  detail?: string;
}

interface PhaseDef {
  id: string;
  title: string;
  steps: PipeStepDef[];
}

/** Worst tone wins for the phase-level status (red > yellow > green). */
function worstTone(tones: Tone[]): Tone {
  if (tones.some((t) => t === "red")) return "red";
  if (tones.some((t) => t === "yellow")) return "yellow";
  return "green";
}

function stepsFromAssessment(a: ComplianceAssessment): PipeStepDef[] {
  const screeningTone: Tone =
    a.screening.verdict === "PASS" ? "green" : a.screening.verdict === "REVIEW" ? "yellow" : "red";
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
      short: "Intent",
      icon: MessageSquareText,
      tone: "green",
      status: "Parsed",
      detail: a.intent,
    },
    {
      id: "counterparty",
      label: "Counterparty",
      short: "COUNTER",
      icon: UserCheck,
      tone: screeningTone,
      status: a.screening.verdict,
      detail: `${a.screening.riskScore}/100 screening score`,
    },
    {
      id: "risk",
      label: "Risk Score",
      short: "Risk",
      icon: Gauge,
      tone: riskTone,
      status: a.risk.level,
      detail: `${Math.round(a.risk.score)}/100 · ${a.risk.level} compliance risk`,
    },
    {
      id: "policy",
      label: "Policy",
      short: "Policy",
      icon: ScrollText,
      tone: policyTone,
      status: a.policy.violations.length === 0 ? "Pass" : a.policy.decision,
      detail:
        a.policy.violations.length === 0
          ? "No policy violations"
          : `${a.policy.violations.length} violation(s) · ${a.policy.decision}`,
    },
    {
      id: "travel_rule",
      label: "Travel Rule",
      short: "TRAVEL",
      icon: FileCheck2,
      tone: travelTone,
      status: a.travelRule.status,
      detail: a.travelRule.complete
        ? "Travel rule payload complete"
        : `${a.travelRule.missingFields.length} field(s) missing`,
    },
    {
      id: "decision",
      label: "Decision",
      short: "Decision",
      icon: CheckCircle2,
      tone: decisionTone,
      status: a.decision,
      detail:
        a.decisionReasons.length > 0
          ? a.decisionReasons.slice(0, 3).join(" · ")
          : "Deterministic engine decision",
    },
    {
      id: "approval",
      label: "Approval",
      short: "Approval",
      icon: UserRoundCheck,
      tone: a.decision === "BLOCK" ? "red" : "yellow",
      status: a.decision === "BLOCK" ? "Not req." : a.decision === "REVIEW" ? "Required" : "Gate",
      detail:
        a.decision === "BLOCK"
          ? "Blocked — approval disabled"
          : a.humanApprovalRequired
          ? "Human approval required"
          : "No review required",
    },
    {
      id: "execution",
      label: "Execution",
      short: "Execution",
      icon: Rocket,
      tone: a.executionAllowed ? "green" : "red",
      status: a.executionAllowed ? "Permitted" : "Prevented",
      detail: a.executionAllowed ? "Execution permitted by compliance" : "Execution prevented by compliance",
    },
  ];
}

const PHASES: { id: string; title: string; stepIds: string[] }[] = [
  { id: "pre_check", title: "Pre-Check", stepIds: ["intent", "counterparty", "risk"] },
  { id: "compliance", title: "Compliance", stepIds: ["policy", "travel_rule", "decision"] },
  { id: "execution", title: "Execution", stepIds: ["approval", "execution"] },
];

/** One step pill — abbreviated title + status badge, with micro-data in a
 *  hover-revealed drawer. State-driven so it works with mouse & touch. */
function StepPill({ step }: { step: PipeStepDef }) {
  const [open, setOpen] = useState(false);
  const tone = TONE_STYLES[step.tone];
  const Icon = step.icon;
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 cursor-default",
          tone.bg,
          tone.border
        )}
      >
        <Icon className={cn("h-3 w-3", tone.text)} />
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-gray-200">{step.short}</span>
        <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
        <span className={cn("text-[10px] font-bold uppercase", tone.text)}>{step.status}</span>
      </div>

      {/* Micro-data drawer — hidden until hover / click */}
      {open && (
        <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 w-48 rounded-xl border border-white/10 bg-[#12141d] p-2.5 shadow-glass">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-gray-200">{step.label}</span>
            <ToneBadge tone={step.tone}>{step.status}</ToneBadge>
          </div>
          {step.detail && <div className="mt-1.5 text-[10px] leading-snug text-gray-400">{step.detail}</div>}
        </div>
      )}
    </div>
  );
}

export function CompliancePipe({ assessment }: { assessment: ComplianceAssessment }) {
  const steps = stepsFromAssessment(assessment);
  const byId = new Map(steps.map((s) => [s.id, s]));
  const phases: PhaseDef[] = PHASES.map((p) => ({
    id: p.id,
    title: p.title,
    steps: p.stepIds.map((id) => byId.get(id)).filter((s): s is PipeStepDef => Boolean(s)),
  }));

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-tight">
          <span className="h-2 w-2 rounded-full bg-brand-cyan animate-pulse" />
          Compliance Pipeline
        </div>
        <ToneBadge tone={steps.find((s) => s.id === "decision")?.tone ?? "gray"}>{assessment.decision}</ToneBadge>
      </div>

      {/* 3 macro-phases — thin horizontal stepper */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-1">
        {phases.map((phase, pi) => {
          const phaseTone = worstTone(phase.steps.map((s) => s.tone));
          const passed = phase.steps.filter((s) => s.tone === "green").length;
          const pct = Math.round((passed / phase.steps.length) * 100);
          const barCls =
            phaseTone === "green" ? "bg-emerald-400" : phaseTone === "yellow" ? "bg-amber-400" : "bg-red-400";
          return (
            <React.Fragment key={phase.id}>
              <div className="relative flex-1 min-w-0">
                {/* Phase title + progress indicator */}
                <div className="flex items-center gap-2 mb-2 pr-2">
                  <span
                    className={cn(
                      "text-[10px] font-extrabold uppercase tracking-widest",
                      phaseTone === "green"
                        ? "text-emerald-300"
                        : phaseTone === "yellow"
                        ? "text-amber-300"
                        : "text-red-300"
                    )}
                  >
                    {phase.title}
                  </span>
                  <span className="text-[9px] text-gray-500 tabular-nums">
                    {passed}/{phase.steps.length}
                  </span>
                  <div className="ml-auto h-1 flex-1 max-w-[56px] rounded-full bg-white/10 overflow-hidden">
                    <div className={cn("h-full rounded-full", barCls)} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Step pills — abbreviated title + status badge only */}
                <div className="flex flex-wrap gap-1.5">
                  {phase.steps.map((s) => (
                    <StepPill key={s.id} step={s} />
                  ))}
                </div>
              </div>

              {/* Chevron between phases */}
              {pi < phases.length - 1 && (
                <div className="hidden md:flex items-center justify-center px-1 text-gray-600">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
