"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ApiError,
  getDataset,
  getDatasets,
  getExperimentSummary,
  getRecentRuns,
  isDemoMode,
  apiClient,
} from "@/services/api";
import { useUiStore } from "@/store";
import type { RecentRun } from "@/types/api";
import {
  MetricCard,
  StatusBadge,
  PipelineStepper,
  ResearchProjectCard,
  CandidateCard,
  ExperimentTable,
  ReportCard,
  PageHeader,
  ActionButton,
  ActionButtonGroup,
  SectionHeader,
  FadeIn,
  EmptyState,
} from "@/components/ui";
import { DashboardPageSkeleton } from "@/components/shared/skeletons";
import { ApiErrorState } from "@/components/shared/states";
import { toFriendlyErrorMessage } from "@/services/api";

const ChartsSection = dynamic(() => import("@/components/dashboard/Charts"), {
  ssr: false,
  loading: () => <div className="h-64 rounded-xl animate-pulse bg-muted-bg/30 border border-border/20" />,
});

const AssistantWidget = dynamic(() => import("@/components/dashboard/AssistantWidget"), {
  ssr: false,
});

export default function DashboardPage() {
  const selectedDataset = useUiStore((s) => s.selectedDataset);
  const setSelectedDataset = useUiStore((s) => s.setSelectedDataset);
  const [reloadTick, setReloadTick] = useState(0);
  const [datasetNames, setDatasetNames] = useState<string[]>([]);
  const [totalDatasets, setTotalDatasets] = useState(0);
  const [totalMolecules, setTotalMolecules] = useState<number | null>(null);
  const [experimentCount, setExperimentCount] = useState<number | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [experimentsLoading, setExperimentsLoading] = useState(true);
  const [experimentsError, setExperimentsError] = useState<string | null>(null);
  const [recentRunsLoading, setRecentRunsLoading] = useState(true);
  const [recentRunsError, setRecentRunsError] = useState<string | null>(null);

  // Real Mode States
  const [realProjects, setRealProjects] = useState<any[]>([]);
  const [realMolecules, setRealMolecules] = useState<any[]>([]);
  const [realReports, setRealReports] = useState<any[]>([]);
  const [realExperiments, setRealExperiments] = useState<any[]>([]);

  const hasApiError = false;
  const dashboardError = error || experimentsError || recentRunsError;

  function handleRetry() {
    setReloadTick((prev) => prev + 1);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setExperimentsLoading(true);
    setExperimentsError(null);
    setRecentRunsLoading(true);
    setRecentRunsError(null);

    getDatasets()
      .then(async (data) => {
        if (!active) return;
        setDatasetNames(data.datasets);
        setTotalDatasets(data.count);

        const resolvedDataset =
          selectedDataset && data.datasets.includes(selectedDataset)
            ? selectedDataset
            : data.datasets[0] ?? null;
        
        if (resolvedDataset && resolvedDataset !== selectedDataset) {
          setSelectedDataset(resolvedDataset);
        }

        if (resolvedDataset) {
          const datasetDetails = await getDataset(resolvedDataset);
          if (active) setTotalMolecules(datasetDetails.count);
        }
      })
      .catch((err) => {
        if (active) {
          setError(toFriendlyErrorMessage(err, "Dataset data is temporarily unavailable."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    getExperimentSummary()
      .then((data) => {
        if (active) {
          setExperimentCount(data.experiment_count);
          setExperimentsLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setExperimentsError(toFriendlyErrorMessage(err, "Experiment metrics are not available."));
          setExperimentsLoading(false);
        }
      });

    getRecentRuns(10)
      .then((data) => {
        if (active) {
          setRecentRuns(data.items ?? []);
          setRecentRunsLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setRecentRunsError(toFriendlyErrorMessage(err, "Recent activity could not be loaded."));
          setRecentRunsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedDataset, reloadTick, setSelectedDataset]);

  useEffect(() => {
    if (isDemoMode()) return;

    const fetchRealDashboardData = async () => {
      const warnRecoverable = (context: string, err: unknown) => {
        if (err instanceof ApiError && (err.status === 404 || err.status === 408)) {
          console.warn(`Dashboard ${context} is unavailable:`, toFriendlyErrorMessage(err));
          return true;
        }
        return false;
      };

      const wsId = localStorage.getItem("active_workspace_id");
      let projectList: any[] = [];

      if (wsId) {
        try {
          const res = await apiClient.get<any>("/projects", { params: { workspace_id: wsId } });
          if (res.success && res.data && Array.isArray(res.data.items)) {
            projectList = res.data.items;
            const mapped = res.data.items.map((proj: any) => ({
              id: proj.id,
              name: proj.name,
              disease: proj.disease_type || "General Oncology",
              target: proj.cancer_type || "Multiple Targets",
              stage: "Target Discovery",
              status: (proj.status === "active" ? "active" : proj.status) as any,
              progress: 0,
              candidates: { generated: 0, filtered: 0 },
              lastRun: "Just initialized",
              owner: "Current User",
              tags: ["Active", "Target Discovery"],
            }));
            setRealProjects(mapped);
          }
        } catch (err) {
          if (!warnRecoverable("workspace project list", err)) {
            console.warn("Failed to load real dashboard workspace data:", err);
          }
        }
      }

      const storedProjectId = localStorage.getItem("active_project_id");
      const selectedProjectId =
        storedProjectId && projectList.some((project: any) => project.id === storedProjectId)
          ? storedProjectId
          : projectList[0]?.id ?? storedProjectId;

      if (selectedProjectId && selectedProjectId !== storedProjectId && projectList.length > 0) {
        localStorage.setItem("active_project_id", selectedProjectId);
        const selectedProject = projectList.find((project: any) => project.id === selectedProjectId);
        if (selectedProject?.name) {
          localStorage.setItem("active_project_name", selectedProject.name);
        }
      }

      if (!selectedProjectId) {
        return;
      }

      if (!projectList.length && storedProjectId) {
        try {
          await apiClient.get<any>(`/projects/${storedProjectId}`);
        } catch (err) {
          if (warnRecoverable("selected project", err)) {
            localStorage.removeItem("active_project_id");
            localStorage.removeItem("active_project_name");
            return;
          }
          console.warn("Failed to validate the active project for the dashboard:", err);
          return;
        }
      }

      const [molRes, repRes, expRes] = await Promise.allSettled([
        apiClient.get<any>(`/projects/${selectedProjectId}/molecules`),
        apiClient.get<any>(`/projects/${selectedProjectId}/reports`),
        apiClient.get<any>(`/projects/${selectedProjectId}/experiments`),
      ]);

      if (molRes.status === "fulfilled" && molRes.value.success && molRes.value.data && Array.isArray(molRes.value.data.items)) {
        setRealMolecules(molRes.value.data.items);
      } else if (molRes.status === "rejected" && warnRecoverable("project molecule list", molRes.reason)) {
        localStorage.removeItem("active_project_id");
        localStorage.removeItem("active_project_name");
      } else if (molRes.status === "rejected") {
        console.warn("Failed to load real dashboard molecule data:", molRes.reason);
      }

      if (repRes.status === "fulfilled" && repRes.value.success && repRes.value.data && Array.isArray(repRes.value.data.items)) {
        setRealReports(repRes.value.data.items);
      } else if (repRes.status === "rejected" && !warnRecoverable("project reports", repRes.reason)) {
        console.warn("Failed to load real dashboard report data:", repRes.reason);
      }

      if (expRes.status === "fulfilled" && expRes.value.success && expRes.value.data && Array.isArray(expRes.value.data.items)) {
        setRealExperiments(expRes.value.data.items);
      } else if (expRes.status === "rejected" && !warnRecoverable("project experiments", expRes.reason)) {
        console.warn("Failed to load real dashboard experiment data:", expRes.reason);
      }
    };

    fetchRealDashboardData();
  }, [reloadTick]);

  if (loading) return <DashboardPageSkeleton />;

  if (hasApiError && !loading) {
    return (
      <div className="page-shell">
        <ApiErrorState
          error={dashboardError}
          onRetry={handleRetry}
          title="Dashboard System Offline"
          fallbackMessage="The research intelligence systems are currently undergoing maintenance."
        />
      </div>
    );
  }

  const activeProjectName = typeof window !== "undefined" ? localStorage.getItem("active_project_name") : null;
  const activeWorkspaceName = typeof window !== "undefined" ? localStorage.getItem("active_workspace_name") : null;

  return (
    <FadeIn className="page-shell flex flex-col gap-8 pb-10">
      {/* 1. PAGE HEADER */}
      <PageHeader 
        title={isDemoMode() ? "EGFR NSCLC Discovery Program" : (activeProjectName || "Scientific Discovery Program")}
        breadcrumb={isDemoMode() ? "Oncology Research Workspace / Docking & Quantum Reranking" : `${activeWorkspaceName || "Research Workspace"} / Program Workspace`}
        description={isDemoMode() 
          ? "High-throughput screening and quantum-mechanical rescoring of covalent inhibitors targeting EGFR T790M/L858R mutants in non-small cell lung cancer."
          : "Coordinate molecular generation, virtual docking, quantum rescoring, and validation pipelines for target candidates."
        }
        dataSource={isDemoMode() ? "mock" : (realProjects.length > 0 ? "real" : "missing")}
        actions={
          <ActionButtonGroup>
            <ActionButton label="New Project" icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>} />
            <ActionButton label="Upload Dataset" icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>} />
            <ActionButton label="Run Pipeline" variant="primary" icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          </ActionButtonGroup>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* 2. ACTIVE RESEARCH PROGRAMS */}
          <section className="space-y-4">
            <SectionHeader 
              title="Active Research Programs" 
              action={<Link href="/research-projects" className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline">View All Programs</Link>}
            />
            {isDemoMode() ? (
              <div className="grid gap-4 md:grid-cols-2">
                <ResearchProjectCard 
                  id="egfr-nsclc"
                  name="EGFR NSCLC Discovery"
                  disease="Lung Cancer"
                  target="EGFR (L858R)"
                  stage="Lead Optimization"
                  status="running"
                  candidates={{ generated: 1240, filtered: 450 }}
                  lastRun="2 mins ago"
                  owner="Dr. Sarah Chen"
                  tags={["Oncology", "Active"]}
                  progress={68}
                />
                <ResearchProjectCard 
                  id="parp1-oncology"
                  name="PARP1 Oncology Program"
                  disease="Breast/Ovarian"
                  target="PARP1"
                  stage="Fragment Screening"
                  status="completed"
                  candidates={{ generated: 450, filtered: 120 }}
                  lastRun="4 hours ago"
                  owner="David Kim"
                  tags={["Oncology", "Completed"]}
                  progress={100}
                />
                <ResearchProjectCard 
                  id="pik3ca-screening"
                  name="PIK3CA Molecular Screening"
                  disease="Solid Tumors"
                  target="PIK3CA"
                  stage="Target Validation"
                  status="pending"
                  candidates={{ generated: 8900, filtered: 1240 }}
                  lastRun="1 day ago"
                  owner="Dr. Elena Rossi"
                  tags={["Oncology", "Pending"]}
                  progress={12}
                />
                <div className="ui-card-surface flex flex-col items-center justify-center gap-2 border-dashed border-border/60 bg-transparent p-5 text-muted-text/40 hover:border-accent/40 hover:text-accent transition-all cursor-pointer">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">Create New Program</span>
                </div>
              </div>
            ) : realProjects.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {realProjects.map((project) => (
                  <ResearchProjectCard key={project.id} {...project} />
                ))}
              </div>
            ) : (
              <EmptyState 
                title="No Active Projects Found"
                description="This workspace doesn't have any research projects yet. Create one to start running discovery pipelines."
                action={
                  <button className="flex items-center gap-2 rounded bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg hover:bg-accent/90 transition-all">
                    Initialize Project
                  </button>
                }
              />
            )}
          </section>

          {/* 3. PIPELINE STATUS */}
          {isDemoMode() && (
            <section className="space-y-4">
              <PipelineStepper 
                steps={[
                  { label: "Input Data", status: "completed", description: "SMILES/SDF Ingest" },
                  { label: "Target Ranking", status: "completed", description: "Bio-activity score" },
                  { label: "Molecule Generation", status: "completed", description: "Transformer-based" },
                  { label: "ADMET Filtering", status: "completed", description: "SwissADME engine" },
                  { label: "Docking", status: "completed", description: "AutoDock Vina" },
                  { label: "GNINA Rescoring", status: "running", description: "CNN-based scoring" },
                  { label: "Quantum Reranking", status: "queued", description: "DFT-level refinement" },
                  { label: "Report Generation", status: "queued", description: "Validation dossier" },
                ]}
              />
            </section>
          )}

          {/* 5. CANDIDATE SNAPSHOT */}
          <section className="space-y-4">
            <SectionHeader 
              title="Top Lead Candidates"
              description="Highest confidence molecular leads prioritized by quantum reranking scores."
              action={<button className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline">Full Analytics</button>}
            />
            {isDemoMode() ? (
              <div className="grid gap-4 md:grid-cols-2">
                <CandidateCard id="QU-7721-X" target="EGFR (L858R)" dockingScore={-11.4} admetRisk="Low" quantumRank={1} noveltyScore={0.88} />
                <CandidateCard id="QU-7745-B" target="EGFR (L858R)" dockingScore={-10.9} admetRisk="Low" quantumRank={2} noveltyScore={0.72} />
              </div>
            ) : realMolecules.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {realMolecules.slice(0, 4).map((mol, idx) => (
                  <CandidateCard 
                    key={mol.id || mol.compound_id}
                    id={mol.compound_id || mol.id || "CANDIDATE"}
                    target={mol.target_id || "EGFR WT"}
                    dockingScore={mol.docking_score || -8.5}
                    admetRisk={mol.admet_risk || "Low"}
                    quantumRank={idx + 1}
                    noveltyScore={mol.qed || 0.75}
                  />
                ))}
              </div>
            ) : (
              <EmptyState 
                title="No Lead Candidates Found"
                description="Run molecule generation and docking pipelines to prioritize potent binders."
              />
            )}
          </section>
        </div>

        <div className="space-y-8">
          {/* 4. COMPUTE OVERVIEW */}
          {isDemoMode() && (
            <section className="space-y-4">
              <SectionHeader title="Compute Overview" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <MetricCard 
                  label="GPU Utilization"
                  value="94"
                  unit="%"
                  trend={{ value: 12, isUp: true }}
                  helperText="8x NVIDIA H100 Active"
                  icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>}
                />
                <MetricCard 
                  label="GNINA Queue"
                  value="1,420"
                  unit="mol"
                  helperText="Estimated time: 42m"
                  icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
                <MetricCard 
                  label="Quantum Jobs"
                  value="12"
                  unit="active"
                  trend={{ value: 5, isUp: false }}
                  helperText="Rigetti Aspen-M-3"
                  icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707" /></svg>}
                />
              </div>
            </section>
          )}

          {/* 8. PHARMA LLM ASSISTANT WIDGET */}
          <AssistantWidget />

          {/* 7. RECENT REPORTS */}
          <section className="space-y-4">
            <SectionHeader 
              title="Recent Reports" 
              action={<button className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline">Archive</button>}
            />
            {isDemoMode() ? (
              <div className="flex flex-col gap-3">
                <ReportCard name="Candidate Dossier: QU-7721" type="Dossier" date="May 16, 2026" size="4.2 MB" />
                <ReportCard name="EGFR Docking Summary" type="Analysis" date="May 15, 2026" size="12.8 MB" />
                <ReportCard name="ADMET Risk Assessment" type="Validation" date="May 14, 2026" size="1.1 MB" />
              </div>
            ) : realReports.length > 0 ? (
              <div className="flex flex-col gap-3">
                {realReports.slice(0, 3).map((rep) => (
                  <ReportCard 
                    key={rep.id} 
                    name={rep.title || "Report"} 
                    type={rep.report_type === "candidate_dossier" ? "Dossier" : "Summary"} 
                    date={new Date(rep.created_at).toLocaleDateString()} 
                    size={rep.file_size ? `${(rep.file_size / 1024 / 1024).toFixed(1)} MB` : "N/A"} 
                  />
                ))}
              </div>
            ) : (
              <EmptyState 
                title="No Reports Generated"
                description="Ready to consolidate scientific discoveries? Go to the Reports tab to generate standard validation files."
              />
            )}
          </section>
        </div>
      </div>

      {/* 6. RECENT EXPERIMENTS */}
      <section className="space-y-4">
        <SectionHeader 
          title="Global Experiment Log" 
          action={<button className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline">View Full Log</button>}
        />
        {isDemoMode() ? (
          <ExperimentTable 
            experiments={[
              { name: "EGFR_HTS_Run_042", type: "Virtual Screening", status: "completed", runtime: "4h 12m", owner: "Sarah Chen", updatedAt: "2h ago" },
              { name: "L858R_Quantum_Refinement", type: "QM/MM", status: "running", runtime: "12h 45m", owner: "David Kim", updatedAt: "Just now" },
              { name: "Covalent_Docking_T790M", type: "Docking", status: "completed", runtime: "8h 20m", owner: "Sarah Chen", updatedAt: "5h ago" },
              { name: "ADMET_Batch_Oncology_01", type: "Validation", status: "failed", runtime: "0h 05m", owner: "System", updatedAt: "1h ago" },
              { name: "GNINA_Rescoring_Main", type: "Rescoring", status: "running", runtime: "2h 30m", owner: "AutoPilot", updatedAt: "10m ago" },
            ]}
          />
        ) : realExperiments.length > 0 ? (
          <ExperimentTable 
            experiments={realExperiments.map((exp: any) => ({
              name: exp.name || exp.id,
              type: exp.run_type || "Pipeline Step",
              status: exp.status || "completed",
              runtime: exp.metadata?.runtime || "N/A",
              owner: exp.metadata?.created_by || "User",
              updatedAt: new Date(exp.updated_at || exp.created_at).toLocaleDateString()
            }))}
          />
        ) : (
          <EmptyState 
            title="No Experiment Logs Found"
            description="All scheduled pipeline executions, parameters, and cluster run states will appear here once started."
          />
        )}
      </section>

      {/* Charts Section */}
      <section className="space-y-4">
        <SectionHeader title="Molecular Property Distributions" description="Aggregated chemical space metrics for the current screening batch." />
        <ChartsSection />
      </section>
    </FadeIn>
  );
}
