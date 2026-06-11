"use client";

import React from "react";

export type StatusType = 
  | "active" 
  | "completed" 
  | "running" 
  | "generating"
  | "queued" 
  | "warning" 
  | "failed" 
  | "draft"
  | "archived"
  | "pending"
  | "imported";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function StatusBadge({ 
  status, 
  label, 
  size = "md",
  className = "" 
}: StatusBadgeProps) {
  const config: Record<StatusType, { color: string; bg: string; border: string; icon?: React.ReactNode }> = {
    active: { color: "var(--primary)", bg: "rgba(99, 102, 241, 0.1)", border: "rgba(99, 102, 241, 0.2)" },
    completed: { color: "var(--success)", bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.2)" },
    running: { color: "var(--accent)", bg: "rgba(34, 211, 238, 0.1)", border: "rgba(34, 211, 238, 0.2)" },
    generating: { color: "var(--accent)", bg: "rgba(34, 211, 238, 0.1)", border: "rgba(34, 211, 238, 0.2)" },
    queued: { color: "var(--muted-text)", bg: "var(--muted-bg)", border: "var(--border)" },
    warning: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)" },
    failed: { color: "var(--error)", bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)" },
    draft: { color: "var(--muted-text)", bg: "var(--muted-bg)", border: "var(--border)" },
    archived: { color: "var(--muted-text)", bg: "var(--muted-bg)", border: "var(--border)" },
    pending: { color: "var(--muted-text)", bg: "var(--muted-bg)", border: "var(--border)" },
    imported: { color: "var(--accent)", bg: "rgba(34, 211, 238, 0.08)", border: "rgba(34, 211, 238, 0.2)" },
  };

  const { color, bg, border } = config[status] || config.pending;

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[9px]",
    md: "px-2 py-1 text-[10px]",
    lg: "px-2.5 py-1.5 text-[11px]",
  };

  return (
    <span 
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-widest transition-all ${sizeClasses[size]} ${className}`}
      style={{ color, backgroundColor: bg, borderColor: border }}
    >
      {status === 'running' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: color }}></span>
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }}></span>
        </span>
      )}
      {label || status}
    </span>
  );
}
