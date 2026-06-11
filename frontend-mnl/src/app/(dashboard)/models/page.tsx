"use client";

import React from "react";
import PageHeader from "@/components/ui/PageHeader";
import MetricCard from "@/components/ui/MetricCard";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import StatusBadge, { StatusType } from "@/components/ui/StatusBadge";

const SUMMARY_METRICS = [
  { label: "Active Models", value: "14", icon: "🧠" },
  { label: "Production Models", value: "7", status: "completed" as StatusType },
  { label: "Validation Warnings", value: "2", status: "warning" as StatusType },
  { label: "Inference Requests", value: "1.2M", helperText: "Last 24h", trend: { value: 12, isUp: true } },
  { label: "Average Latency", value: "86", unit: "ms", trend: { value: 4, isUp: false } },
  { label: "Dataset Coverage", value: "84%", trend: { value: 2, isUp: true } },
];

const MODELS = [
  {
    id: "m1",
    name: "TargetRank-GNN",
    type: "Target prioritization",
    version: "v4.2.1",
    status: "active" as StatusType,
    dataset: "BindingDB + ChEMBL",
    metric: "0.94 (ROC-AUC)",
    latency: "124ms",
    lastRun: "2h ago",
    endpoint: "rt-gnn-04",
    description: "Deep learning on PPI networks for prioritizing novel oncology targets.",
  },
  {
    id: "m2",
    name: "MolGen-Diffusion",
    type: "Molecule generation",
    version: "v1.8.0",
    status: "running" as StatusType,
    dataset: "ZINC20 + PubChem",
    metric: "0.88 (QED-Enrich)",
    latency: "840ms",
    lastRun: "Active",
    endpoint: "mg-diff-18",
    description: "Conditional diffusion model for de-novo lead generation with specific ADMET constraints.",
  },
  {
    id: "m3",
    name: "ADMET-ToxNet",
    type: "ADMET prediction",
    version: "v3.1.2",
    status: "completed" as StatusType,
    dataset: "Internal + Tox21",
    metric: "0.86 (Avg RMSE)",
    latency: "45ms",
    lastRun: "15m ago",
    endpoint: "adm-tox-31",
    description: "Multi-task neural network for identifying toxicity liabilities and metabolic stability.",
  },
  {
    id: "m4",
    name: "GNINA-CNN-Rescorer",
    type: "Pose scoring",
    version: "v2.0.4",
    status: "active" as StatusType,
    dataset: "PDBbind v2020",
    metric: "0.92 (Pose-Acc)",
    latency: "210ms",
    lastRun: "1h ago",
    endpoint: "gnina-cnn-20",
    description: "Convolutional neural network for rescoring docking poses and binding affinity prediction.",
  },
  {
    id: "m5",
    name: "QuantumRank-QML",
    type: "Quantum reranking",
    version: "v0.9.5",
    status: "active" as StatusType,
    dataset: "QM9 + Internal DFT",
    metric: "0.98 (Conf-Corr)",
    latency: "1.2s",
    lastRun: "3h ago",
    endpoint: "qr-qml-09",
    description: "Quantum machine learning model for high-fidelity electronic property reranking.",
  },
  {
    id: "m6",
    name: "ChemSpace-Embedder",
    type: "Molecular embeddings",
    version: "v2.2.0",
    status: "completed" as StatusType,
    dataset: "PubChem 110M",
    metric: "0.91 (NSS)",
    latency: "12ms",
    lastRun: "Synced",
    endpoint: "cs-emb-22",
    description: "Foundation transformer model for mapping chemical space into 1024-d latent vectors.",
  },
  {
    id: "m7",
    name: "PharmaLLM-RAG",
    type: "Literature assistant",
    version: "v1.4-Bio",
    status: "active" as StatusType,
    dataset: "PubMed + Internal",
    metric: "0.89 (Fact-Score)",
    latency: "450ms",
    lastRun: "6h ago",
    endpoint: "llm-rag-14",
    description: "Retrieval-augmented LLM for synthesizing scientific literature and project evidence.",
  },
];

const DATASETS = [
  { name: "ChEMBL", records: "3.4M", type: "Bioactivity" },
  { name: "BindingDB", records: "2.1M", type: "Protein-Ligand" },
  { name: "PubChem", records: "110M", type: "Chemical Space" },
  { name: "PDBbind", records: "25k", type: "Structural" },
  { name: "Internal Assay Data", records: "450k", type: "Proprietary" },
  { name: "ADMET Benchmark", records: "120k", type: "Validation" },
  { name: "Literature Corpus", records: "18M", type: "NLP/Evidence" },
];

const RECENT_RUNS = [
  { name: "EGFR Target Ranking", model: "TargetRank-GNN", status: "completed" as StatusType, time: "2h ago" },
  { name: "MolGen Generation Batch", model: "MolGen-Diffusion", status: "running" as StatusType, time: "Active" },
  { name: "ADMET Global Screening", model: "ADMET-ToxNet", status: "completed" as StatusType, time: "15m ago" },
  { name: "EGFR Quantum Reranking", model: "QuantumRank-QML", status: "completed" as StatusType, time: "3h ago" },
  { name: "Pharma LLM Summary", model: "PharmaLLM-RAG", status: "completed" as StatusType, time: "6h ago" },
];

export default function ModelsPage() {
  return (
    <div className="flex flex-col gap-8 pb-12">
      <PageHeader 
        title="Model Registry" 
        breadcrumb="AI / Model registry"
        description="Unified management of specialized AI/ML models powering molecular intelligence and lead optimization pipelines."
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {SUMMARY_METRICS.map((metric, i) => (
          <MetricCard key={i} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        <div className="flex flex-col gap-8">
          {/* Registry Table */}
          <Card 
            header={<h3 className="text-xs font-black uppercase tracking-[0.2em] text-text/80">Scientific Model Registry</h3>}
            contentClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/40 bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60">
                    <th className="px-6 py-4">Model Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Validation</th>
                    <th className="px-6 py-4">Latency</th>
                    <th className="px-6 py-4 text-right">Endpoint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {MODELS.map((model) => (
                    <tr key={model.id} className="group hover:bg-muted-bg/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-text/80 group-hover:text-accent transition-colors">{model.name}</span>
                          <span className="text-[9px] font-medium text-muted-text/40">{model.version}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-muted-text/70 uppercase tracking-wider">{model.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={model.status} size="sm" />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono font-bold text-accent">{model.metric}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-medium text-muted-text">{model.latency}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <code className="text-[10px] bg-muted-bg/50 px-2 py-1 rounded border border-border/20 text-muted-text">{model.endpoint}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Model Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {MODELS.map((model) => (
              <Card 
                key={model.id}
                className="group border-accent/10"
                header={
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-text group-hover:text-accent transition-colors">{model.name}</h4>
                    <StatusBadge status={model.status} size="sm" />
                  </div>
                }
              >
                <div className="space-y-4">
                  <p className="text-xs text-muted-text/80 leading-relaxed">{model.description}</p>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Primary Use</span>
                      <span className="text-[11px] font-bold text-text/70">{model.type}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40">Dataset Source</span>
                      <span className="text-[11px] font-bold text-text/70 truncate">{model.dataset}</span>
                    </div>
                  </div>
                  <div className="h-px bg-border/20" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-accent">{model.metric}</span>
                      <span className="text-[10px] font-medium text-muted-text/40">| {model.version}</span>
                    </div>
                    <button className="text-[10px] font-black uppercase tracking-widest text-muted-text hover:text-accent transition-colors">Technical Docs</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Side Panels */}
        <div className="flex flex-col gap-6">
          {/* Validation Metrics Panel */}
          <Card header={<h3 className="text-xs font-black uppercase tracking-widest">Global Validation</h3>}>
            <div className="space-y-4">
              {[
                { label: "Avg ROC-AUC", value: "0.912" },
                { label: "Avg RMSE", value: "0.145" },
                { label: "Enrichment Factor", value: "14.2x" },
                { label: "Pose Accuracy", value: "88%" },
                { label: "Calibration Score", value: "0.94" },
                { label: "AD Domain Coverage", value: "84%" },
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-text/70">{m.label}</span>
                  <span className="text-xs font-mono font-bold text-text">{m.value}</span>
                </div>
              ))}
              <div className="pt-2">
                <div className="h-1.5 w-full bg-muted-bg/30 rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: '84%' }} />
                </div>
                <p className="text-[10px] text-muted-text/40 mt-2 text-right uppercase font-black">AD-Domain Coverage</p>
              </div>
            </div>
          </Card>

          {/* Dataset Coverage Panel */}
          <Card header={<h3 className="text-xs font-black uppercase tracking-widest text-text/80">Dataset Coverage</h3>}>
            <div className="space-y-3">
              {DATASETS.map((ds, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text/80 group-hover:text-accent transition-colors">{ds.name}</span>
                    <span className="text-[9px] text-muted-text/40 uppercase font-bold">{ds.type}</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-muted-text">{ds.records}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Inference Status */}
          <Card header={<h3 className="text-xs font-black uppercase tracking-widest">Inference Status</h3>}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded bg-muted-bg/20 border border-border/40">
                  <p className="text-[9px] font-black uppercase text-muted-text/40 mb-1">Active Endpoints</p>
                  <p className="text-lg font-black text-text">24</p>
                </div>
                <div className="p-3 rounded bg-muted-bg/20 border border-border/40">
                  <p className="text-[9px] font-black uppercase text-muted-text/40 mb-1">Queued Jobs</p>
                  <p className="text-lg font-black text-text">142</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-text/70">Failed Jobs (24h)</span>
                  <span className="text-error font-bold">3</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-text/70">Avg Latency</span>
                  <span className="text-accent font-bold">86ms</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-text/70">Throughput</span>
                  <span className="text-text font-bold">450 req/s</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Recent Model Runs */}
          <Card header={<h3 className="text-xs font-black uppercase tracking-widest">Recent Model Runs</h3>}>
            <div className="space-y-4">
              {RECENT_RUNS.map((run, i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-text/80 truncate group-hover:text-accent transition-colors">{run.name}</span>
                    <span className="text-[10px] text-muted-text/40 truncate">{run.model}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <StatusBadge status={run.status} size="sm" />
                    <span className="text-[9px] text-muted-text/30 uppercase font-black mt-1">{run.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
