import React from "react";
import type { ClaimMatrixSummary } from "@/types/claimMatrix";

interface ClaimMatrixSummaryCardsProps {
  summary: ClaimMatrixSummary;
}

export function ClaimMatrixSummaryCards({ summary }: ClaimMatrixSummaryCardsProps) {
  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "level 3": return "text-success";
      case "level 2": return "text-warning";
      case "level 1": return "text-accent";
      case "level 0": return "text-muted-text/50";
      default: return "text-accent";
    }
  };

  const metrics = [
    { label: "Total Claims", value: summary.total_claims.toLocaleString(), color: "text-text group-hover:text-accent" },
    ...Object.entries(summary.levels_count).map(([level, count]) => ({
      label: `${level} Evidence`,
      value: count.toLocaleString(),
      color: getLevelColor(level)
    }))
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px bg-border/20 border-y border-border/40 mb-8 overflow-hidden rounded-lg">
      {metrics.map((metric, i) => (
        <div key={i} className="bg-card p-4 flex flex-col items-center justify-center text-center gap-1 hover:bg-surface-subtle/50 transition-colors cursor-default group">
          <span className={`text-[18px] font-black transition-colors ${metric.color}`}>
            {metric.value}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-text/50">
            {metric.label}
          </span>
        </div>
      ))}
    </div>
  );
}
