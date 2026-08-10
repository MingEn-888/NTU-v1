"use client";

import React from "react";

/**
 * Global shimmer skeleton primitives. Use for loading states across
 * pages and panels so every surface loads consistently.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "h-3 w-3/5" : "h-3 w-full"} />
      ))}
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-24 w-full ${className}`} />;
}

export function SkeletonCard({
  rows = 3,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`glass-panel rounded-2xl border border-white/10 p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonText key={i} lines={2} />
      ))}
    </div>
  );
}
