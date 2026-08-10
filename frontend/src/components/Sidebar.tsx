"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Send,
  Route,
  History,
  Settings,
  ShieldCheck,
  PlayCircle,
  Globe,
  ChevronRight,
  ReceiptText,
  BarChart3,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
}

const ECOSYSTEMS: { name: string; symbol: string; dot: string }[] = [
  { name: "Ethereum", symbol: "ETH", dot: "bg-[#627EEA]" },
  { name: "Solana", symbol: "SOL", dot: "bg-[#14F195]" },
  { name: "Polygon", symbol: "POL", dot: "bg-[#8247E5]" },
  { name: "BNB Chain", symbol: "BNB", dot: "bg-[#F0B90B]" },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { id: "payments", label: "Payments", icon: ReceiptText, href: "/payments" },
    { id: "demo", label: "Product Demo", icon: PlayCircle, href: "/demo", badge: "Walkthrough" },
    { id: "create", label: "New Intent", icon: Send, href: "/operations", badge: "Live" },
    { id: "routes", label: "Route Optimizer", icon: Route, href: "/", badge: "Demo" },
    { id: "history", label: "Tx History", icon: History, href: "/dashboard" },
    { id: "analytics", label: "Analytics", icon: BarChart3, href: "/dashboard#analytics" },
    { id: "settings", label: "Preferences", icon: Settings, href: "/settings" },
  ];

  return (
    <aside className="w-64 h-[calc(100vh-65px)] sticky top-[65px] glass-panel border-r border-white/10 p-4 flex flex-col justify-between hidden md:flex overflow-y-auto">
      {/* Top Nav List */}
      <div className="space-y-5">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Navigation
        </div>

        <nav className="space-y-1.5">
          {/* Business Payment Operations — primary surface */}
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600/30 to-mint-300/10 border border-brand-500/40 shadow-glow text-gray-100 transition-all duration-150 hover:from-brand-600/40 hover:to-mint-300/20"
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-4 w-4 text-brand-cyan" />
              <span>Business Payments</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500 text-on-accent">
              Core
            </span>
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = (() => {
              if (item.href === "/") return pathname === "/";
              const base = item.href.split("#")[0];
              return pathname?.startsWith(base) ?? false;
            })();
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-brand-500/20 text-gray-100 border border-brand-500/40 shadow-glow"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? "text-brand-cyan" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-brand-500 text-on-accent"
                        : "bg-white/10 text-gray-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Multi-ecosystem section */}
        <div>
          <div className="flex items-center gap-2 px-3 py-1.5 mb-1.5">
            <Globe className="h-3.5 w-3.5 text-brand-cyan" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Ecosystems
            </span>
            <span className="text-[9px] text-gray-600 ml-auto">8 supported</span>
          </div>
          <div className="space-y-1">
            {ECOSYSTEMS.map((ec) => (
              <Link
                key={ec.name}
                href="/"
                className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-[12px] font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
              >
                <span className={`h-2 w-2 rounded-full ${ec.dot}`} />
                <span>{ec.name}</span>
                <span className="ml-auto text-[10px] text-gray-600 font-mono">{ec.symbol}</span>
              </Link>
            ))}
          </div>
          <Link
            href="/settings#network"
            className="mt-1.5 w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-bold text-brand-cyan hover:text-brand-300 hover:bg-white/5 transition-colors"
          >
            Manage networks
            <ChevronRight className="h-3 w-3 ml-auto" />
          </Link>
        </div>
      </div>

      {/* Product footer */}
      <div className="mt-4 px-3 py-3 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
          <ShieldCheck className="h-3 w-3 text-brand-emerald" />
          Trust boundary
        </div>
        <p className="text-[11px] leading-relaxed text-gray-500">
          AI parses intent · math selects the route · <span className="text-gray-300">you sign</span>
        </p>
        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-[9px] text-gray-600">Light · Dark · System</span>
          <Link
            href="/settings#appearance"
            className="text-[9px] font-bold text-brand-cyan hover:text-brand-300"
          >
            Appearance
          </Link>
        </div>
      </div>
    </aside>
  );
};
