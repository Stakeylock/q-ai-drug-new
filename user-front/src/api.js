const API_BASE = import.meta.env.VITE_QAI_API_BASE || "";

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (String(path || "").startsWith("/pharma-library/")) return path;
  return `${API_BASE}${path}`;
}

export async function apiFetch(path, options = {}, token = null) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(apiUrl(path), { ...options, headers });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) {
    const message = payload?.detail || payload?.message || text || `${path} returned ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export function signup({ email, password, displayName, organizationName }) {
  return apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      display_name: displayName,
      organization_name: organizationName,
    }),
  });
}

export function login({ email, password }) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function me(token) {
  return apiFetch("/auth/me", {}, token);
}

export function billingSummary(token) {
  return apiFetch("/v1/billing/summary", {}, token);
}

export function setBillingPlan(token, tier) {
  return apiFetch(
    "/v1/billing/plan",
    {
      method: "POST",
      body: JSON.stringify({ tier }),
    },
    token,
  );
}

export function fetchTools() {
  return apiFetch("/v1/tools");
}

export function fetchTopCandidates(limit = 120) {
  return apiFetch(`/research/top-candidates?limit=${limit}`);
}

export function fetchResourceRegistry() {
  return apiFetch("/research/resource-registry");
}

export function fetchDataFabricStatus() {
  return apiFetch("/v1/research/data-fabric/status");
}

export function enrichDataFabric(payload) {
  return apiFetch("/v1/research/data-fabric/enrich", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function aiModelStatus() {
  return apiFetch("/v1/ai/model-status");
}

export function fetchProteinEvidence(payload) {
  return apiFetch("/v1/research/protein-evidence", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function reviewDockingVision(payload) {
  return apiFetch("/v1/vision/docking-review", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createIsolatedRun(payload) {
  return apiFetch("/v1/runs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function appendRunEvent(runId, userId, payload) {
  return apiFetch(`/v1/runs/${encodeURIComponent(runId)}/events?user_id=${encodeURIComponent(userId || "demo-user")}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchRunEvents(runId, userId, limit = 300) {
  return apiFetch(`/v1/runs/${encodeURIComponent(runId)}/events?user_id=${encodeURIComponent(userId || "demo-user")}&limit=${limit}`);
}

export function assistantStatus() {
  return apiFetch("/v1/assistant/status");
}

export function assistantChat(payload) {
  return apiFetch("/v1/assistant/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function analyzeProteinWithEsm2(payload) {
  return apiFetch("/v1/protein/esm2/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function dockPreviewMolecule(payload) {
  return apiFetch("/v1/chemistry/dock-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchDockingTools() {
  return apiFetch("/v1/chemistry/docking-tools");
}

export function runRealtimeDocking(payload) {
  return apiFetch("/v1/chemistry/realtime-dock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createProject(token, { name, configPath = "configs/cancer_targets.yaml" }) {
  return apiFetch(
    "/projects",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        config_path: configPath,
      }),
    },
    token,
  );
}

export function addProjectTarget(token, projectId, protein, patient) {
  return apiFetch(
    `/v1/projects/${projectId}/targets`,
    {
      method: "POST",
      body: JSON.stringify({
        target_id: protein.gene,
        gene: protein.gene,
        diagnosis: patient.diagnosis,
        alphafold_id: protein.alphafoldId,
        uniprot: protein.uniprot,
        role: protein.role,
        variants: protein.variants,
      }),
    },
    token,
  );
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
