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
  OfflineState,
} from "@/components/ui";
import { ChartsSection } from "@/components/dashboard";

const COMPUTE_METRICS = [
  { label: "GPU Hours Used", value: "428.6", unit: "h", status: "active" as const },
  { label: "Active Jobs", value: "6", status: "running" as const },
  { label: "Queued Jobs", value: "14", status: "pending" as const },
  { label: "Credits Remaining", value: "12,450", helperText: "Est. 12 days left", status: "completed" as const },
  { label: "Quantum Jobs", value: "3", helperText: "Rigetti QPU", status: "running" as const },
  { label: "Simulation Runtime", value: "92", unit: "h", status: "active" as const },
];

const QUEUES = [
  { name: "Docking Queue", running: 2, queued: 5, wait: "12m", priority: "High" },
  { name: "GNINA Queue", running: 1, queued: 8, wait: "42m", priority: "Medium" },
  { name: "Quantum Reranking Queue", running: 1, queued: 0, wait: "< 1m", priority: "High" },
  { name: "Simulation Queue", running: 2, queued: 1, wait: "4h", priority: "Normal" },
  { name: "Report Generation Queue", running: 0, queued: 0, wait: "0m", priority: "Low" },
];

const RUNNING_JOBS = [
  { 
    id: "J-8821", 
    workflow: "Virtual Screening", 
    project: "EGFR NSCLC", 
    status: "running", 
    computeType: "8x H100 GPU", 
    runtime: "4h 12m", 
    cost: "$124.50", 
    owner: "Dr. Sarah Chen", 
    queue: "Docking" 
  },
  { 
    id: "J-8824", 
    workflow: "GNINA Rescoring", 
    project: "EGFR NSCLC", 
    status: "running", 
    computeType: "4x A100 GPU", 
    runtime: "1h 05m", 
    cost: "$42.10", 
    owner: "AutoPilot", 
    queue: "GNINA" 
  },
  { 
    id: "J-8825", 
    workflow: "Quantum Reranking", 
    project: "PARP1 Oncology", 
    status: "running", 
    computeType: "Rigetti Aspen-M-3", 
    runtime: "0h 18m", 
    cost: "$1,200.00", 
    owner: "David Kim", 
    queue: "Quantum" 
  },
  { 
    id: "J-8827", 
    workflow: "MD Simulation", 
    project: "EGFR NSCLC", 
    status: "running", 
    computeType: "HPC Cluster", 
    runtime: "12h 45m", 
    cost: "$85.00", 
    owner: "Dr. Sarah Chen", 
    queue: "Simulation" 
  },
];

const ALERTS = [
  { message: "GNINA queue wait time elevated", severity: "warning", timestamp: "10m ago" },
  { message: "Simulation runtime above estimate", severity: "info", timestamp: "25m ago" },
  { message: "Quantum credits nearing threshold", severity: "error", timestamp: "1h ago" },
];

export default function ComputeDashboard() {
  const [simulatedState, setSimulatedState] = useState<"normal" | "loading" | "offline">("normal");

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Compute & Workload"
        breadcrumb="Infrastructure / Scientific Compute"
        description="Monitor GPU utilization, quantum job execution, and simulation workloads across hybrid HPC resources."
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
                <option value="offline">☁️ Queue Offline</option>
              </select>
            </div>
            <ActionButton label="Request Credits" variant="primary" />
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

      {simulatedState === "offline" && (
        <div className="space-y-8">
          <OfflineState
            title="Compute Scheduler Queue Offline"
            description="The centralized scientific workload scheduling queue is currently unreachable, rendering cluster job telemetry unavailable."
            reason="HPC Slurm scheduler daemon unresponsive | Heartbeat timeout"
            action={
              <ActionButton label="Re-initialize Queue Relay" variant="primary" onClick={() => setSimulatedState("normal")} />
            }
          />
        </div>
      )}

      {simulatedState === "normal" && (
        <>

      {/* 2. Compute Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {COMPUTE_METRICS.map((metric, i) => (
          <MetricCard key={i} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* 3. Usage Overview */}
          <section className="space-y-4">
            <SectionHeader title="Usage Overview" description="Real-time resource allocation and runtime trends across active workflows." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="ui-card-surface p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-text/80">GPU Usage by Workflow</h4>
                    <span className="text-[10px] font-black text-accent uppercase">Live Telemetry</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Docking", val: 65, color: "bg-accent" },
                      { label: "GNINA", val: 20, color: "bg-indigo-500" },
                      { label: "Simulation", val: 10, color: "bg-emerald-500" },
                      { label: "Other", val: 5, color: "bg-muted-text/20" },
                    ].map(item => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-muted-text/60 uppercase">{item.label}</span>
                          <span className="text-text">{item.val}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-border/10 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
               
               <div className="ui-card-surface p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-text/80">System Health</h4>
                    <span className="text-[10px] font-black text-success uppercase">Optimal</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-muted-bg/30 border border-border/40">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40 block mb-1">CPU Load</span>
                      <span className="text-xl font-black text-text">18%</span>
                    </div>
                    <div className="p-4 rounded-xl bg-muted-bg/30 border border-border/40">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40 block mb-1">Memory</span>
                      <span className="text-xl font-black text-text">64.2<span className="text-xs font-medium text-muted-text ml-1">GB</span></span>
                    </div>
                    <div className="p-4 rounded-xl bg-muted-bg/30 border border-border/40">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40 block mb-1">Storage I/O</span>
                      <span className="text-xl font-black text-text">1.2<span className="text-xs font-medium text-muted-text ml-1">GB/s</span></span>
                    </div>
                    <div className="p-4 rounded-xl bg-muted-bg/30 border border-border/40">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-text/40 block mb-1">Latency</span>
                      <span className="text-xl font-black text-text">24<span className="text-xs font-medium text-muted-text ml-1">ms</span></span>
                    </div>
                  </div>
               </div>
            </div>
          </section>

          {/* 5. Running Jobs Table */}
          <section className="space-y-4">
            <SectionHeader title="Active Compute Jobs" description="Detailed execution tracking for currently running scientific workloads." />
            <div className="ui-card-surface overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                    <th className="px-6 py-4">Job ID</th>
                    <th className="px-6 py-4">Workflow / Project</th>
                    <th className="px-6 py-4">Compute Type</th>
                    <th className="px-6 py-4 text-center">Runtime</th>
                    <th className="px-6 py-4 text-center">Est. Cost</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {RUNNING_JOBS.map(job => (
                    <tr key={job.id} className="group hover:bg-muted-bg/20 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-accent">{job.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-text">{job.workflow}</span>
                          <span className="text-[10px] text-muted-text">{job.project}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-[10px] font-bold text-muted-text/70 uppercase tracking-wider">{job.computeType}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-mono text-[11px] text-text">{job.runtime}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[11px] font-bold text-text/80">{job.cost}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge status={job.status as any} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* 4. Active Queues */}
          <section className="space-y-4">
            <SectionHeader title="Active Queues" />
            <div className="flex flex-col gap-3">
              {QUEUES.map(queue => (
                <div key={queue.name} className="ui-card-surface p-4 border-accent/5 hover:border-accent/20 transition-all cursor-pointer">
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="text-[11px] font-black text-text uppercase tracking-widest">{queue.name}</h5>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                      queue.priority === 'High' ? 'bg-error/10 text-error' :
                      queue.priority === 'Medium' ? 'bg-warning/10 text-warning' : 'bg-muted-bg text-muted-text'
                    }`}>
                      {queue.priority}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase text-muted-text/40">Running</span>
                      <span className="text-xs font-bold text-text">{queue.running}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase text-muted-text/40">Queued</span>
                      <span className="text-xs font-bold text-text">{queue.queued}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[8px] font-black uppercase text-muted-text/40">Wait Time</span>
                      <span className="text-xs font-bold text-accent">{queue.wait}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 6. Compute Credits */}
          <section className="space-y-4">
            <SectionHeader title="Compute Credits" />
            <div className="ui-card-surface p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/40">Credits Remaining</span>
                      <span className="text-3xl font-black text-text">12,450</span>
                   </div>
                   <span className="text-[10px] font-black text-success uppercase">Top Up Active</span>
                </div>
                <div className="h-2 w-full bg-border/20 rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: '62%' }} />
                </div>
                <div className="flex justify-between text-[9px] font-black text-muted-text/40 uppercase">
                  <span>Used: 7,550</span>
                  <span>Allocation: 20,000</span>
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-border/20">
                <h6 className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Usage Projection</h6>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text">Monthly Allocation</span>
                  <span className="text-xs font-mono text-muted-text">20,000 CR</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text">Projected Depletion</span>
                  <span className="text-xs font-bold text-error">June 02, 2026</span>
                </div>
              </div>
            </div>
          </section>

          {/* 8. Resource Alerts */}
          <section className="space-y-4">
            <SectionHeader title="Resource Alerts" />
            <div className="flex flex-col gap-2">
              {ALERTS.map((alert, i) => (
                <div key={i} className={`p-4 rounded-xl border flex items-center gap-4 ${
                  alert.severity === 'error' ? 'bg-error/5 border-error/20' :
                  alert.severity === 'warning' ? 'bg-warning/5 border-warning/20' : 'bg-info/5 border-info/20'
                }`}>
                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                    alert.severity === 'error' ? 'bg-error' :
                    alert.severity === 'warning' ? 'bg-warning' : 'bg-info'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-text truncate">{alert.message}</p>
                    <span className="text-[9px] text-muted-text/60 uppercase font-bold">{alert.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      </>
      )}
      
      {/* 7. Runtime Breakdown Charts */}
      <section className="space-y-4">
        <SectionHeader title="Runtime Trends & Benchmarks" description="Historical analysis of pipeline execution efficiency and resource utilization." />
        <ChartsSection />
      </section>
    </div>
  );
}
