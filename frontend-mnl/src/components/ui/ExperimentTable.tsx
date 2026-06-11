"use client";

import React from "react";
import StatusBadge, { StatusType } from "./StatusBadge";

interface Experiment {
  name: string;
  type: string;
  status: StatusType;
  runtime: string;
  owner: string;
  updatedAt: string;
}

interface ExperimentTableProps {
  experiments: Experiment[];
  className?: string;
  title?: string;
}

export default function ExperimentTable({ 
  experiments, 
  className = "",
  title
}: ExperimentTableProps) {
  return (
    <div className={`ui-card-surface overflow-hidden ${className}`}>
      {title && (
        <div className="border-b border-border/40 bg-surface-subtle/20 px-6 py-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-text/80">{title}</h3>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/40 bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60">
              <th scope="col" className="px-6 py-4">Experiment Name</th>
              <th scope="col" className="px-6 py-4">Type</th>
              <th scope="col" className="px-6 py-4">Status</th>
              <th scope="col" className="px-6 py-4">Runtime</th>
              <th scope="col" className="px-6 py-4">Owner</th>
              <th scope="col" className="px-6 py-4 text-right">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {experiments.map((exp, i) => (
              <tr key={i} className="group hover:bg-muted-bg/20 transition-colors">
                <td className="px-6 py-4">
                  <span className="text-xs font-bold text-text/80 group-hover:text-accent transition-colors">{exp.name}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold text-muted-text/70 uppercase tracking-wider">{exp.type}</span>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={exp.status} size="sm" />
                </td>
                <td className="px-6 py-4">
                  <span className="font-mono text-[11px] text-muted-text">{exp.runtime}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent">
                      {exp.owner.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-xs font-medium text-text/70">{exp.owner}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-[11px] text-muted-text/60">{exp.updatedAt}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
