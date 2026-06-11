"use client";

import React from "react";
import StatusBadge, { StatusType } from "@/components/ui/StatusBadge";

export function ValidationSummary({ 
  confidence = 86, 
  reproducibility = 91, 
  completeness = 94, 
  benchmark = 78 
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[
        { label: "Overall Confidence", val: confidence, color: "text-accent" },
        { label: "Reproducibility", val: reproducibility, color: "text-success" },
        { label: "Artifact Completeness", val: completeness, color: "text-text" },
        { label: "Benchmark Agreement", val: benchmark, color: "text-warning" },
      ].map((item, i) => (
        <div key={i} className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">{item.label}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-black ${item.color}`}>{item.val}%</span>
            <div className="flex-1 h-1 bg-muted-bg/30 rounded-full overflow-hidden min-w-[40px]">
              <div className={`h-full ${item.color.replace('text-', 'bg-')}`} style={{ width: `${item.val}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ArtifactCompleteness() {
  const items = [
    { label: "Input files captured", status: true },
    { label: "Parameters recorded", status: true },
    { label: "Logs available", status: true },
    { label: "Output artifacts generated", status: true },
    { label: "Checksums available", status: true },
    { label: "Model versions recorded", status: true },
    { label: "Report generated", status: false },
  ];

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-text/60 mb-3">Artifact Completeness</h4>
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between group">
          <span className="text-xs font-medium text-text/70">{item.label}</span>
          {item.status ? (
            <svg className="h-3.5 w-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-bg/40 group-hover:border-warning/40 transition-colors" />
          )}
        </div>
      ))}
    </div>
  );
}

export function BenchmarkComparison() {
  const benchmarks = [
    { label: "Known EGFR Inhibitors", agreement: 92 },
    { label: "Reference Ligand", agreement: 88 },
    { label: "Docking Baseline", agreement: 74 },
    { label: "ADMET Benchmark", agreement: 81 },
    { label: "GNINA Rescoring Baseline", agreement: 95 },
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Benchmark Comparison</h4>
      {benchmarks.map((b, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-text/70">{b.label}</span>
            <span className="font-bold text-text">{b.agreement}%</span>
          </div>
          <div className="h-1 w-full bg-muted-bg/30 rounded-full overflow-hidden">
            <div className="h-full bg-accent/60" style={{ width: `${b.agreement}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfidencePanel() {
  const dims = [
    { label: "Docking Confidence", score: 0.92 },
    { label: "GNINA Pose Confidence", score: 0.88 },
    { label: "ADMET Confidence", score: 0.94 },
    { label: "Quantum Reranking", score: 0.72 },
    { label: "Novelty Confidence", score: 0.98 },
    { label: "Applicability Domain", score: 0.84 },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      {dims.map((dim, i) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-xs font-bold text-text/70">{dim.label}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-bold ${dim.score > 0.9 ? 'text-success' : dim.score > 0.8 ? 'text-accent' : 'text-warning'}`}>
              {dim.score.toFixed(2)}
            </span>
            <div className="w-16 h-1 bg-muted-bg/30 rounded-full overflow-hidden">
              <div className={`h-full ${dim.score > 0.9 ? 'bg-success' : dim.score > 0.8 ? 'bg-accent' : 'bg-warning'}`} style={{ width: `${dim.score * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ValidationWarnings() {
  const warnings = [
    { id: 1, msg: "ADMET hERG risk elevated for QDF-EGFR-014", type: "error" },
    { id: 2, msg: "Quantum reranking pending for 6 candidates", type: "warning" },
    { id: 3, msg: "Applicability domain low for one scaffold cluster", type: "warning" },
    { id: 4, msg: "Missing wet-lab validation", type: "info" },
  ];

  return (
    <div className="space-y-2">
      {warnings.map((w) => (
        <div key={w.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
          w.type === 'error' ? 'bg-error/5 border-error/20' : 
          w.type === 'warning' ? 'bg-warning/5 border-warning/20' : 
          'bg-accent/5 border-accent/20'
        }`}>
          <div className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
            w.type === 'error' ? 'bg-error' : 
            w.type === 'warning' ? 'bg-warning' : 
            'bg-accent'
          }`} />
          <span className="text-[11px] font-medium text-muted-text leading-tight">{w.msg}</span>
        </div>
      ))}
    </div>
  );
}
