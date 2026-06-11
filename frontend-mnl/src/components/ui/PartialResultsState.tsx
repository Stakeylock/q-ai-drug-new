import React from "react";

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
      <div className="text-left">
        <h4 className="text-xs font-black uppercase tracking-widest text-text">Partial Compute Results</h4>
        <p className="text-[11px] text-muted-text/75 leading-relaxed mt-1">
          {message} Only {completedRuns} of {totalRuns} structures were successfully evaluated on the compute cluster.
        </p>
      </div>
    </div>
  );
};

export default PartialResultsState;
