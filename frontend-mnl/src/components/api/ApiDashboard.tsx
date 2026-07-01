"use client";

import React, { useState } from "react";
import {
  MetricCard,
  SectionHeader,
  StatusBadge,
  PageHeader,
  ActionButton,
  ActionButtonGroup,
  EmptyState,
  TableSkeleton,
  Skeleton,
  ErrorState,
  PermissionState,
  OfflineState,
} from "@/components/ui";
import { showToast } from "@/utils/toast";
import type { StatusType } from "@/components/ui";

type ApiDashboardState = "normal" | "loading" | "empty" | "error" | "restricted" | "offline";

const API_METRICS = [
  { label: "API Requests", value: "24.2k", helperText: "Last 30 days", status: "active" as const },
  { label: "Active Keys", value: "4", helperText: "Production & Dev", status: "completed" as const },
  { label: "Error Rate", value: "0.12", unit: "%", trend: { value: 0.05, isUp: false }, status: "completed" as const },
  { label: "Average Latency", value: "142", unit: "ms", trend: { value: 12, isUp: false }, status: "completed" as const },
  { label: "Rate Limit Usage", value: "12", unit: "%", helperText: "Peak: 42%", status: "active" as const },
  { label: "Webhook Events", value: "842", helperText: "Delivered", status: "completed" as const },
];

const API_KEYS = [
  { 
    name: "Production Main", 
    env: "Production", 
    scope: "write:experiments, read:reports", 
    created: "Oct 12, 2025", 
    lastUsed: "2m ago", 
    status: "active", 
    key: "qdf_live_••••••••••••1234" 
  },
  { 
    name: "CI/CD Pipeline", 
    env: "Production", 
    scope: "run:pipelines", 
    created: "Jan 04, 2026", 
    lastUsed: "1h ago", 
    status: "active", 
    key: "qdf_live_••••••••••••5589" 
  },
  { 
    name: "Local Testing", 
    env: "Development", 
    scope: "read:projects", 
    created: "May 10, 2026", 
    lastUsed: "12h ago", 
    status: "active", 
    key: "qdf_test_••••••••••••0042" 
  },
] satisfies Array<{
  name: string;
  env: string;
  scope: string;
  created: string;
  lastUsed: string;
  status: StatusType;
  key: string;
}>;

const ENDPOINTS = [
  { group: "Projects", items: [
    { method: "GET", path: "/projects", desc: "List all research projects" },
    { method: "POST", path: "/projects", desc: "Create a new project" },
  ]},
  { group: "Experiments", items: [
    { method: "GET", path: "/experiments", desc: "List experiment history" },
    { method: "POST", path: "/experiments/run", desc: "Trigger pipeline execution" },
  ]},
  { group: "Molecules", items: [
    { method: "GET", path: "/molecules", desc: "Fetch molecular data" },
    { method: "POST", path: "/molecules/generate", desc: "Start generative AI batch" },
  ]},
  { group: "Docking", items: [
    { method: "POST", path: "/docking/run", desc: "Start docking engine" },
    { method: "GET", path: "/docking/results", desc: "Retrieve docking poses" },
  ]},
];

const SDK_EXAMPLES = {
  python: `import qudrugforge as qdf

client = qdf.Client(api_key="your_api_key")

# Run an experiment
experiment = client.experiments.run(
    project_id="egfr-nsclc",
    workflow="gnina-rescoring",
    inputs=["ligand_library_v2.sdf"]
)

print(f"Job started: {experiment.id}")`,
  javascript: `import { QDF } from "@quinfosys/qudrugforge";

const qdf = new QDF({ apiKey: "your_api_key" });

// Fetch candidates
const candidates = await qdf.molecules.list({
  projectId: "egfr-nsclc",
  minDockingScore: -10.5
});`,
  curl: `curl -X POST "https://api.qudrugforge.io/v1/experiments/run" \\
     -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{
       "projectId": "egfr-nsclc",
       "workflow": "docking"
     }'`
};

export default function ApiDashboard() {
  const [activeSdk, setActiveSdk] = useState<keyof typeof SDK_EXAMPLES>("python");
  const [simulatedState, setSimulatedState] = useState<ApiDashboardState>("normal");

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Developer API"
        breadcrumb="Infrastructure / API Platform"
        description="Build custom discovery workflows and integrate QuDrugForge intelligence into your enterprise pipeline."
        actions={
          <ActionButtonGroup>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">UI State:</span>
              <select 
                value={simulatedState}
                onChange={(e) => setSimulatedState(e.target.value as ApiDashboardState)}
                className="bg-muted-bg border border-border/40 text-text rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider outline-none focus:border-accent cursor-pointer"
              >
                <option value="normal">🟢 Operational</option>
                <option value="loading">🟡 Loading Skeletons</option>
                <option value="empty">⚪ Empty Keys State</option>
                <option value="error">🔴 Request Error</option>
                <option value="restricted">🔒 Access Restricted</option>
                <option value="offline">☁️ Endpoint Offline</option>
              </select>
            </div>
            <ActionButton label="Create API Key" variant="primary" />
            <ActionButton label="Rotate Key" />
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
                <Skeleton className="h-2 w-full" />
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
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {simulatedState === "empty" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {API_METRICS.map((metric, i) => (
              <MetricCard key={i} {...metric} value="--" helperText="No key active" />
            ))}
          </div>
          <EmptyState
            title="No Programmatic API Keys Active"
            description="Start programmatically querying your research datasets, downloading report files, and triggering computational docking pipelines by generating your first key."
            action={
              <ActionButton label="Generate First Key" variant="primary" onClick={() => setSimulatedState("normal")} />
            }
          />
        </div>
      )}

      {simulatedState === "error" && (
        <div className="space-y-8">
          <ErrorState
            title="API Metrics Collection Failure"
            explanation="The platform core gateways failed to parse transaction summaries and webhook delivery logs due to a connection timeout."
            debugHint="NetworkStatus: 504 GATEWAY_TIMEOUT | Action: fetchApiTelemetry | Server: gateway-us-east-1.qudrugforge.internal"
            action={
              <ActionButton label="Retry Gateway Request" variant="primary" onClick={() => setSimulatedState("normal")} />
            }
          />
        </div>
      )}

      {simulatedState === "restricted" && (
        <div className="space-y-8">
          <PermissionState
            title="API Key Management Restricted"
            description="Your user access group does not possess administrative capabilities to create, rotate, or deprecate programmatic tokens in this program workspace."
            requiredRole="Infrastructure Administrator or Workspace Architect"
            action={
              <ActionButton
                label="Contact Admin Team"
                variant="primary"
                onClick={() =>
                  showToast({
                    type: "info",
                    title: "Request logged",
                    message: "An administrator will review your API access request.",
                  })
                }
              />
            }
          />
        </div>
      )}

      {simulatedState === "offline" && (
        <div className="space-y-8">
          <OfflineState
            title="Model Inference Queue Offline"
            description="The generative compound synthesis batch inference model queue is currently offline due to dynamic node scaling on the HPC cluster."
            reason="HPC Partition scaling / Dynamic GPU node reallocation under maintenance"
            action={
              <ActionButton label="Check GPU Telemetry" variant="primary" onClick={() => setSimulatedState("normal")} />
            }
          />
        </div>
      )}

      {simulatedState === "normal" && (
        <>
          {/* 2. API Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {API_METRICS.map((metric, i) => (
              <MetricCard key={i} {...metric} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* 3. API Keys Table */}
              <section className="space-y-4">
                <SectionHeader title="API Keys" description="Secure authentication tokens for programmatic access." />
                <div className="ui-card-surface overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                        <th className="px-6 py-4">Key Name</th>
                        <th className="px-6 py-4">Token</th>
                        <th className="px-6 py-4">Scope</th>
                        <th className="px-6 py-4">Environment</th>
                        <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {API_KEYS.map(key => (
                        <tr key={key.name} className="group hover:bg-muted-bg/20 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-text group-hover:text-accent transition-colors">{key.name}</span>
                            <p className="text-[10px] text-muted-text">Created: {key.created}</p>
                          </td>
                          <td className="px-6 py-4">
                            <code className="bg-muted-bg/50 px-2 py-1 rounded text-[11px] font-mono text-muted-text/80">{key.key}</code>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex flex-wrap gap-1">
                                {key.scope.split(", ").map(s => (
                                  <span key={s} className="px-1.5 py-0.5 rounded bg-accent/5 text-[9px] font-bold text-accent border border-accent/10">{s}</span>
                                ))}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-muted-text">
                            {key.env}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <StatusBadge status={key.status} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 6. Playground */}
              <section className="space-y-4">
                <SectionHeader title="API Playground" description="Interactive environment to test endpoints against mock responses." />
                <div className="ui-card-surface p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Endpoint</label>
                       <select className="w-full h-10 bg-muted-bg/20 border border-border/40 rounded-lg px-3 text-xs font-bold outline-none focus:border-accent">
                          <option>/experiments/run</option>
                          <option>/projects</option>
                          <option>/molecules/generate</option>
                          <option>/docking/run</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Method</label>
                       <div className="h-10 flex items-center px-4 bg-muted-bg/40 rounded-lg text-xs font-black text-accent border border-accent/20">POST</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Request Body</label>
                        <div className="h-64 bg-black/90 rounded-xl p-4 font-mono text-[11px] text-emerald-500 overflow-auto border border-border/20 shadow-inner">
                          <pre>{`{
  "projectId": "egfr-nsclc",
  "workflow": "gnina",
  "inputs": {
    "library": "lib-42",
    "receptor": "p00533"
  }
}`}</pre>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Response Preview</label>
                        <div className="h-64 bg-black/85 rounded-xl p-4 font-mono text-[11px] text-accent/80 overflow-auto border border-border/20 shadow-inner">
                          <pre>{`{
  "status": "success",
  "jobId": "J-8821",
  "estimatedTime": "42m",
  "resourceAllocation": "8x H100"
}`}</pre>
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button className="px-8 py-2.5 bg-accent text-bg text-[10px] font-black uppercase tracking-[0.2em] rounded-lg shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all">Execute Request</button>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-8">
              {/* 4. Endpoint Explorer */}
              <section className="space-y-4">
                <SectionHeader title="Endpoint Explorer" />
                <div className="flex flex-col gap-3">
                  {ENDPOINTS.map(group => (
                    <div key={group.group} className="space-y-2">
                       <h5 className="text-[10px] font-black text-muted-text/40 uppercase tracking-widest pl-2">{group.group}</h5>
                       <div className="space-y-1.5">
                          {group.items.map(item => (
                            <div key={item.path} className="ui-card-surface p-3 flex flex-col gap-1 border-accent/5 hover:border-accent/20 transition-all cursor-pointer">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                  item.method === 'GET' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-accent/10 text-accent'
                                }`}>{item.method}</span>
                                <span className="text-[11px] font-mono font-bold text-text">{item.path}</span>
                              </div>
                              <span className="text-[10px] text-muted-text/60 font-medium pl-1">{item.desc}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 7. SDK Examples */}
              <section className="space-y-4">
                <SectionHeader title="SDK Examples" />
                <div className="ui-card-surface overflow-hidden">
                   <div className="flex border-b border-border/40">
                      {(['python', 'javascript', 'curl'] as const).map(lang => (
                        <button 
                          key={lang}
                          onClick={() => setActiveSdk(lang)}
                          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${
                            activeSdk === lang ? 'bg-accent/10 text-accent border-b-2 border-accent' : 'text-muted-text/40 hover:bg-muted-bg/50'
                          }`}
                        >
                          {lang === 'javascript' ? 'JS' : lang.toUpperCase()}
                        </button>
                      ))}
                   </div>
                   <div className="p-4 bg-black/90 font-mono text-[10px] text-indigo-300 overflow-auto h-64">
                      <pre className="whitespace-pre-wrap">{SDK_EXAMPLES[activeSdk]}</pre>
                   </div>
                </div>
              </section>

              {/* 8. Webhooks */}
              <section className="space-y-4">
                <SectionHeader title="Active Webhooks" />
                <div className="ui-card-surface p-5 space-y-4">
                   {[
                     { event: "experiment.completed", count: 428, color: "bg-success" },
                     { event: "report.generated", count: 124, color: "bg-accent" },
                     { event: "validation.warning", count: 18, color: "bg-warning" },
                     { event: "pipeline.failed", count: 5, color: "bg-error" },
                   ].map(hook => (
                     <div key={hook.event} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className={`h-2 w-2 rounded-full ${hook.color}`} />
                           <span className="text-[11px] font-mono text-text/80">{hook.event}</span>
                        </div>
                        <span className="text-[10px] font-bold text-muted-text/60">{hook.count}</span>
                     </div>
                   ))}
                   <button className="w-full mt-2 py-2.5 text-[10px] font-black uppercase tracking-widest text-accent border border-accent/20 rounded-lg hover:bg-accent/5 transition-all">Add Endpoint</button>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
