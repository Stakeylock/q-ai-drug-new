import { useEffect, useRef, useState } from "react";
import {
  addProjectTarget,
  analyzeProteinWithEsm2,
  apiUrl,
  assistantChat,
  assistantStatus,
  billingSummary,
  createProject,
  dockPreviewMolecule,
  fetchTools,
  fetchTopCandidates,
  login,
  setBillingPlan,
  signup,
  startDryRun,
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
  PIPELINE_STAGES,
  REACTBITS_EFFECTS,
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
  useDocumentTier,
} from "./effects.jsx";

const SESSION_KEY = "qai_user_front_session";
const COPILOT_HISTORY_KEY = "qdf_copilot_history";
const RAIL_COLLAPSED_KEY = "qdf_rail_collapsed";

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
    warning: "",
  });
  const [tools, setTools] = useState(null);
  const [billingWarning, setBillingWarning] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState("discovery");
  const [customMolecules, setCustomMolecules] = useState([]);
  const [railCollapsed, setRailCollapsed] = useState(() => window.localStorage.getItem(RAIL_COLLAPSED_KEY) === "1");

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

  useDocumentTier(tier);

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
    setRun({ status: "idle", activeStage: -1, progress: 0, logs: [], candidates: [], project: null, backendJob: null, warning: "" });
  }

  function updatePatient(field, value) {
    setPatient((current) => ({ ...current, [field]: value }));
  }

  function changeDiagnosis(diagnosisId) {
    setPatient((current) => ({ ...current, diagnosis: diagnosisId }));
    const nextProteins = ALPHAFOLD_REPOSITORY.filter((protein) => protein.diagnosisId === diagnosisId)
      .slice(0, Math.min(3, tierConfig.maxProteins))
      .map((protein) => protein.id);
    setSelectedProteinIds(nextProteins);
    setSearch("");
  }

  function toggleProtein(protein) {
    setSelectedProteinIds((current) => {
      if (current.includes(protein.id)) return current.filter((id) => id !== protein.id);
      if (current.length >= tierConfig.maxProteins) return current;
      return [...current, protein.id];
    });
  }

  function autoSelectProteins() {
    const ranked = diagnosisProteins
      .map((protein) => ({ protein, score: scoreProteinForPatient(protein, patient) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(tierConfig.maxProteins, diagnosisProteins.length))
      .map((item) => item.protein.id);
    setSelectedProteinIds(ranked);
  }

  async function startPipeline() {
    if (!selectedProteins.length) {
      setRun((current) => ({ ...current, warning: "Select at least one AlphaFold protein before starting the pipeline." }));
      return;
    }
    setRun({
      status: "running",
      activeStage: 0,
      progress: 3,
      logs: ["Pipeline started with de-identified patient context."],
      candidates: [],
      project: null,
      backendJob: null,
      warning: "",
    });

    let project = null;
    let backendJob = null;
    let warning = "";
    if (session?.token && !session.demo) {
      try {
        project = await createProject(session.token, {
          name: `${patient.caseId || "case"}_${diagnosis.short}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
        });
        for (const protein of selectedProteins) {
          await addProjectTarget(session.token, project.id, protein, patient);
        }
        backendJob = await startDryRun(session.token, project.id, tier);
      } catch (error) {
        warning = `Backend patient-run bridge fell back to local orchestration: ${error.message}`;
      }
    } else {
      warning = "Demo mode: pipeline stages are simulated and candidates are ranked from cached research outputs.";
    }

    for (let index = 0; index < PIPELINE_STAGES.length; index += 1) {
      await wait(430 + index * 60);
      const stage = PIPELINE_STAGES[index];
      setRun((current) => ({
        ...current,
        activeStage: index,
        progress: Math.round(((index + 1) / PIPELINE_STAGES.length) * 82),
        logs: [...current.logs, `${stage.label}: ${stage.detail}`],
        project,
        backendJob,
        warning,
      }));
    }

    let rawCandidates = [];
    try {
      rawCandidates = await fetchTopCandidates(120);
    } catch (error) {
      warning = `${warning ? `${warning} ` : ""}Candidate API unavailable, using local synthetic candidate ranking: ${error.message}`;
    }
    const candidates = rankCandidates(rawCandidates || [], selectedProteins, patient, tierConfig.maxCandidates);
    await wait(360);
    setRun((current) => ({
      ...current,
      status: "complete",
      progress: 100,
      candidates,
      warning,
      logs: [...current.logs, `Candidate dossier complete with ${candidates.length} ranked computational hypotheses.`],
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
        <section className="need-panel compact">
          <span className="eyebrow">ReactBits-style motion</span>
          {REACTBITS_EFFECTS.slice(0, 6).map((effect) => (
            <div className="need-item" key={effect}>
              <span />
              {effect}
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
        {workspaceTab === "molecules" && <CandidateResults run={run} customMolecules={customMolecules} />}
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
        <div className="auth-effects-row">
          {REACTBITS_EFFECTS.map((effect, index) => (
            <span key={effect} style={{ "--reveal-delay": `${index * 0.03}s` }}>
              {effect}
            </span>
          ))}
        </div>
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
      <span className="eyebrow">Tier theme and permissions</span>
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
  const starters = [...ORGANIC_STARTERS, ...INORGANIC_STARTERS];
  const filteredElements = ELEMENTS.filter((symbol) => symbol.toLowerCase().includes(elementQuery.toLowerCase()));
  const selectedStarterObjects = starters.filter((starter) => selectedStarters.includes(starter.name));

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
              <MagnetButton className="primary" type="button" onClick={addToWorkbench} disabled={dockBusy}>
                {dockBusy ? "Preparing pose..." : "Dock preview and send"}
              </MagnetButton>
            </div>
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
      {benchTab === "test" && <ChemistryTestResult result={benchResult} testMolecule={testMolecule} addToWorkbench={addToWorkbench} dockBusy={dockBusy} dockStatus={dockStatus} dockError={dockError} />}
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

function ChemistryTestResult({ result, testMolecule, addToWorkbench, dockBusy, dockStatus, dockError }) {
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
        {run.backendJob && <span>Dry run: {run.backendJob.status}</span>}
      </div>
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

function CandidateResults({ run, customMolecules = [] }) {
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
        <CandidateDetail candidate={selected} tab={tab} setTab={setTab} />
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
    assistantStatus()
      .then((payload) => {
        if (!cancelled) setStatus(payload);
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
          <p className="eyebrow">Google AI Studio + NVIDIA ESM2</p>
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
              Copilot chat 
            </p>
            <div className="provider-status-grid">
              <Metric label="Chat" value={status?.chat_configured ? status.chat_model || "Google ready" : "Set Google key"} />
              <Metric label="Protein AI" value={status?.esm2_configured ? status.esm2_model || "NVIDIA ESM2" : "Set NVIDIA key"} />
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
  const tool = RESEARCH_TOOLKIT.find((item) => item.id === activeTool) || RESEARCH_TOOLKIT[0];
  const toolPayload = buildResearchToolPayload(tool.id, { patient, selectedProteins, run, customMolecules, notes });

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
    </SpotlightCard>
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

function CandidateDetail({ candidate, tab, setTab }) {
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
          <small>{candidate.smiles || "No SMILES string available"}</small>
        </div>
        <span className="evidence-pill">{candidate.realEvidence ? "Real evidence" : "Synthetic preview"}</span>
      </div>
      <div className="detail-tabs">
        {tabs.map((item) => (
          <button className={tab === item ? "active" : ""} type="button" key={item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {tab === "structure" && <StructureTab candidate={candidate} />}
      {tab === "docking" && <DockingTab candidate={candidate} />}
      {tab === "procedure" && <ProcedureTab candidate={candidate} />}
      {tab === "quantum" && <QuantumTab candidate={candidate} />}
      {tab === "admet" && <AdmetTab candidate={candidate} />}
      {tab === "simulation" && <SimulationTab candidate={candidate} />}
      {tab === "export" && <ExportTab candidate={candidate} />}
      {tab === "artifacts" && <ArtifactsTab candidate={candidate} />}
    </article>
  );
}

function StructureTab({ candidate }) {
  const [viewMode, setViewMode] = useState("3d");
  const [poseSourceId, setPoseSourceId] = useState(candidate.raw?.default_pose_source || candidate.raw?.pose_sources?.[0]?.id || "conformer");
  const [viewerOptions, setViewerOptions] = useState({
    receptor: true,
    surface: true,
    cartoon: true,
    spheres: false,
  });
  const poseSources = candidate.raw?.pose_sources || [];

  useEffect(() => {
    setPoseSourceId(candidate.raw?.default_pose_source || candidate.raw?.pose_sources?.[0]?.id || "conformer");
  }, [candidate.id]);

  function toggleOption(key) {
    setViewerOptions((current) => ({ ...current, [key]: !current[key] }));
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
        <code>{candidate.smiles || "Not available"}</code>
      </div>
    </div>
  );
}

function Molecule3DViewer({ candidate, poseSourceId, options }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [status, setStatus] = useState("Loading 3D viewer...");
  const raw = candidate.raw || {};
  const poseSources = raw.pose_sources || [];
  const source =
    poseSources.find((item) => item.id === poseSourceId) ||
    poseSources.find((item) => item.id === raw.default_pose_source) ||
    poseSources[0] ||
    { id: "conformer", label: "Generated conformer", url: raw.sdf_url };
  const receptorUrl = source?.receptor_url || raw.gnina_receptor_url || raw.receptor_url || `/structures/${candidate.target}_alphafold.pdb`;
  const ligandUrl = source?.url || raw.docked_sdf_url || raw.sdf_url;

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
        const viewer = viewerInstanceRef.current || window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: "#07111f" });
        viewerInstanceRef.current = viewer;
        viewer.clear();
        if (receptorText) {
          viewer.addModel(receptorText, "pdb");
          if (options.cartoon) {
            viewer.setStyle({ model: 0 }, { cartoon: { color: "spectrum" } });
          } else {
            viewer.setStyle({ model: 0 }, { line: { color: "#9fb8c9", linewidth: 1.2 } });
          }
          if (options.surface) {
            viewer.addSurface(window.$3Dmol.SurfaceType.VDW, { opacity: 0.16, color: "#4fd1c5" }, { model: 0 });
          }
        }
        viewer.addModel(ligandText, "sdf");
        const ligandModel = receptorText ? 1 : 0;
        const ligandStyle = options.spheres
          ? { sphere: { scale: 0.33, colorscheme: "greenCarbon" }, stick: { radius: 0.16, colorscheme: "greenCarbon" } }
          : { stick: { radius: 0.25, colorscheme: "greenCarbon" } };
        viewer.setStyle({ model: ligandModel }, ligandStyle);
        viewer.zoomTo();
        viewer.render();
        setStatus(`${source?.label || "Pose"} loaded${receptorText ? " with receptor context" : " as ligand-only pose"}.`);
      } catch (error) {
        setStatus(error.message);
      }
    }
    renderViewer();
    return () => {
      cancelled = true;
    };
  }, [candidate.id, ligandUrl, receptorUrl, source?.label, options.receptor, options.surface, options.cartoon, options.spheres]);

  return (
    <div className="viewer3d-shell">
      <div className="viewer3d" ref={viewerRef} />
      <div className="viewer3d-status">{status}</div>
    </div>
  );
}

function DockingTab({ candidate }) {
  const raw = candidate.raw || {};
  return (
    <div className="detail-body">
      <div className="metric-mosaic">
        <Metric label="Binding class" value={raw.binding_class || "review"} />
        <Metric label="Vina affinity" value={formatAffinity(raw.vina_affinity_kcal_mol ?? raw.affinity_kcal_mol)} />
        <Metric label="Smina affinity" value={formatAffinity(raw.smina_affinity_kcal_mol)} />
        <Metric label="GNINA affinity" value={formatAffinity(raw.gnina_affinity_kcal_mol)} />
        <Metric label="GNINA CNN pose" value={fmtMaybe(raw.gnina_cnn_pose_score, 3)} />
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
    </div>
  );
}

function ProcedureTab({ candidate }) {
  const raw = candidate.raw || {};
  const steps = [
    ["1", "Target and pocket selection", raw.pocket_provenance_note || "Select target receptor and binding-site hypothesis."],
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
    ["Vina PDBQT", candidate.raw?.vina_pose_pdbqt_url],
    ["Smina PDBQT", candidate.raw?.smina_pose_pdbqt_url],
    ["GNINA pose", candidate.raw?.gnina_pose_sdf_url],
    ["GNINA log", candidate.raw?.gnina_log_url],
    ["Receptor PDBQT", candidate.raw?.receptor_pdbqt_url],
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

function rankCandidates(rawCandidates, selectedProteins, patient, limit) {
  const selectedGenes = selectedProteins.map((protein) => protein.gene.toUpperCase());
  const fromBackend = rawCandidates
    .filter((candidate) => selectedGenes.includes(String(candidate.target_id || "").toUpperCase()))
    .map((candidate) => normalizeBackendCandidate(candidate));
  const pool = fromBackend.length ? fromBackend : synthesizeCandidates(selectedProteins, patient);
  return pool.sort((a, b) => b.score - a.score).slice(0, limit);
}

function normalizeBackendCandidate(candidate) {
  const affinity = numeric(candidate.affinity_kcal_mol ?? candidate.vina_affinity_kcal_mol, null);
  const quantumDelta = numeric(candidate.quantum_ablation_delta ?? candidate.quantum_delta, null);
  const realEvidence = Boolean(candidate.docking_is_real || candidate.pose_sources?.some((source) => source.method_tier === "REAL"));
  return {
    id: candidate.candidate_id || `${candidate.target_id}-candidate`,
    target: candidate.target_id || "Target",
    score: numeric(candidate.final_score, 0.6),
    activity: numeric(candidate.activity_component ?? candidate.activity_score, 0.5),
    docking: numeric(candidate.docking_component, normalizeDockingScore(affinity)),
    admet: numeric(candidate.admet_component ?? candidate.admet_score, 0.5),
    quantum: numeric(candidate.late_stage_quantum_component ?? candidate.quantum_component ?? candidate.qml_score, 0.5),
    md: numeric(candidate.md_component, candidate.stability_class === "stable" ? 0.9 : 0.5),
    affinity: affinity !== null ? `${affinity.toFixed(2)} kcal/mol` : "review",
    affinityValue: affinity,
    quantumDelta: quantumDelta !== null ? quantumDelta.toFixed(3) : "cached",
    quantumDeltaValue: quantumDelta,
    smiles: candidate.canonical_smiles || candidate.smiles || candidate.smiles_qm || "",
    structureImage: candidate.png_url,
    realEvidence,
    rationale: `${candidate.binding_class || "Ranked"} candidate from ${candidate.source || "platform evidence"} using ${candidate.docking_mode || "computational screening"}.`,
    tags: [
      candidate.pose_method_tier || (realEvidence ? "real pose" : "preview"),
      candidate.pocket_method_tier || "pocket review",
      candidate.filter_pass === false ? "filter issue" : "filter pass",
      candidate.gnina_status === "completed" ? "GNINA" : "Vina/Smina",
    ],
    raw: candidate,
  };
}

function synthesizeCandidates(selectedProteins, patient) {
  const chemistryModes = ["ATP-pocket analog", "allosteric probe", "covalent-warhead review", "fragment elaboration", "macrocycle review"];
  return selectedProteins.flatMap((protein, proteinIndex) =>
    Array.from({ length: 5 }).map((_, index) => {
      const fit = scoreProteinForPatient(protein, patient);
      const score = Math.min(0.98, 0.48 + fit / 210 + (5 - index) * 0.032 - proteinIndex * 0.012);
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
        smiles: "Synthetic preview - launch backend generation for structure",
        structureImage: "",
        realEvidence: false,
        rationale: `${chemistryModes[(index + proteinIndex) % chemistryModes.length]} prioritized for ${protein.role.toLowerCase()} with patient-context fit ${fit}.`,
        tags: [protein.family, protein.alphafoldId, "synthetic ranking"],
        raw: {
          binding_class: "synthetic preview",
          docking_note: "This is a local preview because no backend candidate matched the selected patient-informed target set.",
          pocket_source: "AlphaFold target hypothesis",
          pocket_pdb_id: protein.alphafoldId,
          reference_ligand: "to be selected",
          admet_score: Math.min(0.9, 0.55 + (5 - index) * 0.045),
          quantum_score: Math.min(0.88, 0.44 + score / 2.8),
        },
      };
    }),
  );
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
  const raw = { ...(candidate.raw || {}), ...preview.raw };
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
    tags: unique([...(candidate.tags || []), "RDKit 3D pose", "pocket preview", raw.pocket_method_tier].filter(Boolean)),
    raw,
  };
  merged.score = weightedCandidateScore(merged, { activity: 25, docking: 25, admet: 20, quantum: 20, md: 10 });
  return merged;
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
  };
}

function buildResearchToolPayload(toolId, { patient, selectedProteins, run, customMolecules, notes }) {
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
  return Math.max(0, Math.min(1, weighted / total));
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
    ["Vina PDBQT", candidate.raw?.vina_pose_pdbqt_url],
    ["Smina PDBQT", candidate.raw?.smina_pose_pdbqt_url],
    ["GNINA pose", candidate.raw?.gnina_pose_sdf_url],
    ["GNINA log", candidate.raw?.gnina_log_url],
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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
