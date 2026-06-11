import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { GninaResult } from "@/types/api";

interface GNINARankingTableProps {
  items: GninaResult[];
  projectId: string;
}

type SortDirection = "asc" | "desc";

function getCnnScoreClass(score: number): string {
  if (score >= 0.8) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  if (score >= 0.5) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
  return "text-rose-500 bg-rose-500/10 border-rose-500/20";
}

export function GNINARankingTable({ items, projectId }: GNINARankingTableProps) {
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  const rows = useMemo(() => {
    const filtered = items.filter(
      (row) => row.molecule_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
      return sortDirection === "desc"
        ? b.cnn_score - a.cnn_score
        : a.cnn_score - b.cnn_score;
    });

    return sorted;
  }, [items, searchQuery, sortDirection]);

  return (
    <div className="ui-card-surface border border-border/40 overflow-hidden">
      <div className="p-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-text">Ranked Poses</h3>
          <p className="text-[10px] text-muted-text/60">CNN scored and filtered molecular poses</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search Molecule ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 px-3 text-xs bg-muted-bg/30 border border-border/40 rounded focus:border-accent outline-none text-text w-full sm:w-64"
          />
          <button
            onClick={() => setSortDirection(prev => prev === "desc" ? "asc" : "desc")}
            className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-text border border-border/40 rounded hover:bg-muted-bg transition-colors"
          >
            Sort {sortDirection === "desc" ? "↓" : "↑"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted-bg/30">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-text/60 border-b border-border/40">Molecule ID</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-text/60 border-b border-border/40">CNN Score</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-text/60 border-b border-border/40">CNN Affinity</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-text/60 border-b border-border/40">Vina Score</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-text/60 border-b border-border/40">Pose Evidence</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-text/60 border-b border-border/40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-text/50 italic">
                  No GNINA poses found matching the criteria.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={`${row.molecule_id}-${i}`} className="hover:bg-muted-bg/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-sm text-text">{row.molecule_id}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getCnnScoreClass(row.cnn_score)}`}>
                      {row.cnn_score.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text/80">{row.cnn_affinity.toFixed(2)} kcal/mol</td>
                  <td className="px-4 py-3 text-xs text-text/80">{row.vina_score.toFixed(2)} kcal/mol</td>
                  <td className="px-4 py-3 text-xs text-text/80 max-w-[200px] truncate">{row.pose_evidence}</td>
                  <td className="px-4 py-3 text-right">
                    <Link 
                      href={`/visualization?result_id=${row.molecule_id}&project_id=${projectId}&engine=gnina`}
                      className="inline-block px-3 py-1.5 bg-accent text-bg hover:bg-accent/90 transition-colors rounded text-[10px] font-black uppercase tracking-widest"
                    >
                      View Pose
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
