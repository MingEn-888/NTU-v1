// =============================================================================
// Global theme system — Light / Dark / System (Auto).
// Values are persisted to localStorage and applied as `data-theme` + a
// Tailwind `dark`/`light` class on <html>. The `system` mode follows the OS
// preference (matchMedia) live.
// =============================================================================

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "paymaster-theme";
export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

/** Safe localStorage read (SSR / privacy-mode friendly). */
export function readStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

/** Safe localStorage write. */
export function persistTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Does the OS currently prefer light? */
export function systemPrefersLight(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

/** Resolve a mode into the concrete applied theme. */
export function resolveTheme(mode: ThemeMode, prefersLight = systemPrefersLight()): ResolvedTheme {
  if (mode === "system") return prefersLight ? "light" : "dark";
  return mode;
}

/**
 * Apply a resolved theme to the document. `data-theme` drives the CSS
 * variables; the Tailwind `dark`/`light` class is kept for compatibility.
 */
export function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
}
