"use client";

import type { SimilarityResult } from "@/types/api";

interface ResultsGridProps {
  results: SimilarityResult[];
  isLoading?: boolean;
  onCardClick?: (result: SimilarityResult) => void;
}

export default function ResultsGrid({
  results,
  isLoading = false,
  onCardClick,
}: ResultsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="ui-card-surface h-[320px] animate-pulse p-6">
            <div className="h-6 w-3/4 rounded-md bg-muted-bg/50" />
            <div className="mt-4 h-4 w-1/2 rounded-md bg-muted-bg/40" />
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="h-10 rounded-xl bg-muted-bg/30" />
              <div className="h-10 rounded-xl bg-muted-bg/30" />
            </div>
            <div className="mt-auto h-12 rounded-xl bg-muted-bg/20" />
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-full bg-surface-subtle p-8 mb-6">
          <svg className="h-10 w-10 text-text-secondary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary">No similarities detected</h3>
        <p className="text-xs text-text-secondary/60 mt-2 max-w-xs">Enter a SMILES sequence and execute search to identify nearest neighbors in chemical space.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {results.map((result) => {
        const similarityPercent = (result.similarity * 100).toFixed(1);
        const isHighConfidence = result.similarity > 0.85;

        return (
          <article
            key={result.molecule_id}
            onClick={() => onCardClick?.(result)}
            className="ui-card-surface group cursor-pointer p-6 shadow-premium transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:ring-2 hover:ring-primary/20"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Candidate ID</p>
                <h3 className="text-sm font-black tracking-tight text-text group-hover:text-primary transition-colors">
                  {result.molecule_id}
                </h3>
              </div>
              <div className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                isHighConfidence ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-surface-subtle text-text-secondary'
              }`}>
                {isHighConfidence ? 'High Match' : 'Normal'}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold text-text-secondary uppercase">Similarity</p>
                  <p className="text-2xl font-black text-text">{similarityPercent}%</p>
                </div>
                <div className="h-2 w-24 rounded-full bg-surface-subtle overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${similarityPercent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/40 bg-surface-subtle/30 p-3">
                  <p className="text-[9px] font-bold text-text-secondary uppercase">MW</p>
                  <p className="text-[11px] font-black text-text">{result.mw ? result.mw.toFixed(1) : "N/A"}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-surface-subtle/30 p-3">
                  <p className="text-[9px] font-bold text-text-secondary uppercase">QED</p>
                  <p className="text-[11px] font-black text-text">{result.qed ? result.qed.toFixed(2) : "N/A"}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <span className="rounded-full bg-primary/5 border border-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">EGFR-TK</span>
                <span className="rounded-full bg-accent/5 border border-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent uppercase">HER2</span>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-border/30 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">View Details</span>
              <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14m-7-7 7 7-7 7" />
              </svg>
            </div>
          </article>
        );
      })}
    </div>
  );
}