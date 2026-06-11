import React from "react";

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
          <div className="absolute h-10 w-10 rounded-full bg-accent/10 border border-accent/20 animate-ping" />
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

export default LoadingState;
