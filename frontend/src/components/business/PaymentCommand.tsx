"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  Mic,
  Paperclip,
  ShieldCheck,
  Command,
} from "lucide-react";

const SUGGESTIONS = [
  "Pay Alice RM2,500 for invoice INV-1024 by Friday.",
  "Pay contractor $1,200.",
  "Settle outstanding vendor invoice.",
  "Reimburse Priya $450 for travel expenses.",
];

/**
 * AI Payment Command Center — the primary interaction surface.
 * Clear that the user is giving a payment instruction (not chatting):
 * intent → treasury check → plan → route → risk → approval → execute.
 */
export function PaymentCommand({ businessName }: { businessName?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    router.push(`/operations?prompt=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl glass-panel border border-white/10 p-5 md:p-6 shadow-glass">
      {/* Ambient gradient */}
      <div className="absolute -top-20 -left-16 w-64 h-64 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-12 w-64 h-64 bg-mint-300/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-mint-300/60" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-on-accent flex items-center justify-center shadow-glow shrink-0">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[14px] font-extrabold text-gray-100 tracking-tight">
              Payment Command Center
            </h3>
            <p className="text-[10px] text-gray-500">
              {businessName ? `${businessName} · ` : ""}Give a payment instruction — not a chat
            </p>
          </div>
          <span className="ml-auto hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold uppercase text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> You approve every payment
          </span>
        </div>

        {/* Input */}
        <div className="relative">
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
            placeholder="Describe payment… e.g. “Pay Alice RM2,500 for invoice INV-1024 by Friday.”"
            className="w-full resize-none rounded-2xl glass-input border border-white/10 focus:border-brand-500/60 focus:outline-none focus:shadow-glow px-5 py-4 pr-14 text-[15px] text-gray-100 placeholder:text-gray-500 shadow-glass"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <button
              onClick={() => submit(value)}
              disabled={!value.trim()}
              aria-label="Send payment instruction"
              className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-500 text-on-accent flex items-center justify-center shadow-glow transition-all disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Toolbar row: mic / attach + hint */}
        <div className="flex items-center gap-2 mt-3">
          <button
            aria-label="Use voice input"
            className="h-9 w-9 rounded-xl glass-input border border-white/10 text-gray-400 hover:text-gray-200 hover:border-brand-400/50 flex items-center justify-center transition-all"
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            aria-label="Attach or import a document"
            className="h-9 w-9 rounded-xl glass-input border border-white/10 text-gray-400 hover:text-gray-200 hover:border-brand-400/50 flex items-center justify-center transition-all"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <span className="text-[10px] text-gray-500 font-medium hidden sm:inline">
            Enter to send · Shift+Enter for a new line · No funds move until you approve
          </span>
        </div>

        {/* Recent suggestions */}
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            <Command className="h-3 w-3" /> Recent instructions
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-white/5 hover:bg-brand-500/15 border border-white/10 hover:border-brand-500/40 text-gray-300 hover:text-gray-100 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
