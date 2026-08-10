import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
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
        background: "#08090d",
        foreground: "#f3f4f6",
        card: {
          DEFAULT: "rgba(18, 20, 29, 0.75)",
          hover: "rgba(26, 29, 43, 0.85)",
          border: "rgba(255, 255, 255, 0.08)",
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          accent: "#8b5cf6",
          emerald: "#10b981",
          cyan: "#06b6d4",
        },
        // Semantic status palette used by banners / pills / feedback states.
        success: {
          DEFAULT: "#10b981",
          soft: "rgba(16, 185, 129, 0.12)",
          border: "rgba(16, 185, 129, 0.35)",
        },
        danger: {
          DEFAULT: "#f43f5e",
          soft: "rgba(244, 63, 94, 0.12)",
          border: "rgba(244, 63, 94, 0.35)",
        },
        warning: {
          DEFAULT: "#f59e0b",
          soft: "rgba(245, 158, 11, 0.12)",
          border: "rgba(245, 158, 11, 0.35)",
        },
        info: {
          DEFAULT: "#06b6d4",
          soft: "rgba(6, 182, 212, 0.12)",
          border: "rgba(6, 182, 212, 0.35)",
        },
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 20px rgba(99, 102, 241, 0.35)",
        "glow-cyan": "0 0 20px rgba(6, 182, 212, 0.35)",
        "glow-emerald": "0 0 20px rgba(16, 185, 129, 0.35)",
      },
      backdropBlur: {
        xs: "2px",
        glass: "16px",
      },
      // h-4.5 / w-4.5 / size-5.5 … (Tailwind v3 default scale has no .5 steps)
      spacing: {
        "4.5": "1.125rem",
        "5.5": "1.375rem",
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
      },
    },
  },
  plugins: [],
};

export default config;
