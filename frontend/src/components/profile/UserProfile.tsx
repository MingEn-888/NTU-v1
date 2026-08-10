"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Settings,
  User,
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { formatAddress } from "@/lib/utils";

/** User profile avatar + dropdown (navbar). */
export function UserProfile({ className = "" }: { className?: string }) {
  const router = useRouter();
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initials = "TC"; // TechCorp — the seeded business operator.

  const handleConnect = async () => {
    try {
      if (wallet.isConnected) wallet.disconnect();
      else await wallet.connect();
    } catch {
      /* surfaced via wallet state */
    }
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="flex items-center gap-2 px-1.5 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
      >
        <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-600 via-brand-accent to-mint-300 flex items-center justify-center text-on-accent text-[12px] font-extrabold shadow-glow">
          {initials}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 glass-dropdown rounded-2xl overflow-hidden z-50 animate-scale-in">
          <div className="px-4 py-3.5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-600 via-brand-accent to-mint-300 flex items-center justify-center text-on-accent text-[13px] font-extrabold shadow-glow">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-gray-100 truncate">
                  TechCorp Solutions
                </div>
                <div className="text-[10px] text-gray-500 font-mono truncate">
                  {wallet.isConnected ? formatAddress(wallet.address || "") : "Operator account"}
                </div>
              </div>
            </div>
          </div>

          <div className="p-1.5">
            <MenuItem icon={LayoutDashboard} label="Business Payments" href="/dashboard" onClose={() => setOpen(false)} />
            <MenuItem icon={Settings} label="Settings & Preferences" href="/settings" onClose={() => setOpen(false)} />
          </div>

          <div className="p-1.5 border-t border-white/10">
            <button
              onClick={handleConnect}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-gray-300 hover:bg-white/5 transition-colors"
            >
              <Wallet className="h-4 w-4 text-brand-cyan" />
              {wallet.isConnected ? "Disconnect wallet" : "Connect wallet"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                router.push("/settings#security");
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-gray-300 hover:bg-white/5 transition-colors"
            >
              <ShieldCheck className="h-4 w-4 text-mint-300" />
              Security
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-gray-300 hover:bg-white/5 transition-colors"
            >
              <User className="h-4 w-4 text-gray-400" />
              Profile
            </button>
            <button
              onClick={() => {
                setOpen(false);
                router.push("/settings");
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-danger hover:bg-danger-soft/40 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClose,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-gray-300 hover:bg-white/5 hover:text-gray-100 transition-colors"
    >
      <Icon className="h-4 w-4 text-brand-cyan" />
      {label}
    </Link>
  );
}
