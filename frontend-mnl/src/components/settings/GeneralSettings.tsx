"use client";

import React from "react";
import {
  SectionHeader,
  StatusBadge,
  PageHeader,
  ActionButton,
  ActionButtonGroup,
} from "@/components/ui";

const SETTINGS_GROUPS = [
  {
    id: "profile",
    title: "Profile Settings",
    fields: [
      { label: "Full Name", value: "Dr. Sarah Chen", type: "text" },
      { label: "Email Address", value: "s.chen@quinfosys.io", type: "email" },
      { label: "Primary Role", value: "Principal Investigator", type: "select", options: ["PI", "ML Scientist", "Chemist"] },
      { label: "Organization", value: "Quinfosys Therapeutics", type: "text", disabled: true },
    ]
  },
  {
    id: "workspace",
    title: "Workspace Configuration",
    fields: [
      { label: "Workspace Name", value: "Oncology Research Workspace", type: "text" },
      { label: "Default Project", value: "EGFR NSCLC Discovery", type: "select", options: ["EGFR NSCLC", "PARP1 Oncology"] },
      { label: "Timezone", value: "UTC (GMT+0)", type: "select" },
      { label: "Data Region", value: "US-East (Virginia)", type: "text", disabled: true },
    ]
  },
  {
    id: "research",
    title: "Research Defaults",
    fields: [
      { label: "Default Docking Engine", value: "GNINA 1.0", type: "select", options: ["GNINA", "AutoDock Vina", "Glide"] },
      { label: "ADMET Threshold", value: "85%", type: "text" },
      { label: "Quantum Reranking Mode", value: "Hybrid Classical-Quantum", type: "select" },
      { label: "Default Report Format", value: "Scientific Dossier (PDF)", type: "select" },
    ]
  }
];

export default function GeneralSettings() {
  return (
    <div className="flex flex-col gap-10 pb-20">
      <PageHeader
        title="Settings & Configuration"
        breadcrumb="Platform / Administration"
        description="Manage your professional profile, workspace environments, research defaults, and platform security."
        actions={
          <ActionButtonGroup>
            <ActionButton label="Save All Changes" variant="primary" />
            <ActionButton label="Discard" variant="ghost" />
          </ActionButtonGroup>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-3 space-y-2">
           {[
             "Profile", "Workspace", "Research Defaults", "Security", 
             "Notifications", "API Preferences", "Data & Storage", "Danger Zone"
           ].map(item => (
             <button key={item} className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
               item === 'Profile' ? 'bg-accent/10 text-accent' : 'text-muted-text/40 hover:bg-muted-bg/50 hover:text-muted-text'
             }`}>
               {item}
             </button>
           ))}
        </aside>

        {/* Settings Content */}
        <div className="lg:col-span-9 space-y-12">
           {/* Profile & Workspace Sections */}
           {SETTINGS_GROUPS.map(group => (
             <section key={group.id} className="space-y-6">
                <SectionHeader title={group.title} />
                <div className="ui-card-surface p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                   {group.fields.map(field => (
                     <div key={field.label} className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">{field.label}</label>
                        <div className="relative">
                           <input 
                             type={field.type} 
                             defaultValue={field.value}
                             disabled={field.disabled}
                             className={`w-full h-11 bg-muted-bg/20 border border-border/40 rounded-xl px-4 text-xs font-bold outline-none focus:border-accent transition-all ${
                               field.disabled ? 'opacity-50 cursor-not-allowed' : ''
                             }`}
                           />
                           {field.type === 'select' && (
                             <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-text/40">▾</div>
                           )}
                        </div>
                     </div>
                   ))}
                </div>
             </section>
           ))}

           {/* Security Section */}
           <section className="space-y-6">
              <SectionHeader title="Security" />
              <div className="ui-card-surface p-8 space-y-8">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                       <h4 className="text-xs font-black text-text uppercase tracking-widest">Password Management</h4>
                       <p className="text-[11px] text-muted-text/60 font-medium">Update your account password regularly to maintain security.</p>
                    </div>
                    <button className="px-6 py-2 bg-muted-bg text-text text-[10px] font-black uppercase tracking-widest rounded-lg border border-border/40 hover:bg-muted-bg/80 transition-all">Change Password</button>
                 </div>
                 
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-8 border-t border-border/20">
                    <div className="space-y-1">
                       <h4 className="text-xs font-black text-text uppercase tracking-widest flex items-center gap-2">
                          Two-Factor Authentication
                          <StatusBadge status="warning" size="sm" />
                       </h4>
                       <p className="text-[11px] text-muted-text/60 font-medium">Add an extra layer of security to your research account.</p>
                    </div>
                    <button className="px-6 py-2 bg-accent/5 text-accent text-[10px] font-black uppercase tracking-widest rounded-lg border border-accent/20 hover:bg-accent/10 transition-all">Enable 2FA</button>
                 </div>

                 <div className="space-y-4 pt-8 border-t border-border/20">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-text/40">Active Sessions</h4>
                    <div className="ui-card-surface bg-muted-bg/10 border-border/20 p-4 flex justify-between items-center">
                       <div className="flex items-center gap-3">
                          <span className="text-xl">💻</span>
                          <div className="flex flex-col">
                             <span className="text-[11px] font-bold text-text">Chrome on macOS • San Francisco, US</span>
                             <span className="text-[9px] font-black uppercase text-accent tracking-widest">Current Session</span>
                          </div>
                       </div>
                       <button className="text-[9px] font-black uppercase text-error/60 hover:text-error transition-colors">Revoke</button>
                    </div>
                 </div>
              </div>
           </section>

           {/* Notifications Section */}
           <section className="space-y-6">
              <SectionHeader title="Notifications" />
              <div className="ui-card-surface p-8 space-y-6">
                 {[
                   { label: "Experiment Completed", desc: "Notify when a pipeline execution finishes.", default: true },
                   { label: "Validation Warning", desc: "Alert on potential integrity issues in artifacts.", default: true },
                   { label: "Report Generated", desc: "Notify when a candidate dossier is ready.", default: false },
                   { label: "Billing Alert", desc: "Alert when credit usage exceeds 80%.", default: true },
                   { label: "Integration Sync Failed", desc: "Notify on external service connection issues.", default: true },
                 ].map(item => (
                   <div key={item.label} className="flex justify-between items-center group">
                      <div className="space-y-0.5">
                         <h4 className="text-[11px] font-black text-text/80 uppercase tracking-widest">{item.label}</h4>
                         <p className="text-[10px] text-muted-text/50 font-medium">{item.desc}</p>
                      </div>
                      <div className={`h-5 w-9 rounded-full relative transition-colors cursor-pointer ${
                        item.default ? 'bg-accent' : 'bg-muted-bg/60 border border-border/40'
                      }`}>
                         <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                           item.default ? 'right-0.5 shadow-sm' : 'left-0.5'
                         }`} />
                      </div>
                   </div>
                 ))}
              </div>
           </section>

           {/* API Preferences */}
           <section className="space-y-6">
              <SectionHeader title="API Preferences" />
              <div className="ui-card-surface p-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Default API Environment</label>
                       <select className="w-full h-11 bg-muted-bg/20 border border-border/40 rounded-xl px-4 text-xs font-bold outline-none">
                          <option>Production (api.qudrugforge.io)</option>
                          <option>Staging (staging-api.qudrugforge.io)</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">SDK Language Preference</label>
                       <select className="w-full h-11 bg-muted-bg/20 border border-border/40 rounded-xl px-4 text-xs font-bold outline-none">
                          <option>Python</option>
                          <option>TypeScript/JS</option>
                          <option>Go</option>
                       </select>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 text-warning bg-warning/5 border border-warning/20 p-4 rounded-xl">
                    <span className="text-lg">⚠️</span>
                    <p className="text-[10px] font-bold">Enabling webhook signing is recommended for production security.</p>
                 </div>
              </div>
           </section>

           {/* Data & Storage */}
           <section className="space-y-6">
              <SectionHeader title="Data & Storage Preferences" />
              <div className="ui-card-surface p-8 space-y-6">
                 {[
                   { label: "Artifact Retention", value: "90 Days", type: "select" },
                   { label: "Auto-delete Temporary Files", value: "Enabled", type: "toggle", checked: true },
                   { label: "Checksum Validation", value: "All Uploads", type: "select" },
                   { label: "Report Archive Policy", value: "Permanent", type: "select" },
                 ].map(item => (
                   <div key={item.label} className="flex justify-between items-center">
                      <div className="space-y-0.5">
                         <h4 className="text-[11px] font-black text-text/80 uppercase tracking-widest">{item.label}</h4>
                      </div>
                      {item.type === 'select' ? (
                        <div className="h-9 px-4 bg-muted-bg/30 border border-border/40 rounded-lg flex items-center text-[10px] font-bold text-text cursor-pointer hover:border-accent/40 transition-colors">
                           {item.value} ▾
                        </div>
                      ) : (
                        <div className="h-5 w-9 rounded-full bg-accent relative cursor-pointer">
                           <div className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
                        </div>
                      )}
                   </div>
                 ))}
              </div>
           </section>

           {/* Danger Zone */}
           <section className="space-y-6">
              <SectionHeader title="Danger Zone" />
              <div className="ui-card-surface p-8 border-error/20 bg-error/[0.01] space-y-6">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                       <h4 className="text-xs font-black text-error uppercase tracking-widest">Revoke All API Keys</h4>
                       <p className="text-[10px] text-muted-text/60 font-medium">Immediately invalidate all active tokens for this workspace.</p>
                    </div>
                    <button className="px-6 py-2 border border-error/40 text-error text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-error/5 transition-all">Revoke All</button>
                 </div>
                 
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-6 border-t border-error/10">
                    <div className="space-y-1">
                       <h4 className="text-xs font-black text-error uppercase tracking-widest">Clear Temporary Artifacts</h4>
                       <p className="text-[10px] text-muted-text/60 font-medium">Purge all intermediate simulation data to reclaim storage.</p>
                    </div>
                    <button className="px-6 py-2 border border-error/40 text-error text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-error/5 transition-all">Clear Storage</button>
                 </div>

                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-6 border-t border-error/10">
                    <div className="space-y-1">
                       <h4 className="text-xs font-black text-error uppercase tracking-widest">Delete Workspace</h4>
                       <p className="text-[10px] text-muted-text/60 font-medium">Permanently remove this research workspace and all associated data.</p>
                    </div>
                    <button className="px-6 py-2 bg-error text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-error/90 transition-all shadow-lg shadow-error/20">Delete Forever</button>
                 </div>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}
