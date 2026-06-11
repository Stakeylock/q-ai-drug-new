"use client";

import React from "react";
import StatusBadge, { StatusType } from "./StatusBadge";

interface PipelineStep {
  label: string;
  status: "completed" | "running" | "queued" | "warning" | "failed";
  description?: string;
}

interface PipelineStepperProps {
  steps: PipelineStep[];
  className?: string;
  title?: string;
}

export default function PipelineStepper({ 
  steps, 
  className = "",
  title = "Active Research Pipeline"
}: PipelineStepperProps) {
  return (
    <div className={`ui-card-surface flex flex-col gap-6 p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-text/80">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-text/40">Real-time status</span>
          <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
        </div>
      </div>

      <div className="relative flex items-center gap-4 flex-wrap pb-4 pt-2">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isActive = step.status === "running";
          const isCompleted = step.status === "completed";
          const isWarning = step.status === "warning";
          const isFailed = step.status === "failed";

          return (
            <div key={i} className="flex min-w-fit items-center gap-4">
              <div className="flex flex-col items-center gap-3">
                <div 
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all duration-500 ${
                    isCompleted 
                      ? "border-success bg-success/10 text-success shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                      : isActive
                      ? "border-primary bg-primary text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] ring-4 ring-primary/20"
                      : isFailed
                      ? "border-error bg-error/10 text-error shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                      : "border-border/40 bg-surface-subtle/30 text-muted-text/40"
                  }`}
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isFailed ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <span className="text-xs font-black">{i + 1}</span>
                  )}
                  
                  {isActive && (
                    <div className="absolute -right-1 -top-1 h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-primary"></span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center max-w-[100px] text-center">
                  <span className={`text-[10px] font-black uppercase tracking-widest leading-tight ${isActive ? "text-primary" : "text-muted-text/60"}`}>
                    {step.label}
                  </span>
                  {step.description && (
                    <span className="text-[9px] font-medium text-muted-text/40 mt-1 line-clamp-1">{step.description}</span>
                  )}
                </div>
              </div>
              
              {!isLast && (
                <div className="flex h-0.5 w-12 items-center md:w-20">
                  <div className={`h-full w-full rounded-full transition-all duration-700 ${
                    isCompleted ? "bg-success/40" : "bg-border/20"
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
