"use client";

// =============================================================================
// Privacy mode — a global "hide financial details" toggle. When enabled, every
// sensitive value across the UI (balances, amounts, gas, savings) is masked.
// =============================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export const MASK = "••••";

interface PrivacyContextValue {
  hidden: boolean;
  toggle: () => void;
  /** Mask a formatted value when privacy mode is on. */
  mask: (value: string) => string;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  const toggle = useCallback(() => setHidden((v) => !v), []);

  const mask = useCallback((value: string) => (hidden ? MASK : value), [hidden]);

  const value = useMemo(() => ({ hidden, toggle, mask }), [hidden, toggle, mask]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  return (
    ctx ?? {
      hidden: false,
      toggle: () => {},
      mask: (v: string) => v,
    }
  );
}
