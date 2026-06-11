import { apiClient } from "./api";
import type { ClaimMatrixListResponse, ClaimMatrixSummary } from "@/types/claimMatrix";

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const claimMatrixApi = {
  /**
   * Fetches the full claim matrix for a project
   */
  async getProjectClaimMatrix(projectId: string): Promise<ApiEnvelope<ClaimMatrixListResponse>> {
    return apiClient.get<ApiEnvelope<ClaimMatrixListResponse>>(`/projects/${projectId}/claim-matrix`);
  },

  /**
   * Fetches the summary of the claim matrix for a project
   */
  async getProjectClaimMatrixSummary(projectId: string): Promise<ApiEnvelope<ClaimMatrixSummary>> {
    return apiClient.get<ApiEnvelope<ClaimMatrixSummary>>(`/projects/${projectId}/claim-matrix/summary`);
  },
};
