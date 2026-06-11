import type {
  DockingResult,
  GeneratedMoleculeResult,
  QuantumResult,
  RankedCandidatesResponse,
  ResultArtifactsResponse,
  ResultsOverview,
  SimulationResult,
} from "@/types/api";
import type { PipelineExperimentItem } from "./api";

const baseResult = {
  source: "demo",
  experiment_id: "demo-experiment",
  pipeline_stage: "demo",
  engine: "demo",
  created_at: "2026-05-29T20:35:11Z",
  provenance: { source: "demo", evidence_status: "validated" }
};

export const DEMO_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const DEMO_GENERATED_MOLECULES: GeneratedMoleculeResult[] = [
  {
    molecule_id: "QDF-001",
    smiles: "CC(=O)Nc1ccc(O)c(Cl)c1",
    molecular_weight: 245.7,
    logp: 2.1,
    qed: 0.82,
  },
  {
    molecule_id: "QDF-002",
    smiles: "COc1ccc(cc1)C(=O)NCCN",
    molecular_weight: 236.3,
    logp: 1.9,
    qed: 0.79,
  },
  {
    molecule_id: "QDF-003",
    smiles: "CCN(CC)CCOC(=O)c1cccnc1",
    molecular_weight: 264.4,
    logp: 2.8,
    qed: 0.76,
  },
  {
    molecule_id: "QDF-004",
    smiles: "Nc1ncc(cn1)C2CCNCC2",
    molecular_weight: 231.3,
    logp: 1.7,
    qed: 0.81,
  },
  {
    molecule_id: "QDF-005",
    smiles: "CCOc1ccc2ncccc2c1",
    molecular_weight: 223.3,
    logp: 2.5,
    qed: 0.74,
  },
].map(item => ({ ...baseResult, ...item } as GeneratedMoleculeResult));

export const DEMO_FILTERED_CANDIDATES: RankedCandidatesResponse = {
  source: "generated",
  file: "demo-filtered.csv",
  count: 5,
  items: [
    { molecule_id: "QDF-001", score: 0.89, qed: 0.82, logp: 2.1 },
    { molecule_id: "QDF-002", score: 0.85, qed: 0.79, logp: 1.9 },
    { molecule_id: "QDF-004", score: 0.83, qed: 0.81, logp: 1.7 },
    { molecule_id: "QDF-003", score: 0.79, qed: 0.76, logp: 2.8 },
    { molecule_id: "QDF-005", score: 0.75, qed: 0.74, logp: 2.5 },
  ],
};

export const DEMO_DOCKING_RESULTS: DockingResult[] = [
  { molecule_id: "QDF-001", binding_affinity: -9.4, h_bonds: 4, target_protein: "EGFR" },
  { molecule_id: "QDF-002", binding_affinity: -8.9, h_bonds: 3, target_protein: "EGFR" },
  { molecule_id: "QDF-004", binding_affinity: -8.7, h_bonds: 5, target_protein: "EGFR" },
  { molecule_id: "QDF-003", binding_affinity: -8.2, h_bonds: 2, target_protein: "EGFR" },
  { molecule_id: "QDF-005", binding_affinity: -8.1, h_bonds: 2, target_protein: "EGFR" },
].map(item => ({ ...baseResult, ...item } as DockingResult));

export const DEMO_SIMULATION_RESULTS: SimulationResult[] = [
  { molecule_id: "QDF-001", smiles: "CC(=O)Nc1ccc(O)c(Cl)c1", time: 0, rmsd: 0.62 },
  { molecule_id: "QDF-001", smiles: "CC(=O)Nc1ccc(O)c(Cl)c1", time: 10, rmsd: 1.02 },
  { molecule_id: "QDF-001", smiles: "CC(=O)Nc1ccc(O)c(Cl)c1", time: 20, rmsd: 1.21 },
  { molecule_id: "QDF-001", smiles: "CC(=O)Nc1ccc(O)c(Cl)c1", time: 30, rmsd: 1.36 },
  { molecule_id: "QDF-001", smiles: "CC(=O)Nc1ccc(O)c(Cl)c1", time: 40, rmsd: 1.42 },
  { molecule_id: "QDF-001", smiles: "CC(=O)Nc1ccc(O)c(Cl)c1", time: 50, rmsd: 1.35 },
  { molecule_id: "QDF-001", smiles: "CC(=O)Nc1ccc(O)c(Cl)c1", time: 60, rmsd: 1.29 },
].map(item => ({ ...baseResult, ...item } as SimulationResult));

export const DEMO_QUANTUM_RESULTS: QuantumResult[] = [
  {
    molecule_id: "QDF-001",
    smiles: "CC(=O)Nc1ccc(O)c(Cl)c1",
    homo: -5.91,
    lumo: -1.52,
    homo_lumo_gap: 4.39,
    qsvm_score: 0.91,
    stability_score: 0.86,
    interpretation: "Highly Stable",
  },
  {
    molecule_id: "QDF-002",
    smiles: "COc1ccc(cc1)C(=O)NCCN",
    homo: -5.66,
    lumo: -1.41,
    homo_lumo_gap: 4.25,
    qsvm_score: 0.86,
    stability_score: 0.79,
    interpretation: "Stable",
  },
  {
    molecule_id: "QDF-004",
    smiles: "Nc1ncc(cn1)C2CCNCC2",
    homo: -5.52,
    lumo: -1.31,
    homo_lumo_gap: 4.21,
    qsvm_score: 0.81,
    stability_score: 0.72,
    interpretation: "Stable",
  },
].map(item => ({ ...baseResult, ...item } as QuantumResult));

export const DEMO_ARTIFACTS: ResultArtifactsResponse = {
  count: 5,
  items: [
    { name: "generated_candidates.csv", path: "demo/generated_candidates.csv", size_bytes: 18432 },
    { name: "filtered_candidates.csv", path: "demo/filtered_candidates.csv", size_bytes: 9216 },
    { name: "docking_scores.csv", path: "demo/docking_scores.csv", size_bytes: 12288 },
    { name: "simulation_rmsd.csv", path: "demo/simulation_rmsd.csv", size_bytes: 8192 },
    { name: "quantum_profiles.csv", path: "demo/quantum_profiles.csv", size_bytes: 10240 },
  ],
};

export const DEMO_OVERVIEW: ResultsOverview = {
  counts: {
    existing_ranked: DEMO_FILTERED_CANDIDATES.items.length,
    generated_candidates: DEMO_GENERATED_MOLECULES.length,
    qm_profiles: DEMO_QUANTUM_RESULTS.length,
    md_stability: DEMO_SIMULATION_RESULTS.length,
    md_rmsd: DEMO_SIMULATION_RESULTS.length,
    md_summaries: 1,
    qm_summaries: 1,
    docking_result_files: DEMO_DOCKING_RESULTS.length,
  },
  highlights: {
    top_existing: DEMO_FILTERED_CANDIDATES.items[0] ?? null,
    best_qm: DEMO_QUANTUM_RESULTS[0]
      ? {
          molecule_id: DEMO_QUANTUM_RESULTS[0].molecule_id,
          qsvm_score: DEMO_QUANTUM_RESULTS[0].qsvm_score,
          homo_lumo_gap: DEMO_QUANTUM_RESULTS[0].homo_lumo_gap,
        }
      : null,
  },
  sources: {
    existing_candidates: "demo-filtered.csv",
    generated_candidates: "demo-generated.csv",
    qm_results: "demo-quantum.csv",
    md_stability: "demo-simulation.csv",
    md_rmsd: "demo-simulation.csv",
  },
};

export const DEMO_PIPELINE_EXPERIMENTS: PipelineExperimentItem[] = [
  {
    experiment_id: "EXP-DEMO-001",
    protein: "EGFR",
    status: "completed",
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    experiment_id: "EXP-DEMO-002",
    protein: "HER2",
    status: "running",
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
];

export function getDemoPipelinePayload(experimentId?: string): Record<string, unknown> {
  return {
    experiment_id: experimentId ?? "EXP-DEMO-001",
    results: {
      generated: DEMO_GENERATED_MOLECULES,
      filtered: DEMO_FILTERED_CANDIDATES.items,
      docking: DEMO_DOCKING_RESULTS,
      simulation: {
        rmsd: DEMO_SIMULATION_RESULTS,
      },
      quantum: DEMO_QUANTUM_RESULTS,
      artifacts: DEMO_ARTIFACTS.items,
    },
    simulation_video: DEMO_VIDEO_URL,
    overview: DEMO_OVERVIEW,
  };
}

export function hasAnyPipelineRows(data: {
  generated: unknown[];
  filtered: unknown[];
  docking: unknown[];
  simulation?: unknown[];
  quantum?: unknown[];
}): boolean {
  return (
    data.generated.length > 0 ||
    data.filtered.length > 0 ||
    data.docking.length > 0 ||
    (data.simulation?.length ?? 0) > 0 ||
    (data.quantum?.length ?? 0) > 0
  );
}
