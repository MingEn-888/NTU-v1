"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Send,
  Route,
  History,
  Settings,
  PlayCircle,
  MessageSquareText,
  Zap,
  Command,
  CornerDownLeft,
  Sparkles,
} from "lucide-react";

interface SearchEntry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  action: () => void;
  keywords: string;
}

/**
 * Global command palette (Ctrl/Cmd + K).
 * Searches the whole product: screens, quick actions and theme switching.
 */
export function GlobalSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<SearchEntry[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };
    return [
      {
        id: "dash",
        group: "Screens",
        label: "Business Payments Dashboard",
        hint: "Overview · treasury · approvals",
        icon: LayoutDashboard,
        action: go("/dashboard"),
        keywords: "dashboard overview home treasury payments approval queue analytics",
      },
      {
        id: "assistant",
        group: "Screens",
        label: "AI Financial Assistant",
        hint: "Chatbox · describe a payment",
        icon: MessageSquareText,
        action: go("/operations"),
        keywords: "chat assistant chatbox ai intent payment operations ask",
      },
      {
        id: "routes",
        group: "Screens",
        label: "Transfer Route Optimizer",
        hint: "Route comparison · gas · cross-chain",
        icon: Route,
        action: go("/"),
        keywords: "route router transfer bridge cross chain gas optimizer comparison",
      },
      {
        id: "history",
        group: "Screens",
        label: "Transaction History",
        hint: "Recents · status",
        icon: History,
        action: go("/dashboard"),
        keywords: "history transactions tx recents status",
      },
      {
        id: "demo",
        group: "Screens",
        label: "Product Demo Walkthrough",
        hint: "End-to-end payment simulation",
        icon: PlayCircle,
        action: go("/demo"),
        keywords: "demo walkthrough product simulation example",
      },
      {
        id: "settings",
        group: "Screens",
        label: "Settings & Preferences",
        hint: "Theme · network · wallet · profile",
        icon: Settings,
        action: go("/settings"),
        keywords: "settings preferences theme network wallet profile notifications",
      },
      {
        id: "new-intent",
        group: "Quick actions",
        label: "Start a new payment intent",
        hint: "Open the financial assistant",
        icon: Send,
        action: go("/operations"),
        keywords: "new intent payment pay invoice start send",
      },
      {
        id: "light",
        group: "Appearance",
        label: "Switch to Light mode",
        hint: "Pastel mint theme",
        icon: Sparkles,
        action: () => {
          setOpen(false);
          document
            .querySelector('[aria-label="Light"]')
            ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        },
        keywords: "light mode theme appearance white",
      },
      {
        id: "dark",
        group: "Appearance",
        label: "Switch to Dark mode",
        hint: "Deep purple · mint highlights",
        icon: Zap,
        action: () => {
          setOpen(false);
          document
            .querySelector('[aria-label="Dark"]')
            ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        },
        keywords: "dark mode theme appearance black purple",
      },
    ];
  }, [router]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.label} ${e.keywords}`.toLowerCase().includes(q));
  }, [query, entries]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchEntry[]>();
    for (const r of results) {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    }
    return Array.from(map.entries());
  }, [results]);

  // Keyboard shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[activeIdx]?.action();
    }
  };

  const run = useCallback((idx: number) => results[idx]?.action(), [results]);

  return (
    <>
      {/* Search trigger */}
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl glass-input border text-[12px] text-gray-400 hover:text-gray-200 hover:border-brand-400/50 transition-all ${className}`}
        aria-label="Global search (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        <span className="hidden lg:inline font-medium">Search…</span>
        <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
          <div className="relative w-full max-w-xl glass-dropdown rounded-2xl overflow-hidden shadow-glow animate-scale-in">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
              <Search className="h-5 w-5 text-brand-cyan shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIdx(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search screens, actions, settings…"
                className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-gray-400">
                ESC
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {grouped.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No results for “{query}”
                </div>
              )}
              {grouped.map(([group, items]) => (
                <div key={group} className="mb-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {group}
                  </div>
                  {items.map((item) => {
                    const idx = results.indexOf(item);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => run(idx)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                          idx === activeIdx
                            ? "bg-brand-500/15 border border-brand-500/30"
                            : "border border-transparent"
                        }`}
                      >
                        <span
                          className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                            idx === activeIdx
                              ? "bg-gradient-to-br from-brand-600 to-brand-500 text-on-accent"
                              : "bg-white/5 text-brand-cyan"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-bold text-gray-100 truncate">
                            {item.label}
                          </span>
                          {item.hint && (
                            <span className="block text-[10px] text-gray-500 truncate">
                              {item.hint}
                            </span>
                          )}
                        </span>
                        {idx === activeIdx && (
                          <CornerDownLeft className="h-3.5 w-3.5 text-brand-cyan shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/10 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-white/5 border border-white/10">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded bg-white/5 border border-white/10">↵</kbd> open
              </span>
              <span className="ml-auto">Ctrl + K to toggle</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
