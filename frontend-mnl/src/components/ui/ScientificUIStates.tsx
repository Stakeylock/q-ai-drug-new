import React, { useState } from "react";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Running scientific calculation...",
  className = "",
}) => {
  return (
    <div className={`ui-card-surface flex flex-col items-center justify-center p-12 text-center border border-border/30 bg-card ${className}`}>
      <div className="flex flex-col items-center gap-6 max-w-sm">
        <div className="relative flex items-center justify-center">
          {/* Inner pulse */}
          <div className="absolute h-10 w-10 rounded-full bg-accent/10 border border-accent/20 animate-ping" />
          {/* Rotating ring */}
          <div className="h-12 w-12 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-widest text-accent">Compute Orchestrator Active</h4>
          <p className="text-sm font-semibold text-text">{message}</p>
          <p className="text-[10px] text-muted-text/50 font-mono tracking-tighter">Connecting to backend-mnl high-performance engine...</p>
        </div>
      </div>
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Scientific Computation Error",
  error,
  onRetry,
  className = "",
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const errorMessage = error instanceof Error ? error.message : String(error || "An unknown exception occurred during workflow execution.");

  return (
    <div className={`ui-card-surface p-8 border border-rose-500/20 bg-rose-950/[0.03] rounded-xl space-y-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black uppercase tracking-widest text-rose-400">{title}</h3>
          <p className="text-sm text-text-secondary">Execution halted. The platform was unable to complete the calculations or retrieve downstream data.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded bg-rose-500 text-white hover:bg-rose-600 transition-all cursor-pointer"
            >
              Retry Computation
            </button>
          )}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded border border-border/30 text-muted-text hover:bg-muted-bg transition-all cursor-pointer"
          >
            {showDetails ? "Hide Stack Trace" : "Show Technical Details"}
          </button>
        </div>

        {showDetails && (
          <div className="p-4 rounded-lg bg-black/40 border border-border/20 font-mono text-[10px] text-rose-300 leading-relaxed overflow-x-auto max-h-48 scrollbar-thin">
            <div>API Endpoint: backend-mnl ↔ q-ai-drug pipeline</div>
            <div className="mt-2 text-white/90">{errorMessage}</div>
          </div>
        )}
      </div>
    </div>
  );
};

interface UnavailableStateProps {
  serviceName: string;
  onRetry?: () => void;
  className?: string;
}

export const UnavailableState: React.FC<UnavailableStateProps> = ({
  serviceName,
  onRetry,
  className = "",
}) => {
  return (
    <div className={`ui-card-surface p-8 border border-border/40 text-center flex flex-col items-center justify-center p-12 ${className}`}>
      <div className="flex flex-col items-center gap-6 max-w-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/50 border border-border/40">
          <svg className="h-8 w-8 text-muted-text/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-text">Service Temporarily Unavailable</h3>
          <p className="text-sm text-muted-text/60 leading-relaxed">
            The compute service <strong>{serviceName}</strong> is unreachable. Computational outputs cannot be calculated or loaded at this time.
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded bg-accent text-bg hover:bg-accent/90 transition-all cursor-pointer"
          >
            Check Availability
          </button>
        )}
      </div>
    </div>
  );
};

interface EmptyStateProps {
  title?: string;
  message?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No Data Found",
  message = "No scientific evidence or results could be found for this query.",
  className = "",
}) => {
  return (
    <div className={`ui-card-surface flex flex-col items-center justify-center p-12 text-center border border-border/30 bg-card/40 ${className}`}>
      <div className="flex flex-col items-center gap-4 max-w-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/50 border border-border/40">
          <svg className="h-6 w-6 text-muted-text/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-bold text-text mb-1">{title}</h4>
          <p className="text-xs text-muted-text leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
};

interface PartialResultsStateProps {
  completedRuns: number;
  totalRuns: number;
  message?: string;
  className?: string;
}

export const PartialResultsState: React.FC<PartialResultsStateProps> = ({
  completedRuns,
  totalRuns,
  message = "Some computations failed or timed out during the batch run.",
  className = "",
}) => {
  return (
    <div className={`p-4 rounded-xl border border-warning/20 bg-warning/5 flex items-start gap-4 ${className}`}>
      <div className="shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <h4 className="text-xs font-black uppercase tracking-widest text-text">Partial Compute Results</h4>
        <p className="text-[11px] text-muted-text/75 leading-relaxed mt-1">
          {message} Only {completedRuns} of {totalRuns} structures were successfully evaluated on the compute cluster.
        </p>
      </div>
    </div>
  );
};

interface RetryPanelProps {
  onRetry: () => void;
  message?: string;
  className?: string;
}

export const RetryPanel: React.FC<RetryPanelProps> = ({
  onRetry,
  message = "Unable to connect to live compute scheduler.",
  className = "",
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-6 border border-dashed border-border/40 rounded-xl space-y-3 ${className}`}>
      <span className="text-[11px] text-muted-text font-mono">{message}</span>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 rounded bg-accent/15 border border-accent/20 text-[10px] font-black uppercase tracking-widest text-accent hover:bg-accent/25 transition-all cursor-pointer"
      >
        Retry Action
      </button>
    </div>
  );
};

interface PlaceholderNoticeProps {
  featureName: string;
  className?: string;
}

export const PlaceholderNotice: React.FC<PlaceholderNoticeProps> = ({
  featureName,
  className = "",
}) => {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-dashed border-border/40 bg-zinc-900/40 p-8 text-center ${className}`}>
      {/* Background warning pattern watermark */}
      <div className="absolute inset-0 opacity-[0.02] bg-grid-noise pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
          <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">Not Scientifically Implemented</h3>
          <h4 className="text-base font-bold text-text">{featureName}</h4>
          <p className="text-xs text-muted-text leading-relaxed">
            This module is a layout placeholder demonstrating visual integration options. No live molecular mechanics or deep network predictions are evaluated for this component.
          </p>
        </div>

        {/* Legend */}
        <div className="w-full flex items-center justify-center gap-4 py-2 px-3 border border-border/20 rounded bg-black/20 text-[9px] font-black uppercase tracking-widest text-muted-text/60">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>MOCK DEFAULT</span>
          </div>
          <div className="h-3 w-px bg-border/40" />
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            <span>LAYOUT ONLY</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ScientificWarning: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-[10px] font-bold text-indigo-300 leading-relaxed ${className}`}>
      <svg className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <span className="uppercase font-black text-indigo-400 tracking-wider">Scientific Disclaimer:</span> Computational hypothesis only. Wet-lab validation required. Do not use as final therapeutic or pharmacological validation.
      </div>
    </div>
  );
};
