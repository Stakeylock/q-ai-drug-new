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
import { showToast } from "@/utils/toast";

type BillingDashboardState = "normal" | "loading" | "restricted";

const BILLING_METRICS = [
  { label: "Total Bill (MTD)", value: "$2,450", helperText: "Est. end: $3,100", status: "active" as const },
  { label: "Compute Credits", value: "12.4k", unit: "CR", helperText: "62% used", status: "active" as const },
  { label: "Storage Used", value: "2.8", unit: "TB", status: "completed" as const },
  { label: "API Requests", value: "24.2k", status: "completed" as const },
  { label: "Reports Generated", value: "96", status: "completed" as const },
  { label: "Active Seats", value: "12", unit: "/ 20", status: "completed" as const },
];

const INVOICES = [
  { id: "INV-2026-04", date: "Apr 30, 2026", amount: "$3,120.00", status: "paid" },
  { id: "INV-2026-03", date: "Mar 31, 2026", amount: "$2,850.50", status: "paid" },
  { id: "INV-2026-02", date: "Feb 28, 2026", amount: "$4,200.00", status: "paid" },
  { id: "INV-2026-01", date: "Jan 31, 2026", amount: "$1,890.00", status: "paid" },
];

const PLANS = [
  { name: "Research Starter", price: "$499", seats: "5", features: ["Basic Docking", "Community Support", "100GB Storage"] },
  { name: "Research Pro", price: "$2,499", seats: "20", features: ["Quantum Reranking", "Priority Queue", "5TB Storage", "24/7 Support"], active: true },
  { name: "Enterprise", price: "Custom", seats: "Unlimited", features: ["On-prem Deployment", "SLA Guarantee", "Custom AI Models", "Full Audit Logs"] },
];

export default function BillingDashboard() {
  const [simulatedState, setSimulatedState] = useState<BillingDashboardState>("normal");

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Billing & Subscription"
        breadcrumb="Organization / Finance"
        description="Manage your research subscription, compute credit allocation, and financial records for the QuDrugForge™ platform."
        actions={
          <ActionButtonGroup>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">UI State:</span>
              <select 
                value={simulatedState}
                onChange={(e) => setSimulatedState(e.target.value as BillingDashboardState)}
                className="bg-muted-bg border border-border/40 text-text rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider outline-none focus:border-accent cursor-pointer"
              >
                <option value="normal">🟢 Operational</option>
                <option value="loading">🟡 Loading Skeletons</option>
                <option value="restricted">🔒 Access Restricted</option>
              </select>
            </div>
            <ActionButton label="Upgrade Plan" variant="primary" />
            <ActionButton label="Add Credits" />
          </ActionButtonGroup>
        }
      />

      {/* State Rendering */}
      {simulatedState === "loading" && (
        <div className="space-y-8 animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 ui-card-surface p-6 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-40" />
              <div className="space-y-2 py-4 border-y border-border/20">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="ui-card-surface p-5 space-y-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <TableSkeleton rows={4} />
        </div>
      )}

      {simulatedState === "restricted" && (
        <div className="space-y-8">
          <PermissionState
            title="Billing Administration Restricted"
            description="Your user role lacks permission to review pricing packages, view historical invoices, or purchase compute allocations."
            requiredRole="Financial Administrator or Platform Owner"
            action={
              <ActionButton
                label="Request Access Escalation"
                variant="primary"
                onClick={() =>
                  showToast({
                    type: "info",
                    title: "Request logged",
                    message: "A finance administrator will review your billing access request.",
                  })
                }
              />
            }
          />
        </div>
      )}

      {simulatedState === "normal" && (
        <>
          {/* Current Plan & Usage Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
           <div className="ui-card-surface p-6 h-full border-accent/20 bg-accent/[0.02]">
              <div className="flex justify-between items-start mb-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Current Plan</h3>
                 <StatusBadge status="completed" size="sm" />
              </div>
              <div className="space-y-6">
                 <div>
                    <h4 className="text-2xl font-black text-text">Research Pro</h4>
                    <p className="text-xs font-bold text-muted-text mt-1">Monthly Billing • $2,499/mo</p>
                 </div>
                 <div className="space-y-3 py-6 border-y border-border/20">
                    <div className="flex justify-between items-center text-xs font-bold">
                       <span className="text-muted-text/60">Workspace</span>
                       <span className="text-text">Oncology Research</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold">
                       <span className="text-muted-text/60">Seats</span>
                       <span className="text-text">12 / 20 Active</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold">
                       <span className="text-muted-text/60">Next Invoice</span>
                       <span className="text-text">June 01, 2026</span>
                    </div>
                 </div>
                 <button className="w-full py-3 rounded-lg border border-accent/20 text-accent font-black uppercase tracking-widest text-[10px] hover:bg-accent/5 transition-all">Change Subscription</button>
              </div>
           </div>
        </div>
        
        <div className="lg:col-span-2">
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4 h-full">
              {BILLING_METRICS.map((metric, i) => (
                <MetricCard key={i} {...metric} />
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Compute Credits Detail */}
          <section className="space-y-4">
             <SectionHeader title="Compute Credits Allocation" description="Detailed breakdown of scientific workload costs and credit consumption." />
             <div className="ui-card-surface p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="space-y-4">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-text/60">
                         <span>Monthly Allocation</span>
                         <span className="text-text">20,000 CR</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-text/60">
                         <span>Used This Month</span>
                         <span className="text-text">12,450 CR</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-accent">
                         <span>Remaining</span>
                         <span className="text-text">7,550 CR</span>
                      </div>
                   </div>
                   
                   <div className="md:col-span-2 space-y-4">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-text/40">Top Workflows by Cost</h5>
                      <div className="space-y-3">
                         {[
                           { label: "Quantum Reranking", val: 55, color: "bg-accent" },
                           { label: "Molecular Dynamics", val: 25, color: "bg-indigo-500" },
                           { label: "Docking & GNINA", val: 15, color: "bg-emerald-500" },
                           { label: "Other", val: 5, color: "bg-muted-text/20" },
                         ].map(item => (
                           <div key={item.label} className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold">
                                 <span className="text-muted-text/60">{item.label}</span>
                                 <span className="text-text">{item.val}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-border/10 rounded-full overflow-hidden">
                                 <div className={`h-full ${item.color}`} style={{ width: `${item.val}%` }} />
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
             </div>
          </section>

          {/* Billing Breakdown Table */}
          <section className="space-y-4">
            <SectionHeader title="Billing Breakdown" description="Itemized monthly usage across all platform resources." />
            <div className="ui-card-surface overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                      <th className="px-6 py-4">Resource Category</th>
                      <th className="px-6 py-4">Usage Detail</th>
                      <th className="px-6 py-4">Rate</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {[
                      { cat: "Compute", detail: "8x H100, QPU Rigetti", rate: "Variable", amount: "$1,450.00" },
                      { cat: "Storage", detail: "2.8 TB Primary SSD", rate: "$0.05/GB", amount: "$140.00" },
                      { cat: "API Usage", detail: "24,200 Requests", rate: "$0.01/100 req", amount: "$24.20" },
                      { cat: "Team Seats", detail: "12 Active Users", rate: "$50.00/seat", amount: "$600.00" },
                      { cat: "Report Generation", detail: "96 Validation Dossiers", rate: "Included", amount: "$0.00" },
                      { cat: "Premium Integrations", detail: "BioNeMo, AlphaFold API", rate: "Flat", amount: "$235.80" },
                    ].map(item => (
                      <tr key={item.cat} className="group hover:bg-muted-bg/20 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-text">{item.cat}</span>
                        </td>
                        <td className="px-6 py-4 text-[11px] text-muted-text">
                           {item.detail}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-muted-text/50 uppercase tracking-wider">
                           {item.rate}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-[11px] font-bold text-text">
                           {item.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* Invoices */}
          <section className="space-y-4">
            <SectionHeader title="Recent Invoices" />
            <div className="ui-card-surface overflow-hidden">
               <div className="divide-y divide-border/20">
                  {INVOICES.map(inv => (
                    <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-muted-bg/20 transition-colors">
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-text">{inv.id}</span>
                          <span className="text-[10px] text-muted-text">{inv.date}</span>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="text-xs font-mono font-bold text-text">{inv.amount}</span>
                          <button className="h-8 w-8 flex items-center justify-center rounded border border-border text-muted-text hover:text-accent hover:border-accent transition-all" title="Download PDF">
                             ↓
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
               <button className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-muted-text/40 hover:text-accent transition-colors">View All Invoices</button>
            </div>
          </section>

          {/* Plan Comparison Placeholder */}
          <section className="space-y-4">
            <SectionHeader title="Platform Tiers" />
            <div className="flex flex-col gap-3">
               {PLANS.map(plan => (
                 <div key={plan.name} className={`ui-card-surface p-5 border-dashed border-2 flex flex-col gap-4 ${plan.active ? 'border-accent/40 bg-accent/[0.01]' : 'border-border/40 opacity-60'}`}>
                    <div className="flex justify-between items-start">
                       <h5 className="text-[11px] font-black uppercase tracking-widest text-text">{plan.name}</h5>
                       {plan.active && <span className="text-[9px] font-black text-accent uppercase">Current</span>}
                    </div>
                    <div className="text-xl font-black text-text">{plan.price}<span className="text-[10px] font-medium text-muted-text ml-1">{plan.price === 'Custom' ? '' : '/mo'}</span></div>
                    <div className="space-y-1.5">
                       {plan.features.slice(0, 3).map(f => (
                         <div key={f} className="flex items-center gap-2 text-[10px] font-medium text-muted-text/80">
                            <span className="text-accent text-lg">•</span>
                            {f}
                         </div>
                       ))}
                    </div>
                    {!plan.active && <button className="w-full py-2 text-[10px] font-black uppercase text-muted-text border border-border rounded hover:border-accent hover:text-accent transition-all">Switch Tier</button>}
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
