"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  ShieldCheck,
  FileText,
  UserCheck,
  Handshake,
  Landmark,
  ArrowRight,
} from "lucide-react";

// =============================================================================
// AI Payment Agent — the large command surface of the dashboard.
// "Describe a payment…" in plain business language; the agent parses intent,
// builds a plan and routes it to the human approval gate. No funds move until
// an operator approves. Submitting deep-links into the Payment Operations
// console with the instruction pre-filled.
// =============================================================================

const QUICK_ACTIONS: { label: string; prompt: string; icon: React.ElementType }[] = [
  {
    label: "Pay invoice",
    prompt: "Pay Alice RM2,500 for invoice INV-1024 by Friday.",
    icon: FileText,
  },
  {
    label: "Contractor payment",
    prompt: "Pay contractor $1,200 for the Q3 design sprint.",
    icon: UserCheck,
  },
  {
    label: "Vendor settlement",
    prompt: "Settle vendor invoice INV-2077 for $1,900 from treasury.",
    icon: Handshake,
  },
  {
    label: "Treasury transfer",
    prompt: "Transfer 15,000 USDC from treasury to the operations vault.",
    icon: Landmark,
  },
];

const EXAMPLES = [
  "Settle invoice INV-2104 for Meridian Logistics.",
  "Reimburse Priya $450 for travel expenses.",
  "Pay monthly hosting invoice to Nimbus Cloud.",
];

export function AIAgentCommand({ businessName }: { businessName?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Deep-link into the Payment Operations console with the instruction.
    router.push(`/operations?prompt=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl glass-panel border border-white/10 p-6 md:p-8 shadow-glass">
      {/* Ambient gradient */}
      <div className="absolute -top-24 -left-20 w-80 h-80 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-16 w-80 h-80 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-accent to-brand-cyan flex items-center justify-center shadow-glow">
              <Sparkles className="h-5.5 w-5.5 text-white" />
            </div>
            <div>
              <h2 className="text-[16px] font-extrabold text-white tracking-tight leading-tight">
                AI Payment Agent
              </h2>
              <p className="text-[11px] text-gray-500">
                {businessName
                  ? `${businessName} · `
                  : ""}
                Describe a business payment — the agent handles intent, routing & risk.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold self-start md:self-auto">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Online · Awaiting instruction
          </span>
        </div>

        {/* Command input */}
        <div className="relative group">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-brand-500/40 via-brand-accent/30 to-brand-cyan/40 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
          <div className="relative rounded-2xl">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(value);
                }
              }}
              rows={2}
              placeholder="Describe a payment… e.g. “Pay Alice RM2,500 for invoice INV-1024 by Friday.”"
              className="w-full resize-none rounded-2xl bg-[#0b0d15] border border-white/10 focus:border-brand-500/60 focus:outline-none focus:shadow-glow px-5 py-4 pr-16 text-[15px] text-white placeholder:text-gray-600 shadow-glass"
            />
            <button
              onClick={() => submit(value)}
              disabled={!value.trim()}
              className="absolute right-3 bottom-3 h-11 w-11 rounded-xl bg-gradient-to-br from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-500 text-white flex items-center justify-center shadow-glow transition-all disabled:opacity-40 disabled:shadow-none"
              aria-label="Send payment instruction"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Trust boundary */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[10px] text-gray-600 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            No funds move until you approve
          </span>
          <span>·</span>
          <span>Enter to run</span>
          <span>·</span>
          <span>Shift+Enter for newline</span>
        </div>

        {/* Quick actions */}
        <div className="mt-5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2.5">
            <ArrowRight className="h-3.5 w-3.5" />
            Business operations
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((qa) => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.label}
                  onClick={() => submit(qa.prompt)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-gray-300 bg-white/5 hover:bg-brand-500/15 border border-white/10 hover:border-brand-500/40 hover:text-white transition-all group/qa"
                >
                  <Icon className="h-3.5 w-3.5 text-brand-cyan" />
                  {qa.label}
                  <span className="text-[9px] text-gray-600 group-hover/qa:text-gray-400 truncate max-w-[180px] hidden sm:inline">
                    {qa.prompt}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Examples */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-600">
          <span className="font-semibold">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => submit(ex)}
              className="text-gray-500 hover:text-brand-300 underline-offset-2 hover:underline transition-colors text-left"
            >
              “{ex}”
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
