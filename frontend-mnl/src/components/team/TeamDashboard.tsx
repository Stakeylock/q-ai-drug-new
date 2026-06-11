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
  PermissionState,
  TableSkeleton,
} from "@/components/ui";

const TEAM_METRICS = [
  { label: "Team Members", value: "24", status: "completed" as const },
  { label: "Active Researchers", value: "18", helperText: "Last 24h", status: "active" as const },
  { label: "Admins", value: "3", status: "completed" as const },
  { label: "Pending Invites", value: "2", status: "pending" as const },
  { label: "Workspaces", value: "4", helperText: "Managed units", status: "completed" as const },
  { label: "Projects Shared", value: "12", status: "completed" as const },
];

const MEMBERS = [
  { 
    name: "Dr. Sarah Chen", 
    role: "Principal Investigator", 
    workspace: "Oncology Division", 
    projects: "EGFR NSCLC, PARP1", 
    lastActive: "Just now", 
    status: "active", 
    access: "Full Access" 
  },
  { 
    name: "David Kim", 
    role: "ML Scientist", 
    workspace: "AI Lab", 
    projects: "PIK3CA Molecular", 
    lastActive: "12m ago", 
    status: "active", 
    access: "Editor" 
  },
  { 
    name: "Elena Rossi", 
    role: "Computational Chemist", 
    workspace: "Oncology Division", 
    projects: "EGFR NSCLC", 
    lastActive: "2h ago", 
    status: "active", 
    access: "Editor" 
  },
  { 
    name: "Admin User", 
    role: "Organization Admin", 
    workspace: "Central Ops", 
    projects: "All Programs", 
    lastActive: "Yesterday", 
    status: "active", 
    access: "Admin" 
  },
  { 
    name: "Mark Wilson", 
    role: "Research Associate", 
    workspace: "Molecular Screening", 
    projects: "PIK3CA Molecular", 
    lastActive: "2d ago", 
    status: "inactive", 
    access: "Editor" 
  },
  { 
    name: "External Reviewer", 
    role: "Viewer", 
    workspace: "Validation", 
    projects: "EGFR NSCLC", 
    lastActive: "1w ago", 
    status: "active", 
    access: "Read-only" 
  },
];

const ROLES = [
  { role: "Org Admin", projects: "Full", experiments: "Full", datasets: "Full", billing: "Yes", api: "Yes" },
  { role: "PI / Lead", projects: "Manage", experiments: "Run", datasets: "Upload", billing: "No", api: "Yes" },
  { role: "Researcher", projects: "Edit", experiments: "Run", datasets: "Upload", billing: "No", api: "No" },
  { role: "Viewer", projects: "Read", experiments: "Read", datasets: "Read", billing: "No", api: "No" },
];

const INVITATIONS = [
  { email: "j.doe@pharma.com", role: "ML Scientist", invitedBy: "Sarah Chen", expiry: "24h", status: "pending" },
  { email: "research@institute.org", role: "Research Associate", invitedBy: "Admin User", expiry: "48h", status: "pending" },
];

const PROJECT_GROUPS = [
  { name: "EGFR NSCLC Discovery", members: 8, lead: "Dr. Sarah Chen" },
  { name: "PARP1 Oncology Program", members: 5, lead: "Elena Rossi" },
  { name: "PIK3CA Molecular Screening", members: 12, lead: "David Kim" },
];

export default function TeamDashboard() {
  const [simulatedState, setSimulatedState] = useState<"normal" | "loading" | "restricted">("normal");

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Team & Collaboration"
        breadcrumb="Organization / User Management"
        description="Manage organization members, research roles, and workspace-level permissions for shared drug discovery programs."
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
                <option value="restricted">🔒 Access Restricted</option>
              </select>
            </div>
            <ActionButton label="Invite Member" variant="primary" />
            <ActionButton label="Manage Roles" />
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

      {simulatedState === "restricted" && (
        <div className="space-y-8">
          <PermissionState
            title="Team & Access Control Restricted"
            description="Your user access level does not allow modification of team members, invitation of external reviewers, or role reallocations."
            requiredRole="Organization Administrator or Program Director"
            action={
              <ActionButton label="Request Role Escalation" variant="primary" onClick={() => alert("Role elevation request dispatched.")} />
            }
          />
        </div>
      )}

      {simulatedState === "normal" && (
        <>

      {/* 2. Team Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {TEAM_METRICS.map((metric, i) => (
          <MetricCard key={i} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* 3. Members Table */}
          <section className="space-y-4">
            <SectionHeader title="Team Members" description="Active research personnel and collaborators within your organization." />
            <div className="ui-card-surface overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Role / Access</th>
                    <th className="px-6 py-4">Workspace</th>
                    <th className="px-6 py-4">Projects</th>
                    <th className="px-6 py-4 text-center">Last Active</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {MEMBERS.map(member => (
                    <tr key={member.name} className="group hover:bg-muted-bg/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-black text-accent">
                             {member.name.split(' ').map(n => n[0]).join('')}
                           </div>
                           <span className="text-xs font-bold text-text group-hover:text-accent transition-colors">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-text/80 tracking-widest">{member.role}</span>
                          <span className="text-[10px] text-muted-text/60">{member.access}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-[10px] font-bold text-muted-text/70 uppercase tracking-wider">{member.workspace}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-medium text-text/70 truncate max-w-[140px] block">{member.projects}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] font-bold text-muted-text/50 uppercase">{member.lastActive}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge status={member.status as any} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Role & Permission Overview */}
          <section className="space-y-4">
            <SectionHeader title="Role & Permission Matrix" description="Standardized capability sets across organization roles." />
            <div className="ui-card-surface overflow-x-auto">
               <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-muted-bg/30 text-[9px] font-black uppercase tracking-widest text-muted-text/60 border-b border-border/40">
                      <th className="px-6 py-4">Role Type</th>
                      <th className="px-6 py-4 text-center">Projects</th>
                      <th className="px-6 py-4 text-center">Experiments</th>
                      <th className="px-6 py-4 text-center">Datasets</th>
                      <th className="px-6 py-4 text-center">Billing</th>
                      <th className="px-6 py-4 text-center">API Keys</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {ROLES.map(r => (
                      <tr key={r.role}>
                        <td className="px-6 py-4 font-black uppercase tracking-widest text-text/80">{r.role}</td>
                        <td className="px-6 py-4 text-center font-bold text-muted-text">{r.projects}</td>
                        <td className="px-6 py-4 text-center font-bold text-muted-text">{r.experiments}</td>
                        <td className="px-6 py-4 text-center font-bold text-muted-text">{r.datasets}</td>
                        <td className="px-6 py-4 text-center">
                           <span className={r.billing === 'Yes' ? 'text-success font-black' : 'text-muted-text/30'}>{r.billing}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className={r.api === 'Yes' ? 'text-success font-black' : 'text-muted-text/30'}>{r.api}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* 5. Invitations */}
          <section className="space-y-4">
            <SectionHeader title="Pending Invitations" />
            <div className="flex flex-col gap-3">
               {INVITATIONS.map(inv => (
                 <div key={inv.email} className="ui-card-surface p-4 flex flex-col gap-3 border-accent/5 hover:border-accent/20 transition-all">
                    <div className="flex justify-between items-start">
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-text">{inv.email}</span>
                          <span className="text-[10px] font-black uppercase text-accent tracking-widest">{inv.role}</span>
                       </div>
                       <StatusBadge status={inv.status as any} size="sm" />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border/20 text-[9px] font-bold text-muted-text/50 uppercase">
                       <span>By: {inv.invitedBy}</span>
                       <span className="text-error/60">Expires: {inv.expiry}</span>
                    </div>
                 </div>
               ))}
               <button className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-text/40 hover:text-accent border border-dashed border-border/60 rounded-xl transition-all">Resend All Invitations</button>
            </div>
          </section>

          {/* 6. Project Access */}
          <section className="space-y-4">
            <SectionHeader title="Active Program Access" />
            <div className="ui-card-surface p-5 space-y-5">
               {PROJECT_GROUPS.map(group => (
                 <div key={group.name} className="space-y-2 pb-4 border-b border-border/20 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-text truncate max-w-[160px]">{group.name}</span>
                       <span className="text-[10px] font-black text-accent bg-accent/5 px-2 py-0.5 rounded-full">{group.members} Members</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-text/50 uppercase tracking-widest">
                       <span>Lead: {group.lead}</span>
                       <button className="text-accent hover:underline">Manage</button>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* Quick Stats Sidebar */}
          <section className="space-y-4">
            <div className="ui-card-surface p-5 bg-accent/[0.02] border-accent/10">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-accent mb-4">Organizational Health</h4>
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-[11px]">
                     <span className="font-bold text-muted-text">Collaborator Ratio</span>
                     <span className="font-black text-text">3.2 : 1</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                     <span className="font-bold text-muted-text">Avg Access Level</span>
                     <span className="font-black text-text text-emerald-500">Editor</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                     <span className="font-bold text-muted-text">Resource Quota</span>
                     <span className="font-black text-text">84% Used</span>
                  </div>
               </div>
            </div>
          </section>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
