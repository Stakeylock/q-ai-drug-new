import type { ExperimentRecord } from "@/types";

// Backend placeholders for future integration.
// Swap callers from local persistence to these methods when API endpoints are ready.

export async function getExperiments(): Promise<ExperimentRecord[]> {
  throw new Error("getExperiments API is not implemented yet.");
}

export async function createExperiment(experiment: ExperimentRecord): Promise<ExperimentRecord> {
  void experiment;
  throw new Error("createExperiment API is not implemented yet.");
}
