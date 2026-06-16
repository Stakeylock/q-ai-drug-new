const state = {
  theme: window.localStorage.getItem("qai_theme") || "light",
  persona: window.localStorage.getItem("qai_persona") || "student",
  summary: null,
  candidates: [],
  models: [],
  modelCards: [],
  activityMetrics: [],
  admetMetrics: [],
  tools: {},
  validation: {},
  qm: [],
  qml: [],
  qprefilter: [],
  poseData: {},
  gninaStatus: {},
  gninaResults: [],
  gninaLog: [],
  investorMetrics: {},
  artifactHealth: {},
  targetWorkspace: [],
  experiments: {},
  scientificEvidence: {},
  moduleRegistry: {},
  moduleConsole: {
    token: window.localStorage.getItem("qai_access_token") || "",
    user: null,
    projects: [],
    activeProjectId: window.localStorage.getItem("qai_active_project_id") || "",
    selectedModuleId: window.localStorage.getItem("qai_selected_module_id") || "onco_data_builder",
    selectedTier: window.localStorage.getItem("qai_selected_tier") || "student_free",
    selectedDepth: window.localStorage.getItem("qai_selected_depth") || "quick_preview",
    moduleFilter: "all",
    projectTools: null,
    billing: null,
    usage: null,
    jobs: [],
    activeJob: null,
    logs: [],
    estimate: null,
    result: null,
    bulkResults: [],
    payloadText: "",
    message: "",
    loading: false,
  },
  target: "all",
};

let gninaPoller = null;
let activeViewer = null;
let viewerLigandSelector = { model: 1 };
let lastViewerPayload = null;
const viewerState = {
  cartoon: true,
  surface: true,
  spheres: false,
};

const API_ORIGIN = window.location.port === "3000" ? "http://127.0.0.1:8000" : window.location.origin;

const API_BASES = {
  research: API_ORIGIN,
  backend: API_ORIGIN,
};

const PERSONAS = {
  student: {
    label: "Research student",
    tier: "student_free",
    note: "Guided workflows, dry runs, cached proof data, and transparent claim boundaries.",
  },
  academic: {
    label: "Academic lab",
    tier: "academic_researcher",
    note: "Project workspaces, reproducible artifacts, target dossiers, and shared module runs.",
  },
  industry: {
    label: "Industry team",
    tier: "industry_biotech",
    note: "Higher-depth screening, ADMET gates, evidence packs, and pipeline operations.",
  },
  scientist: {
    label: "Scientist",
    tier: "academic_researcher",
    note: "Structure review, validation gates, assay triage, and quantum ablation evidence.",
  },
  professional: {
    label: "Professional",
    tier: "professional_individual",
    note: "Governed access, portfolio review, exportable reports, and collaboration handoff.",
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function applyTheme(theme = state.theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  window.localStorage.setItem("qai_theme", nextTheme);
  const toggle = $("#theme-toggle");
  if (toggle) toggle.textContent = nextTheme === "dark" ? "Light" : "Dark";
}

function applyPersona(persona = state.persona) {
  const nextPersona = PERSONAS[persona] ? persona : "student";
  state.persona = nextPersona;
  window.localStorage.setItem("qai_persona", nextPersona);
  const select = $("#persona-select");
  if (select) select.value = nextPersona;
  const targetTier = PERSONAS[nextPersona].tier;
  if (targetTier && tiers().some((tier) => tier.tier_id === targetTier)) {
    state.moduleConsole.selectedTier = targetTier;
    window.localStorage.setItem("qai_selected_tier", targetTier);
  }
}

function resolveApiUrl(url) {
  const value = String(url || "");
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  if (value.startsWith("/research/")) return `${API_BASES.research}${value}`;
  if (value.startsWith("/")) return `${API_BASES.backend}${value}`;
  return value;
}

function resolveResourceUrl(url) {
  if (!url || url === "#") return url || "#";
  return resolveApiUrl(url);
}

function hydrateBackendAssets() {
  $$("[data-backend-src]").forEach((element) => {
    element.src = resolveResourceUrl(element.dataset.backendSrc);
  });
  $$("[data-backend-href]").forEach((element) => {
    element.href = resolveResourceUrl(element.dataset.backendHref);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtNumber(value) {
  if (value === null || value === undefined || value === "") return "NA";
  const number = Number(value);
  if (!Number.isFinite(number)) return "NA";
  return number.toLocaleString();
}

function fmtScore(value, digits = 3) {
  if (value === null || value === undefined || value === "") return "NA";
  const number = Number(value);
  if (!Number.isFinite(number)) return "NA";
  return number.toFixed(digits);
}

function fmtBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "NA";
  const units = ["B", "KB", "MB", "GB"];
  let size = number;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function requestHeaders(extra = {}) {
  const headers = { Accept: "application/json", ...extra };
  if (state.moduleConsole.token) headers.Authorization = `Bearer ${state.moduleConsole.token}`;
  return headers;
}

async function getJson(url) {
  const response = await fetch(resolveApiUrl(url), { headers: requestHeaders() });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(resolveApiUrl(url), {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${url} returned ${response.status}`);
  }
  return response.json();
}

async function deleteJson(url) {
  const response = await fetch(resolveApiUrl(url), { method: "DELETE", headers: requestHeaders() });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${url} returned ${response.status}`);
  }
  return response.json();
}

async function loadData() {
  const [
    summary,
    candidates,
    models,
    modelCards,
    activityMetrics,
    admetMetrics,
    tools,
    validation,
    qm,
    qml,
    qprefilter,
    poseData,
    gninaStatus,
    gninaResults,
    gninaLog,
    investorMetrics,
    artifactHealth,
    targetWorkspace,
    experiments,
    scientificEvidence,
    moduleRegistry,
  ] = await Promise.all([
    getJson("/research/summary"),
    getJson("/research/top-candidates?limit=120"),
    getJson("/research/models"),
    getJson("/research/model-cards"),
    getJson("/research/activity-metrics"),
    getJson("/research/admet-metrics"),
    getJson("/research/tools"),
    getJson("/research/validation"),
    getJson("/research/qm-descriptors?limit=80"),
    getJson("/research/qml-scores?limit=80"),
    getJson("/research/quantum-prefilter?limit=120"),
    getJson("/research/pose-viewer-data?limit=80"),
    getJson("/research/gnina/status"),
    getJson("/research/gnina/results?limit=100"),
    getJson("/research/gnina/log?limit=100"),
    getJson("/research/investor-metrics"),
    getJson("/research/artifact-health"),
    getJson("/research/target-workspace"),
    getJson("/research/experiments"),
    getJson("/research/scientific-evidence"),
    getJson("/v1/tools"),
  ]);
  Object.assign(state, {
    summary,
    candidates,
    models,
    modelCards,
    activityMetrics,
    admetMetrics,
    tools,
    validation,
    qm,
    qml,
    qprefilter,
    poseData,
    gninaStatus,
    gninaResults,
    gninaLog,
    investorMetrics,
    artifactHealth,
    targetWorkspace,
    experiments,
    scientificEvidence,
    moduleRegistry,
  });
  render();
}

async function refreshGnina() {
  const [gninaStatus, gninaResults, gninaLog, candidates, poseData, artifactHealth] = await Promise.all([
    getJson("/research/gnina/status"),
    getJson("/research/gnina/results?limit=100"),
    getJson("/research/gnina/log?limit=100"),
    getJson("/research/top-candidates?limit=120"),
    getJson("/research/pose-viewer-data?limit=80"),
    getJson("/research/artifact-health"),
  ]);
  Object.assign(state, { gninaStatus, gninaResults, gninaLog, candidates, poseData, artifactHealth });
  render();
}

function badge(text, tone = "") {
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

function statusTone(status) {
  if (!status) return "warn";
  if (status === "pass") return "";
  if (status === "pass_with_warnings") return "warn";
  return "fail";
}

function setStatusText() {
  const run = state.summary?.run || {};
  const proof = state.summary?.validation || {};
  const production = state.summary?.production_gate || {};
  $("#run-status").textContent = run.project_dir ? "Artifacts Ready" : "No Run";
  $("#proof-status").innerHTML = badge(proof.status || "Not Checked", statusTone(proof.status));
  $("#production-status").innerHTML = badge(production.status || "Not Checked", statusTone(production.status));
}

function renderArtifactHealth() {
  const health = state.artifactHealth || {};
  const activeOrigin = window.location.origin;
  const ok =
    Number(health.top_candidate_count || 0) >= 30 &&
    Number(health.missing_image_count || 0) === 0 &&
    Number(health.missing_docked_pose_count || 0) === 0;
  $("#artifact-banner").innerHTML = `
    <div class="artifact-banner-grid">
      <div>
        <strong>${escapeHtml(activeOrigin)}</strong>
        <div class="artifact-path">${escapeHtml(health.active_output_dir || "No active output directory reported")}</div>
      </div>
      ${candidateMetric("Top 30", fmtNumber(health.top_candidate_count))}
      ${candidateMetric("Missing Images", fmtNumber(health.missing_image_count))}
      ${candidateMetric("Missing Docked", fmtNumber(health.missing_docked_pose_count))}
      ${candidateMetric("GNINA Poses", fmtNumber(health.gnina_pose_count))}
      ${badge(ok ? "Artifacts Healthy" : "Needs Attention", ok ? "" : "warn")}
    </div>
  `;
}

function renderStats() {
  const run = state.summary?.run || {};
  const gninaCompleted = state.gninaResults.filter((row) => row.gnina_status === "completed").length;
  const stats = [
    ["Generated", run.generated_candidates],
    ["Filtered", run.filtered_candidates],
    ["Docked", run.docking_rows],
    ["GNINA", gninaCompleted],
    ["QM xTB", run.qm_rows],
    ["QML", run.qml_rows],
    ["Ranked", run.ranked_rows],
  ];
  $("#stats-grid").innerHTML = stats
    .map(([label, value]) => `<article class="stat"><span>${label}</span><strong>${fmtNumber(value)}</strong></article>`)
    .join("");
}

function renderDiscoverySuite() {
  const run = state.summary?.run || {};
  const proof = state.summary?.validation || {};
  const production = state.summary?.production_gate || {};
  const stages = [
    ["Targets", "Disease biology, public evidence, and structure context", run.benchmark_records, "T"],
    ["Structures", "Protein workbench with receptor and pocket evidence", state.poseData?.legacy_structures?.length || 0, "P"],
    ["Generate", "Candidate expansion and medicinal chemistry filtering", run.generated_candidates, "G"],
    ["Screen", "Activity, docking, GNINA, and ADMET prioritization", run.docking_rows, "S"],
    ["Quantum", "Qiskit prefilter, xTB descriptors, and kernel reranking", run.qml_rows, "Q"],
    ["Validate", "Proof gates, redocking checks, and honest limitations", proof.status || "NA", "V"],
    ["Translate", "Reports, dossiers, triage boards, and lab handoff", production.status || "NA", "R"],
  ];
  $("#discovery-suite").innerHTML = stages
    .map(
      ([title, text, value, icon]) => `
        <article class="workflow-node">
          <div class="workflow-icon">${escapeHtml(icon)}</div>
          <div>
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(text)}</span>
          </div>
          ${badge(String(value ?? "NA"))}
        </article>
      `,
    )
    .join("");
}

function renderPipeline() {
  const run = state.summary?.run || {};
  const rows = [
    ["Benchmark", run.benchmark_records],
    ["Generated", run.generated_candidates],
    ["Filtered", run.filtered_candidates],
    ["Docking", run.docking_rows],
    ["MD", run.md_rows],
    ["xTB", run.qm_rows],
    ["QML", run.qml_rows],
    ["Ranked", run.ranked_rows],
  ];
  const max = Math.max(...rows.map(([, value]) => Number(value) || 0), 1);
  $("#pipeline-timeline").innerHTML = rows
    .map(([label, value]) => {
      const width = Math.max(4, ((Number(value) || 0) / max) * 100);
      return `
        <div class="timeline-row">
          <strong>${escapeHtml(label)}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <span class="muted">${fmtNumber(value)}</span>
        </div>
      `;
    })
    .join("");
}

function renderTopSignals() {
  const best = [...state.candidates].sort((a, b) => Number(b.final_score || 0) - Number(a.final_score || 0)).slice(0, 4);
  const admetEndpoints = state.admetMetrics.filter((row) => row.model_path).length;
  const cards = [
    {
      title: "Trained ADMET Endpoints",
      value: admetEndpoints,
      meta: "Tox21 + ClinTox",
    },
    {
      title: "Model Artifacts",
      value: state.models.length,
      meta: "Joblib, metrics, manifests",
    },
    {
      title: "Real QM Rows",
      value: state.qm.filter((row) => String(row.qm_is_real).toLowerCase() === "true").length,
      meta: "xTB-backed descriptors",
    },
    {
      title: "Best Candidate",
      value: best[0]?.candidate_id || "NA",
      meta: `score ${fmtScore(best[0]?.final_score)}`,
    },
  ];
  $("#top-signals").innerHTML = cards
    .map(
      (card) => `
      <div class="signal">
        <div><strong>${escapeHtml(card.title)}</strong><span class="muted">${escapeHtml(card.meta)}</span></div>
        ${badge(card.value)}
      </div>
    `,
    )
    .join("");
}

function renderTargetWorkspace() {
  const rows = state.targetWorkspace || [];
  if (!rows.length) {
    $("#target-workspace").innerHTML = '<div class="empty">No target workspace metadata available.</div>';
    return;
  }
  $("#target-workspace").innerHTML = rows
    .map((target) => {
      const best = target.best_candidate || {};
      const coverage = target.coverage || {};
      const structures = (target.structures || [])
        .map(
          (item) => `
            <a class="download" href="${escapeHtml(resolveResourceUrl(item.url))}" target="_blank" rel="noreferrer">${escapeHtml(item.name)} (${escapeHtml(item.source)})</a>
          `,
        )
        .join("");
      return `
        <article class="target-dossier">
          <div class="target-meta">
            <h3>${escapeHtml(target.target_id)} / ${escapeHtml(target.gene)}</h3>
            <p>${escapeHtml(target.cancer_relevance)}</p>
            <div class="score-line">
              ${candidateMetric("UniProt", target.uniprot_id || "NA")}
              ${candidateMetric("ChEMBL", target.chembl_target_id || "NA")}
              ${candidateMetric("Activity Records", fmtNumber(target.benchmark_activity_records))}
              ${candidateMetric("Best", best.candidate_id || "NA")}
            </div>
            <div class="tag-row">${(target.reference_drugs || []).map((drug) => badge(drug)).join("")}</div>
          </div>
          <div class="target-meta">
            <div class="score-line">
              ${candidateMetric("Docked", `${fmtNumber(coverage.docking)}/${fmtNumber(coverage.candidates)}`)}
              ${candidateMetric("GNINA", `${fmtNumber(coverage.gnina)}/${fmtNumber(coverage.candidates)}`)}
              ${candidateMetric("QM", `${fmtNumber(coverage.qm)}/${fmtNumber(coverage.candidates)}`)}
              ${candidateMetric("QML", `${fmtNumber(coverage.qml)}/${fmtNumber(coverage.candidates)}`)}
              ${candidateMetric("Best Score", fmtScore(best.final_score))}
              ${candidateMetric("Best Docking", `${fmtScore(best.affinity_kcal_mol, 2)} kcal/mol`)}
            </div>
            <div class="tag-row">${structures}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function candidateMetric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderCandidates() {
  const target = state.target;
  const rows = state.candidates.filter((row) => target === "all" || row.target_id === target);
  $("#candidate-count").textContent = `${rows.length} candidates`;
  if (!rows.length) {
    $("#candidate-grid").innerHTML = '<div class="empty">No candidates available.</div>';
    return;
  }
  $("#candidate-grid").innerHTML = rows
    .map((row) => {
      const img = row.png_url
        ? `<img src="${escapeHtml(resolveResourceUrl(row.png_url))}" alt="${escapeHtml(row.candidate_id)} structure">`
        : `<div class="empty">No structure image</div>`;
      return `
        <article class="candidate-card">
          ${img}
          <div class="candidate-body">
            <div class="candidate-title">
              <div>
                <span class="candidate-id">${escapeHtml(row.candidate_id)}</span>
                <div class="muted">${escapeHtml(row.target_id)} - rank ${escapeHtml(row.target_rank ?? "NA")}</div>
              </div>
              ${badge(fmtScore(row.final_score))}
            </div>
            <div class="score-line">
              ${candidateMetric("Activity", fmtScore(row.activity_score))}
              ${candidateMetric("ADMET", fmtScore(row.admet_score))}
              ${candidateMetric("Docking", `${fmtScore(row.affinity_kcal_mol, 2)} kcal/mol`)}
              ${candidateMetric("GNINA CNN", fmtScore(row.gnina_cnn_pose_score))}
              ${candidateMetric("QML", fmtScore(row.qml_score))}
            </div>
            <div class="tag-row">
              ${(row.pose_sources || []).map((source) => badge(source.label, source.method_tier === "FAILED" ? "fail" : source.method_tier === "EXPLORATORY" || source.method_tier === "PROXY" ? "warn" : "")).join("")}
            </div>
            <p class="smiles">${escapeHtml(row.canonical_smiles)}</p>
            <div class="candidate-actions">
              <button class="download load-docked-pose" data-target="${escapeHtml(row.target_id)}" data-candidate="${escapeHtml(row.candidate_id)}" data-source="docked">View Docked Pose</button>
              ${
                row.gnina_pose_sdf_url
                  ? `<button class="download load-docked-pose" data-target="${escapeHtml(row.target_id)}" data-candidate="${escapeHtml(row.candidate_id)}" data-source="gnina">GNINA</button>`
                  : ""
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderGnina() {
  const status = state.gninaStatus || {};
  const total = Number(status.total || state.gninaResults.length || 0);
  const completed = Number(status.completed || state.gninaResults.filter((row) => row.gnina_status === "completed").length || 0);
  const failed = Number(status.failed || state.gninaResults.filter((row) => row.gnina_status === "failed").length || 0);
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  $("#gnina-summary").innerHTML = `
    <div>${candidateMetric("Status", status.status || "not_started")}</div>
    <div>${candidateMetric("Completed", `${completed}/${total || "NA"}`)}</div>
    <div>${candidateMetric("Failed", failed)}</div>
    <div>${candidateMetric("Current", status.current || "Idle")}</div>
  `;
  $("#gnina-progress").style.width = `${percent}%`;
  $("#gnina-start").disabled = status.status === "running" || status.status === "queued";
  $("#gnina-start").textContent = status.status === "running" || status.status === "queued" ? "GNINA Running" : "Run GNINA";

  if (!state.gninaResults.length) {
    $("#gnina-results").innerHTML = '<div class="empty">No GNINA result rows yet.</div>';
  } else {
    const rows = state.gninaResults
      .map(
        (row) => `
        <tr>
          <td>${escapeHtml(row.target_id)}</td>
          <td>${escapeHtml(row.candidate_id)}</td>
          <td>${badge(row.gnina_status || "unknown", row.gnina_status === "completed" ? "" : "warn")}</td>
          <td>${fmtScore(row.gnina_affinity_kcal_mol, 2)}</td>
          <td>${fmtScore(row.gnina_cnn_pose_score)}</td>
          <td>${fmtScore(row.gnina_cnn_affinity)}</td>
          <td>${fmtScore(row.gnina_runtime_s, 1)}s</td>
          <td>
            <button class="download load-docked-pose" data-target="${escapeHtml(row.target_id)}" data-candidate="${escapeHtml(row.candidate_id)}" data-source="gnina">View Pose</button>
          </td>
        </tr>
      `,
      )
      .join("");
    $("#gnina-results").innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Target</th><th>Candidate</th><th>Status</th><th>Affinity</th><th>CNN Pose</th><th>CNN Affinity</th><th>Runtime</th><th></th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  $("#gnina-log").innerHTML = state.gninaLog.length
    ? state.gninaLog
        .slice()
        .reverse()
        .map(
          (row) => `
          <div class="log-entry">
            <strong>${escapeHtml(row.event || "event")}</strong>
            <span>${escapeHtml(row.time || row.updated_at || "")}</span>
            <code>${escapeHtml([row.target_id, row.candidate_id, row.runtime_s ? `${row.runtime_s}s` : ""].filter(Boolean).join(" - "))}</code>
          </div>
        `,
        )
        .join("")
    : '<div class="empty">No GNINA log events yet.</div>';

  if ((status.status === "running" || status.status === "queued") && !gninaPoller) {
    gninaPoller = window.setInterval(() => refreshGnina().catch(showError), 3000);
  }
  if (!(status.status === "running" || status.status === "queued") && gninaPoller) {
    window.clearInterval(gninaPoller);
    gninaPoller = null;
  }
}

function renderTable(containerSelector, rows, columns, maxRows = 100) {
  const container = $(containerSelector);
  if (!rows?.length) {
    container.innerHTML = '<div class="empty">No rows available.</div>';
    return;
  }
  const body = rows
    .slice(0, maxRows)
    .map(
      (row) => `
      <tr>
        ${columns.map((column) => `<td>${escapeHtml(row[column.key] ?? "")}</td>`).join("")}
      </tr>
    `,
    )
    .join("");
  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function renderModels() {
  if (!state.models.length) {
    $("#model-files").innerHTML = '<div class="empty">No model files found.</div>';
  } else {
    $("#model-files").innerHTML = state.models
      .map(
        (model) => `
        <div class="model-file">
          <div>
            <strong>${escapeHtml(model.name)}</strong>
            <span class="muted">${escapeHtml(model.scope)} - ${escapeHtml(model.kind)} - ${fmtBytes(model.size_bytes)}</span>
            <span class="muted">${escapeHtml(model.relative_path)}</span>
          </div>
          <a class="download" href="${escapeHtml(resolveResourceUrl(model.download_url))}">Download</a>
        </div>
      `,
      )
      .join("");
  }

  renderTable("#model-cards", state.modelCards, [
    { key: "module_name", label: "Module" },
    { key: "integration_status", label: "Status" },
    { key: "research_use", label: "Research Use" },
  ]);
  renderTable("#activity-metrics", state.activityMetrics, [
    { key: "target_id", label: "Target" },
    { key: "records_train", label: "Train" },
    { key: "records_eval", label: "Eval" },
    { key: "roc_auc", label: "ROC-AUC" },
    { key: "average_precision", label: "AP" },
  ]);
  renderTable("#admet-metrics", state.admetMetrics, [
    { key: "dataset", label: "Dataset" },
    { key: "endpoint", label: "Endpoint" },
    { key: "records_train", label: "Train" },
    { key: "records_eval", label: "Eval" },
    { key: "roc_auc", label: "ROC-AUC" },
    { key: "average_precision", label: "AP" },
  ]);
}

function renderPrediction(row) {
  $("#predict-result").innerHTML = `
    <div class="score-line">
      ${candidateMetric("Activity", fmtScore(row.activity_score))}
      ${candidateMetric("pActivity", fmtScore(row.predicted_p_activity))}
      ${candidateMetric("ADMET", fmtScore(row.admet_score))}
      ${candidateMetric("Tox21 Risk", fmtScore(row.tox21_toxicity_probability))}
      ${candidateMetric("ClinTox Risk", fmtScore(row.clintox_toxicity_probability))}
      ${candidateMetric("FDA Like", fmtScore(row.fda_approval_probability))}
      ${candidateMetric("QED", fmtScore(row.qed))}
      ${candidateMetric("Filter", row.filter_pass ? "Pass" : "Review")}
    </div>
  `;
}

function renderQuantum() {
  const qmlScores = state.qml.map((row) => Number(row.qml_score)).filter(Number.isFinite);
  const prefilterScores = state.qprefilter.map((row) => Number(row.quantum_prefilter_score)).filter(Number.isFinite);
  const gaps = state.qm.map((row) => Number(row.homo_lumo_gap_ev)).filter(Number.isFinite);
  const maxRows = Math.max(state.qprefilter.length, state.qm.length, state.qml.length, 1);
  const avg = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const bestQml = [...state.qml].sort((a, b) => Number(b.qml_score || 0) - Number(a.qml_score || 0)).slice(0, 4);
  $("#quantum-visual").innerHTML = `
    <article class="quantum-core">
      <h2>Quantum Evidence Layer</h2>
      <p>Qiskit kernels, xTB orbital descriptors, and ablation-aware reranking sit on top of classical screening so research teams can see what the quantum layer actually changed.</p>
      <div class="quantum-orbit" aria-hidden="true">
        <span class="quantum-node n1"></span>
        <span class="quantum-node n2"></span>
        <span class="quantum-node n3"></span>
        <span class="quantum-node n4"></span>
      </div>
      <div class="quantum-meter-grid">
        ${candidateMetric("Prefilter Rows", fmtNumber(state.qprefilter.length))}
        ${candidateMetric("xTB Rows", fmtNumber(state.qm.length))}
        ${candidateMetric("QML Rows", fmtNumber(state.qml.length))}
        ${candidateMetric("Mean Gap eV", fmtScore(avg(gaps), 2))}
      </div>
    </article>
    <article class="quantum-lanes">
      ${quantumLane("Portfolio prefilter", state.qprefilter.length, maxRows, fmtScore(avg(prefilterScores)))}
      ${quantumLane("Orbital descriptor depth", state.qm.length, maxRows, `${fmtScore(avg(gaps), 2)} eV`)}
      ${quantumLane("Kernel reranking", state.qml.length, maxRows, fmtScore(avg(qmlScores)))}
      <div class="signal">
        <div><strong>Top quantum-promoted candidates</strong><span class="muted">${bestQml.map((row) => row.candidate_id).filter(Boolean).join(", ") || "No QML rows loaded"}</span></div>
        ${badge("Ablation visible")}
      </div>
    </article>
  `;
  renderTable("#quantum-prefilter-table", state.qprefilter, [
    { key: "target_id", label: "Target" },
    { key: "candidate_id", label: "Candidate" },
    { key: "quantum_prefilter_score", label: "Score" },
    { key: "quantum_kernel_centrality", label: "Centrality" },
    { key: "quantum_diversity_score", label: "Diversity" },
    { key: "quantum_prefilter_mode", label: "Mode" },
  ]);
  renderTable("#qm-table", state.qm, [
    { key: "target_id", label: "Target" },
    { key: "candidate_id", label: "Candidate" },
    { key: "homo_lumo_gap_ev", label: "Gap eV" },
    { key: "xtb_total_energy_eh", label: "xTB Energy" },
    { key: "quantum_score", label: "Score" },
    { key: "qm_mode", label: "Mode" },
  ]);
  renderTable("#qml-table", state.qml, [
    { key: "target_id", label: "Target" },
    { key: "candidate_id", label: "Candidate" },
    { key: "qml_score", label: "QML Score" },
    { key: "qml_mode", label: "Mode" },
    { key: "qml_is_real", label: "Real" },
  ]);
}

function quantumLane(label, value, maxRows, meta) {
  const width = Math.max(6, Math.min(100, (Number(value || 0) / maxRows) * 100));
  return `
    <div class="quantum-lane">
      <div class="quantum-lane-head">
        <div><strong>${escapeHtml(label)}</strong><span class="muted">${fmtNumber(value)} rows | ${escapeHtml(meta || "NA")}</span></div>
        ${badge(`${Math.round(width)}%`)}
      </div>
      <div class="quantum-lane-track"><div class="quantum-lane-fill" style="--lane-width:${width}%"></div></div>
    </div>
  `;
}

function renderScientificEvidence() {
  const evidence = state.scientificEvidence || {};
  const references = evidence.reference_stats || {};
  const production = evidence.production_gate || {};
  const redocking = evidence.redocking_validation || {};
  const coverage = evidence.coverage || {};
  $("#scientific-evidence-metrics").innerHTML = [
    ["References", references.total_entries],
    ["2020-2026 Papers", references.recent_2020_2026_entries],
    ["Research Evidence", production.status || "not_checked"],
    ["Gate Warnings", (production.warnings || []).length],
    ["Redocking <2A", `${redocking.targets_under_2a || 0}/${redocking.targets || 0}`],
    ["Top 30", coverage.top30_rows],
    ["GNINA Rows", coverage.gnina_rows],
    ["QML Rows", coverage.qml_rows],
  ]
    .map(([label, value]) => `<article class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "NA")}</strong></article>`)
    .join("");
  $("#scientific-evidence-architecture").innerHTML = (evidence.architecture || [])
    .map(
      (row) => `
        <div class="log-entry">
          <strong>${escapeHtml(row.tier)}</strong>
          <span>${escapeHtml(row.implemented)}</span>
          <code>${escapeHtml((row.paper_basis || []).join(", "))}</code>
        </div>
      `,
    )
    .join("");
  const quantum = evidence.quantum_evidence || {};
  $("#scientific-quantum-scope").innerHTML = `
    <div class="score-line">
      ${candidateMetric("Prefilter Rows", quantum.prefilter_rows)}
      ${candidateMetric("Kernel Rows", quantum.kernel_rerank_rows)}
      ${candidateMetric("Mean Signed Delta", fmtScore(quantum.top30_mean_quantum_ablation_delta))}
      ${candidateMetric("Max Abs Delta", fmtScore(quantum.top30_max_abs_quantum_ablation_delta))}
      ${candidateMetric("Mean Rank Shift", fmtScore(quantum.top30_mean_abs_rank_shift))}
    </div>
    <div class="signal">
      <div><strong>Claim Boundary</strong><span class="muted">${escapeHtml(quantum.current_claim || "")}</span></div>
      ${badge("Ablated")}
    </div>
    <div class="tag-row">${(quantum.prefilter_modes || []).map((mode) => badge(mode)).join("")}${(quantum.rerank_modes || []).map((mode) => badge(mode)).join("")}</div>
    <div class="log-list">
      ${(quantum.top_promoted_by_quantum || [])
        .map(
          (row) => `
            <div class="log-entry">
              <strong>${escapeHtml(row.target_id)} - ${escapeHtml(row.candidate_id)}</strong>
              <span>Final rank ${escapeHtml(row.target_rank)}; no-quantum rank ${fmtScore(row.baseline_rank, 0)}; shift ${fmtScore(row.quantum_rank_shift, 0)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
  renderTable("#scientific-redocking", redocking.rows || [], [
    { key: "target_id", label: "Target" },
    { key: "pdb_id", label: "PDB" },
    { key: "reference_ligand", label: "Ligand" },
    { key: "redocking_rmsd_angstrom", label: "Best RMSD" },
    { key: "redocking_best_engine", label: "Engine" },
    { key: "vina_redocking_rmsd_angstrom", label: "Vina RMSD" },
    { key: "gnina_redocking_rmsd_angstrom", label: "GNINA RMSD" },
    { key: "gnina_redocking_cnn_pose_score", label: "GNINA CNN" },
  ]);
  $("#scientific-critique").innerHTML = (evidence.scientist_critique || [])
    .map((item) => `<div class="log-entry"><strong>Review Note</strong><span>${escapeHtml(item)}</span></div>`)
    .join("");
}

function renderExperiments() {
  const experiments = state.experiments || {};
  const urls = experiments.urls || {};
  $("#experiment-report-link").href = urls.report_html || "#";
  const top5 = experiments.hybrid_top5 || [];
  const warnings = experiments.warning_analysis || {};
  $("#experiment-metrics").innerHTML = [
    ["Experiments", experiments.experiment_count],
    ["Candidates", experiments.candidate_count],
    ["Hybrid Hits", top5.length],
    ["Status", experiments.status || "not_run"],
  ]
    .map(([label, value]) => `<article class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "NA")}</strong></article>`)
    .join("");
  $("#best-experiments").innerHTML = (experiments.best_experiments || [])
    .slice(0, 5)
    .map(
      (row) => `
        <div class="log-entry">
          <strong>${escapeHtml(row.experiment_id)} - ${escapeHtml(row.strategy)}</strong>
          <span>Mean top score ${fmtScore(row.mean_top_score)}; coverage ${escapeHtml(row.target_coverage)} targets; top ${escapeHtml(row.top_candidates)}</span>
        </div>
      `,
    )
    .join("");
  $("#hybrid-top5").innerHTML = top5.length
    ? top5
        .map(
          (row) => `
            <div class="model-file">
              <div>
                <strong>${escapeHtml(row.target_id)} - ${escapeHtml(row.candidate_id)}</strong>
                <span class="muted">Consensus ${fmtScore(row.consensus_score)}; affinity ${fmtScore(row.affinity_kcal_mol, 2)} kcal/mol; QED ${fmtScore(row.QED)}</span>
                <span class="muted">${escapeHtml(row.in_silico_validation_tier)}</span>
              </div>
              <button class="download load-docked-pose" data-target="${escapeHtml(row.target_id)}" data-candidate="${escapeHtml(row.candidate_id)}" data-source="docked">View Pose</button>
            </div>
          `,
        )
        .join("")
    : '<div class="empty">Experiment package has not been generated yet.</div>';
  $("#experiment-warning-analysis").innerHTML = `
    <div class="score-line">
      ${candidateMetric("Low absolute ADMET AP", (warnings.low_absolute_admet_ap_endpoints || []).length)}
      ${candidateMetric("GNINA outside-box rows", (warnings.gnina_outside_box_rows || []).length)}
    </div>
    <pre class="empty">${escapeHtml(JSON.stringify(warnings, null, 2))}</pre>
  `;
}

function renderViewerControls() {
  const structures = state.poseData.structures || {};
  const targetSelect = $("#viewer-target");
  const candidateInput = $("#viewer-candidate");
  const candidateSearch = $("#viewer-candidate-search");
  const candidateOptions = $("#viewer-candidate-options");
  const previousTarget = targetSelect.value;
  const previousCandidate = candidateInput.value;
  const targetOptions = Object.keys(structures)
    .sort()
    .map((target) => `<option value="${escapeHtml(target)}">${escapeHtml(target)}</option>`)
    .join("");
  targetSelect.innerHTML = targetOptions || '<option value="">No structures</option>';
  if (previousTarget && structures[previousTarget]) targetSelect.value = previousTarget;
  const candidates = state.poseData.candidates || [];
  candidateOptions.innerHTML = candidates.map((candidate) => `<option value="${escapeHtml(viewerCandidateLabel(candidate))}"></option>`).join("");
  const selected =
    candidates.find((candidate) => candidate.candidate_id === previousCandidate) ||
    candidates.find((candidate) => candidate.target_id === targetSelect.value) ||
    candidates[0];
  if (selected) setViewerCandidate(selected);
  else {
    candidateInput.value = "";
    candidateSearch.value = "";
  }
  $("#viewer-warning").textContent = state.poseData.note || "3D viewer data not available.";
  $("#viewer-quick-list").innerHTML = candidates.slice(0, 30).length
    ? candidates
        .slice(0, 30)
        .map(
          (candidate) => `
            <div class="model-file">
              <div>
                <strong>${escapeHtml(candidate.target_id)} - ${escapeHtml(candidate.candidate_id)}</strong>
                <span class="muted">${escapeHtml((candidate.pose_sources || []).map((source) => source.label).join(", ") || "No pose sources")}</span>
              </div>
              <button class="download load-docked-pose" data-target="${escapeHtml(candidate.target_id)}" data-candidate="${escapeHtml(candidate.candidate_id)}" data-source="docked">View Docked Pose</button>
            </div>
          `,
        )
        .join("")
    : '<div class="empty">No candidates available for the viewer.</div>';
  renderLegacyStructures();
}

function renderLegacyStructures() {
  const legacy = state.poseData.legacy_structures || [];
  $("#legacy-structures").innerHTML = legacy.length
    ? legacy
        .map(
          (item) => `
            <div class="model-file">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span class="muted">${escapeHtml(item.source)}</span>
              </div>
              <a class="download" href="${escapeHtml(resolveResourceUrl(item.url))}" target="_blank" rel="noreferrer">Open</a>
            </div>
          `,
        )
        .join("")
    : '<div class="empty">No review-only legacy structures found.</div>';
}

function findViewerCandidate(candidateId) {
  return (state.poseData.candidates || []).find((row) => row.candidate_id === candidateId) || null;
}

function viewerCandidateLabel(candidate) {
  if (!candidate) return "";
  return `${candidate.target_id} - ${candidate.candidate_id} - ${candidate.default_pose_source || "no pose"}`;
}

function setViewerCandidate(candidate) {
  if (!candidate) return;
  $("#viewer-candidate").value = candidate.candidate_id;
  $("#viewer-candidate-search").value = viewerCandidateLabel(candidate);
  $("#viewer-target").value = candidate.target_id;
}

function syncViewerCandidateFromSearch() {
  const input = $("#viewer-candidate-search").value.trim();
  const candidates = state.poseData.candidates || [];
  const match = candidates.find(
    (candidate) =>
      viewerCandidateLabel(candidate) === input ||
      candidate.candidate_id === input ||
      `${candidate.target_id} - ${candidate.candidate_id}` === input,
  );
  if (match) setViewerCandidate(match);
}

function selectPoseSource(candidate, requestedSource) {
  const sources = candidate?.pose_sources || [];
  const requested = sources.find((source) => source.id === requestedSource);
  if (requested) return requested;
  return (
    sources.find((source) => source.id === "docked") ||
    sources.find((source) => source.id === "gnina") ||
    sources.find((source) => source.id === "conformer") ||
    null
  );
}

function renderViewerEvidence(candidate, source) {
  const center = candidate.box_center || {};
  const size = candidate.box_size || {};
  const warnings = candidate.docking_warnings || [];
  $("#drawer-title").textContent = `${candidate.target_id} - ${candidate.candidate_id}`;
  $("#viewer-evidence").innerHTML = `
    <div class="signal">
      <div><strong>${escapeHtml(source.label)}</strong><span class="muted">${escapeHtml(candidate.target_id)}</span></div>
      ${badge(source.method_tier || "REAL", source.method_tier === "FAILED" ? "fail" : source.method_tier === "EXPLORATORY" || source.method_tier === "PROXY" ? "warn" : "")}
    </div>
    ${candidateMetric("Candidate", candidate.candidate_id)}
    ${candidateMetric("Target", candidate.target_id)}
    ${candidateMetric("Vina", `${fmtScore(candidate.vina_affinity_kcal_mol ?? candidate.affinity_kcal_mol, 2)} kcal/mol`)}
    ${candidateMetric("Smina", `${fmtScore(candidate.smina_affinity_kcal_mol, 2)} kcal/mol`)}
    ${candidateMetric("GNINA CNN Pose", fmtScore(candidate.gnina_cnn_pose_score))}
    ${candidateMetric("GNINA CNN Affinity", fmtScore(candidate.gnina_cnn_affinity))}
    ${candidateMetric("Box Center", `${fmtScore(center.x, 2)}, ${fmtScore(center.y, 2)}, ${fmtScore(center.z, 2)}`)}
    ${candidateMetric("Box Size", `${fmtScore(size.x, 1)}, ${fmtScore(size.y, 1)}, ${fmtScore(size.z, 1)}`)}
    <div>
      <strong>SMILES</strong>
      <p class="smiles">${escapeHtml(candidate.canonical_smiles || candidate.smiles || "")}</p>
    </div>
    ${
      warnings.length
        ? `<div class="warning-list">${warnings.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
        : '<p class="muted">No viewer warnings for this candidate.</p>'
    }
  `;
}

function renderViewerDownloads(candidate, source, structureUrl) {
  const links = [
    ["Receptor", structureUrl],
    ["Selected Pose", source.url],
    ["Vina PDBQT", candidate.vina_pose_pdbqt_url],
    ["Smina PDBQT", candidate.smina_pose_pdbqt_url],
    ["GNINA Log", candidate.gnina_log_url],
    ["Conformer", candidate.sdf_url],
    ["SMILES", candidate.smi_url],
  ].filter(([, url]) => url);
  $("#viewer-downloads").innerHTML = links
    .map(([label, url]) => `<a class="download" href="${escapeHtml(resolveResourceUrl(url))}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`)
    .join("");
}

function renderViewerModels(pdbText, sdfText) {
  const element = $("#mol-viewer");
  if (!activeViewer) {
    activeViewer = $3Dmol.createViewer(element, { backgroundColor: "white" });
  }
  if (typeof activeViewer.resize === "function") activeViewer.resize();
  activeViewer.clear();
  activeViewer.addModel(pdbText, "pdb");
  if (viewerState.cartoon) {
    activeViewer.setStyle({ model: 0 }, { cartoon: { color: "spectrum" } });
  } else {
    activeViewer.setStyle({ model: 0 }, { line: { color: "#6b7280", linewidth: 1.2 } });
  }
  if (viewerState.surface) {
    activeViewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.16, color: "#78a8a2" }, { model: 0 });
  }
  activeViewer.addModel(sdfText, "sdf");
  const ligandStyle = viewerState.spheres
    ? { sphere: { scale: 0.32, colorscheme: "greenCarbon" }, stick: { radius: 0.16, colorscheme: "greenCarbon" } }
    : { stick: { radius: 0.24, colorscheme: "greenCarbon" } };
  activeViewer.setStyle(viewerLigandSelector, ligandStyle);
  activeViewer.zoomTo(viewerLigandSelector);
  activeViewer.render();
  window.requestAnimationFrame(() => {
    if (!activeViewer || typeof activeViewer.resize !== "function") return;
    activeViewer.resize();
    activeViewer.zoomTo(viewerLigandSelector);
    activeViewer.render();
  });
}

function openViewer(candidateId, sourceId = "docked") {
  const candidate = findViewerCandidate(candidateId);
  if (!candidate) return;
  $("#viewer-drawer").classList.remove("hidden");
  $("#viewer-backdrop").classList.remove("hidden");
  document.body.classList.add("modal-open");
  setViewerCandidate(candidate);
  $("#viewer-pose-source").value = sourceId;
  loadPoseViewer().catch((error) => {
    $("#viewer-warning").innerHTML = `<span class="error">${escapeHtml(error.message)}</span>`;
  });
}

function closeViewer() {
  $("#viewer-drawer").classList.add("hidden");
  $("#viewer-backdrop").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function loadPoseViewer() {
  const warning = $("#viewer-warning");
  if (!window.$3Dmol) {
    warning.innerHTML = "3Dmol.js did not load. Use the structure and ligand download links until the viewer library is reachable.";
    return;
  }
  const targetId = $("#viewer-target").value;
  const candidateId = $("#viewer-candidate").value;
  const structure = (state.poseData.structures || {})[targetId];
  const candidate = (state.poseData.candidates || []).find((row) => row.candidate_id === candidateId);
  const source = selectPoseSource(candidate, $("#viewer-pose-source").value);
  const structureUrl = source?.receptor_url || candidate?.receptor_url || structure?.url;
  if (!candidate || !structureUrl || !source?.url) {
    warning.innerHTML = "Select a target with a receptor PDB and an available ligand pose.";
    return;
  }
  $("#viewer-pose-source").value = source.id;
  warning.innerHTML = `${state.poseData.note || ""} Loaded: ${source.label}.`;
  const [pdbText, sdfText] = await Promise.all([
    fetch(resolveResourceUrl(structureUrl)).then((response) => response.text()),
    fetch(resolveResourceUrl(source.url)).then((response) => response.text()),
  ]);
  $("#viewer-candidate-search").blur();
  lastViewerPayload = { pdbText, sdfText };
  renderViewerModels(pdbText, sdfText);
  renderViewerEvidence(candidate, source);
  renderViewerDownloads(candidate, source, structureUrl);
}

function modules() {
  return state.moduleRegistry.modules || [];
}

function tiers() {
  return state.moduleRegistry.tiers || [];
}

function selectedModule() {
  return modules().find((module) => module.module_id === state.moduleConsole.selectedModuleId) || modules()[0] || null;
}

function activeProject() {
  return state.moduleConsole.projects.find((project) => project.id === state.moduleConsole.activeProjectId) || null;
}

function tierIndex(tierId) {
  return tiers().findIndex((tier) => tier.tier_id === tierId);
}

function moduleAllowedByTier(module, tierId) {
  const current = tierIndex(tierId);
  const required = tierIndex(module?.tier_minimum);
  if (current < 0 || required < 0) return false;
  return current >= required;
}

function moduleStatusMessage(text, tone = "") {
  state.moduleConsole.message = text;
  const box = $("#module-message");
  if (!box) return;
  box.className = tone === "error" ? "error" : "empty";
  box.textContent = text;
}

function defaultPayloadForModule(moduleId) {
  const firstCandidate = state.candidates[0] || {};
  const targetId = firstCandidate.target_id || "EGFR";
  const candidateId = firstCandidate.candidate_id || "EGFR_CAND_00111";
  const defaults = {
    onco_data_builder: { target_ids: ["EGFR", "PARP1", "PIK3CA"], disease: "oncology", records_requested: 1000 },
    target_intelligence_workspace: { disease_or_target: "oncology EGFR PARP1 PIK3CA", target_count: 3 },
    protein_workbench: { target_id: targetId, receptor_count: 1, reference_ligand: "configured_pocket_reference" },
    inhibitor_library_studio: { target_id: targetId, molecule_count: 30, decoy_source: "proxy_controls" },
    q_generate: { target_id: targetId, n_generate: 500, generated_molecules: 500, novelty_mode: "analogue_expansion" },
    activity_model_studio: {
      curated_benchmark: "outputs/cancer_proof_v1/curation/curated_activity.csv",
      target_id: targetId,
      training_rows: 1000,
      split_policy: "scaffold_split",
    },
    q_filter: { candidate_library: "outputs/cancer_proof_v1/generated.csv", molecule_count: 500, risk_tolerance: "oncology_like" },
    applicability_domain_guard: { candidate_set: "top30", training_molecules: "curated_benchmark", molecule_count: 30 },
    q_portfolio_prefilter: { filtered_molecules: "top30", budget: 30, molecule_count: 30, target_id: targetId },
    q_dock_studio: { prepared_receptor: targetId, ligand_set: "top30", pocket: "curated", docking_pairs: 30, gnina_pairs: 10 },
    q_view_3d: { candidate_id: candidateId, pose_source: "docked", surface_mode: "cartoon_surface" },
    interaction_fingerprint_analyzer: { receptor_pdb: targetId, pose_sdf: "top_docked_pose", target_id: targetId, pose_count: 30 },
    ligand_pose_relaxation: { docked_pose: "top_docked_pose", pose_count: 30, step_count: 500, relaxation_mode: "openmm_ligand_pose_relaxation" },
    q_orbital_analyzer: { candidate_sdf_or_smiles: "top30", qm_method: "xtb", qm_rows: 30 },
    q_rank: { score_tables: "proof_run", candidate_count: 30, budget: 10, wet_lab_criteria: "balanced_evidence" },
    wet_lab_triage_board: { ranked_candidates: "top30", budget: 5, assay_type: "biochemical_ic50", risk_tolerance: "balanced" },
    q_report_and_candidate_dossiers: { project_outputs: "outputs/cancer_proof_v1", candidate_selection: "top10_per_target", export_formats: ["html", "md", "csv"] },
    collaboration_and_eln_bridge: { project_id: "active_project", annotation: "Scientist review pending.", annotation_count: 1, decision_state: "review_pending" },
  };
  return defaults[moduleId] || { molecule_count: 30 };
}

function ensurePayloadText() {
  const module = selectedModule();
  if (!module) return;
  if (!state.moduleConsole.payloadText) {
    state.moduleConsole.payloadText = JSON.stringify(defaultPayloadForModule(module.module_id), null, 2);
  }
}

function parseModulePayload() {
  const text = $("#module-payload")?.value ?? state.moduleConsole.payloadText;
  try {
    const payload = JSON.parse(text || "{}");
    state.moduleConsole.payloadText = JSON.stringify(payload, null, 2);
    return payload;
  } catch (error) {
    throw new Error(`Payload JSON is invalid: ${error.message}`);
  }
}

function setSelectedModule(moduleId) {
  state.moduleConsole.selectedModuleId = moduleId;
  window.localStorage.setItem("qai_selected_module_id", moduleId);
  state.moduleConsole.payloadText = JSON.stringify(defaultPayloadForModule(moduleId), null, 2);
  state.moduleConsole.estimate = null;
  state.moduleConsole.result = null;
  renderTools();
}

async function loadModuleConsoleContext(options = {}) {
  const silent = Boolean(options.silent);
  if (!state.moduleConsole.token) {
    state.moduleConsole.user = null;
    state.moduleConsole.projects = [];
    state.moduleConsole.billing = null;
    state.moduleConsole.usage = null;
    state.moduleConsole.jobs = [];
    if (!silent) moduleStatusMessage("Sign in or start a local demo to run authenticated project modules.");
    renderTools();
    return;
  }
  try {
    const [user, projects, billing] = await Promise.all([getJson("/auth/me"), getJson("/v1/projects"), getJson("/v1/billing/summary")]);
    state.moduleConsole.user = user;
    state.moduleConsole.projects = projects;
    state.moduleConsole.billing = billing;
    const storedProject = projects.find((project) => project.id === state.moduleConsole.activeProjectId);
    if (!storedProject) {
      if (projects.length) {
        state.moduleConsole.activeProjectId = projects[0].id;
        window.localStorage.setItem("qai_active_project_id", projects[0].id);
      } else {
        state.moduleConsole.activeProjectId = "";
        window.localStorage.removeItem("qai_active_project_id");
      }
    }
    if (state.moduleConsole.activeProjectId) {
      const [projectTools, usage, jobs] = await Promise.all([
        getJson(`/projects/${state.moduleConsole.activeProjectId}/tools`),
        getJson(`/projects/${state.moduleConsole.activeProjectId}/usage`),
        getJson(`/projects/${state.moduleConsole.activeProjectId}/module-runs?limit=50`),
      ]);
      state.moduleConsole.projectTools = projectTools;
      state.moduleConsole.usage = usage;
      state.moduleConsole.jobs = jobs;
    }
    if (!silent) moduleStatusMessage("Module console is connected to authenticated project context.");
  } catch (error) {
    if (String(error.message || "").includes("401") || String(error.message || "").includes("403")) {
      state.moduleConsole.token = "";
      window.localStorage.removeItem("qai_access_token");
    }
    if (!silent) moduleStatusMessage(error.message, "error");
  }
  renderTools();
}

async function authenticateModuleConsole(mode) {
  const isSignup = mode === "signup";
  const email = isSignup ? $("#module-signup-email").value.trim() : $("#module-login-email").value.trim();
  const password = isSignup ? $("#module-signup-password").value : $("#module-login-password").value;
  const body = isSignup
    ? {
        email,
        password,
        display_name: "Q-AI Researcher",
        organization_name: $("#module-signup-org").value.trim() || "Q-AI Oncology Lab",
      }
    : { email, password };
  const endpoint = isSignup ? "/auth/signup" : "/auth/login";
  const response = await postJson(endpoint, body);
  state.moduleConsole.token = response.access_token;
  window.localStorage.setItem("qai_access_token", response.access_token);
  moduleStatusMessage(`${isSignup ? "Created" : "Loaded"} research account. Loading project context...`);
  await loadModuleConsoleContext({ silent: true });
}

async function setPlanTier(tierId) {
  state.moduleConsole.selectedTier = tierId;
  window.localStorage.setItem("qai_selected_tier", tierId);
  if (!state.moduleConsole.token) return;
  const orgId = state.moduleConsole.user?.organizations?.[0]?.organization_id || state.moduleConsole.billing?.organization_id;
  await postJson("/v1/billing/plan", { tier: tierId, organization_id: orgId });
  await loadModuleConsoleContext({ silent: true });
}

async function createOrConnectProject(name = "cancer_proof_v1") {
  if (!state.moduleConsole.token) throw new Error("Sign in before creating a project.");
  await loadModuleConsoleContext({ silent: true });
  const existing = state.moduleConsole.projects.find((project) => project.name === name);
  const project =
    existing ||
    (await postJson("/v1/projects", {
      name,
      config_path: "configs/cancer_targets.yaml",
    }));
  state.moduleConsole.activeProjectId = project.id;
  window.localStorage.setItem("qai_active_project_id", project.id);
  await loadModuleConsoleContext({ silent: true });
  return project;
}

async function startLocalModuleDemo() {
  try {
    state.moduleConsole.loading = true;
    renderTools();
    if (!state.moduleConsole.token) {
      const email = `demo-${Date.now()}@qai.local`;
      const password = `qai-local-demo-${Math.random().toString(36).slice(2, 10)}`;
      const signup = await postJson("/auth/signup", {
        email,
        password,
        display_name: "Local Demo Researcher",
        organization_name: "Q-AI Local Demo Lab",
      });
      state.moduleConsole.token = signup.access_token;
      window.localStorage.setItem("qai_access_token", signup.access_token);
      window.localStorage.setItem("qai_demo_email", email);
    }
    await createOrConnectProject("cancer_proof_v1");
    await setPlanTier(state.moduleConsole.selectedTier);
    moduleStatusMessage("Local demo is ready. The active project is connected to outputs/cancer_proof_v1.");
  } catch (error) {
    moduleStatusMessage(error.message, "error");
  } finally {
    state.moduleConsole.loading = false;
    renderTools();
  }
}

function moduleRunRequest(dryRunOverride = null) {
  const runMode = $("#module-run-mode")?.value || "dry";
  const dryRun = dryRunOverride === null ? runMode === "dry" : Boolean(dryRunOverride);
  return {
    payload: parseModulePayload(),
    dry_run: dryRun,
    tier: state.moduleConsole.selectedTier,
    compute_depth: state.moduleConsole.selectedDepth,
  };
}

async function estimateSelectedModule() {
  const projectId = state.moduleConsole.activeProjectId;
  const module = selectedModule();
  if (!projectId || !module) throw new Error("Select an authenticated project and module first.");
  const estimate = await postJson(`/projects/${projectId}/tools/${module.module_id}/estimate`, moduleRunRequest());
  state.moduleConsole.estimate = estimate;
  renderTools();
  return estimate;
}

async function runSelectedModule() {
  const projectId = state.moduleConsole.activeProjectId;
  const module = selectedModule();
  if (!projectId || !module) throw new Error("Select an authenticated project and module first.");
  const job = await postJson(`/projects/${projectId}/tools/${module.module_id}/run`, moduleRunRequest());
  state.moduleConsole.activeJob = job;
  state.moduleConsole.result = null;
  state.moduleConsole.logs = [];
  await pollModuleJob(job.id);
}

async function waitForModuleJob(jobId, timeoutMs = 25000) {
  const started = Date.now();
  let job = await getJson(`/jobs/${jobId}`);
  while (["queued", "running", "created"].includes(job.status) && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 750));
    job = await getJson(`/jobs/${jobId}`);
  }
  return job;
}

async function pollModuleJob(jobId) {
  const projectId = state.moduleConsole.activeProjectId;
  if (!projectId || !jobId) return;
  const job = await getJson(`/jobs/${jobId}`);
  state.moduleConsole.activeJob = job;
  try {
    state.moduleConsole.logs = await getJson(`/runs/${jobId}/logs`);
  } catch {
    state.moduleConsole.logs = [];
  }
  try {
    state.moduleConsole.result = await getJson(`/projects/${projectId}/module-runs/${jobId}/result`);
  } catch {
    if (job.status === "failed") state.moduleConsole.result = null;
  }
  await loadModuleConsoleContext({ silent: true });
  renderTools();
  if (["queued", "running", "created"].includes(job.status)) {
    window.setTimeout(() => pollModuleJob(jobId).catch((error) => moduleStatusMessage(error.message, "error")), 1200);
  }
}

async function runTierDryTest() {
  const projectId = state.moduleConsole.activeProjectId;
  if (!projectId) throw new Error("Create or select a project before testing modules.");
  state.moduleConsole.bulkResults = [];
  renderTools();
  await setPlanTier(state.moduleConsole.selectedTier);
  for (const module of modules()) {
    const previousModule = state.moduleConsole.selectedModuleId;
    state.moduleConsole.selectedModuleId = module.module_id;
    state.moduleConsole.payloadText = JSON.stringify(defaultPayloadForModule(module.module_id), null, 2);
    try {
      const request = {
        payload: defaultPayloadForModule(module.module_id),
        dry_run: true,
        tier: state.moduleConsole.selectedTier,
        compute_depth: state.moduleConsole.selectedDepth,
      };
      const estimate = await postJson(`/projects/${projectId}/tools/${module.module_id}/estimate`, request);
      if (!estimate.allowed || estimate.quota_status === "blocked") {
        state.moduleConsole.bulkResults.push({
          module_id: module.module_id,
          name: module.name,
          status: "blocked",
          detail: estimate.quota_detail || `Requires ${module.tier_minimum_label || module.tier_minimum}`,
        });
      } else {
        const job = await postJson(`/projects/${projectId}/tools/${module.module_id}/run`, request);
        const finalJob = await waitForModuleJob(job.id);
        state.moduleConsole.bulkResults.push({
          module_id: module.module_id,
          name: module.name,
          status: finalJob.status,
          detail: `${estimate.estimated_credits} credits on ${module.queue}`,
          job_id: job.id,
        });
      }
    } catch (error) {
      state.moduleConsole.bulkResults.push({ module_id: module.module_id, name: module.name, status: "failed", detail: error.message });
    }
    renderTools();
    state.moduleConsole.selectedModuleId = previousModule;
  }
  await loadModuleConsoleContext({ silent: true });
  moduleStatusMessage(`Tier dry-run complete for ${state.moduleConsole.selectedTier}.`);
}

function projectFileRel(uri) {
  const project = activeProject();
  if (!project || !uri) return null;
  const normalized = String(uri).replaceAll("\\", "/");
  const marker = `outputs/${project.name}/`;
  if (normalized.includes(marker)) return normalized.split(marker, 2)[1];
  if (project.name === "cancer_proof_v1" && normalized.startsWith("/artifacts/")) return null;
  return null;
}

async function downloadProjectFile(relPath) {
  const projectId = state.moduleConsole.activeProjectId;
  if (!projectId || !relPath) return;
  const url = `/projects/${projectId}/files/${relPath.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(resolveApiUrl(url), { headers: requestHeaders() });
  if (!response.ok) throw new Error(`Download failed with ${response.status}`);
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = relPath.split("/").pop() || "artifact";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(link.href), 1000);
}

function renderModuleStatus() {
  const user = state.moduleConsole.user;
  const project = activeProject();
  const billing = state.moduleConsole.billing || {};
  const persona = PERSONAS[state.persona] || PERSONAS.student;
  $("#module-status-strip").innerHTML = `
    ${candidateMetric("Account", user?.email || "Not signed in")}
    ${candidateMetric("Project", project ? project.name : "No project")}
    ${candidateMetric("Plan", billing.plan_tier || state.moduleConsole.selectedTier)}
    ${candidateMetric("Credits", fmtScore(billing.credit_balance, 1))}
    ${candidateMetric("Workspace", persona.label)}
  `;
  $("#module-message").textContent = state.moduleConsole.message || (user ? "Ready to run project-scoped modules." : "Sign in or start a local demo to run authenticated project modules.");
}

function renderModuleAuthAndProject() {
  const projectSelect = $("#module-project-select");
  projectSelect.innerHTML = state.moduleConsole.projects.length
    ? state.moduleConsole.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("")
    : '<option value="">No projects</option>';
  projectSelect.value = state.moduleConsole.activeProjectId || "";
}

function renderTierGrid() {
  const persona = PERSONAS[state.persona] || PERSONAS.student;
  if (tierIndex(state.moduleConsole.selectedTier) < 0 && tiers().some((tier) => tier.tier_id === persona.tier)) {
    state.moduleConsole.selectedTier = persona.tier;
    window.localStorage.setItem("qai_selected_tier", persona.tier);
  }
  const current = state.moduleConsole.selectedTier;
  const currentTierIndex = tierIndex(current);
  $("#module-tier-grid").innerHTML = `
    <div class="persona-banner">
      <strong>${escapeHtml(persona.label)}</strong>
      <span>${escapeHtml(persona.note)}</span>
    </div>
  ` + tiers()
    .map((tier) => {
      const quotas = tier.quotas || {};
      const locked = tierIndex(tier.tier_id) > currentTierIndex;
      return `
        <button class="tier-tile ${tier.tier_id === current ? "active" : ""} ${locked ? "locked" : ""}" data-tier="${escapeHtml(tier.tier_id)}" type="button">
          <span class="tier-meta">
            <strong>${escapeHtml(tier.label)}</strong>
            ${badge(locked ? "Locked" : tier.tier_id === current ? "Active" : "Available", locked ? "warn" : "")}
          </span>
          <span>${escapeHtml(tier.tier_id)}</span>
          <small>${escapeHtml(String(quotas.molecules_per_run))} molecules/run</small>
        </button>
      `;
    })
    .join("");
  const presets = state.moduleRegistry.compute_depth_presets || {};
  $("#module-depth").innerHTML = Object.entries(presets)
    .map(([key, preset]) => `<option value="${escapeHtml(key)}">${escapeHtml(preset.label || key)} - ${escapeHtml(preset.intent || "")}</option>`)
    .join("");
  $("#module-depth").value = state.moduleConsole.selectedDepth;
}

function renderUsageAndJobs() {
  const usage = state.moduleConsole.usage || {};
  const jobs = state.moduleConsole.jobs || [];
  $("#module-usage-grid").innerHTML = [
    ["Plan", usage.plan_tier || "NA"],
    ["Credits", fmtScore(usage.credit_balance, 1)],
    ["Monthly Limit", fmtScore(usage.monthly_credit_limit, 1)],
    ["Usage Events", (usage.recent_usage || []).length],
  ]
    .map(([label, value]) => `<article class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`)
    .join("");
  $("#module-job-list").innerHTML = jobs.length
    ? jobs
        .slice(0, 12)
        .map(
          (job) => `
            <button class="module-job-row" data-job-id="${escapeHtml(job.job_id)}" type="button">
              <strong>${escapeHtml(job.module_id || job.task_name || "module")}</strong>
              <span>${badge(job.status, job.status === "succeeded" ? "" : job.status === "failed" ? "fail" : "warn")} ${escapeHtml(job.created_at || "")}</span>
            </button>
          `,
        )
        .join("")
    : '<div class="empty">No module runs yet. Dry-run a tier or run a selected module.</div>';
}

function renderModuleGrid() {
  const selectedId = state.moduleConsole.selectedModuleId;
  const filter = state.moduleConsole.moduleFilter;
  const rows = modules().filter((module) => filter === "all" || module.queue === filter);
  $("#module-count-label").textContent = `${rows.length} shown / ${modules().length} registered modules`;
  $("#module-grid").innerHTML = rows.length
    ? rows
        .map((module) => {
          const allowed = moduleAllowedByTier(module, state.moduleConsole.selectedTier);
          return `
            <button class="module-card ${module.module_id === selectedId ? "active" : ""} ${allowed ? "available" : "locked"}" data-module-id="${escapeHtml(module.module_id)}" type="button">
              <span class="module-card-head">
                <strong>${escapeHtml(module.name)}</strong>
                ${badge(allowed ? "Allowed" : module.tier_minimum_label || module.tier_minimum, allowed ? "" : "warn")}
              </span>
              <span>${escapeHtml(module.purpose)}</span>
              <small>${escapeHtml(module.queue)} | ${escapeHtml(module.credit_estimator)}</small>
            </button>
          `;
        })
        .join("")
    : '<div class="empty">No modules match this queue filter.</div>';
}

function renderModuleDetail() {
  const module = selectedModule();
  ensurePayloadText();
  if (!module) {
    $("#module-detail-title").textContent = "No module selected";
    $("#module-detail-purpose").textContent = "";
    $("#module-contract").innerHTML = '<div class="empty">Module registry not available.</div>';
    return;
  }
  const allowed = moduleAllowedByTier(module, state.moduleConsole.selectedTier);
  $("#module-detail-title").textContent = module.name;
  $("#module-detail-purpose").textContent = module.purpose;
  $("#module-detail-badges").innerHTML = [
    badge(module.queue),
    badge(module.tier_minimum_label || module.tier_minimum, allowed ? "" : "warn"),
    badge(allowed ? "tier access ok" : "tier upgrade needed", allowed ? "" : "warn"),
  ].join("");
  $("#module-contract").innerHTML = `
    <div class="module-contract-block">
      ${candidateMetric("Module ID", module.module_id)}
      ${candidateMetric("Queue", module.queue)}
      ${candidateMetric("Credits", module.credit_estimator)}
      ${candidateMetric("Failure Policy", module.failure_policy)}
    </div>
    <h3>Claim Boundary</h3>
    <p class="muted">${escapeHtml(module.claim_boundary)}</p>
    <h3>Quality Gate</h3>
    <p class="muted">${escapeHtml(module.quality_gate)}</p>
    <h3>Inputs</h3>
    <pre class="empty">${escapeHtml(JSON.stringify(module.input_schema, null, 2))}</pre>
    <h3>Outputs</h3>
    <pre class="empty">${escapeHtml(JSON.stringify(module.output_schema, null, 2))}</pre>
    <h3>Dependencies</h3>
    <div class="tag-row">${(module.dependencies || []).map((item) => badge(item)).join("")}</div>
  `;
  const payloadBox = $("#module-payload");
  if (payloadBox && document.activeElement !== payloadBox) payloadBox.value = state.moduleConsole.payloadText;
  const runButton = $("#module-run");
  if (runButton) {
    runButton.disabled = !allowed;
    runButton.textContent = allowed ? "Run Module" : "Upgrade Tier";
  }
}

function renderModuleEstimateAndResult() {
  const estimate = state.moduleConsole.estimate;
  $("#module-estimate-result").innerHTML = estimate
    ? `
      <div class="score-line">
        ${candidateMetric("Allowed", estimate.allowed ? "Yes" : "No")}
        ${candidateMetric("Quota", estimate.quota_status || "not checked")}
        ${candidateMetric("Credits", fmtScore(estimate.estimated_credits, 2))}
        ${candidateMetric("Balance", fmtScore(estimate.credit_balance, 1))}
      </div>
      ${estimate.quota_detail ? `<p class="error">${escapeHtml(estimate.quota_detail)}</p>` : ""}
    `
    : '<div class="empty">No estimate yet. Estimate or run a module to see credits and quota state.</div>';

  const result = state.moduleConsole.result;
  if (!result) {
    $("#module-result").innerHTML = '<div class="empty">No module result loaded yet.</div>';
    return;
  }
  const project = activeProject();
  const artifactRows = (result.artifacts || [])
    .map((artifact) => {
      const rel = projectFileRel(artifact.uri);
      const staticUrl =
        project?.name === "cancer_proof_v1" && String(artifact.uri || "").replaceAll("\\", "/").includes("outputs/cancer_proof_v1/")
          ? `/artifacts/${String(artifact.uri).replaceAll("\\", "/").split("outputs/cancer_proof_v1/", 2)[1]}`
          : "";
      const action = rel
        ? `<button class="download module-download" data-rel="${escapeHtml(rel)}" type="button">Download</button>`
        : staticUrl
        ? `<a class="download" href="${escapeHtml(resolveResourceUrl(staticUrl))}" target="_blank" rel="noreferrer">Open</a>`
        : "";
      return `
        <tr>
          <td>${escapeHtml(artifact.name)}</td>
          <td>${escapeHtml(artifact.type)}</td>
          <td>${badge(artifact.exists ? "exists" : "missing", artifact.exists ? "" : "fail")}</td>
          <td>${fmtBytes(artifact.size_bytes)}</td>
          <td>${action}</td>
        </tr>
      `;
    })
    .join("");
  $("#module-result").innerHTML = `
    <div class="signal">
      <div><strong>${escapeHtml(result.module_name || result.module_id)}</strong><span class="muted">${escapeHtml(result.run_id)}</span></div>
      ${badge(result.status, result.status === "succeeded" ? "" : result.status === "partial_success" ? "warn" : "fail")}
    </div>
    <div class="score-line">
      ${candidateMetric("Execution", result.execution_mode || "NA")}
      ${candidateMetric("Credits", fmtScore(result.credits_used, 2))}
    </div>
    <h3>Warnings</h3>
    ${(result.warnings || []).length ? `<ul>${result.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p class="muted">None</p>'}
    <h3>Limitations</h3>
    ${(result.limitations || []).length ? `<ul>${result.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p class="muted">None</p>'}
    <h3>Artifacts</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Size</th><th></th></tr></thead>
        <tbody>${artifactRows || '<tr><td colspan="5">No artifacts listed.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function renderModuleLogs() {
  const job = state.moduleConsole.activeJob;
  $("#module-live-job").innerHTML = job
    ? `
      <div class="signal">
        <div><strong>${escapeHtml(job.id)}</strong><span class="muted">${escapeHtml(job.output_dir || "output pending")}</span></div>
        ${badge(job.status, job.status === "succeeded" ? "" : job.status === "failed" ? "fail" : "warn")}
      </div>
      ${job.error ? `<p class="error">${escapeHtml(job.error)}</p>` : ""}
    `
    : '<div class="empty">No active module job selected.</div>';
  $("#module-live-log").innerHTML = (state.moduleConsole.logs || []).length
    ? state.moduleConsole.logs
        .map(
          (row) => `
            <div class="log-entry">
              <strong>${escapeHtml(row.level || "info")} ${escapeHtml(row.created_at || "")}</strong>
              <span>${escapeHtml(row.message || "")}</span>
            </div>
          `,
        )
        .join("")
    : '<div class="empty">Logs appear here after a module job starts.</div>';
}

function renderBulkResults() {
  const rows = state.moduleConsole.bulkResults || [];
  $("#module-bulk-results").innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <button class="module-test-row ${row.status}" data-job-id="${escapeHtml(row.job_id || "")}" type="button">
              <strong>${escapeHtml(row.name || row.module_id)}</strong>
              <span>${badge(row.status, row.status === "succeeded" ? "" : row.status === "blocked" ? "warn" : "fail")}</span>
              <small>${escapeHtml(row.detail || "")}</small>
            </button>
          `,
        )
        .join("")
    : '<div class="empty">Run a dry-run tier test to verify module access for the selected plan.</div>';
}

function renderModuleConsole() {
  renderModuleStatus();
  renderModuleAuthAndProject();
  renderTierGrid();
  renderUsageAndJobs();
  renderModuleGrid();
  renderModuleDetail();
  renderModuleEstimateAndResult();
  renderModuleLogs();
  renderBulkResults();
}

function renderTools() {
  const tools = state.tools.external_tools || {};
  const smoke = state.tools.smoke_tests || {};
  renderModuleConsole();
  $("#tool-grid").innerHTML = Object.entries(tools).length
    ? Object.entries(tools)
        .map(([name, payload]) => {
          const ok = payload?.available;
          return `
            <div class="tool-card">
              <strong>${escapeHtml(name)} ${badge(ok ? "Available" : "Missing", ok ? "" : "fail")}</strong>
              <span>${escapeHtml(payload?.version || payload?.path || payload?.note || "")}</span>
            </div>
          `;
        })
        .join("")
    : '<div class="empty">No tool manifest available.</div>';
  $("#smoke-grid").innerHTML = Object.entries(smoke).length
    ? Object.entries(smoke)
        .map(([name, payload]) => {
          const ok = payload?.ok;
          return `
            <div class="tool-card">
              <strong>${escapeHtml(name)} ${badge(ok ? "Passed" : "Failed", ok ? "" : "fail")}</strong>
              <span>${escapeHtml(payload?.mode || payload?.message || payload?.error || "")}</span>
            </div>
          `;
        })
        .join("")
    : '<div class="empty">No smoke-test manifest available.</div>';
}

function validationBlock(report) {
  if (!report || !Object.keys(report).length) {
    return '<div class="empty">No validation report available.</div>';
  }
  const errors = report.errors || [];
  const warnings = report.warnings || [];
  const checks = report.checks || {};
  return `
    <div class="signal">
      <div><strong>Status</strong><span class="muted">${escapeHtml(report.tier || "gate")}</span></div>
      ${badge(report.status || "unknown", statusTone(report.status))}
    </div>
    <h3>Errors</h3>
    ${errors.length ? `<ul>${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p class="muted">None</p>'}
    <h3>Warnings</h3>
    ${warnings.length ? `<ul>${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p class="muted">None</p>'}
    <h3>Checks</h3>
    <pre class="empty">${escapeHtml(JSON.stringify(checks, null, 2))}</pre>
  `;
}

function renderValidation() {
  $("#proof-validation").innerHTML = validationBlock(state.validation.proof);
  $("#production-validation").innerHTML = validationBlock(state.validation.production);
}

function renderInvestor() {
  const headline = state.investorMetrics.headline || {};
  const stats = [
    ["Targets", headline.targets],
    ["Generated", headline.generated_candidates],
    ["Docked", headline.docking_rows],
    ["GNINA", headline.gnina_rows],
    ["xTB", headline.qm_rows],
    ["QML", headline.qml_rows],
    ["ADMET", headline.trained_admet_endpoints],
    ["Research Gate", headline.production_gate],
  ];
  $("#investor-proof-metrics").innerHTML = stats
    .map(([label, value]) => {
      const display = Number.isFinite(Number(value)) ? fmtNumber(value) : value || "NA";
      return `<article class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(display)}</strong></article>`;
    })
    .join("");
  $("#investor-demo-flow").innerHTML = (state.investorMetrics.demo_flow || [])
    .map(
      (row) => `
        <div class="log-entry">
          <strong>${escapeHtml(row.minute)} - ${escapeHtml(row.screen)}</strong>
          <span>${escapeHtml(row.proof)}</span>
        </div>
      `,
    )
    .join("");
  $("#investor-tool-suite").innerHTML = (state.investorMetrics.tool_suite || [])
    .map(
      (tool) => `
        <div class="tool-card">
          <strong>${escapeHtml(tool.name)} ${badge(tool.status, tool.status === "REAL" ? "" : tool.status === "FAILED" ? "fail" : "warn")}</strong>
          <span>${escapeHtml(tool.evidence)}</span>
          <span>${escapeHtml(tool.output)}</span>
        </div>
      `,
    )
    .join("");
}

function render() {
  applyTheme(state.theme);
  const personaSelect = $("#persona-select");
  if (personaSelect) personaSelect.value = state.persona;
  setStatusText();
  renderArtifactHealth();
  renderDiscoverySuite();
  renderStats();
  renderPipeline();
  renderTopSignals();
  renderTargetWorkspace();
  renderCandidates();
  renderModels();
  renderQuantum();
  renderScientificEvidence();
  renderExperiments();
  renderViewerControls();
  renderGnina();
  renderTools();
  renderInvestor();
  renderValidation();
}

function setView(view, updateHash = true) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
  if (updateHash && window.location.hash.replace("#", "") !== view) {
    window.history.replaceState(null, "", `#${view}`);
  }
}

function bindEvents() {
  $("#theme-toggle").addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });
  $("#persona-select").addEventListener("change", (event) => {
    applyPersona(event.target.value);
    renderTools();
  });
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  const pathDefaultView = ["/app", "/modules"].includes(window.location.pathname) ? "tools" : "";
  const initialView = window.location.hash.replace("#", "") || pathDefaultView;
  if (initialView && $(`#view-${initialView}`)) setView(initialView, false);
  window.addEventListener("hashchange", () => {
    const view = window.location.hash.replace("#", "");
    if (view && $(`#view-${view}`)) setView(view, false);
  });
  $("#target-filter").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-target]");
    if (!button) return;
    state.target = button.dataset.target;
    $$("#target-filter button").forEach((item) => item.classList.toggle("active", item === button));
    renderCandidates();
  });
  $("#refresh-btn").addEventListener("click", () => {
    $("#run-status").textContent = "Refreshing";
    loadData().catch(showError);
  });
  $("#viewer-load").addEventListener("click", () => {
    loadPoseViewer().catch((error) => {
      $("#viewer-warning").innerHTML = `<span class="error">${escapeHtml(error.message)}</span>`;
    });
  });
  $("#viewer-open").addEventListener("click", () => {
    const first = (state.poseData.candidates || [])[0];
    if (first) openViewer(first.candidate_id, first.default_pose_source || "docked");
  });
  $("#viewer-close").addEventListener("click", closeViewer);
  $("#viewer-backdrop").addEventListener("click", closeViewer);
  $("#viewer-reset").addEventListener("click", () => {
    if (activeViewer) {
      activeViewer.zoomTo();
      activeViewer.render();
    }
  });
  $("#viewer-zoom-ligand").addEventListener("click", () => {
    if (activeViewer) {
      activeViewer.zoomTo(viewerLigandSelector);
      activeViewer.render();
    }
  });
  [
    ["viewer-toggle-cartoon", "cartoon"],
    ["viewer-toggle-surface", "surface"],
    ["viewer-toggle-spheres", "spheres"],
  ].forEach(([buttonId, key]) => {
    $(`#${buttonId}`).addEventListener("click", () => {
      viewerState[key] = !viewerState[key];
      $(`#${buttonId}`).classList.toggle("active", viewerState[key]);
      if (lastViewerPayload) renderViewerModels(lastViewerPayload.pdbText, lastViewerPayload.sdfText);
    });
  });
  $("#gnina-start").addEventListener("click", async () => {
    $("#gnina-summary").innerHTML = '<div class="empty">Starting GNINA screen...</div>';
    try {
      await postJson("/research/gnina/start", { depth_mode: $("#gnina-depth-mode").value, box_size: 30, exhaustiveness: 1, num_modes: 3, cpu: 4 });
      await refreshGnina();
    } catch (error) {
      $("#gnina-summary").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".load-docked-pose");
    if (!button) return;
    openViewer(button.dataset.candidate, button.dataset.source || "docked");
  });
  $("#viewer-target").addEventListener("change", () => {
    const target = $("#viewer-target").value;
    const match = (state.poseData.candidates || []).find((candidate) => candidate.target_id === target);
    if (match) setViewerCandidate(match);
  });
  $("#viewer-candidate-search").addEventListener("change", syncViewerCandidateFromSearch);
  $("#viewer-candidate-search").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    syncViewerCandidateFromSearch();
    loadPoseViewer().catch((error) => {
      $("#viewer-warning").innerHTML = `<span class="error">${escapeHtml(error.message)}</span>`;
    });
  });
  $("#predictor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#predict-result").innerHTML = '<div class="empty">Running saved models...</div>';
    try {
      const payload = {
        target_id: $("#predict-target").value,
        smiles: $("#predict-smiles").value.trim(),
      };
      const result = await postJson("/research/models/predict", payload);
      renderPrediction(result);
    } catch (error) {
      $("#predict-result").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  });
  $("#module-login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      moduleStatusMessage("Logging in...");
      await authenticateModuleConsole("login");
    } catch (error) {
      moduleStatusMessage(error.message, "error");
    }
  });
  $("#module-signup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      moduleStatusMessage("Creating account...");
      await authenticateModuleConsole("signup");
    } catch (error) {
      moduleStatusMessage(error.message, "error");
    }
  });
  $("#module-project-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const name = $("#module-project-name").value.trim() || "cancer_proof_v1";
      moduleStatusMessage(`Connecting project ${name}...`);
      await createOrConnectProject(name);
      moduleStatusMessage(`Active project is ${name}.`);
    } catch (error) {
      moduleStatusMessage(error.message, "error");
    }
  });
  $("#module-project-select").addEventListener("change", async (event) => {
    state.moduleConsole.activeProjectId = event.target.value;
    window.localStorage.setItem("qai_active_project_id", state.moduleConsole.activeProjectId);
    await loadModuleConsoleContext({ silent: true });
  });
  $("#module-demo-setup").addEventListener("click", () => {
    startLocalModuleDemo().catch((error) => moduleStatusMessage(error.message, "error"));
  });
  $("#module-refresh").addEventListener("click", () => {
    loadModuleConsoleContext().catch((error) => moduleStatusMessage(error.message, "error"));
  });
  $("#module-tier-grid").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-tier]");
    if (!button) return;
    try {
      moduleStatusMessage(`Switching tier to ${button.dataset.tier}...`);
      await setPlanTier(button.dataset.tier);
      moduleStatusMessage(`Selected tier: ${button.dataset.tier}.`);
    } catch (error) {
      state.moduleConsole.selectedTier = button.dataset.tier;
      window.localStorage.setItem("qai_selected_tier", button.dataset.tier);
      moduleStatusMessage(error.message, "error");
      renderTools();
    }
  });
  $("#module-depth").addEventListener("change", (event) => {
    state.moduleConsole.selectedDepth = event.target.value;
    window.localStorage.setItem("qai_selected_depth", state.moduleConsole.selectedDepth);
  });
  $("#module-filter").addEventListener("change", (event) => {
    state.moduleConsole.moduleFilter = event.target.value;
    renderTools();
  });
  $("#module-grid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-module-id]");
    if (!button) return;
    setSelectedModule(button.dataset.moduleId);
  });
  $("#module-payload").addEventListener("input", (event) => {
    state.moduleConsole.payloadText = event.target.value;
  });
  $("#module-reset-payload").addEventListener("click", () => {
    const module = selectedModule();
    if (!module) return;
    state.moduleConsole.payloadText = JSON.stringify(defaultPayloadForModule(module.module_id), null, 2);
    renderTools();
  });
  $("#module-estimate").addEventListener("click", async () => {
    try {
      $("#module-estimate-result").innerHTML = '<div class="empty">Estimating credits and quota...</div>';
      await estimateSelectedModule();
    } catch (error) {
      $("#module-estimate-result").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  });
  $("#module-run-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      $("#module-live-job").innerHTML = '<div class="empty">Queueing module job...</div>';
      await runSelectedModule();
    } catch (error) {
      $("#module-live-job").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  });
  $("#module-bulk-test").addEventListener("click", async () => {
    try {
      moduleStatusMessage("Running tier dry-run matrix...");
      await runTierDryTest();
    } catch (error) {
      moduleStatusMessage(error.message, "error");
    }
  });
  $("#module-job-list").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-job-id]");
    if (!button) return;
    try {
      await pollModuleJob(button.dataset.jobId);
    } catch (error) {
      moduleStatusMessage(error.message, "error");
    }
  });
  $("#module-bulk-results").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-job-id]");
    if (!button || !button.dataset.jobId) return;
    try {
      await pollModuleJob(button.dataset.jobId);
    } catch (error) {
      moduleStatusMessage(error.message, "error");
    }
  });
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".module-download");
    if (!button) return;
    event.preventDefault();
    try {
      await downloadProjectFile(button.dataset.rel);
    } catch (error) {
      moduleStatusMessage(error.message, "error");
    }
  });
}

function showError(error) {
  $("#status-strip").insertAdjacentHTML("afterend", `<div class="error">${escapeHtml(error.message)}</div>`);
}

applyTheme(state.theme);
applyPersona(state.persona);
hydrateBackendAssets();
bindEvents();
loadData()
  .then(() => loadModuleConsoleContext({ silent: true }))
  .catch(showError);
