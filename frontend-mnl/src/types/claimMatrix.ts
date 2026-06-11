export interface ClaimMatrixEntry {
  _id: string;
  project_id: string;
  evidence_level: string; // "Level 0", "Level 1", "Level 2", "Level 3"
  name: string;
  definition: string;
  current_status: string;
  allowed_claim: string;
  forbidden_claim: string;
  required_next_evidence: string;
  created_at: string;
}

export interface ClaimMatrixSummary {
  total_claims: number;
  levels_count: Record<string, number>;
  status_counts: Record<string, number>;
}

export interface ClaimMatrixListResponse {
  items: ClaimMatrixEntry[];
  total: number;
}
