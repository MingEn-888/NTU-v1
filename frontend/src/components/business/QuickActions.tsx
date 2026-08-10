"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  FileText,
  HandCoins,
  ScanLine,
  ArrowRight,
} from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  href: string;
  primary?: boolean;
}

const ACTIONS: QuickAction[] = [
  {
    id: "new-payment",
    label: "New Payment",
    desc: "Create payment instruction",
    icon: Send,
    href: "/operations",
    primary: true,
  },
  {
    id: "pay-invoice",
    label: "Pay Invoice",
    desc: "Create payment from invoice",
    icon: FileText,
    href: "/operations?prompt=Pay%20invoice",
  },
  {
    id: "request",
    label: "Request Payment",
    desc: "Create a payment request",
    icon: HandCoins,
    href: "/operations?prompt=Request%20payment",
  },
  {
    id: "scan",
    label: "Scan / Import",
    desc: "Extract info from invoice or doc",
    icon: ScanLine,
    href: "/operations?prompt=Import%20invoice",
  },
];

/** 4-action business payment grid — "New Payment" is the primary action. */
export function QuickActions({ className = "" }: { className?: string }) {
  const router = useRouter();

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {ACTIONS.map(({ id, label, desc, icon: Icon, href, primary }) => (
        <button
          key={id}
          onClick={() => router.push(href)}
          className={`group flex flex-col items-start gap-2.5 p-4 rounded-2xl border text-left transition-all ${
            primary
              ? "bg-gradient-to-br from-brand-600 to-brand-500 text-on-accent border-brand-500/40 shadow-glow hover:shadow-glow-cyan hover:-translate-y-0.5"
              : "glass-card hover:-translate-y-0.5"
          }`}
        >
          <span
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              primary
                ? "bg-white/15 border border-white/20 text-on-accent"
                : "bg-brand-500/15 border border-brand-500/30 text-brand-cyan"
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <span className={`flex items-center gap-1.5 text-[13px] font-extrabold ${primary ? "text-on-accent" : "text-gray-100"}`}>
              {label}
              <ArrowRight
                className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 ${primary ? "text-on-accent/80" : "text-brand-cyan"}`}
              />
            </span>
            <span className={`block text-[10.5px] mt-0.5 ${primary ? "text-on-accent/80" : "text-gray-500"}`}>
              {desc}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
