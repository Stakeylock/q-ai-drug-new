import React from "react";

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

export default UnavailableState;
