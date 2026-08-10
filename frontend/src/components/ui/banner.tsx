"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, ShieldAlert } from "lucide-react";

export type BannerTone = "error" | "success" | "warning" | "info" | "neutral";

const TONE_ICON: Record<BannerTone, React.ElementType> = {
  error: XCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  neutral: ShieldAlert,
};

const TONE_CLASS: Record<BannerTone, string> = {
  error: "banner-error",
  success: "banner-success",
  warning: "banner-warning",
  info: "banner-info",
  neutral: "banner-neutral",
};

/**
 * Reusable feedback banner. Replaces the dozens of ad-hoc
 * `bg-*-500/10 border border-*-500/20` blocks across the app so error,
 * success, warning and info states are visually consistent.
 */
export function Banner({
  tone = "info",
  title,
  message,
  icon,
  className = "",
  children,
}: {
  tone?: BannerTone;
  title?: React.ReactNode;
  message?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <div className={`banner ${TONE_CLASS[tone]} animate-fade-in ${className}`} role="status">
      <span className="mt-0.5 shrink-0">{icon ?? <Icon className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1">
        {title && <div className="font-bold mb-0.5">{title}</div>}
        {message && <div className="opacity-90">{message}</div>}
        {children}
      </div>
    </div>
  );
}

export function ErrorBanner(props: Omit<React.ComponentProps<typeof Banner>, "tone">) {
  return <Banner tone="error" {...props} />;
}

export function SuccessBanner(props: Omit<React.ComponentProps<typeof Banner>, "tone">) {
  return <Banner tone="success" {...props} />;
}

export function WarningBanner(props: Omit<React.ComponentProps<typeof Banner>, "tone">) {
  return <Banner tone="warning" {...props} />;
}

export function InfoBanner(props: Omit<React.ComponentProps<typeof Banner>, "tone">) {
  return <Banner tone="info" {...props} />;
}
