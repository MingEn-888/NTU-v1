"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export function Spinner({
  label = "Loading…",
  className = "",
  size = "md",
}: {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <span className={`inline-flex items-center gap-2 text-xs text-gray-400 ${className}`}>
      <Loader2 className={`${sizeClass} animate-spin text-brand-500`} />
      {label}
    </span>
  );
}
