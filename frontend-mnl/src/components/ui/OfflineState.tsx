"use client";
import React, { ReactNode } from "react";

interface OfflineStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  reason?: string;
  action?: ReactNode;
  className?: string;
}

export default function OfflineState({
  icon,
  title,
  description,
  reason,
  action,
  className = "",
}: OfflineStateProps) {
  return (
    <div className={`ui-card-surface flex flex-col items-center justify-center p-12 text-center border-border/40 bg-surface-subtle/40 ${className}`}>
      <div className="flex flex-col items-center gap-6 max-w-md">
        {icon ? (
          <div className="text-muted-text/50">{icon}</div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted-bg/50 border border-border/40 text-muted-text/60 animate-pulse">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15zM12 4v4m0 0l-2-2m2 2l2-2" />
            </svg>
          </div>
        )}
        
        <div className="space-y-2">
          <h3 className="text-lg font-black tracking-tight text-text uppercase">{title}</h3>
          <p className="text-sm font-medium text-muted-text/80 leading-relaxed">
            {description}
          </p>
        </div>

        {reason && (
          <div className="inline-flex items-center gap-2 bg-muted-bg/50 px-3.5 py-1.5 rounded-lg border border-border/20 text-[10px] font-mono text-muted-text/60">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-text/40 shrink-0" />
            Cause: {reason}
          </div>
        )}

        {action && (
          <div className="pt-2">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
