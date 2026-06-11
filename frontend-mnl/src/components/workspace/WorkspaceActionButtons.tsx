"use client";

import { useRef } from "react";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { ApiError, runProjectDocking, runPipeline, type WorkspaceToxicityLevel } from "@/services";
import { useWorkspaceStore } from "@/store";
import type { IntermediateResultItem } from "@/store/workspaceStore";

type WorkspaceAction = "generate" | "docking" | "pipeline";

const actionConfig: Array<{
  key: WorkspaceAction;
  label: string;
  loadingText: string;
  variant: "primary" | "secondary" | "outline";
}> = [
  {
    key: "generate",
    label: "Generate Molecules",
    loadingText: "Generating...",
    variant: "secondary",
  },
  {
    key: "docking",
    label: "Run Docking",
    loadingText: "Running Docking...",
    variant: "outline",
  },
  {
    key: "pipeline",
    label: "Run Full Pipeline",
    loadingText: "Running...",
    variant: "primary",
  },
];

export default function WorkspaceActionButtons() {
  const actionLockRef = useRef(false);

  const pipelineState = useWorkspaceStore((s) => s.pipelineState);
  const lastAction = useWorkspaceStore((s) => s.lastAction);
  const startAction = useWorkspaceStore((s) => s.startAction);
  const setCompleted = useWorkspaceStore((s) => s.setCompleted);
  const setError = useWorkspaceStore((s) => s.setError);
  const setLastExperimentId = useWorkspaceStore((s) => s.setLastExperimentId);
  const setPipelineState = useWorkspaceStore((s) => s.setPipelineState);
  const clearLogs = useWorkspaceStore((s) => s.clearLogs);
  const appendLog = useWorkspaceStore((s) => s.appendLog);
  const setIntermediateResults = useWorkspaceStore((s) => s.setIntermediateResults);
  const setPipelineExecution = useWorkspaceStore((s) => s.setPipelineExecution);
  const workspaceInput = useWorkspaceStore((s) => s.workspaceInput);

  const pipelineInProgress =
    lastAction === "pipeline" &&
    (pipelineState === "generating" ||
      pipelineState === "docking" ||
      pipelineState === "running_full_pipeline");

  const buildInitialResults = (action: WorkspaceAction): IntermediateResultItem[] => {
    if (action === "generate") {
      return [
        { id: "gen-sample", label: "Sample Pool", value: "0 candidates generated", status: "queued", progress: 0 },
        { id: "gen-filter", label: "Constraint Filter", value: "Awaiting LogP/QED screening", status: "queued", progress: 0 },
      ];
    }

    if (action === "docking") {
      return [
        { id: "dock-grid", label: "Docking Grid", value: "Preparing receptor site", status: "queued", progress: 0 },
        { id: "dock-score", label: "Affinity Scoring", value: "No poses scored", status: "queued", progress: 0 },
      ];
    }

    return [
      { id: "pipe-gen", label: "Generation", value: "Bootstrapping molecular generation", status: "queued", progress: 0 },
      { id: "pipe-filter", label: "Filtering", value: "Waiting for generated candidates", status: "queued", progress: 0 },
      { id: "pipe-dock", label: "Docking", value: "Docking workers are idle", status: "queued", progress: 0 },
      { id: "pipe-sim", label: "Simulation", value: "Awaiting docking winners", status: "queued", progress: 0 },
      { id: "pipe-qm", label: "Quantum", value: "Awaiting simulation outputs", status: "queued", progress: 0 },
    ];
  };

  const actionLogLabel: Record<WorkspaceAction, string> = {
    generate: "Generate Molecules",
    docking: "Run Docking",
    pipeline: "Run Full Pipeline",
  };

  const timestamped = (message: string) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss} | ${message}`;
  };

  const normalizeToxicity = (
    value: string | number | boolean | undefined
  ): WorkspaceToxicityLevel => {
    if (typeof value === "string") {
      if (value === "Low" || value === "Medium" || value === "High") {
        return value;
      }
      return "Low";
    }
    if (typeof value === "boolean") {
      return value ? "High" : "Low";
    }
    if (typeof value === "number") {
      if (value >= 0.66) {
        return "High";
      }
      if (value >= 0.33) {
        return "Medium";
      }
      return "Low";
    }
    return "Low";
  };

  const runningAction: WorkspaceAction | null =
    pipelineInProgress
      ? "pipeline"
      : pipelineState === "generating"
      ? "generate"
      : pipelineState === "docking"
        ? "docking"
        : pipelineState === "running_full_pipeline"
          ? "pipeline"
          : null;

  const handleRunPipeline = async () => {
    if (runningAction || actionLockRef.current) {
      return;
    }

    actionLockRef.current = true;
    startAction("pipeline");
    clearLogs();
    setIntermediateResults(buildInitialResults("pipeline"));
    appendLog(timestamped(`Action accepted: ${actionLogLabel.pipeline}`));

    try {
      const response = await runPipeline({
        protein: workspaceInput.protein,
        constraints: {
          logp: Number(workspaceInput.constraints.logP ?? 0),
          qed: Number(workspaceInput.constraints.qed ?? 0),
          toxicity: normalizeToxicity(workspaceInput.constraints.toxicity),
        },
      });

      setLastExperimentId(response.experimentId);
      setPipelineExecution({
        status: "running",
        stage: "phase0",
        progress: 0,
        logs: [],
      });
      appendLog(timestamped(`Pipeline run started: ${response.experimentId}`));
    } catch (error) {
      const errorMessage =
        error instanceof ApiError && typeof error.status === "number"
          ? `Pipeline API request failed (${error.status}).`
          : "Failed to trigger the selected pipeline action.";
      appendLog(timestamped(`Error: ${errorMessage}`));
      setError(errorMessage);
    } finally {
      actionLockRef.current = false;
    }
  };

  const handleActionClick = async (action: WorkspaceAction) => {
    if (runningAction || actionLockRef.current) {
      return;
    }

    actionLockRef.current = true;

    startAction(action);
    clearLogs();
    setIntermediateResults(buildInitialResults(action));
    appendLog(timestamped(`Action accepted: ${actionLogLabel[action]}`));

    try {
      if (action === "generate") {
        const response = await runPipeline({
          protein: workspaceInput.protein,
          constraints: {},
        });

        setLastExperimentId(response.experimentId);
        setPipelineExecution({
          status: "running",
          stage: "phase0",
          progress: 0,
          logs: [],
        });
        setPipelineState("running_full_pipeline");
        appendLog(timestamped(`Pipeline run started: ${response.experimentId}`));
        return;
      }

      if (action === "docking") {
        const projectId = localStorage.getItem("active_project_id");
        if (!projectId) throw new Error("No active project");
        const response = await runProjectDocking(projectId, {});
        appendLog(timestamped(response.message ?? "Docking started..."));
      }

      const finalized = useWorkspaceStore
        .getState()
        .intermediateResults.map((item) => ({
          ...item,
          status: "ready" as const,
          progress: 100,
        }));

      setIntermediateResults(finalized);
      appendLog(timestamped("Pipeline completed successfully"));
      setCompleted();
    } catch (error) {
      const errorMessage =
        error instanceof ApiError && typeof error.status === "number"
          ? `Pipeline API request failed (${error.status}).`
          : "Failed to trigger the selected pipeline action.";
      appendLog(timestamped(`Error: ${errorMessage}`));
      setError(errorMessage);
    } finally {
      actionLockRef.current = false;
    }
  };

  const isBusy = runningAction !== null;

  return (
    <Card className="shadow-xl shadow-slate-950/40 transition-all duration-300" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Actions</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Execution Controls</h2>
        <p className="mt-1.5 text-xs leading-6" style={{ color: "var(--muted-text)" }}>
          Launch a focused step or run the complete discovery pipeline.
        </p>
      </CardHeader>

      <CardContent className="grid gap-3.5 sm:grid-cols-2">
        {actionConfig.map((action) => {
          const isCurrent = runningAction === action.key;
          const isRunButton = action.key === "pipeline";

          return (
            <Button
              key={action.key}
              type="button"
              variant={action.variant}
              className={action.key === "pipeline" ? "sm:col-span-2 shadow-[0_0_24px_-14px_rgba(56,189,248,0.7)]" : undefined}
              onClick={isRunButton ? handleRunPipeline : () => handleActionClick(action.key)}
              isLoading={isCurrent}
              loadingText={action.loadingText}
              disabled={isRunButton ? isBusy : isBusy && !isCurrent}
            >
              {action.label}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
