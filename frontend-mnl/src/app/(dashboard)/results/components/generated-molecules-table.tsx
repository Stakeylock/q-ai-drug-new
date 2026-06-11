import { useEffect, useMemo, useState } from "react";

import { CsvDownloadButton } from "./csv-download-button";
import type { ScoreBand, StabilityBand } from "./results-filter-types";
import type { GeneratedMoleculeResult } from "@/types/api";
import { ResultsEmptyState, TableSkeleton } from "./results-state";

type SortKey = "molecule_id" | "smiles" | "molecular_weight" | "logp" | "qed";
type SortDirection = "asc" | "desc";

interface GeneratedMoleculesTableProps {
  items: GeneratedMoleculeResult[];
  searchQuery: string;
  scoreBand: ScoreBand;
  stabilityBand: StabilityBand;
  loading?: boolean;
}

const PAGE_SIZE = 8;

function formatNumber(value: number, digits: number = 2): string {
  return value.toFixed(digits);
}

function matchesSearch(molecule: GeneratedMoleculeResult, searchQuery: string): boolean {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return true;

  return [molecule.molecule_id, molecule.smiles].join(" ").toLowerCase().includes(normalized);
}

function matchesScoreBand(qed: number, scoreBand: ScoreBand): boolean {
  if (scoreBand === "all") return true;
  if (scoreBand === "high") return qed >= 0.75;
  if (scoreBand === "medium") return qed >= 0.68 && qed < 0.75;
  return qed < 0.68;
}

function calculateStabilityScore(molecule: GeneratedMoleculeResult): number {
  const logpWindow = molecule.logp >= 1 && molecule.logp <= 3.2 ? 0.18 : 0.08;
  return Math.min(1, molecule.qed * 0.65 + logpWindow);
}

function matchesStabilityBand(molecule: GeneratedMoleculeResult, stabilityBand: StabilityBand): boolean {
  if (stabilityBand === "all") return true;

  const stabilityScore = calculateStabilityScore(molecule);
  if (stabilityBand === "stable") return stabilityScore >= 0.72;
  if (stabilityBand === "moderate") return stabilityScore >= 0.58 && stabilityScore < 0.72;
  return stabilityScore < 0.58;
}

export function GeneratedMoleculesTable({
  items,
  searchQuery,
  scoreBand,
  stabilityBand,
  loading = false,
}: GeneratedMoleculesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("qed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [selectedMoleculeId, setSelectedMoleculeId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return items.filter(
      (molecule) =>
        matchesSearch(molecule, searchQuery) &&
        matchesScoreBand(molecule.qed, scoreBand) &&
        matchesStabilityBand(molecule, stabilityBand)
    );
  }, [items, scoreBand, searchQuery, stabilityBand]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const textCompare = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? textCompare : -textCompare;
    });
    return rows;
  }, [filteredRows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [page, sortedRows]);

  useEffect(() => {
    setPage(1);
    setSelectedMoleculeId(null);
  }, [searchQuery, scoreBand, stabilityBand]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const selectedMolecule = useMemo(
    () => sortedRows.find((molecule) => molecule.molecule_id === selectedMoleculeId) ?? null,
    [selectedMoleculeId, sortedRows]
  );

  const csvRows = useMemo(
    () =>
      pagedRows.map((molecule) => ({
        "Molecule ID": molecule.molecule_id,
        SMILES: molecule.smiles,
        "Molecular Weight": formatNumber(molecule.molecular_weight),
        LogP: formatNumber(molecule.logp),
        QED: formatNumber(molecule.qed, 3),
        "Prediction Uncertainty (SD)": molecule.uncertainty_score !== undefined ? molecule.uncertainty_score.toFixed(3) : "0.000",
        "Applicability Domain Violation": (molecule.applicability_domain?.is_ood === true || molecule.applicability_domain?.status === "OOD" || molecule.confidence_score === 0) ? "OOD" : "In-Domain",
        "Provenance Source": molecule.provenance?.source || molecule.source || "N/A",
        "Lineage Status": molecule.stale ? "STALE" : "VALID",
      })),
    [pagedRows]
  );

  if (items.length === 0) {
    return (
      <ResultsEmptyState description="Run the pipeline from Workspace to populate generated molecules and start review." />
    );
  }

  if (sortedRows.length === 0) {
    return (
      <ResultsEmptyState
        title="No matching results"
        description="Your current filters do not match any generated molecules. Clear filters or broaden the range to continue."
      />
    );
  }

  if (loading) {
    return <TableSkeleton columns={5} rows={6} />;
  }

  function onSort(nextKey: SortKey) {
    setPage(1);
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "molecule_id" || nextKey === "smiles" ? "asc" : "desc");
  }

  function onNextPage() {
    setPage((current) => Math.min(totalPages, current + 1));
  }

  function onPreviousPage() {
    setPage((current) => Math.max(1, current - 1));
  }

  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Generated Molecules</h2>
          <p className="mt-1 text-xs text-slate-400">
            Prioritized computational candidate compounds with predicted drug-like properties.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-400">Filtered by the global results controls above.</p>
          <CsvDownloadButton
            filename="generated-molecules.csv"
            columns={[
              "Molecule ID",
              "SMILES",
              "Molecular Weight",
              "LogP",
              "QED",
              "Prediction Uncertainty (SD)",
              "Applicability Domain Violation",
              "Provenance Source",
              "Lineage Status",
            ]}
            rows={csvRows}
            disabled={pagedRows.length === 0}
          />
        </div>
      </div>

      <div className="mt-4 overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-white/10 px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => onSort("molecule_id")}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-cyan-200"
                >
                  Molecule ID {sortKey === "molecule_id" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => onSort("smiles")}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-cyan-200"
                >
                  SMILES {sortKey === "smiles" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => onSort("molecular_weight")}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-cyan-200"
                >
                  Molecular Weight {sortKey === "molecular_weight" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => onSort("logp")}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-cyan-200"
                >
                  LogP {sortKey === "logp" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="border-b border-white/10 px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => onSort("qed")}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-cyan-200"
                >
                  QED {sortKey === "qed" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((molecule) => {
              const isSelected = selectedMoleculeId === molecule.molecule_id;
              return (
                <tr
                  key={molecule.molecule_id}
                  onClick={() => setSelectedMoleculeId(molecule.molecule_id)}
                  className={[
                    "cursor-pointer border-b border-white/5 transition",
                    isSelected ? "bg-cyan-400/15" : "odd:bg-white/[0.03] hover:bg-cyan-400/10",
                  ].join(" ")}
                >
                  <td className="px-3 py-2 font-medium text-cyan-100">{molecule.molecule_id}</td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-slate-200">{molecule.smiles}</td>
                  <td className="px-3 py-2 text-slate-200">{formatNumber(molecule.molecular_weight)}</td>
                  <td className="px-3 py-2 text-slate-200">{formatNumber(molecule.logp)}</td>
                  <td className="px-3 py-2 text-slate-200">{formatNumber(molecule.qed, 3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400">
          Showing {(page - 1) * PAGE_SIZE + (pagedRows.length > 0 ? 1 : 0)}-
          {(page - 1) * PAGE_SIZE + pagedRows.length} of {sortedRows.length}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={page === 1}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-slate-300">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={page === totalPages}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {selectedMolecule ? (
        <article className="mt-4 rounded-lg border border-cyan-300/30 bg-cyan-500/10 p-4">
          <h3 className="text-sm font-semibold text-cyan-100">Molecule Details</h3>
          <p className="mt-2 text-sm text-slate-100">ID: {selectedMolecule.molecule_id}</p>
          <p className="mt-1 text-sm text-slate-100">SMILES: {selectedMolecule.smiles}</p>
          <p className="mt-1 text-sm text-slate-100">
            Molecular Weight: {formatNumber(selectedMolecule.molecular_weight)}
          </p>
          <p className="mt-1 text-sm text-slate-100">LogP: {formatNumber(selectedMolecule.logp)}</p>
          <p className="mt-1 text-sm text-slate-100">QED: {formatNumber(selectedMolecule.qed, 3)}</p>
        </article>
      ) : null}
    </section>
  );
}
