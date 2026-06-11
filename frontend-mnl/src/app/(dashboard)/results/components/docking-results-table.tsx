import { useMemo, useState } from "react";

import { CsvDownloadButton } from "./csv-download-button";
import type { ScoreBand, StabilityBand } from "./results-filter-types";
import type { DockingResult } from "@/types/api";
import { ResultsEmptyState, TableSkeleton } from "./results-state";

type SortDirection = "asc" | "desc";

interface DockingResultsTableProps {
  items: DockingResult[];
  searchQuery: string;
  scoreBand: ScoreBand;
  stabilityBand: StabilityBand;
  loading?: boolean;
}

function getBindingClass(bindingAffinity: number): string {
  if (bindingAffinity <= -8) {
    return "border-emerald-300/40 bg-emerald-500/15 text-emerald-100";
  }

  if (bindingAffinity <= -6.5) {
    return "border-amber-300/40 bg-amber-500/15 text-amber-100";
  }

  return "border-rose-300/40 bg-rose-500/15 text-rose-100";
}

function formatAffinity(value: number): string {
  return `${value.toFixed(1)} kcal/mol`;
}

function getBindingLabel(bindingAffinity: number): string {
  if (bindingAffinity <= -8) return "Strong";
  if (bindingAffinity <= -6.5) return "Moderate";
  return "Weak";
}

function matchesSearch(row: DockingResult, searchQuery: string): boolean {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return true;

  return [row.molecule_id, row.target_protein].join(" ").toLowerCase().includes(normalized);
}

function matchesScoreBand(bindingAffinity: number, scoreBand: ScoreBand): boolean {
  if (scoreBand === "all") return true;
  if (scoreBand === "high") return bindingAffinity <= -8;
  if (scoreBand === "medium") return bindingAffinity <= -6.5 && bindingAffinity > -8;
  return bindingAffinity > -6.5;
}

function matchesStabilityBand(row: DockingResult, stabilityBand: StabilityBand): boolean {
  if (stabilityBand === "all") return true;
  if (stabilityBand === "stable") return row.binding_affinity <= -8 && (row.h_bonds ?? 0) >= 4;
  if (stabilityBand === "moderate") return row.binding_affinity <= -6.5 && row.binding_affinity > -8;
  return row.binding_affinity > -6.5 || (row.h_bonds ?? 0) <= 2;
}

export function DockingResultsTable({
  items,
  searchQuery,
  scoreBand,
  stabilityBand,
  loading = false,
}: DockingResultsTableProps) {
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const rows = useMemo(() => {
    const filtered = items.filter(
      (row) =>
        matchesSearch(row, searchQuery) &&
        matchesScoreBand(row.binding_affinity, scoreBand) &&
        matchesStabilityBand(row, stabilityBand)
    );

    const sorted = [...filtered].sort((a, b) => {
      return sortDirection === "asc"
        ? a.binding_affinity - b.binding_affinity
        : b.binding_affinity - a.binding_affinity;
    });

    return sorted;
  }, [items, scoreBand, searchQuery, stabilityBand, sortDirection]);

  const bestScore = rows[0]?.binding_affinity ?? 0;
  const csvRows = rows.map((row) => ({
    "Molecule ID": row.molecule_id,
    "Binding Affinity (kcal/mol)": row.binding_affinity.toFixed(1),
    "Number of H-bonds": row.h_bonds,
    "Target protein": row.target_protein,
    "Prediction Uncertainty (SD)": row.uncertainty_score !== undefined ? row.uncertainty_score.toFixed(3) : "0.000",
    "Applicability Domain Violation": (row.applicability_domain?.is_ood === true || row.applicability_domain?.status === "OOD" || row.confidence_score === 0) ? "OOD" : "In-Domain",
    "Provenance Source": row.provenance?.source || row.source || "N/A",
    "Lineage Status": row.stale ? "STALE" : "VALID",
  }));

  if (loading) {
    return <TableSkeleton columns={4} rows={6} />;
  }

  if (items.length === 0) {
    return (
      <ResultsEmptyState description="Run the pipeline from Workspace to generate docking scores and target annotations." />
    );
  }

  if (rows.length === 0) {
    return (
      <ResultsEmptyState
        title="No matching results"
        description="No docking rows match the current filters. Clear the filters or expand the score range to continue."
      />
    );
  }

  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Docking Results</h2>
          <p className="mt-1 text-xs text-slate-400">
            Predicted molecular binding affinity poses ordered by binding energy (kcal/mol).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CsvDownloadButton
            filename="docking-results.csv"
            columns={[
              "Molecule ID",
              "Binding Affinity (kcal/mol)",
              "Number of H-bonds",
              "Target protein",
              "Prediction Uncertainty (SD)",
              "Applicability Domain Violation",
              "Provenance Source",
              "Lineage Status",
            ]}
            rows={csvRows}
            disabled={rows.length === 0}
          />
          <button
            type="button"
            onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
            className="rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/10"
          >
            Sort by affinity {sortDirection === "asc" ? "ascending" : "descending"}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-auto transition-opacity duration-300">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Molecule ID
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Binding Affinity
                <button
                  type="button"
                  onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
                  className="ml-2 text-cyan-200 transition hover:text-cyan-100"
                  aria-label="Toggle affinity sort"
                >
                  {sortDirection === "asc" ? "↑" : "↓"}
                </button>
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Number of H-bonds
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Target protein
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isBest = row.binding_affinity === bestScore;
              const rankClass = index < 3 ? "bg-cyan-500/10" : "odd:bg-white/[0.03]";

              return (
                <tr key={`${row.molecule_id}-${row.target_protein}`} className={`${rankClass} border-b border-white/5`}>
                  <td className="px-3 py-2 font-medium text-cyan-100">
                    <div className="flex items-center gap-2">
                      <span>{row.molecule_id}</span>
                      {isBest ? (
                        <span className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
                          Best score
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${getBindingClass(row.binding_affinity)}`}>
                      {formatAffinity(row.binding_affinity)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-200">{row.h_bonds}</td>
                  <td className="px-3 py-2 text-slate-200">
                    <div className="flex items-center gap-2">
                      <span>{row.target_protein}</span>
                      <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                        {getBindingLabel(row.binding_affinity)} binding
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-slate-950/50 px-3 py-3 text-xs text-slate-400">
        More negative affinity values indicate stronger predicted binding. Rows in the top three are highlighted to make the strongest hits easy to scan.
      </div>
    </section>
  );
}
