"use client";

import React from "react";
import { Inbox } from "lucide-react";

/**
 * Consistent empty state for lists / panels / queues.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-2.5 px-6 py-12 animate-fade-in ${className}`}
    >
      <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <div>
        <div className="text-sm font-bold text-gray-200">{title}</div>
        {description && <p className="text-xs text-gray-500 mt-1 max-w-sm">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
