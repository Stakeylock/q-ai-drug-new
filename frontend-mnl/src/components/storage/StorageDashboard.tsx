"use client";

import React, { useState } from "react";
import {
  MetricCard,
  SectionHeader,
  StatusBadge,
  PageHeader,
  ActionButton,
  ActionButtonGroup,
  Card,
  Skeleton,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/ui";

const STORAGE_METRICS = [
  { label: "Total Storage Used", value: "2.8", unit: "TB", helperText: "82% of 3.4 TB quota", status: "active" as const },
  { label: "Datasets", value: "42", helperText: "Primary research data", status: "completed" as const },
  { label: "Experiment Artifacts", value: "1,284", helperText: "Generated results", status: "completed" as const },
  { label: "Reports", value: "96", helperText: "Candidate dossiers", status: "completed" as const },
  { label: "Structure Files", value: "214", helperText: "PDB / AlphaFold", status: "completed" as const },
  { label: "Ligand Libraries", value: "18", helperText: "SDF / SMILES", status: "completed" as const },
];

const DATASETS = [
  { 
    name: "EGFR ligand library", 
    type: "Ligands", 
    project: "EGFR NSCLC", 
    format: "SDF", 
    size: "420 MB", 
    validation: "passed", 
    uploaded: "2d ago", 
    owner: "Dr. Sarah Chen" 
  },
  { 
    name: "AlphaFold EGFR structure", 
    type: "Protein", 
    project: "EGFR NSCLC", 
    format: "PDB", 
    size: "12 MB", 
    validation: "passed", 
    uploaded: "5d ago", 
    owner: "System" 
  },
  { 
    name: "ADMET screening dataset", 
    type: "Bio-activity", 
    project: "PIK3CA screening", 
    format: "CSV", 
    size: "2.1 GB", 
    validation: "warning", 
    uploaded: "1w ago", 
    owner: "David Kim" 
  },
  { 
    name: "NSCLC assay table", 
    type: "Experimental", 
    project: "EGFR NSCLC", 
    format: "XLSX", 
    size: "1.2 MB", 
    validation: "passed", 
    uploaded: "2w ago", 
    owner: "Dr. Sarah Chen" 
  },
  { 
    name: "GNINA pose artifacts", 
    type: "Docking", 
    project: "EGFR NSCLC", 
    format: "BIN", 
    size: "18.4 GB", 
    validation: "passed", 
    uploaded: "Just now", 
    owner: "AutoPilot" 
  },
];

const ARTIFACTS = [
  { name: "QU-7721-pose.sdf", type: "Pose File", size: "45 KB", icon: "📄" },
  { name: "Receptor_Main.pdb", type: "Structure", size: "2.1 MB", icon: "🧬" },
  { name: "Screening_Results.csv", type: "Score Table", size: "124 KB", icon: "📊" },
  { name: "Candidate_Dossier_Final.pdf", type: "Report", size: "4.2 MB", icon: "📕" },
  { name: "MD_Trajectory_100ns.xtc", type: "Trajectory", size: "12.8 GB", icon: "🎬" },
  { name: "Validation_Manifest.json", type: "Manifest", size: "8 KB", icon: "📜" },
];

const RECENT_UPLOADS = [
  { event: "FASTA uploaded", detail: "EGFR_Mutant_L858R.fasta", time: "10m ago" },
  { event: "PDB attached", detail: "af_egfr_v4.pdb", time: "1h ago" },
  { event: "SDF library imported", detail: "ChemBridge_Core_10k.sdf", time: "4h ago" },
  { event: "ADMET CSV validated", detail: "toxicity_screening_b1.csv", time: "Yesterday" },
  { event: "Report exported", detail: "EGFR_Dossier_2026.pdf", time: "2d ago" },
];

export default function StorageDashboard() {
  const [simulatedState, setSimulatedState] = useState<"normal" | "loading" | "empty" | "error">("normal");

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Storage & Asset Management"
        breadcrumb="Infrastructure / Data Storage"
        description="Centralized repository for scientific assets, molecular libraries, and experiment artifacts. Manage data integrity and resource quotas."
        actions={
          <ActionButtonGroup>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">UI State:</span>
              <select 
                value={simulatedState}
                onChange={(e) => setSimulatedState(e.target.value as any)}
                className="bg-muted-bg border border-border/40 text-text rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider outline-none focus:border-accent cursor-pointer"
              >
                <option value="normal">🟢 Operational</option>
                <option value="loading">🟡 Loading Skeletons</option>
                <option value="empty">⚪ Empty Datasets</option>
                <option value="error">🔴 Import Failure</option>
              </select>
            </div>
            <ActionButton label="Upload Dataset" variant="primary" />
            <ActionButton label="Import From Integration" />
          </ActionButtonGroup>
        }
      />

      {/* State Rendering */}
      {simulatedState === "loading" && (
        <div className="space-y-8 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ui-card-surface p-4 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <TableSkeleton rows={4} />
            </div>
            <div className="space-y-4">
              <div className="ui-card-surface p-5 space-y-4">
                <Skeleton className="h-4 w-24" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {simulatedState === "empty" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {STORAGE_METRICS.map((metric, i) => (
              <MetricCard key={i} {...metric} value="--" helperText="No datasets uploaded" />
            ))}
          </div>
          <EmptyState
            title="No Scientific Datasets Uploaded"
            description="Bridge your discovery workspace with external molecular libraries, SDF structures, or ADMET assay lists by uploading your first target file."
            action={
              <ActionButton label="Upload First Dataset" variant="primary" onClick={() => setSimulatedState("normal")} />
            }
          />
        </div>
      )}

      {simulatedState === "error" && (
        <div className="space-y-8">
          <ErrorState
            title="Molecular Coordinate Ingestion Failed"
            explanation="The parsed structure library contains non-standard atom mappings or incomplete coordinate blocks that violate physical forcefield constraints."
            debugHint="ParserError: Incomplete coordinates found in PDB block ATOM 882 for residues LEU858 | Parser: pdb-ligand-reader-v2.bin"
            action={
              <ActionButton label="Re-upload Corrected Dataset" variant="primary" onClick={() => setSimulatedState("normal")} />
            }
          />
        </div>
      )}

      {simulatedState === "normal" && (
        <>

      {/* 2. Storage Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {STORAGE_METRICS.map((metric, i) => (
          <MetricCard key={i} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* 3. Storage Usage Breakdown */}
          <section className="space-y-4">
            <SectionHeader title="Storage Usage Breakdown" description="Distribution of storage consumption across scientific data categories." />
            <div className="ui-card-surface p-6">
              <div className="flex h-10 w-full overflow-hidden rounded-xl bg-border/20 mb-6">
                <div className="h-full bg-accent" style={{ width: '35%' }} title="Ligand Libraries" />
                <div className="h-full bg-indigo-500" style={{ width: '25%' }} title="Docking Poses" />
                <div className="h-full bg-emerald-500" style={{ width: '15%' }} title="Protein Structures" />
                <div className="h-full bg-amber-500" style={{ width: '15%' }} title="Trajectories" />
                <div className="h-full bg-muted-text/30" style={{ width: '10%' }} title="Other" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8">
                {[
                  { label: "Ligand Libraries", size: "980 GB", color: "bg-accent" },
                  { label: "Docking Poses", size: "700 GB", color: "bg-indigo-500" },
                  { label: "Protein Structures", size: "420 GB", color: "bg-emerald-500" },
                  { label: "Simulation Trajectories", size: "420 GB", color: "bg-amber-500" },
                  { label: "ADMET Datasets", size: "120 GB", color: "bg-rose-500" },
                  { label: "Reports", size: "85 GB", color: "bg-purple-500" },
                  { label: "Logs/Manifests", size: "42 GB", color: "bg-slate-500" },
                  { label: "Free Space", size: "633 GB", color: "bg-border/40" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${item.color}`} />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/50">{item.label}</span>
                      <span className="text-xs font-bold text-text">{item.size}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4. Dataset Library */}
          <section className="space-y-4">
            <SectionHeader title="Dataset Library" description="Primary research datasets and imported ligand libraries." />
            <div className="ui-card-surface overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                    <th className="px-6 py-4">Dataset Name</th>
                    <th className="px-6 py-4">Type / Project</th>
                    <th className="px-6 py-4">Format</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Validation</th>
                    <th className="px-6 py-4">Owner</th>
                    <th className="px-6 py-4 text-right">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {DATASETS.map(ds => (
                    <tr key={ds.name} className="group hover:bg-muted-bg/20 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-text group-hover:text-accent transition-colors">{ds.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-muted-text/70">{ds.type}</span>
                          <span className="text-[10px] text-muted-text/40">{ds.project}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-[10px] font-bold text-muted-text/70 uppercase tracking-wider">{ds.format}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-mono text-text">{ds.size}</span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={ds.validation === 'passed' ? 'completed' : 'warning'} size="sm" />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-bold text-text/70">{ds.owner}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[10px] font-bold text-muted-text/50 uppercase">{ds.uploaded}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* 5. Artifact Library */}
          <section className="space-y-4">
            <SectionHeader title="Artifact Library" />
            <div className="grid gap-3">
              {ARTIFACTS.map(art => (
                <div key={art.name} className="ui-card-surface p-4 flex items-center justify-between hover:border-accent/30 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{art.icon}</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-text group-hover:text-accent transition-colors truncate max-w-[140px]">{art.name}</span>
                      <span className="text-[9px] font-black uppercase text-muted-text/40 tracking-widest">{art.type}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-mono text-muted-text">{art.size}</span>
                    <button className="text-[8px] font-black uppercase text-accent opacity-0 group-hover:opacity-100 transition-opacity">Download</button>
                  </div>
                </div>
              ))}
              <button className="w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/40 hover:text-accent border border-dashed border-border/60 rounded-xl transition-all">View All Artifacts</button>
            </div>
          </section>

          {/* 7. Data Quality / Validation */}
          <section className="space-y-4">
            <SectionHeader title="Data Quality" />
            <div className="ui-card-surface p-5 space-y-4">
              {[
                { label: "Validated Files", count: 1240, total: 1284, color: "bg-success" },
                { label: "Checksum available", count: 1284, total: 1284, color: "bg-accent" },
                { label: "Warning Files", count: 44, total: 1284, color: "bg-warning" },
                { label: "Missing Metadata", count: 12, total: 1284, color: "bg-rose-500" },
              ].map(item => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-muted-text/60">{item.label}</span>
                    <span className="text-text">{item.count} / {item.total}</span>
                  </div>
                  <div className="h-1 w-full bg-border/20 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${(item.count / item.total) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="pt-4 mt-4 border-t border-border/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/40">Reproducibility</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-success">Manifest Verified</span>
                    <svg className="h-3 w-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 6. Recent Uploads */}
          <section className="space-y-4">
            <SectionHeader title="Recent Activity" />
            <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/40">
              {RECENT_UPLOADS.map((item, i) => (
                <div key={i} className="relative pl-8">
                  <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-card bg-accent/20" />
                  <div className="flex flex-col">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-text/80">{item.event}</span>
                      <span className="text-[9px] font-black uppercase text-muted-text/40">{item.time}</span>
                    </div>
                    <span className="text-[10px] font-medium text-muted-text truncate">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
