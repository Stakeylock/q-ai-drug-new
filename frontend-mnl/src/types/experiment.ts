export type ExperimentStatus = "queued" | "running" | "importing_results" | "completed" | "failed" | "cancelled" | "partial";

export type PipelineStageState = "pending" | "running" | "completed" | "failed";

export interface ProvenanceMetadata {
  source: string;
  evidence_status: string;
  import_batch_id?: string;
  engine?: string;
  claim_boundary?: string;
  provenance_notes?: string;
}

export interface OrchestrationMetadata {
  orchestration_stage?: string;
  execution_mode?: string;
  stage_started_at?: string;
  stage_completed_at?: string;
  retry_count?: number;
  dependency_status?: Record<string, string>;
  partial_failure?: boolean;
}

export interface StandardMetadata {
  provenance?: ProvenanceMetadata;
  orchestration?: OrchestrationMetadata;
}

export interface Experiment {
  schema_version?: string;
  id: string;
  experiment_id?: string;
  name: string;
  type: string;
  engine: string;
  source?: string;
  pipeline_stage?: string;
  status: ExperimentStatus;
  progress: number;
  parameters: Record<string, any>;
  provenance?: ProvenanceMetadata;
  metadata?: StandardMetadata;
  
  // Normalized ISO-8601 timestamps
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;

  // ---------------------------------------------------------
  // Deprecated Legacy Aliases (to reduce migration pain)
  // ---------------------------------------------------------
  /** @deprecated use created_at instead */
  createdAt?: string;
  /** @deprecated mapped from parameters */
  input?: any;
  /** @deprecated mapped from metadata */
  resultsSummary?: any;
}

export interface ExperimentPipelineStages {
  generated: PipelineStageState;
  docking: PipelineStageState;
  simulation: PipelineStageState;
  quantum: PipelineStageState;
}

export interface ExperimentRecord extends Experiment {
  pipelineStages: ExperimentPipelineStages;
}

export interface ExperimentInput {
  protein: string;
  constraints: {
    logP: number;
    qed: number;
    toxicity: string;
  };
}