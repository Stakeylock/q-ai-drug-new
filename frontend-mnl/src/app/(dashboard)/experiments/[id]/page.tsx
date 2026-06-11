"use client";

import React from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import StatusBadge, { StatusType } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import MetricCard from "@/components/ui/MetricCard";

import { 
  ValidationSummary, 
  ArtifactCompleteness, 
  BenchmarkComparison, 
  ConfidencePanel,
  ValidationWarnings 
} from "@/components/dashboard/validation";

const ARTIFACTS = [
  { name: "egfr_rescored_poses.sdf", type: "Ligand Library", size: "24.2 MB", status: "verified" },
  { name: "egfr_receptor_refined.pdb", type: "Receptor", size: "4.1 MB", status: "verified" },
  { name: "affinity_scores_v2.csv", type: "Score Table", size: "1.2 MB", status: "verified" },
  { name: "gnina_run_042.log", type: "Run Log", size: "850 KB", status: "verified" },
  { name: "validation_manifest.json", type: "Manifest", size: "12 KB", status: "verified" },
];

const LOGS = [
  { time: "2026-05-16 10:42:01", msg: "[SYS] Initializing GNINA engine v1.2.4 on H100 cluster..." },
  { time: "2026-05-16 10:42:05", msg: "[SYS] Allocating 32GB GPU memory, 128GB System RAM." },
  { time: "2026-05-16 10:42:10", msg: "[LOAD] Loading receptor: EGFR_AF2_Refined.pdb (Hash: d8a1...)" },
  { time: "2026-05-16 10:42:15", msg: "[LOAD] Loading ligand library: Candidate_Pool_Batch_A.sdf (300 molecules)" },
  { time: "2026-05-16 10:43:22", msg: "[PROC] Batch 1/10: Rescoring 30 molecules..." },
  { time: "2026-05-16 11:05:45", msg: "[WARN] Molecule QDF-EGFR-084: CNN affinity confidence < 0.65. Check interaction map." },
  { time: "2026-05-16 11:45:12", msg: "[PROC] Batch 10/10: Rescoring 30 molecules..." },
  { time: "2026-05-16 11:54:33", msg: "[SYS] Pipeline completed. Synchronizing artifacts to storage cluster." },
  { time: "2026-05-16 11:55:00", msg: "[SYS] Job J-042 exit state: SUCCESS with 1 warning." },
];

export default function ExperimentDetailPage() {
  const params = useParams();
  const experimentId = params.id as string;

  return (
    <div className="flex flex-col gap-8 pb-12">
      <PageHeader 
        title="GNINA EGFR Rescoring Batch 042"
        breadcrumb={`Research / Experiments / ${experimentId}`}
        description="Detailed execution audit, artifact manifest, and scientific validation for GNINA rescoring pipeline."
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9 text-[10px] font-black uppercase tracking-widest">Rerun</Button>
            <Button variant="outline" size="sm" className="h-9 text-[10px] font-black uppercase tracking-widest">Export Logs</Button>
            <Button variant="outline" size="sm" className="h-9 text-[10px] font-black uppercase tracking-widest">Generate Report</Button>
            <Button size="sm" className="h-9 text-[10px] font-black uppercase tracking-widest px-6">Ask Pharma LLM</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        <div className="flex flex-col gap-8">
          {/* Execution Status Section */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <MetricCard label="Progress" value="100%" status="completed" icon="📈" />
             <MetricCard label="Runtime" value="1h 12m 32s" icon="⏱️" />
             <MetricCard label="Compute" value="H100 x 8" status="running" helperText="Cluster: GPU-NODE-04" />
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Inputs Card */}
            <Card header={<h3 className="text-xs font-black uppercase tracking-widest text-text/80">Inputs & Parameters</h3>}>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-muted-bg/20 border border-border/40">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Receptor</span>
                  <span className="text-xs font-bold text-text">EGFR_AF2_Refined.pdb</span>
                </div>
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-muted-bg/20 border border-border/40">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Ligand Library</span>
                  <span className="text-xs font-bold text-text">OncoPool_Batch_A.sdf (300 candidates)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Binding Pocket</span>
                    <span className="text-[11px] font-bold text-text/70">Met793 (ATP-site)</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Model Version</span>
                    <span className="text-[11px] font-bold text-accent">GNINA-v1.2.4-Onc</span>
                  </div>
                </div>
                <div className="h-px bg-border/20" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-text/60">Input Hash (SHA256)</span>
                  <span className="text-[10px] font-mono text-muted-text">d8a1...f3b2</span>
                </div>
              </div>
            </Card>

            {/* Outputs Card */}
            <Card header={<h3 className="text-xs font-black uppercase tracking-widest text-text/80">Outputs & Findings</h3>}>
              <div className="space-y-4">
                 {[
                  { label: "Rescored Poses", val: "3,000 total" },
                  { label: "High Confidence Candidates", val: "24 leads" },
                  { label: "Top CNN Score", val: "0.982" },
                  { label: "Mean Affinity", val: "-10.4 kcal/mol" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/10 pb-2 last:border-0 last:pb-0">
                    <span className="text-xs font-medium text-muted-text/70">{item.label}</span>
                    <span className="text-xs font-bold text-text">{item.val}</span>
                  </div>
                ))}
                <div className="mt-4 p-3 rounded-xl border border-warning/20 bg-warning/5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-warning" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-warning">Alert: Confidence Warning</span>
                  </div>
                  <p className="text-[10px] text-muted-text/80 leading-relaxed italic">
                    Molecule QDF-EGFR-084 exhibits low pose confidence (0.62). Manual inspection recommended.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Logs Terminal */}
          <Card 
            header={<h3 className="text-xs font-black uppercase tracking-widest text-text/80">Execution Logs</h3>}
            contentClassName="bg-black/95 p-6 rounded-2xl min-h-[300px]"
          >
            <div className="font-mono text-[11px] space-y-2 text-success/80">
              {LOGS.map((log, i) => (
                <div key={i} className="flex gap-4 group">
                  <span className="text-muted-text/30 shrink-0 select-none group-hover:text-muted-text/60 transition-colors">{log.time}</span>
                  <span className={log.msg.includes("[WARN]") ? "text-warning" : log.msg.includes("[SYS]") ? "text-accent" : ""}>
                    {log.msg}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-4">
                 <div className="h-1 w-2 bg-success animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-success/40">EOF - Execution Finalized</span>
              </div>
            </div>
          </Card>

          {/* Validation & Confidence Section */}
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-text/60">Scientific Validation & Confidence</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <Card header={<h3 className="text-xs font-black uppercase tracking-widest text-text/80">Validation Summary</h3>}>
                  <ValidationSummary confidence={94} reproducibility={98} completeness={100} benchmark={82} />
                  <div className="mt-8 pt-6 border-t border-border/20">
                    <ValidationWarnings />
                  </div>
               </Card>
               <Card header={<h3 className="text-xs font-black uppercase tracking-widest text-text/80">Benchmark Comparison</h3>}>
                  <BenchmarkComparison />
               </Card>
            </div>
            <Card header={<h3 className="text-xs font-black uppercase tracking-widest text-text/80">Confidence Dimensions</h3>}>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12 p-2">
                  <ConfidencePanel />
                  <div className="flex flex-col justify-center gap-4 bg-muted-bg/10 rounded-2xl p-6 border border-border/40">
                     <p className="text-[11px] font-medium text-muted-text/80 leading-relaxed italic text-center">
                        "High confidence scores across docking and novelty dimensions suggest a robust lead series with significant potential for patentability. ADMET confidence is peak due to high similarity with recent clinical trial successes."
                     </p>
                     <div className="h-px bg-border/20" />
                     <div className="flex items-center justify-between px-4">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Auto-generated Insight</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-accent">Pharma LLM v2.4</span>
                     </div>
                  </div>
               </div>
            </Card>
          </div>
        </div>

        {/* Side Panels */}
        <div className="flex flex-col gap-6">
          {/* Metadata Card */}
          <Card className="bg-accent/[0.02] border-accent/10">
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Experiment Status</span>
                <StatusBadge status="warning" label="Completed with Warnings" />
              </div>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: "ID", val: experimentId },
                  { label: "Workflow", val: "GNINA Rescoring" },
                  { label: "Project", val: "EGFR Discovery" },
                  { label: "Owner", val: "Sarah Chen" },
                  { label: "Cluster", val: "GPU-NODE-04" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">{item.label}</span>
                    <span className="text-[11px] font-bold text-text/80">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Artifacts Card */}
          <Card header={<h3 className="text-xs font-black uppercase tracking-widest text-text/80">Artifact Manifest</h3>}>
            <div className="space-y-3">
              {ARTIFACTS.map((file, i) => (
                <div key={i} className="group p-3 rounded-xl border border-border/40 bg-muted-bg/10 hover:border-accent/40 hover:bg-accent/5 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-text truncate pr-4">{file.name}</span>
                    <svg className="h-3 w-3 text-muted-text/40 group-hover:text-accent cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-muted-text/40">
                    <span>{file.type}</span>
                    <span>{file.size}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Reproducibility Card */}
          <Card header={<h3 className="text-xs font-black uppercase tracking-widest text-text/80">Reproducibility</h3>}>
            <div className="space-y-3">
               {[
                { label: "Environment", val: "qdf-runtime:v1.2" },
                { label: "Container", val: "H100-CUDA-12.1" },
                { label: "Random Seed", val: "0x4A2F8E1" },
                { label: "Model Hash", val: "sha256:88a1..." },
                { label: "Manifest ID", val: "V-042-QDF" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">{item.label}</span>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-text/70">{item.val}</span>
                    <svg className="h-3 w-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Validation Score */}
          <Card className="bg-success/[0.02] border-success/20">
             <div className="flex flex-col items-center text-center p-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-success/60 mb-2">Confidence Score</span>
                <span className="text-4xl font-black text-success">0.94</span>
                <span className="text-[10px] font-bold text-success/40 mt-1 uppercase tracking-widest">High Integrity Pass</span>
                <div className="mt-4 w-full h-1.5 bg-success/10 rounded-full overflow-hidden">
                  <div className="h-full bg-success" style={{ width: '94%' }} />
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
