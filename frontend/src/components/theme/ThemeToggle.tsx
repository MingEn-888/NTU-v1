"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import type { ThemeMode } from "@/lib/theme";

const OPTIONS: { mode: ThemeMode; label: string; icon: React.ElementType }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "Auto", icon: Monitor },
];

/**
 * Global theme switch — segmented control for Light / Dark / System.
 * Compact (navbar) and full (settings) variants share the same design language.
 */
export function ThemeToggle({
  variant = "compact",
  className = "",
}: {
  variant?: "compact" | "full";
  className?: string;
}) {
  const { mode, setMode } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (variant === "full") {
    return (
      <div
        className={`grid grid-cols-3 gap-1 p-1 rounded-2xl glass-input border ${className}`}
        role="radiogroup"
        aria-label="Theme mode"
      >
        {OPTIONS.map(({ mode: m, label, icon: Icon }) => {
          const active = mounted ? mode === m : m === "system";
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-brand-600 to-brand-500 text-on-accent shadow-glow"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {active && mounted && <Check className="h-3 w-3" />}
            </button>
          );
        })}
      </div>
    );
  }

  // Compact: a segmented pill cycling Light / Dark / System.
  // `mounted` avoids a server/client hydration mismatch on aria-checked caused
  // by the theme initializer (server always renders "system").
  return (
    <div
      className={`flex items-center gap-0.5 p-1 rounded-xl glass-input border relative ${className}`}
      role="radiogroup"
      aria-label="Theme mode"
      title="Theme: Light / Dark / System"
    >
      {OPTIONS.map(({ mode: m, label, icon: Icon }) => {
        const active = mounted ? mode === m : m === "system";
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={`${label} mode`}
            onClick={() => setMode(m)}
            className={`flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-200 ${
              active
                ? "bg-gradient-to-br from-brand-600 to-brand-500 text-on-accent shadow-glow"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
