"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Palette,
  Globe,
  Wallet,
  Bell,
  User,
  ShieldCheck,
  Info,
  Settings as SettingsIcon,
  CheckCircle2,
  Zap,
  Landmark,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTreasury } from "@/hooks/useTreasury";
import { useTheme } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { EcosystemNetworkPanel } from "@/components/web3/NetworkSelector";
import { formatAddress } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "network", label: "Network", icon: Globe },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "about", label: "About", icon: Info },
];

interface ToggleRowProps {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
        checked
          ? "bg-gradient-to-r from-brand-600 to-brand-500 shadow-glow"
          : "bg-white/10 border border-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function ToggleRow({ title, desc, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-gray-100">{title}</div>
        <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function SectionCard({
  id,
  icon: Icon,
  title,
  subtitle,
  children,
  className = "",
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`glass-panel rounded-2xl border border-white/10 shadow-glass scroll-mt-24 ${className}`}
    >
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-on-accent flex items-center justify-center shadow-glow shrink-0">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="text-[15px] font-extrabold text-gray-100 tracking-tight">{title}</h2>
          <p className="text-[11px] text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Settings & Preferences screen — Profile / Wallet / Security / Networks / Notifications / Appearance / About. */
export function SettingsPage() {
  const wallet = useWallet();
  const treasury = useTreasury(wallet.address, wallet.chainId, wallet.balance, wallet.tokenBalances);
  const { mode, resolved } = useTheme();

  const [notif, setNotif] = useState({
    approvals: true,
    routeUpdates: true,
    gasAlerts: true,
    riskAlerts: true,
    digest: false,
  });

  // Scroll to the section referenced by #hash (from sidebar / profile menu).
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleConnect = async () => {
    try {
      if (wallet.isConnected) wallet.disconnect();
      else await wallet.connect();
    } catch {
      /* surfaced via wallet state */
    }
  };

  const setNotifKey = (key: keyof typeof notif) => (v: boolean) =>
    setNotif((prev) => ({ ...prev, [key]: v }));

  return (
    <div className="pb-16">
      {/* ======================= Header ======================= */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-6 border border-white/10 shadow-glass mb-6">
        <div className="absolute -top-16 -right-16 w-72 h-72 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-mint-300/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-accent to-mint-300 flex items-center justify-center shadow-glow">
              <SettingsIcon className="h-7 w-7 text-on-accent" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-gray-100 tracking-tight">
                Settings & Preferences
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Theme, networks, wallet, notifications and security for your financial assistant.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400">
            <Sparkles className="h-4 w-4 text-brand-cyan" />
            <span>
              Theme: <strong className="text-gray-100 capitalize">{mode}</strong>
              <span className="text-gray-500"> · applied {resolved}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* ======================= Settings sub-nav ======================= */}
        <aside className="lg:col-span-1 glass-panel rounded-2xl border border-white/10 p-3 sticky top-24 hidden lg:block">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            On this page
          </div>
          <nav className="space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-gray-400 hover:text-gray-100 hover:bg-white/5 transition-colors"
              >
                <Icon className="h-4 w-4 text-brand-cyan" />
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ======================= Content ======================= */}
        <div className="lg:col-span-3 space-y-6">
          {/* Profile */}
          <SectionCard
            id="profile"
            icon={User}
            title="Profile"
            subtitle="The business operating this treasury."
          >
            <div className="flex items-center gap-4">
              <span className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-accent to-mint-300 flex items-center justify-center text-on-accent text-lg font-extrabold shadow-glow">
                TC
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-extrabold text-gray-100 truncate">
                  {treasury.businessProfile?.business_name || "TechCorp Solutions Sdn Bhd"}
                </div>
                <div className="text-[12px] text-gray-500">
                  Operator account · seeded treasury
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                Verified
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-gray-500 font-semibold uppercase">Business ID</div>
                <div className="text-[12px] font-mono text-gray-200 truncate mt-0.5">
                  {treasury.businessProfile?.id || "b2000000-…-0001"}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-gray-500 font-semibold uppercase">Preferred chain</div>
                <div className="text-[12px] font-bold text-brand-cyan capitalize mt-0.5">
                  {treasury.preferredChain || "polygon"}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Wallet */}
          <SectionCard
            id="wallet"
            icon={Wallet}
            title="Wallet"
            subtitle="Connect the operator wallet that authorises treasury payments."
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Status
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${wallet.isConnected ? "bg-emerald-400" : "bg-gray-400"}`} />
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${wallet.isConnected ? "bg-emerald-500" : "bg-gray-500"}`} />
                  </span>
                  <span className="text-[14px] font-bold text-gray-100">
                    {wallet.isConnected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <div className="text-[12px] text-gray-400 font-mono mt-1.5 truncate">
                  {wallet.isConnected ? formatAddress(wallet.address || "") : "0x…"}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Balance: <span className="text-gray-300 font-semibold">{wallet.balance}</span> · Chain:{" "}
                  <span className="text-gray-300 font-semibold">{wallet.chainId ?? "—"}</span>
                </div>
              </div>
              <button
                onClick={handleConnect}
                disabled={wallet.isConnecting}
                className={`px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                  wallet.isConnected
                    ? "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                    : "bg-gradient-to-r from-brand-600 to-brand-accent text-on-accent shadow-glow hover:from-brand-500 hover:to-brand-600"
                }`}
              >
                {wallet.isConnecting ? "Connecting…" : wallet.isConnected ? "Disconnect" : "Connect Wallet"}
              </button>
            </div>
            <p className="mt-3 text-[11px] text-gray-500">
              Signing is done with your wallet. The SmartWallet executes only after you approve.
            </p>
          </SectionCard>

          {/* Security */}
          <SectionCard
            id="security"
            icon={ShieldCheck}
            title="Security"
            subtitle="Deterministic by design — the AI never moves funds by itself."
          >
            <div className="space-y-3">
              {[
                { icon: Zap, title: "Trust boundary", desc: "AI parses intent · math selects the route · you sign. No auto-execution, ever." },
                { icon: CheckCircle2, title: "Human approval required", desc: "Every payment passes an explicit approval gate before the SmartWallet executes." },
                { icon: ShieldCheck, title: "Nonce-protected SmartWallet", desc: "Replay protection and reentrancy guards on every mutative call." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="h-8 w-8 rounded-lg bg-brand-500/15 border border-brand-500/30 text-brand-cyan flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[13px] font-bold text-gray-100">{title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Network */}
          <SectionCard
            id="network"
            icon={Globe}
            title="Networks"
            subtitle="Multi-ecosystem routing — Ethereum, Solana, Polygon, BNB Chain and more."
          >
            <EcosystemNetworkPanel />
            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
              <Landmark className="h-4.5 w-4.5 text-brand-cyan shrink-0 mt-0.5" />
              <div>
                <div className="text-[13px] font-bold text-gray-100">
                  Default routing chain: <span className="text-brand-cyan capitalize">{treasury.preferredChain || "polygon"}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Payouts are routed from the treasury vault. Bridge &amp; route comparison always runs before any transfer.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Notifications */}
          <SectionCard
            id="notifications"
            icon={Bell}
            title="Notifications"
            subtitle="Choose what the assistant keeps you posted about."
          >
            <div className="divide-y divide-white/5">
              <ToggleRow title="Payment approvals" desc="Alert when a payment is waiting for your signature." checked={notif.approvals} onChange={setNotifKey("approvals")} />
              <ToggleRow title="Route updates" desc="Notify when an optimised route is selected or changes." checked={notif.routeUpdates} onChange={setNotifKey("routeUpdates")} />
              <ToggleRow title="Gas-saving opportunities" desc="Warn when network fees are low enough to batch approvals." checked={notif.gasAlerts} onChange={setNotifKey("gasAlerts")} />
              <ToggleRow title="Risk alerts" desc="Immediate alert if a payment is flagged HIGH risk." checked={notif.riskAlerts} onChange={setNotifKey("riskAlerts")} />
              <ToggleRow title="Weekly digest" desc="A summary of settled payments and gas saved every Monday." checked={notif.digest} onChange={setNotifKey("digest")} />
            </div>
          </SectionCard>

          {/* Appearance */}
          <SectionCard
            id="appearance"
            icon={Palette}
            title="Appearance"
            subtitle="Light, Dark or System — the whole interface adapts instantly."
          >
            <ThemeToggle variant="full" className="max-w-sm" />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { name: "Light", desc: "Pastel mint · deep purple ink", swatch: "bg-[#F0FFF1]" },
                { name: "Dark", desc: "Black & deep purple · mint glow", swatch: "bg-[#240248]" },
                { name: "System", desc: "Follows your device", swatch: "bg-gradient-to-r from-[#F0FFF1] to-[#240248]" },
              ].map((s) => (
                <div key={s.name} className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className={`h-10 rounded-lg border border-white/10 mb-2 ${s.swatch}`} />
                  <div className="text-[11px] font-bold text-gray-100">{s.name}</div>
                  <div className="text-[9px] text-gray-500">{s.desc}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
              Palette: <code className="text-brand-cyan">#000000 · #240248 · #47038F · #5603AD · #8367C7 · #B3E9C7 · #BBF1C9 · #C2F8CB · #F0FFF1</code>
            </p>
          </SectionCard>

          {/* About */}
          <SectionCard
            id="about"
            icon={Info}
            title="About"
            subtitle="PayMaster — AI financial assistant for business payments."
          >
            <div className="space-y-3 text-[12px] text-gray-400">
              <p>
                Turn business payment instructions into optimised, explainable blockchain transactions.
                v1.3.2 · multi-ecosystem routing · Light / Dark / System themes.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/demo" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-500/15 border border-brand-500/40 text-brand-200 text-[11px] font-bold hover:bg-brand-500/25 transition-colors">
                  Product demo <ExternalLink className="h-3 w-3" />
                </Link>
                <Link href="/" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-[11px] font-bold hover:bg-white/10 transition-colors">
                  Route optimizer
                </Link>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
