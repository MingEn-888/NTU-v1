import type { Config } from "tailwindcss";

/**
 * PayMaster design system — premium Web3/DeFi fintech.
 * Palette: #000000 #240248 #47038F #5603AD #8367C7 #B3E9C7 #BBF1C9 #C2F8CB #F0FFF1
 *
 * Every colour is a CSS variable (RGB triplet) so the ENTIRE system flips
 * between Light / Dark / System themes at runtime. `--c-*` values live in
 * `globals.css` per `[data-theme="…"]`.
 */
const config: Config = {
  // Support both class-based toggling (legacy) and our data-theme attribute.
  darkMode: ["class", "[data-theme='dark']"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./comps/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--c-bg) / <alpha-value>)",
        foreground: "rgb(var(--c-fg) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--c-surface-2) / <alpha-value>)",
          hover: "rgb(var(--c-surface-3) / <alpha-value>)",
          border: "rgb(var(--c-border) / <alpha-value>)",
        },
        // Brand — purple→mint scale, theme-aware.
        brand: {
          50: "rgb(var(--c-brand-50) / <alpha-value>)",
          100: "rgb(var(--c-brand-100) / <alpha-value>)",
          200: "rgb(var(--c-brand-200) / <alpha-value>)",
          300: "rgb(var(--c-brand-300) / <alpha-value>)",
          400: "rgb(var(--c-brand-400) / <alpha-value>)",
          500: "rgb(var(--c-brand-500) / <alpha-value>)",
          600: "rgb(var(--c-brand-600) / <alpha-value>)",
          700: "rgb(var(--c-brand-700) / <alpha-value>)",
          accent: "rgb(var(--c-brand-accent) / <alpha-value>)",
          emerald: "rgb(var(--c-brand-emerald) / <alpha-value>)",
          cyan: "rgb(var(--c-brand-cyan) / <alpha-value>)",
        },
        // Dedicated mint palette from the brand brief.
        mint: {
          50: "rgb(var(--c-mint-50) / <alpha-value>)",
          100: "rgb(var(--c-mint-100) / <alpha-value>)",
          200: "rgb(var(--c-mint-200) / <alpha-value>)",
          300: "rgb(var(--c-mint-300) / <alpha-value>)",
          400: "rgb(var(--c-mint-400) / <alpha-value>)",
          500: "rgb(var(--c-mint-500) / <alpha-value>)",
        },
        deep: {
          50: "rgb(var(--c-deep-50) / <alpha-value>)",
          100: "rgb(var(--c-deep-100) / <alpha-value>)",
          200: "rgb(var(--c-deep-200) / <alpha-value>)",
          300: "rgb(var(--c-deep-300) / <alpha-value>)",
          400: "rgb(var(--c-deep-400) / <alpha-value>)",
          500: "rgb(var(--c-deep-500) / <alpha-value>)",
          600: "rgb(var(--c-deep-600) / <alpha-value>)",
          700: "rgb(var(--c-deep-700) / <alpha-value>)",
          800: "rgb(var(--c-deep-800) / <alpha-value>)",
          900: "rgb(var(--c-deep-900) / <alpha-value>)",
        },
        // Semantic status palette (theme-aware for both text + soft fills).
        success: {
          DEFAULT: "rgb(var(--c-success) / <alpha-value>)",
          soft: "rgb(var(--c-success-soft) / <alpha-value>)",
          border: "rgb(var(--c-success-border) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--c-danger) / <alpha-value>)",
          soft: "rgb(var(--c-danger-soft) / <alpha-value>)",
          border: "rgb(var(--c-danger-border) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--c-warning) / <alpha-value>)",
          soft: "rgb(var(--c-warning-soft) / <alpha-value>)",
          border: "rgb(var(--c-warning-border) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--c-info) / <alpha-value>)",
          soft: "rgb(var(--c-info-soft) / <alpha-value>)",
          border: "rgb(var(--c-info-border) / <alpha-value>)",
        },
        // Tailwind stock palettes remapped onto our tokens (legacy components).
        emerald: {
          50: "rgb(var(--c-emerald-50) / <alpha-value>)",
          100: "rgb(var(--c-emerald-100) / <alpha-value>)",
          200: "rgb(var(--c-emerald-200) / <alpha-value>)",
          300: "rgb(var(--c-emerald-300) / <alpha-value>)",
          400: "rgb(var(--c-emerald-400) / <alpha-value>)",
          500: "rgb(var(--c-emerald-500) / <alpha-value>)",
          600: "rgb(var(--c-emerald-600) / <alpha-value>)",
          700: "rgb(var(--c-emerald-700) / <alpha-value>)",
        },
        amber: {
          50: "rgb(var(--c-amber-50) / <alpha-value>)",
          100: "rgb(var(--c-amber-100) / <alpha-value>)",
          200: "rgb(var(--c-amber-200) / <alpha-value>)",
          300: "rgb(var(--c-amber-300) / <alpha-value>)",
          400: "rgb(var(--c-amber-400) / <alpha-value>)",
          500: "rgb(var(--c-amber-500) / <alpha-value>)",
          600: "rgb(var(--c-amber-600) / <alpha-value>)",
          700: "rgb(var(--c-amber-700) / <alpha-value>)",
        },
        red: {
          50: "rgb(var(--c-red-50) / <alpha-value>)",
          100: "rgb(var(--c-red-100) / <alpha-value>)",
          200: "rgb(var(--c-red-200) / <alpha-value>)",
          300: "rgb(var(--c-red-300) / <alpha-value>)",
          400: "rgb(var(--c-red-400) / <alpha-value>)",
          500: "rgb(var(--c-red-500) / <alpha-value>)",
          600: "rgb(var(--c-red-600) / <alpha-value>)",
          700: "rgb(var(--c-red-700) / <alpha-value>)",
          800: "rgb(var(--c-red-800) / <alpha-value>)",
          900: "rgb(var(--c-red-900) / <alpha-value>)",
          950: "rgb(var(--c-red-950) / <alpha-value>)",
        },
        rose: {
          100: "rgb(var(--c-rose-100) / <alpha-value>)",
          200: "rgb(var(--c-rose-200) / <alpha-value>)",
          300: "rgb(var(--c-rose-300) / <alpha-value>)",
          400: "rgb(var(--c-rose-400) / <alpha-value>)",
          500: "rgb(var(--c-rose-500) / <alpha-value>)",
        },
        violet: {
          300: "rgb(var(--c-violet-300) / <alpha-value>)",
          400: "rgb(var(--c-violet-400) / <alpha-value>)",
          500: "rgb(var(--c-violet-500) / <alpha-value>)",
        },
        cyan: {
          100: "rgb(var(--c-cyan-100) / <alpha-value>)",
          200: "rgb(var(--c-cyan-200) / <alpha-value>)",
          300: "rgb(var(--c-cyan-300) / <alpha-value>)",
          400: "rgb(var(--c-cyan-400) / <alpha-value>)",
          500: "rgb(var(--c-cyan-500) / <alpha-value>)",
        },
        orange: {
          300: "rgb(var(--c-orange-300) / <alpha-value>)",
          400: "rgb(var(--c-orange-400) / <alpha-value>)",
          500: "rgb(var(--c-orange-500) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "SFMono-Regular",
          "ui-monospace",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgb(var(--c-shadow) / 0.30)",
        glow: "0 0 20px rgb(var(--c-brand-400) / 0.35)",
        "glow-cyan": "0 0 20px rgb(var(--c-mint-300) / 0.35)",
        "glow-emerald": "0 0 20px rgb(var(--c-mint-300) / 0.45)",
        "glow-soft": "0 6px 24px 0 rgb(var(--c-brand-600) / 0.18)",
        card: "0 10px 40px -12px rgb(var(--c-shadow) / 0.35)",
      },
      backdropBlur: {
        xs: "2px",
        glass: "18px",
        lg: "24px",
      },
      // h-4.5 / w-4.5 / size-5.5 … (Tailwind v3 default scale has no .5 steps)
      spacing: {
        "4.5": "1.125rem",
        "5.5": "1.375rem",
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "3xl": "1.5rem",
      },
      animation: {
        pulseFast: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        glow: "glow 3s infinite alternate",
        "step-pop": "step-pop 0.35s ease-out both",
        "exec-pulse": "exec-pulse 1.4s ease-in-out infinite",
        "flow-dash": "flow-dash 0.6s linear infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "fade-in": "fade-in 0.3s ease-out both",
        "slide-up": "slide-up 0.35s ease-out both",
        "scale-in": "scale-in 0.18s ease-out both",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        glow: {
          "0%": { opacity: "0.4", filter: "blur(20px)" },
          "100%": { opacity: "0.8", filter: "blur(30px)" },
        },
        "step-pop": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "exec-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "flow-dash": {
          from: { backgroundPosition: "0 0" },
          to: { backgroundPosition: "0 10px" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
