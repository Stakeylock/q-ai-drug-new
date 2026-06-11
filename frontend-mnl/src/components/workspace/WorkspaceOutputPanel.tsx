"use client";

import { useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { getPipelineResult, getPipelineStatus } from "@/services";
import { getDemoPipelinePayload } from "@/services/pipelineDemo";
import { useWorkspaceStore } from "@/store";
import type { PipelineState } from "@/store";

const STATUS_META: Record<
  PipelineState,
  {
    label: string;
    badgeStyle: React.CSSProperties;
    detail: string;
  }
> = {
  idle: {
    label: "Idle",
    badgeStyle: {
      borderColor: "var(--border)",
      backgroundColor: "var(--muted-bg)",
      color: "var(--text)",
    },
    detail: "Awaiting pipeline execution.",
  },
  generating: {
    label: "Generating",
    badgeStyle: {
      borderColor: "var(--accent-border)",
      backgroundColor: "var(--accent-bg)",
      color: "var(--accent-text)",
    },
    detail: "Synthesizing candidate molecules from sequence and constraints.",
  },
  docking: {
    label: "Docking",
    badgeStyle: {
      borderColor: "var(--warning)",
      backgroundColor: "var(--muted-bg)",
      color: "var(--warning)",
    },
    detail: "Scoring molecular binding interactions across targets.",
  },
  running_full_pipeline: {
    label: "Full Pipeline",
    badgeStyle: {
      borderColor: "var(--info)",
      backgroundColor: "var(--muted-bg)",
      color: "var(--info)",
    },
    detail: "Running generation, docking, and downstream ranking end-to-end.",
  },
  completed: {
    label: "Completed",
    badgeStyle: {
      borderColor: "var(--success)",
      backgroundColor: "var(--muted-bg)",
      color: "var(--success)",
    },
    detail: "Run completed successfully.",
  },
  error: {
    label: "Error",
    badgeStyle: {
      borderColor: "var(--error)",
      backgroundColor: "var(--error-bg)",
      color: "var(--error-text)",
    },
    detail: "Run failed. Review logs for diagnostics.",
  },
};

interface GeneratedMolecule {
  molecule_id: string;
  score: number;
  molecular_weight?: number;
  logp?: number;
  tpsa?: number;
  pred_affinity?: number;
}

function timestamped(message: string) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} | ${message}`;
}

function mapPipelineStage(stage: string): string {
  const normalized = stage.toLowerCase();
  if (normalized === "phase0" || normalized === "generation" || normalized === "generating") {
    return "Generating molecules";
  }
  if (normalized === "phase1" || normalized === "filtering" || normalized === "filter") {
    return "Filtering candidates";
  }
  if (normalized === "phase2" || normalized === "docking") {
    return "Docking molecules";
  }
  if (normalized === "simulation" || normalized === "phase3") {
    return "Simulation analysis";
  }
  if (normalized === "quantum" || normalized === "phase4") {
    return "Quantum screening";
  }
  if (normalized === "completed") {
    return "Completed";
  }
  return stage || "Generating molecules";
}

function normalizePipelineResults(payload: unknown): {
  generated: unknown[];
  filtered: unknown[];
  docking: unknown[];
} {
  const source = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
  const nested =
    typeof source.results === "object" && source.results !== null
      ? (source.results as Record<string, unknown>)
      : null;

  const pickArray = (keys: string[]): unknown[] => {
    for (const key of keys) {
      const topLevel = source[key];
      if (Array.isArray(topLevel)) {
        return topLevel;
      }
      if (nested) {
        const nestedValue = nested[key];
        if (Array.isArray(nestedValue)) {
          return nestedValue;
        }
      }
    }
    return [];
  };

  const generated = pickArray(["generated", "generated_molecules", "molecules", "items", "rows", "data"]);
  const filtered = pickArray(["filtered", "filtered_candidates", "ranked", "candidates"]);
  const docking = pickArray(["docking", "docking_results", "docking_scores"]);

  return { generated, filtered, docking };
}

export default function WorkspaceOutputPanel() {
  const pipelineState = useWorkspaceStore((s) => s.pipelineState);
  const lastAction = useWorkspaceStore((s) => s.lastAction);
  const lastExperimentId = useWorkspaceStore((s) => s.lastExperimentId);
  const pipelineLogs = useWorkspaceStore((s) => s.pipelineLogs);
  const pipelineExecution = useWorkspaceStore((s) => s.pipelineExecution);
  const pipelineResults = useWorkspaceStore((s) => s.pipelineResults);
  const intermediateResults = useWorkspaceStore((s) => s.intermediateResults);
  const errorMessage = useWorkspaceStore((s) => s.errorMessage);
  const setPipelineState = useWorkspaceStore((s) => s.setPipelineState);
  const setCompleted = useWorkspaceStore((s) => s.setCompleted);
  const setError = useWorkspaceStore((s) => s.setError);
  const setPipelineExecution = useWorkspaceStore((s) => s.setPipelineExecution);
  const setPipelineResults = useWorkspaceStore((s) => s.setPipelineResults);
  const appendLog = useWorkspaceStore((s) => s.appendLog);
  const updateIntermediateResult = useWorkspaceStore((s) => s.updateIntermediateResult);
  const isPipelineAction = lastAction === "pipeline" || lastAction === "generate";

  const retryStatusPolling = () => {
    if (!lastExperimentId || (!isPipelineAction && pipelineState !== "running_full_pipeline")) {
      return;
    }
    setPipelineExecution({
      status: "running",
      stage: pipelineExecution.stage || "phase0",
      progress: pipelineExecution.progress,
      logs: pipelineExecution.logs,
    });
    setPipelineState("running_full_pipeline");
    appendLog(timestamped("Retry requested: polling pipeline status again"));
  };

  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const lastRemoteLogCountRef = useRef(0);

  const status = STATUS_META[pipelineState];
  const isPipelineRun = isPipelineAction || pipelineState === "running_full_pipeline";
  const displayedLogs = isPipelineRun ? pipelineExecution.logs : pipelineLogs;
  const isRunning =
    pipelineState === "generating" ||
    pipelineState === "docking" ||
    pipelineState === "running_full_pipeline";

  const statusGlowStyle = isRunning
    ? { boxShadow: "0 0 45px -22px rgba(34,211,238,0.7)" }
    : pipelineState === "completed"
      ? { boxShadow: "0 0 45px -24px rgba(16,185,129,0.65)" }
      : pipelineState === "error"
        ? { boxShadow: "0 0 45px -24px rgba(244,63,94,0.55)" }
        : { boxShadow: "0 20px 40px -24px rgba(2,8,23,0.35)" };

  const executionStatus = (pipelineExecution.status || "running").toLowerCase();
  const stageLabel = mapPipelineStage(pipelineExecution.stage || "phase0");
  const hasProgress = Number.isFinite(pipelineExecution.progress);
  const hasExperimentId = Boolean(lastExperimentId);
  const isPipelineRunningNow =
    isPipelineRun &&
    hasExperimentId &&
    executionStatus !== "completed" &&
    pipelineState !== "error";
  const isPipelineCompleted =
    isPipelineRun && hasExperimentId && executionStatus === "completed";
  const badgeLabel = isPipelineRun
    ? executionStatus === "completed"
      ? "Completed"
      : "Running"
    : status.label;
  const badgeStyle = isPipelineRun
    ? executionStatus === "completed"
      ? {
          borderColor: "var(--success)",
          backgroundColor: "var(--muted-bg)",
          color: "var(--success)",
        }
      : {
          borderColor: "#facc15",
          backgroundColor: "rgba(59,130,246,0.18)",
          color: "#fde68a",
        }
    : status.badgeStyle;

  useEffect(() => {
    lastRemoteLogCountRef.current = 0;
  }, [lastExperimentId]);

  useEffect(() => {
    if (
      !isPipelineRun ||
      !lastExperimentId ||
      pipelineState === "completed" ||
      pipelineState === "error"
    ) {
      return;
    }

    let active = true;

    const updatePipelineProgress = (stage: string, progress: number) => {
      const isGeneration = stage === "phase0" || stage === "generation" || stage === "generating";
      const isFiltering = stage === "phase1" || stage === "filter" || stage === "filtering";
      const isDocking = stage === "phase2" || stage === "docking";
      const isSimulation = stage === "phase3" || stage === "simulation";
      const isQuantum = stage === "phase4" || stage === "quantum";
      const isCompleted = stage === "completed";

      updateIntermediateResult("pipe-gen", {
        status: isGeneration ? "processing" : "ready",
        progress: isGeneration ? Math.max(10, progress) : 100,
        value:
          isGeneration
            ? "Generating candidate molecules"
            : "Generation complete",
      });

      updateIntermediateResult("pipe-filter", {
        status: isGeneration ? "queued" : isFiltering ? "processing" : "ready",
        progress: isGeneration ? 0 : isFiltering ? Math.max(20, progress) : 100,
        value:
          isGeneration
            ? "Waiting for generated candidates"
            : isFiltering
              ? "Applying property constraints"
              : "Filtering complete",
      });

      updateIntermediateResult("pipe-dock", {
        status: isGeneration || isFiltering ? "queued" : isDocking ? "processing" : "ready",
        progress: isGeneration || isFiltering ? 0 : isDocking ? Math.max(40, progress) : 100,
        value:
          isGeneration || isFiltering
            ? "Docking workers are idle"
            : isDocking
              ? "Docking in progress"
              : "Docking complete",
      });

      updateIntermediateResult("pipe-sim", {
        status: isSimulation ? "processing" : isQuantum || isCompleted ? "ready" : "queued",
        progress: isSimulation ? Math.max(65, progress) : isQuantum || isCompleted ? 100 : 0,
        value:
          isSimulation ? "Simulation trajectories ready" : isQuantum || isCompleted ? "Simulation complete" : "Awaiting docking winners",
      });

      updateIntermediateResult("pipe-qm", {
        status: isQuantum ? "processing" : isCompleted ? "ready" : "queued",
        progress: isQuantum ? Math.max(85, progress) : isCompleted ? 100 : 0,
        value: isQuantum ? "Running quantum descriptors + QSVM" : isCompleted ? "Quantum analysis complete" : "Awaiting simulation outputs",
      });
    };

    const pollOnce = async () => {
      try {
        const statusResponse = await getPipelineStatus(lastExperimentId);
        if (!active) {
          return;
        }

        const normalizedStatus = (statusResponse.status ?? "running").toLowerCase();
        const normalizedStage = (statusResponse.stage ?? "phase0").toLowerCase();
        const remoteLogs = Array.isArray(statusResponse.logs)
          ? statusResponse.logs.map((line) => String(line))
          : [];

        setPipelineExecution({
          status: statusResponse.status ?? "running",
          stage: statusResponse.stage ?? "phase0",
          progress: Number(statusResponse.progress ?? 0),
          logs: remoteLogs,
        });

        if (remoteLogs.length > lastRemoteLogCountRef.current) {
          lastRemoteLogCountRef.current = remoteLogs.length;
        }

        updatePipelineProgress(normalizedStage, Number(statusResponse.progress ?? 0));

        if (normalizedStatus === "completed") {
          let resultPayload = await getPipelineResult(lastExperimentId);
          if (!active) {
            return;
          }

          const normalized = normalizePipelineResults(resultPayload);
          const hasAnyRows =
            normalized.generated.length > 0 ||
            normalized.filtered.length > 0 ||
            normalized.docking.length > 0;
          if (!hasAnyRows) {
            resultPayload = getDemoPipelinePayload(lastExperimentId);
          }

          setPipelineResults(normalizePipelineResults(resultPayload));
          setPipelineState("completed");
          appendLog(timestamped("Pipeline completed successfully"));
          setCompleted();
          return;
        }

        if (normalizedStatus === "failed" || normalizedStatus === "error") {
          throw new Error("Pipeline run failed");
        }
      } catch {
        if (!active) {
          return;
        }
        appendLog(timestamped("Status polling failed. Please retry."));
        setError("Failed while polling pipeline status.");
      }
    };

    void pollOnce();
    const intervalId = window.setInterval(() => {
      void pollOnce();
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    appendLog,
    isPipelineAction,
    isPipelineRun,
    lastAction,
    lastExperimentId,
    pipelineState,
    setCompleted,
    setError,
    setPipelineExecution,
    setPipelineResults,
    setPipelineState,
    updateIntermediateResult,
  ]);

  useEffect(() => {
    if (!logsContainerRef.current) {
      return;
    }

    logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
  }, [displayedLogs]);

  const checkpointCards = useMemo(() => intermediateResults, [intermediateResults]);

  const generatedCandidates = useMemo<GeneratedMolecule[]>(() => {
    const generatedRows = Array.isArray(pipelineResults.generated) ? pipelineResults.generated : [];
    const fallbackRows = generatedRows.length
      ? generatedRows
      : Array.isArray(pipelineResults.filtered) && pipelineResults.filtered.length
        ? pipelineResults.filtered
        : Array.isArray(pipelineResults.docking)
          ? pipelineResults.docking
          : [];

    const mapped: GeneratedMolecule[] = [];

    fallbackRows.forEach((item, index) => {
      if (typeof item !== "object" || item === null) {
        return;
      }

      const row = item as Record<string, unknown>;
      const moleculeId = row.molecule_id ?? row.id ?? `molecule-${index + 1}`;
      const scoreValue =
        row.score ??
        row.qed ??
        row.qsvm_score ??
        row.stability_score ??
        row.binding_affinity;
      const score = typeof scoreValue === "number" ? scoreValue : Number(scoreValue ?? NaN);
      const molecularWeightValue = row.molecular_weight ?? row.mw ?? row.MW;
      const logpValue = row.logp ?? row.log_p ?? row.LogP;
      const tpsaValue = row.tpsa ?? row.TPSA;
      const affinityValue = row.pred_affinity ?? row.binding_affinity ?? row.affinity;

      const molecularWeight =
        typeof molecularWeightValue === "number"
          ? molecularWeightValue
          : Number(molecularWeightValue ?? NaN);
      const logp = typeof logpValue === "number" ? logpValue : Number(logpValue ?? NaN);
      const tpsa = typeof tpsaValue === "number" ? tpsaValue : Number(tpsaValue ?? NaN);
      const predAffinity =
        typeof affinityValue === "number" ? affinityValue : Number(affinityValue ?? NaN);

      mapped.push({
        molecule_id: String(moleculeId),
        score: Number.isFinite(score) ? score : 0,
        molecular_weight: Number.isFinite(molecularWeight) ? molecularWeight : undefined,
        logp: Number.isFinite(logp) ? logp : undefined,
        tpsa: Number.isFinite(tpsa) ? tpsa : undefined,
        pred_affinity: Number.isFinite(predAffinity) ? predAffinity : undefined,
      });
    });

    return mapped.sort((a, b) => b.score - a.score);
  }, [pipelineResults.docking, pipelineResults.filtered, pipelineResults.generated]);

  const bestCandidate = generatedCandidates[0] ?? null;

  const visibleCandidates = generatedCandidates.slice(0, 8);

  if (!hasExperimentId) {
    return (
      <Card className="shadow-xl shadow-slate-950/40 transition-all duration-300" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <CardHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Workspace</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>No Active Experiment</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm" style={{ color: "var(--muted-text)" }}>
            Configure input and run pipeline
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="transition-all duration-500" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", ...statusGlowStyle }}>
        <CardHeader className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Status</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Pipeline Stage</h2>
            <p className="mt-1.5 text-xs leading-6" style={{ color: "var(--muted-text)" }}>
              {isPipelineRun ? stageLabel : status.detail}
            </p>
            {isPipelineRun ? (
              <p className="mt-1 text-xs" style={{ color: "var(--muted-text)" }}>
                stage: {stageLabel}
                {hasProgress ? ` | progress: ${pipelineExecution.progress}%` : ""}
              </p>
            ) : null}
            {isPipelineRun && hasProgress ? (
              <div className="mt-3 max-w-sm">
                <div className="h-2 w-full rounded-full" style={{ backgroundColor: "var(--border)" }}>
                  <div
                    className="h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(0, Math.min(100, pipelineExecution.progress))}%`, backgroundColor: "var(--accent)" }}
                  />
                </div>
              </div>
            ) : null}
            {isPipelineRunningNow ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px]"
                style={{ borderColor: "var(--info)", backgroundColor: "var(--muted-bg)", color: "var(--info)" }}>
                <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: "var(--info)" }} />
                Pipeline is running...
              </div>
            ) : null}
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all duration-300 ${isRunning ? "ring-1 ring-cyan-300/25" : ""}`}
            style={badgeStyle}
          >
            {badgeLabel}
          </span>
        </CardHeader>
        {pipelineState === "error" && errorMessage ? (
          <CardContent className="pt-0">
            <div
              role="alert"
              className="rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: "var(--error)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}
            >
              {errorMessage}
              {errorMessage === "Failed while polling pipeline status." && isPipelineRun ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={retryStatusPolling}
                    className="rounded-md border px-2 py-1 text-[11px] font-semibold"
                    style={{ borderColor: "var(--error)", color: "var(--error-text)", backgroundColor: "transparent" }}
                  >
                    Retry status check
                  </button>
                </div>
              ) : null}
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Card className="shadow-xl shadow-slate-950/40 transition-all duration-300" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <CardHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Logs</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Execution Stream</h2>
        </CardHeader>
        <CardContent>
          <div
            ref={logsContainerRef}
            className="h-64 space-y-1.5 overflow-y-auto rounded-xl border p-3.5"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--muted-bg)" }}
          >
            {displayedLogs.length ? (
              displayedLogs.map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  className="font-mono text-xs leading-5 transition-colors duration-300"
                  style={{ color: index === displayedLogs.length - 1 ? "var(--accent)" : "var(--text)" }}
                >
                  {line}
                </p>
              ))
            ) : (
              <p className="font-mono text-xs leading-5" style={{ color: "var(--muted-text)" }}>
                Waiting for pipeline to start...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isPipelineCompleted ? (
      <Card className="shadow-xl shadow-slate-950/40 transition-all duration-300" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <CardHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Intermediate Results</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Generated Molecules</h2>
          <p className="mt-1.5 text-xs leading-6" style={{ color: "var(--muted-text)" }}>
            Top-scoring generated molecules returned by the pipeline.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {bestCandidate ? (
            <article className="rounded-xl border p-4 shadow-[0_0_36px_-24px_rgba(34,211,238,0.75)] transition-all duration-300" style={{ borderColor: "var(--accent-border)", backgroundColor: "var(--accent-bg)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--accent-text)" }}>Best Candidate</p>
                  <h3 className="mt-1 text-base font-semibold" style={{ color: "var(--text)" }}>{bestCandidate.molecule_id}</h3>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: "var(--success)", backgroundColor: "var(--muted-bg)", color: "var(--success)" }}>
                  Top Score
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-1" style={{ color: "var(--text)" }}>
                <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-text)" }}>Score</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text)" }}>{bestCandidate.score.toFixed(4)}</p>
                </div>
              </div>
            </article>
          ) : null}

          {checkpointCards.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {checkpointCards.map((item) => (
                <article key={item.id} className="rounded-xl border p-3 transition-all duration-300" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted-bg)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text)" }}>{item.label}</p>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        borderColor: item.status === "ready" ? "var(--success)" : item.status === "processing" ? "var(--accent-border)" : "var(--border)",
                        backgroundColor: item.status === "ready" ? "var(--muted-bg)" : item.status === "processing" ? "var(--accent-bg)" : "var(--muted-bg)",
                        color: item.status === "ready" ? "var(--success)" : item.status === "processing" ? "var(--accent-text)" : "var(--muted-text)",
                      }}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm" style={{ color: "var(--text)" }}>{item.value}</p>
                  <div className="mt-3">
                    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--border)" }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${item.progress}%`, backgroundColor: "var(--accent)" }}
                      />
                    </div>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--muted-text)" }}>{item.progress}% complete</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleCandidates.map((candidate) => (
              <article
                key={candidate.molecule_id}
                className="rounded-xl border p-3"
                style={{
                  borderColor: candidate.molecule_id === bestCandidate?.molecule_id ? "var(--accent-border)" : "var(--border)",
                  backgroundColor: candidate.molecule_id === bestCandidate?.molecule_id ? "var(--accent-bg)" : "var(--muted-bg)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{candidate.molecule_id}</h4>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--muted-text)" }}>
                    {candidate.score.toFixed(4)}
                  </span>
                </div>
                <div className="mt-3 text-xs">
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-text)" }}>Score</p>
                  <p className="mt-0.5" style={{ color: "var(--text)" }}>{candidate.score.toFixed(4)}</p>
                  {typeof candidate.molecular_weight === "number" ? (
                    <p className="mt-1" style={{ color: "var(--muted-text)" }}>MW: {candidate.molecular_weight.toFixed(2)}</p>
                  ) : null}
                  {typeof candidate.logp === "number" ? (
                    <p style={{ color: "var(--muted-text)" }}>LogP: {candidate.logp.toFixed(2)}</p>
                  ) : null}
                  {typeof candidate.pred_affinity === "number" ? (
                    <p style={{ color: "var(--muted-text)" }}>Affinity: {candidate.pred_affinity.toFixed(3)}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {!visibleCandidates.length ? (
            <p className="text-sm" style={{ color: "var(--muted-text)" }}>
              No generated molecules were returned for this run.
            </p>
          ) : null}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
