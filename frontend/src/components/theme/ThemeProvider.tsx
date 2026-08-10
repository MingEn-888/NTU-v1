"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme";

interface ThemeContextValue {
  /** The user's chosen mode: light | dark | system. */
  mode: ThemeMode;
  /** The concrete theme currently applied. */
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** Convenience: resolve a target mode to its concrete value. */
  resolve: (mode: ThemeMode) => ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredTheme() ?? "system");
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readStoredTheme() ?? "system")
  );

  const resolve = useCallback((m: ThemeMode): ResolvedTheme => resolveTheme(m), []);

  // Apply immediately on mount + whenever the mode changes.
  useEffect(() => {
    const r = resolveTheme(mode);
    applyThemeToDocument(r);
    setResolved(r);
  }, [mode]);

  // Follow the OS preference live when in "system" mode.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const r = resolveTheme("system");
      applyThemeToDocument(r);
      setResolved(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    persistTheme(m);
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, setMode, resolve }),
    [mode, resolved, setMode, resolve]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Defensive fallback so the hook is safe outside the provider.
    return {
      mode: "system",
      resolved: "dark",
      setMode: () => {},
      resolve: (m) => resolveTheme(m),
    };
  }
  return ctx;
}
