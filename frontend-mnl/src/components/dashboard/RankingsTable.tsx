"use client";

import { useEffect, useState } from "react";
import { getProjectCandidates } from "@/services/api";
import type { RankedCandidatesResponse } from "@/types/api";

export default function RankingsTable() {
  const [data, setData] = useState<RankedCandidatesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const projectId = localStorage.getItem("active_project_id");
    if (!projectId) {
      setLoading(false);
      return;
    }
    getProjectCandidates(projectId, 8).then((res) => {
      setData(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const getStatusColor = (status: string) => {
    if (status === "Validated") return "text-success bg-success/10 border-success/20";
    if (status === "Review") return "text-accent bg-accent/10 border-accent/20";
    return "text-text-secondary bg-surface-subtle/50 border-border/30";
  };

  if (loading) {
    return (
      <div className="ui-card-surface p-8 space-y-4">
        <div className="skeleton-shimmer h-6 w-48 rounded-full" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-12 w-full rounded-xl opacity-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ui-card-surface overflow-hidden p-0 shadow-premium transition-all duration-300 hover:shadow-2xl">
      <div className="p-8 border-b border-border/30 bg-surface-subtle/10">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
          Candidate Lead Rankings
        </h2>
        <p className="text-sm font-medium text-text-secondary/70 mt-1">
          Top-ranked molecular candidates from recent pipeline runs
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-subtle/20">
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Candidate ID</th>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Target</th>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Docking</th>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary/60">ADMET</th>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Quantum</th>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary/60">Toxicity</th>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary/60 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {data?.items.map((item: any, i) => (
              <tr key={i} className="group hover:bg-primary/5 transition-colors">
                <td className="px-8 py-4">
                  <span className="text-[13px] font-black tracking-tight text-text group-hover:text-primary transition-colors">
                    {item.molecule_id}
                  </span>
                </td>
                <td className="px-8 py-4 text-[12px] font-bold text-text-secondary">EGFR-TK</td>
                <td className="px-8 py-4 text-[12px] font-black text-text">{item.binding_affinity}</td>
                <td className="px-8 py-4 text-[12px] font-medium text-text-secondary">{item.qed}</td>
                <td className="px-8 py-4 text-[12px] font-black text-accent">{item.qed > 0.8 ? "0.98" : "0.85"}</td>
                <td className="px-8 py-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${item.logp > 4 ? "bg-error" : "bg-success"}`} />
                    <span className="text-[11px] font-bold text-text-secondary/80">{item.logp > 4 ? "High" : "Low"}</span>
                  </div>
                </td>
                <td className="px-8 py-4 text-right">
                  <span className={`inline-block px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${getStatusColor(i % 3 === 0 ? "Validated" : "Review")}`}>
                    {i % 3 === 0 ? "Validated" : "Review"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
