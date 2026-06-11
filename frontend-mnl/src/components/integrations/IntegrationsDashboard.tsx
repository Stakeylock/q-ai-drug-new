"use client";

import React, { useState } from "react";
import {
  MetricCard,
  SectionHeader,
  StatusBadge,
  PageHeader,
  ActionButton,
  ActionButtonGroup,
  Skeleton,
  TableSkeleton,
  EmptyState,
  ErrorState,
  OfflineState,
} from "@/components/ui";

const INTEGRATION_METRICS = [
  { label: "Connected Services", value: "6", status: "completed" as const },
  { label: "Healthy Services", value: "5", status: "completed" as const, helperText: "1 warning" },
  { label: "Sync Jobs", value: "12", helperText: "Last 24h", status: "active" as const },
  { label: "Failed Syncs", value: "1", status: "failed" as const, helperText: "S3 Export" },
  { label: "Imported Datasets", value: "24", helperText: "Managed assets", status: "completed" as const },
  { label: "API Health", value: "98", unit: "%", status: "active" as const },
];

const CONNECTED = [
  { name: "AlphaFold", category: "Structure Prediction", status: "connected", lastSync: "2h ago", workspace: "Global", icon: "\ud83e\uddec" },
  { name: "ChEMBL", category: "Chemical Databases", status: "connected", lastSync: "1d ago", workspace: "Oncology", icon: "\ud83e\uddeb" },
  { name: "PubChem", category: "Chemical Databases", status: "connected", lastSync: "5h ago", workspace: "Shared", icon: "\u269b\ufe0f" },
  { name: "HuggingFace", category: "Model Hosting", status: "connected", lastSync: "12m ago", workspace: "AI Lab", icon: "\ud83e\udd17" },
  { name: "AWS S3", category: "Object Storage", status: "warning", lastSync: "1h ago", workspace: "Artifacts", icon: "\u2601\ufe0f" },
  { name: "Milvus", category: "Vector Database", status: "connected", lastSync: "30m ago", workspace: "Embeddings", icon: "\ud83d\uddd2\ufe0f" },
];

const AVAILABLE = [
  { name: "BindingDB", category: "Chemical Databases", icon: "\ud83d\udcd3" },
  { name: "PDB", category: "Structure Prediction", icon: "\ud83d\udd2c" },
  { name: "Benchling", category: "Lab/ELN", icon: "\ud83d\udcbb" },
  { name: "Databricks", category: "Data Warehouse", icon: "\ud83e\uddf1" },
  { name: "PostgreSQL", category: "Database", icon: "\ud83d\udc18" },
  { name: "MinIO", category: "Object Storage", icon: "\ud83d\udce6" },
  { name: "NVIDIA BioNeMo", category: "Cloud Compute", icon: "\ud83d\udd25" },
  { name: "Google Cloud Storage", category: "Object Storage", icon: "\ud83d\udca0" },
];

const SYNC_ACTIVITY = [
  { event: "ChEMBL target data imported", detail: "EGFR-related ligands (420 entries)", time: "2h ago", status: "completed" },
  { event: "AlphaFold EGFR structure synced", detail: "af_egfr_v4.pdb updated", time: "5h ago", status: "completed" },
  { event: "PubChem similarity search", detail: "Batch 042 completion", time: "12h ago", status: "completed" },
  { event: "S3 artifact export failed", detail: "Connection timeout on US-EAST-1", time: "Yesterday", status: "failed" },
  { event: "Milvus embedding index updated", detail: "PIK3CA screening vectors", time: "2d ago", status: "completed" },
];

export default function IntegrationsDashboard() {
  const [simulatedState, setSimulatedState] = useState<"normal" | "loading" | "empty" | "error" | "offline">("normal");

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="External Integrations"
        breadcrumb="Infrastructure / Services"
        description="Connect and manage external scientific databases, cloud storage providers, and specialized compute engines."
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
                <option value="empty">⚪ Empty Connections</option>
                <option value="error">🔴 Sync Job Failure</option>
                <option value="offline">☁️ Health Offline</option>
              </select>
            </div>
            <ActionButton label="Connect Integration" variant="primary" />
            <ActionButton label="Import Dataset" />
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
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="ui-card-surface p-5 space-y-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                </div>
              ))}
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
            {INTEGRATION_METRICS.map((metric, i) => (
              <MetricCard key={i} {...metric} value="--" helperText="No connected services" />
            ))}
          </div>
          <EmptyState
            title="No External Integrations Connected"
            description="Bridge your discovery workspace with external molecular datasets, S3 storage vaults, or AlphaFold structures by setting up your first service integrations."
            action={
              <ActionButton label="Connect First Integration" variant="primary" onClick={() => setSimulatedState("normal")} />
            }
          />
        </div>
      )}

      {simulatedState === "error" && (
        <div className="space-y-8">
          <ErrorState
            title="AWS S3 Synchronization Failed"
            explanation="The platform was unable to synchronize synthesized docking dossiers to the organizational S3 object repository due to authorization signature mismatch."
            debugHint="S3SignatureError: SignatureDoesNotMatch (code: 403) on bucket: qdf-oncology-vault-us-east-1"
            action={
              <ActionButton label="Retry Sync Cycle" variant="primary" onClick={() => setSimulatedState("normal")} />
            }
          />
        </div>
      )}

      {simulatedState === "offline" && (
        <div className="space-y-8">
          <OfflineState
            title="Integration Health Telemetry Offline"
            description="The centralized health relay gateway is currently unresponsive, rendering external API gateway latencies unmeasurable."
            reason="Service heartbeat timeout | Health-Relay connection refused on port 9091"
            action={
              <ActionButton label="Re-evaluate Connections" variant="primary" onClick={() => setSimulatedState("normal")} />
            }
          />
        </div>
      )}

      {simulatedState === "normal" && (
        <>

      {/* 2. Integration Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {INTEGRATION_METRICS.map((metric, i) => (
          <MetricCard key={i} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* 3. Connected Integrations */}
          <section className="space-y-4">
            <SectionHeader title="Connected Integrations" description="Active services integrated into your research workspace." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CONNECTED.map(service => (
                <div key={service.name} className="ui-card-surface p-5 hover:border-accent/30 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{service.icon}</span>
                      <div>
                        <h4 className="text-sm font-black text-text group-hover:text-accent transition-colors">{service.name}</h4>
                        <span className="text-[10px] font-bold text-muted-text/50 uppercase tracking-widest">{service.category}</span>
                      </div>
                    </div>
                    <StatusBadge status={service.status as any} size="sm" />
                  </div>
                  <div className="space-y-3 border-t border-border/20 pt-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black uppercase text-muted-text/40 tracking-widest">Last Sync</span>
                           <span className="text-[11px] font-bold text-text/70">{service.lastSync}</span>
                        </div>
                        <div className="flex flex-col text-right">
                           <span className="text-[9px] font-black uppercase text-muted-text/40 tracking-widest">Workspace</span>
                           <span className="text-[11px] font-bold text-text/70">{service.workspace}</span>
                        </div>
                     </div>
                     <button className="w-full mt-2 py-2 text-[10px] font-black uppercase tracking-widest text-accent border border-accent/10 rounded bg-accent/5 hover:bg-accent/10 transition-all">Configure</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Available Integrations */}
          <section className="space-y-4">
            <SectionHeader title="Available Integrations" description="Expand your research capabilities with specialized external modules." />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {AVAILABLE.map(service => (
                <div key={service.name} className="ui-card-surface p-4 flex flex-col items-center text-center gap-3 hover:border-accent/30 transition-all cursor-pointer group">
                   <span className="text-3xl group-hover:scale-110 transition-transform">{service.icon}</span>
                   <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-text">{service.name}</span>
                      <span className="text-[9px] font-black uppercase text-muted-text/40 tracking-tighter leading-none">{service.category}</span>
                   </div>
                   <button className="text-[9px] font-black uppercase text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Connect</button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* 6. Integration Health */}
          <section className="space-y-4">
            <SectionHeader title="Integration Health" />
            <div className="ui-card-surface p-5 space-y-4">
               {[
                 { name: "API Gateway", status: "optimal", latency: "24ms", warnings: 0 },
                 { name: "S3 Connector", status: "warning", latency: "142ms", warnings: 1 },
                 { name: "HuggingFace Relay", status: "optimal", latency: "88ms", warnings: 0 },
                 { name: "Milvus Cluster", status: "optimal", latency: "12ms", warnings: 0 },
               ].map(service => (
                 <div key={service.name} className="space-y-2 pb-3 border-b border-border/20 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-text">{service.name}</span>
                       <span className={`h-1.5 w-1.5 rounded-full ${service.status === 'optimal' ? 'bg-success' : 'bg-warning'}`} />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-text/50">
                       <span>Latency: {service.latency}</span>
                       <span className={service.warnings > 0 ? 'text-warning' : ''}>{service.warnings} Warnings</span>
                    </div>
                 </div>
               ))}
               <div className="pt-2">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase text-muted-text/40">
                    <span>Credentials</span>
                    <span className="text-success">Verified</span>
                 </div>
               </div>
            </div>
          </section>

          {/* 5. Sync Activity */}
          <section className="space-y-4">
            <SectionHeader title="Sync Activity" />
            <div className="space-y-5 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/40">
              {SYNC_ACTIVITY.map((item, i) => (
                <div key={i} className="relative pl-8">
                  <div className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-card ${
                    item.status === 'completed' ? 'bg-success/20 border-success/40' : 'bg-error/20 border-error/40'
                  }`} />
                  <div className="flex flex-col">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-text/80">{item.event}</span>
                      <span className="text-[9px] font-black uppercase text-muted-text/40">{item.time}</span>
                    </div>
                    <span className="text-[10px] font-medium text-muted-text leading-tight">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-muted-text/40 hover:text-accent transition-colors">Clear Activity Log</button>
          </section>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
