"use client";

import React from "react";
import { Eye, EyeOff, Building2, ShieldCheck } from "lucide-react";
import { usePrivacy } from "@/lib/privacy";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Top bar — greeting, business identity, privacy toggle and notifications.
 * Communicates "you are managing a business account" (not a personal wallet).
 */
export function TopBar({
  businessName = "Acme Technologies",
  operatorName = "Alex",
}: {
  businessName?: string;
  operatorName?: string;
}) {
  const { hidden, toggle, mask } = usePrivacy();

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Identity + greeting */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-accent to-mint-300 flex items-center justify-center text-on-accent text-[15px] font-extrabold shadow-glow shrink-0">
          {businessName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] md:text-[15px] font-extrabold text-gray-100 tracking-tight truncate">
              {greeting()}, {operatorName}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold uppercase text-emerald-300">
              <Building2 className="h-2.5 w-2.5" /> Business
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium truncate">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{mask(businessName)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Privacy / visibility toggle */}
        <button
          onClick={toggle}
          aria-label={hidden ? "Show financial details" : "Hide financial details"}
          aria-pressed={hidden}
          title={hidden ? "Financial details hidden" : "Financial details visible"}
          className={`flex items-center gap-2 h-9 px-3 rounded-xl glass-input border text-[11px] font-bold transition-all ${
            hidden
              ? "text-amber-300 border-amber-500/40"
              : "text-gray-400 hover:text-gray-200 border-white/10"
          }`}
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="hidden sm:inline">{hidden ? "Hidden" : "Visible"}</span>
        </button>

        <NotificationCenter />
      </div>
    </div>
  );
}

export function TrustPill({ label = "Human approval · Trust boundary" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold text-gray-400">
      <ShieldCheck className="h-3 w-3 text-brand-emerald" />
      {label}
    </span>
  );
}
