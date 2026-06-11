"use client";
import React, { ReactNode, useState } from "react";

interface ErrorStateProps {
  icon?: ReactNode;
  title: string;
  explanation: string;
  debugHint?: string;
  action?: ReactNode;
  className?: string;
}

export default function ErrorState({
  icon,
  title,
  explanation,
  debugHint,
  action,
  className = "",
}: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={`ui-card-surface p-8 border border-rose-500/20 bg-rose-950/[0.03] rounded-xl space-y-6 ${className}`}>
      <div className="flex items-start gap-4">
        {icon ? (
          <div className="shrink-0 text-rose-400">{icon}</div>
        ) : (
          <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        )}
        <div className="space-y-1 text-left">
          <h3 className="text-base font-black uppercase tracking-widest text-rose-400">{title}</h3>
          <p className="text-sm text-text-secondary">{explanation}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {action && (
            <div className="shrink-0">
              {action}
            </div>
          )}
          {debugHint && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded border border-border/30 text-muted-text hover:bg-muted-bg transition-all cursor-pointer"
            >
              {showDetails ? "Hide Stack Trace" : "Show Technical Details"}
            </button>
          )}
        </div>

        {showDetails && debugHint && (
          <div className="text-left p-4 rounded-lg bg-black/40 border border-border/20 font-mono text-[10px] text-rose-300 leading-relaxed overflow-x-auto max-h-48 scrollbar-thin">
            <span className="font-black uppercase tracking-wider text-rose-400/80 block mb-1">Debug Telemetry / Signal:</span>
            <p className="break-all whitespace-pre-wrap">{debugHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
