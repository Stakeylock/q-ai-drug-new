"use client";

import { useState, useEffect } from "react";
import type { RecentRun } from "@/types/api";

interface ActivityPanelProps {
  recentRuns: RecentRun[];
  loading: boolean;
  error: string | null;
}

type ExperimentStatus = "running" | "completed" | "failed" | "queued" | "unknown";

interface ActivityItem {
  id: string;
  experiment: string;
  status: ExperimentStatus;
  timestamp: string;
  details: string;
}

function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status: string): ExperimentStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "running") return "running";
  if (normalized === "completed" || normalized === "ok" || normalized === "success") return "completed";
  if (normalized === "failed" || normalized === "error") return "failed";
  if (normalized === "queued" || normalized === "pending") return "queued";
  return "unknown";
}

function getStatusBadgeClass(status: ExperimentStatus): string {
  if (status === "running") {
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  }
  if (status === "failed") {
    return "bg-rose-500/10 text-rose-500 border-rose-500/20";
  }
  if (status === "queued") {
    return "bg-sky-500/10 text-sky-500 border-sky-500/20";
  }
  if (status === "unknown") {
    return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
  return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
}

function buildActivityItems(recentRuns: RecentRun[]): ActivityItem[] {
  return recentRuns.map((run) => {
    const status = normalizeStatus(run.status);
    return {
      id: run.run_id,
      experiment: run.experiment_name,
      status,
      timestamp: formatTimestamp(run.created_at),
      details: `Dataset: ${run.dataset_name}`,
    };
  });
}

export default function ActivityPanel({ recentRuns, loading, error }: ActivityPanelProps) {
  const items = buildActivityItems(recentRuns);
  const runningCount = items.filter((item) => item.status === "running").length;

  const [logs, setLogs] = useState([
    { event: "GNINA docking completed", time: "Just now", color: "text-success" },
    { event: "Quantum reranking initialized", time: "2m ago", color: "text-primary" },
    { event: "ADMET filtering complete", time: "5m ago", color: "text-success" },
    { event: "OpenMM simulation running", time: "8m ago", color: "text-accent" },
  ]);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("demo_mode") === "true") {
      const interval = setInterval(() => {
        const events = [
          "GNINA docking completed", "Quantum reranking initialized", "ADMET filtering complete",
          "OpenMM simulation running", "Lead candidate identified", "Toxicity screening finished",
          "H-bond map generated", "Solubility predicted"
        ];
        const colors = ["text-success", "text-primary", "text-accent", "text-warning"];
        const newLog = {
          event: events[Math.floor(Math.random() * events.length)],
          time: "Just now",
          color: colors[Math.floor(Math.random() * colors.length)]
        };
        setLogs(prev => [newLog, ...prev.slice(0, 3)]);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <aside className="ui-card-surface flex flex-col p-8 shadow-premium transition-all duration-300 hover:shadow-2xl">
      <div className="mb-8 flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
            Experimental Activity
          </h2>
          <p className="text-sm font-medium text-text-secondary/70">
            Real-time execution monitoring
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 shadow-sm">
          <div className={`h-1.5 w-1.5 rounded-full bg-primary ${loading || runningCount > 0 ? "animate-pulse" : ""}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
            {loading ? "Initializing..." : `${runningCount} ACTIVE`}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border-2 border-error/20 bg-error/5 p-5 text-sm font-medium text-error flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-border/50 bg-surface-subtle/30 p-6 space-y-3">
                <div className="skeleton-shimmer h-4 w-32 rounded-full opacity-60" />
                <div className="skeleton-shimmer h-3 w-24 rounded-full opacity-40" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live Feed Section */}
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Live Research Feed</p>
              {logs.map((log, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-surface-subtle/30 p-3 border border-border/30 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-3">
                    <div className={`h-1.5 w-1.5 rounded-full bg-current ${log.color}`} />
                    <span className="text-[11px] font-bold text-text/80">{log.event}</span>
                  </div>
                  <span className="text-[9px] font-bold text-text-secondary/50 uppercase">{log.time}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-border/50 my-2" />

            {/* Recent Runs Section */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Recent Runs</p>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
                  <p className="text-xs font-bold uppercase tracking-widest">No runs found</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-2xl border border-border/50 bg-surface-subtle/40 p-5 transition-all duration-300 hover:border-primary/30 hover:bg-surface-subtle/80"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold tracking-tight text-text">
                          {item.experiment}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-[9px] font-bold text-text-secondary/50 uppercase tracking-wider">
                          {item.timestamp}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${getStatusBadgeClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

    </aside>
  );
}

