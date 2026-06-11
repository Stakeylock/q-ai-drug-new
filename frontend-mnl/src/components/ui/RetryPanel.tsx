"use client";
import React, { useState } from "react";

interface RetryPanelProps {
  message: string;
  onRetry: () => void | Promise<void>;
  buttonLabel?: string;
  className?: string;
}

export default function RetryPanel({
  message,
  onRetry,
  buttonLabel = "Retry Action",
  className = "",
}: RetryPanelProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (e) {
      console.error("Retry failed:", e);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 border border-dashed border-border/40 rounded-xl bg-surface-subtle/20 gap-3 text-center ${className}`}>
      <span className="text-[11px] font-bold text-muted-text/70">{message}</span>
      <button
        type="button"
        disabled={isRetrying}
        onClick={handleRetry}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted-bg px-3.5 text-[10px] font-black uppercase tracking-widest text-text transition-all hover:bg-muted-bg/80 active:scale-95 disabled:opacity-50"
      >
        <svg className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 10H18.228" />
        </svg>
        <span>{isRetrying ? "Retrying..." : buttonLabel}</span>
      </button>
    </div>
  );
}
