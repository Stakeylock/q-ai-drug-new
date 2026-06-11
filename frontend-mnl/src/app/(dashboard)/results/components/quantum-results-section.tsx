import type { ScoreBand, StabilityBand } from "./results-filter-types";
import { CsvDownloadButton } from "./csv-download-button";
import type { QuantumResult } from "@/types/api";
import { CardGridSkeleton, ResultsEmptyState } from "./results-state";
import { ProvenanceBadge } from "@/components/ui";
import { isDemoMode } from "@/services";

interface QuantumResultsSectionProps {
  items: QuantumResult[];
  searchQuery: string;
  scoreBand: ScoreBand;
  stabilityBand: StabilityBand;
  loading?: boolean;
}

function getInterpretationClass(label: string): string {
  if (label === "Highly Stable") {
    return "border-emerald-300/40 bg-emerald-500/15 text-emerald-100";
  }

  if (label === "Stable") {
    return "border-cyan-300/40 bg-cyan-500/15 text-cyan-100";
  }

  return "border-amber-300/40 bg-amber-500/15 text-amber-100";
}

function matchesSearch(candidate: QuantumResult, searchQuery: string): boolean {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return true;

  return [candidate.molecule_id, candidate.smiles].join(" ").toLowerCase().includes(normalized);
}

function formatNumber(value: number | undefined, digits: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }
  return value.toFixed(digits);
}

export function QuantumResultsSection({
  items,
  searchQuery,
  scoreBand,
  stabilityBand,
  loading = false,
}: QuantumResultsSectionProps) {
  if (loading) {
    return <CardGridSkeleton cards={6} />;
  }

  const sortedCandidates = [...items]
    .filter((candidate) => matchesSearch(candidate, searchQuery))
    .filter((candidate) => {
      const compositeScore =
        Number(candidate.homo_lumo_gap || 0) * 0.4 +
        Number(candidate.qsvm_score || 0) * 3 +
        Number(candidate.stability_score || 0) * 3;
      const scoreMatch =
        scoreBand === "all"
          ? true
          : scoreBand === "high"
            ? compositeScore >= 7.2
            : scoreBand === "medium"
              ? compositeScore >= 6.2 && compositeScore < 7.2
              : compositeScore < 6.2;

      const stabilityMatch =
        stabilityBand === "all"
          ? true
          : stabilityBand === "stable"
            ? candidate.interpretation === "Highly Stable"
            : stabilityBand === "moderate"
              ? candidate.interpretation === "Stable"
              : candidate.interpretation === "Monitor";

      return scoreMatch && stabilityMatch;
    })
    .sort((a, b) => {
      const aScore =
        Number(a.homo_lumo_gap || 0) * 0.4 +
        Number(a.qsvm_score || 0) * 3 +
        Number(a.stability_score || 0) * 3;
      const bScore =
        Number(b.homo_lumo_gap || 0) * 0.4 +
        Number(b.qsvm_score || 0) * 3 +
        Number(b.stability_score || 0) * 3;
      return bScore - aScore;
    });

  const csvRows = sortedCandidates.map((candidate) => ({
    "Molecule ID": candidate.molecule_id,
    Homo: formatNumber(candidate.homo, 3),
    Lumo: formatNumber(candidate.lumo, 3),
    Gap: candidate.homo_lumo_gap.toFixed(3),
    Stability: candidate.interpretation,
    "Prediction Uncertainty (SD)": candidate.uncertainty_score !== undefined ? candidate.uncertainty_score.toFixed(3) : "0.000",
    "Applicability Domain Violation": (candidate.applicability_domain?.is_ood === true || candidate.applicability_domain?.status === "OOD" || candidate.confidence_score === 0) ? "OOD" : "In-Domain",
    "Provenance Source": candidate.provenance?.source || candidate.source || "N/A",
    "Lineage Status": candidate.stale ? "STALE" : "VALID",
  }));

  if (sortedCandidates.length === 0) {
    return (
      <ResultsEmptyState
        title="No matching results"
        description="No quantum candidates match the current search or filters. Clear the filters or broaden the range to continue."
      />
    );
  }

  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Quantum Results</h2>
          <p className="mt-1 text-xs text-slate-400">Electronic energy levels, HOMO-LUMO gap, and QSVM stability classification.</p>
        </div>
        <div className="flex items-center gap-3">
          <ProvenanceBadge isDemo={isDemoMode()} items={items} />
          <p className="text-xs text-slate-400">Export current filtered table</p>
          <CsvDownloadButton
            filename="quantum-results.csv"
            columns={[
              "Molecule ID",
              "Homo",
              "Lumo",
              "Gap",
              "Stability",
              "Prediction Uncertainty (SD)",
              "Applicability Domain Violation",
              "Provenance Source",
              "Lineage Status",
            ]}
            rows={csvRows}
            disabled={csvRows.length === 0}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-slate-400">
              <th className="px-3 py-3 font-medium">Molecule ID</th>
              <th className="px-3 py-3 font-medium">Homo</th>
              <th className="px-3 py-3 font-medium">Lumo</th>
              <th className="px-3 py-3 font-medium">Gap</th>
              <th className="px-3 py-3 font-medium">Stability</th>
            </tr>
          </thead>
          <tbody>
            {sortedCandidates.map((candidate) => (
              <tr key={candidate.molecule_id} className="border-t border-white/10">
                <td className="px-3 py-3 font-mono text-xs text-slate-200">{candidate.molecule_id}</td>
                <td className="px-3 py-3 text-sm text-slate-200">{formatNumber(candidate.homo, 3)}</td>
                <td className="px-3 py-3 text-sm text-slate-200">{formatNumber(candidate.lumo, 3)}</td>
                <td className="px-3 py-3 text-sm text-slate-200">{candidate.homo_lumo_gap.toFixed(3)}</td>
                <td className="px-3 py-3 text-sm">
                  <span
                    className={[
                      "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                      getInterpretationClass(candidate.interpretation),
                    ].join(" ")}
                  >
                    {candidate.interpretation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
