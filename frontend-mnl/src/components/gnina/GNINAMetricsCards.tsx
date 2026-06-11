import React from "react";
import type { GninaResult } from "@/types/api";

interface GNINAMetricsCardsProps {
  items: GninaResult[];
}

export function GNINAMetricsCards({ items }: GNINAMetricsCardsProps) {
  const totalPoses = items.length;
  
  const highConfidenceCount = items.filter(i => i.cnn_score >= 0.8).length;
  const avgCnnScore = totalPoses > 0 
    ? (items.reduce((sum, i) => sum + i.cnn_score, 0) / totalPoses).toFixed(3)
    : "0.000";
    
  const bestAffinity = totalPoses > 0
    ? Math.min(...items.map(i => i.cnn_affinity)).toFixed(1)
    : "0.0";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/20 border-y border-border/40 mb-8 overflow-hidden rounded-lg">
      <div className="bg-card p-4 flex flex-col items-center justify-center text-center gap-1 hover:bg-surface-subtle/50 transition-colors cursor-default group">
        <span className="text-[18px] font-black text-text group-hover:text-accent transition-colors">{totalPoses}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-text/50">Total Poses</span>
      </div>
      <div className="bg-card p-4 flex flex-col items-center justify-center text-center gap-1 hover:bg-surface-subtle/50 transition-colors cursor-default group">
        <span className="text-[18px] font-black text-text group-hover:text-accent transition-colors">{avgCnnScore}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-text/50">Avg CNN Score</span>
      </div>
      <div className="bg-card p-4 flex flex-col items-center justify-center text-center gap-1 hover:bg-surface-subtle/50 transition-colors cursor-default group">
        <span className="text-[18px] font-black text-text group-hover:text-accent transition-colors">{bestAffinity}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-text/50">Best Affinity</span>
      </div>
      <div className="bg-card p-4 flex flex-col items-center justify-center text-center gap-1 hover:bg-surface-subtle/50 transition-colors cursor-default group">
        <span className="text-[18px] font-black text-success group-hover:text-success/80 transition-colors">{highConfidenceCount}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-text/50">High Confidence Poses</span>
      </div>
    </div>
  );
}
