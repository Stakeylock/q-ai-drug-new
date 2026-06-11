/**
 * Centralized Mock API Layer for Oncology Research Platform
 * Provides realistic oncology drug discovery data with async delays.
 */

import type {
  DatasetsResponse,
  DatasetDetailsResponse,
  StatsResponse,
  MoleculesListResponse,
  MoleculeDetails,
  SimilaritySearchResponse,
  EmbeddingMapResponse,
  ResultsOverview,
  GeneratedMoleculeResult,
  DockingResult,
  SimulationResult,
  QuantumResult,
  RankedCandidatesResponse,
  CandidateProfilesResponse,
  ResultArtifactsResponse,
  ExperimentSummaryResponse,
  RecentRunsResponse,
} from "@/types/api";

import { 
  WorkspacePipelineResponse, 
  WorkspacePipelineStatusResponse,
  PipelineExperimentItem
} from "./api";

/** Helper to simulate network latency */
const sleep = (ms = 800) => new Promise((resolve) => setTimeout(resolve, ms));

/** Realistic oncology-themed SMILES and IDs */
const MOCK_SMILES = [
  "CC1=C(C(=CC=C1)C(=O)NC2=CC(=C(C=C2)CN3CCN(CC3)C)C(F)(F)F)C#CC4=CN=C5C(=C4)C=CN=C5", // Ponatinib
  "CN1CCN(CC1)CC2=CC=C(C=C2)C(=O)NC3=CC=C(C=C3C)NC4=NC=CC(=N4)C5=CN=CC=C5", // Imatinib
  "CS(=O)(=O)CCNC1=CC=C(C=C1)C2=CC3=C(C=C2)N=CN=C3NC4=CC(=C(C=C4)OCC5=CC=CC=C5F)Cl", // Lapatinib
];

const ONCOLOGY_TARGETS = ["EGFR", "PARP1", "PIK3CA", "KRAS", "BRCA1", "ALK", "MTOR"];

/** 1. Dashboard & Research Summary */
export async function getResearchSummary(): Promise<ResultsOverview> {
  await sleep(600);
  return {
    counts: {
      existing_ranked: 1240,
      generated_candidates: 450,
      qm_profiles: 85,
      md_stability: 32,
      md_rmsd: 1.4,
      md_summaries: 12,
      qm_summaries: 8,
      docking_result_files: 145,
    },
    highlights: {
      top_existing: { molecule_id: "QDF-882", score: -11.4 },
      best_qm: { molecule_id: "QDF-122", score: 0.98 },
    },
    sources: {
      existing_candidates: "ChEMBL_v33_Oncology",
      generated_candidates: "Generative_Run_0514",
      qm_results: "ORCA_v5_B3LYP",
      md_stability: "OpenMM_Amber14SB",
      md_rmsd: "GROMACS_2023",
    },
  };
}

export async function getDashboardData(): Promise<{ summary: ExperimentSummaryResponse, recent: RecentRunsResponse }> {
  await sleep(700);
  return {
    summary: { experiment_count: 142 },
    recent: {
      items: [
        {
          run_id: "RUN-001",
          experiment_name: "EGFR Kinase Inhibition",
          dataset_name: "ZINC250k",
          status: "COMPLETED",
          created_at: new Date().toISOString(),
        },
        {
          run_id: "RUN-002",
          experiment_name: "PARP1 Synthetic Lethality",
          dataset_name: "Enamine_HHT",
          status: "RUNNING",
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          run_id: "RUN-003",
          experiment_name: "PIK3CA Mutation Screen",
          dataset_name: "FDA_Approved",
          status: "FAILED",
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    },
  };
}

/** 2. Candidates & Molecules */
export async function getCandidates(limit = 10): Promise<RankedCandidatesResponse> {
  await sleep(800);
  return {
    source: "existing",
    file: "candidates_top_ranked.csv",
    count: limit,
    items: Array.from({ length: limit }).map((_, i) => ({
      molecule_id: `QDF-${800 + i}`,
      smiles: MOCK_SMILES[i % MOCK_SMILES.length],
      binding_affinity: -(8 + Math.random() * 4).toFixed(1),
      qed: (0.7 + Math.random() * 0.25).toFixed(3),
      logp: (2 + Math.random() * 3).toFixed(2),
    })),
  };
}

export async function getMolecules(page = 1, limit = 50): Promise<MoleculesListResponse> {
  await sleep(1000);
  return {
    page,
    limit,
    total_items: 250000,
    total_pages: 5000,
    items: Array.from({ length: limit }).map((_, i) => ({
      molecule_id: `MOL-${10000 + (page - 1) * limit + i}`,
      smiles: MOCK_SMILES[i % MOCK_SMILES.length],
      mw: 300 + Math.random() * 200,
      logp: 1 + Math.random() * 4,
      qed: 0.4 + Math.random() * 0.5,
      dataset: "ZINC250k",
    })),
  };
}

/** 3. Docking & GNINA */
export async function getDockingResults(limit = 10): Promise<DockingResult[]> {
  await sleep(900);
  return Array.from({ length: limit }).map((_, i) => ({
    molecule_id: `DOCK-${100 + i}`,
    binding_affinity: -(7 + Math.random() * 5).toFixed(2) as any,
    h_bonds: Math.floor(Math.random() * 6),
    target_protein: ONCOLOGY_TARGETS[i % ONCOLOGY_TARGETS.length],
    source: "docking",
    experiment_id: "demo-experiment",
    pipeline_stage: "docking",
    engine: "vina",
    created_at: new Date().toISOString(),
    provenance: { source: "vina", evidence_status: "docked" }
  }));
}

export async function getGninaLogs(experimentId: string): Promise<string[]> {
  await sleep(500);
  return [
    `[INFO] Initializing GNINA engine for ${experimentId}`,
    "[INFO] Loading receptor: target_egfr_mutant.pdbqt",
    "[INFO] Detected 244 ligands for scoring",
    "[DEBUG] Processing batch 1/12",
    "[INFO] CNN scoring in progress: 42% complete",
    "[INFO] Refinement iteration 4: convergence reached",
  ];
}

/** 4. Quantum Metrics */
export async function getQuantumMetrics(limit = 10): Promise<QuantumResult[]> {
  await sleep(1200);
  return Array.from({ length: limit }).map((_, i) => ({
    molecule_id: `QM-${200 + i}`,
    smiles: MOCK_SMILES[i % MOCK_SMILES.length],
    homo: -5.4 - Math.random(),
    lumo: -1.2 - Math.random(),
    homo_lumo_gap: 3.8 + Math.random() * 2,
    qsvm_score: 0.85 + Math.random() * 0.1,
    stability_score: 0.92 + Math.random() * 0.05,
    interpretation: Math.random() > 0.2 ? "Highly Stable" : "Stable",
    source: "quantum",
    experiment_id: "demo-experiment",
    pipeline_stage: "quantum",
    engine: "orca",
    created_at: new Date().toISOString(),
    provenance: { source: "orca", evidence_status: "calculated" }
  }));
}

/** 5. Experiments & Validation */
export async function getExperiments(): Promise<PipelineExperimentItem[]> {
  await sleep(800);
  return Array.from({ length: 5 }).map((_, i) => ({
    experiment_id: `EXP-ID-${100 + i}`,
    protein: ONCOLOGY_TARGETS[i % ONCOLOGY_TARGETS.length],
    status: i === 0 ? "RUNNING" : "COMPLETED",
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
  }));
}

export async function getValidationStatus(experimentId: string): Promise<WorkspacePipelineStatusResponse> {
  const progress = Math.min(100, Math.floor(Date.now() / 1000) % 101);
  return {
    status: progress < 100 ? "RUNNING" : "COMPLETED",
    stage: progress < 30 ? "SCREENING" : progress < 70 ? "DOCKING" : "QUANTUM_RERANKING",
    progress,
    logs: await getGninaLogs(experimentId),
  };
}

/** 6. Similarity Search */
export async function getMolecularSimilarity(smiles: string, topK = 10): Promise<SimilaritySearchResponse> {
  await sleep(1500);
  return {
    neighbors: Array.from({ length: topK }).map((_, i) => ({
      molecule_id: `SIM-${500 + i}`,
      similarity: 0.95 - i * 0.02,
      smiles: smiles || MOCK_SMILES[0],
      mw: 350 + i * 10,
      qed: 0.88 - i * 0.01,
    })),
  };
}

/** Fallback mechanism for api.ts */
export const mockApi = {
  getDashboardData,
  getCandidates,
  getMolecules,
  getExperiments,
  getQuantumMetrics,
  getDockingResults,
  getMolecularSimilarity,
  getValidationStatus,
  getGninaLogs,
  getResearchSummary,
};
