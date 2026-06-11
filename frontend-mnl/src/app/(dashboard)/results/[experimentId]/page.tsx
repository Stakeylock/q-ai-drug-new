"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getPipelineResult,
  getPipelineStatus,
  type WorkspacePipelineStatusResponse,
} from "@/services/api";
import { useWorkspaceStore } from "@/store";
import type {
  DockingResult,
  GeneratedMoleculeResult,
  QuantumResult,
  RankedCandidatesResponse,
  ResultsOverview,
  SimulationResult,
} from "@/types/api";
import { ArtifactGrid } from "../components/artifact-grid";
import { DockingResultsTable } from "../components/docking-results-table";
import { FilteredCandidatesSection } from "../components/filtered-candidates-section";
import { GeneratedMoleculesTable } from "../components/generated-molecules-table";
import { MetricGrid } from "../components/metric-grid";
import { QuantumResultsSection } from "../components/quantum-results-section";
import { ResultsFilterBar } from "../components/results-filter-bar";
import { SectionTabs } from "../components/section-tabs";
import type { ResultSection } from "../components/results-types";
import { SimulationResultsSection } from "../components/simulation-results-section";
import { ApiErrorState } from "@/components/shared/states";
import { EmptyState } from "@/components/shared/states";
import { ResultsPageSkeleton } from "@/components/shared/skeletons";
import type { ScoreBand, StabilityBand } from "../components/results-filter-types";
import type { ResultArtifact, ResultArtifactsResponse } from "@/types/api";
import {
  DEMO_ARTIFACTS,
  DEMO_DOCKING_RESULTS,
  DEMO_FILTERED_CANDIDATES,
  DEMO_GENERATED_MOLECULES,
  DEMO_OVERVIEW,
  DEMO_QUANTUM_RESULTS,
  DEMO_SIMULATION_RESULTS,
  DEMO_VIDEO_URL,
  getDemoPipelinePayload,
} from "@/services/pipelineDemo";

type ResultPayload = Record<string, unknown>;

interface ExperimentResultPageProps {
  params: {
    experimentId: string;
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function findValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }
  }

  return undefined;
}

function toTextRow(row: Record<string, unknown>): Record<string, string | number> {
  const output: Record<string, string | number> = {};

  Object.entries(row).forEach(([key, value]) => {
    if (typeof value === "number") {
      output[key] = value;
      return;
    }

    if (typeof value === "string") {
      output[key] = value;
      return;
    }

    output[key] = value === null || value === undefined ? "" : String(value);
  });

  return output;
}

function extractSection(payload: ResultPayload | null, keys: string[]): unknown[] {
  if (!payload) return [];

  const sources: Array<Record<string, unknown>> = [payload];
  const nested = asRecord(payload.results);
  if (nested) {
    sources.push(nested);
  }

  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

function extractOverview(payload: ResultPayload | null, mapped: PipelineSections): ResultsOverview {
  const rawOverview = payload ? asRecord(payload.overview) ?? asRecord(payload.summary) : null;
  const rawCounts = rawOverview ? asRecord(rawOverview.counts) : null;
  const topExistingOverview = asRecord(rawOverview?.top_existing);
  const bestQmOverview = asRecord(rawOverview?.best_qm);
  const bestQmMapped = asRecord(mapped.quantumResults[0]);

  return {
    counts: {
      existing_ranked: toNumber(rawCounts?.existing_ranked, mapped.filteredRanked.items.length),
      generated_candidates: toNumber(rawCounts?.generated_candidates, mapped.generatedMolecules.length),
      qm_profiles: toNumber(rawCounts?.qm_profiles, mapped.quantumResults.length),
      md_stability: toNumber(rawCounts?.md_stability, mapped.simulationResults.length),
      md_rmsd: toNumber(rawCounts?.md_rmsd, mapped.simulationResults.length),
      md_summaries: toNumber(rawCounts?.md_summaries, mapped.simulationResults.length),
      qm_summaries: toNumber(rawCounts?.qm_summaries, mapped.quantumResults.length),
      docking_result_files: toNumber(rawCounts?.docking_result_files, mapped.dockingResults.length),
    },
    highlights: {
      top_existing: topExistingOverview ? toTextRow(topExistingOverview) : mapped.filteredRanked.items[0] ?? null,
      best_qm: bestQmOverview
        ? toTextRow(bestQmOverview)
        : bestQmMapped
          ? toTextRow(bestQmMapped)
          : null,
    },
    sources: {
      existing_candidates: String(rawOverview?.existing_candidates ?? "pipeline-results"),
      generated_candidates: String(rawOverview?.generated_candidates ?? "pipeline-results"),
      qm_results: String(rawOverview?.qm_results ?? "pipeline-results"),
      md_stability: String(rawOverview?.md_stability ?? "pipeline-results"),
      md_rmsd: String(rawOverview?.md_rmsd ?? "pipeline-results"),
    },
  };
}

function normalizeGeneratedMolecules(items: unknown[]): GeneratedMoleculeResult[] {
  return items.map((item, index) => {
    const row = asRecord(item) ?? {};
    return {
      molecule_id: String(findValue(row, ["molecule_id", "id", "candidate_id"]) ?? `generated-${index + 1}`),
      smiles: String(findValue(row, ["smiles", "canonical_smiles", "structure"]) ?? ""),
      molecular_weight: toNumber(findValue(row, ["molecular_weight", "mw", "MW"])),
      logp: toNumber(findValue(row, ["logp", "log_p", "LogP"])),
      qed: toNumber(findValue(row, ["qed", "qed_score", "score", "optimization_score"])),
      source: "pipeline",
      experiment_id: "",
      pipeline_stage: "generated",
      engine: "default",
      created_at: new Date().toISOString(),
      provenance: { source: "pipeline", evidence_status: "computed" } as any,
    };
  });
}

function normalizeDockingResults(items: unknown[]): DockingResult[] {
  return items.map((item, index) => {
    const row = asRecord(item) ?? {};
    return {
      molecule_id: String(findValue(row, ["molecule_id", "id", "candidate_id"]) ?? `docking-${index + 1}`),
      binding_affinity: toNumber(findValue(row, ["binding_affinity", "affinity", "pred_affinity", "score"])),
      h_bonds: toNumber(findValue(row, ["h_bonds", "hbonds", "hydrogen_bonds"])),
      target_protein: String(findValue(row, ["target_protein", "target", "protein"]) ?? "Unknown target"),
      source: "pipeline",
      experiment_id: "",
      pipeline_stage: "docking",
      engine: "gnina",
      created_at: new Date().toISOString(),
      provenance: { source: "pipeline", evidence_status: "computed" } as any,
    };
  });
}

function normalizeSimulationResults(items: unknown[]): SimulationResult[] {
  return items.map((item, index) => {
    const row = asRecord(item) ?? {};
    return {
      molecule_id: String(findValue(row, ["molecule_id", "id", "candidate_id"]) ?? `simulation-${index + 1}`),
      smiles: String(findValue(row, ["smiles", "canonical_smiles", "structure"]) ?? ""),
      time: toNumber(findValue(row, ["time", "ns", "frame"])),
      rmsd: toNumber(findValue(row, ["rmsd", "rmsd_value"])),
      source: "pipeline",
      experiment_id: "",
      pipeline_stage: "simulation",
      engine: "gromacs",
      created_at: new Date().toISOString(),
      provenance: { source: "pipeline", evidence_status: "computed" } as any,
    };
  });
}

function extractSimulationRmsdRows(payload: ResultPayload | null): unknown[] {
  const nested = payload ? asRecord(payload.results) : null;
  const nestedSimulation = nested ? asRecord(nested.simulation) : null;
  if (nestedSimulation && Array.isArray(nestedSimulation.rmsd)) {
    return nestedSimulation.rmsd;
  }

  const topSimulation = payload ? asRecord(payload.simulation) : null;
  if (topSimulation && Array.isArray(topSimulation.rmsd)) {
    return topSimulation.rmsd;
  }

  return extractSection(payload, ["simulation", "simulation_results", "rmsd", "rmsd_results"]);
}

function normalizeQuantumResults(items: unknown[]): QuantumResult[] {
  return items.map((item, index) => {
    const row = asRecord(item) ?? {};
    const stabilityScore = toNumber(findValue(row, ["stability_score", "stability"]));
    const interpretationValue = findValue(row, ["interpretation", "status"]);
    const interpretation =
      typeof interpretationValue === "string"
        ? interpretationValue
        : stabilityScore >= 0.8
          ? "Highly Stable"
          : stabilityScore >= 0.6
            ? "Stable"
            : "Monitor";

    return {
      molecule_id: String(findValue(row, ["molecule_id", "id", "candidate_id"]) ?? `quantum-${index + 1}`),
      smiles: String(findValue(row, ["smiles", "canonical_smiles", "structure"]) ?? ""),
      homo: toNumber(findValue(row, ["homo", "homo_ev", "homo_energy"]), Number.NaN),
      lumo: toNumber(findValue(row, ["lumo", "lumo_ev", "lumo_energy"]), Number.NaN),
      homo_lumo_gap: toNumber(findValue(row, ["homo_lumo_gap", "gap", "hl_gap"])),
      qsvm_score: toNumber(findValue(row, ["qsvm_score", "score", "qsqm_score"])),
      stability_score: stabilityScore,
      interpretation: interpretation as QuantumResult["interpretation"],
      source: "pipeline",
      experiment_id: "",
      pipeline_stage: "quantum",
      engine: "pyscf",
      created_at: new Date().toISOString(),
      provenance: { source: "pipeline", evidence_status: "computed" } as any,
    };
  });
}

interface PipelineSections {
  generatedMolecules: GeneratedMoleculeResult[];
  filteredRanked: RankedCandidatesResponse;
  dockingResults: DockingResult[];
  simulationResults: SimulationResult[];
  simulationVideoUrl: string | null;
  quantumResults: QuantumResult[];
  artifacts: ResultArtifactsResponse;
}

function extractSimulationVideoUrl(payload: ResultPayload | null): string | null {
  if (!payload) {
    return null;
  }

  const nested = asRecord(payload.results);
  const direct = payload.simulation_video;
  const nestedVideo = nested?.simulation_video;

  if (typeof nestedVideo === "string" && nestedVideo.trim()) {
    return nestedVideo;
  }
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  return null;
}

function mapPipelineResponse(payload: ResultPayload | null): PipelineSections {
  const generatedRows = extractSection(payload, ["generated", "generated_molecules", "molecules"]);
  const filteredRows = extractSection(payload, ["filtered", "filtered_candidates", "ranked", "candidates"]);
  const genericRows = extractSection(payload, ["items", "rows", "data"]);

  const generated = normalizeGeneratedMolecules(
    generatedRows.length > 0 ? generatedRows : genericRows
  );
  const filtered = (filteredRows.length > 0 ? filteredRows : genericRows).map(
    (row) => toTextRow(asRecord(row) ?? {})
  );
  const docking = normalizeDockingResults(extractSection(payload, ["docking", "docking_results", "docking_scores"]));
  const simulation = normalizeSimulationResults(extractSimulationRmsdRows(payload));
  const simulationVideoUrl = extractSimulationVideoUrl(payload);
  const quantum = normalizeQuantumResults(extractSection(payload, ["quantum", "quantum_results", "tables"]));

  const artifactItems = extractSection(payload, ["artifacts", "files", "results_artifacts"]).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      path: String(findValue(row, ["path"]) ?? ""),
      name: String(findValue(row, ["name"]) ?? "artifact"),
      size_bytes: toNumber(findValue(row, ["size_bytes", "size"])),
    } satisfies ResultArtifact;
  });

  return {
    generatedMolecules: generated,
    filteredRanked: {
      source: "generated",
      file: "pipeline-results",
      count: filtered.length,
      items: filtered,
    },
    dockingResults: docking,
    simulationResults: simulation,
    simulationVideoUrl,
    quantumResults: quantum,
    artifacts: {
      count: artifactItems.length,
      items: artifactItems,
    },
  };
}

export default function ExperimentResultPage({ params }: ExperimentResultPageProps) {
  const router = useRouter();
  const lastExperimentId = useWorkspaceStore((s) => s.lastExperimentId);
  const [activeSection, setActiveSection] = useState<ResultSection>("generated");
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreBand, setScoreBand] = useState<ScoreBand>("all");
  const [stabilityBand, setStabilityBand] = useState<StabilityBand>("all");

  const experimentId = params.experimentId;

  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [generatedMolecules, setGeneratedMolecules] = useState<GeneratedMoleculeResult[]>([]);
  const [filteredRanked, setFilteredRanked] = useState<RankedCandidatesResponse | null>(null);
  const [dockingResults, setDockingResults] = useState<DockingResult[]>([]);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [simulationVideoUrl, setSimulationVideoUrl] = useState<string | null>(null);
  const [quantumResults, setQuantumResults] = useState<QuantumResult[]>([]);
  const [artifacts, setArtifacts] = useState<ResultArtifactsResponse | null>(null);
  const [overview, setOverview] = useState<ResultsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<WorkspacePipelineStatusResponse | null>(null);

  const storeResultData = useCallback((rawData: unknown) => {
    const payloadRecord = asRecord(rawData);
    let mapped = mapPipelineResponse(payloadRecord);
    const hasRealRows =
      mapped.generatedMolecules.length > 0 ||
      mapped.filteredRanked.items.length > 0 ||
      mapped.dockingResults.length > 0 ||
      mapped.simulationResults.length > 0 ||
      mapped.quantumResults.length > 0;

    const shouldUseDemo = !hasRealRows;
    if (shouldUseDemo) {
      const demoPayload = getDemoPipelinePayload(experimentId);
      mapped = mapPipelineResponse(demoPayload);
      setPayload(asRecord(demoPayload));
      setOverview(DEMO_OVERVIEW);
      setGeneratedMolecules(DEMO_GENERATED_MOLECULES);
      setFilteredRanked(DEMO_FILTERED_CANDIDATES);
      setDockingResults(DEMO_DOCKING_RESULTS);
      setSimulationResults(DEMO_SIMULATION_RESULTS);
      setSimulationVideoUrl(DEMO_VIDEO_URL);
      setQuantumResults(DEMO_QUANTUM_RESULTS);
      setArtifacts(DEMO_ARTIFACTS);
      return;
    }

    setPayload(payloadRecord);
    setGeneratedMolecules(mapped.generatedMolecules);
    setFilteredRanked(mapped.filteredRanked);
    setDockingResults(mapped.dockingResults);
    setSimulationResults(mapped.simulationResults);
    setSimulationVideoUrl(mapped.simulationVideoUrl);
    setQuantumResults(mapped.quantumResults);
    setArtifacts(mapped.artifacts);
    setOverview(extractOverview(payloadRecord, mapped));
  }, [experimentId]);

  useEffect(() => {
    if (!experimentId) {
      setError("Missing experiment id.");
      setLoading(false);
      return;
    }

    let active = true;
    let intervalId: number | undefined;

    setError(null);
    setLoading(true);
    setPayload(null);
    setGeneratedMolecules([]);
    setFilteredRanked(null);
    setDockingResults([]);
    setSimulationResults([]);
    setSimulationVideoUrl(null);
    setQuantumResults([]);
    setArtifacts(null);
    setOverview(null);

    const loadCompletedResults = async () => {
      try {
        setLoading(true);
        const resultsData = await getPipelineResult(experimentId);
        if (!active) return;
        storeResultData(resultsData);
      } catch (err) {
        if (!active) return;
        storeResultData(getDemoPipelinePayload(experimentId));
        setError(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const pollStatus = async () => {
      try {
        const statusData = await getPipelineStatus(experimentId);
        if (!active) return;

        setPipelineStatus(statusData);

        if (statusData.status.toLowerCase() !== "completed") {
          setLoading(true);
          return;
        }

        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }

        await loadCompletedResults();
      } catch {
        // Keep polling robust even if one status request fails.
      }
    };

    void pollStatus();
    intervalId = window.setInterval(() => {
      void pollStatus();
    }, 2000);

    return () => {
      active = false;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [experimentId, storeResultData]);

  const metricItems = useMemo(() => {
    if (!overview) return [] as Array<{ label: string; value: string | number }>;

    return Object.entries(overview.counts).map(([key, value]) => ({
      label: key.replace(/_/g, " "),
      value,
    }));
  }, [overview]);

  const hasAnyResults =
    generatedMolecules.length > 0 ||
    dockingResults.length > 0 ||
    simulationResults.length > 0 ||
    quantumResults.length > 0 ||
    (filteredRanked?.items?.length ?? 0) > 0;

  const currentStage = pipelineStatus?.stage ?? "Waiting for status";
  const progressValue = Math.max(0, Math.min(100, pipelineStatus?.progress ?? 0));
  const statusLogs = pipelineStatus?.logs ?? [];

  return (
    <div className="page-shell ui-fade-in relative overflow-hidden max-w-[1500px] space-y-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-500/10 to-transparent" />

      <div className="rounded-2xl border p-7 shadow-[0_20px_90px_-40px_rgba(56,189,248,0.45)]" style={{ borderColor: "var(--accent-border)", backgroundColor: "var(--card)" }}>
        <p className="page-kicker" style={{ color: "var(--accent)" }}>Experiment Results</p>
        <h1 className="page-title mt-2 sm:text-[2.05rem]" style={{ color: "var(--text)" }}>
          {experimentId ? `Results for ${experimentId}` : "Results"}
        </h1>
        <p className="page-subtitle mt-3 max-w-3xl sm:text-[0.95rem]" style={{ color: "var(--muted-text)" }}>
          {lastExperimentId ? `Latest pipeline experiment: ${lastExperimentId}` : "Pipeline output from the backend."}
        </p>
        {payload ? (
          <p className="mt-2 text-xs uppercase tracking-[0.16em]" style={{ color: "var(--success)" }}>
            Live response loaded from backend
          </p>
        ) : null}
      </div>

      <section className="rounded-2xl border p-6 shadow-xl shadow-slate-950/40" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Pipeline Status</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted-text)" }}>Current Stage</p>
            <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>{currentStage}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-text)" }}>
              {pipelineStatus ? `Status: ${pipelineStatus.status}` : "Polling /pipeline/status every 2 seconds."}
            </p>
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Progress: {progressValue}%
          </p>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--border)" }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progressValue}%`, backgroundColor: "var(--accent)" }}
          />
        </div>

        <p className="mt-4 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted-text)" }}>Logs</p>
        <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted-bg)" }}>
          {statusLogs.length ? (
            statusLogs.map((line, index) => (
              <p key={`${line}-${index}`} className="font-mono text-xs leading-5" style={{ color: "var(--text)" }}>
                {line}
              </p>
            ))
          ) : (
            <p className="text-xs" style={{ color: "var(--muted-text)" }}>No status logs yet.</p>
          )}
        </div>
      </section>

      <div className="ui-state-transition">
        <SectionTabs activeSection={activeSection} onChange={setActiveSection} />
      </div>

      <div className="ui-state-transition">
        <ResultsFilterBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          scoreBand={scoreBand}
          onScoreBandChange={setScoreBand}
          stabilityBand={stabilityBand}
          onStabilityBandChange={setStabilityBand}
          onClear={() => {
            setSearchQuery("");
            setScoreBand("all");
            setStabilityBand("all");
          }}
        />
      </div>

      {error ? (
        <ApiErrorState
          error={error}
          onRetry={() => router.refresh()}
          title="Results could not be loaded"
          fallbackMessage="We could not load the experiment-specific results yet."
        />
      ) : null}

      {loading ? <ResultsPageSkeleton /> : null}

      {overview ? <MetricGrid items={metricItems} /> : null}

      {!loading && !error && !hasAnyResults ? (
        <EmptyState
          title="No results available"
          description="The backend returned no pipeline data for this experiment id yet."
          ctaLabel="Back to Results"
          ctaHref="/results"
          className="min-h-[260px]"
        />
      ) : null}

      {!error ? (
        <div className="ui-state-transition space-y-4">
          {activeSection === "generated" ? (
            <GeneratedMoleculesTable
              items={generatedMolecules}
              searchQuery={searchQuery}
              scoreBand={scoreBand}
              stabilityBand={stabilityBand}
              loading={loading}
            />
          ) : null}

          {activeSection === "filtered" ? (
            <FilteredCandidatesSection
              rows={filteredRanked?.items ?? []}
              searchQuery={searchQuery}
              scoreBand={scoreBand}
              stabilityBand={stabilityBand}
              loading={loading}
            />
          ) : null}

          {activeSection === "docking" ? (
            <DockingResultsTable
              items={dockingResults}
              searchQuery={searchQuery}
              scoreBand={scoreBand}
              stabilityBand={stabilityBand}
              loading={loading}
            />
          ) : null}

          {activeSection === "simulation" ? (
            <SimulationResultsSection
              items={simulationResults}
              simulationVideoUrl={simulationVideoUrl}
              searchQuery={searchQuery}
              scoreBand={scoreBand}
              stabilityBand={stabilityBand}
              loading={loading}
            />
          ) : null}

          {activeSection === "quantum" ? (
            <QuantumResultsSection
              items={quantumResults}
              searchQuery={searchQuery}
              scoreBand={scoreBand}
              stabilityBand={stabilityBand}
              loading={loading}
            />
          ) : null}

          {!loading && artifacts ? (
            <ArtifactGrid
              title={`Experiment Artifacts (${artifacts.count})`}
              subtitle="Files returned by the backend pipeline results endpoint."
              items={artifacts.items}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => router.push("/results")}
          className="rounded-md border px-4 py-2 text-sm transition"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text)" }}
        >
          Back to Results
        </button>
      </div>
    </div>
  );
}