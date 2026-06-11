import { useMemo, useState } from "react";

import { CsvDownloadButton } from "./csv-download-button";
import type { ScoreBand, StabilityBand } from "./results-filter-types";
import type { GninaResult } from "@/types/api";
import { ResultsEmptyState, TableSkeleton } from "./results-state";

type SortDirection = "asc" | "desc";

interface GninaResultsTableProps {
  items: GninaResult[];
  searchQuery: string;
  scoreBand: ScoreBand;
  stabilityBand: StabilityBand;
  loading?: boolean;
}

function getCnnScoreClass(score: number): string {
  if (score >= 0.8) {
    return "border-emerald-300/40 bg-emerald-500/15 text-emerald-100";
  }

  if (score >= 0.5) {
    return "border-amber-300/40 bg-amber-500/15 text-amber-100";
  }

  return "border-rose-300/40 bg-rose-500/15 text-rose-100";
}

function formatScore(value: number): string {
  return value.toFixed(3);
}

function formatAffinity(value: number): string {
  return `${value.toFixed(1)} kcal/mol`;
}

function getConfidenceLabel(score: number): string {
  if (score >= 0.8) return "High";
  if (score >= 0.5) return "Moderate";
  return "Low";
}

function matchesSearch(row: GninaResult, searchQuery: string): boolean {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return true;

  return [row.molecule_id, row.pose_evidence].join(" ").toLowerCase().includes(normalized);
}

function matchesScoreBand(cnnScore: number, scoreBand: ScoreBand): boolean {
  if (scoreBand === "all") return true;
  if (scoreBand === "high") return cnnScore >= 0.8;
  if (scoreBand === "medium") return cnnScore >= 0.5 && cnnScore < 0.8;
  return cnnScore < 0.5;
}

function matchesStabilityBand(row: GninaResult, stabilityBand: StabilityBand): boolean {
  if (stabilityBand === "all") return true;
  if (stabilityBand === "stable") return row.cnn_affinity <= -8 && row.cnn_score >= 0.8;
  if (stabilityBand === "moderate") return row.cnn_affinity <= -6.5 && row.cnn_affinity > -8;
  return row.cnn_affinity > -6.5;
}

export function GninaResultsTable({
  items,
  searchQuery,
  scoreBand,
  stabilityBand,
  loading = false,
}: GninaResultsTableProps) {
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const rows = useMemo(() => {
    const filtered = items.filter(
      (row) =>
        matchesSearch(row, searchQuery) &&
        matchesScoreBand(row.cnn_score, scoreBand) &&
        matchesStabilityBand(row, stabilityBand)
    );

    const sorted = [...filtered].sort((a, b) => {
      return sortDirection === "desc"
        ? b.cnn_score - a.cnn_score
        : a.cnn_score - b.cnn_score;
    });

    return sorted;
  }, [items, scoreBand, searchQuery, stabilityBand, sortDirection]);

  const bestScore = rows[0]?.cnn_score ?? 0;
  const csvRows = rows.map((row) => ({
    "Molecule ID": row.molecule_id,
    "CNN Score": row.cnn_score.toFixed(3),
    "CNN Affinity (kcal/mol)": row.cnn_affinity.toFixed(1),
    "Vina Score (kcal/mol)": row.vina_score.toFixed(1),
    "Pose Evidence": row.pose_evidence,
  }));

  if (loading) {
    return <TableSkeleton columns={5} rows={6} />;
  }

  if (items.length === 0) {
    return (
      <ResultsEmptyState description="Run the pipeline from Workspace to generate GNINA scores and pose evidence." />
    );
  }

  if (rows.length === 0) {
    return (
      <ResultsEmptyState
        title="No matching results"
        description="No GNINA rows match the current filters. Clear the filters or expand the score range to continue."
      />
    );
  }

  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">GNINA Rescoring Results</h2>
          <p className="mt-1 text-xs text-slate-400">
            Predicted molecular binding affinity poses re-scored using GNINA CNN engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CsvDownloadButton
            filename="gnina-results.csv"
            columns={[
              "Molecule ID",
              "CNN Score",
              "CNN Affinity (kcal/mol)",
              "Vina Score (kcal/mol)",
              "Pose Evidence",
            ]}
            rows={csvRows}
            disabled={rows.length === 0}
          />
          <button
            type="button"
            onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
            className="rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/10"
          >
            Sort by CNN score {sortDirection === "desc" ? "descending" : "ascending"}
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
                CNN Score
                <button
                  type="button"
                  onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
                  className="ml-2 text-cyan-200 transition hover:text-cyan-100"
                  aria-label="Toggle cnn score sort"
                >
                  {sortDirection === "desc" ? "↓" : "↑"}
                </button>
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                CNN Affinity
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Vina Score
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pose Evidence
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isBest = row.cnn_score === bestScore;
              const rankClass = index < 3 ? "bg-cyan-500/10" : "odd:bg-white/[0.03]";

              return (
                <tr key={`${row.molecule_id}-${index}`} className={`${rankClass} border-b border-white/5`}>
                  <td className="px-3 py-2 font-medium text-cyan-100">
                    <div className="flex items-center gap-2">
                      <span>{row.molecule_id}</span>
                      {isBest ? (
                        <span className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
                          Best confidence
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${getCnnScoreClass(row.cnn_score)}`}>
                      {formatScore(row.cnn_score)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-200">{formatAffinity(row.cnn_affinity)}</td>
                  <td className="px-3 py-2 text-slate-200">{formatAffinity(row.vina_score)}</td>
                  <td className="px-3 py-2 text-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[150px]">{row.pose_evidence}</span>
                      <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                        {getConfidenceLabel(row.cnn_score)}
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
        Higher CNN scores indicate higher confidence in the predicted pose. Rows in the top three are highlighted to make the most confident poses easy to identify.
      </div>
    </section>
  );
}
