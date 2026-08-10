"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ShieldAlert,
  Zap,
  Fuel,
  ArrowRight,
  X,
} from "lucide-react";

interface Notification {
  id: string;
  kind: "approval" | "success" | "risk" | "route" | "gas";
  title: string;
  body: string;
  time: string;
  href?: string;
  unread?: boolean;
}

// Sample notification feed — product state, mirrors the live operations.
const INITIAL: Notification[] = [
  {
    id: "n1",
    kind: "approval",
    title: "Payment awaiting your approval",
    body: "Pay Alice RM2,500 · invoice INV-1024 · risk LOW · route saved $2.10",
    time: "2m ago",
    href: "/operations?review=b3000000-0000-0000-0000-000000000001",
    unread: true,
  },
  {
    id: "n2",
    kind: "route",
    title: "Optimized route selected",
    body: "Bridge via Polygon then USDC — 42% lower gas than direct",
    time: "18m ago",
    href: "/",
    unread: true,
  },
  {
    id: "n3",
    kind: "success",
    title: "Payment settled on-chain",
    body: "Vendor settlement #INV-2048 confirmed · 0x…9f3a",
    time: "1h ago",
    href: "/dashboard",
  },
  {
    id: "n4",
    kind: "gas",
    title: "Gas-saving opportunity",
    body: "Ethereum base fee is low — good time to batch approvals",
    time: "3h ago",
    href: "/",
  },
  {
    id: "n5",
    kind: "risk",
    title: "Risk check passed",
    body: "Contractor payment $1,200 USDC evaluated LOW risk",
    time: "5h ago",
    href: "/operations",
  },
];

const KIND_META: Record<
  Notification["kind"],
  { icon: React.ElementType; cls: string }
> = {
  approval: { icon: Bell, cls: "text-amber-300 bg-amber-500/15 border-amber-500/30" },
  success: { icon: CheckCircle2, cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" },
  risk: { icon: ShieldAlert, cls: "text-brand-cyan bg-brand-cyan/15 border-brand-cyan/30" },
  route: { icon: Zap, cls: "text-brand-300 bg-brand-500/15 border-brand-500/30" },
  gas: { icon: Fuel, cls: "text-mint-300 bg-mint-300/15 border-mint-300/30" },
};

/** Notification bell + dropdown in the global navbar. */
export function NotificationCenter({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(INITIAL);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((i) => i.unread).length;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const markAll = () => setItems((prev) => prev.map((i) => ({ ...i, unread: false })));
  const dismiss = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex items-center justify-center h-9 w-9 rounded-xl glass-input border text-gray-400 hover:text-gray-200 hover:border-brand-400/50 transition-all"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-gradient-to-br from-brand-500 to-brand-accent text-on-accent text-[9px] font-bold flex items-center justify-center shadow-glow">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] glass-dropdown rounded-2xl overflow-hidden z-50 animate-scale-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold text-gray-100">Notifications</span>
              {unread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 text-[9px] font-bold uppercase">
                  {unread} new
                </span>
              )}
            </div>
            <button
              onClick={markAll}
              className="text-[10px] font-bold text-brand-cyan hover:text-brand-300 uppercase tracking-wider"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-gray-500">
                You're all caught up ✨
              </div>
            )}
            {items.map((n) => {
              const meta = KIND_META[n.kind];
              const Icon = meta.icon;
              const inner = (
                <div className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors group">
                  <span
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.cls}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-gray-100 truncate">
                        {n.title}
                      </span>
                      <span className="text-[10px] text-gray-500 shrink-0">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{n.body}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(n.id);
                    }}
                    aria-label="Dismiss"
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-200 transition-opacity shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })}
          </div>

          <div className="px-4 py-2.5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-gray-500">Live from the treasury</span>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-cyan hover:text-brand-300"
            >
              Open dashboard <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
