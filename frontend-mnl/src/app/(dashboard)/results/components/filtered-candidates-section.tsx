import { CsvDownloadButton } from "./csv-download-button";
import type { ScoreBand, StabilityBand } from "./results-filter-types";
import { CardGridSkeleton, ResultsEmptyState } from "./results-state";

type DataRow = Record<string, string | number>;

interface CandidateCard {
  moleculeId: string;
  smiles: string;
  qed: number;
  toxicityStatus: "Safe" | "Monitor" | "Risk";
  drugLikenessScore: number;
  selectionScore: number;
  reasons: string[];
  uncertaintyScore?: number;
  isOod?: boolean;
  provenanceSource?: string;
  stale?: boolean;
}

interface FilteredCandidatesSectionProps {
  rows: DataRow[];
  searchQuery: string;
  scoreBand: ScoreBand;
  stabilityBand: StabilityBand;
  loading?: boolean;
}

const ID_KEYS = ["molecule_id", "candidate_id", "id", "name"];
const SMILES_KEYS = ["smiles", "canonical_smiles", "structure"];
const QED_KEYS = ["qed", "qed_score"];
const DRUG_LIKENESS_KEYS = ["drug_likeness", "drug_likeness_score", "druglikeness", "dl_score"];
const TOXICITY_KEYS = ["toxicity_status", "toxicity", "tox_status", "safety"];

const MAX_CARDS = 8;

function findValue(row: DataRow, keys: string[]): string | number | undefined {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }
  }

  return undefined;
}

function normalizeScore(rawValue: number | undefined): number {
  if (rawValue === undefined || Number.isNaN(rawValue)) return 0;
  if (rawValue > 1) return Math.min(1, rawValue / 100);
  if (rawValue < 0) return 0;
  return rawValue;
}

function toNumber(value: string | number | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function toDisplay(value: string | number | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  return String(value);
}

function inferToxicityStatus(
  rawValue: string | number | undefined,
  qed: number,
  drugLikenessScore: number
): "Safe" | "Monitor" | "Risk" {
  if (typeof rawValue === "string") {
    const lower = rawValue.toLowerCase();
    if (lower.includes("safe") || lower.includes("low")) return "Safe";
    if (lower.includes("high") || lower.includes("toxic") || lower.includes("risk")) return "Risk";
    return "Monitor";
  }

  const toxicityNumeric = toNumber(rawValue);
  if (toxicityNumeric !== undefined) {
    if (toxicityNumeric <= 0.33) return "Safe";
    if (toxicityNumeric >= 0.67) return "Risk";
    return "Monitor";
  }

  if (qed >= 0.75 && drugLikenessScore >= 0.7) return "Safe";
  if (qed < 0.55 || drugLikenessScore < 0.5) return "Risk";
  return "Monitor";
}

function deriveDrugLikenessScore(row: DataRow, qed: number): number {
  const rawDrugLikeness = toNumber(findValue(row, DRUG_LIKENESS_KEYS));
  if (rawDrugLikeness !== undefined) {
    return normalizeScore(rawDrugLikeness);
  }

  const logp = toNumber(row.logp);
  const logpBonus = logp !== undefined && logp >= 1 && logp <= 3.5 ? 0.15 : 0.05;
  return Math.min(0.95, Math.max(0.25, qed * 0.8 + logpBonus));
}

function buildReasonList(
  qed: number,
  toxicityStatus: "Safe" | "Monitor" | "Risk",
  drugLikenessScore: number
): string[] {
  const reasons: string[] = [];

  if (qed >= 0.75) {
    reasons.push(`High QED (${qed.toFixed(3)}) indicates strong medicinal quality.`);
  } else if (qed >= 0.65) {
    reasons.push(`QED (${qed.toFixed(3)}) is above baseline screening threshold.`);
  } else {
    reasons.push(`QED (${qed.toFixed(3)}) retained due to complementary profile strength.`);
  }

  if (toxicityStatus === "Safe") {
    reasons.push("Toxicity profile marked Safe for progression.");
  } else if (toxicityStatus === "Monitor") {
    reasons.push("Toxicity profile requires targeted monitoring in downstream assays.");
  } else {
    reasons.push("Toxicity risk is elevated but candidate retained as a comparison lead.");
  }

  if (drugLikenessScore >= 0.75) {
    reasons.push("Drug-likeness score is high and supports candidate viability.");
  } else if (drugLikenessScore >= 0.6) {
    reasons.push("Drug-likeness score is acceptable for optimization workflows.");
  } else {
    reasons.push("Drug-likeness is moderate and may require structural refinement.");
  }

  return reasons;
}

function buildCandidateCards(rows: DataRow[]): CandidateCard[] {
  return rows
    .map((row, index) => {
      const rowAny = row as any;
      const moleculeId = toDisplay(findValue(row, ID_KEYS), `Candidate-${index + 1}`);
      const smiles = toDisplay(findValue(row, SMILES_KEYS), "SMILES not available");
      const qed = normalizeScore(toNumber(findValue(row, QED_KEYS)) ?? 0.62);
      const drugLikenessScore = deriveDrugLikenessScore(row, qed);
      const toxicityStatus = inferToxicityStatus(findValue(row, TOXICITY_KEYS), qed, drugLikenessScore);
      const safetyBonus = toxicityStatus === "Safe" ? 0.12 : toxicityStatus === "Monitor" ? 0.05 : 0;
      const selectionScore = qed * 0.55 + drugLikenessScore * 0.33 + safetyBonus;
      const uncertaintyScore = rowAny.uncertainty_score !== undefined ? toNumber(rowAny.uncertainty_score) : undefined;
      const isOod = rowAny.is_ood === true || rowAny.is_ood === "true" || rowAny.applicability_domain_violation === true || rowAny.applicability_domain_violation === "true" || rowAny.overall_risk === "high" || rowAny.applicability_domain?.is_ood === true || rowAny.applicability_domain?.status === "OOD";
      const provenanceSource = String(rowAny.provenance_source || rowAny.source || rowAny.provenance?.source || "N/A");
      const stale = rowAny.stale === true || rowAny.stale === "true";

      return {
        moleculeId,
        smiles,
        qed,
        toxicityStatus,
        drugLikenessScore,
        selectionScore,
        reasons: buildReasonList(qed, toxicityStatus, drugLikenessScore),
        uncertaintyScore,
        isOod,
        provenanceSource,
        stale,
      };
    })
    .sort((a, b) => b.selectionScore - a.selectionScore)
    .slice(0, MAX_CARDS);
}

function matchesSearch(row: DataRow, searchQuery: string): boolean {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return true;

  return Object.values(row)
    .map((value) => String(value).toLowerCase())
    .join(" ")
    .includes(normalized);
}

function matchesScoreBand(selectionScore: number, scoreBand: ScoreBand): boolean {
  if (scoreBand === "all") return true;
  if (scoreBand === "high") return selectionScore >= 0.8;
  if (scoreBand === "medium") return selectionScore >= 0.65 && selectionScore < 0.8;
  return selectionScore < 0.65;
}

function matchesStabilityBand(toxicityStatus: CandidateCard["toxicityStatus"], stabilityBand: StabilityBand): boolean {
  if (stabilityBand === "all") return true;
  if (stabilityBand === "stable") return toxicityStatus === "Safe";
  if (stabilityBand === "moderate") return toxicityStatus === "Monitor";
  return toxicityStatus === "Risk";
}

function getToxicityBadgeClass(status: "Safe" | "Monitor" | "Risk"): string {
  if (status === "Safe") {
    return "border-emerald-300/40 bg-emerald-500/20 text-emerald-100";
  }
  if (status === "Monitor") {
    return "border-amber-300/40 bg-amber-500/20 text-amber-100";
  }
  return "border-rose-300/40 bg-rose-500/20 text-rose-100";
}

export function FilteredCandidatesSection({
  rows,
  searchQuery,
  scoreBand,
  stabilityBand,
  loading = false,
}: FilteredCandidatesSectionProps) {
  if (loading) {
    return <CardGridSkeleton cards={6} />;
  }

  const cards = buildCandidateCards(rows.filter((row) => matchesSearch(row, searchQuery))).filter(
    (candidate) => matchesScoreBand(candidate.selectionScore, scoreBand) && matchesStabilityBand(candidate.toxicityStatus, stabilityBand)
  );
  const csvRows = cards.map((candidate) => ({
    "Molecule ID": candidate.moleculeId,
    SMILES: candidate.smiles,
    QED: candidate.qed.toFixed(3),
    "Toxicity Status": candidate.toxicityStatus,
    "Drug-Likeness Score": candidate.drugLikenessScore.toFixed(3),
    "Selection Score": candidate.selectionScore.toFixed(3),
    "Prediction Uncertainty (SD)": candidate.uncertaintyScore !== undefined ? candidate.uncertaintyScore.toFixed(3) : "0.000",
    "Applicability Domain Violation": candidate.isOod ? "OOD" : "In-Domain",
    "Provenance Source": candidate.provenanceSource || "N/A",
    "Lineage Status": candidate.stale ? "STALE" : "VALID",
  }));

  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Filtered Candidates</h2>
          <p className="mt-1 text-xs text-slate-400">
            Top molecules selected by balanced quality, safety profile, and drug-likeness readiness.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-400">Top {cards.length} after filtering</p>
          <CsvDownloadButton
            filename="filtered-candidates.csv"
            columns={[
              "Molecule ID",
              "SMILES",
              "QED",
              "Toxicity Status",
              "Drug-Likeness Score",
              "Selection Score",
              "Prediction Uncertainty (SD)",
              "Applicability Domain Violation",
              "Provenance Source",
              "Lineage Status",
            ]}
            rows={csvRows}
            disabled={cards.length === 0}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <ResultsEmptyState description="Run the pipeline from Workspace to generate filtered candidate summaries." />
      ) : cards.length === 0 ? (
        <ResultsEmptyState
          title="No matching results"
          description="No filtered candidates match the current search or filters. Clear the filters or broaden the range to continue."
        />
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((candidate, index) => {
            const isTop = index < 3;

            return (
              <article
                key={candidate.moleculeId}
                className={[
                  "rounded-xl border p-4",
                  isTop
                    ? "border-cyan-300/40 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
                    : "border-white/10 bg-slate-950/60",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{candidate.moleculeId}</p>
                    <p className="mt-1 max-w-[28ch] truncate text-xs text-slate-400">{candidate.smiles}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isTop ? (
                      <span className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
                        Top {index + 1}
                      </span>
                    ) : null}
                    {candidate.qed >= 0.75 ? (
                      <span className="rounded-full border border-indigo-300/40 bg-indigo-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-100">
                        High QED
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">QED</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{candidate.qed.toFixed(3)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Drug-Likeness</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">
                      {candidate.drugLikenessScore.toFixed(3)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Selection Score</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{candidate.selectionScore.toFixed(3)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={[
                      "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                      getToxicityBadgeClass(candidate.toxicityStatus),
                    ].join(" ")}
                  >
                    {candidate.toxicityStatus}
                  </span>
                  {candidate.toxicityStatus === "Safe" ? (
                    <span className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                      Safe
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                    Why Selected
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-200">
                    {candidate.reasons.map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
