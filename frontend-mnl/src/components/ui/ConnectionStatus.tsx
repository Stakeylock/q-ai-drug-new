"use client";

import React, { useEffect, useState } from "react";
import { checkBackendHealth, isDemoMode } from "@/services/api";

export function useBackendConnectionStatus() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const performCheck = async () => {
    if (isDemoMode()) {
      setIsConnected(true);
      return;
    }
    setIsChecking(true);
    const healthy = await checkBackendHealth();
    setIsConnected(healthy);
    setIsChecking(false);
  };

  useEffect(() => {
    // Perform initial check
    performCheck();

    // Listen to custom window events triggered by api request failures
    const handleStatusEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail.connected === "boolean") {
        setIsConnected(detail.connected);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("backend-connection-status", handleStatusEvent);
    }

    // Dynamic heartbeat check every 12 seconds
    const interval = setInterval(performCheck, 12000);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("backend-connection-status", handleStatusEvent);
      }
      clearInterval(interval);
    };
  }, []);

  return { isConnected, isChecking, recheck: performCheck };
}

export const BackendStatusBanner: React.FC = () => {
  const { isConnected, isChecking, recheck } = useBackendConnectionStatus();
  const demo = isDemoMode();

  if (demo) {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-amber-400">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Simulated Mode Enabled — Fully Simulated Workflow</span>
        </div>
        <div className="text-[10px] text-amber-500/80">
          NEXT_PUBLIC_DEMO_MODE=true
        </div>
      </div>
    );
  }

  if (isConnected) {
    return null;
  }

  return (
    <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-rose-400 backdrop-blur-md sticky top-0 z-50 animate-slide-down">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30">
          <svg className="w-4 h-4 text-rose-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <span className="uppercase tracking-widest font-black text-rose-500 block text-[10px]">Connection Unreachable</span>
          <span className="text-text-secondary text-[11px]">backend-mnl API Orchestration server is offline or unreachable. Scientific operations suspended.</span>
        </div>
      </div>
      <button
        onClick={recheck}
        disabled={isChecking}
        className="px-3 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider text-rose-300 disabled:opacity-50 transition-all cursor-pointer"
      >
        {isChecking ? "Rechecking..." : "Attempt Reconnect"}
      </button>
    </div>
  );
};

export const ConnectionHealthIndicator: React.FC = () => {
  const { isConnected } = useBackendConnectionStatus();
  const demo = isDemoMode();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border/30 max-w-max">
      <span className={`h-2 w-2 rounded-full ${
        demo ? "bg-amber-500" : isConnected ? "bg-emerald-500" : "bg-rose-500 animate-ping"
      }`} />
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/80">
        {demo ? "Demo Mode" : isConnected ? "System Online" : "System Offline"}
      </span>
    </div>
  );
};
