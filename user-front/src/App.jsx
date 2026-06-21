import { useEffect, useRef, useState } from "react";
import {
  addProjectTarget,
  aiModelStatus,
  analyzeProteinWithEsm2,
  apiUrl,
  assistantChat,
  assistantStatus,
  billingSummary,
  createProject,
  createIsolatedRun,
  dockPreviewMolecule,
  enrichDataFabric,
  fetchProteinEvidence,
  fetchDataFabricStatus,
  fetchDockingTools,
  fetchResourceRegistry,
  fetchTools,
  fetchTopCandidates,
  appendRunEvent,
  login,
  setBillingPlan,
  signup,
  reviewDockingVision,
  runRealtimeDocking,
} from "./api.js";
import {
  ALPHAFOLD_REPOSITORY,
  DEFAULT_PATIENT,
  DIAGNOSES,
  ELEMENTS,
  EXPORT_PRESETS,
  HUMAN_SAFETY_PANEL,
  INSILICO_MODULES,
  INORGANIC_STARTERS,
  ORGANIC_STARTERS,
  PHARMA_ASSET_LIBRARY,
  PIPELINE_STAGES,
  RESEARCH_TOOLKIT,
  TIER_ORDER,
  TIERS,
} from "./data.js";
import {
  AuroraBackground,
  FlowTrail,
  MagnetButton,
  OrbitalTargetMap,
  Reveal,
  ShinyText,
  SplitText,
  SpotlightCard,
  TiltCard,
} from "./effects.jsx";

const SESSION_KEY = "qai_user_front_session";
const COPILOT_HISTORY_KEY = "qdf_copilot_history";
const RAIL_COLLAPSED_KEY = "qdf_rail_collapsed";
const FULL_DOCKING_STACK_ENGINES = ["gnina", "vina", "smina"];

function readSession() {
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readCopilotHistory() {
  try {
    const history = JSON.parse(window.localStorage.getItem(COPILOT_HISTORY_KEY) || "null");
    return Array.isArray(history) && history.length ? history : null;
  } catch {
    return null;
  }
}

function writeCopilotHistory(messages) {
  window.localStorage.setItem(COPILOT_HISTORY_KEY, JSON.stringify(messages.slice(-40)));
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    email: "researcher@quinfo.dev",
    password: "research-pass-123",
    displayName: "Quinfo Researcher",
    organizationName: "Quinfo Discovery Lab",
    tier: "academic_researcher",
  });
  const [authError, setAuthError] = useState("");
  const [busyAuth, setBusyAuth] = useState(false);
  const [patient, setPatient] = useState(DEFAULT_PATIENT);
  const [search, setSearch] = useState("");
  const [selectedProteinIds, setSelectedProteinIds] = useState(["non_small_cell_lung_cancer_EGFR", "non_small_cell_lung_cancer_KRAS", "non_small_cell_lung_cancer_MET"]);
  const [run, setRun] = useState({
    status: "idle",
    activeStage: -1,
    progress: 0,
    logs: [],
    candidates: [],
    project: null,
    backendJob: null,
    proteinEvidence: null,
    dataFabric: null,
    isolatedRun: null,
    events: [],
    warning: "",
  });
  const [tools, setTools] = useState(null);
  const [billingWarning, setBillingWarning] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState("discovery");
  const [customMolecules, setCustomMolecules] = useState([]);
  const [railCollapsed, setRailCollapsed] = useState(() => window.localStorage.getItem(RAIL_COLLAPSED_KEY) === "1");
  const [consoleMinimized, setConsoleMinimized] = useState(false);

  const tier = session?.billing?.plan_tier || session?.tier || authForm.tier;
  const tierConfig = TIERS[tier] || TIERS.student_free;
  const diagnosis = DIAGNOSES.find((item) => item.id === patient.diagnosis) || DIAGNOSES[0];
  const diagnosisProteins = ALPHAFOLD_REPOSITORY.filter((protein) => protein.diagnosisId === diagnosis.id);
  const filteredProteins = diagnosisProteins.filter((protein) => {
    const text = `${protein.gene} ${protein.uniprot} ${protein.alphafoldId} ${protein.role} ${protein.variants.join(" ")}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });
  const selectedProteins = ALPHAFOLD_REPOSITORY.filter((protein) => selectedProteinIds.includes(protein.id));
  const tierFeatures = buildTierFeatures(tier, tools);

  useEffect(() => {
    window.localStorage.setItem(RAIL_COLLAPSED_KEY, railCollapsed ? "1" : "0");
  }, [railCollapsed]);

  useEffect(() => {
    if (!session?.token || session.demo) return;
    let cancelled = false;
    Promise.allSettled([billingSummary(session.token), fetchTools()]).then((results) => {
      if (cancelled) return;
      const billing = results[0].status === "fulfilled" ? results[0].value : session.billing;
      const toolPayload = results[1].status === "fulfilled" ? results[1].value : null;
      if (results[0].status === "rejected") setBillingWarning(results[0].reason.message);
      setTools(toolPayload);
      const nextSession = { ...session, billing };
      setSession(nextSession);
      writeSession(nextSession);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.demo]);

  function updateAuth(field, value) {
    setAuthForm((current) => ({ ...current, [field]: value }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setBusyAuth(true);
    setAuthError("");
    try {
      const tokenPayload =
        authMode === "signup"
          ? await signup(authForm)
          : await login({ email: authForm.email, password: authForm.password });
      let billing = null;
      if (authMode === "signup") {
        try {
          billing = await setBillingPlan(tokenPayload.access_token, authForm.tier);
        } catch (error) {
          setBillingWarning(`Signed up, but tier activation needs admin action: ${error.message}`);
        }
      }
      if (!billing) {
        try {
          billing = await billingSummary(tokenPayload.access_token);
        } catch {
          billing = { plan_tier: authForm.tier, credit_balance: null, monthly_credit_limit: null };
        }
      }
      const nextSession = {
        token: tokenPayload.access_token,
        userId: tokenPayload.user_id,
        organizationId: tokenPayload.organization_id,
        role: tokenPayload.role,
        email: authForm.email,
        tier: billing?.plan_tier || authForm.tier,
        billing,
      };
      setSession(nextSession);
      writeSession(nextSession);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setBusyAuth(false);
    }
  }

  function continueDemo() {
    const nextSession = {
      demo: true,
      token: null,
      userId: "demo-user",
      organizationId: "demo-org",
      role: "researcher",
      email: "demo@quinfo.local",
      tier: authForm.tier,
      billing: demoBilling(authForm.tier),
    };
    setSession(nextSession);
    writeSession(nextSession);
  }

  function logout() {
    setSession(null);
    writeSession(null);
    setRun({ status: "idle", activeStage: -1, progress: 0, logs: [], candidates: [], project: null, backendJob: null, proteinEvidence: null, dataFabric: null, isolatedRun: null, events: [], warning: "" });
  }

  function updatePatient(field, value) {
    setPatient((current) => ({ ...current, [field]: value }));
  }

  function resetRunForTargetChange() {
    setRun((current) => {
      if (current.status === "idle" && !current.candidates.length && !current.logs.length) return current;
      return {
        status: "idle",
        activeStage: -1,
        progress: 0,
        logs: [],
        candidates: [],
        project: null,
        backendJob: null,
        proteinEvidence: null,
        dataFabric: null,
        isolatedRun: null,
        events: [],
        warning: "Target context changed. Launch the pipeline again to rank candidates for the selected diagnosis and proteins.",
      };
    });
  }

  function changeDiagnosis(diagnosisId) {
    setPatient((current) => ({ ...current, diagnosis: diagnosisId }));
    const nextProteins = ALPHAFOLD_REPOSITORY.filter((protein) => protein.diagnosisId === diagnosisId)
      .slice(0, Math.min(3, tierConfig.maxProteins))
      .map((protein) => protein.id);
    setSelectedProteinIds(nextProteins);
    setSearch("");
    resetRunForTargetChange();
  }

  function toggleProtein(protein) {
    if (!selectedProteinIds.includes(protein.id) && selectedProteinIds.length >= tierConfig.maxProteins) return;
    setSelectedProteinIds((current) => (current.includes(protein.id) ? current.filter((id) => id !== protein.id) : [...current, protein.id]));
    resetRunForTargetChange();
  }

  function autoSelectProteins() {
    const ranked = diagnosisProteins
      .map((protein) => ({ protein, score: scoreProteinForPatient(protein, patient) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(tierConfig.maxProteins, diagnosisProteins.length))
      .map((item) => item.protein.id);
    setSelectedProteinIds(ranked);
    resetRunForTargetChange();
  }

  function updateWorkbenchCandidate(updatedCandidate) {
    if (!updatedCandidate?.id) return;
    setRun((current) => ({
      ...current,
      candidates: (current.candidates || []).map((candidate) => (candidate.id === updatedCandidate.id ? updatedCandidate : candidate)),
    }));
    setCustomMolecules((current) => current.map((candidate) => (candidate.id === updatedCandidate.id ? updatedCandidate : candidate)));
  }

  async function startPipeline() {
    if (!selectedProteins.length) {
      setRun((current) => ({ ...current, warning: "Select at least one AlphaFold protein before starting the pipeline." }));
      return;
    }
    const runUserId = session?.userId || "demo-user";
    const eventProgress = {
      orchestration: 2,
      "01_target_prep": 14,
      "02_ligand_library": 26,
      "03_docking": 38,
      "04_interaction_fingerprints": 49,
      "05_physics_refinement": 60,
      "06_admet_tox": 70,
      "07_quantum_qm": 80,
      "08_sar_decision": 91,
      "09_assay_handoff": 100,
    };
    let isolatedRun = null;
    let project = null;
    let backendJob = null;
    let warning = "";
    setRun({
      status: "running",
      activeStage: 0,
      progress: 0,
      logs: [],
      candidates: [],
      project: null,
      backendJob: null,
      proteinEvidence: null,
      dataFabric: null,
      isolatedRun: null,
      events: [],
      warning: "",
    });
    setConsoleMinimized(false);

    async function recordEvent(module, event, status, message, data = {}, artifacts = []) {
      const progress = eventProgress[module] ?? 0;
      const moduleNumber = Number(String(module).slice(0, 2));
      const eventRecord = {
        timestamp: new Date().toISOString(),
        module,
        event,
        status,
        message,
        progress,
        data,
        artifacts,
      };
      setRun((current) => ({
        ...current,
        status: status === "failed" ? "failed" : current.status,
        activeStage: Number.isFinite(moduleNumber) && moduleNumber > 0 ? Math.min(moduleNumber - 1, PIPELINE_STAGES.length - 1) : current.activeStage,
        progress: Math.max(current.progress || 0, progress),
        logs: [...current.logs, `${module}: ${message}`],
        events: [...(current.events || []), eventRecord],
        isolatedRun,
        project,
        backendJob,
        warning,
      }));
      if (isolatedRun?.run_id) {
        try {
          await appendRunEvent(isolatedRun.run_id, runUserId, { module, event, status, message, progress, data, artifacts });
        } catch (error) {
          setRun((current) => ({
            ...current,
            logs: [...current.logs, `orchestration: event mirror failed: ${error.message}`],
          }));
        }
      }
      return eventRecord;
    }

    try {
      isolatedRun = await createIsolatedRun({
        user_id: runUserId,
        profile: {
          email: session?.email,
          tier,
        },
        inputs: {
          patient,
          selected_proteins: selectedProteins.map((protein) => ({
            gene: protein.gene,
            uniprot: protein.uniprot,
            alphafold_id: protein.alphafoldId,
            variants: protein.variants,
          })),
          user_ligand_count: customMolecules.length,
        },
        reference_mode: customMolecules.length ? "user_ligands_plus_benchmark_comparators" : "benchmark_comparator_only",
      });
      await recordEvent(
        "orchestration",
        "run_created",
        "started",
        `Created isolated workspace ${isolatedRun.run_id}.`,
        { workspace_root: isolatedRun.workspace_root, reference_mode: isolatedRun.manifest?.reference_mode },
        [{ label: "manifest", path: `${isolatedRun.workspace_root}/manifest.json` }],
      );
    } catch (error) {
      warning = `Isolated run workspace could not be created: ${error.message}`;
      await recordEvent("orchestration", "run_workspace_failed", "warning", warning, {});
    }

    if (session?.token && !session.demo) {
      try {
        await recordEvent("orchestration", "project_bridge_started", "started", "Creating authenticated backend project metadata.", {});
        project = await createProject(session.token, {
          name: `${patient.caseId || "case"}_${diagnosis.short}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
        });
        for (const protein of selectedProteins) {
          await addProjectTarget(session.token, project.id, protein, patient);
        }
        await recordEvent("orchestration", "project_bridge_completed", "completed", `Project ${project.id} registered with ${selectedProteins.length} target(s).`, { project_id: project.id });
      } catch (error) {
        warning = `Backend patient-run bridge failed; isolated orchestration continues: ${error.message}`;
        await recordEvent("orchestration", "project_bridge_failed", "warning", warning, {});
      }
    } else {
      warning = "Unauthenticated local run: isolated workspace and live connector calls are used; benchmark candidates are comparator-only unless you add user molecules from Chemistry Bench.";
      await recordEvent("orchestration", "local_workspace_mode", "warning", warning, { demo: Boolean(session?.demo) });
    }

    let proteinEvidence = null;
    try {
      await recordEvent("01_target_prep", "target_prep_started", "started", "Resolving target sequences and ESM target-context evidence.", {
        targets: selectedProteins.map((protein) => protein.gene),
      });
      proteinEvidence = await fetchProteinEvidence({
        targets: selectedProteins.map((protein) => ({
          gene: protein.gene,
          uniprot: protein.uniprot,
          alphafold_id: protein.alphafoldId,
          role: protein.role,
          variants: protein.variants,
        })),
        patient_context: {
          caseId: patient.caseId,
          diagnosis: patient.diagnosis,
          variants: patient.variants,
          expression: patient.expression,
          proteomics: patient.proteomics,
          priorTherapy: patient.priorTherapy,
          constraints: patient.constraints,
        },
        use_esm: true,
        output_format: "npz",
      });
      const summary = proteinEvidence.summary || {};
      await recordEvent(
        "01_target_prep",
        "target_prep_completed",
        "completed",
        `${summary.sequence_count || 0}/${summary.target_count || selectedProteins.length} sequences resolved; ${summary.esm_generated_count || 0} ESM embeddings generated.`,
        summary,
      );
      setRun((current) => ({
        ...current,
        proteinEvidence,
      }));
    } catch (error) {
      warning = `${warning ? `${warning} ` : ""}Protein AI evidence unavailable: ${error.message}`;
      await recordEvent("01_target_prep", "target_prep_failed", "warning", `Protein AI evidence skipped: ${error.message}`, {});
    }

    let rawCandidates = [];
    try {
      await recordEvent(
        "02_ligand_library",
        "ligand_library_started",
        "started",
        customMolecules.length
          ? `Using ${customMolecules.length} user-designed molecule(s) plus optional benchmark comparators.`
          : "No user ligand set is attached; reading benchmark candidates only as labelled comparators.",
        { user_ligand_count: customMolecules.length },
      );
      rawCandidates = await fetchTopCandidates(120);
      await recordEvent(
        "02_ligand_library",
        "benchmark_comparator_read",
        customMolecules.length ? "completed" : "warning",
        `${rawCandidates.length} benchmark/reference candidate row(s) read. These do not substitute for user-supplied ligands.`,
        { candidate_rows: rawCandidates.length, source: "outputs/cancer_proof_v1/top_candidates.csv" },
      );
    } catch (error) {
      warning = `${warning ? `${warning} ` : ""}Candidate API unavailable; only user molecules and synthetic placeholders may appear: ${error.message}`;
      await recordEvent("02_ligand_library", "ligand_library_failed", "warning", `Candidate API unavailable: ${error.message}`, {});
    }
    let dataFabric = null;
    try {
      const selectedGenes = selectedProteins.map((protein) => protein.gene.toUpperCase());
      const liveLigands = (rawCandidates || [])
        .filter((candidate) => selectedGenes.includes(String(candidate.target_id || "").toUpperCase()))
        .slice(0, 60)
        .map((candidate) => ({
          candidate_id: candidate.candidate_id,
          target: candidate.target_id,
          smiles: candidate.canonical_smiles || candidate.smiles || candidate.smiles_qm,
          chembl_id: candidate.chembl_id,
        }))
        .filter((ligand) => ligand.smiles || ligand.chembl_id);
      await recordEvent(
        "02_ligand_library",
        "source_read",
        "started",
        `Realtime data fabric is enriching ${selectedProteins.length} target(s) and ${liveLigands.length} ligand datapoint(s).`,
        { sources: ["ChEMBL", "PubChem", "UniProt", "Open Targets"], ligand_count: liveLigands.length },
      );
      dataFabric = await enrichDataFabric({
        targets: selectedProteins.map((protein) => ({
          gene: protein.gene,
          uniprot: protein.uniprot,
          role: protein.role,
        })),
        ligands: liveLigands,
        diagnosis: patient.diagnosis,
        max_chembl_activities: 120,
        max_ligands: 60,
        use_live: true,
      });
      const summary = dataFabric.summary || {};
      await recordEvent(
        "02_ligand_library",
        "source_read",
        "completed",
        `${summary.chembl_activity_datapoints || 0} ChEMBL activities, ${summary.chembl_unique_molecules || 0} unique bioactivity molecules, ${summary.pubchem_property_hits || 0} PubChem ligand hits.`,
        summary,
      );
      setRun((current) => ({
        ...current,
        dataFabric,
      }));
    } catch (error) {
      warning = `${warning ? `${warning} ` : ""}Realtime data fabric unavailable: ${error.message}`;
      await recordEvent("02_ligand_library", "source_read_failed", "warning", `Realtime data fabric skipped: ${error.message}`, {});
    }

    await recordEvent(
      "03_docking",
      "docking_artifact_review",
      rawCandidates.some((candidate) => candidate.gnina_pose_sdf_url || candidate.docked_sdf_url) ? "completed" : "warning",
      rawCandidates.some((candidate) => candidate.gnina_pose_sdf_url || candidate.docked_sdf_url)
        ? "Existing docking artifacts were inspected and labelled by source; run per-molecule GNINA/Vina from Molecule Workbench for user-derived docking."
        : "No real docking artifacts were produced in this run. Use Molecule Workbench real docking for user ligands.",
      { comparator_pose_rows: rawCandidates.filter((candidate) => candidate.gnina_pose_sdf_url || candidate.docked_sdf_url).length },
    );
    await recordEvent("04_interaction_fingerprints", "module_gap", "warning", "Interaction fingerprints are not recomputed in this interactive run unless a full backend evidence job is launched.", {});
    await recordEvent("05_physics_refinement", "module_gap", "warning", "Physics refinement is not recomputed in this interactive run; existing MD-like fields are treated as comparator evidence only.", {});
    await recordEvent("06_admet_tox", "admet_review", "completed", "ADMET/tox descriptor fields were read from candidate artifacts and live RDKit descriptors where available.", {});
    await recordEvent("07_quantum_qm", "qm_review", "warning", "QM/QML fields are read when present; conformer-ensemble xTB is not launched by this UI run yet.", {});

    let candidates = rankCandidates(rawCandidates || [], selectedProteins, patient, tierConfig.maxCandidates, proteinEvidence, dataFabric);
    const previewTargets = candidates.filter(candidateNeedsStructurePreview);
    if (previewTargets.length) {
      await recordEvent(
        "03_docking",
        "structure_preview_started",
        "started",
        `Generating RDKit/MMFF structure previews for ${previewTargets.length} candidate(s) without SDF artifacts.`,
        { candidate_ids: previewTargets.map((candidate) => candidate.id) },
      );
      const previewResult = await hydrateStructurePreviews(candidates, patient, selectedProteins, tier);
      candidates = previewResult.candidates;
      if (previewResult.failed) {
        warning = `${warning ? `${warning} ` : ""}${previewResult.failed} structure preview(s) failed; affected candidates remain labelled as missing artifacts.`;
      }
      await recordEvent(
        "03_docking",
        "structure_preview_completed",
        previewResult.failed ? "warning" : "completed",
        `${previewResult.completed} structure preview artifact(s) generated; ${previewResult.failed} failed.`,
        { completed: previewResult.completed, failed: previewResult.failed, errors: previewResult.errors.slice(0, 5) },
      );
    }
    let dockingToolStatus = null;
    try {
      dockingToolStatus = await fetchDockingTools();
      const stackEngines = availableDockingEngines(dockingToolStatus);
      const stackLimit = Math.min(candidates.length, Math.max(3, selectedProteins.length * 2));
      const stackTargets = candidates.filter(candidateCanRunDocking).slice(0, stackLimit);
      if (stackTargets.length) {
        await recordEvent(
          "03_docking",
          "full_stack_docking_started",
          "started",
          `Running ${stackEngines.map((item) => item.toUpperCase()).join(", ")} for ${stackTargets.length} top dockable candidate(s).`,
          { engines: stackEngines, candidate_ids: stackTargets.map((candidate) => candidate.id) },
        );
        let stackCompleted = 0;
        let stackFailed = 0;
        const updatedById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
        for (const candidate of stackTargets) {
          const result = await runDockingStackForCandidate(candidate, {
            engines: stackEngines,
            context: {
              caseId: patient.caseId,
              diagnosis: patient.diagnosis,
              source: "pipeline_full_stack_docking",
            },
            onProgress: ({ engine: progressEngine, status: progressStatus, error }) => {
              const message = error
                ? `${candidate.id}: ${progressEngine.toUpperCase()} failed: ${error.message}`
                : `${candidate.id}: ${progressEngine.toUpperCase()} ${progressStatus}.`;
              setRun((current) => ({
                ...current,
                logs: [...current.logs, `03_docking: ${message}`],
              }));
            },
          });
          updatedById.set(candidate.id, result.candidate);
          stackCompleted += result.results.length;
          stackFailed += result.errors.length;
        }
        candidates = candidates.map((candidate) => updatedById.get(candidate.id) || candidate);
        if (stackFailed) {
          warning = `${warning ? `${warning} ` : ""}${stackFailed} docking engine run(s) failed; completed engine poses remain attached.`;
        }
        await recordEvent(
          "03_docking",
          "full_stack_docking_completed",
          stackFailed ? "warning" : "completed",
          `${stackCompleted} docking engine run(s) completed across GNINA/Vina/Smina; ${stackFailed} failed.`,
          { completed_engine_runs: stackCompleted, failed_engine_runs: stackFailed },
        );
      }
    } catch (error) {
      warning = `${warning ? `${warning} ` : ""}Full docking stack unavailable: ${error.message}`;
      await recordEvent("03_docking", "full_stack_docking_failed", "warning", `Full docking stack skipped: ${error.message}`, { tool_status: dockingToolStatus });
    }
    await recordEvent(
      "08_sar_decision",
      "rerank_completed",
      "completed",
      `${candidates.length} candidate/comparator row(s) ranked with explicit evidence tags and data richness separated from binding claims.`,
      { candidate_count: candidates.length },
    );
    await recordEvent(
      "09_assay_handoff",
      "handoff_ready",
      "completed",
      "Research dossier is ready with module gaps, source reads, benchmark-comparator warnings, and wet-lab validation boundary.",
      { export_tabs: ["Molecules", "Research Tools", "Artifacts"] },
    );
    setRun((current) => ({
      ...current,
      status: warning ? "complete_with_warnings" : "complete",
      progress: 100,
      candidates,
      proteinEvidence,
      dataFabric,
      isolatedRun,
      warning,
      logs: [...current.logs, `09_assay_handoff: candidate dossier complete with ${candidates.length} computational hypotheses/comparators.`],
    }));
  }

  if (!session) {
    return (
      <AuthPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        updateAuth={updateAuth}
        handleAuthSubmit={handleAuthSubmit}
        busyAuth={busyAuth}
        authError={authError}
        continueDemo={continueDemo}
      />
    );
  }

  return (
    <div className={`app-shell ${railCollapsed ? "rail-collapsed" : ""}`}>
      <AuroraBackground />
      <aside className="user-rail">
        <button
          className="rail-toggle"
          type="button"
          onClick={() => setRailCollapsed((current) => !current)}
          aria-label={railCollapsed ? "Expand navigation rail" : "Collapse navigation rail"}
        >
          {railCollapsed ? ">" : "<"}
        </button>
        <BrandBlock />
        <section className="tier-panel">
          <ShinyText>{tierConfig.label}</ShinyText>
          <p>{tierConfig.audience}</p>
          <div className="quota-grid">
            <span>
              Proteins
              <strong>{tierConfig.maxProteins}</strong>
            </span>
            <span>
              Candidates
              <strong>{tierConfig.maxCandidates}</strong>
            </span>
            <span>
              Depth
              <strong>{tierConfig.depth.replaceAll("_", " ")}</strong>
            </span>
          </div>
        </section>
        <section className="need-panel">
          <span className="eyebrow">Your workspace includes</span>
          {tierConfig.needs.map((need) => (
            <div className="need-item" key={need}>
              <span />
              {need}
            </div>
          ))}
        </section>
        <button className="logout" type="button" onClick={logout}>
          Log out
        </button>
      </aside>

      <main className="user-main">
        <Header
          session={session}
          tier={tier}
          billingWarning={billingWarning}
          activeTab={workspaceTab}
          setActiveTab={setWorkspaceTab}
        />
        <LivePipelineConsole
          run={run}
          minimized={consoleMinimized}
          setMinimized={setConsoleMinimized}
          setWorkspaceTab={setWorkspaceTab}
        />
        {workspaceTab === "discovery" && (
          <>
            <Hero patient={patient} diagnosis={diagnosis} selectedProteins={selectedProteins} run={run} startPipeline={startPipeline} />
            <DiscoveryAgentBrief patient={patient} selectedProteins={selectedProteins} tier={tier} />
            <div className="workspace-grid">
              <section className="column-stack">
                <PatientIntake patient={patient} updatePatient={updatePatient} changeDiagnosis={changeDiagnosis} />
                <TierWorkspace tierFeatures={tierFeatures} tier={tier} />
              </section>
              <section className="column-stack wide">
                <DiagnosisProteinPicker
                  diagnosis={diagnosis}
                  patient={patient}
                  changeDiagnosis={changeDiagnosis}
                  proteins={filteredProteins}
                  diagnosisProteins={diagnosisProteins}
                  selectedProteinIds={selectedProteinIds}
                  toggleProtein={toggleProtein}
                  search={search}
                  setSearch={setSearch}
                  tierConfig={tierConfig}
                  autoSelectProteins={autoSelectProteins}
                />
              </section>
            </div>
          </>
        )}
        {workspaceTab === "copilot" && (
          <ResearchCopilot
            patient={patient}
            selectedProteins={selectedProteins}
            run={run}
            tier={tier}
            setWorkspaceTab={setWorkspaceTab}
          />
        )}
        {workspaceTab === "pipeline" && <PipelinePanel run={run} selectedProteins={selectedProteins} tier={tier} />}
        {workspaceTab === "molecules" && <CandidateResults run={run} customMolecules={customMolecules} onUpdateCandidate={updateWorkbenchCandidate} />}
        {workspaceTab === "chemistry" && (
          <ChemistryBench
            selectedProteins={selectedProteins}
            patient={patient}
            tier={tier}
            onAddMolecule={(candidate) => {
              setCustomMolecules((current) => [candidate, ...current]);
              setWorkspaceTab("molecules");
            }}
          />
        )}
        {workspaceTab === "tools" && (
          <ResearchTools
            patient={patient}
            selectedProteins={selectedProteins}
            run={run}
            customMolecules={customMolecules}
            startPipeline={startPipeline}
            setWorkspaceTab={setWorkspaceTab}
          />
        )}
        {workspaceTab === "account" && (
          <MyAccount session={session} tier={tier} billingWarning={billingWarning} tools={tools} logout={logout} />
        )}
      </main>
    </div>
  );
}

function LivePipelineConsole({ run, minimized, setMinimized, setWorkspaceTab }) {
  const events = run.events || [];
  if (!events.length && run.status === "idle") return null;
  const firstTimestamp = events[0]?.timestamp ? new Date(events[0].timestamp).getTime() : Date.now();
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - firstTimestamp) / 1000));
  const latest = events[events.length - 1];
  const statusText = run.status === "complete_with_warnings" ? "complete with warnings" : run.status;
  if (minimized) {
    return (
      <button className="live-console-bar" type="button" onClick={() => setMinimized(false)}>
        <strong>{latest?.module || "Pipeline"}</strong>
        <span>{latest?.message || "Run console"}</span>
        <em>{run.progress || 0}% | {elapsedSeconds}s</em>
      </button>
    );
  }
  return (
    <section className="live-console" aria-label="Live pipeline console">
      <div className="live-console-head">
        <div>
          <p className="eyebrow">Live pipeline console</p>
          <h3>{statusText}</h3>
          <small>{run.isolatedRun?.run_id ? `Run ${run.isolatedRun.run_id}` : "Local event stream"}</small>
        </div>
        <div className="live-console-actions">
          <button className="secondary-action" type="button" onClick={() => setWorkspaceTab("tools")}>
            Research Tools
          </button>
          <button className="secondary-action" type="button" onClick={() => setMinimized(true)}>
            Minimize
          </button>
        </div>
      </div>
      <FlowTrail progress={run.progress || 0} />
      <div className="live-console-meta">
        <Metric label="Progress" value={`${run.progress || 0}%`} />
        <Metric label="Elapsed" value={`${elapsedSeconds}s`} />
        <Metric label="Events" value={events.length} />
        <Metric label="Workspace" value={run.isolatedRun?.workspace_root ? "isolated" : "local"} />
      </div>
      <div className="live-event-list">
        {events.map((event, index) => (
          <article className={`live-event ${event.status}`} key={`${event.timestamp}-${index}`}>
            <span>{event.module}</span>
            <div>
              <strong>{event.event}</strong>
              <p>{event.message}</p>
              {event.artifacts?.length > 0 && (
                <small>{event.artifacts.map((artifact) => artifact.label || artifact.path).join(", ")}</small>
              )}
            </div>
            <em>{event.status}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function AuthPage({ authMode, setAuthMode, authForm, updateAuth, handleAuthSubmit, busyAuth, authError, continueDemo }) {
  return (
    <main className="auth-screen">
      <AuroraBackground />
      <section className="auth-hero">
        <BrandBlock />
        <Reveal>
          <p className="eyebrow">Patient-informed computational discovery</p>
          <SplitText as="h1" text="QuDrugForge by Quinfosys." />
          <p className="lead">
            Log in, select a tier, collect de-identified patient research context, choose AlphaFold proteins by diagnosis,
            and launch a computational candidate pipeline.
          </p>
        </Reveal>
      </section>
      <SpotlightCard className="auth-card" as="section">
        <div className="auth-tabs">
          <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>
            Login
          </button>
          <button className={authMode === "signup" ? "active" : ""} type="button" onClick={() => setAuthMode("signup")}>
            Create account
          </button>
        </div>
        <form onSubmit={handleAuthSubmit} className="auth-form">
          <label>
            Email
            <input value={authForm.email} onChange={(event) => updateAuth("email", event.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input value={authForm.password} onChange={(event) => updateAuth("password", event.target.value)} type="password" required />
          </label>
          {authMode === "signup" && (
            <>
              <label>
                Display name
                <input value={authForm.displayName} onChange={(event) => updateAuth("displayName", event.target.value)} />
              </label>
              <label>
                Organization
                <input value={authForm.organizationName} onChange={(event) => updateAuth("organizationName", event.target.value)} />
              </label>
            </>
          )}
          <TierSelector value={authForm.tier} onChange={(tier) => updateAuth("tier", tier)} />
          {authError && <div className="form-error">{authError}</div>}
          <MagnetButton className="primary" disabled={busyAuth}>
            {busyAuth ? "Connecting..." : authMode === "signup" ? "Create secure workspace" : "Log in"}
          </MagnetButton>
          <button className="demo-link" type="button" onClick={continueDemo}>
            Continue in tier demo mode
          </button>
        </form>
      </SpotlightCard>
    </main>
  );
}

function BrandBlock() {
  return (
    <div className="brand-block">
      <img src="/logo-quinfo.jpeg" alt="Quinfosys" />
      <div>
        <strong>QuDrugForge</strong>
        <span>by Quinfosys</span>
      </div>
    </div>
  );
}

function TierSelector({ value, onChange }) {
  return (
    <div className="tier-selector">
      <span className="eyebrow">Tier permissions</span>
      <div>
        {TIER_ORDER.map((tierId) => (
          <button className={value === tierId ? "selected" : ""} type="button" key={tierId} onClick={() => onChange(tierId)}>
            {TIERS[tierId].label}
          </button>
        ))}
      </div>
    </div>
  );
}

const WORKSPACE_TABS = [
  ["discovery", "Discovery"],
  ["copilot", "AI Copilot"],
  ["pipeline", "Pipeline"],
  ["molecules", "Molecules"],
  ["chemistry", "Chemistry Bench"],
  ["tools", "Research Tools"],
  ["account", "My Account"],
];

function Header({ session, tier, billingWarning, activeTab, setActiveTab }) {
  const tierConfig = TIERS[tier] || TIERS.student_free;
  return (
    <header className="user-header">
      <div>
        <p className="eyebrow">QuDrugForge research app</p>
        <h1>{tierConfig.label} workspace</h1>
      </div>
      <nav className="workspace-tabs" aria-label="Research workspace">
        {WORKSPACE_TABS.map(([id, label]) => (
          <button className={activeTab === id ? "active" : ""} type="button" key={id} onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {billingWarning && <small className="warn-text">{billingWarning}</small>}
    </header>
  );
}

function Hero({ patient, diagnosis, selectedProteins, run, startPipeline }) {
  return (
    <SpotlightCard className="hero-panel" as="section">
      <div>
        <p className="eyebrow">Diagnosis-led discovery pipeline</p>
        <h2>
          <SplitText text={`From ${diagnosis.short} biology to ranked candidates.`} />
        </h2>
        <p>
          Case <strong>{patient.caseId}</strong> uses {selectedProteins.length} selected AlphaFold targets. The pipeline
          collects genetics, protein context, constraints, and diagnosis metadata before computational ranking.
        </p>
        <div className="hero-actions">
          <MagnetButton className="primary" onClick={startPipeline} disabled={run.status === "running"}>
            {run.status === "running" ? "Pipeline running..." : "Initiate patient-informed pipeline"}
          </MagnetButton>
          <span className="research-only">Research only. Not medical advice.</span>
        </div>
      </div>
      <OrbitalTargetMap proteins={selectedProteins} />
    </SpotlightCard>
  );
}

function DiscoveryAgentBrief({ patient, selectedProteins, tier }) {
  const proteinText = selectedProteins.map((protein) => `${protein.gene} (${protein.alphafoldId})`).join(", ") || "No protein targets selected yet";
  const operatingMode = TIERS[tier]?.depth?.replaceAll("_", " ") || "research mode";
  const cards = [
    {
      title: "Inputs the agent understands",
      body: "Diagnosis, de-identified case metadata, genomic variants, protein expression, proteomics, prior therapy context, constraints, and AlphaFold receptor choices.",
    },
    {
      title: "Why each step exists",
      body: "Every pipeline frame explains its purpose, required inputs, output artifacts, trust checks, and limitations before candidates are ranked.",
    },
    {
      title: "What researchers can audit",
      body: "Target rationale, receptor provenance, docking grid, ADMET liabilities, QM/QML contribution, safety-panel hypotheses, and exportable evidence files.",
    },
    {
      title: "What the system refuses to claim",
      body: "It does not make diagnosis, treatment, efficacy, clinical safety, or regulatory claims. It generates computational hypotheses for research planning.",
    },
  ];
  return (
    <SpotlightCard className="agent-brief" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Drug discovery agent</p>
          <h2>Transparent reasoning before ranking</h2>
        </div>
        <ShinyText>{operatingMode}</ShinyText>
      </div>
      <div className="agent-context">
        <div>
          <strong>Case context</strong>
          <span>{patient.caseId} | {patient.stage}</span>
        </div>
        <div>
          <strong>Selected proteins</strong>
          <span>{proteinText}</span>
        </div>
        <div>
          <strong>Safety panel</strong>
          <span>{HUMAN_SAFETY_PANEL.length} human proteins and pathway liabilities are checked in the simulation bench.</span>
        </div>
      </div>
      <div className="agent-card-grid">
        {cards.map((card, index) => (
          <Reveal key={card.title} delay={index * 0.04}>
            <article>
              <strong>{card.title}</strong>
              <p>{card.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </SpotlightCard>
  );
}

function PatientIntake({ patient, updatePatient, changeDiagnosis }) {
  return (
    <SpotlightCard className="panel" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Patient research intake</h2>
        </div>
        <ShinyText>De-identified</ShinyText>
      </div>
      <div className="form-grid">
        <label>
          Case ID
          <input value={patient.caseId} onChange={(event) => updatePatient("caseId", event.target.value)} />
        </label>
        <label>
          Diagnosis
          <select value={patient.diagnosis} onChange={(event) => changeDiagnosis(event.target.value)}>
            {DIAGNOSES.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Disease stage or research cohort
          <input value={patient.stage} onChange={(event) => updatePatient("stage", event.target.value)} />
        </label>
        <label>
          Specimen
          <input value={patient.specimen} onChange={(event) => updatePatient("specimen", event.target.value)} />
        </label>
        <label className="span-two">
          Genetic variants
          <textarea value={patient.variants} onChange={(event) => updatePatient("variants", event.target.value)} />
        </label>
        <label className="span-two">
          Protein expression
          <textarea value={patient.expression} onChange={(event) => updatePatient("expression", event.target.value)} />
        </label>
        <label className="span-two">
          Proteomics or pathway signals
          <textarea value={patient.proteomics} onChange={(event) => updatePatient("proteomics", event.target.value)} />
        </label>
        <label className="span-two">
          Prior therapies and constraints
          <textarea value={patient.priorTherapies} onChange={(event) => updatePatient("priorTherapies", event.target.value)} />
        </label>
        <label className="span-two">
          Safety, chemistry, or delivery constraints
          <textarea value={patient.constraints} onChange={(event) => updatePatient("constraints", event.target.value)} />
        </label>
      </div>
      <div className="privacy-card">
        Do not enter direct identifiers. This workflow stores only the local UI state until you launch a backend project.
      </div>
    </SpotlightCard>
  );
}

function TierWorkspace({ tierFeatures, tier }) {
  return (
    <SpotlightCard className="panel" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Tier-specific needs</p>
          <h2>{TIERS[tier].label} controls</h2>
        </div>
      </div>
      <div className="feature-grid">
        {tierFeatures.map((feature) => (
          <div className="feature-card" key={feature.label}>
            <span>{feature.status}</span>
            <strong>{feature.label}</strong>
            <small>{feature.description}</small>
          </div>
        ))}
      </div>
    </SpotlightCard>
  );
}

function ChemistryBench({ selectedProteins, patient, tier, onAddMolecule }) {
  const [benchTab, setBenchTab] = useState("builder");
  const [elementQuery, setElementQuery] = useState("");
  const [selectedElements, setSelectedElements] = useState(["C", "N", "O", "F", "Cl"]);
  const [selectedStarters, setSelectedStarters] = useState(["quinazoline", "morpholine"]);
  const [customSmiles, setCustomSmiles] = useState("c1ccc2ncncc2c1N1CCOCC1");
  const [objective, setObjective] = useState("Kinase hinge binder with lower toxicity and balanced polarity");
  const [benchResult, setBenchResult] = useState(null);
  const [dockBusy, setDockBusy] = useState(false);
  const [dockError, setDockError] = useState("");
  const [dockStatus, setDockStatus] = useState("");
  const [dockEngine, setDockEngine] = useState("gnina");
  const [toolStatus, setToolStatus] = useState(null);
  const starters = [...ORGANIC_STARTERS, ...INORGANIC_STARTERS];
  const filteredElements = ELEMENTS.filter((symbol) => symbol.toLowerCase().includes(elementQuery.toLowerCase()));
  const selectedStarterObjects = starters.filter((starter) => selectedStarters.includes(starter.name));

  useEffect(() => {
    let cancelled = false;
    fetchDockingTools()
      .then((payload) => {
        if (cancelled) return;
        setToolStatus(payload);
        if (payload?.default_engine) setDockEngine(payload.default_engine);
      })
      .catch((error) => {
        if (!cancelled) setToolStatus({ error: error.message, tools: {} });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleElement(symbol) {
    setSelectedElements((current) => (current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol]));
  }

  function toggleStarter(name) {
    setSelectedStarters((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  function assembleFromStarters() {
    const assembled = selectedStarterObjects.map((starter) => starter.smiles).join(".");
    setCustomSmiles(assembled || customSmiles);
  }

  function testMolecule() {
    const result = testDesignedMolecule({
      smiles: customSmiles,
      selectedElements,
      starters: selectedStarterObjects,
      selectedProteins,
      patient,
      tier,
      objective,
    });
    setBenchResult(result);
  }

  async function addToWorkbench() {
    const result = benchResult || testDesignedMolecule({
      smiles: customSmiles,
      selectedElements,
      starters: selectedStarterObjects,
      selectedProteins,
      patient,
      tier,
      objective,
    });
    setDockBusy(true);
    setDockError("");
    setDockStatus("Generating RDKit conformer and pocket-aligned docking preview...");
    try {
      const preview = await dockPreviewMolecule({
        smiles: customSmiles,
        target: selectedProteins[0]?.gene || result.candidate.target || "CUSTOM",
        candidate_id: result.candidate.id,
        objective,
        selected_elements: selectedElements,
        starters: selectedStarterObjects.map((starter) => starter.name),
        tier,
        patient_context: {
          case_id: patient.caseId,
          diagnosis: patient.diagnosis,
          variants: patient.variants,
          constraints: patient.constraints,
        },
      });
      const enrichedCandidate = mergeDockingPreview(result.candidate, preview);
      setBenchResult({ ...result, candidate: enrichedCandidate, dockingPreview: preview });
      setDockStatus("Docking preview artifacts generated. Opening Molecule Workbench...");
      onAddMolecule(enrichedCandidate);
    } catch (error) {
      setDockError(error.message);
      setDockStatus("Docking preview failed. Fix the SMILES or try a simpler connected molecule.");
    } finally {
      setDockBusy(false);
    }
  }

  async function runRealDockingAndSend() {
    const result = benchResult || testDesignedMolecule({
      smiles: customSmiles,
      selectedElements,
      starters: selectedStarterObjects,
      selectedProteins,
      patient,
      tier,
      objective,
    });
    setDockBusy(true);
    setDockError("");
    setDockStatus(`Preparing ligand, receptor, and pocket box for ${dockEngine.toUpperCase()}...`);
    try {
      const preview = await dockPreviewMolecule({
        smiles: customSmiles,
        target: selectedProteins[0]?.gene || result.candidate.target || "CUSTOM",
        candidate_id: result.candidate.id,
        objective,
        selected_elements: selectedElements,
        starters: selectedStarterObjects.map((starter) => starter.name),
        tier,
        patient_context: {
          case_id: patient.caseId,
          diagnosis: patient.diagnosis,
          variants: patient.variants,
          constraints: patient.constraints,
        },
      });
      const previewCandidate = mergeDockingPreview(result.candidate, preview);
      setDockStatus(`Running ${dockEngine.toUpperCase()} docking against ${previewCandidate.target}...`);
      const docking = await runRealtimeDocking(buildRealtimeDockingPayload(previewCandidate, dockEngine));
      const enrichedCandidate = mergeRealtimeDocking(previewCandidate, docking);
      setBenchResult({ ...result, candidate: enrichedCandidate, dockingPreview: preview, realDocking: docking });
      setDockStatus(`${docking.engine.toUpperCase()} docking completed. Opening Molecule Workbench with real pose artifacts.`);
      onAddMolecule(enrichedCandidate);
    } catch (error) {
      setDockError(error.message);
      setDockStatus("Real docking failed. The preview path is still available for design iteration.");
    } finally {
      setDockBusy(false);
    }
  }

  async function runFullStackDockingAndSend() {
    const result = benchResult || testDesignedMolecule({
      smiles: customSmiles,
      selectedElements,
      starters: selectedStarterObjects,
      selectedProteins,
      patient,
      tier,
      objective,
    });
    setDockBusy(true);
    setDockError("");
    const engines = availableDockingEngines(toolStatus);
    setDockStatus(`Preparing ligand, receptor, and pocket box for ${engines.map((item) => item.toUpperCase()).join(", ")}...`);
    try {
      const preview = await dockPreviewMolecule({
        smiles: customSmiles,
        target: selectedProteins[0]?.gene || result.candidate.target || "CUSTOM",
        candidate_id: result.candidate.id,
        objective,
        selected_elements: selectedElements,
        starters: selectedStarterObjects.map((starter) => starter.name),
        tier,
        patient_context: {
          case_id: patient.caseId,
          diagnosis: patient.diagnosis,
          variants: patient.variants,
          constraints: patient.constraints,
        },
      });
      const previewCandidate = mergeDockingPreview(result.candidate, preview);
      const stack = await runDockingStackForCandidate(previewCandidate, {
        engines,
        context: {
          case_id: patient.caseId,
          diagnosis: patient.diagnosis,
          source: "chemistry_bench_full_stack",
        },
        onProgress: ({ engine: progressEngine, status }) => {
          setDockStatus(`${progressEngine.toUpperCase()} ${status}. Continuing docking stack...`);
        },
      });
      setBenchResult({ ...result, candidate: stack.candidate, dockingPreview: preview, realDocking: stack.results, dockingErrors: stack.errors });
      onAddMolecule(stack.candidate);
      const failedText = stack.errors.length ? ` ${stack.errors.length} engine(s) failed: ${stack.errors.map((item) => item.engine.toUpperCase()).join(", ")}.` : "";
      setDockStatus(`Full docking stack completed with ${stack.results.length} engine result(s).${failedText}`);
      if (stack.errors.length) setDockError(stack.errors.map((item) => `${item.engine.toUpperCase()}: ${item.message}`).join(" | "));
    } catch (error) {
      setDockError(error.message);
      setDockStatus("Full docking stack failed. The RDKit preview path remains available for design iteration.");
    } finally {
      setDockBusy(false);
    }
  }

  return (
    <SpotlightCard className="panel chemistry-bench" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Chemistry Bench</p>
          <h2>Design, reason, and test molecules</h2>
        </div>
        <ShinyText>{TIERS[tier].label}</ShinyText>
      </div>
      <div className="bench-tabs">
        {["builder", "starters", "rules", "test", "notebook"].map((tab) => (
          <button className={benchTab === tab ? "active" : ""} type="button" key={tab} onClick={() => setBenchTab(tab)}>
            {tab}
          </button>
        ))}
      </div>
      {benchTab === "builder" && (
        <div className="bench-grid">
          <section className="bench-card large">
            <label>
              Design objective
              <textarea value={objective} onChange={(event) => setObjective(event.target.value)} />
            </label>
            <label>
              Molecule design input
              <textarea value={customSmiles} onChange={(event) => setCustomSmiles(event.target.value)} />
            </label>
            <div className="bench-actions">
              <button className="secondary-action" type="button" onClick={assembleFromStarters}>Assemble starters</button>
              <button className="secondary-action" type="button" onClick={testMolecule}>Run in-silico test</button>
              <label className="inline-select">
                Engine
                <select value={dockEngine} onChange={(event) => setDockEngine(event.target.value)}>
                  <option value="gnina">GNINA CNN</option>
                  <option value="smina">Smina</option>
                  <option value="vina">AutoDock Vina</option>
                  <option value="auto">Auto</option>
                </select>
              </label>
              <button className="secondary-action" type="button" onClick={runRealDockingAndSend} disabled={dockBusy}>
                {dockBusy ? "Docking..." : "Run real docking"}
              </button>
              <button className="secondary-action" type="button" onClick={runFullStackDockingAndSend} disabled={dockBusy}>
                {dockBusy ? "Docking..." : "Run full stack"}
              </button>
              <MagnetButton className="primary" type="button" onClick={addToWorkbench} disabled={dockBusy}>
                {dockBusy ? "Preparing pose..." : "Dock preview and send"}
              </MagnetButton>
            </div>
            {toolStatus && (
              <div className="tool-health-grid">
                {["gnina", "smina", "vina", "obabel"].map((tool) => (
                  <Metric key={tool} label={tool.toUpperCase()} value={toolStatus.tools?.[tool]?.available ? "available" : "missing"} />
                ))}
              </div>
            )}
            {dockStatus && <div className="privacy-card">{dockStatus}</div>}
            {dockError && <div className="warning-box">{dockError}</div>}
          </section>
          <section className="bench-card">
            <strong>Selected chemistry</strong>
            <p>Elements: {selectedElements.join(", ") || "none"}</p>
            <p>Starters: {selectedStarters.join(", ") || "none"}</p>
            <p>Targets: {selectedProteins.map((protein) => protein.gene).join(", ") || "none"}</p>
          </section>
        </div>
      )}
      {benchTab === "starters" && (
        <div className="bench-grid">
          <section className="bench-card large">
            <label>
              Search periodic elements
              <input value={elementQuery} onChange={(event) => setElementQuery(event.target.value)} placeholder="C, N, Pt, B..." />
            </label>
            <div className="element-grid">
              {filteredElements.map((symbol) => (
                <button className={selectedElements.includes(symbol) ? "selected" : ""} type="button" key={symbol} onClick={() => toggleElement(symbol)}>
                  {symbol}
                </button>
              ))}
            </div>
          </section>
          <section className="bench-card large">
            <strong>Organic and inorganic starters</strong>
            <div className="starter-grid">
              {starters.map((starter) => (
                <button className={selectedStarters.includes(starter.name) ? "selected" : ""} type="button" key={starter.name} onClick={() => toggleStarter(starter.name)}>
                  <strong>{starter.name}</strong>
                  <span>{starter.type}</span>
                  <small>{starter.note}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {benchTab === "rules" && <ChemistryRules selectedElements={selectedElements} starters={selectedStarterObjects} />}
      {benchTab === "test" && <ChemistryTestResult result={benchResult} testMolecule={testMolecule} addToWorkbench={addToWorkbench} runRealDockingAndSend={runRealDockingAndSend} dockBusy={dockBusy} dockStatus={dockStatus} dockError={dockError} dockEngine={dockEngine} setDockEngine={setDockEngine} />}
      {benchTab === "notebook" && (
        <section className="bench-card">
          <h3>Research notebook</h3>
          <p>Use this bench for ideation and triage. Final designs still need chemist review, synthesis feasibility, retrosynthesis planning, assay validation, and safety testing.</p>
          <p>Current objective: {objective}</p>
          <p>Current molecule: {customSmiles}</p>
        </section>
      )}
    </SpotlightCard>
  );
}

function ChemistryRules({ selectedElements, starters }) {
  const warnings = [];
  if (selectedElements.some((element) => ["Pt", "Hg", "Cd", "Pb", "U"].includes(element))) warnings.push("Heavy-metal or organometallic concepts require special toxicity and handling review.");
  if (selectedElements.includes("B")) warnings.push("Boron motifs can be powerful but should be checked for covalent/reactive liability.");
  if (selectedElements.filter((element) => ["F", "Cl", "Br", "I"].includes(element)).length >= 3) warnings.push("High halogen loading can raise lipophilicity, metabolic, and off-target concerns.");
  if (starters.some((starter) => starter.name.includes("piperazine"))) warnings.push("Basic piperazine linkers may improve solubility but can increase CNS/CYP/off-target risk.");
  return (
    <section className="bench-card">
      <h3>Design guardrails</h3>
      <div className="rule-grid">
        <Metric label="Selected elements" value={selectedElements.length} />
        <Metric label="Starter fragments" value={starters.length} />
        <Metric label="Heavy atoms heuristic" value={selectedElements.includes("C") ? "organic-compatible" : "review"} />
        <Metric label="Research mode" value="hypothesis only" />
      </div>
      <div className="warning-list">
        {(warnings.length ? warnings : ["No major heuristic warnings from the selected element/starter set."]).map((warning) => (
          <span key={warning}>{warning}</span>
        ))}
      </div>
    </section>
  );
}

function ChemistryTestResult({ result, testMolecule, addToWorkbench, runRealDockingAndSend, dockBusy, dockStatus, dockError, dockEngine, setDockEngine }) {
  if (!result) {
    return (
      <section className="bench-card">
        <h3>No test run yet</h3>
        <p>Run an in-silico test to estimate target fit, ADMET pressure, safety liabilities, and workbench-ready candidate evidence.</p>
        <button className="secondary-action" type="button" onClick={testMolecule}>Run test now</button>
      </section>
    );
  }
  return (
    <section className="bench-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Designed molecule test</p>
          <h3>{result.candidate.id}</h3>
        </div>
        <button className="secondary-action" type="button" onClick={addToWorkbench} disabled={dockBusy}>
          {dockBusy ? "Preparing pose..." : "Dock preview and send"}
        </button>
      </div>
      <div className="analysis-grid">
        <Metric label="Composite" value={result.candidate.score.toFixed(3)} />
        <Metric label="ADMET estimate" value={result.candidate.admet.toFixed(3)} />
        <Metric label="Target fit" value={result.targetFit.toFixed(0)} />
        <Metric label="Safety pressure" value={result.safetyPressure.toFixed(0)} />
      </div>
      <div className="bench-actions">
        <label className="inline-select">
          Engine
          <select value={dockEngine} onChange={(event) => setDockEngine(event.target.value)}>
            <option value="gnina">GNINA CNN</option>
            <option value="smina">Smina</option>
            <option value="vina">AutoDock Vina</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <button className="secondary-action" type="button" onClick={runRealDockingAndSend} disabled={dockBusy}>
          {dockBusy ? "Docking..." : "Run real docking"}
        </button>
      </div>
      <div className="warning-list">
        {result.notes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
      {dockStatus && <div className="privacy-card">{dockStatus}</div>}
      {dockError && <div className="warning-box">{dockError}</div>}
    </section>
  );
}

function DiagnosisProteinPicker({
  diagnosis,
  patient,
  changeDiagnosis,
  proteins,
  diagnosisProteins,
  selectedProteinIds,
  toggleProtein,
  search,
  setSearch,
  tierConfig,
  autoSelectProteins,
}) {
  return (
    <SpotlightCard className="panel protein-panel" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2>AlphaFold repository by diagnosis</h2>
        </div>
        <button className="secondary-action" type="button" onClick={autoSelectProteins}>
          Auto-select from patient signals
        </button>
      </div>
      <div className="diagnosis-strip">
        {DIAGNOSES.map((item) => (
          <button className={item.id === diagnosis.id ? "active" : ""} type="button" key={item.id} onClick={() => changeDiagnosis(item.id)}>
            <strong>{item.short}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="repository-summary">
        <div>
          <ShinyText>{diagnosis.label}</ShinyText>
          <p>{diagnosis.biology}</p>
        </div>
        <div>
          <strong>{diagnosisProteins.length}</strong>
          proteins in diagnosis set
        </div>
        <div>
          <strong>{ALPHAFOLD_REPOSITORY.length}</strong>
          AlphaFold entries in local repo
        </div>
        <div>
          <strong>
            {selectedProteinIds.length}/{tierConfig.maxProteins}
          </strong>
          selected by tier
        </div>
      </div>
      <input
        className="protein-search"
        placeholder="Search gene, UniProt, AlphaFold ID, variant, or role"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="protein-grid">
        {proteins.map((protein, index) => (
          <TiltCard key={protein.id} selected={selectedProteinIds.includes(protein.id)} onClick={() => toggleProtein(protein)}>
            <span className="protein-rank">{String(index + 1).padStart(2, "0")}</span>
            <strong>{protein.gene}</strong>
            <small>{protein.family}</small>
            <p>{protein.role}</p>
            <div className="protein-meta">
              <span>{protein.alphafoldId}</span>
              <span>{protein.confidence}% pLDDT</span>
            </div>
            <div className="variant-row">
              {protein.variants.slice(0, 3).map((variant) => (
                <em key={variant}>{variant}</em>
              ))}
            </div>
            <span className="patient-fit">Fit {scoreProteinForPatient(protein, patient)}</span>
          </TiltCard>
        ))}
      </div>
    </SpotlightCard>
  );
}

function PipelinePanel({ run, selectedProteins, tier }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const liveFrame = run.activeStage >= 0 ? Math.min(run.activeStage, PIPELINE_STAGES.length - 1) : frameIndex;
  const frame = PIPELINE_STAGES[liveFrame] || PIPELINE_STAGES[0];

  useEffect(() => {
    if (run.status === "running") return undefined;
    const id = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % PIPELINE_STAGES.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [run.status]);

  return (
    <SpotlightCard className="panel" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2>Pipeline orchestration</h2>
        </div>
        <ShinyText>{run.status}</ShinyText>
      </div>
      <FlowTrail progress={run.progress} />
      <div className="process-theatre">
        <div className="frame-screen">
          <span className="frame-number">Frame {String(liveFrame + 1).padStart(2, "0")}</span>
          <h3>{frame.label}</h3>
          <p>{frame.detail}</p>
          <div className="frame-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="frame-explain">
          <ProcessList title="Why this matters" items={[frame.why]} />
          <ProcessList title="Inputs used" items={frame.inputs} />
          <ProcessList title="Outputs produced" items={frame.outputs} />
          <ProcessList title="Trust checks" items={frame.trustChecks} />
          <div className="limitation-card">
            <strong>Limitation</strong>
            <p>{frame.limitation}</p>
          </div>
        </div>
      </div>
      <div className="stage-grid">
        {PIPELINE_STAGES.map((stage, index) => (
          <button
            className={`stage-card ${index <= run.activeStage ? "active" : ""} ${index === liveFrame ? "focused" : ""}`}
            key={stage.id}
            type="button"
            onClick={() => setFrameIndex(index)}
          >
            <span>{index + 1}</span>
            <strong>{stage.label}</strong>
            <small>{stage.detail}</small>
          </button>
        ))}
      </div>
      <div className="run-footer">
        <div>
          <strong>{selectedProteins.map((protein) => protein.gene).join(", ") || "No proteins selected"}</strong>
          <span>Tier depth: {TIERS[tier].depth.replaceAll("_", " ")}</span>
        </div>
        {run.project && <span>Backend project: {run.project.id}</span>}
        {run.backendJob && <span>Backend job: {run.backendJob.status}</span>}
      </div>
      {run.proteinEvidence && (
        <div className="protein-evidence-strip">
          <Metric label="Protein AI targets" value={run.proteinEvidence.summary?.target_count || 0} />
          <Metric label="Sequences resolved" value={run.proteinEvidence.summary?.sequence_count || 0} />
          <Metric label="ESM embeddings" value={run.proteinEvidence.summary?.esm_generated_count || 0} />
          <Metric label="Evidence boundary" value="Target context only" />
        </div>
      )}
      {run.dataFabric && (
        <div className="protein-evidence-strip">
          <Metric label="Realtime targets" value={run.dataFabric.summary?.target_count || 0} />
          <Metric label="Ligand datapoints" value={run.dataFabric.summary?.ligand_count || 0} />
          <Metric label="ChEMBL activities" value={run.dataFabric.summary?.chembl_activity_datapoints || 0} />
          <Metric label="PubChem hits" value={run.dataFabric.summary?.pubchem_property_hits || 0} />
        </div>
      )}
      {run.warning && <div className="warning-box">{run.warning}</div>}
      <div className="log-box">
        {run.logs.length ? run.logs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>Pipeline logs will appear here after launch.</p>}
      </div>
    </SpotlightCard>
  );
}

function ProcessList({ title, items }) {
  return (
    <div className="process-list">
      <strong>{title}</strong>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function CandidateResults({ run, customMolecules = [], onUpdateCandidate = () => {} }) {
  const [selectedId, setSelectedId] = useState(null);
  const [sortBy, setSortBy] = useState("rerank");
  const [targetFilter, setTargetFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [realOnly, setRealOnly] = useState(false);
  const [tab, setTab] = useState("structure");
  const [weights, setWeights] = useState({
    activity: 25,
    docking: 25,
    admet: 20,
    quantum: 20,
    md: 10,
  });

  const availableCandidates = [...customMolecules, ...run.candidates];

  if (run.status !== "complete" && !availableCandidates.length) {
    return (
      <SpotlightCard className="panel empty-results" as="section">
        <p className="eyebrow">Step 4</p>
        <h2>Top candidates will appear here</h2>
        <p>Launch the pipeline or design a molecule in Chemistry Bench to produce a ranked computational candidate set.</p>
      </SpotlightCard>
    );
  }

  const targets = unique(availableCandidates.map((candidate) => candidate.target));
  const candidates = availableCandidates
    .map((candidate) => ({ ...candidate, rerankScore: weightedCandidateScore(candidate, weights) }))
    .filter((candidate) => targetFilter === "all" || candidate.target === targetFilter)
    .filter((candidate) => candidate.rerankScore >= Number(minScore))
    .filter((candidate) => !realOnly || candidate.realEvidence)
    .sort((a, b) => sortCandidates(a, b, sortBy));
  const selected = candidates.find((candidate) => candidate.id === selectedId) || candidates[0] || availableCandidates[0];

  return (
    <SpotlightCard className="panel molecule-workbench" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Step 4</p>
          <h2>Molecule workbench</h2>
        </div>
        <ShinyText>{candidates.length} visible of {availableCandidates.length}</ShinyText>
      </div>
      <CandidateControls
        sortBy={sortBy}
        setSortBy={setSortBy}
        targetFilter={targetFilter}
        setTargetFilter={setTargetFilter}
        targets={targets}
        minScore={minScore}
        setMinScore={setMinScore}
        realOnly={realOnly}
        setRealOnly={setRealOnly}
        weights={weights}
        setWeights={setWeights}
      />
      <div className="workbench-grid">
        <div className="candidate-list">
          {candidates.map((candidate, index) => (
            <Reveal key={candidate.id} delay={index * 0.025}>
              <button
                className={`candidate-card candidate-button ${selected?.id === candidate.id ? "selected" : ""}`}
                type="button"
                onClick={() => {
                  setSelectedId(candidate.id);
                  setTab("structure");
                }}
              >
                <div className="candidate-top">
                  <span>#{index + 1}</span>
                  <strong>{candidate.id}</strong>
                  <small>{candidate.target}</small>
                </div>
                <div className="score-stack">
                  <span>
                    User rerank
                    <strong>{candidate.rerankScore.toFixed(3)}</strong>
                  </span>
                  <span>
                    Docking
                    <strong>{candidate.affinity}</strong>
                  </span>
                  <span>
                    Quantum
                    <strong>{candidate.quantumDelta}</strong>
                  </span>
                </div>
                <p>{candidate.rationale}</p>
                <div className="candidate-tags">
                  {candidate.tags.map((tag) => (
                    <em key={tag}>{tag}</em>
                  ))}
                </div>
              </button>
            </Reveal>
          ))}
          {!candidates.length && <div className="empty-filter">No candidates match the current controls.</div>}
        </div>
        <CandidateDetail candidate={selected} tab={tab} setTab={setTab} onUpdateCandidate={onUpdateCandidate} />
      </div>
      <div className="research-only wide-note">
        Candidate cards are computational hypotheses for research planning. Synthesis, assay validation, safety review, and clinical/regulatory review are required.
      </div>
    </SpotlightCard>
  );
}

function ResearchCopilot({ patient, selectedProteins, run, tier, setWorkspaceTab }) {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState(() => readCopilotHistory() || [
    {
      role: "assistant",
      content:
        "I can help navigate the app, explain why each discovery step exists, plan validation work, and prepare research-only candidate evidence. Ask me what to do next, or paste a protein sequence for ESM2 analysis.",
    },
  ]);
  const [input, setInput] = useState("Explain the next best step for this case and which tab I should open.");
  const [busy, setBusy] = useState(false);
  const [proteinName, setProteinName] = useState(selectedProteins[0]?.gene || "");
  const [proteinSequence, setProteinSequence] = useState("");
  const [esmResult, setEsmResult] = useState(null);
  const [esmError, setEsmError] = useState("");
  const [esmBusy, setEsmBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([assistantStatus(), aiModelStatus()])
      .then((results) => {
        if (cancelled) return;
        const assistantPayload = results[0].status === "fulfilled" ? results[0].value : {};
        const modelPayload = results[1].status === "fulfilled" ? results[1].value : {};
        const providerError = [results[0], results[1]]
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason.message)
          .join(" ");
        setStatus({ ...modelPayload, ...assistantPayload, provider_error: assistantPayload.provider_error || modelPayload.provider_error || providerError || "" });
      })
      .catch((error) => {
        if (!cancelled) setStatus({ configured: false, provider_error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!proteinName && selectedProteins[0]?.gene) setProteinName(selectedProteins[0].gene);
  }, [proteinName, selectedProteins]);

  useEffect(() => {
    writeCopilotHistory(messages);
  }, [messages]);

  async function sendMessage(prompt = input) {
    const content = prompt.trim();
    if (!content || busy) return;
    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    try {
      const payload = await assistantChat({
        page: "copilot",
        app_state: buildCopilotState({ patient, selectedProteins, run, tier }),
        messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
        max_tokens: 4096,
        temperature: 0.35,
        top_p: 0.9,
      });
      setStatus(payload);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: payload.answer || "The Copilot returned an empty answer. Try a more specific research question.",
          provider: payload.provider,
        },
      ]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `Copilot request failed: ${error.message}. The rest of the app is still available; use Pipeline, Molecules, Chemistry Bench, or Research Tools directly.`,
          provider: "frontend-error",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function submitMessage(event) {
    event.preventDefault();
    sendMessage();
  }

  async function runEsm2Analysis() {
    if (!proteinSequence.trim()) {
      setEsmError("Paste a FASTA sequence or raw amino-acid sequence before running ESM2.");
      return;
    }
    setEsmBusy(true);
    setEsmError("");
    setEsmResult(null);
    try {
      const payload = await analyzeProteinWithEsm2({
        sequence: proteinSequence,
        protein_name: proteinName || selectedProteins[0]?.gene || "research-protein",
        question: "Summarize sequence context for drug discovery target triage.",
        output_format: "npz",
        return_embedding_b64: false,
      });
      setStatus(payload);
      setEsmResult(payload);
    } catch (error) {
      setEsmError(error.message);
    } finally {
      setEsmBusy(false);
    }
  }

  const quickPrompts = [
    "Explain why these proteins matter for this diagnosis and what could be wrong.",
    "Guide me to the best candidate docking evidence and export path.",
    "Build a validation plan for the top molecule before wet-lab work.",
    "When should I use ESM2 versus docking or quantum scoring?",
  ];

  return (
    <SpotlightCard className="panel copilot-panel" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Google Gemma + NVIDIA ESM/DiffusionGemma</p>
          <h2>Research Copilot</h2>
        </div>
        <div className={`model-status ${status?.chat_configured ? "configured" : "missing"}`}>
          <span />
          {status?.chat_configured ? "Google chat ready" : "Google key not set"}
        </div>
      </div>
      <div className="copilot-layout">
        <section className="chat-console">
          <div className="copilot-context">
            <Metric label="Tier" value={TIERS[tier]?.label || tier} />
            <Metric label="Selected proteins" value={selectedProteins.length} />
            <Metric label="Pipeline" value={run.status} />
            <Metric label="Candidates" value={run.candidates?.length || 0} />
          </div>
          <div className="quick-grid">
            {quickPrompts.map((prompt) => (
              <button className="secondary-action" type="button" key={prompt} onClick={() => sendMessage(prompt)} disabled={busy}>
                {prompt}
              </button>
            ))}
          </div>
          <div className="nav-grid">
            {["discovery", "pipeline", "molecules", "chemistry", "tools"].map((tab) => (
              <button className="tool-toggle" type="button" key={tab} onClick={() => setWorkspaceTab(tab)}>
                Open {tab.replaceAll("_", " ")}
              </button>
            ))}
            <button
              className="tool-toggle"
              type="button"
              onClick={() => {
                const cleared = [
                  {
                    role: "assistant",
                    content: "Chat history cleared. I am ready to help with discovery planning, docking evidence, Chemistry Bench design, exports, and validation strategy.",
                  },
                ];
                setMessages(cleared);
                writeCopilotHistory(cleared);
              }}
            >
              Clear chat history
            </button>
          </div>
          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                <strong>{message.role === "user" ? "You" : "QuDrugForge Copilot"}</strong>
                <ChatMessageContent content={message.content} />
                {message.provider && <small>{message.provider}</small>}
              </article>
            ))}
          </div>
          <form className="chat-input" onSubmit={submitMessage}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about the pipeline, candidates, validation, exports, or app navigation..." />
            <MagnetButton className="primary" disabled={busy}>
              {busy ? "Thinking..." : "Ask Copilot"}
            </MagnetButton>
          </form>
        </section>
        <aside className="protein-ai-panel">
          <div className="model-card">
            <span className="eyebrow">Backend secret boundary</span>
            <p>
              Copilot chat, ESM protein embeddings, DiffusionGemma visual QA, and optional MedGemma adapters run behind the API so provider keys never enter browser code.
            </p>
            <div className="provider-status-grid">
              <Metric label="Chat" value={status?.chat_configured ? status.chat_model || "Google ready" : "Set Google key"} />
              <Metric label="Protein AI" value={status?.esm2_configured ? status.esm2_model || "NVIDIA ESM2" : "Set NVIDIA key"} />
              <Metric label="Visual QA" value={status?.diffusiongemma_configured ? status.diffusiongemma_model || "DiffusionGemma" : "Set DGEMMA_API_KEY"} />
              <Metric label="MedGemma" value={status?.medgemma_configured ? status.medgemma_model || "MedGemma" : "Optional private endpoint"} />
            </div>
            {status?.provider_error && <small className="warn-text">{status.provider_error}</small>}
          </div>
          <label>
            Protein label
            <input value={proteinName} onChange={(event) => setProteinName(event.target.value)} placeholder="EGFR, KRAS, PARP1..." />
          </label>
          <label>
            FASTA or amino-acid sequence
            <textarea
              className="sequence-input"
              value={proteinSequence}
              onChange={(event) => setProteinSequence(event.target.value)}
              placeholder="Paste a UniProt/AlphaFold sequence here. ESM2-650M accepts up to 1024 residues per call."
            />
          </label>
          <div className="tool-actions">
            <button className="secondary-action" type="button" onClick={runEsm2Analysis} disabled={esmBusy}>
              {esmBusy ? "Running ESM2..." : "Analyze with ESM2"}
            </button>
            <button className="secondary-action" type="button" onClick={() => setProteinSequence("")} disabled={!proteinSequence}>
              Clear sequence
            </button>
          </div>
          {esmError && <div className="warning-box">{esmError}</div>}
          {esmResult && (
            <div className="esm-result">
              <h3>{esmResult.protein_name || "Protein"} sequence context</h3>
              <p>{esmResult.answer}</p>
              <div className="metric-mosaic">
                <Metric label="Length" value={esmResult.sequence?.length || "NA"} />
                <Metric label="Hydrophobic" value={fmtMaybe(esmResult.sequence?.hydrophobic_fraction, 3)} />
                <Metric label="Charged" value={fmtMaybe(esmResult.sequence?.charged_fraction, 3)} />
              </div>
              {esmResult.embedding ? (
                <p>
                  Embedding artifact: {esmResult.embedding.byte_length} bytes as {esmResult.embedding.format}. Use it for
                  retrieval, clustering, mutation triage, or target-family comparison.
                </p>
              ) : (
                <p>Embedding was not generated because NVIDIA ESM2 is not configured or the provider call failed.</p>
              )}
              {esmResult.sequence?.warnings?.map((warning) => (
                <small className="warn-text" key={warning}>{warning}</small>
              ))}
            </div>
          )}
        </aside>
      </div>
      <div className="research-only wide-note">
        Copilot outputs are research support only. Do not treat them as clinical guidance, toxicity proof, regulatory advice, or a substitute for experimental validation.
      </div>
    </SpotlightCard>
  );
}

function ChatMessageContent({ content }) {
  const blocks = String(content || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <div className="chat-message-content">
      {blocks.map((block, blockIndex) => {
        if (/^#{1,4}\s+/.test(block)) {
          return <h4 key={`${block}-${blockIndex}`}>{renderInlineMarkdown(block.replace(/^#{1,4}\s+/, ""))}</h4>;
        }
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        if (lines.every((line) => /^[-*]\s+/.test(line))) {
          return (
            <ul key={`${block}-${blockIndex}`}>
              {lines.map((line) => (
                <li key={line}>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((line) => /^\d+\.\s+/.test(line))) {
          return (
            <ol key={`${block}-${blockIndex}`}>
              {lines.map((line) => (
                <li key={line}>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        return <p key={`${block}-${blockIndex}`}>{renderInlineMarkdown(block)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function ResearchTools({ patient, selectedProteins, run, customMolecules, startPipeline, setWorkspaceTab }) {
  const [activeTool, setActiveTool] = useState(RESEARCH_TOOLKIT[0].id);
  const [notes, setNotes] = useState("Record assumptions, evidence gaps, and next wet-lab experiments here.");
  const [registry, setRegistry] = useState(null);
  const [registryError, setRegistryError] = useState("");
  const [fabricStatus, setFabricStatus] = useState(null);
  const [fabricError, setFabricError] = useState("");
  const tool = RESEARCH_TOOLKIT.find((item) => item.id === activeTool) || RESEARCH_TOOLKIT[0];
  const toolPayload = buildResearchToolPayload(tool.id, { patient, selectedProteins, run, customMolecules, notes, registry, fabricStatus });

  useEffect(() => {
    let cancelled = false;
    fetchResourceRegistry()
      .then((payload) => {
        if (!cancelled) setRegistry(payload);
      })
      .catch((error) => {
        if (!cancelled) setRegistryError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDataFabricStatus()
      .then((payload) => {
        if (!cancelled) setFabricStatus(payload);
      })
      .catch((error) => {
        if (!cancelled) setFabricError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SpotlightCard className="panel research-tools" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Research helper suite</p>
          <h2>Tools for proper discovery work</h2>
        </div>
        <button className="secondary-action" type="button" onClick={startPipeline}>Run pipeline</button>
      </div>
      <div className="tools-layout">
        <div className="tool-menu">
          {RESEARCH_TOOLKIT.map((item) => (
            <button className={activeTool === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setActiveTool(item.id)}>
              <strong>{item.name}</strong>
              <span>{item.purpose}</span>
            </button>
          ))}
        </div>
        <div className="tool-detail">
          <h3>{tool.name}</h3>
          <p>{tool.purpose}</p>
          <ToolPayloadView payload={toolPayload} />
          <div className="tool-actions">
            <button className="secondary-action" type="button" onClick={() => setWorkspaceTab("chemistry")}>Open Chemistry Bench</button>
            <button className="secondary-action" type="button" onClick={() => setWorkspaceTab("molecules")}>Open Molecule Workbench</button>
            <button className="secondary-action" type="button" onClick={() => downloadText(`${tool.id}_research_payload.json`, JSON.stringify(toolPayload, null, 2), "application/json")}>
              Export tool payload
            </button>
          </div>
          <label>
            ELN notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
      </div>
      <section className="workflow-map">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Benchmark-style in-silico process</p>
            <h3>Evidence modules QuDrugForge should track</h3>
          </div>
          <ShinyText>{INSILICO_MODULES.length} modules</ShinyText>
        </div>
        <div className="workflow-module-grid">
          {INSILICO_MODULES.map((module, index) => (
            <article key={module.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{module.name}</strong>
              <p>{module.purpose}</p>
              <small>{module.evidence}</small>
            </article>
          ))}
        </div>
      </section>
      <DataFabricPanel run={run} status={fabricStatus} error={fabricError} />
      <ResourceStrategyPanel registry={registry} error={registryError} />
      <AssetLibraryPanel />
    </SpotlightCard>
  );
}

function DataFabricPanel({ run, status, error }) {
  const summary = run.dataFabric?.summary || {};
  const connectors = status?.connectors || {};
  return (
    <section className="resource-strategy-panel" aria-labelledby="data-fabric-heading">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Realtime evidence fabric</p>
          <h3 id="data-fabric-heading">Live public-data and model hooks</h3>
        </div>
        <ShinyText>{summary.chembl_activity_datapoints || 0} activities</ShinyText>
      </div>
      <div className="resource-summary-grid">
        <Metric label="Targets enriched" value={summary.target_count || 0} />
        <Metric label="Ligands enriched" value={summary.ligand_count || 0} />
        <Metric label="PubChem hits" value={summary.pubchem_property_hits || 0} />
        <Metric label="RDKit descriptors" value={summary.rdkit_descriptor_hits || 0} />
      </div>
      <div className="resource-grid">
        {["chembl", "pubchem", "uniprot", "open_targets"].map((key) => (
          <article key={key} className="resource-card present">
            <span>{connectors[key]?.status || "configured"}</span>
            <strong>{key.replace("_", " ").toUpperCase()}</strong>
            <p>{connectors[key]?.base_url || "Connector ready after backend restart."}</p>
          </article>
        ))}
      </div>
      {status?.ai_models && (
        <div className="resource-summary-grid">
          <Metric label="ESM" value={status.ai_models.esm2_configured ? status.ai_models.esm2_model : "not configured"} />
          <Metric label="DiffusionGemma" value={status.ai_models.diffusiongemma_configured ? "configured" : "not configured"} />
          <Metric label="MedGemma" value={status.ai_models.medgemma_configured ? "configured" : "optional"} />
          <Metric label="Cache TTL" value={status.ttl_seconds ? `${Math.round(status.ttl_seconds / 3600)} h` : "NA"} />
        </div>
      )}
      {error && <div className="warning-box">{error}</div>}
      <div className="research-only wide-note">
        Realtime datapoints support prioritization, auditability, model applicability, and SAR planning. They do not prove binding, efficacy, safety, or clinical utility.
      </div>
    </section>
  );
}

function ResourceStrategyPanel({ registry, error }) {
  const resources = registry?.resources || [];
  const gaps = registry?.gaps || [];
  const p0Resources = resources.filter((resource) => String(resource.priority).startsWith("P0"));
  const p1Resources = resources.filter((resource) => String(resource.priority).startsWith("P1"));
  return (
    <section className="resource-strategy-panel" aria-labelledby="resource-registry-heading">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Persistent research source stack</p>
          <h3 id="resource-registry-heading">Databases, models, quantum layers, and gaps</h3>
        </div>
        <ShinyText>{registry ? `${registry.summary.local_count}/${registry.summary.resource_count} local` : "Loading registry"}</ShinyText>
      </div>
      {error && <div className="warning-box">{error}</div>}
      <div className="asset-summary-grid">
        <Metric label="Core resources" value={registry?.summary?.p0_count ?? "NA"} />
        <Metric label="Edge resources" value={registry?.summary?.p1_count ?? "NA"} />
        <Metric label="Local/present" value={registry?.summary?.local_count ?? "NA"} />
        <Metric label="Connectors" value={registry?.summary?.connector_count ?? "NA"} />
      </div>
      <div className="source-stack-columns">
        <ResourceColumn title="Must always work" resources={p0Resources} />
        <ResourceColumn title="Cutting-edge expansion" resources={p1Resources} />
      </div>
      <div className="gap-grid">
        {gaps.map((gap) => (
          <article className="gap-card" key={`${gap.priority}-${gap.area}`}>
            <span>{gap.priority}</span>
            <strong>{gap.area}</strong>
            <p>{gap.current}</p>
            <small>{gap.needed}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResourceColumn({ title, resources }) {
  return (
    <div className="resource-column">
      <div className="asset-section-head">
        <strong>{title}</strong>
        <span>{resources.length} governed sources</span>
      </div>
      {resources.map((resource) => (
        <article className="resource-card" key={resource.id}>
          <div>
            <strong>{resource.name}</strong>
            <span>{resource.category}</span>
          </div>
          <span className={`resource-status ${resource.local_status === "present" ? "present" : "connector"}`}>
            {resource.local_status === "present" ? "local" : "connector"}
          </span>
          <p>{resource.value}</p>
          <small>{resource.next_action}</small>
          <a href={resource.source_url} target="_blank" rel="noreferrer">Source</a>
        </article>
      ))}
    </div>
  );
}

function AssetLibraryPanel() {
  return (
    <section className="asset-library-panel" aria-labelledby="asset-library-heading">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Downloaded research assets</p>
          <h3 id="asset-library-heading">AlphaFold receptors and ChEMBL ligands</h3>
        </div>
        <ShinyText>{PHARMA_ASSET_LIBRARY.receptors.length + PHARMA_ASSET_LIBRARY.ligands.length} curated entries</ShinyText>
      </div>
      <div className="asset-summary-grid">
        <Metric label="AlphaFold receptors" value={PHARMA_ASSET_LIBRARY.receptors.length} />
        <Metric label="Receptor files" value={PHARMA_ASSET_LIBRARY.receptors.length * 3} />
        <Metric label="ChEMBL ligands" value={PHARMA_ASSET_LIBRARY.ligands.length} />
        <Metric label="Ligand files" value={PHARMA_ASSET_LIBRARY.ligands.length * 3} />
      </div>
      <div className="asset-library-grid">
        <div className="asset-table-wrap">
          <div className="asset-section-head">
            <strong>Receptor panel</strong>
            <span>mmCIF, PAE, and metadata for structure-prep triage</span>
          </div>
          <div className="asset-table" role="table" aria-label="Downloaded AlphaFold receptors">
            {PHARMA_ASSET_LIBRARY.receptors.map((asset) => (
              <div className="asset-row" role="row" key={asset.alphafoldId}>
                <div>
                  <strong>{asset.gene}</strong>
                  <span>{asset.role}</span>
                </div>
                <span>{asset.program}</span>
                <div className="asset-links">
                  <a href={asset.cif} target="_blank" rel="noreferrer">mmCIF</a>
                  <a href={asset.pae} target="_blank" rel="noreferrer">PAE</a>
                  <a href={asset.metadata} target="_blank" rel="noreferrer">Metadata</a>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ligand-gallery">
          <div className="asset-section-head">
            <strong>Ligand and comparator panel</strong>
            <span>SDF files plus ChEMBL-rendered structure images</span>
          </div>
          <div className="ligand-grid">
            {PHARMA_ASSET_LIBRARY.ligands.map((ligand) => (
              <article className="ligand-card" key={ligand.chemblId}>
                <img src={ligand.image} alt={`${ligand.name} 2D structure`} loading="lazy" />
                <div>
                  <strong>{ligand.name}</strong>
                  <span>{ligand.target}</span>
                  <p>{ligand.purpose}</p>
                </div>
                <div className="asset-links">
                  <a href={ligand.sdf} target="_blank" rel="noreferrer">SDF</a>
                  <a href={ligand.image} target="_blank" rel="noreferrer">SVG</a>
                  <a href={ligand.search} target="_blank" rel="noreferrer">ChEMBL JSON</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div className="source-notice-grid">
        {PHARMA_ASSET_LIBRARY.sourceNotices.map((notice) => (
          <span key={notice}>{notice}</span>
        ))}
      </div>
    </section>
  );
}

function ToolPayloadView({ payload }) {
  return (
    <div className="tool-payload">
      {Object.entries(payload).map(([key, value]) => (
        <div key={key}>
          <strong>{key.replaceAll("_", " ")}</strong>
          <span>{Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value ?? "NA")}</span>
        </div>
      ))}
    </div>
  );
}

function MyAccount({ session, tier, billingWarning, tools, logout }) {
  const tierConfig = TIERS[tier] || TIERS.student_free;
  return (
    <SpotlightCard className="panel account-panel" as="section">
      <div className="panel-head">
        <div>
          <p className="eyebrow">My Account</p>
          <h2>{session.email}</h2>
        </div>
        <button className="secondary-action" type="button" onClick={logout}>Log out</button>
      </div>
      <div className="account-grid">
        <Metric label="Mode" value={session.demo ? "Demo mode" : "Authenticated"} />
        <Metric label="Role" value={session.role || "researcher"} />
        <Metric label="Tier" value={tierConfig.label} />
        <Metric label="Credits" value={session.billing?.credit_balance != null ? Number(session.billing.credit_balance).toFixed(1) : "NA"} />
        <Metric label="Monthly limit" value={session.billing?.monthly_credit_limit != null ? Number(session.billing.monthly_credit_limit).toFixed(1) : "NA"} />
        <Metric label="Backend modules" value={tools?.module_count || "Not loaded"} />
      </div>
      {billingWarning && <div className="warning-box">{billingWarning}</div>}
      <div className="procedure-card">
        <h4>Data handling</h4>
        <p>Keep direct patient identifiers out of this research workspace. Use de-identified case IDs and export only research-appropriate dossiers.</p>
      </div>
      <div className="procedure-card">
        <h4>Tier capabilities</h4>
        {tierConfig.needs.map((need) => (
          <p key={need}>{need}</p>
        ))}
      </div>
    </SpotlightCard>
  );
}

function CandidateControls({
  sortBy,
  setSortBy,
  targetFilter,
  setTargetFilter,
  targets,
  minScore,
  setMinScore,
  realOnly,
  setRealOnly,
  weights,
  setWeights,
}) {
  function updateWeight(key, value) {
    setWeights((current) => ({ ...current, [key]: Number(value) }));
  }

  return (
    <div className="candidate-controls">
      <label>
        Sort
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="rerank">User rerank score</option>
          <option value="original">Original platform score</option>
          <option value="docking">Docking affinity</option>
          <option value="admet">ADMET score</option>
          <option value="quantum">Quantum score</option>
          <option value="target">Target then score</option>
        </select>
      </label>
      <label>
        Target
        <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)}>
          <option value="all">All selected targets</option>
          {targets.map((target) => (
            <option value={target} key={target}>
              {target}
            </option>
          ))}
        </select>
      </label>
      <label>
        Minimum rerank score: {Number(minScore).toFixed(2)}
        <input min="0" max="1" step="0.01" type="range" value={minScore} onChange={(event) => setMinScore(event.target.value)} />
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={realOnly} onChange={(event) => setRealOnly(event.target.checked)} />
        Real docking/structure evidence only
      </label>
      <div className="weight-panel">
        {Object.entries(weights).map(([key, value]) => (
          <label key={key}>
            {key} {value}%
            <input min="0" max="60" step="5" type="range" value={value} onChange={(event) => updateWeight(key, event.target.value)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function CandidateDetail({ candidate, tab, setTab, onUpdateCandidate }) {
  if (!candidate) {
    return (
      <div className="candidate-detail">
        <h3>No molecule selected</h3>
      </div>
    );
  }
  const tabs = ["structure", "docking", "procedure", "quantum", "admet", "simulation", "export", "artifacts"];
  return (
    <article className="candidate-detail">
      <div className="detail-head">
        <div>
          <p className="eyebrow">{candidate.target} molecule evidence</p>
          <h3>{candidate.id}</h3>
          <small>{displayCandidateSmiles(candidate)}</small>
        </div>
        <span className="evidence-pill">
          {candidate.raw?.evidence_kind === "reference_ligand"
            ? "Reference ligand"
            : candidate.realEvidence
              ? "Real evidence"
              : candidate.raw?.evidence_kind === "generated_starter"
                ? hasCandidateStructureArtifact(candidate)
                  ? "Generated structure"
                  : "Generated starter"
                : "Preview"}
        </span>
      </div>
      <div className="detail-tabs">
        {tabs.map((item) => (
          <button className={tab === item ? "active" : ""} type="button" key={item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {tab === "structure" && <StructureTab candidate={candidate} onUpdateCandidate={onUpdateCandidate} />}
      {tab === "docking" && <DockingTab candidate={candidate} onUpdateCandidate={onUpdateCandidate} />}
      {tab === "procedure" && <ProcedureTab candidate={candidate} />}
      {tab === "quantum" && <QuantumTab candidate={candidate} />}
      {tab === "admet" && <AdmetTab candidate={candidate} />}
      {tab === "simulation" && <SimulationTab candidate={candidate} />}
      {tab === "export" && <ExportTab candidate={candidate} />}
      {tab === "artifacts" && <ArtifactsTab candidate={candidate} />}
    </article>
  );
}

function StructureTab({ candidate, onUpdateCandidate = () => {} }) {
  const [viewMode, setViewMode] = useState("3d");
  const poseSources = visiblePoseSources(candidate.raw?.pose_sources || []);
  const [poseSourceId, setPoseSourceId] = useState(defaultPoseSourceId(candidate.raw, poseSources));
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [viewerOptions, setViewerOptions] = useState({
    receptor: true,
    surface: true,
    cartoon: true,
    spheres: false,
  });

  useEffect(() => {
    const nextPoseSources = visiblePoseSources(candidate.raw?.pose_sources || []);
    setPoseSourceId(defaultPoseSourceId(candidate.raw, nextPoseSources));
  }, [candidate.id]);

  function toggleOption(key) {
    setViewerOptions((current) => ({ ...current, [key]: !current[key] }));
  }

  async function generateStructurePreview() {
    if (previewBusy) return;
    const smiles = candidateSeedSmiles(candidate);
    if (!smiles) {
      setPreviewError("No valid SMILES is available for this candidate. Add or generate a molecule first.");
      return;
    }
    setPreviewBusy(true);
    setPreviewError("");
    setPreviewMessage(`Generating RDKit/MMFF preview for ${candidate.id}...`);
    try {
      const preview = await dockPreviewMolecule({
        smiles,
        target: candidate.target,
        candidate_id: candidate.id,
        objective: candidate.rationale || "Generate missing structure artifact for ranked candidate.",
        patient_context: { source: "molecule_workbench_structure_tab" },
      });
      const updatedCandidate = mergeDockingPreview({ ...candidate, smiles }, preview);
      onUpdateCandidate(updatedCandidate);
      setPoseSourceId(updatedCandidate.raw?.default_pose_source || "preview");
      setPreviewMessage("Structure preview generated and attached to this candidate.");
    } catch (error) {
      setPreviewError(error.message);
      setPreviewMessage("");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <div className="detail-body">
      <div className="viewer-toolbar">
        <div className="segmented-control">
          <button className={viewMode === "3d" ? "active" : ""} type="button" onClick={() => setViewMode("3d")}>
            3D pose
          </button>
          <button className={viewMode === "2d" ? "active" : ""} type="button" onClick={() => setViewMode("2d")}>
            2D structure
          </button>
        </div>
        <select value={poseSourceId} onChange={(event) => setPoseSourceId(event.target.value)}>
          {poseSources.length ? (
            poseSources.map((source) => (
              <option value={source.id} key={source.id}>
                {source.label}
              </option>
            ))
          ) : (
            <option value="conformer">Generated conformer</option>
          )}
        </select>
        {["receptor", "surface", "cartoon", "spheres"].map((key) => (
          <button className={viewerOptions[key] ? "active tool-toggle" : "tool-toggle"} type="button" key={key} onClick={() => toggleOption(key)}>
            {key}
          </button>
        ))}
      </div>
      {candidateNeedsStructurePreview(candidate) && (
        <div className="procedure-card structure-action-card">
          <div>
            <h4>Structure artifact missing</h4>
            <p>
              This candidate has a design seed but no SDF/pose artifact yet. Generate a real RDKit/MMFF conformer before
              inspecting 3D geometry or launching docking.
            </p>
          </div>
          <button className="secondary-action" type="button" onClick={generateStructurePreview} disabled={previewBusy}>
            {previewBusy ? "Generating..." : "Generate structure preview"}
          </button>
          {previewMessage && <small>{previewMessage}</small>}
          {previewError && <div className="warning-box">{previewError}</div>}
        </div>
      )}
      <div className="structure-layout">
        {viewMode === "3d" ? (
          <Molecule3DViewer candidate={candidate} poseSourceId={poseSourceId} options={viewerOptions} />
        ) : (
          <div className="molecule-frame">
            {candidate.structureImage ? (
              <img src={apiUrl(candidate.structureImage)} alt={`${candidate.id} 2D structure`} />
            ) : (
              <div className="molecule-placeholder">
                <span>{candidate.target}</span>
                <strong>2D structure preview unavailable</strong>
              </div>
            )}
          </div>
        )}
        <div className="metric-mosaic">
          <Metric label="Structure mode" value={candidate.raw?.structure_mode || "RDKit/MMFF preview"} />
          <Metric label="Molecular weight" value={fmtMaybe(candidate.raw?.MW, 1)} />
          <Metric label="LogP" value={fmtMaybe(candidate.raw?.LogP, 2)} />
          <Metric label="TPSA" value={fmtMaybe(candidate.raw?.TPSA, 1)} />
          <Metric label="QED" value={fmtMaybe(candidate.raw?.QED, 3)} />
          <Metric label="Lipinski violations" value={fmtMaybe(candidate.raw?.lipinski_violations, 0)} />
        </div>
      </div>
      <div className="smiles-box">
        <strong>SMILES</strong>
        <code>{displayCandidateSmiles(candidate)}</code>
      </div>
    </div>
  );
}

const LIGAND_CARBON_SCHEMES = [
  "whiteCarbon",
];

const RECEPTOR_SURFACE_COLORS = ["#007ACC", "#005A99", "#003A61", "#001E33", "#737373"];

function colorFromKey(key, palette) {
  const text = String(key || "default");
  const hash = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function visiblePoseSources(poseSources) {
  const sources = Array.isArray(poseSources) ? poseSources : [];
  const evidenceSources = sources.filter((source) => {
    const id = String(source?.id || "").toLowerCase();
    const tier = String(source?.method_tier || "").toUpperCase();
    return id !== "conformer" && tier !== "PROXY";
  });
  return evidenceSources.length ? evidenceSources : sources;
}

function defaultPoseSourceId(raw = {}, poseSources = []) {
  if (poseSources.some((source) => source.id === raw?.default_pose_source)) return raw.default_pose_source;
  return poseSources[0]?.id || raw?.default_pose_source || "conformer";
}

function poseUsesReceptorContext(source) {
  const id = String(source?.id || "").toLowerCase();
  return ["docked", "gnina", "vina", "smina", "preview"].includes(id);
}

function receptorUrlForPose(source, raw) {
  const id = String(source?.id || "").toLowerCase();
  if (source?.receptor_url) return source.receptor_url;
  if (id === "gnina") return raw.gnina_receptor_url || raw.receptor_url || null;
  if (id === "vina") return raw.vina_receptor_url || raw.receptor_url || null;
  if (id === "smina") return raw.smina_receptor_url || raw.receptor_url || null;
  if (id === "docked" || id === "preview") return raw.receptor_url || null;
  return null;
}

function Molecule3DViewer({ candidate, poseSourceId, options }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [status, setStatus] = useState("Loading 3D viewer...");
  const [visionBusy, setVisionBusy] = useState(false);
  const [visionResult, setVisionResult] = useState(null);
  const [visionError, setVisionError] = useState("");
  const raw = candidate.raw || {};
  const poseSources = visiblePoseSources(raw.pose_sources || []);
  const source =
    poseSources.find((item) => item.id === poseSourceId) ||
    poseSources.find((item) => item.id === raw.default_pose_source) ||
    poseSources[0] ||
    (raw.docked_sdf_url
      ? { id: "docked", label: "Vina/Smina docked pose", url: raw.docked_sdf_url, receptor_url: raw.receptor_url }
      : null) ||
    { id: "conformer", label: "Generated conformer", url: raw.sdf_url };
  const receptorUrl = receptorUrlForPose(source, raw);
  const ligandUrl = source?.url || raw.docked_sdf_url || raw.sdf_url;

  useEffect(() => {
    setVisionResult(null);
    setVisionError("");
  }, [candidate.id, poseSourceId]);

  useEffect(() => {
    let cancelled = false;
    async function renderViewer() {
      if (!viewerRef.current) return;
      if (!window.$3Dmol) {
        setStatus("3Dmol.js is still loading or unavailable. The 2D structure and artifacts remain available.");
        return;
      }
      if (!ligandUrl) {
        setStatus("No ligand pose file is available for this candidate.");
        return;
      }
      setStatus(`Loading ${source?.label || "pose"}...`);
      try {
        const ligandRequest = fetch(apiUrl(ligandUrl)).then((response) => {
          if (!response.ok) throw new Error(`Ligand pose returned ${response.status}`);
          return response.text();
        });
        const receptorRequest = options.receptor && receptorUrl
          ? fetch(apiUrl(receptorUrl)).then((response) => (response.ok ? response.text() : ""))
          : Promise.resolve("");
        const [ligandText, receptorText] = await Promise.all([ligandRequest, receptorRequest]);
        if (cancelled) return;
        const rootStyles = getComputedStyle(document.documentElement);
        const paletteBg = rootStyles.getPropertyValue("--bg").trim() || "#050505";
        const receptorSurfaceColor = colorFromKey(`${candidate.target}-${source?.id || "pose"}`, RECEPTOR_SURFACE_COLORS);
        const ligandCarbonScheme = colorFromKey(`${candidate.id}-${source?.id || "pose"}`, LIGAND_CARBON_SCHEMES);
        const viewer = viewerInstanceRef.current || window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: paletteBg });
        viewerInstanceRef.current = viewer;
        if (viewer.setBackgroundColor) viewer.setBackgroundColor(paletteBg);
        viewer.clear();
        if (receptorText) {
          viewer.addModel(receptorText, "pdb");
          if (options.cartoon) {
            viewer.setStyle({ model: 0 }, { cartoon: { color: "spectrum" } });
          } else {
            viewer.setStyle({ model: 0 }, { line: { colorscheme: "Jmol", linewidth: 1.2 } });
          }
          if (options.surface) {
            viewer.addSurface(window.$3Dmol.SurfaceType.VDW, { opacity: 0.18, color: receptorSurfaceColor }, { model: 0 });
          }
        }
        viewer.addModel(ligandText, "sdf");
        const ligandModel = receptorText ? 1 : 0;
        const ligandStyle = options.spheres
          ? { sphere: { scale: 0.33, colorscheme: ligandCarbonScheme }, stick: { radius: 0.16, colorscheme: ligandCarbonScheme } }
          : { stick: { radius: 0.25, colorscheme: ligandCarbonScheme } };
        viewer.setStyle({ model: ligandModel }, ligandStyle);
        viewer.zoomTo();
        viewer.render();
        if (receptorText) {
          setStatus(`${source?.label || "Pose"} loaded with matching receptor context.`);
        } else if (poseUsesReceptorContext(source)) {
          setStatus(`${source?.label || "Pose"} loaded as ligand-only because the matching prepared receptor was unavailable or hidden.`);
        } else {
          setStatus(`${source?.label || "Conformer"} loaded as ligand-only; receptor overlay is disabled for non-docked coordinates.`);
        }
      } catch (error) {
        setStatus(error.message);
      }
    }
    renderViewer();
    return () => {
      cancelled = true;
    };
  }, [candidate.id, ligandUrl, receptorUrl, source?.label, options.receptor, options.surface, options.cartoon, options.spheres]);

  async function runVisualReview() {
    if (visionBusy) return;
    setVisionBusy(true);
    setVisionError("");
    try {
      const viewer = viewerInstanceRef.current;
      const imageUrl = typeof viewer?.pngURI === "function" ? viewer.pngURI() : null;
      const payload = await reviewDockingVision({
        candidate_id: candidate.id,
        target: candidate.target,
        pose_source: source?.label || source?.id || poseSourceId,
        receptor_url: receptorUrl,
        ligand_url: ligandUrl,
        image_url: imageUrl,
        notes: "Screenshot from the current 3Dmol viewer state. Review visible placement and artifact provenance only.",
      });
      setVisionResult(payload);
    } catch (error) {
      setVisionError(error.message);
    } finally {
      setVisionBusy(false);
    }
  }

  return (
    <div className="viewer3d-shell">
      <div className="viewer3d-actions">
        <button className="secondary-action" type="button" onClick={runVisualReview} disabled={visionBusy || !ligandUrl}>
          {visionBusy ? "Reviewing..." : "AI visual QA"}
        </button>
      </div>
      <div className="viewer3d" ref={viewerRef} />
      {(visionResult || visionError) && (
        <div className="viewer3d-review">
          <strong>{visionResult?.provider || "Visual QA"}</strong>
          {visionError ? <p>{visionError}</p> : <p>{visionResult.answer}</p>}
          {visionResult?.claim_boundary && <small>{visionResult.claim_boundary}</small>}
        </div>
      )}
      <div className="viewer3d-status">{status}</div>
    </div>
  );
}

function DockingTab({ candidate, onUpdateCandidate = () => {} }) {
  const raw = candidate.raw || {};
  const [engine, setEngine] = useState(raw.gnina_pose_sdf_url ? "gnina" : "gnina");
  const [dockBusy, setDockBusy] = useState(false);
  const [dockMessage, setDockMessage] = useState("");
  const [dockError, setDockError] = useState("");
  const [toolStatus, setToolStatus] = useState(null);
  const hasGninaPose = Boolean(raw.gnina_pose_sdf_url);
  const hasFullStack = Boolean(raw.gnina_pose_sdf_url && (raw.vina_docked_sdf_url || raw.vina_pose_pdbqt_url) && (raw.smina_docked_sdf_url || raw.smina_pose_pdbqt_url));

  useEffect(() => {
    let cancelled = false;
    fetchDockingTools()
      .then((payload) => {
        if (!cancelled) setToolStatus(payload);
      })
      .catch((error) => {
        if (!cancelled) setToolStatus({ error: error.message, tools: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [candidate.id]);

  async function runCandidateDocking() {
    if (dockBusy) return;
    setDockBusy(true);
    setDockError("");
    setDockMessage(`Running ${engine.toUpperCase()} for ${candidate.id}...`);
    try {
      const prepared = candidateNeedsStructurePreview(candidate)
        ? mergeDockingPreview({ ...candidate, smiles: candidateSeedSmiles(candidate) }, await dockPreviewMolecule({
            smiles: candidateSeedSmiles(candidate),
            target: candidate.target,
            candidate_id: candidate.id,
            objective: candidate.rationale || "Prepare ligand for real docking.",
            patient_context: { source: "docking_tab_single_engine" },
          }))
        : candidate;
      const payload = await runRealtimeDocking(buildRealtimeDockingPayload(prepared, engine));
      const updatedCandidate = mergeRealtimeDocking(prepared, payload);
      onUpdateCandidate(updatedCandidate);
      setDockMessage(`${payload.engine.toUpperCase()} ${payload.status}. Pose artifacts are attached to this candidate.`);
    } catch (error) {
      setDockError(error.message);
      setDockMessage("Docking did not complete. Check tool availability, receptor, ligand, and pocket box.");
    } finally {
      setDockBusy(false);
    }
  }

  async function runFullStackDocking() {
    if (dockBusy) return;
    setDockBusy(true);
    setDockError("");
    const engines = availableDockingEngines(toolStatus);
    setDockMessage(`Running docking stack: ${engines.map((item) => item.toUpperCase()).join(", ")}...`);
    try {
      const result = await runDockingStackForCandidate(candidate, {
        engines,
        onProgress: ({ engine: progressEngine, status }) => {
          setDockMessage(`${progressEngine.toUpperCase()} ${status}. Continuing full docking stack...`);
        },
      });
      onUpdateCandidate(result.candidate);
      const failedText = result.errors.length ? ` ${result.errors.length} engine(s) failed: ${result.errors.map((item) => item.engine.toUpperCase()).join(", ")}.` : "";
      setDockMessage(`Docking stack complete with ${result.results.length} pose-producing engine result(s).${failedText}`);
      if (result.errors.length) setDockError(result.errors.map((item) => `${item.engine.toUpperCase()}: ${item.message}`).join(" | "));
    } catch (error) {
      setDockError(error.message);
      setDockMessage("Full docking stack did not complete. Check tool availability, receptor, ligand, and pocket box.");
    } finally {
      setDockBusy(false);
    }
  }

  return (
    <div className="detail-body">
      <div className="procedure-card docking-action-card">
        <div>
          <h4>{hasFullStack ? "Full docking stack is available" : hasGninaPose ? "GNINA CNN pose is available" : "Docked poses missing"}</h4>
          <p>
            Run a per-molecule docking job against the current receptor and pocket box. GNINA CNN, AutoDock Vina,
            and Smina are kept as separate selectable pose sources when installed.
          </p>
        </div>
        <div className="dock-action-controls">
          <label>
            Engine
            <select value={engine} onChange={(event) => setEngine(event.target.value)}>
              <option value="gnina">GNINA CNN</option>
              <option value="smina">Smina</option>
              <option value="vina">AutoDock Vina</option>
              <option value="auto">Auto</option>
            </select>
          </label>
          <button className="secondary-action" type="button" onClick={runCandidateDocking} disabled={dockBusy}>
            {dockBusy ? "Docking..." : `Run ${engine.toUpperCase()}`}
          </button>
          <button className="secondary-action" type="button" onClick={runFullStackDocking} disabled={dockBusy}>
            {dockBusy ? "Docking..." : "Run GNINA + Vina + Smina"}
          </button>
        </div>
        {toolStatus && (
          <div className="tool-health-grid">
            {["gnina", "vina", "smina", "obabel"].map((tool) => (
              <Metric key={tool} label={tool.toUpperCase()} value={toolStatus.tools?.[tool]?.available ? "available" : "missing"} />
            ))}
          </div>
        )}
        {dockMessage && <small>{dockMessage}</small>}
        {dockError && <div className="warning-box">{dockError}</div>}
      </div>
      <div className="metric-mosaic">
        <Metric label="Binding class" value={raw.binding_class || "review"} />
        <Metric label="Vina affinity" value={formatAffinity(raw.vina_affinity_kcal_mol ?? raw.affinity_kcal_mol)} />
        <Metric label="Smina affinity" value={formatAffinity(raw.smina_affinity_kcal_mol)} />
        <Metric label="GNINA affinity" value={formatAffinity(raw.gnina_affinity_kcal_mol)} />
        <Metric label="GNINA CNN pose" value={fmtMaybe(raw.gnina_cnn_pose_score, 3)} />
        <Metric label="GNINA status" value={raw.gnina_status || "not run"} />
        <Metric label="Vina status" value={raw.vina_status || (raw.vina_pose_pdbqt_url ? "completed" : "not run")} />
        <Metric label="Smina status" value={raw.smina_status || (raw.smina_pose_pdbqt_url ? "completed" : "not run")} />
        <Metric label="Protein AI" value={formatProteinAiMetric(raw.protein_ai_evidence)} />
        <Metric label="Realtime data" value={formatDataFabricMetric(raw.realtime_data_fabric?.target, raw.realtime_data_fabric?.ligand)} />
        <Metric label="Runtime" value={raw.docking_runtime_s ? `${fmtMaybe(raw.docking_runtime_s, 2)} s` : "NA"} />
      </div>
      <div className="procedure-card">
        <h4>Docking setup</h4>
        <p>{raw.docking_note || candidate.rationale}</p>
        <div className="coordinate-grid">
          <Metric label="Pocket source" value={raw.pocket_source || "Not specified"} />
          <Metric label="PDB anchor" value={raw.pocket_pdb_id || "NA"} />
          <Metric label="Reference ligand" value={raw.reference_ligand || "NA"} />
          <Metric label="Box center" value={formatVector(raw.box_center || raw)} />
          <Metric label="Box size" value={formatBox(raw.box_size || raw)} />
          <Metric label="Pose method" value={raw.pose_method_tier || raw.pocket_method_tier || "NA"} />
        </div>
      </div>
      {raw.gnina_output_excerpt && (
        <pre className="gnina-log">{String(raw.gnina_output_excerpt).slice(0, 1800)}</pre>
      )}
      {raw.protein_ai_evidence && (
        <div className="procedure-card">
          <h4>ESM target-context evidence</h4>
          <p>{raw.protein_ai_evidence.pipeline_use}</p>
          <p>
            Sequence source {raw.protein_ai_evidence.sequence_source || "NA"}; ESM status {raw.protein_ai_evidence.esm?.status || "not run"}.
          </p>
        </div>
      )}
      {(raw.realtime_data_fabric?.target || raw.realtime_data_fabric?.ligand) && (
        <div className="procedure-card">
          <h4>Realtime public-data evidence</h4>
          <p>{raw.realtime_data_fabric?.target?.pipeline_use || raw.realtime_data_fabric?.ligand?.pipeline_use}</p>
          <p>
            ChEMBL activities {raw.realtime_data_fabric?.target?.chembl?.activity_summary?.activity_count || 0}; PubChem identity{" "}
            {raw.realtime_data_fabric?.ligand?.pubchem?.properties ? "resolved" : "not resolved"}.
          </p>
        </div>
      )}
    </div>
  );
}

function ProcedureTab({ candidate }) {
  const raw = candidate.raw || {};
  const steps = [
    ["1", "Target and pocket selection", raw.protein_ai_evidence?.pipeline_use || raw.pocket_provenance_note || "Select target receptor and binding-site hypothesis."],
    ["2", "Ligand preparation", `Generate SDF/PDBQT and normalize candidate source: ${raw.generation_method || "candidate generation"}.`],
    ["3", "Grid definition", `Center ${formatVector(raw.box_center || raw)} with box ${formatBox(raw.box_size || raw)}.`],
    ["4", "Vina global docking", `Affinity ${formatAffinity(raw.vina_affinity_kcal_mol ?? raw.affinity_kcal_mol)} with ${raw.docking_num_modes || 3} modes.`],
    ["5", "Smina/GNINA review", `Smina mode ${raw.smina_mode || "NA"}; GNINA status ${raw.gnina_status || "not run"}.`],
    ["6", "ADMET and toxicity gates", `ADMET score ${fmtMaybe(raw.admet_score, 3)}, toxicity risk ${fmtMaybe(raw.toxicity_risk_proxy, 3)}.`],
    ["7", "QM/QML reranking", `${raw.qm_mode || "QM optional"}; ${raw.qml_mode || "QML optional"}.`],
    ["8", "Dossier handoff", "Export computational evidence for expert wet-lab planning, not treatment decisions."],
  ];
  return (
    <div className="detail-body">
      <div className="procedure-timeline">
        {steps.map(([number, title, text]) => (
          <div className="procedure-step" key={title}>
            <span>{number}</span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuantumTab({ candidate }) {
  const raw = candidate.raw || {};
  return (
    <div className="detail-body">
      <div className="metric-mosaic">
        <Metric label="Prefilter score" value={fmtMaybe(raw.quantum_prefilter_score, 3)} />
        <Metric label="Quantum score" value={fmtMaybe(raw.quantum_score, 3)} />
        <Metric label="QML score" value={fmtMaybe(raw.qml_score, 3)} />
        <Metric label="Ablation delta" value={fmtMaybe(raw.quantum_ablation_delta, 3)} />
        <Metric label="HOMO" value={raw.homo_ev ? `${fmtMaybe(raw.homo_ev, 3)} eV` : "NA"} />
        <Metric label="LUMO" value={raw.lumo_ev ? `${fmtMaybe(raw.lumo_ev, 3)} eV` : "NA"} />
        <Metric label="Gap" value={raw.homo_lumo_gap_ev ? `${fmtMaybe(raw.homo_lumo_gap_ev, 3)} eV` : "NA"} />
        <Metric label="Dipole" value={raw.dipole_debye ? `${fmtMaybe(raw.dipole_debye, 2)} D` : "NA"} />
      </div>
      <div className="procedure-card">
        <h4>Quantum notes</h4>
        <p>{raw.quantum_prefilter_note || "Quantum features are shown when backend evidence exists for the candidate."}</p>
        <p>{raw.qm_note || "xTB/QM evidence not available for this candidate."}</p>
      </div>
    </div>
  );
}

function AdmetTab({ candidate }) {
  const raw = candidate.raw || {};
  return (
    <div className="detail-body">
      <div className="metric-mosaic">
        <Metric label="ADMET score" value={fmtMaybe(raw.admet_score, 3)} />
        <Metric label="FDA approval proxy" value={fmtMaybe(raw.fda_approval_probability, 3)} />
        <Metric label="Tox21 toxicity" value={fmtMaybe(raw.tox21_toxicity_probability, 3)} />
        <Metric label="ClinTox toxicity" value={fmtMaybe(raw.clintox_toxicity_probability, 3)} />
        <Metric label="PAINS" value={raw.pains_alert ? "Alert" : raw.pains_description || "Clean"} />
        <Metric label="Brenk" value={raw.brenk_alert ? "Alert" : raw.brenk_description || "Clean"} />
        <Metric label="Veber" value={raw.veber_pass === false ? "Fail" : "Pass/NA"} />
        <Metric label="Descriptor" value={raw.descriptor_pass === false ? "Fail" : "Pass/NA"} />
      </div>
      <div className="procedure-card">
        <h4>Model note</h4>
        <p>{raw.admet_model_note || "ADMET model metadata unavailable."}</p>
      </div>
    </div>
  );
}

function SimulationTab({ candidate }) {
  const simulation = simulateHumanProteinPanel(candidate);
  return (
    <div className="detail-body">
      <div className="simulation-hero">
        <div>
          <p className="eyebrow">Human protein simulation bench</p>
          <h4>{simulation.summary}</h4>
          <p>
            This panel counter-screens the molecule against common human liability proteins and pathways using the available
            ADMET, toxicity, descriptor, and docking evidence. Treat this as hypothesis triage, not biological proof.
          </p>
        </div>
        <div className={`risk-dial ${simulation.overallTone}`}>
          <strong>{simulation.overallRisk}</strong>
          <span>overall computational liability</span>
        </div>
      </div>
      <div className="simulation-grid">
        {simulation.rows.map((row) => (
          <article className={`simulation-card ${row.tone}`} key={row.gene}>
            <div>
              <strong>{row.gene}</strong>
              <span>{row.name}</span>
            </div>
            <p>{row.concern}</p>
            <div className="risk-bar">
              <span style={{ "--risk-width": `${row.risk}%` }} />
            </div>
            <small>{row.rationale}</small>
          </article>
        ))}
      </div>
      <div className="procedure-card">
        <h4>Suggested validation assays</h4>
        {simulation.assays.map((assay) => (
          <p key={assay}>{assay}</p>
        ))}
      </div>
    </div>
  );
}

function ExportTab({ candidate }) {
  const simulation = simulateHumanProteinPanel(candidate);
  return (
    <div className="detail-body">
      <div className="procedure-card">
        <h4>Flexible export bench</h4>
        <p>
          Export the same candidate as raw JSON, tabular CSV, a scientific memo, an assay handoff plan, or a safety simulation matrix.
          Each export includes research-use limitations so downstream analysis does not detach scores from caveats.
        </p>
      </div>
      <div className="export-grid">
        {EXPORT_PRESETS.map((preset) => (
          <button className="export-card" key={preset.id} type="button" onClick={() => exportCandidate(candidate, simulation, preset.id)}>
            <strong>{preset.label}</strong>
            <span>{preset.description}</span>
            <em>.{preset.extension}</em>
          </button>
        ))}
      </div>
      <div className="analysis-grid">
        <Metric label="Best use" value="Research triage and wet-lab planning" />
        <Metric label="Contains limitations" value="Yes" />
        <Metric label="Safety rows" value={simulation.rows.length} />
        <Metric label="Artifact links" value={candidate.raw ? "Included where available" : "Synthetic preview"} />
      </div>
    </div>
  );
}

function ArtifactsTab({ candidate }) {
  const links = [
    ["2D PNG", candidate.structureImage],
    ["Ligand SDF", candidate.raw?.sdf_url],
    ["SMILES", candidate.raw?.smi_url],
    ["Docked SDF", candidate.raw?.docked_sdf_url],
    ["Vina docked SDF", candidate.raw?.vina_docked_sdf_url],
    ["Smina docked SDF", candidate.raw?.smina_docked_sdf_url],
    ["Vina PDBQT", candidate.raw?.vina_pose_pdbqt_url],
    ["Smina PDBQT", candidate.raw?.smina_pose_pdbqt_url],
    ["GNINA pose", candidate.raw?.gnina_pose_sdf_url],
    ["GNINA log", candidate.raw?.gnina_log_url],
    ["Vina log", candidate.raw?.vina_log_url],
    ["Smina log", candidate.raw?.smina_log_url],
    ["Receptor PDBQT", candidate.raw?.receptor_pdbqt_url],
    ["ESM embedding", candidate.raw?.esm_embedding_url],
  ].filter(([, url]) => url);
  return (
    <div className="detail-body">
      <div className="artifact-link-grid">
        {links.map(([label, url]) => (
          <a href={apiUrl(url)} target="_blank" rel="noreferrer" key={label}>
            <strong>{label}</strong>
            <span>{String(url).split("/").pop()}</span>
          </a>
        ))}
        {!links.length && <p>No downloadable artifacts are available for this synthetic preview candidate.</p>}
      </div>
      {candidate.raw?.pose_sources?.length > 0 && (
        <div className="procedure-card">
          <h4>Pose sources</h4>
          {candidate.raw.pose_sources.map((source) => (
            <p key={source.id}>
              <strong>{source.label}</strong> - {source.method_tier || "NA"} - {source.format || "file"}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <span className="detail-metric">
      {label}
      <strong>{value ?? "NA"}</strong>
    </span>
  );
}

function buildTierFeatures(tier, tools) {
  const tierIndex = TIER_ORDER.indexOf(tier);
  const features = [
    ["Patient intake", "Enabled", "Collect diagnosis, variants, expression, proteins, constraints, and notes."],
    ["AlphaFold repository", "Enabled", "Diagnosis-specific protein selection with UniProt and AlphaFold IDs."],
    ["Docking preview", tierIndex >= 1 ? "Enabled" : "Limited", "Tier controls docking depth and candidate volume."],
    ["Quantum rerank", tierIndex >= 2 ? "Enabled" : "Preview", "Qiskit/xTB evidence layer where the tier supports compute depth."],
    ["Wet-lab handoff", tierIndex >= 5 ? "Enabled" : "Locked", "Assay triage and report workflow for higher tiers."],
    ["Governance", tierIndex >= 7 ? "Enterprise" : "Standard", "SSO/RBAC/private deployment controls at enterprise tiers."],
  ];
  if (tools?.module_count) {
    features.push(["Backend modules", `${tools.module_count} found`, "Live module registry connected from /v1/tools."]);
  }
  return features.map(([label, status, description]) => ({ label, status, description }));
}

function scoreProteinForPatient(protein, patient) {
  const text = `${patient.variants} ${patient.expression} ${patient.proteomics} ${patient.constraints}`.toLowerCase();
  let score = protein.confidence;
  if (text.includes(protein.gene.toLowerCase())) score += 18;
  for (const variant of protein.variants) {
    if (text.includes(variant.toLowerCase())) score += 9;
  }
  if (protein.role.toLowerCase().includes("driver")) score += 6;
  if (protein.role.toLowerCase().includes("repair") && text.includes("brca")) score += 8;
  return Math.min(100, Math.round(score));
}

function rankCandidates(rawCandidates, selectedProteins, patient, limit, proteinEvidence = null, dataFabric = null) {
  const selectedGenes = selectedProteins.map((protein) => protein.gene.toUpperCase());
  const fromBackend = rawCandidates
    .filter((candidate) => selectedGenes.includes(String(candidate.target_id || "").toUpperCase()))
    .map((candidate) => normalizeBackendCandidate(candidate, proteinEvidence, dataFabric));
  const coveredGenes = new Set(fromBackend.map((candidate) => String(candidate.target || "").toUpperCase()));
  const missingProteins = selectedProteins.filter((protein) => !coveredGenes.has(protein.gene.toUpperCase()));
  const pool = fromBackend.length
    ? [...fromBackend, ...synthesizeCandidates(missingProteins, patient, proteinEvidence, dataFabric)]
    : synthesizeCandidates(selectedProteins, patient, proteinEvidence, dataFabric);
  return balancedCandidateSlice(pool, selectedGenes, limit);
}

async function hydrateStructurePreviews(candidates, patient, selectedProteins, tier) {
  const hydrated = [];
  const errors = [];
  let completed = 0;
  for (const candidate of candidates) {
    if (!candidateNeedsStructurePreview(candidate)) {
      hydrated.push(candidate);
      continue;
    }
    const smiles = candidateSeedSmiles(candidate);
    if (!smiles) {
      hydrated.push(candidate);
      continue;
    }
    try {
      const protein = selectedProteins.find((item) => item.gene === candidate.target);
      const preview = await dockPreviewMolecule({
        smiles,
        target: candidate.target,
        candidate_id: candidate.id,
        objective: candidate.rationale || "Generate missing molecule structure artifact for pipeline candidate.",
        tier,
        patient_context: {
          caseId: patient.caseId,
          diagnosis: patient.diagnosis,
          target_role: protein?.role,
          source: "pipeline_structure_hydration",
        },
      });
      hydrated.push(mergeDockingPreview({ ...candidate, smiles }, preview));
      completed += 1;
    } catch (error) {
      errors.push({ candidate_id: candidate.id, message: error.message });
      hydrated.push({
        ...candidate,
        tags: unique([...(candidate.tags || []), "structure generation failed"]),
        raw: {
          ...(candidate.raw || {}),
          structure_generation_status: "failed",
          structure_generation_error: error.message,
        },
      });
    }
  }
  return { candidates: hydrated, completed, failed: errors.length, errors };
}

function balancedCandidateSlice(pool, selectedGenes, limit) {
  const sorted = [...pool].sort((a, b) => candidateEvidenceSortValue(b) - candidateEvidenceSortValue(a));
  if (!selectedGenes.length) return sorted.slice(0, limit);

  const byTarget = new Map(selectedGenes.map((gene) => [gene, []]));
  for (const candidate of sorted) {
    const key = String(candidate.target || "").toUpperCase();
    if (byTarget.has(key)) byTarget.get(key).push(candidate);
  }

  const picked = [];
  const pickedIds = new Set();
  const coverageDepth = Math.max(1, Math.min(3, Math.floor(limit / selectedGenes.length)));

  for (let index = 0; index < coverageDepth; index += 1) {
    for (const gene of selectedGenes) {
      const candidate = byTarget.get(gene)?.[index];
      if (candidate && !pickedIds.has(candidate.id) && picked.length < limit) {
        picked.push(candidate);
        pickedIds.add(candidate.id);
      }
    }
  }

  for (const candidate of sorted) {
    if (picked.length >= limit) break;
    if (!pickedIds.has(candidate.id)) {
      picked.push(candidate);
      pickedIds.add(candidate.id);
    }
  }

  return picked;
}

function candidateEvidenceSortValue(candidate) {
  const artifactBoost = hasCandidateStructureArtifact(candidate) ? 0.035 : candidateNeedsStructurePreview(candidate) ? -0.16 : 0;
  const realBoost = candidate.realEvidence ? 0.06 : 0;
  return numeric(candidate.score, 0) + artifactBoost + realBoost;
}

function proteinEvidenceForTarget(proteinEvidence, gene) {
  const target = String(gene || "").toUpperCase();
  if (!target || !Array.isArray(proteinEvidence?.targets)) return null;
  return proteinEvidence.targets.find((row) => String(row.gene || "").toUpperCase() === target) || null;
}

function proteinEvidenceBoost(evidence) {
  if (!evidence) return 0;
  const score = numeric(evidence.target_context_score, 0.5);
  const status = evidence.esm?.status;
  const esmBoost = status === "generated" ? 0.012 : status === "not_configured" || status === "not_run" ? 0.004 : 0;
  return Math.max(0, Math.min(0.028, (score - 0.5) * 0.055 + esmBoost));
}

function proteinEvidenceTag(evidence) {
  if (!evidence) return null;
  if (evidence.esm?.status === "generated") return "ESM target evidence";
  if (evidence.sequence) return "sequence target evidence";
  return "target evidence pending";
}

function formatProteinAiMetric(evidence) {
  if (!evidence) return "Not attached";
  const score = fmtMaybe(evidence.target_context_score, 3);
  const status = evidence.esm?.status === "generated" ? "ESM" : evidence.sequence ? "sequence" : "pending";
  return `${status} ${score}`;
}

function dataFabricForTarget(dataFabric, gene) {
  const target = String(gene || "").toUpperCase();
  if (!target || !Array.isArray(dataFabric?.targets)) return null;
  return dataFabric.targets.find((row) => String(row.gene || "").toUpperCase() === target) || null;
}

function dataFabricForLigand(dataFabric, candidateId, smiles) {
  if (!Array.isArray(dataFabric?.ligands)) return null;
  return (
    dataFabric.ligands.find((row) => row.candidate_id && String(row.candidate_id) === String(candidateId)) ||
    dataFabric.ligands.find((row) => row.smiles && smiles && String(row.smiles) === String(smiles)) ||
    null
  );
}

function dataFabricBoost(targetFabric, ligandFabric) {
  const targetRichness = numeric(targetFabric?.data_richness, 0);
  const ligandRichness = numeric(ligandFabric?.data_richness, 0);
  return Math.min(0.018, targetRichness * 0.003 + ligandRichness * 0.004);
}

function dataFabricTag(targetFabric, ligandFabric) {
  if (!targetFabric && !ligandFabric) return null;
  const activityCount = targetFabric?.chembl?.activity_summary?.activity_count || 0;
  if (activityCount) return `${activityCount} ChEMBL activities`;
  if (ligandFabric?.pubchem?.properties) return "PubChem enriched";
  if (ligandFabric?.rdkit?.status === "computed") return "live descriptors";
  return "realtime data";
}

function formatDataFabricMetric(targetFabric, ligandFabric) {
  const activityCount = targetFabric?.chembl?.activity_summary?.activity_count || 0;
  const pubchem = ligandFabric?.pubchem?.properties ? "PubChem" : "no PubChem";
  if (activityCount) return `${activityCount} activities, ${pubchem}`;
  return ligandFabric ? pubchem : "Not attached";
}

const SYNTHETIC_SEED_SMILES = {
  EGFR: [
    ["quinazoline EGFR starter", "COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1"],
    ["anilinoquinazoline EGFR starter", "COc1cc2ncnc(Nc3cccc(Br)c3)c2cc1OCCN1CCOCC1"],
  ],
  ERBB2: [
    ["HER2/EGFR kinase starter", "CS(=O)(=O)CCNc1nc(Nc2ccc(Cl)cc2)c2ncn(C)c2n1"],
    ["quinazoline HER2 starter", "COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1"],
  ],
  MET: [
    ["MET hinge starter", "CN1CCN(CC1)c1ccc(Nc2ncc(Cl)c(Nc3ccc(F)c(Cl)c3)n2)cc1"],
    ["MET morpholine starter", "COc1ccc(Nc2ncc(Cl)c(Nc3ccc(F)cc3)n2)cc1N1CCOCC1"],
  ],
  ALK: [
    ["ALK/MET kinase starter", "CN1CCN(CC1)c1ccc(Nc2ncc(Cl)c(Nc3ccc(F)cc3)n2)cc1"],
    ["aminopyrimidine ALK starter", "COc1ccc(Nc2ncc(Cl)c(Nc3ccc(F)cc3)n2)cc1N1CCOCC1"],
  ],
  KRAS: [
    ["KRAS allosteric amide starter", "O=C(Nc1ccc(F)cc1)c1ccncc1N1CCN(CC1)C(=O)C1CC1"],
    ["KRAS polar arylamide starter", "CC(C)Oc1cc(NC(=O)c2ccncc2)ccc1F"],
  ],
  BRAF: [
    ["BRAF diaryl kinase starter", "CCCSc1nc2c(c(Nc3ccc(Cl)cc3F)n1)cccc2"],
    ["BRAF arylamide starter", "O=C(Nc1ccc(F)cc1)c1ccc(N2CCOCC2)nc1"],
  ],
  PIK3CA: [
    ["PI3K morpholine starter", "Cc1c(C(=O)N(C)C)sc2nc(N3CCOCC3)nc(N)c12"],
    ["PI3K aminopyrimidine starter", "O=C(Nc1ccc(-c2nc(N3CCOCC3)nc(N)n2)cc1)N1CCOCC1"],
  ],
  PARP1: [
    ["PARP nicotinamide starter", "O=C1NCCN1Cc1ccc2c(c1)C(=O)N(Cc1ccccc1)C2=O"],
    ["PARP lactam starter", "O=C1NCCc2cc(CN3CCOCC3)ccc21"],
  ],
  ESR1: [
    ["SERM triaryl starter", "CN(C)CCOc1ccc(C(=C(c2ccccc2)c2ccccc2)c2ccccc2)cc1"],
    ["ESR1 polar aryl starter", "COc1ccc(CCN(C)C)cc1Oc1ccc(F)cc1"],
  ],
  AR: [
    ["androgen receptor amide starter", "CC(C)(C)c1ccc(O)c(C(=O)Nc2ccc(C#N)cc2)c1"],
    ["AR cyanoaryl starter", "N#Cc1ccc(NC(=O)c2ccccc2F)cc1"],
  ],
  BCL2: [
    ["BCL2 arylpiperazine starter", "CC(C)Oc1ccc(C(=O)N2CCN(CC2)c2ccc(Cl)cc2)cc1"],
    ["BCL2 hydrophobic amide starter", "COc1ccc(C(=O)N2CCN(c3ccc(F)cc3)CC2)cc1"],
  ],
  FLT3: [
    ["FLT3 aminopyrimidine starter", "COc1cc(Nc2ncc(Cl)c(Nc3ccc(F)cc3)n2)ccc1N1CCNCC1"],
    ["FLT3 kinase hinge starter", "CN1CCN(CC1)c1ccc(Nc2ncc(Cl)cn2)cc1"],
  ],
  IDH1: [
    ["IDH1 polar triazine starter", "CC(C)(O)c1nc(N2CCOCC2)nc(Nc2ccc(F)cc2)n1"],
    ["IDH1 arylamide starter", "O=C(Nc1ccc(F)cc1)c1cnc(N2CCOCC2)nc1"],
  ],
  TP53: [
    ["protein-protein interface fragment starter", "O=C(Nc1ccc(F)cc1)c1ccc(OCCN2CCOCC2)cc1"],
    ["fragment elaboration starter", "COc1ccc(C(=O)Nc2ccncc2)cc1F"],
  ],
};

function syntheticSeedForGene(gene, index = 0) {
  const target = String(gene || "").toUpperCase();
  const seeds = SYNTHETIC_SEED_SMILES[target] || [
    ["generic heteroaryl starter", "O=C(Nc1ccc(F)cc1)c1ccncc1N1CCOCC1"],
    ["generic polar arylamide starter", "COc1ccc(C(=O)Nc2ccncc2)cc1F"],
  ];
  const [label, smiles] = seeds[Math.abs(index) % seeds.length];
  return { label, smiles };
}

function syntheticSeedForProtein(protein, index = 0) {
  const seed = syntheticSeedForGene(protein.gene, index);
  return {
    ...seed,
    rationale: `${seed.label} generated for ${protein.gene} using the selected diagnosis, protein family, and patient-context fit.`,
  };
}

function isUsableSmiles(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return !/preview|reference ligand asset|not available|launch backend/i.test(text);
}

function hasCandidateStructureArtifact(candidate) {
  const raw = candidate?.raw || {};
  return Boolean(
    candidate?.structureImage ||
      raw.sdf_url ||
      raw.docked_sdf_url ||
      raw.gnina_pose_sdf_url ||
      raw.png_url ||
      raw.pose_sources?.some((source) => source?.url),
  );
}

function candidateSeedSmiles(candidate) {
  const raw = candidate?.raw || {};
  const candidateIndex = Number(String(candidate?.id || "").match(/(\d+)$/)?.[1] || 1) - 1;
  if (isUsableSmiles(raw.canonical_smiles)) return raw.canonical_smiles;
  if (isUsableSmiles(raw.smiles)) return raw.smiles;
  if (isUsableSmiles(candidate?.smiles)) return candidate.smiles;
  if (raw.needs_structure_generation || String(candidate?.id || "").includes("-QAI-")) {
    return syntheticSeedForGene(candidate?.target, candidateIndex).smiles;
  }
  return "";
}

function candidateNeedsStructurePreview(candidate) {
  if (hasCandidateStructureArtifact(candidate)) return false;
  return Boolean(candidateSeedSmiles(candidate));
}

function candidateCanRunDocking(candidate) {
  const raw = candidate?.raw || {};
  return Boolean(candidateSeedSmiles(candidate) || raw.sdf_url || raw.ligand_sdf_url || raw.docked_sdf_url || raw.gnina_pose_sdf_url);
}

function displayCandidateSmiles(candidate) {
  const raw = candidate?.raw || {};
  if (isUsableSmiles(raw.canonical_smiles)) return raw.canonical_smiles;
  if (isUsableSmiles(raw.smiles)) return raw.smiles;
  if (isUsableSmiles(candidate?.smiles)) return candidate.smiles;
  if (raw.evidence_kind === "reference_ligand") return "SDF asset; canonical SMILES is parsed after docking/prep.";
  return "Not available";
}

function normalizeBackendCandidate(candidate, proteinEvidence = null, dataFabric = null) {
  const affinity = numeric(candidate.affinity_kcal_mol ?? candidate.vina_affinity_kcal_mol, null);
  const quantumDelta = numeric(candidate.quantum_ablation_delta ?? candidate.quantum_delta, null);
  const realEvidence = Boolean(candidate.docking_is_real || candidate.pose_sources?.some((source) => source.method_tier === "REAL"));
  const poseSources = visiblePoseSources(candidate.pose_sources || []);
  const targetEvidence = proteinEvidenceForTarget(proteinEvidence, candidate.target_id);
  const targetFabric = dataFabricForTarget(dataFabric, candidate.target_id);
  const ligandFabric = dataFabricForLigand(dataFabric, candidate.candidate_id, candidate.canonical_smiles || candidate.smiles || candidate.smiles_qm);
  const evidenceBoost = proteinEvidenceBoost(targetEvidence);
  const fabricBoost = dataFabricBoost(targetFabric, ligandFabric);
  const raw = {
    ...candidate,
    pose_sources: poseSources,
    default_pose_source: defaultPoseSourceId(candidate, poseSources),
    protein_ai_evidence: targetEvidence,
    realtime_data_fabric: { target: targetFabric, ligand: ligandFabric },
    esm_status: targetEvidence?.esm?.status,
    esm_embedding_url: targetEvidence?.esm?.artifact_url,
  };
  return {
    id: candidate.candidate_id || `${candidate.target_id}-candidate`,
    target: candidate.target_id || "Target",
    score: Math.min(0.99, numeric(candidate.final_score, 0.6) + evidenceBoost + fabricBoost),
    activity: numeric(candidate.activity_component ?? candidate.activity_score, 0.5),
    docking: numeric(candidate.docking_component, normalizeDockingScore(affinity)),
    admet: numeric(candidate.admet_component ?? candidate.admet_score, 0.5),
    quantum: numeric(candidate.late_stage_quantum_component ?? candidate.quantum_component ?? candidate.qml_score, 0.5),
    md: numeric(candidate.md_component, candidate.stability_class === "stable" ? 0.9 : 0.5),
    affinity: affinity !== null ? `${affinity.toFixed(2)} kcal/mol` : "review",
    affinityValue: affinity,
    quantumDelta: quantumDelta !== null ? quantumDelta.toFixed(3) : "not computed",
    quantumDeltaValue: quantumDelta,
    smiles: candidate.canonical_smiles || candidate.smiles || candidate.smiles_qm || "",
    structureImage: candidate.png_url,
    realEvidence,
    rationale: `${candidate.binding_class || "Ranked"} candidate from ${candidate.source || "platform evidence"} using ${candidate.docking_mode || "computational screening"}.`,
    tags: unique([
      candidate.pose_method_tier || (realEvidence ? "real pose" : "preview"),
      candidate.pocket_method_tier || "pocket review",
      candidate.filter_pass === false ? "filter issue" : "filter pass",
      candidate.gnina_status === "completed" ? "GNINA" : "Vina/Smina",
      proteinEvidenceTag(targetEvidence),
      dataFabricTag(targetFabric, ligandFabric),
    ].filter(Boolean)),
    raw,
  };
}

function synthesizeCandidates(selectedProteins, patient, proteinEvidence = null, dataFabric = null) {
  const chemistryModes = ["ATP-pocket analog", "allosteric probe", "covalent-warhead review", "fragment elaboration", "macrocycle review"];
  return selectedProteins.flatMap((protein, proteinIndex) =>
    [
      ...referenceLigandsForProtein(protein).slice(0, 3).map((ligand, index) => referenceLigandCandidate(ligand, protein, patient, proteinIndex, index, proteinEvidence, dataFabric)),
      ...Array.from({ length: Math.max(2, 5 - referenceLigandsForProtein(protein).length) }).map((_, index) => {
      const targetEvidence = proteinEvidenceForTarget(proteinEvidence, protein.gene);
      const targetFabric = dataFabricForTarget(dataFabric, protein.gene);
      const evidenceBoost = proteinEvidenceBoost(targetEvidence);
      const fabricBoost = dataFabricBoost(targetFabric, null);
      const fit = scoreProteinForPatient(protein, patient);
      const seed = syntheticSeedForProtein(protein, index);
      const score = Math.min(0.86, 0.42 + fit / 240 + (5 - index) * 0.018 - proteinIndex * 0.012 + evidenceBoost + fabricBoost);
      return {
        id: `${protein.gene}-QAI-${String(index + 1).padStart(3, "0")}`,
        target: protein.gene,
        score,
        activity: Math.min(0.96, 0.5 + fit / 210),
        docking: Math.min(0.92, 0.48 + score / 3),
        admet: Math.min(0.9, 0.55 + (5 - index) * 0.045),
        quantum: Math.min(0.88, 0.44 + score / 2.8),
        md: Math.min(0.85, 0.58 + proteinIndex * 0.02),
        affinity: `${(-6.6 - score * 2.4).toFixed(2)} kcal/mol`,
        affinityValue: -6.6 - score * 2.4,
        quantumDelta: `+${(score / 9).toFixed(3)}`,
        quantumDeltaValue: score / 9,
        smiles: seed.smiles,
        structureImage: "",
        realEvidence: false,
        rationale: `${chemistryModes[(index + proteinIndex) % chemistryModes.length]} using ${seed.label}; prioritized for ${protein.role.toLowerCase()} with patient-context fit ${fit}.`,
        tags: [protein.family, protein.alphafoldId, "generated starter", "needs structure preview", proteinEvidenceTag(targetEvidence), dataFabricTag(targetFabric, null)].filter(Boolean),
        raw: {
          evidence_kind: "generated_starter",
          binding_class: "generated starter",
          canonical_smiles: seed.smiles,
          smiles: seed.smiles,
          synthetic_seed_label: seed.label,
          needs_structure_generation: true,
          structure_generation_status: "pending",
          docking_note: "Generated starter molecule. RDKit conformer generation and real docking must run before interpreting geometry or rank.",
          pocket_source: "AlphaFold target hypothesis",
          pocket_pdb_id: protein.alphafoldId,
          reference_ligand: seed.label,
          generation_method: "Patient-context target starter selection",
          structure_mode: "pending RDKit/MMFF preview",
          protein_ai_evidence: targetEvidence,
          realtime_data_fabric: { target: targetFabric, ligand: null },
          esm_status: targetEvidence?.esm?.status,
          esm_embedding_url: targetEvidence?.esm?.artifact_url,
          admet_score: Math.min(0.9, 0.55 + (5 - index) * 0.045),
          quantum_score: Math.min(0.88, 0.44 + score / 2.8),
        },
      };
    }),
    ],
  );
}

function referenceLigandsForProtein(protein) {
  const gene = protein.gene.toUpperCase();
  return PHARMA_ASSET_LIBRARY.ligands.filter((ligand) =>
    String(ligand.target)
      .toUpperCase()
      .split("/")
      .map((target) => target.trim())
      .includes(gene),
  );
}

function referenceLigandCandidate(ligand, protein, patient, proteinIndex, index, proteinEvidence = null, dataFabric = null) {
  const fit = scoreProteinForPatient(protein, patient);
  const targetEvidence = proteinEvidenceForTarget(proteinEvidence, protein.gene);
  const targetFabric = dataFabricForTarget(dataFabric, protein.gene);
  const score = Math.min(0.97, 0.54 + fit / 215 + (3 - index) * 0.025 - proteinIndex * 0.01 + proteinEvidenceBoost(targetEvidence) + dataFabricBoost(targetFabric, null));
  return {
    id: `${protein.gene}-${ligand.chemblId}`,
    target: protein.gene,
    score,
    activity: Math.min(0.95, 0.52 + fit / 220),
    docking: Math.min(0.88, 0.5 + score / 3.4),
    admet: Math.min(0.86, 0.58 + (3 - index) * 0.04),
    quantum: Math.min(0.84, 0.42 + score / 3),
    md: Math.min(0.82, 0.57 + proteinIndex * 0.015),
    affinity: "needs docking",
    affinityValue: null,
    quantumDelta: "reference",
    quantumDeltaValue: 0,
    smiles: "",
    structureImage: ligand.image,
    realEvidence: false,
    rationale: `${ligand.name} is a curated ChEMBL reference ligand for ${ligand.target}. It is shown to keep ${protein.gene} represented while backend docking/QM evidence is generated.`,
    tags: [protein.family, ligand.chemblId, "reference ligand", "needs backend docking", proteinEvidenceTag(targetEvidence), dataFabricTag(targetFabric, null)].filter(Boolean),
    raw: {
      evidence_kind: "reference_ligand",
      binding_class: "reference ligand",
      docking_note: "Reference ligand asset. Run backend docking/GNINA/QM before interpreting binding or rank.",
      pocket_source: "AlphaFold target hypothesis",
      pocket_pdb_id: protein.alphafoldId,
      reference_ligand: ligand.name,
      chembl_id: ligand.chemblId,
      ligand_name: ligand.name,
      sdf_url: ligand.sdf,
      png_url: ligand.image,
      source_json_url: ligand.search,
      structure_mode: "ChEMBL SDF/SVG asset",
      protein_ai_evidence: targetEvidence,
      realtime_data_fabric: { target: targetFabric, ligand: null },
      esm_status: targetEvidence?.esm?.status,
      esm_embedding_url: targetEvidence?.esm?.artifact_url,
      admet_score: Math.min(0.86, 0.58 + (3 - index) * 0.04),
      quantum_score: Math.min(0.84, 0.42 + score / 3),
    },
  };
}

function testDesignedMolecule({ smiles, selectedElements, starters, selectedProteins, patient, tier, objective }) {
  const target = selectedProteins[0]?.gene || "CUSTOM";
  const heavyElementPenalty = selectedElements.filter((element) => ["Pt", "Hg", "Cd", "Pb", "U"].includes(element)).length * 14;
  const halogenCount = selectedElements.filter((element) => ["F", "Cl", "Br", "I"].includes(element)).length;
  const aromaticBoost = starters.filter((starter) => /benzene|pyridine|indole|quinazoline|triazole/i.test(starter.name)).length * 5;
  const polarityBoost = starters.filter((starter) => /morpholine|amide|sulfonamide|urea|phosphate/i.test(starter.name)).length * 4;
  const targetFit = Math.max(15, Math.min(96, 54 + aromaticBoost + selectedProteins.length * 5 + (objective.toLowerCase().includes("kinase") ? 8 : 0)));
  const safetyPressure = Math.max(8, Math.min(94, 22 + heavyElementPenalty + halogenCount * 6 + (smiles.length > 80 ? 16 : 0)));
  const admet = Math.max(0.12, Math.min(0.92, 0.72 + polarityBoost / 100 - safetyPressure / 220));
  const docking = Math.max(0.18, Math.min(0.94, 0.48 + targetFit / 210));
  const quantum = Math.max(0.2, Math.min(0.88, 0.44 + selectedElements.includes("B") * 0.07 + halogenCount * 0.02));
  const md = Math.max(0.2, Math.min(0.86, 0.62 - heavyElementPenalty / 200 + polarityBoost / 140));
  const activity = Math.max(0.22, Math.min(0.94, 0.45 + targetFit / 180));
  const score = weightedCandidateScore({ activity, docking, admet, quantum, md }, { activity: 25, docking: 25, admet: 20, quantum: 20, md: 10 });
  const id = `DESIGN_${target}_${Date.now().toString().slice(-5)}`;
  const notes = [
    `Target fit estimated from ${selectedProteins.length || 1} selected protein(s), objective text, and scaffold class.`,
    `Safety pressure estimated from selected elements, fragment class, halogen load, and molecule complexity.`,
    "This is a design hypothesis. Validate with cheminformatics, synthesis feasibility, docking, and assays.",
  ];
  if (heavyElementPenalty) notes.push("Heavy-metal or organometallic content requires specialist toxicity and handling review.");
  if (halogenCount >= 3) notes.push("High halogen count can increase lipophilicity and off-target pressure.");
  return {
    targetFit,
    safetyPressure,
    notes,
    candidate: {
      id,
      target,
      score,
      activity,
      docking,
      admet,
      quantum,
      md,
      affinity: `${(-6.1 - docking * 3.1).toFixed(2)} kcal/mol`,
      affinityValue: -6.1 - docking * 3.1,
      quantumDelta: `+${(quantum / 10).toFixed(3)}`,
      quantumDeltaValue: quantum / 10,
      smiles,
      structureImage: "",
      realEvidence: false,
      rationale: `Custom chemistry-bench design for ${objective}. Starter fragments: ${starters.map((starter) => starter.name).join(", ") || "manual input"}.`,
      tags: ["chemistry bench", TIERS[tier].label, "needs backend docking"],
      raw: {
        canonical_smiles: smiles,
        binding_class: "custom design",
        docking_note: "Local Chemistry Bench estimate. Run backend docking/GNINA/QM before interpreting binding.",
        LogP: 2.6 + halogenCount * 0.34,
        MW: 260 + smiles.length * 2.2 + selectedElements.length * 4,
        TPSA: 58 + polarityBoost * 2,
        QED: admet,
        toxicity_risk_proxy: safetyPressure / 100,
        admet_score: admet,
        quantum_score: quantum,
        pose_method_tier: "PREVIEW",
      },
    },
  };
}

function mergeDockingPreview(candidate, preview) {
  if (!preview?.raw) return candidate;
  const raw = {
    ...(candidate.raw || {}),
    ...preview.raw,
    needs_structure_generation: false,
    structure_generation_status: "completed",
  };
  const affinityValue = numeric(preview.affinity_kcal_mol ?? raw.affinity_kcal_mol, candidate.affinityValue);
  const docking = numeric(preview.docking_component ?? raw.docking_component, candidate.docking);
  const merged = {
    ...candidate,
    id: preview.candidate_id || candidate.id,
    target: preview.target || candidate.target,
    smiles: preview.smiles || raw.canonical_smiles || candidate.smiles,
    structureImage: raw.png_url || candidate.structureImage,
    docking,
    affinityValue,
    affinity: formatAffinity(affinityValue),
    realEvidence: false,
    tags: unique([...(candidate.tags || []).filter((tag) => tag !== "needs structure preview"), "RDKit 3D pose", "pocket preview", raw.pocket_method_tier].filter(Boolean)),
    raw,
  };
  merged.score = weightedCandidateScore(merged, { activity: 25, docking: 25, admet: 20, quantum: 20, md: 10 });
  return merged;
}

function availableDockingEngines(toolStatus) {
  const tools = toolStatus?.tools || {};
  const available = FULL_DOCKING_STACK_ENGINES.filter((engine) => tools[engine]?.available);
  return available.length ? available : FULL_DOCKING_STACK_ENGINES;
}

function mergeRawEvidence(previous = {}, incoming = {}) {
  const merged = { ...previous };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (key === "pose_sources") continue;
    if (value === null || value === undefined || value === "") continue;
    merged[key] = value;
  }
  return merged;
}

function mergePoseSources(...sourceGroups) {
  const merged = new Map();
  for (const group of sourceGroups) {
    for (const source of Array.isArray(group) ? group : []) {
      if (!source?.id || !source?.url) continue;
      merged.set(source.id, { ...(merged.get(source.id) || {}), ...source });
    }
  }
  const preferred = ["gnina", "vina", "smina", "docked", "preview", "conformer"];
  return Array.from(merged.values()).sort((a, b) => {
    const ai = preferred.includes(a.id) ? preferred.indexOf(a.id) : preferred.length;
    const bi = preferred.includes(b.id) ? preferred.indexOf(b.id) : preferred.length;
    return ai - bi;
  });
}

function dockingInputSdfUrl(raw = {}) {
  return raw.sdf_url || raw.ligand_sdf_url || raw.vina_docked_sdf_url || raw.smina_docked_sdf_url || raw.docked_sdf_url || raw.gnina_pose_sdf_url || "";
}

function dockingInputSdfPath(raw = {}) {
  return raw.sdf_path || raw.ligand_sdf_path || raw.vina_docked_sdf_path || raw.smina_docked_sdf_path || raw.docked_sdf_path || raw.gnina_pose_sdf_path || "";
}

function optionalBoxVector(value, size = false) {
  if (!value) return null;
  const keys = size
    ? ["x", "y", "z", "docking_box_size_x", "docking_box_size_y", "docking_box_size_z", "gnina_box_size_x", "gnina_box_size_y", "gnina_box_size_z", "docking_box_size", "gnina_box_size"]
    : ["x", "y", "z", "docking_center_x", "docking_center_y", "docking_center_z", "gnina_center_x", "gnina_center_y", "gnina_center_z"];
  if (!keys.some((key) => value[key] !== undefined && value[key] !== null && value[key] !== "")) return null;
  const vector = normalizeBoxVector(value, size);
  if (![vector.x, vector.y, vector.z].every((item) => Number.isFinite(Number(item)))) return null;
  return vector;
}

function buildRealtimeDockingPayload(candidate, engine) {
  const raw = candidate.raw || {};
  return {
    candidate_id: candidate.id,
    target: candidate.target,
    smiles: candidateSeedSmiles(candidate) || undefined,
    engine,
    ligand_sdf_url: dockingInputSdfUrl(raw) || undefined,
    ligand_sdf_path: dockingInputSdfPath(raw) || undefined,
    receptor_url: raw.receptor_url || raw.gnina_receptor_url || raw.vina_receptor_url || raw.smina_receptor_url || undefined,
    receptor_path: raw.receptor_path || undefined,
    box_center: optionalBoxVector(raw.box_center || raw) || undefined,
    box_size: optionalBoxVector(raw.box_size || raw, true) || undefined,
    exhaustiveness: engine === "gnina" ? 4 : 8,
    num_modes: 5,
    cpu: 4,
  };
}

async function prepareCandidateForDocking(candidate, context = {}) {
  if (!candidateNeedsStructurePreview(candidate)) return candidate;
  const smiles = candidateSeedSmiles(candidate);
  if (!smiles) throw new Error(`No valid SMILES or SDF input is available for ${candidate.id}.`);
  const preview = await dockPreviewMolecule({
    smiles,
    target: candidate.target,
    candidate_id: candidate.id,
    objective: candidate.rationale || "Prepare ligand for real docking.",
    patient_context: context,
  });
  return mergeDockingPreview({ ...candidate, smiles }, preview);
}

async function runDockingStackForCandidate(candidate, { engines = FULL_DOCKING_STACK_ENGINES, onProgress = () => {}, context = {} } = {}) {
  let current = await prepareCandidateForDocking(candidate, { ...context, source: context.source || "full_docking_stack" });
  const results = [];
  const errors = [];
  for (const engine of engines) {
    try {
      onProgress({ engine, status: "started", candidate: current });
      const payload = await runRealtimeDocking(buildRealtimeDockingPayload(current, engine));
      current = mergeRealtimeDocking(current, payload);
      results.push(payload);
      onProgress({ engine, status: payload.status || "completed", candidate: current, payload });
    } catch (error) {
      errors.push({ engine, message: error.message });
      onProgress({ engine, status: "failed", candidate: current, error });
    }
  }
  return { candidate: current, results, errors };
}

function mergeRealtimeDocking(candidate, dockingPayload) {
  const previousRaw = candidate.raw || {};
  const incomingRaw = dockingPayload?.raw || {};
  const raw = mergeRawEvidence(previousRaw, incomingRaw);
  const poseSources = visiblePoseSources(mergePoseSources(previousRaw.pose_sources, incomingRaw.pose_sources));
  raw.pose_sources = poseSources;
  raw.default_pose_source = poseSources.some((source) => source.id === "gnina") ? "gnina" : defaultPoseSourceId(raw, poseSources);
  const gninaAffinity = numeric(raw.gnina_affinity_kcal_mol, null);
  const sminaAffinity = numeric(raw.smina_affinity_kcal_mol, null);
  const vinaAffinity = numeric(raw.vina_affinity_kcal_mol ?? raw.affinity_kcal_mol, null);
  const affinityValue = gninaAffinity ?? sminaAffinity ?? vinaAffinity ?? candidate.affinityValue;
  const docking = Math.max(
    numeric(candidate.docking, 0.5),
    normalizeDockingScore(affinityValue),
    numeric(raw.gnina_cnn_pose_score, 0) * 0.92,
  );
  const updated = {
    ...candidate,
    target: dockingPayload?.target || candidate.target,
    smiles: displayCandidateSmiles({ ...candidate, raw }),
    structureImage: raw.png_url || candidate.structureImage,
    docking,
    affinityValue,
    affinity: formatAffinity(affinityValue),
    realEvidence: Boolean(raw.gnina_pose_sdf_url || raw.vina_docked_sdf_url || raw.smina_docked_sdf_url || raw.docked_sdf_url || raw.docking_is_real),
    tags: unique([
      ...(candidate.tags || []),
      raw.gnina_pose_sdf_url ? "GNINA CNN" : null,
      raw.vina_docked_sdf_url || raw.vina_pose_pdbqt_url ? "AutoDock Vina" : null,
      raw.smina_docked_sdf_url || raw.smina_pose_pdbqt_url ? "Smina" : null,
      raw.docked_sdf_url ? "real docking" : null,
      raw.actual_engine_used,
    ].filter(Boolean)),
    raw,
  };
  updated.score = weightedCandidateScore(updated, { activity: 25, docking: 25, admet: 20, quantum: 20, md: 10 });
  return updated;
}

function normalizeBoxVector(value, size = false) {
  const fallback = size ? 24 : 0;
  if (!value) return { x: fallback, y: fallback, z: fallback };
  if (size) {
    return {
      x: numeric(value.x ?? value.docking_box_size_x ?? value.gnina_box_size_x ?? value.docking_box_size ?? value.gnina_box_size, fallback),
      y: numeric(value.y ?? value.docking_box_size_y ?? value.gnina_box_size_y ?? value.docking_box_size ?? value.gnina_box_size, fallback),
      z: numeric(value.z ?? value.docking_box_size_z ?? value.gnina_box_size_z ?? value.docking_box_size ?? value.gnina_box_size, fallback),
    };
  }
  return {
    x: numeric(value.x ?? value.docking_center_x ?? value.gnina_center_x, fallback),
    y: numeric(value.y ?? value.docking_center_y ?? value.gnina_center_y, fallback),
    z: numeric(value.z ?? value.docking_center_z ?? value.gnina_center_z, fallback),
  };
}

function buildCopilotState({ patient, selectedProteins, run, tier }) {
  return {
    tier,
    activeTab: "copilot",
    caseId: patient.caseId,
    diagnosis: patient.diagnosis,
    selectedProteins: selectedProteins.map((protein) => ({
      gene: protein.gene,
      uniprot: protein.uniprot,
      alphafoldId: protein.alphafoldId,
      role: protein.role,
      variants: protein.variants,
    })),
    runStatus: run.status,
    candidateCount: run.candidates?.length || 0,
    selectedCandidate: run.candidates?.[0]?.id || null,
    proteinEvidenceSummary: run.proteinEvidence?.summary || null,
    realtimeDataFabricSummary: run.dataFabric?.summary || null,
  };
}

function buildResearchToolPayload(toolId, { patient, selectedProteins, run, customMolecules, notes, registry, fabricStatus }) {
  const candidates = [...customMolecules, ...(run.candidates || [])].slice(0, 8);
  const base = {
    case_id: patient.caseId,
    diagnosis: patient.diagnosis,
    selected_targets: selectedProteins.map((protein) => `${protein.gene}:${protein.alphafoldId}`),
    candidate_count: candidates.length,
    research_notes: notes,
    limitation: "Computational research planning only; not clinical guidance.",
  };
  if (toolId === "target-dossier") return { ...base, variants: patient.variants, expression: patient.expression, proteomics: patient.proteomics };
  if (toolId === "asset-library") {
    return {
      ...base,
      receptor_assets: PHARMA_ASSET_LIBRARY.receptors.length,
      ligand_assets: PHARMA_ASSET_LIBRARY.ligands.length,
      downloaded_files: PHARMA_ASSET_LIBRARY.receptors.length * 3 + PHARMA_ASSET_LIBRARY.ligands.length * 3,
      sources: PHARMA_ASSET_LIBRARY.sources,
      notices: PHARMA_ASSET_LIBRARY.sourceNotices,
    };
  }
  if (toolId === "resource-registry") {
    return {
      ...base,
      resource_summary: registry?.summary || "registry loading",
      core_resources: registry?.resources?.filter((resource) => String(resource.priority).startsWith("P0")).map((resource) => `${resource.name}:${resource.local_status}`) || [],
      edge_resources: registry?.resources?.filter((resource) => String(resource.priority).startsWith("P1")).map((resource) => `${resource.name}:${resource.local_status}`) || [],
      p0_gaps: registry?.gaps?.filter((gap) => gap.priority === "P0").map((gap) => gap.area) || [],
      p1_gaps: registry?.gaps?.filter((gap) => gap.priority === "P1").map((gap) => gap.area) || [],
    };
  }
  if (toolId === "data-fabric") {
    return {
      ...base,
      run_summary: run.dataFabric?.summary || "Run the pipeline to populate realtime evidence.",
      connectors: fabricStatus?.connectors || {},
      ai_models: fabricStatus?.ai_models || {},
      cache_dir: fabricStatus?.cache_dir,
      candidate_evidence: candidates.map((candidate) => ({
        id: candidate.id,
        target: candidate.target,
        data_fabric: candidate.raw?.realtime_data_fabric || null,
      })),
      claim_boundary: "Realtime datapoints support prioritization and auditability only; not measured efficacy or safety.",
    };
  }
  if (toolId === "literature") return { ...base, queries: selectedProteins.map((protein) => `${protein.gene} ${patient.diagnosis.replaceAll("_", " ")} inhibitor structure activity`) };
  if (toolId === "sar") return { ...base, sar_columns: ["target", "scaffold", "affinity", "ADMET", "quantum_delta", "toxicity_proxy"], candidates: candidates.map((candidate) => candidate.id) };
  if (toolId === "counter-screen") return { ...base, safety_panel: HUMAN_SAFETY_PANEL.map((protein) => protein.gene) };
  if (toolId === "assay") return { ...base, assays: ["biochemical IC50/Kd", "orthogonal binding", "cell viability", "selectivity panel", "ADME/Tox counterscreen"] };
  if (toolId === "formulation") return { ...base, properties: ["MW", "LogP", "TPSA", "HBD/HBA", "rotatable bonds", "alerts", "solubility hypothesis"] };
  if (toolId === "compare") return { ...base, candidates: candidates.map((candidate) => ({ id: candidate.id, score: candidate.score, target: candidate.target })) };
  if (toolId === "regulatory") return { ...base, blocked_claims: ["treats", "safe in humans", "clinically effective", "approved", "diagnostic"] };
  return base;
}

function demoBilling(tier) {
  const index = Math.max(0, TIER_ORDER.indexOf(tier));
  return {
    plan_tier: tier,
    credit_balance: 100 + index * 420,
    monthly_credit_limit: 100 + index * 500,
    quotas: {
      proteins_per_run: TIERS[tier].maxProteins,
      candidates_per_run: TIERS[tier].maxCandidates,
    },
  };
}

function numeric(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeDockingScore(affinity) {
  if (!Number.isFinite(Number(affinity))) return 0.5;
  return Math.max(0, Math.min(1, (Math.abs(Number(affinity)) - 4) / 12));
}

function weightedCandidateScore(candidate, weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0) || 1;
  const weighted =
    numeric(candidate.activity, 0.5) * weights.activity +
    numeric(candidate.docking, 0.5) * weights.docking +
    numeric(candidate.admet, 0.5) * weights.admet +
    numeric(candidate.quantum, 0.5) * weights.quantum +
    numeric(candidate.md, 0.5) * weights.md;
  const artifactAdjustment = candidate.realEvidence
    ? 0.055
    : hasCandidateStructureArtifact(candidate)
      ? 0.025
      : candidateNeedsStructurePreview(candidate)
        ? -0.18
        : 0;
  return Math.max(0, Math.min(1, weighted / total + artifactAdjustment));
}

function sortCandidates(a, b, sortBy) {
  if (sortBy === "original") return b.score - a.score;
  if (sortBy === "docking") return numeric(a.affinityValue, 99) - numeric(b.affinityValue, 99);
  if (sortBy === "admet") return numeric(b.admet, 0) - numeric(a.admet, 0);
  if (sortBy === "quantum") return numeric(b.quantum, 0) - numeric(a.quantum, 0);
  if (sortBy === "target") return a.target.localeCompare(b.target) || b.rerankScore - a.rerankScore;
  return b.rerankScore - a.rerankScore;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function fmtMaybe(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value === false ? "No" : value === true ? "Yes" : "NA";
  return number.toFixed(digits);
}

function formatAffinity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)} kcal/mol` : "NA";
}

function formatVector(value) {
  const x = value?.x ?? value?.docking_center_x ?? value?.gnina_center_x;
  const y = value?.y ?? value?.docking_center_y ?? value?.gnina_center_y;
  const z = value?.z ?? value?.docking_center_z ?? value?.gnina_center_z;
  if (![x, y, z].every((item) => Number.isFinite(Number(item)))) return "NA";
  return `${Number(x).toFixed(2)}, ${Number(y).toFixed(2)}, ${Number(z).toFixed(2)}`;
}

function formatBox(value) {
  const x = value?.x ?? value?.docking_box_size_x ?? value?.gnina_box_size_x ?? value?.docking_box_size ?? value?.gnina_box_size;
  const y = value?.y ?? value?.docking_box_size_y ?? value?.gnina_box_size_y ?? value?.docking_box_size ?? value?.gnina_box_size;
  const z = value?.z ?? value?.docking_box_size_z ?? value?.gnina_box_size_z ?? value?.docking_box_size ?? value?.gnina_box_size;
  if (![x, y, z].every((item) => Number.isFinite(Number(item)))) return "NA";
  return `${Number(x).toFixed(1)} x ${Number(y).toFixed(1)} x ${Number(z).toFixed(1)} A`;
}

function simulateHumanProteinPanel(candidate) {
  const raw = candidate.raw || {};
  const rows = HUMAN_SAFETY_PANEL.map((protein) => {
    const risk = humanProteinRisk(candidate, protein);
    return {
      ...protein,
      risk,
      tone: risk >= 70 ? "high" : risk >= 42 ? "medium" : "low",
      rationale: riskRationale(raw, protein, risk),
    };
  }).sort((a, b) => b.risk - a.risk);
  const mean = rows.reduce((sum, row) => sum + row.risk, 0) / Math.max(rows.length, 1);
  const top = rows.slice(0, 3).map((row) => row.gene).join(", ");
  return {
    rows,
    overallRisk: mean >= 70 ? "High" : mean >= 42 ? "Moderate" : "Low",
    overallTone: mean >= 70 ? "high" : mean >= 42 ? "medium" : "low",
    summary: `${candidate.id} shows ${mean >= 70 ? "high" : mean >= 42 ? "moderate" : "lower"} computational liability pressure; top counter-screen priorities: ${top}.`,
    assays: recommendAssays(rows, raw),
  };
}

function humanProteinRisk(candidate, protein) {
  const raw = candidate.raw || {};
  const logP = numeric(raw.LogP, 2.8);
  const mw = numeric(raw.MW, 360);
  const tpsa = numeric(raw.TPSA, 80);
  const rot = numeric(raw.RotBonds, 4);
  const arom = numeric(raw.AromaticRings, 2);
  const tox = numeric(raw.toxicity_risk_proxy ?? raw.tox21_toxicity_probability ?? raw.clintox_toxicity_probability, 0.22);
  const base = 18 + tox * 38 + Math.max(0, logP - 3) * 7 + Math.max(0, mw - 450) / 18 + Math.max(0, arom - 2) * 4;
  const gene = protein.gene;
  let risk = base;
  if (gene === "KCNH2") risk += Math.max(0, logP - 3.2) * 12 + Math.max(0, mw - 420) / 16 + numeric(raw.tox21_sr_mmp_probability, 0.2) * 16;
  if (gene === "SCN5A") risk += Math.max(0, logP - 3.4) * 9 + rot * 1.6;
  if (gene === "CYP3A4") risk += Math.max(0, logP - 2.8) * 10 + arom * 4 + Math.max(0, mw - 380) / 20;
  if (gene === "CYP2D6") risk += arom * 5 + Math.max(0, logP - 2.5) * 6;
  if (gene === "CYP2C9") risk += Math.max(0, logP - 3) * 5 + numeric(raw.HBA, 5) * 1.5;
  if (gene === "ABCB1") risk += Math.max(0, mw - 400) / 12 + Math.max(0, tpsa - 90) / 5 + rot * 1.8;
  if (gene === "ACHE") risk += arom * 5 + numeric(raw.tox21_nr_ahr_probability, 0.2) * 10;
  if (gene === "DRD2" || gene === "HTR2A") risk += Math.max(0, logP - 2.6) * 8 + arom * 5 - Math.max(0, tpsa - 80) / 8;
  if (gene === "ESR1") risk += numeric(raw.tox21_nr_er_probability, 0.1) * 40 + numeric(raw.tox21_nr_er_lbd_probability, 0.1) * 30;
  if (gene === "AR") risk += numeric(raw.tox21_nr_ar_probability, 0.1) * 40 + numeric(raw.tox21_nr_ar_lbd_probability, 0.1) * 30;
  if (gene === "PPARG") risk += numeric(raw.tox21_nr_ppar_gamma_probability, 0.1) * 42;
  if (gene === "TP53_PATHWAY") risk += numeric(raw.tox21_sr_p53_probability, 0.15) * 38 + numeric(raw.tox21_sr_atad5_probability, 0.1) * 30;
  if (gene === "MMP_PANEL") risk += numeric(raw.tox21_sr_mmp_probability, 0.2) * 42 + Math.max(0, logP - 3) * 7;
  if (candidate.target && gene.includes(candidate.target)) risk += 8;
  return Math.round(Math.max(3, Math.min(98, risk)));
}

function riskRationale(raw, protein, risk) {
  const drivers = protein.drivers.slice(0, 3).join(", ");
  const severity = risk >= 70 ? "prioritize counter-screening" : risk >= 42 ? "review before wet-lab spend" : "lower-priority watch item";
  return `${severity}; driven by ${drivers}. Descriptor context: LogP ${fmtMaybe(raw.LogP, 2)}, MW ${fmtMaybe(raw.MW, 1)}, toxicity proxy ${fmtMaybe(raw.toxicity_risk_proxy, 3)}.`;
}

function recommendAssays(rows, raw) {
  const top = rows.slice(0, 5).map((row) => row.gene);
  const assays = [];
  if (top.includes("KCNH2") || top.includes("SCN5A")) assays.push("Cardiac ion-channel counter-screen: hERG/KCNH2 and Nav1.5 patch clamp or validated binding assay.");
  if (top.some((gene) => gene.startsWith("CYP"))) assays.push("CYP inhibition/turnover panel: CYP3A4, CYP2D6, CYP2C9, and metabolite ID.");
  if (top.includes("ABCB1")) assays.push("Transporter and permeability package: P-gp efflux, Caco-2/MDCK, and protein binding.");
  if (top.includes("ESR1") || top.includes("AR") || top.includes("PPARG")) assays.push("Nuclear receptor liability panel: ER, AR, PPAR-gamma, and endocrine transcription assays.");
  if (top.includes("TP53_PATHWAY") || top.includes("MMP_PANEL") || numeric(raw.toxicity_risk_proxy, 0) > 0.3) assays.push("Cellular stress and mitochondrial panel: p53, ATAD5, mitochondrial membrane potential, and cytotoxicity in matched normal cells.");
  assays.push("Primary target biochemical assay plus orthogonal cellular assay before any efficacy interpretation.");
  return unique(assays);
}

function exportCandidate(candidate, simulation, presetId) {
  const baseName = `${candidate.id}_${presetId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (presetId === "json") {
    downloadText(`${baseName}.json`, JSON.stringify(buildCandidateDossier(candidate, simulation), null, 2), "application/json");
    return;
  }
  if (presetId === "csv") {
    downloadText(`${baseName}.csv`, candidateCsv(candidate), "text/csv");
    return;
  }
  if (presetId === "safety") {
    downloadText(`${baseName}.csv`, safetyCsv(simulation), "text/csv");
    return;
  }
  if (presetId === "assay") {
    downloadText(`${baseName}.md`, assayMarkdown(candidate, simulation), "text/markdown");
    return;
  }
  downloadText(`${baseName}.md`, memoMarkdown(candidate, simulation), "text/markdown");
}

function buildCandidateDossier(candidate, simulation) {
  return {
    candidate_id: candidate.id,
    target: candidate.target,
    scores: {
      platform_score: candidate.score,
      activity: candidate.activity,
      docking: candidate.docking,
      admet: candidate.admet,
      quantum: candidate.quantum,
      md: candidate.md,
      affinity: candidate.affinity,
      quantum_delta: candidate.quantumDelta,
    },
    structure: {
      smiles: candidate.smiles,
      image: candidate.structureImage,
      artifacts: artifactLinks(candidate),
    },
    simulation,
    limitations: [
      "Computational research hypothesis only.",
      "Not a treatment, diagnostic, clinical safety, or regulatory claim.",
      "Wet-lab binding, selectivity, ADMET, toxicity, and expert review are required.",
    ],
    raw: candidate.raw || null,
  };
}

function candidateCsv(candidate) {
  const rows = [
    ["candidate_id", "target", "platform_score", "activity", "docking", "admet", "quantum", "md", "affinity", "smiles"],
    [candidate.id, candidate.target, candidate.score, candidate.activity, candidate.docking, candidate.admet, candidate.quantum, candidate.md, candidate.affinity, candidate.smiles],
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function safetyCsv(simulation) {
  const rows = [["gene", "name", "system", "risk", "concern", "rationale"], ...simulation.rows.map((row) => [row.gene, row.name, row.system, row.risk, row.concern, row.rationale])];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function memoMarkdown(candidate, simulation) {
  return `# ${candidate.id} Research Dossier

Target: ${candidate.target}
Platform score: ${candidate.score.toFixed(3)}
Affinity: ${candidate.affinity}
Quantum delta: ${candidate.quantumDelta}

## Rationale
${candidate.rationale}

## Safety Simulation Summary
${simulation.summary}

## Top Liability Rows
${simulation.rows.slice(0, 8).map((row) => `- ${row.gene} (${row.risk}/100): ${row.concern}. ${row.rationale}`).join("\n")}

## Required Caution
Computational research hypothesis only. Not a treatment, diagnostic, clinical safety, or regulatory claim.
`;
}

function assayMarkdown(candidate, simulation) {
  return `# ${candidate.id} Assay Handoff Plan

## Primary Target
- Target: ${candidate.target}
- Candidate: ${candidate.id}
- Affinity: ${candidate.affinity}

## Recommended Assays
${simulation.assays.map((assay) => `- ${assay}`).join("\n")}

## Artifacts
${artifactLinks(candidate).map((item) => `- ${item.label}: ${item.url}`).join("\n") || "- No downloadable artifacts available."}

## Limitation
Use for research planning only. Confirm identity, purity, binding, selectivity, safety, and cellular phenotype experimentally.
`;
}

function artifactLinks(candidate) {
  return [
    ["2D PNG", candidate.structureImage],
    ["Ligand SDF", candidate.raw?.sdf_url],
    ["SMILES", candidate.raw?.smi_url],
    ["Docked SDF", candidate.raw?.docked_sdf_url],
    ["Vina docked SDF", candidate.raw?.vina_docked_sdf_url],
    ["Smina docked SDF", candidate.raw?.smina_docked_sdf_url],
    ["Vina PDBQT", candidate.raw?.vina_pose_pdbqt_url],
    ["Smina PDBQT", candidate.raw?.smina_pose_pdbqt_url],
    ["GNINA pose", candidate.raw?.gnina_pose_sdf_url],
    ["GNINA log", candidate.raw?.gnina_log_url],
    ["Vina log", candidate.raw?.vina_log_url],
    ["Smina log", candidate.raw?.smina_log_url],
  ]
    .filter(([, url]) => url)
    .map(([label, url]) => ({ label, url: apiUrl(url) }));
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 500);
}
