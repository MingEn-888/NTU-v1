"use client";

import React, { useState } from "react";
import { LayoutDashboard, Send, Route, History, Settings, Bot, ArrowUpRight } from "lucide-react";

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
    { id: "routes", label: "Solver Routes", icon: Route, badge: "3 Options" },
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

      {/* Bottom Agent Card */}
      <div className="p-3.5 rounded-xl glass-card border border-white/10 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-brand-500/20 text-brand-500">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Gemini Intent Agent</div>
            <div className="text-[11px] text-emerald-400 font-medium">Ready for intents</div>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          AI Agent optimizes gas, slippage, and execution paths across chains automatically.
        </p>
        <a
          href="#docs"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:text-brand-100 transition-colors"
        >
          View Documentation <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </aside>
  );
};
