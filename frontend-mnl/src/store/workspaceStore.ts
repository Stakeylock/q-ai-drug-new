import { create } from "zustand";
import type { ExperimentInput } from "@/types";

export type PipelineState =
  | "idle"
  | "generating"
  | "docking"
  | "running_full_pipeline"
  | "completed"
  | "error";

export type PipelineAction = "generate" | "docking" | "pipeline";

export interface IntermediateResultItem {
  id: string;
  label: string;
  value: string;
  status: "queued" | "processing" | "ready";
  progress: number;
}

export interface PipelineExecutionSnapshot {
  status: string;
  stage: string;
  progress: number;
  logs: string[];
}

export interface PipelineResultsSnapshot {
  generated: unknown[];
  filtered: unknown[];
  docking: unknown[];
}

interface WorkspaceStoreState {
  pipelineState: PipelineState;
  lastAction: PipelineAction | null;
  lastExperimentId: string | null;
  workspaceInput: ExperimentInput;
  errorMessage: string | null;
  pipelineLogs: string[];
  intermediateResults: IntermediateResultItem[];
  pipelineExecution: PipelineExecutionSnapshot;
  pipelineResults: PipelineResultsSnapshot;
  setPipelineState: (state: PipelineState) => void;
  startAction: (action: PipelineAction) => void;
  setCompleted: () => void;
  setError: (message: string) => void;
  setLastExperimentId: (experimentId: string | null) => void;
  resetPipeline: () => void;
  appendLog: (entry: string) => void;
  clearLogs: () => void;
  setPipelineExecution: (execution: PipelineExecutionSnapshot) => void;
  setPipelineResults: (results: PipelineResultsSnapshot) => void;
  setIntermediateResults: (items: IntermediateResultItem[]) => void;
  setWorkspaceInput: (input: Partial<ExperimentInput>) => void;
  updateIntermediateResult: (
    id: string,
    updates: Partial<Pick<IntermediateResultItem, "value" | "status" | "progress">>,
  ) => void;
}

const ACTION_TO_STATE: Record<PipelineAction, PipelineState> = {
  generate: "generating",
  docking: "docking",
  pipeline: "running_full_pipeline",
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  pipelineState: "idle",
  lastAction: null,
  lastExperimentId: null,
  workspaceInput: {
    protein: "EGFR",
    constraints: {
      logP: 2.4,
      qed: 0.78,
      toxicity: "Low",
    },
  },
  errorMessage: null,
  pipelineLogs: ["System ready. Select a pipeline action to begin."],
  intermediateResults: [],
  pipelineExecution: {
    status: "idle",
    stage: "phase0",
    progress: 0,
    logs: [],
  },
  pipelineResults: {
    generated: [],
    filtered: [],
    docking: [],
  },

  setPipelineState: (pipelineState) => set({ pipelineState }),

  startAction: (action) =>
    set({
      pipelineState: ACTION_TO_STATE[action],
      lastAction: action,
      errorMessage: null,
      pipelineResults: {
        generated: [],
        filtered: [],
        docking: [],
      },
    }),

  setCompleted: () => set({ pipelineState: "completed", errorMessage: null }),

  setError: (message) =>
    set({
      pipelineState: "error",
      errorMessage: message,
    }),

  setLastExperimentId: (experimentId) => set({ lastExperimentId: experimentId }),

  resetPipeline: () =>
    set({
      pipelineState: "idle",
      lastAction: null,
      lastExperimentId: null,
      errorMessage: null,
      pipelineLogs: ["System reset. Waiting for next action."],
      intermediateResults: [],
      pipelineExecution: {
        status: "idle",
        stage: "phase0",
        progress: 0,
        logs: [],
      },
      pipelineResults: {
        generated: [],
        filtered: [],
        docking: [],
      },
    }),

  appendLog: (entry) =>
    set((state) => ({
      pipelineLogs: [...state.pipelineLogs, entry],
    })),

  clearLogs: () => set({ pipelineLogs: [] }),

  setPipelineExecution: (execution) => set({ pipelineExecution: execution }),

  setPipelineResults: (results) => set({ pipelineResults: results }),

  setIntermediateResults: (items) => set({ intermediateResults: items }),

  setWorkspaceInput: (input) =>
    set((state) => ({
      workspaceInput: {
        ...state.workspaceInput,
        ...input,
        constraints: {
          ...state.workspaceInput.constraints,
          ...(input.constraints ?? {}),
        },
      },
    })),

  updateIntermediateResult: (id, updates) =>
    set((state) => ({
      intermediateResults: state.intermediateResults.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    })),
}));
