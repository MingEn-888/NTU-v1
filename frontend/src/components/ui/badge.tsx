"use client";

import React from "react";

export type BadgeTone =
  | "brand"
  | "emerald"
  | "cyan"
  | "amber"
  | "red"
  | "violet"
  | "neutral";

const TONE_CLASS: Record<BadgeTone, string> = {
  brand: "bg-brand-500/15 text-brand-300 border-brand-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  red: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  neutral: "bg-white/5 text-gray-400 border-white/10",
};

/**
 * Small status pill / badge used across cards, tables and queues.
 */
export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}
