"use client";

import React from "react";
import {
  Landmark,
  Coins,
  Building2,
  Plus,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { usePrivacy } from "@/lib/privacy";

interface Rail {
  id: string;
  type: "bank" | "digital" | "provider";
  name: string;
  last4: string;
  balance: string;
  currency: string;
  status: "connected" | "pending" | "verified";
  icon: React.ElementType;
}

const RAILS: Rail[] = [
  {
    id: "bank",
    type: "bank",
    name: "Business Bank Account",
    last4: "4821",
    balance: "$48,200.00",
    currency: "USD",
    status: "verified",
    icon: Landmark,
  },
  {
    id: "treasury",
    type: "digital",
    name: "Digital Asset Treasury",
    last4: "9012",
    balance: "$104,820.20",
    currency: "USDC",
    status: "connected",
    icon: Coins,
  },
  {
    id: "provider",
    type: "provider",
    name: "Corporate Payment Provider",
    last4: "7742",
    balance: "$12,040.00",
    currency: "USD",
    status: "connected",
    icon: Building2,
  },
];

const STATUS_META = {
  connected: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  verified: "text-brand-cyan bg-brand-cyan/10 border-brand-cyan/30",
  pending: "text-amber-300 bg-amber-500/10 border-amber-500/30",
};

/**
 * Linked payment methods / settlement rails — horizontal scroll list.
 * Every rail shows provider, masked id, balance, currency and status.
 */
export function SettlementRails() {
  const { mask } = usePrivacy();

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-brand-cyan" />
          <h3 className="text-[13px] font-extrabold text-gray-100 tracking-tight">
            Payment Methods
          </h3>
          <span className="text-[10px] text-gray-500">settlement rails</span>
        </div>
        <button className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-cyan hover:text-brand-300">
          <Plus className="h-3.5 w-3.5" /> Link
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1">
        {RAILS.map((r) => {
          const Icon = r.icon;
          const statusCls = STATUS_META[r.status];
          return (
            <div
              key={r.id}
              className="min-w-[220px] flex-1 rounded-2xl glass-card p-4 space-y-3 shrink-0"
            >
              <div className="flex items-center justify-between">
                <span className="h-9 w-9 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-cyan flex items-center justify-center">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${statusCls}`}>
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {r.status}
                </span>
              </div>
              <div>
                <div className="text-[12.5px] font-bold text-gray-100">{r.name}</div>
                <div className="text-[10px] text-gray-500 font-mono">•••• {r.last4}</div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">
                    Balance
                  </div>
                  <div className="text-[14px] font-extrabold text-gray-100 tabular-nums">
                    {mask(r.balance)}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-brand-cyan">{r.currency}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
