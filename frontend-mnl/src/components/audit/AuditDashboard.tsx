"use client";

import React from "react";
import {
  MetricCard,
  SectionHeader,
  StatusBadge,
  PageHeader,
  ActionButton,
  ActionButtonGroup,
} from "@/components/ui";

const AUDIT_METRICS = [
  { label: "Total Events", value: "12,482", helperText: "Last 30 days", status: "completed" as const },
  { label: "Security Events", value: "1,240", status: "active" as const },
  { label: "Research Actions", value: "8,420", status: "completed" as const },
  { label: "Failed Actions", value: "42", status: "failed" as const, helperText: "0.3% rate" },
  { label: "API Events", value: "2,420", status: "completed" as const },
  { label: "Export Events", value: "360", status: "completed" as const },
];

const LOG_ENTRIES = [
  { time: "Just now", user: "Dr. Sarah Chen", event: "Dataset Uploaded", resource: "egfr_library_v2.sdf", project: "EGFR NSCLC", severity: "low", source: "192.168.1.42", status: "success" },
  { time: "2m ago", user: "David Kim", event: "Experiment Started", resource: "gnina-rerank-04", project: "PIK3CA Screening", severity: "medium", source: "10.0.4.12", status: "success" },
  { time: "15m ago", user: "Admin User", event: "API Key Created", resource: "qdf_live_...1234", project: "Global", severity: "high", source: "42.12.8.99", status: "success" },
  { time: "1h ago", user: "Elena Rossi", event: "Report Exported", resource: "EGFR_Dossier_Final.pdf", project: "EGFR NSCLC", severity: "low", source: "192.168.1.18", status: "success" },
  { time: "3h ago", user: "System", event: "Failed Login", resource: "m.wilson@pharma.com", project: "Org", severity: "high", source: "172.16.0.4", status: "failed" },
  { time: "5h ago", user: "Dr. Sarah Chen", event: "Validation Warning Ack", resource: "chem_integrity_log", project: "EGFR NSCLC", severity: "medium", source: "192.168.1.42", status: "success" },
  { time: "Yesterday", user: "Admin User", event: "Member Invited", resource: "j.doe@pharma.com", project: "Org", severity: "medium", source: "42.12.8.99", status: "success" },
];

const SECURITY_EVENTS = [
  { event: "Login Success", user: "sarah.chen", time: "10m ago" },
  { event: "Failed Login Attempt", user: "unknown", time: "3h ago" },
  { event: "API Key Rotation", user: "admin", time: "5h ago" },
  { event: "Permission Changed", user: "d.kim", time: "Yesterday" },
  { event: "Workspace Switched", user: "e.rossi", time: "2d ago" },
];

const RESEARCH_EVENTS = [
  { event: "Molecule Generation Started", user: "d.kim", time: "15m ago" },
  { event: "GNINA Rescoring Completed", user: "s.chen", time: "1h ago" },
  { event: "Quantum Reranking Queued", user: "s.chen", time: "4h ago" },
  { event: "Candidate Dossier Generated", user: "e.rossi", time: "6h ago" },
  { event: "ADMET Report Exported", user: "s.chen", time: "Yesterday" },
];

export default function AuditDashboard() {
  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Audit Logs & Traceability"
        breadcrumb="Organization / Security"
        description="Comprehensive audit trail of research activities, security events, and administrative changes for compliance and reproducibility."
        actions={
          <ActionButtonGroup>
            <ActionButton label="Export Logs" variant="primary" />
            <ActionButton label="Download CSV" />
            <ActionButton label="Create Audit Report" />
          </ActionButtonGroup>
        }
      />

      {/* 2. Audit Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {AUDIT_METRICS.map((metric, i) => (
          <MetricCard key={i} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* 3. Filters Placeholder */}
          <section className="space-y-4">
             <div className="ui-card-surface p-4 flex flex-wrap items-center gap-4 border-dashed border-border/40">
                <div className="flex-1 min-w-[200px]">
                   <input 
                     type="text" 
                     placeholder="Search events, users, or resources..." 
                     className="w-full bg-muted-bg/30 border border-border/40 rounded-lg h-9 px-3 text-xs outline-none focus:border-accent transition-all"
                   />
                </div>
                <select className="bg-muted-bg/30 border border-border/40 rounded-lg h-9 px-3 text-[10px] font-black uppercase tracking-widest outline-none">
                   <option>All Severities</option>
                   <option>High</option>
                   <option>Medium</option>
                   <option>Low</option>
                </select>
                <select className="bg-muted-bg/30 border border-border/40 rounded-lg h-9 px-3 text-[10px] font-black uppercase tracking-widest outline-none">
                   <option>All Users</option>
                   <option>Dr. Sarah Chen</option>
                   <option>David Kim</option>
                </select>
                <button className="h-9 px-4 bg-accent/5 text-accent text-[10px] font-black uppercase tracking-widest rounded-lg border border-accent/20">Filter</button>
             </div>
          </section>

          {/* 4. Audit Log Table */}
          <section className="space-y-4">
            <SectionHeader title="Activity Stream" description="Granular record of all system interactions and data mutations." />
            <div className="ui-card-surface overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                    <th className="px-6 py-4">Time / User</th>
                    <th className="px-6 py-4">Event / Resource</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4">Severity</th>
                    <th className="px-6 py-4">IP Source</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {LOG_ENTRIES.map((log, i) => (
                    <tr key={i} className="group hover:bg-muted-bg/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="text-xs font-bold text-text/90">{log.user}</span>
                           <span className="text-[10px] text-muted-text/50">{log.time}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="text-[11px] font-black uppercase tracking-widest text-text group-hover:text-accent transition-colors">{log.event}</span>
                           <span className="text-[10px] font-mono text-muted-text/60 truncate max-w-[160px]">{log.resource}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold text-muted-text/70 uppercase">
                         {log.project}
                      </td>
                      <td className="px-6 py-4">
                         <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                           log.severity === 'high' ? 'bg-error/10 text-error border-error/20' : 
                           log.severity === 'medium' ? 'bg-warning/10 text-warning border-warning/20' : 
                           'bg-muted-bg text-muted-text border-border/40'
                         }`}>
                           {log.severity.toUpperCase()}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-muted-text/40">
                         {log.source}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <StatusBadge status={log.status as any} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/40 hover:text-accent transition-all border-b border-border/20">Load 50 More Entries</button>
          </section>
        </div>

        <div className="space-y-8">
          {/* 5. Security Events Panel */}
          <section className="space-y-4">
            <SectionHeader title="Security Events" />
            <div className="ui-card-surface p-5 space-y-4">
               {SECURITY_EVENTS.map((item, i) => (
                 <div key={i} className="flex items-center justify-between group">
                    <div className="flex flex-col">
                       <span className={`text-[11px] font-bold ${item.event.includes('Failed') ? 'text-error' : 'text-text/80'}`}>{item.event}</span>
                       <span className="text-[10px] text-muted-text/40">{item.user} • {item.time}</span>
                    </div>
                    <button className="text-muted-text/20 group-hover:text-accent transition-colors">›</button>
                 </div>
               ))}
            </div>
          </section>

          {/* 6. Research Activity Events */}
          <section className="space-y-4">
            <SectionHeader title="Research Activity" />
            <div className="ui-card-surface p-5 space-y-4">
               {RESEARCH_EVENTS.map((item, i) => (
                 <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-accent/40" />
                    <div className="flex flex-col">
                       <span className="text-[11px] font-bold text-text/80">{item.event}</span>
                       <div className="flex gap-2 text-[10px] text-muted-text/40 uppercase font-black tracking-widest">
                          <span>{item.user}</span>
                          <span>•</span>
                          <span>{item.time}</span>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* Compliance Badge */}
          <section className="space-y-4">
            <div className="ui-card-surface p-6 bg-emerald-500/[0.03] border-emerald-500/20 flex flex-col items-center text-center gap-3">
               <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-2xl font-black">
                  ✓
               </div>
               <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Audit Compliance</h4>
                  <p className="text-[11px] font-medium text-muted-text/60">Data retention policy active (7 years). All events are immutable and signed.</p>
               </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
