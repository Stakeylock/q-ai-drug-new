"use client";

import { useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  getPipelineExperiments,
} from "@/services";
import type { PipelineExperimentItem } from "@/services";
import type { ExperimentRecord, ExperimentStatus, PipelineStageState } from "@/types";
import { EmptyState, Tooltip } from "@/components/shared";
import { SkeletonCard, SkeletonTable } from "@/components/shared/skeletons";

type DateSort = "desc" | "asc";

const MOCK_EXPERIMENTS: any[] = [
  {
    id: "EXP-240319-A",
    name: "EGFR Scaffold Optimization",
    status: "completed",
    createdAt: "2026-04-04T09:20:00Z",
    input: {
      protein: "EGFR kinase domain (PDB: 1M17)",
      constraints: {
        minQED: 0.55,
        maxLogP: 4.5,
        maxToxicity: "Low",
      },
    },
    pipelineStages: {
      generated: "completed",
      docking: "completed",
      simulation: "completed",
      quantum: "completed",
    },
    resultsSummary: {
      overview: "Top-10 hits passed docking threshold; 3 candidates advanced for synthesis.",
      topHit: "QDF-EGFR-077",
      hitRate: 11.2,
      shortlistedCandidates: 3,
    },
  },
  {
    id: "EXP-240319-B",
    name: "Mpro Fragment Expansion",
    status: "running",
    createdAt: "2026-04-05T06:50:00Z",
    input: {
      protein: "SARS-CoV-2 Mpro (PDB: 6LU7)",
      constraints: {
        minQED: 0.52,
        maxLogP: 4.8,
        maxToxicity: "Medium",
      },
    },
    pipelineStages: {
      generated: "completed",
      docking: "running",
      simulation: "pending",
      quantum: "pending",
    },
    resultsSummary: {
      overview: "Docking in progress with 220 molecules queued for scoring.",
      topHit: "QDF-MPRO-031",
      hitRate: 8.9,
      shortlistedCandidates: 0,
    },
  },
  {
    id: "EXP-240318-F",
    name: "BRAF Selectivity Screen",
    status: "failed",
    createdAt: "2026-04-03T15:40:00Z",
    input: {
      protein: "BRAF V600E (PDB: 6U2V)",
      constraints: {
        minQED: 0.5,
        maxLogP: 4.2,
        maxToxicity: "Low",
      },
    },
    pipelineStages: {
      generated: "completed",
      docking: "failed",
      simulation: "pending",
      quantum: "pending",
    },
    resultsSummary: {
      overview: "Run aborted due to invalid protein configuration; parameter sanity check failed.",
      topHit: "N/A",
      hitRate: 0,
      shortlistedCandidates: 0,
    },
  },
  {
    id: "EXP-240317-C",
    name: "JAK2 ADMET Triage",
    status: "completed",
    createdAt: "2026-04-02T11:30:00Z",
    input: {
      protein: "JAK2 JH1 domain (PDB: 4JI9)",
      constraints: {
        minQED: 0.57,
        maxLogP: 4.1,
        maxToxicity: "Low",
      },
    },
    pipelineStages: {
      generated: "completed",
      docking: "completed",
      simulation: "completed",
      quantum: "completed",
    },
    resultsSummary: {
      overview: "17 compounds passed ADMET triage with stable projected solubility profile.",
      topHit: "QDF-JAK2-114",
      hitRate: 13.4,
      shortlistedCandidates: 17,
    },
  },
  {
    id: "EXP-240316-K",
    name: "PI3K-alpha Lead Rescue",
    status: "running",
    createdAt: "2026-04-01T18:10:00Z",
    input: {
      protein: "PI3K-alpha catalytic domain (PDB: 4OVV)",
      constraints: {
        minQED: 0.54,
        maxLogP: 4.0,
        maxToxicity: "Medium",
      },
    },
    pipelineStages: {
      generated: "completed",
      docking: "completed",
      simulation: "running",
      quantum: "pending",
    },
    resultsSummary: {
      overview: "Constraint model active; simulation currently refining lead conformation stability.",
      topHit: "QDF-PI3K-056",
      hitRate: 9.4,
      shortlistedCandidates: 5,
    },
  },
];

function normalizeStatus(status: string): ExperimentStatus {
  const value = status.toLowerCase();
  if (value === "completed") return "completed";
  if (value === "failed" || value === "error") return "failed";
  return "running";
}

function mapStages(status: ExperimentStatus): Record<"generated" | "docking" | "simulation" | "quantum", PipelineStageState> {
  if (status === "completed") {
    return {
      generated: "completed",
      docking: "completed",
      simulation: "completed",
      quantum: "completed",
    };
  }
  if (status === "failed") {
    return {
      generated: "completed",
      docking: "failed",
      simulation: "pending",
      quantum: "pending",
    };
  }
  return {
    generated: "completed",
    docking: "running",
    simulation: "pending",
    quantum: "pending",
  };
}

function toExperimentRecord(item: PipelineExperimentItem): ExperimentRecord {
  const status = normalizeStatus(item.status);
  const stages = mapStages(status);
  return {
    id: item.experiment_id,
    name: `${item.protein} Pipeline Run`,
    status,
    created_at: item.created_at,
    input: {
      protein: item.protein,
      constraints: {
        source: "pipeline",
      },
    },
    pipelineStages: stages,
    resultsSummary: {
      overview:
        status === "completed"
          ? "Pipeline completed and results are available in Results and Visualization."
          : status === "failed"
            ? "Pipeline run failed before completion. Inspect workspace logs and rerun."
            : "Pipeline is still running. Stage transitions will appear in workspace status.",
      topHit: status === "completed" ? "Available in results" : "pending",
      hitRate: status === "completed" ? 10.0 : 0,
      shortlistedCandidates: status === "completed" ? 5 : 0,
    },
    type: "pipeline",
    engine: "gnina",
    progress: status === "completed" ? 100 : status === "failed" ? 0 : 50,
    parameters: {},
    updated_at: item.created_at,
  };
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stageClassName(stage: PipelineStageState): string {
  if (stage === "completed") {
    return "border-emerald-400/40 bg-emerald-500/20 text-emerald-100";
  }
  if (stage === "running") {
    return "border-amber-400/40 bg-amber-500/20 text-amber-100";
  }
  if (stage === "failed") {
    return "border-rose-400/40 bg-rose-500/20 text-rose-100";
  }
  return "border-slate-400/30 bg-slate-600/20 text-slate-200";
}

function statusClassName(status: ExperimentStatus): string {
  if (status === "completed") {
    return "border-emerald-400/40 bg-emerald-500/20 text-emerald-100";
  }
  if (status === "running") {
    return "border-amber-400/40 bg-amber-500/20 text-amber-100";
  }
  return "border-rose-400/40 bg-rose-500/20 text-rose-100";
}

interface StatusBadgeProps {
  status: ExperimentStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${statusClassName(status)}`}
    >
      {status}
    </span>
  );
}

interface ExperimentDetailsProps {
  item: ExperimentRecord | null;
  onClose?: () => void;
}

function ExperimentDetails({ item, onClose }: ExperimentDetailsProps) {
  if (!item) {
    return (
      <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 text-sm text-slate-400">
        Select an experiment row to view details.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-5 shadow-[0_10px_40px_-24px_rgba(34,211,238,0.3)] transition-all duration-300">
      {onClose ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
          >
            Close
          </button>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Experiment</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-100">{item.name}</h2>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <p className="mt-2 font-mono text-xs text-slate-500">{item.id}</p>

      <div className="mt-5 space-y-4">
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 transition-colors duration-200 hover:bg-slate-950/65">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Input Parameters</p>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Protein</p>
              <p className="mt-1 text-slate-200">{item.input.protein}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Constraints</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(item.input.constraints).map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300"
                  >
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 transition-colors duration-200 hover:bg-slate-950/65">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Pipeline Stages</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              "generated",
              "docking",
              "simulation",
              "quantum",
            ] as const).map((stage) => (
              <div key={stage} className="rounded-lg border border-white/10 bg-slate-900/40 p-2.5 transition-colors duration-200 hover:bg-slate-900/65">
                <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{stage}</p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${stageClassName(item.pipelineStages[stage])}`}
                >
                  {item.pipelineStages[stage]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 transition-colors duration-200 hover:bg-slate-950/65">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Results Summary</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.resultsSummary.overview}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-2.5 transition-colors duration-200 hover:bg-slate-900/65">
              <p className="text-[11px] text-slate-500">Top hit</p>
              <p className="mt-1 text-xs font-semibold text-slate-200">{item.resultsSummary.topHit}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-2.5 transition-colors duration-200 hover:bg-slate-900/65">
              <p className="text-[11px] text-slate-500">Hit rate</p>
              <p className="mt-1 text-xs font-semibold text-slate-200">{item.resultsSummary.hitRate}%</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-2.5 transition-colors duration-200 hover:bg-slate-900/65">
              <p className="text-[11px] text-slate-500">Shortlisted</p>
              <p className="mt-1 text-xs font-semibold text-slate-200">
                {item.resultsSummary.shortlistedCandidates}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 transition-colors duration-200 hover:bg-slate-950/65">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Created</p>
          <p className="mt-1 text-sm text-slate-200">{formatDate(item.created_at)}</p>
        </div>
      </div>
    </section>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [sortOrder, setSortOrder] = useState<DateSort>("desc");
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const selectedIdRef = useRef(selectedId);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRerunningId, setIsRerunningId] = useState<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    let active = true;

    const loadExperiments = async () => {
      try {
        setIsLoading(true);
        const rows = await getPipelineExperiments();
        if (!active) return;

        const normalized = rows.map(toExperimentRecord);
        const data = normalized.length > 0 ? normalized : MOCK_EXPERIMENTS;
        setExperiments(data);
        if (!data.some((item) => item.id === selectedIdRef.current)) {
          setSelectedId(data[0]?.id ?? "");
        }
      } catch {
        if (!active) return;
        setExperiments(MOCK_EXPERIMENTS);
        if (!selectedIdRef.current) {
          setSelectedId(MOCK_EXPERIMENTS[0]?.id ?? "");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadExperiments();
    const intervalId = window.setInterval(() => {
      void loadExperiments();
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const sortedExperiments = useMemo(() => {
    return [...experiments].sort((a, b) => {
      const left = new Date(a.created_at).getTime();
      const right = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? right - left : left - right;
    });
  }, [experiments, sortOrder]);

  const selectedExperiment = useMemo(
    () => sortedExperiments.find((item) => item.id === selectedId) ?? null,
    [selectedId, sortedExperiments]
  );

  const toggleDateSort = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const handleView = (id: string) => {
    setSelectedId(id);
    setIsDetailsOpen(true);
  };

  const handleRerun = async (id: string) => {
    const source = experiments.find((item) => item.id === id);
    if (!source) return;

    setIsRerunningId(id);

    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "qdrugforge.workspace.rerunInput",
          JSON.stringify(source.input)
        );
      }

      setIsDetailsOpen(false);
      router.push("/workspace");
    } finally {
      setIsRerunningId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1450px] flex-col gap-7 pb-10 fade-in-soft">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300/80">Research Log</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">Experiment List</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          Track execution status, inspect scientific context, and manage reruns from a single lab-grade audit view.
        </p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {isLoading ? (
          <>
            <SkeletonTable columns={5} rows={6} />
            <aside className="hidden xl:block">
              <SkeletonCard className="p-5" lines={7} showBadge={false} />
            </aside>
          </>
        ) : null}

        {!isLoading ? (
        <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-3 shadow-[0_10px_36px_-22px_rgba(15,23,42,0.7)]">
          {sortedExperiments.length === 0 ? (
            <EmptyState
              title="No experiments yet"
              description="Run pipeline to see data and build your experiment history."
              ctaLabel="Go to Workspace"
              ctaHref="/workspace"
              className="min-h-[320px]"
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.13em] text-slate-400">
                  <th className="px-3 py-3 font-medium">Experiment ID</th>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">
                    <button
                      type="button"
                      onClick={toggleDateSort}
                      className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-200 transition-all duration-200 hover:border-cyan-400/35 hover:bg-cyan-500/10"
                    >
                      Date
                      <span className="text-slate-400">{sortOrder === "desc" ? "Newest" : "Oldest"}</span>
                    </button>
                  </th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedExperiments.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setIsDetailsOpen(true);
                      }}
                      className={`cursor-pointer border-t border-white/8 transition-all duration-200 ${
                        isSelected
                          ? "bg-cyan-500/15 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.24)]"
                          : "hover:bg-white/5 hover:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]"
                      }`}
                    >
                      <td className="px-3 py-3 font-mono text-xs text-slate-300 transition-colors duration-200">{item.id}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-100 transition-colors duration-200">{item.name}</td>
                      <td className="px-3 py-3 text-sm">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-300">{formatDate(item.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Tooltip content="Open full experiment details">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleView(item.id);
                              }}
                              className="ui-button rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-500/20"
                            >
                              View
                            </button>
                          </Tooltip>
                          <Tooltip content="Use this input setup again">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRerun(item.id);
                              }}
                              disabled={isRerunningId === item.id}
                              className="ui-button rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isRerunningId === item.id ? "Re-running..." : "Re-run"}
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </section>
        ) : null}

        <aside className="hidden xl:block">
          <ExperimentDetails item={selectedExperiment} />
        </aside>
      </div>

      {isDetailsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 p-3 backdrop-blur-sm xl:hidden">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-2">
            <ExperimentDetails item={selectedExperiment} onClose={() => setIsDetailsOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
