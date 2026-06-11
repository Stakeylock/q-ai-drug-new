import React from "react";
import { resolveProvenance, ProvenanceType } from "@/utils/provenanceResolver";

interface ProvenanceBadgeProps {
  provenance?: ProvenanceType;
  items?: any[] | null;
  isDemo?: boolean;
  hasError?: boolean;
  isPlaceholder?: boolean;
  className?: string;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  provenance,
  items,
  isDemo,
  hasError,
  isPlaceholder,
  className = "",
}) => {
  const resolved = provenance || resolveProvenance({ items, isDemo, hasError, isPlaceholder });

  let styles = "bg-slate-500/20 text-slate-400 border-slate-500/30";
  let label = "Unknown Source";
  let icon = (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  switch (resolved) {
    case "live_compute":
      styles = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      label = "LIVE COMPUTE";
      icon = (
        <svg className="w-3.5 h-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
      break;
    case "imported":
      styles = "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
      label = "IMPORTED RESULT";
      icon = (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
      );
      break;
    case "simulated":
      styles = "bg-amber-500/20 text-amber-400 border-amber-500/30";
      label = "SIMULATED / DEMO";
      icon = (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
      break;
    case "placeholder":
      styles = "bg-slate-500/20 text-slate-400 border-slate-500/30";
      label = "PLACEHOLDER";
      icon = (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
      break;
    case "failed":
      styles = "bg-rose-500/20 text-rose-400 border-rose-500/30";
      label = "COMPUTE FAILED";
      icon = (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
      break;
    case "missing":
      styles = "bg-zinc-800/60 text-zinc-500 border-dashed border-zinc-700";
      label = "MISSING EVIDENCE";
      icon = (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      );
      break;
    case "stale":
    case "outdated":
      styles = "bg-orange-500/20 text-orange-400 border-orange-500/30";
      label = "STALE DATA";
      icon = (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
      break;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border backdrop-blur-sm ${styles} ${className}`}
      data-testid={`provenance-badge-${resolved}`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
};

interface EvidenceStatusBadgeProps {
  status: "verified" | "unverified" | "missing" | "simulated";
  className?: string;
}

export const EvidenceStatusBadge: React.FC<EvidenceStatusBadgeProps> = ({ status, className = "" }) => {
  let styles = "bg-slate-500/20 text-slate-400 border-slate-500/30";
  let label = "Unverified";

  if (status === "verified") {
    styles = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    label = "Verified Evidence";
  } else if (status === "missing") {
    styles = "bg-rose-500/20 text-rose-400 border-rose-500/30";
    label = "Missing Coordinates";
  } else if (status === "simulated") {
    styles = "bg-amber-500/20 text-amber-400 border-amber-500/30";
    label = "Simulated Mock";
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border ${styles} ${className}`}>
      {label}
    </span>
  );
};

interface ComputeSourceBadgeProps {
  source: "backend-mnl" | "q-ai-drug" | "unknown";
  className?: string;
}

export const ComputeSourceBadge: React.FC<ComputeSourceBadgeProps> = ({ source, className = "" }) => {
  let styles = "bg-slate-500/20 text-slate-400 border-slate-500/30";
  let label = "Unknown System";

  if (source === "backend-mnl") {
    styles = "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    label = "backend-mnl (Orchestrator)";
  } else if (source === "q-ai-drug") {
    styles = "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
    label = "q-ai-drug (Scientific compute)";
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border ${styles} ${className}`}>
      {label}
    </span>
  );
};

export const ProvenanceLegend: React.FC = () => {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-text/50 font-medium">
      <span className="uppercase tracking-wider">Legend:</span>
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>Live Compute</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        <span>Imported Results</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span>Simulated / Demo</span>
      </div>
    </div>
  );
};
