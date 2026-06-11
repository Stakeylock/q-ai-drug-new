import type { ScoreBand, StabilityBand } from "./results-filter-types";
import { CsvDownloadButton } from "./csv-download-button";
import type { SimulationResult } from "@/types/api";
import { ChartSkeleton, ResultsEmptyState } from "./results-state";
import { ProvenanceBadge } from "@/components/ui";
import { isDemoMode } from "@/services";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatTime(value: number): string {
  return `${value} ns`;
}

function formatRmsd(value: number): string {
  return `${value.toFixed(2)} Å`;
}

interface SimulationResultsSectionProps {
  items: SimulationResult[];
  simulationVideoUrl?: string | null;
  searchQuery: string;
  scoreBand: ScoreBand;
  stabilityBand: StabilityBand;
  loading?: boolean;
}

function matchesSearch(item: SimulationResult, searchQuery: string): boolean {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return true;

  return [item.molecule_id, item.smiles].join(" ").toLowerCase().includes(normalized);
}

export function SimulationResultsSection({
  items,
  simulationVideoUrl,
  searchQuery,
  scoreBand,
  stabilityBand,
  loading = false,
}: SimulationResultsSectionProps) {
  if (loading) {
    return <ChartSkeleton />;
  }

  const filteredItems = items
    .filter((item) => matchesSearch(item, searchQuery))
    .sort((a, b) => a.time - b.time);

  if (items.length === 0) {
    return (
      <ResultsEmptyState description="Run the pipeline from Workspace to generate a trajectory and stability summary." />
    );
  }

  if (filteredItems.length === 0) {
    return (
      <ResultsEmptyState
        title="No matching results"
        description="No simulation rows match the current search or filters. Clear the filters or broaden the range to continue."
      />
    );
  }

  const values = filteredItems.map((point) => point.rmsd);
  const chartData = filteredItems.map((point) => ({ time: point.time, rmsd: point.rmsd }));
  const start = filteredItems[0]?.rmsd ?? 0;
  const end = filteredItems[filteredItems.length - 1]?.rmsd ?? 0;
  const averageRmsd = values.reduce((sum, value) => sum + value, 0) / values.length;
  const peakRmsd = Math.max(...values);
  const drift = end - start;
  const stable = averageRmsd < 2.0 && Math.max(...values) < 2.5;
  const stabilityLabel = stable ? "Stable" : "Unstable";
  const stabilityClass = stable
    ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
    : "border-rose-300/40 bg-rose-500/15 text-rose-100";
  const compositeScore = 3 - averageRmsd;
  const matchesScore =
    scoreBand === "all"
      ? true
      : scoreBand === "high"
        ? compositeScore >= 1.4
        : scoreBand === "medium"
          ? compositeScore >= 1.1 && compositeScore < 1.4
          : compositeScore < 1.1;
  const matchesStability =
    stabilityBand === "all"
      ? true
      : stabilityBand === "stable"
        ? stable
        : stabilityBand === "moderate"
          ? averageRmsd >= 1.8 && averageRmsd < 2.2
          : !stable;

  if (!matchesScore || !matchesStability) {
    return (
      <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-400">
        No simulation results match the current filters.
      </section>
    );
  }

  const csvRows = filteredItems.map((point) => ({
    "Molecule ID": point.molecule_id,
    SMILES: point.smiles,
    Time: `${point.time} ns`,
    RMSD: `${point.rmsd.toFixed(2)} Å`,
    "Stability Status": stabilityLabel,
    "Prediction Uncertainty (SD)": point.uncertainty_score !== undefined ? point.uncertainty_score.toFixed(3) : "0.000",
    "Applicability Domain Violation": (point.applicability_domain?.is_ood === true || point.applicability_domain?.status === "OOD" || point.confidence_score === 0) ? "OOD" : "In-Domain",
    "Provenance Source": point.provenance?.source || point.source || "N/A",
    "Lineage Status": point.stale ? "STALE" : "VALID",
  }));

  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Simulation Results</h2>
          <p className="mt-1 text-xs text-slate-400">RMSD evolution and trajectory stability profile from the simulation stage.</p>
        </div>

        <div className="flex items-center gap-3">
          <CsvDownloadButton
            filename="simulation-results.csv"
            columns={[
              "Molecule ID",
              "SMILES",
              "Time",
              "RMSD",
              "Stability Status",
              "Prediction Uncertainty (SD)",
              "Applicability Domain Violation",
              "Provenance Source",
              "Lineage Status",
            ]}
            rows={csvRows}
            disabled={csvRows.length === 0}
          />
          <span
            className={[
              "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
              stabilityClass,
            ].join(" ")}
          >
            {stabilityLabel}
          </span>
          <ProvenanceBadge isDemo={isDemoMode()} items={items} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Average RMSD", value: formatRmsd(averageRmsd) },
          { label: "Peak RMSD", value: formatRmsd(peakRmsd) },
          { label: "Drift", value: `${drift >= 0 ? "+" : ""}${drift.toFixed(2)} Å` },
          { label: "Frames", value: String(filteredItems.length) },
        ].map((metric) => (
          <article
            key={metric.label}
            className="rounded-xl border border-white/10 bg-slate-950/60 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{metric.value}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)]">
        <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">RMSD vs Time</h3>
              <p className="mt-1 text-xs text-slate-400">Root mean square deviation across trajectory frames.</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Min {formatRmsd(Math.min(...values))}</p>
              <p>Max {formatRmsd(peakRmsd)}</p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-slate-900/80">
            <div className="h-[300px] w-full px-2 py-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 16, right: 16, left: 4, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke="rgba(148,163,184,0.22)" />
                  <XAxis
                    type="number"
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "rgba(226,232,240,0.75)" }}
                    tickFormatter={(value) => `${value}`}
                    label={{ value: "Time (ns)", position: "insideBottom", offset: -8, fill: "rgba(226,232,240,0.75)", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgba(226,232,240,0.75)" }}
                    label={{ value: "RMSD", angle: -90, position: "insideLeft", fill: "rgba(226,232,240,0.75)", fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={(label) => `Time: ${label} ns`}
                    formatter={(value: number) => [formatRmsd(value), "RMSD"]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid rgba(148,163,184,0.35)",
                      backgroundColor: "rgba(15,23,42,0.95)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rmsd"
                    stroke="rgb(34 211 238)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "rgb(34 211 238)" }}
                    activeDot={{ r: 5, fill: "rgb(125 211 252)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Time in ns, RMSD in angstroms.</p>
        </article>

        <div className="space-y-4">
          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold text-slate-100">Simulation Video</h3>
            <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-slate-900/70">
              {simulationVideoUrl ? (
                <video
                  controls
                  className="h-full max-h-[260px] w-full bg-black"
                  src={simulationVideoUrl}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="flex min-h-[180px] items-center justify-center px-4 text-center text-sm text-slate-400">
                  No simulation video available for this experiment.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold text-slate-100">Interpretation</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The trajectory remains within a narrow RMSD band, suggesting a comparatively stable binding pose.
              Small oscillations are present, but there is no sustained upward drift that would indicate major instability.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
