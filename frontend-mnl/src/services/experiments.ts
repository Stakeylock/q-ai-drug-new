import type { ExperimentRecord } from "@/types";
import {
  createExperiment as createExperimentApi,
  getExperiments as getExperimentsApi,
} from "./experimentsApi";
import { isDemoMode } from "./api";

const EXPERIMENTS_STORAGE_KEY = "qdrugforge.experiments.v1";
const EXPERIMENTS_UPDATED_EVENT = "qdrugforge.experiments.updated";
const USE_EXPERIMENTS_API = !isDemoMode();

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function readStoredExperiments(): ExperimentRecord[] {
  if (!hasWindow()) return [];

  const raw = window.localStorage.getItem(EXPERIMENTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ExperimentRecord[];
  } catch {
    return [];
  }
}

function writeStoredExperiments(items: ExperimentRecord[]): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(EXPERIMENTS_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EXPERIMENTS_UPDATED_EVENT));
}

export function getStoredExperiments(): ExperimentRecord[] {
  return readStoredExperiments();
}

export function saveExperiment(experiment: ExperimentRecord): ExperimentRecord[] {
  const existing = readStoredExperiments();
  const merged = [experiment, ...existing.filter((item) => item.id !== experiment.id)];
  writeStoredExperiments(merged);
  return merged;
}

export async function getExperiments(): Promise<ExperimentRecord[]> {
  if (!isDemoMode()) {
    return getExperimentsApi();
  }

  return getStoredExperiments();
}

export async function createExperiment(experiment: ExperimentRecord): Promise<ExperimentRecord> {
  if (!isDemoMode()) {
    return createExperimentApi(experiment);
  }

  saveExperiment(experiment);
  return experiment;
}

export function subscribeToExperimentUpdates(onUpdate: () => void): () => void {
  if (!hasWindow()) {
    return () => {};
  }

  const handler = () => onUpdate();
  const storageHandler = (event: StorageEvent) => {
    if (event.key === EXPERIMENTS_STORAGE_KEY) {
      onUpdate();
    }
  };

  window.addEventListener(EXPERIMENTS_UPDATED_EVENT, handler);
  window.addEventListener("storage", storageHandler);

  return () => {
    window.removeEventListener(EXPERIMENTS_UPDATED_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

export async function rerunExperimentMock(source: ExperimentRecord): Promise<ExperimentRecord> {
  const rerun: ExperimentRecord = {
    ...source,
    id: `${source.id}-R${Date.now().toString().slice(-6)}`,
    name: `${source.name} (Re-run)`,
    status: "running",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    pipelineStages: {
      generated: "running",
      docking: "pending",
      simulation: "pending",
      quantum: "pending",
    },
    resultsSummary: {
      overview: "Re-run submitted. Pipeline stages are initializing.",
      topHit: "Pending",
      hitRate: 0,
      shortlistedCandidates: 0,
    },
  };

  await Promise.resolve();
  await createExperiment(rerun);
  return rerun;
}
