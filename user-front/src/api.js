const API_BASE = import.meta.env.VITE_QAI_API_BASE || "";

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
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

export function startDryRun(token, projectId, tier) {
  const scale = tier === "student_free" ? 100 : tier === "student_pro" ? 250 : 500;
  return apiFetch(
    `/projects/${projectId}/runs`,
    {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        max_records_per_target: scale,
        n_generate: scale,
        skip_download: true,
        dry_run: true,
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
