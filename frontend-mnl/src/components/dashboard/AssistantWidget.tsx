"use client";

import Link from "next/link";
import StatusBadge from "../ui/StatusBadge";
import { Button } from "../ui/Button";

interface AssistantWidgetProps {
  onPromptClick?: (prompt: string) => void;
  className?: string;
  isCompact?: boolean;
  activePath?: string;
}

export default function AssistantWidget({ 
  onPromptClick, 
  className = "",
  isCompact = false,
  activePath = ""
}: AssistantWidgetProps) {
  const getSuggestedPrompts = () => {
    if (activePath.includes("/targets")) return [
      "Summarize target evidence",
      "Show top variants",
      "Explain target ranking",
      "Generate target summary",
    ];
    if (activePath.includes("/docking")) return [
      "Compare docking poses",
      "Explain GNINA scores",
      "View interaction map",
      "Summarize binding affinity",
    ];
    if (activePath.includes("/validation")) return [
      "Highlight toxicity risks",
      "Summarize metabolic profile",
      "Identify ADMET liabilities",
      "Generate safety report",
    ];
    if (activePath.includes("/simulation")) return [
      "Analyze trajectory stability",
      "Explain energy profile",
      "Summarize MD results",
      "Recommend next simulation",
    ];
    if (activePath.includes("/quantum")) return [
      "Review QML rescoring",
      "Show electronic properties",
      "Explain quantum reranking",
      "Compare reranked candidates",
    ];
    
    return [
      "Explain current results",
      "Identify risks",
      "Recommend next step",
      "Generate report summary",
    ];
  };

  const suggestedPrompts = getSuggestedPrompts();

  return (
    <div className={`ui-card-surface flex flex-col gap-4 p-5 border-accent/20 bg-accent/[0.02] shadow-xl ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.4)]">
            <svg className="h-6 w-6 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-black tracking-tight text-text">Pharma LLM</h3>
            <p className="text-[10px] font-bold text-muted-text/60 uppercase tracking-widest">Context-aware research assistant</p>
          </div>
        </div>
        {!isCompact && <StatusBadge status="active" label="AI Live" size="sm" />}
      </div>

      <div className="rounded-xl border border-accent/10 bg-surface-subtle/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-accent">Active Research Context</span>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-text/90">EGFR NSCLC Discovery Program</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-text/70">
            <span>EGFR / P00533</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>Docking & Quantum</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-text/40">Suggested Prompts</span>
        <div className="grid gap-1.5">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onPromptClick?.(prompt)}
              className="flex items-center justify-between rounded-lg border border-border/40 bg-card/50 p-2 text-left text-[10px] font-bold text-text/70 transition-all hover:border-accent/40 hover:bg-accent/5 group"
            >
              {prompt}
              <svg className="h-3 w-3 text-muted-text/30 group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button 
          className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest"
          onClick={() => onPromptClick?.("Ask Pharma LLM")}
        >
          Ask Pharma LLM
        </Button>
        <Link href="/copilot" className="flex items-center justify-center h-9 px-3 rounded-lg border border-border/40 bg-card hover:bg-surface-subtle transition-all" title="Open Full Assistant">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-text whitespace-nowrap">Open Assistant</span>
        </Link>
      </div>
    </div>
  );
}
