/**
 * API service layer for the scientific dashboard.
 * Uses fetch with typed responses and centralized error handling.
 * Aligned with P5 ↔ P3 API Contract.
 */

import type {
  CandidateDossierGenerateRequest,
  CandidateProfilesResponse,
  DockingResult,
  ExperimentSummaryResponse,
  Dataset,
  DatasetDetailsResponse,
  DatasetsResponse,
  Distribution,
  EmbeddingMapResponse,
  GeneratedMoleculeResult,
  MoleculeDetails,
  MoleculesListResponse,
  QuantumResult,
  RankedCandidatesResponse,
  RecentRunsResponse,
  CreateReportRequest,
  ResultArtifactsResponse,
  ResultsOverview,
  ReportFileItem,
  ReportFilesResponse,
  ReportGenerationResponse,
  ReportGenerateRequest,
  ReportItem,
  ReportListResponse,
  ReportSource,
  ReportSummaryResponse,
  ImportQAiDrugReportRequest,
  ProjectSummaryGenerateRequest,
  SimilarityResult,
  SimilaritySearchResponse,
  SimulationResult,
  StatsResponse,
  UpdateReportRequest,
} from "@/types/api";
import * as mockApi from "./mockApi";


/** Normalize base URL by trimming whitespace and trailing slashes. */
function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** Resolve API base URL for both browser and server runtime contexts. */
function resolveApiBaseUrl(): string {
  const configured =
    typeof process !== "undefined"
      ? (process.env?.NEXT_PUBLIC_API_URL || process.env?.NEXT_PUBLIC_API_BASE_URL)
      : undefined;

  let url = "";
  if (configured && configured.trim()) {
    url = normalizeBaseUrl(configured);
    if (typeof window !== "undefined" && window.location?.hostname) {
      url = url.replace(/(:\/\/)backend(\b|:)/, `$1${window.location.hostname}$2`);
    }
  } else if (typeof window !== "undefined" && window.location?.origin) {
    url = normalizeBaseUrl(window.location.origin);
  } else {
    const hostFromEnv =
      (typeof process !== "undefined" &&
        (process.env?.NEXT_PUBLIC_SITE_URL || process.env?.VERCEL_URL)) ||
      "";
    if (hostFromEnv) {
      const withProtocol = hostFromEnv.startsWith("http")
        ? hostFromEnv
        : `https://${hostFromEnv}`;
      url = normalizeBaseUrl(withProtocol);
    }
  }

  if (url && !url.endsWith("/api/v1")) {
    url = `${url}/api/v1`;
  }
  return url;
}

/** Base URL for API requests; configurable via NEXT_PUBLIC_API_URL. */
const API_BASE_URL = resolveApiBaseUrl();

export function isDemoMode(): boolean {
  // Check localStorage first (useful for E2E testing overrides)
  if (typeof window !== "undefined") {
    try {
      const localVal = window.localStorage.getItem("demo_mode");
      if (localVal !== null) {
        return localVal === "true" || localVal === "1";
      }
    } catch (e) {}
  }

  // Check Environment Variable explicitly
  const envValue = 
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEMO_MODE) || 
    (typeof window !== "undefined" && (window as any)._NEXT_DATA_?.runtimeConfig?.NEXT_PUBLIC_DEMO_MODE);

  if (envValue === "true" || envValue === true || envValue === "1") {
    return true;
  }

  // Default to false for runtime scientific honesty!
  return false;
}

const API_TIMEOUT_MS =
  (typeof process !== "undefined" &&
    Number(process.env?.NEXT_PUBLIC_API_TIMEOUT_MS || process.env?.NEXT_PUBLIC_API_TIMEOUT)) ||
  10000;

const EMPTY_DISTRIBUTION: Distribution = {
  bins: [],
  counts: [],
};

/** Custom error for API failures */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
    public url?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Convert technical API errors into concise user-friendly messages. */
export function toFriendlyErrorMessage(
  error: unknown,
  fallback = "We could not load this data right now. Please try again."
): string {
  if (error instanceof ApiError) {
    if (error.status === 408) {
      return "The request took too long. Please try again.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Your session needs attention. Please sign in again and retry.";
    }
    if (error.status === 404) {
      return "We could not find the requested data.";
    }
    if (error.status && error.status >= 500) {
      return "The server is busy right now. Please try again shortly.";
    }
    if (error.status && error.status >= 400) {
      return "Some data could not be loaded. Please retry.";
    }
  }

  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("network")) {
      return "Connection issue detected. Please check your network and retry.";
    }
    return fallback;
  }

  return fallback;
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  params?: QueryParams;
  body?: unknown;
  timeoutMs?: number;
}

export type WorkspaceToxicityLevel = "Low" | "Medium" | "High";

export interface WorkspacePipelineRequest {
  protein: string;
  constraints?: {
    logp?: number;
    qed?: number;
    toxicity?: WorkspaceToxicityLevel;
    callback_url?: string;
  };
}

export interface WorkspacePipelineResponse {
  experimentId?: string;
  runId?: string;
  stage?: string;
  message?: string;
}

export interface WorkspacePipelineStatusResponse {
  status: string;
  stage: string;
  progress: number;
  logs: string[];
}

export interface PipelineExperimentItem {
  experiment_id: string;
  protein: string;
  status: string;
  created_at: string;
}

export interface CreatePipelineExperimentRequest {
  experiment_id: string;
  protein: string;
}

interface PipelineExperimentsResponse {
  experiments: PipelineExperimentItem[];
}

/** Build full URL with optional path and query params */
function buildUrl(
  path: string,
  params?: QueryParams
): string {
  const endpointPath = `/${path.replace(/^\/+/, "")}`;

  if (!API_BASE_URL) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return query ? `${endpointPath}?${query}` : endpointPath;
  }

  const base = new URL(`${API_BASE_URL}/`);
  const normalizedEndpoint = path.replace(/^\/+/, "");
  const basePath = base.pathname.replace(/\/+$/, "");
  base.pathname = `${basePath}/${normalizedEndpoint}`.replace(/\/+/g, "/");

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        base.searchParams.set(key, String(value));
      }
    });
  }
  return base.toString();
}

/** Core request helper with timeout, JSON parsing, and normalized API errors */
async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { params, body, timeoutMs = API_TIMEOUT_MS, ...fetchOptions } = options;
  const url = buildUrl(path, params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const mergedHeaders = new Headers(fetchOptions.headers ?? {});
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData && !mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }

  // Automatic token injection from localStorage
  if (typeof window !== "undefined") {
    try {
      const token = localStorage.getItem("auth_token");
      if (token && !mergedHeaders.has("Authorization")) {
        mergedHeaders.set("Authorization", `Bearer ${token}`);
      }
    } catch (e) {}
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      method,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as BodyInit)
            : JSON.stringify(body),
      headers: mergedHeaders,
      signal: controller.signal,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("backend-connection-status", { detail: { connected: true } }));
    }
  } catch (error) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("backend-connection-status", { detail: { connected: false } }));
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(`Request timeout after ${timeoutMs}ms`, 408, undefined, url);
    }
    throw new ApiError("Network request failed", undefined, error, url);
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();
  let parsedBody: unknown;
  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = rawText;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      `API error: ${response.status} ${response.statusText}`,
      response.status,
      parsedBody,
      url
    );
  }

  if (!rawText) {
    return undefined as T;
  }

  if (parsedBody === rawText) {
    throw new ApiError("Invalid JSON response", response.status, rawText, url);
  }

  return parsedBody as T;
}

export async function get<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>("GET", path, options);
}

export async function post<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>("POST", path, options);
}

export async function put<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>("PUT", path, options);
}

export async function patch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>("PATCH", path, options);
}

export async function del<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>("DELETE", path, options);
}

export const apiDelete = del;

// Aligned with Step 3 specifications:
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

function getActiveProjectId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem("active_project_id");
  } catch {
    return null;
  }
}

function requireActiveProjectId(): string {
  const projectId = getActiveProjectId();
  if (!projectId) {
    throw new ApiError("No active project selected.");
  }
  return projectId;
}

export const apiGet = get;
export const apiPost = post;
export const apiPatch = patch;
export const apiPut = put;

export async function apiUpload<T>(path: string, formData: FormData, options: ApiRequestOptions = {}): Promise<T> {
  return post<T>(path, { ...options, body: formData });
}

export function buildFileDownloadUrl(fileId: string): string {
  return `${API_BASE_URL}/files/${fileId}/download`;
}

export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
  upload: apiUpload,
};

/** Check backend health status explicitly */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const configured =
      typeof process !== "undefined"
        ? (process.env?.NEXT_PUBLIC_API_URL || process.env?.NEXT_PUBLIC_API_BASE_URL)
        : undefined;
    let url = "";
    if (configured && configured.trim()) {
      url = configured.trim().replace(/\/+$/, "");
    } else if (typeof window !== "undefined" && window.location?.origin) {
      url = window.location.origin.trim().replace(/\/+$/, "");
    } else {
      return false;
    }
    if (!url.endsWith("/api/v1")) {
      url = `${url}/api/v1`;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${url}/system/info`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPlaceholderRunId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

/** Backward-compatible internal fetch wrapper for existing endpoint helpers */
async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const method = (options.method?.toUpperCase() as "GET" | "POST" | "PUT" | "DELETE" | undefined) ?? "GET";
  if (method === "GET") {
    return get<T>(path, options);
  }
  if (method === "POST") {
    return post<T>(path, options);
  }
  if (method === "PUT") {
    return put<T>(path, options);
  }
  if (method === "DELETE") {
    return del<T>(path, options);
  }
  throw new ApiError(`Unsupported HTTP method: ${method}`);
}

// ─── API functions ───────────────────────────────────────────────────────────

/** Fetch available datasets and their total count. */
export async function getDatasets(): Promise<DatasetsResponse> {
  if (isDemoMode()) {
    return { count: 3, datasets: ["ZINC250k", "ChEMBL", "DrugBank"] };
  }
  try {
    const data = await apiFetch<DatasetsResponse>("/datasets");
    return {
      count: Number(data?.count ?? 0),
      datasets: Array.isArray(data?.datasets) ? [...data.datasets] : [],
    };
  } catch (err) {
    if (isDemoMode()) {
      return { count: 3, datasets: ["ZINC250k", "ChEMBL", "DrugBank"] };
    }
    throw err;
  }
}

/** Fetch available dashboard metrics and recent runs with fallback */
export async function getDashboardData() {
  if (isDemoMode()) {
    return mockApi.getDashboardData();
  }
  try {
    const [summary, recent] = await Promise.all([
      getExperimentSummary(),
      getRecentRuns()
    ]);
    return { summary, recent };
  } catch (err) {
    throw err;
  }
}


/** Fetch a single dataset and a preview of the first 10 rows. */
export async function getDataset(name: string): Promise<DatasetDetailsResponse> {
  if (isDemoMode()) {
    return { name, file: `${name}.csv`, count: 1240, preview: [] };
  }
  return apiFetch<DatasetDetailsResponse>(`/datasets/${encodeURIComponent(name)}`);
}

/** Fetch dataset statistics, optionally filtered by dataset */
export async function getStats(dataset?: string): Promise<StatsResponse> {
  if (isDemoMode()) {
     return {
       dataset,
       summary: { molecule_count: 1240, avg_mw: 450, avg_logp: 2.8, avg_qed: 0.72 },
       distributions: { mw: EMPTY_DISTRIBUTION, logp: EMPTY_DISTRIBUTION, tpsa: EMPTY_DISTRIBUTION, qed: EMPTY_DISTRIBUTION }
     };
  }
  return await apiFetch<StatsResponse>("/stats", {
    params: dataset ? { dataset } : undefined,
  });
}

/** Fetch molecules with optional filters and pagination */
export async function getMolecules(params: {
  page?: number;
  limit?: number;
  dataset?: string;
  min_qed?: number;
  max_logp?: number;
  sort_by?: "mw" | "logp" | "qed";
  order?: "asc" | "desc";
  search?: string;
} = {}): Promise<MoleculesListResponse> {
  const {
    page = 1,
    limit = 50,
  } = params;
  if (isDemoMode()) {
    return mockApi.getMolecules(page, limit);
  }
  const projectId = typeof window !== "undefined" ? window.localStorage.getItem("active_project_id") : null;
  if (!projectId) {
    return {
      page: page,
      limit: limit,
      total_items: 0,
      total_pages: 0,
      items: []
    };
  }
  try {
    const res = await apiFetch<any>(`/projects/${projectId}/molecules`, {
      params,
    });
    if (res && res.success && res.data) {
      return {
        page: page,
        limit: limit,
        total_items: res.data.total || (res.data.items?.length || 0),
        total_pages: Math.ceil((res.data.total || 1) / limit),
        items: (res.data.items || []).map((m: any) => ({
          molecule_id: m.compound_id || m.id,
          smiles: m.smiles,
          mw: m.mw !== undefined && m.mw !== null ? m.mw : 400,
          logp: m.logp !== undefined && m.logp !== null ? m.logp : 2.5,
          qed: m.qed !== undefined && m.qed !== null ? m.qed : 0.72,
          dataset: m.dataset || "Imported"
        }))
      };
    }
    return {
      page: page,
      limit: limit,
      total_items: 0,
      total_pages: 0,
      items: []
    };
  } catch (err) {
    throw err;
  }
}

/** Fetch a single molecule by ID */
export async function getMoleculeById(
  id: string
): Promise<MoleculeDetails | null> {
  if (isDemoMode()) {
     return {
       molecule_id: id,
       dataset: "ZINC250k",
       structures: { smiles: "C", inchi: "", sdf: "", pdb: "" },
       properties: { mw: 400, logp: 2.5, tpsa: 80, qed: 0.8, hba: 5, hbd: 2, rotatable_bonds: 6 }
     };
  }
  try {
    const projectId = getActiveProjectId();
    if (!projectId) {
      return null;
    }
    const response = await apiFetch<ApiEnvelope<any>>(
      `/projects/${encodeURIComponent(projectId)}/molecules/${encodeURIComponent(id)}`
    );
    const molecule = response.data;
    return {
      molecule_id: molecule.id || molecule.molecule_id || id,
      dataset: molecule.dataset || molecule.source || "Project",
      structures: {
        smiles: molecule.smiles || "",
        inchi: molecule.inchi || "",
        sdf: molecule.sdf || "",
        pdb: molecule.pdb || "",
      },
      properties: {
        mw: Number(molecule.mw ?? molecule.molecular_weight ?? 0),
        logp: Number(molecule.logp ?? 0),
        tpsa: Number(molecule.tpsa ?? 0),
        qed: Number(molecule.qed ?? 0),
        hba: Number(molecule.hba ?? 0),
        hbd: Number(molecule.hbd ?? 0),
        rotatable_bonds: Number(molecule.rotatable_bonds ?? 0),
      },
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Search for molecules similar to the given SMILES string */
export async function searchSimilar(
  smiles: string,
  topK: number = 10
): Promise<SimilaritySearchResponse> {
  const projectId = typeof window !== "undefined" ? window.localStorage.getItem("active_project_id") : null;
  if (!projectId) {
    return { neighbors: [] };
  }
  try {
    const data = await apiFetch<any>(`/projects/${projectId}/similarity/search`, {
      method: "POST",
      body: { query_smiles: smiles, top_k: topK },
    });

    if (data && data.success && data.data) {
      return { neighbors: data.data.neighbors || [] };
    }
    return { neighbors: [] };
  } catch (err) {
    if (isDemoMode()) {
      return mockApi.getMolecularSimilarity(smiles, topK);
    }
    throw err;
  }
}


/** Fetch UMAP embedding points for chemical space visualization */
export async function getEmbeddingMap(
  dataset?: string,
  limit: number = 5000
): Promise<EmbeddingMapResponse> {
  if (isDemoMode()) {
    // Return some basic random points for demo
    return Array.from({ length: 1000 }).map((_, i) => ({
      molecule_id: `MOL-${i}`,
      dataset: i % 3 === 0 ? "ZINC250k" : i % 3 === 1 ? "ChEMBL" : "DrugBank",
      x: (Math.random() - 0.5) * 20,
      y: (Math.random() - 0.5) * 20,
      qed: 0.5 + Math.random() * 0.4,
      mw: 300 + Math.random() * 200,
      logp: 1 + Math.random() * 4,
      source: i % 3 === 0 ? "dataset" : i % 3 === 1 ? "generated" : "fda"
    }));
  }
  const data = await apiFetch<EmbeddingMapResponse>("/embedding/umap", {
    params: { dataset, limit },
  });
  return Array.isArray(data) ? data : [];
}

/** Fetch aggregate research summary with fallback */
export async function getResearchSummary(): Promise<ResultsOverview> {
  if (isDemoMode()) {
    return mockApi.getResearchSummary();
  }
  return getResultsOverview();
}


export async function getResultsOverview(): Promise<ResultsOverview> {
  return await apiFetch<ResultsOverview>("/results/overview");
}




/** 
 * Fetch generated molecule rows for the Results page 
 * @deprecated Use project-scoped endpoints instead
 */
export async function getGeneratedMolecules(limit: number = 25): Promise<GeneratedMoleculeResult[]> {
  if (isDemoMode()) {
    return Array.from({ length: limit }).map((_, i) => ({
      molecule_id: `GEN-${i}`,
      smiles: "C",
      molecular_weight: 350 + i,
      logp: 2.1,
      qed: 0.75,
      source: "generated",
      experiment_id: "demo-experiment",
      pipeline_stage: "generated",
      engine: "q-ai-drug",
      created_at: new Date().toISOString(),
      provenance: { source: "q-ai-drug", evidence_status: "generated" }
    }));
  }
  const data = await apiFetch<GeneratedMoleculeResult[]>("/results/generated", {
    params: { limit },
  });
  return Array.isArray(data) ? data : [];
}

/** 
 * @deprecated Use getProjectDocking instead
 */
export async function getDockingResults(limit: number = 25): Promise<DockingResult[]> {
  if (isDemoMode()) {
    return mockApi.getDockingResults(limit);
  }
  const data = await apiFetch<DockingResult[]>("/results/docking", {
    params: { limit },
  });
  return Array.isArray(data) ? data : [];
}

/** 
 * Fetch simulation trajectory rows for the Results page 
 * @deprecated Use getProjectSimulation instead
 */
export async function getSimulationResults(limit: number = 60): Promise<SimulationResult[]> {
  if (isDemoMode()) {
    return Array.from({ length: limit }).map((_, i) => ({
      molecule_id: `SIM-${i}`,
      smiles: "C",
      time: i * 10,
      rmsd: 1.0 + Math.random() * 0.5,
      source: "simulation",
      experiment_id: "demo-experiment",
      pipeline_stage: "simulation",
      engine: "gromacs",
      created_at: new Date().toISOString(),
      provenance: { source: "gromacs", evidence_status: "simulated" }
    }));
  }
  const data = await apiFetch<SimulationResult[]>("/results/simulation", {
    params: { limit },
  });
  return Array.isArray(data) ? data : [];
}


/** 
 * @deprecated Use getProjectQuantum instead
 */
export async function getQuantumResults(limit: number = 25): Promise<QuantumResult[]> {
  if (isDemoMode()) {
    return mockApi.getQuantumMetrics(limit);
  }
  const data = await apiFetch<QuantumResult[]>("/results/quantum", {
    params: { limit },
  });
  return Array.isArray(data) ? data : [];
}


/** Fetch ranked candidate rows from existing or generated candidate file */
export async function getRankedCandidates(
  source: "existing" | "generated" = "existing",
  limit: number = 25
): Promise<RankedCandidatesResponse> {
  return await apiFetch<RankedCandidatesResponse>("/results/candidates", {
    params: { source, limit },
  });
}

/** 
 * Get ranked candidates with fallback 
 * @deprecated Use getProjectCandidates instead
 */
export async function getCandidates(limit = 10): Promise<RankedCandidatesResponse> {
  if (isDemoMode()) {
    return mockApi.getCandidates(limit);
  }
  try {
    return await getRankedCandidates("existing", limit);
  } catch (err) {
    throw err;
  }
}


/** Fetch candidate-level profiles merged across QM + MD output tables */
export async function getCandidateProfiles(
  limit: number = 100
): Promise<CandidateProfilesResponse> {
  return await apiFetch<CandidateProfilesResponse>("/results/profiles", {
    params: { limit },
  });
}

/** Fetch available summary and docking artifacts for browsing */
export async function getResultArtifacts(
  limit: number = 200
): Promise<ResultArtifactsResponse> {
  try {
    return await apiFetch<ResultArtifactsResponse>("/results/artifacts", {
      params: { limit },
    });
  } catch (err) {
    if (isDemoMode()) {
      return {
        count: 0,
        items: [],
      };
    }
    throw err;
  }
}

export async function getReports(
  projectId: string,
  filters: { report_type?: string; status?: string; limit?: number; skip?: number } = {}
): Promise<ApiEnvelope<ReportListResponse>> {
  return apiFetch<ApiEnvelope<ReportListResponse>>(`/projects/${encodeURIComponent(projectId)}/reports`, {
    params: {
      report_type: filters.report_type,
      status: filters.status,
      limit: filters.limit ?? 50,
      skip: filters.skip ?? 0,
    },
  });
}

export async function getReportSummary(projectId: string): Promise<ApiEnvelope<ReportSummaryResponse>> {
  return apiFetch<ApiEnvelope<ReportSummaryResponse>>(`/projects/${encodeURIComponent(projectId)}/reports/summary`);
}

export async function createReport(
  projectId: string,
  payload: CreateReportRequest
): Promise<ApiEnvelope<ReportItem>> {
  return apiFetch<ApiEnvelope<ReportItem>>(`/projects/${encodeURIComponent(projectId)}/reports`, {
    method: "POST",
    body: payload,
  });
}

export async function getReport(
  projectId: string,
  reportId: string
): Promise<ApiEnvelope<ReportItem>> {
  return apiFetch<ApiEnvelope<ReportItem>>(`/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}`);
}

export async function updateReport(
  projectId: string,
  reportId: string,
  payload: UpdateReportRequest
): Promise<ApiEnvelope<ReportItem>> {
  return apiFetch<ApiEnvelope<ReportItem>>(`/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteReport(projectId: string, reportId: string): Promise<{ success: boolean; message?: string }> {
  return apiFetch<{ success: boolean; message?: string }>(`/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}`, {
    method: "DELETE",
  });
}

export async function queueReportGeneration(
  projectId: string,
  reportId: string
): Promise<ApiEnvelope<ReportItem>> {
  return apiFetch<ApiEnvelope<ReportItem>>(`/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}/queue-generation`, {
    method: "POST",
  });
}

export async function generateReport(
  projectId: string,
  reportId: string,
  payload: ReportGenerateRequest
): Promise<ReportGenerationResponse> {
  return apiFetch<ReportGenerationResponse>(`/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}/generate`, {
    method: "POST",
    body: payload,
  });
}

export async function getReportFiles(
  projectId: string,
  reportId: string
): Promise<ApiEnvelope<ReportFilesResponse>> {
  return apiFetch<ApiEnvelope<ReportFilesResponse>>(`/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}/files`);
}

export async function importQAiDrugReport(
  projectId: string,
  payload: ImportQAiDrugReportRequest
): Promise<ApiEnvelope<ReportItem>> {
  return apiFetch<ApiEnvelope<ReportItem>>(`/projects/${encodeURIComponent(projectId)}/reports/import-q-ai-drug`, {
    method: "POST",
    body: payload,
  });
}

export async function generateProjectSummary(
  projectId: string,
  payload: ProjectSummaryGenerateRequest
): Promise<ReportGenerationResponse> {
  return apiFetch<ReportGenerationResponse>(`/projects/${encodeURIComponent(projectId)}/reports/generate-project-summary`, {
    method: "POST",
    body: payload,
  });
}

export async function generateCandidateDossier(
  projectId: string,
  payload: CandidateDossierGenerateRequest
): Promise<ReportGenerationResponse> {
  return apiFetch<ReportGenerationResponse>(`/projects/${encodeURIComponent(projectId)}/reports/generate-candidate-dossier`, {
    method: "POST",
    body: payload,
  });
}

/** Fetch total experiment count for dashboard summary cards */
export async function getExperimentSummary(): Promise<ExperimentSummaryResponse> {
  if (isDemoMode()) {
    return { experiment_count: 142 };
  }
  const projectId = typeof window !== "undefined" ? window.localStorage.getItem("active_project_id") : null;
  if (!projectId) {
    return { experiment_count: 0 };
  }
  try {
    const res = await apiFetch<any>(`/projects/${projectId}/experiments/summary`);
    if (res && res.success && res.data) {
      return { experiment_count: res.data.experiment_count || 0 };
    }
    return { experiment_count: 0 };
  } catch (err) {
    if (isDemoMode()) {
      return { experiment_count: 0 };
    }
    throw err;
  }
}

/** Fetch recent experiment runs for dashboard activity panel */
export async function getRecentRuns(limit: number = 8): Promise<RecentRunsResponse> {
  if (isDemoMode()) {
    const data = await mockApi.getDashboardData();
    return data.recent;
  }
  const projectId = typeof window !== "undefined" ? window.localStorage.getItem("active_project_id") : null;
  if (!projectId) {
    return { items: [] };
  }
  try {
    const res = await apiFetch<any>(`/projects/${projectId}/pipeline/runs`, {
      params: { limit },
    });
    if (res && res.success && res.data) {
      const items = res.data.items || [];
      return {
        items: items.map((r: any) => ({
          run_id: r.id || r._id,
          experiment_name: r.name || r.pipeline_type || "Pipeline Run",
          dataset_name: r.dataset_name || r.metadata?.dataset || "Docking Run",
          status: r.status,
          created_at: r.created_at || new Date().toISOString(),
        }))
      };
    }
    return { items: [] };
  } catch (err) {
    if (isDemoMode()) {
      return { items: [] };
    }
    throw err;
  }
}

/** Trigger molecule generation stage (placeholder-ready API contract). */
export async function generateMolecules(
  payload: Partial<WorkspacePipelineRequest> = {}
): Promise<WorkspacePipelineResponse> {
  try {
    return await apiFetch<WorkspacePipelineResponse>("/workspace/generate", {
      method: "POST",
      body: payload,
    });
  } catch (err) {
    if (isDemoMode()) {
      await sleep(400);
      return {
        runId: createPlaceholderRunId("gen"),
        stage: "generating",
        message: "Generating molecules...",
      };
    }
    throw err;
  }
}

/** 
 * Trigger docking stage (placeholder-ready API contract). 
 * @deprecated Use runProjectDocking instead
 */
export async function runDocking(
  payload: Partial<WorkspacePipelineRequest> = {}
): Promise<WorkspacePipelineResponse> {
  try {
    return await apiFetch<WorkspacePipelineResponse>("/workspace/docking", {
      method: "POST",
      body: payload,
    });
  } catch (err) {
    if (isDemoMode()) {
      await sleep(400);
      return {
        runId: createPlaceholderRunId("dock"),
        stage: "docking",
        message: "Docking started...",
      };
    }
    throw err;
  }
}

/** Trigger full pipeline against the backend pipeline endpoint. */
export async function runPipeline(
  payload: WorkspacePipelineRequest
): Promise<{ experimentId: string }> {
  if (isDemoMode()) {
    return { experimentId: `EXP-DEMO-${Date.now()}` };
  }
  const projectId = requireActiveProjectId();
  const configuredCallback =
    typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_PIPELINE_CALLBACK_URL : undefined;
  const callbackUrl =
    payload.constraints?.callback_url ||
    (typeof configuredCallback === "string" && configuredCallback.trim()
      ? configuredCallback.trim()
      : undefined);

  const data = await apiFetch<ApiEnvelope<{ id: string; status: string }>>(`/projects/${encodeURIComponent(projectId)}/pipeline/run`, {
    method: "POST",
    body: {
      pipeline: [
        "molecule_generation",
        "filtering",
        "docking",
        "gnina",
        "quantum",
        "admet",
        "simulation",
        "report",
      ],
      parameters: {
        input: {
          protein: payload.protein,
          constraints: {
            ...(payload.constraints ?? {}),
            ...(callbackUrl ? { callback_url: callbackUrl } : {}),
          },
        },
      },
    },
  });

  if (!data.data?.id) {
    throw new ApiError("Invalid pipeline response", undefined, data);
  }

  return {
    experimentId: data.data.id,
  };
}

/** Persist a pipeline experiment record in the backend experiments store. */
export async function createPipelineExperiment(
  payload: CreatePipelineExperimentRequest
): Promise<PipelineExperimentItem> {
  const projectId = requireActiveProjectId();
  const response = await apiFetch<ApiEnvelope<any>>(`/projects/${encodeURIComponent(projectId)}/experiments`, {
    method: "POST",
    body: {
      name: payload.protein || payload.experiment_id,
      type: "pipeline",
      engine: "q-ai-drug",
      parameters: payload,
      input_file_ids: [],
      simulate: false,
    },
  });
  return {
    experiment_id: response.data?.id || response.data?.experiment_id || payload.experiment_id,
    protein: response.data?.name || payload.protein,
    status: response.data?.status || "queued",
    created_at: response.data?.created_at || new Date().toISOString(),
  };
}

/** Fetch a pipeline result for a given experiment id. */
export async function getPipelineResult(experimentId: string): Promise<unknown> {
  const projectId = requireActiveProjectId();
  const [summary, molecules, docking] = await Promise.allSettled([
    apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/pipeline/summary`),
    apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/molecules`, { params: { limit: 100 } }),
    apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/docking/results`, { params: { limit: 100 } }),
  ]);

  const summaryData = summary.status === "fulfilled" ? summary.value?.data ?? summary.value : {};
  const moleculeRows =
    molecules.status === "fulfilled" ? molecules.value?.data?.items ?? molecules.value?.items ?? [] : [];
  const dockingRows =
    docking.status === "fulfilled" ? docking.value?.data?.items ?? docking.value?.items ?? [] : [];

  return {
    experiment_id: experimentId,
    summary: summaryData,
    generated: moleculeRows,
    filtered: moleculeRows,
    docking: dockingRows,
  };
}

/** Fetch current status for a given pipeline experiment id. */
export async function getPipelineStatus(
  experimentId: string
): Promise<WorkspacePipelineStatusResponse> {
  const projectId = requireActiveProjectId();
  const response = await apiFetch<ApiEnvelope<any>>(
    `/projects/${encodeURIComponent(projectId)}/pipeline/runs/${encodeURIComponent(experimentId)}`
  );
  const run = response.data || {};
  const stageStatuses = run.stage_statuses && typeof run.stage_statuses === "object"
    ? Object.entries(run.stage_statuses as Record<string, any>)
    : [];
  const activeStage =
    stageStatuses.find(([, value]) => value?.status === "running") ||
    stageStatuses.find(([, value]) => value?.status === "failed") ||
    [...stageStatuses].reverse().find(([, value]) => value?.status === "completed") ||
    stageStatuses[0];
  const progressValues = stageStatuses
    .map(([, value]) => Number(value?.progress ?? 0))
    .filter((value) => Number.isFinite(value));
  const progress = progressValues.length
    ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
    : 0;
  const logs = stageStatuses.map(([stage, value]) => {
    const status = value?.status || "queued";
    const error = value?.error ? `: ${value.error}` : "";
    return `${stage}: ${status}${error}`;
  });

  return {
    status: run.status || "queued",
    stage: activeStage?.[0] || "queued",
    progress,
    logs,
  };
}

/** Fetch validation status with fallback */
export async function getValidationStatus(experimentId: string): Promise<WorkspacePipelineStatusResponse> {
  if (isDemoMode()) {
    return mockApi.getValidationStatus(experimentId);
  }
  try {
    return await getPipelineStatus(experimentId);
  } catch (err) {
    throw err;
  }
}


/** Fetch experiment history from the backend pipeline router. */
export async function getPipelineExperiments(projectId?: string): Promise<PipelineExperimentItem[]> {
  if (isDemoMode()) {
    return mockApi.getExperiments();
  }
  try {
    const activeProj = projectId || getActiveProjectId() || undefined;
    if (activeProj) {
      const res = await apiFetch<{ data?: { items?: any[] } }>(`/projects/${activeProj}/experiments`);
      if (res?.data?.items) {
        return res.data.items.map((item: any) => ({
          experiment_id: item.id || item.experiment_id,
          protein: item.name || item.protein || "Protein",
          status: item.status,
          created_at: item.created_at || item.createdAt || new Date().toISOString()
        }));
      }
    }
    return [];
  } catch (err) {
    console.error("DEBUG: getPipelineExperiments error:", err);
    throw err;
  }
}

// --- Phase 2B Project-Aware Endpoints ---

export async function getProjectTargets(projectId: string): Promise<ApiEnvelope<{ items: any[] }>> {
  return apiFetch<ApiEnvelope<{ items: any[] }>>(`/projects/${encodeURIComponent(projectId)}/targets`);
}

export async function getProjectMolecules(projectId: string): Promise<ApiEnvelope<{ items: any[] }>> {
  return apiFetch<ApiEnvelope<{ items: any[] }>>(`/projects/${encodeURIComponent(projectId)}/molecules`);
}

export async function getProjectDocking(projectId: string): Promise<ApiEnvelope<{ items: DockingResult[] }>> {
  return apiFetch<ApiEnvelope<{ items: DockingResult[] }>>(`/projects/${encodeURIComponent(projectId)}/docking/results`);
}

export async function getProjectGninaResults(projectId: string): Promise<ApiEnvelope<{ items: any[] }>> {
  return apiFetch<ApiEnvelope<{ items: any[] }>>(`/projects/${encodeURIComponent(projectId)}/gnina/results`);
}

export async function getProjectQuantum(projectId: string): Promise<ApiEnvelope<{ items: QuantumResult[] }>> {
  return apiFetch<ApiEnvelope<{ items: QuantumResult[] }>>(`/projects/${encodeURIComponent(projectId)}/quantum/qml-scores`);
}

export async function getProjectSimulation(projectId: string): Promise<ApiEnvelope<{ items: SimulationResult[] }>> {
  return apiFetch<ApiEnvelope<{ items: SimulationResult[] }>>(`/projects/${encodeURIComponent(projectId)}/simulations/results`);
}

export async function getProjectValidation(projectId: string): Promise<any> {
  return apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/admet/results`);
}

export async function getProjectViewerAssets(projectId: string): Promise<any> {
  return apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/viewer/assets`);
}

export async function getProjectViewerPose(projectId: string, resultId: string): Promise<any> {
  return apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/viewer/pose/${encodeURIComponent(resultId)}`);
}

export async function getProjectViewerFingerprint(projectId: string, resultId: string): Promise<any> {
  return apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/viewer/interaction-fingerprint/${encodeURIComponent(resultId)}`);
}

export async function getProjectChemicalSpace(projectId: string): Promise<any> {
  return apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/chemical-space`);
}

export async function getProjectSimilarityMatrix(projectId: string): Promise<any> {
  return apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/similarity/matrix`);
}

export async function getProjectCandidates(projectId: string, limit: number = 10): Promise<RankedCandidatesResponse> {
  const response = await apiFetch<RankedCandidatesResponse | ApiEnvelope<RankedCandidatesResponse>>(`/projects/${encodeURIComponent(projectId)}/candidates`, {
    params: { limit },
  });
  if (response && typeof response === "object" && "success" in response && "data" in response) {
    return (response as ApiEnvelope<RankedCandidatesResponse>).data;
  }
  return response as RankedCandidatesResponse;
}

export async function runProjectDocking(projectId: string, payload: any): Promise<WorkspacePipelineResponse> {
  try {
    const response = await apiFetch<ApiEnvelope<{ id: string; status: string }>>(`/projects/${encodeURIComponent(projectId)}/pipeline/run`, {
      method: "POST",
      body: {
        pipeline: ["docking"],
        parameters: { docking: payload ?? {} },
      },
    });
    return {
      experimentId: response.data?.id,
      runId: response.data?.id,
      stage: "docking",
      message: "Docking pipeline started.",
    };
  } catch (err) {
    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 400));
      return {
        runId: `${projectId}-dock-${Date.now()}`,
        stage: "docking",
        message: "Docking started...",
      };
    }
    throw err;
  }
}

export async function getProjectPipelineSummary(projectId: string): Promise<any> {
  return apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/pipeline/summary`);
}

export async function getProjectExperimentsList(projectId: string): Promise<any> {
  return apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/experiments`);
}

export async function getProjectInvestorMetrics(projectId: string): Promise<any> {
  if (isDemoMode()) {
    return {
      success: true,
      data: {
        headline: {
          targets: 3,
          generated_candidates: 24,
          docking_rows: 156,
          gnina_rows: 156,
          qm_rows: 72,
          qml_rows: 72,
          trained_admet_endpoints: 5,
          production_gate: "REAL",
        },
        demo_flow: [
          { minute: "0:00", screen: "Hero Pitch", proof: "Display platform intro & high-level stats" },
          { minute: "1:30", screen: "Proof Overview", proof: "List EGFR, PARP1, PIK3CA results" },
          { minute: "3:00", screen: "Live Dashboard", proof: "Launch console & perform real docking run" },
          { minute: "5:00", screen: "3D Visuals", proof: "Show dual receptor-ligand pose in workbench" },
          { minute: "7:00", screen: "Admet & Report", proof: "Review safety profile and export PDF report" },
        ],
        tool_suite: [
          { name: "AutoDock Vina", status: "REAL", evidence: "156 docked conformations", output: "binding energy score ranges from -6.2 to -10.5 kcal/mol" },
          { name: "GNINA CNN", status: "REAL", evidence: "156 scored poses", output: "mean CNN pose score of 0.84" },
          { name: "xTB Quantum Chemistry", status: "REAL", evidence: "72 DFT calculations", output: "HOMO-LUMO gap averages 4.2 eV" },
          { name: "Qiskit Kernel Reranking", status: "REAL", evidence: "72 ranked rows", output: "mean quantum delta contribution is 0.12" },
        ],
        validation: {
          proof: { status: "REAL", warnings: [] },
          production: { status: "REAL", warnings: [] }
        }
      }
    };
  }
  return apiFetch<any>(`/projects/${encodeURIComponent(projectId)}/q-ai-drug/investor-metrics`);
}



