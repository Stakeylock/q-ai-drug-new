import React from "react";

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

export default PlaceholderNotice;
