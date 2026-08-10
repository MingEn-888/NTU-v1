"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Send, BarChart3, User } from "lucide-react";

const TABS = [
  { id: "home", label: "Home", icon: Home, href: "/dashboard" },
  { id: "payments", label: "Payments", icon: Send, href: "/payments" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/dashboard#analytics" },
  { id: "profile", label: "Profile", icon: User, href: "/settings" },
];

/** Fixed 4-tab bottom nav for small screens. */
export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href.startsWith("#")) {
      // Analytics points into the dashboard — treat as active on /dashboard.
      return pathname === "/dashboard" && href === "/dashboard#analytics";
    }
    return pathname === href;
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden glass-navbar border-t border-white/10 px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
      aria-label="Primary mobile navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {TABS.map(({ id, label, icon: Icon, href }) => {
          const active = isActive(href);
          return (
            <Link
              key={id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                active ? "text-brand-cyan" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span
                className={`flex items-center justify-center h-8 w-14 rounded-xl transition-all ${
                  active ? "bg-brand-500/15 border border-brand-500/30 shadow-glow" : ""
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
