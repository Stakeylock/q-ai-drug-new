"use client";

import React from "react";
import StatusBadge, { StatusType } from "./StatusBadge";

interface ReportCardProps {
  name: string;
  type: string;
  date: string;
  status?: StatusType;
  exportType?: string;
  size?: string;
  className?: string;
}

export default function ReportCard({ 
  name, 
  type, 
  date, 
  status = "completed", 
  exportType = "PDF",
  size,
  className = "" 
}: ReportCardProps) {
  return (
    <div className={`ui-card-surface group flex items-center justify-between p-4 transition-all hover:border-accent/30 hover:bg-accent/5 ${className}`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-surface-subtle group-hover:border-accent/40 transition-colors">
          <svg className="h-5 w-5 text-muted-text group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-[13px] font-bold text-text group-hover:text-accent transition-colors">{name}</h4>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-text/50">{type}</span>
            <span className="h-1 w-1 rounded-full bg-border/40" />
            <span className="text-[10px] text-muted-text/40">{date}</span>
            {status !== 'completed' && (
              <>
                <span className="h-1 w-1 rounded-full bg-border/40" />
                <StatusBadge status={status} size="sm" />
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {size && <span className="hidden text-[11px] font-mono text-muted-text/40 sm:block">{size}</span>}
        <div className="flex items-center rounded-md border border-border/40 overflow-hidden">
          <button className="h-8 px-3 text-[10px] font-black uppercase tracking-widest bg-muted-bg hover:bg-accent hover:text-white transition-all">
            {exportType}
          </button>
          <div className="w-[1px] h-4 bg-border/40" />
          <button className="h-8 w-8 flex items-center justify-center bg-muted-bg hover:bg-accent hover:text-white transition-all">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
