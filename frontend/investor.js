const $ = (selector) => document.querySelector(selector);

const RESEARCH_API_BASE = window.location.port === "3000" ? "http://127.0.0.1:8000" : window.location.origin;

function resolveBackendUrl(url) {
  const value = String(url || "");
  if (/^(https?:|blob:|data:|#)/i.test(value)) return value;
  if (value.startsWith("/")) return `${RESEARCH_API_BASE}${value}`;
  return value;
}

function hydrateBackendAssets() {
  document.querySelectorAll("[data-backend-src]").forEach((element) => {
    element.src = resolveBackendUrl(element.dataset.backendSrc);
  });
  document.querySelectorAll("[data-backend-href]").forEach((element) => {
    element.href = resolveBackendUrl(element.dataset.backendHref);
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

function fmt(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "NA";
  return number.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function score(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "NA";
  return number.toFixed(3);
}

function badge(text) {
  const value = String(text || "unknown");
  const tone = value === "REAL" || value === "pass" ? "" : value === "FAILED" || value === "fail" ? "fail" : "warn";
  return `<span class="badge ${tone}">${escapeHtml(value)}</span>`;
}

async function getJson(url) {
  const response = await fetch(resolveBackendUrl(url), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function renderHero(metrics, candidates) {
  const headline = metrics.headline || {};
  const cards = [
    ["Targets", headline.targets],
    ["Generated", headline.generated_candidates],
    ["Docked", headline.docking_rows],
    ["GNINA", headline.gnina_rows],
    ["xTB Rows", headline.qm_rows],
    ["QML Rows", headline.qml_rows],
    ["ADMET Models", headline.trained_admet_endpoints],
    ["Research Gate", headline.production_gate],
  ];
  $("#hero-metrics").innerHTML = cards
    .map(([label, value]) => {
      const display = Number.isFinite(Number(value)) ? fmt(value) : value || "NA";
      return `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(display)}</strong></article>`;
    })
    .join("");
  const images = candidates
    .filter((row) => row.png_url)
    .slice(0, 6)
    .map((row) => `<img src="${escapeHtml(row.png_url)}" alt="${escapeHtml(row.candidate_id)} molecule">`)
    .join("");
  $("#molecule-strip").innerHTML = images || '<div class="empty">Molecule images load after the research pipeline builds assets.</div>';
}

function renderWorkflow(metrics) {
  const rows = metrics.pipeline_funnel || [];
  const max = Math.max(...rows.map((row) => Number(row.count) || 0), 1);
  $("#workflow").innerHTML = rows
    .map((row) => {
      const width = Math.max(3, ((Number(row.count) || 0) / max) * 100);
      return `
        <div class="workflow-row">
          <strong>${escapeHtml(row.stage)}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <span>${fmt(row.count)}</span>
        </div>
      `;
    })
    .join("");
}

function renderTools(metrics) {
  $("#tool-suite").innerHTML = (metrics.tool_suite || [])
    .map(
      (tool) => `
        <article class="tool-card">
          <div>${badge(tool.status)}</div>
          <h3>${escapeHtml(tool.name)}</h3>
          <span>${escapeHtml(tool.evidence)}</span>
          <p>${escapeHtml(tool.output)}</p>
        </article>
      `,
    )
    .join("");
}

function renderTargets(metrics) {
  const rows = (metrics.targets || [])
    .map(
      (row) => `
      <tr>
        <td><strong>${escapeHtml(row.target_id)}</strong></td>
        <td>${fmt(row.benchmark_records)}</td>
        <td>${fmt(row.top_candidates)}</td>
        <td>${escapeHtml(row.best_candidate || "NA")}</td>
        <td>${score(row.best_final_score)}</td>
        <td>${score(row.best_quantum_delta)}</td>
        <td>${fmt(row.docking_rows)}</td>
        <td>${fmt(row.gnina_rows)}</td>
      </tr>
    `,
    )
    .join("");
  $("#target-table").innerHTML = `
    <table>
      <thead>
        <tr><th>Target</th><th>Benchmark</th><th>Top</th><th>Best Candidate</th><th>Score</th><th>Q Delta</th><th>Docking</th><th>GNINA</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderQuantum(metrics) {
  $("#prefilter-count").textContent = `${fmt(metrics.quantum?.prefilter_rows)} rows`;
  $("#qm-count").textContent = `${fmt(metrics.quantum?.qm_rows)} xTB rows`;
  $("#qml-count").textContent = `${fmt(metrics.quantum?.qml_rows)} QML rows`;
}

function renderDemo(metrics) {
  $("#demo-flow").innerHTML = (metrics.demo_flow || [])
    .map(
      (row) => `
        <div class="flow-row">
          <strong>${escapeHtml(row.minute)}</strong>
          <span>${escapeHtml(row.screen)}</span>
          <div>${escapeHtml(row.proof)}</div>
        </div>
      `,
    )
    .join("");
}

function renderReadiness(metrics) {
  const validation = metrics.validation || {};
  const proof = validation.proof || {};
  const production = validation.production || {};
  const model = metrics.model_quality || {};
  const quantum = metrics.quantum || {};
  const cards = [
    ["Proof gate", proof.status, (proof.warnings || []).length ? `${proof.warnings.length} warnings` : "No blocking errors"],
    ["Research evidence gate", production.status, (production.warnings || []).join("; ") || "No warnings"],
    ["Activity models", model.activity_models, `mean ROC-AUC ${score(model.activity_mean_roc_auc)}`],
    ["ADMET endpoints", model.admet_trained_endpoints, `mean AP ${score(model.admet_mean_average_precision)}`],
    ["Quantum ablation", score(quantum.mean_quantum_delta), "mean final-score contribution"],
    ["Reports", metrics.headline?.report_pdf ? "Available" : "Missing", "HTML, PDF, completion report"],
  ];
  $("#readiness").innerHTML = cards
    .map(
      ([title, value, meta]) => `
        <article class="readiness-card">
          <span>${escapeHtml(title)}</span>
          <strong>${escapeHtml(String(value ?? "NA"))}</strong>
          <p>${escapeHtml(meta)}</p>
        </article>
      `,
    )
    .join("");
}

function renderError(error) {
  $("#hero-metrics").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
}

async function boot() {
  const [metrics, candidates] = await Promise.all([
    getJson("/research/investor-metrics"),
    getJson("/research/top-candidates?limit=24"),
  ]);
  renderHero(metrics, candidates);
  renderWorkflow(metrics);
  renderTools(metrics);
  renderTargets(metrics);
  renderQuantum(metrics);
  renderDemo(metrics);
  renderReadiness(metrics);
}

hydrateBackendAssets();
boot().catch(renderError);
