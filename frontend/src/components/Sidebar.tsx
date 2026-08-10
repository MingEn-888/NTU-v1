"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Send, Route, History, Settings, MessageSquareText } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "create", label: "New Intent", icon: Send, badge: "Live" },
    { id: "routes", label: "Route Optimizer", icon: Route, badge: "3 Options" },
    { id: "history", label: "Tx History", icon: History },
    { id: "settings", label: "Preferences", icon: Settings },
  ];

  return (
    <aside className="w-64 h-[calc(100vh-65px)] sticky top-[65px] glass-panel border-r border-white/10 p-4 flex flex-col justify-between hidden md:flex">
      {/* Top Nav List */}
      <div className="space-y-6">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Navigation
        </div>

        <nav className="space-y-1.5">
          {/* Phase 4 — AI Payment Operations (real navigation) */}
          <Link
            href="/operations"
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600/25 to-brand-cyan/10 border border-brand-500/40 shadow-glow text-white transition-all duration-150 hover:from-brand-600/40 hover:to-brand-cyan/20"
          >
            <div className="flex items-center gap-3">
              <MessageSquareText className="h-4 w-4 text-brand-cyan" />
              <span>AI Payments</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500 text-white">
              Phase 4
            </span>
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-brand-500/20 text-white border border-brand-500/40 shadow-glow"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? "text-brand-500" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-brand-500 text-white"
                        : "bg-white/10 text-gray-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

    </aside>
  );
};
