/**
 * API response types — aligned with P5 ↔ P3 API Contract
 * @see API Contract.txt
 */
import { ProvenanceMetadata } from "./experiment";

// ─── 1. Datasets ─────────────────────────────────────────────────────────────

/** Dataset name returned by GET /datasets (e.g. ZINC250k, ChEMBL, PDBbind, DrugBank) */
export type Dataset = string;

/** Response: GET /datasets */
export interface DatasetsResponse {
  count: number;
  datasets: Dataset[];
}

/** Response: GET /datasets/{name} */
export interface DatasetDetailsResponse {
  name: string;
  file: string;
  count: number;
  preview: Array<Record<string, unknown>>;
}

// ─── 2. Dataset Statistics ───────────────────────────────────────────────────

/** Histogram bin + counts for a distribution */
export interface Distribution {
  bins: number[];
  counts: number[];
}

/** Summary statistics from GET /stats */
export interface StatsSummary {
  molecule_count: number;
  avg_mw: number;
  avg_logp: number;
  avg_qed: number;
}

/** Distributions keyed by property (mw, logp, tpsa, qed) */
export interface StatsDistributions {
  mw?: Distribution;
  logp?: Distribution;
  tpsa?: Distribution;
  qed?: Distribution;
}

/** Response: GET /stats?dataset=... */
export interface StatsResponse {
  dataset?: string;
  summary: StatsSummary;
  distributions: StatsDistributions;
}

// ─── 3. Molecule List (Explorer Table) ───────────────────────────────────────

/** Molecule list item from GET /molecules */
export interface Molecule {
  molecule_id: string;
  smiles: string;
  mw: number;
  logp: number;
  qed: number;
  dataset: string;
}

/** Response: GET /molecules */
export interface MoleculesListResponse {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  items: Molecule[];
}

// ─── 4. Molecule Details (Viewer Panel) ──────────────────────────────────────

/** Structure representations from GET /molecule/{id} */
export interface MoleculeStructures {
  smiles: string;
  inchi: string;
  sdf: string;
  pdb: string;
}

/** Computed molecular properties */
export interface MoleculeProperties {
  mw: number;
  logp: number;
  tpsa: number;
  qed: number;
  hba: number;
  hbd: number;
  rotatable_bonds: number;
}

/** Response: GET /molecule/{id} */
export interface MoleculeDetails {
  molecule_id: string;
  dataset: string;
  structures: MoleculeStructures;
  properties: MoleculeProperties;
}

// ─── 5. Similarity Search ────────────────────────────────────────────────────

/** Single neighbor from similarity search */
export interface SimilarityResult {
  molecule_id: string;
  similarity: number;
  smiles: string;
  mw?: number;
  qed?: number;
}

/** Response: POST /embedding/search, GET /molecule/{id}/similar */
export interface SimilaritySearchResponse {
  neighbors: SimilarityResult[];
}

// ─── 6. Chemical Space (UMAP) ────────────────────────────────────────────────

/** Source of the molecule in chemical space */
export type EmbeddingSource = "dataset" | "generated" | "fda";

/** UMAP point for chemical space visualization */
export interface EmbeddingPoint {
  x: number;
  y: number;
  molecule_id: string;
  dataset: string;
  qed: number;
  mw: number;
  logp?: number;
  source: EmbeddingSource;
}

/** Response: GET /embedding/umap */
export type EmbeddingMapResponse = EmbeddingPoint[];

// ─── Error Format ────────────────────────────────────────────────────────────

/** Standardized error response from all endpoints */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

// ─── 7. Results Showcase ─────────────────────────────────────────────────────

export interface BaseScientificResult {
  schema_version?: string;
  source: string;
  experiment_id: string;
  pipeline_stage: string;
  engine: string;
  created_at: string;
  provenance: ProvenanceMetadata;

  // Uncertainty Normalization
  confidence_score?: number;
  uncertainty_score?: number;
  applicability_domain?: Record<string, any>;
  prediction_reliability?: string;

  // Artifact Linkage
  artifact_id?: string;
  artifact_uri?: string;
  report_id?: string;
  imported_from?: string;

  // Scientific Validity
  partial_result?: boolean;

  // Aging / Staleness
  imported_at?: string;
  artifact_age_days?: number;
  stale?: boolean;
}

export interface GeneratedMoleculeResult extends BaseScientificResult {
  molecule_id: string;
  smiles: string;
  molecular_weight: number;
  logp: number;
  qed: number;
}

export interface DockingResult extends BaseScientificResult {
  molecule_id: string;
  binding_affinity: number;
  /** @deprecated use target_id */
  target_protein?: string;
  target_id?: string;
  /** @deprecated mapped from provenance metadata */
  h_bonds?: number;
}

export interface GninaResult extends BaseScientificResult {
  molecule_id: string;
  cnn_score: number;
  cnn_affinity: number;
  vina_score: number;
  pose_evidence: string;
}

export interface SimulationResult extends BaseScientificResult {
  molecule_id: string;
  smiles: string;
  time: number;
  rmsd: number;
}

export interface QuantumResult extends BaseScientificResult {
  molecule_id: string;
  smiles: string;
  homo?: number;
  lumo?: number;
  homo_lumo_gap: number;
  qsvm_score: number;
  stability_score: number;
  interpretation: "Highly Stable" | "Stable" | "Monitor";
}

export interface ResultsOverviewCounts {
  existing_ranked: number;
  generated_candidates: number;
  qm_profiles: number;
  md_stability: number;
  md_rmsd: number;
  md_summaries: number;
  qm_summaries: number;
  docking_result_files: number;
}

export interface ResultsOverview {
  counts: ResultsOverviewCounts;
  highlights: {
    top_existing: Record<string, string | number> | null;
    best_qm: Record<string, string | number> | null;
  };
  sources: {
    existing_candidates: string;
    generated_candidates: string;
    qm_results: string;
    md_stability: string;
    md_rmsd: string;
  };
}

export interface RankedCandidatesResponse {
  source: "existing" | "generated";
  file: string;
  count: number;
  items: Array<Record<string, string | number>>;
}

export interface CandidateProfilesResponse {
  count: number;
  items: Array<Record<string, string | number>>;
}

export interface ResultArtifact {
  path: string;
  name: string;
  size_bytes: number;
}

export interface ResultArtifactsResponse {
  count: number;
  items: ResultArtifact[];
}

// ─── 8. Reports / Dossiers ─────────────────────────────────────────────────

export type ReportType =
  | "project_summary"
  | "candidate_dossier"
  | "experiment_report"
  | "imported_q_ai_drug"
  | "custom";

export type ReportStatus =
  | "draft"
  | "queued"
  | "generating"
  | "completed"
  | "failed"
  | "imported";

export type ReportSource = "qudrugforge" | "q_ai_drug" | "manual_import";

export type ReportSectionStatus = "available" | "missing" | "pending";

export interface ReportSectionDataRefs {
  molecules: string[];
  docking_results: string[];
  gnina_results: string[];
  quantum_results: string[];
  admet_results: string[];
  simulation_results: string[];
}

export interface ReportSection {
  section_id: string;
  title: string;
  status: ReportSectionStatus;
  summary: string;
  data_refs: ReportSectionDataRefs;
}

export interface ReportMetadata {
  candidate_count: number;
  target_count: number;
  has_docking: boolean;
  has_gnina: boolean;
  has_quantum: boolean;
  has_admet: boolean;
  has_simulations: boolean;
  imported_source_dir?: string | null;
}

export interface ReportItem extends BaseScientificResult {
  report_id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  report_type: ReportType | string;
  status: ReportStatus | string;
  source_module: string;
  candidate_molecule_ids: string[];
  target_ids: string[];
  experiment_ids: string[];
  sections: ReportSection[];
  file_ids: string[];
  primary_file_id?: string | null;
  metadata: ReportMetadata & Record<string, unknown>;
  created_by?: string | null;
  updated_at: string;
  completed_at?: string | null;
  error_message?: string | null;
}

export interface ReportSummaryResponse {
  project_id: string;
  total_reports: number;
  completed_reports: number;
  draft_reports: number;
  imported_reports: number;
  failed_reports: number;
  available_sections: Record<string, boolean>;
}

export interface ReportListResponse {
  project_id: string;
  reports: ReportItem[];
  count: number;
  total: number;
  limit: number;
  skip: number;
}

export interface ReportFileItem {
  file_id: string;
  filename: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  download_url: string;
}

export interface ReportFilesResponse {
  report_id: string;
  files: ReportFileItem[];
}

export interface ReportGenerationResult {
  report: ReportItem;
  generated_files: string[];
  warnings: string[];
}

export interface ReportGenerationResponse {
  success: boolean;
  data: ReportGenerationResult;
  message: string;
}

export interface CreateReportRequest {
  title: string;
  report_type: ReportType;
  experiment_id?: string | null;
  candidate_molecule_ids?: string[];
  target_ids?: string[];
  experiment_ids?: string[];
  sections_requested?: string[];
}

export interface UpdateReportRequest {
  title?: string;
  candidate_molecule_ids?: string[];
  target_ids?: string[];
  sections_requested?: string[];
}

export interface ImportQAiDrugReportRequest {
  source_output_dir?: string | null;
  file_ids?: string[];
  title?: string;
}

export interface ReportGenerateRequest {
  formats?: string[];
  include_sections?: string[];
  top_n?: number;
}

export interface ProjectSummaryGenerateRequest {
  title?: string;
  formats?: string[];
  top_n?: number;
}

export interface CandidateDossierGenerateRequest {
  title?: string;
  candidate_molecule_ids?: string[];
  formats?: string[];
  top_n?: number;
}

// ─── 8. Experiment Dashboard ────────────────────────────────────────────────

export interface ExperimentSummaryResponse {
  experiment_count: number;
}

export interface RecentRun {
  run_id: string;
  experiment_name: string;
  dataset_name: string;
  status: string;
  created_at: string;
}

export interface RecentRunsResponse {
  items: RecentRun[];
}
