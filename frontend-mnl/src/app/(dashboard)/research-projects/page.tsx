"use client";

import React, { useState, useEffect } from "react";
import { 
  PageHeader, 
  ActionButtonGroup, 
  ActionButton, 
  ResearchProjectCard, 
  SectionHeader,
  EmptyState,
  StatusBadge,
  StatusType,
  FadeIn
} from "@/components/ui";
import { useRouter } from "next/navigation";
import { isDemoMode, apiClient } from "@/services/api";
import { showToast } from "@/utils/toast";

const MOCK_PROJECTS = [
  { 
    id: "egfr-nsclc",
    name: "EGFR NSCLC Discovery Program", 
    disease: "Lung Cancer",
    target: "EGFR (L858R)", 
    stage: "Lead Optimization",
    status: "running" as StatusType, 
    progress: 68, 
    candidates: { generated: 1240, filtered: 450 }, 
    lastRun: "2 mins ago",
    owner: "Dr. Sarah Chen",
    tags: ["Oncology", "Docking", "GNINA", "Active"]
  },
  { 
    id: "parp1-oncology",
    name: "PARP1 Oncology Program", 
    disease: "Breast/Ovarian",
    target: "PARP1 / DNA Repair", 
    stage: "Fragment Screening",
    status: "completed" as StatusType, 
    progress: 100, 
    candidates: { generated: 5600, filtered: 210 }, 
    lastRun: "4 hours ago",
    owner: "David Kim",
    tags: ["Oncology", "Quantum", "ADMET", "Completed"]
  },
  { 
    id: "pik3ca-screening",
    name: "PIK3CA Molecular Screening", 
    disease: "Multiple Solid Tumors",
    target: "PIK3CA (H1047R)", 
    stage: "Target Validation",
    status: "active" as StatusType, 
    progress: 12, 
    candidates: { generated: 8900, filtered: 1240 }, 
    lastRun: "1 day ago",
    owner: "Dr. Elena Rossi",
    tags: ["Oncology", "High-Throughput", "Active"]
  },
  { 
    id: "kras-exploratory",
    name: "KRAS G12D Exploratory Campaign", 
    disease: "Pancreatic Cancer",
    target: "KRAS G12D", 
    stage: "Hit Identification",
    status: "running" as StatusType, 
    progress: 42, 
    candidates: { generated: 12500, filtered: 890 }, 
    lastRun: "5 hours ago",
    owner: "Michael Wong",
    tags: ["Oncology", "GNINA", "Quantum", "Running"]
  },
  { 
    id: "brd4-epigenetic",
    name: "BRD4 Epigenetic Targeting", 
    disease: "Leukemia",
    target: "BRD4 Bromodomain", 
    stage: "Completed",
    status: "completed" as StatusType, 
    progress: 100, 
    candidates: { generated: 4500, filtered: 180 }, 
    lastRun: "3 days ago",
    owner: "Dr. Sarah Chen",
    tags: ["Oncology", "Epigenetics", "Completed"]
  },
  { 
    id: "cdk9-inhibitor",
    name: "CDK9 Inhibitor Design", 
    disease: "Lymphoma",
    target: "CDK9 / P-TEFb", 
    stage: "Lead Optimization",
    status: "warning" as StatusType, 
    progress: 85, 
    candidates: { generated: 2100, filtered: 95 }, 
    lastRun: "1 week ago",
    owner: "David Kim",
    tags: ["Oncology", "ADMET", "Warning"]
  },
];

const RECENT_ACTIVITY = [
  { id: 1, action: "GNINA rescoring completed", project: "EGFR NSCLC", time: "12 mins ago", type: "success" },
  { id: 2, action: "ADMET filter produced warnings", project: "CDK9 Inhibitor", time: "1 hour ago", type: "warning" },
  { id: 3, action: "Quantum reranking queued", project: "KRAS G12D", time: "3 hours ago", type: "info" },
  { id: 4, action: "Candidate dossier generated", project: "PARP1 Oncology", time: "5 hours ago", type: "success" },
  { id: 5, action: "Dataset uploaded", project: "PIK3CA Screening", time: "1 day ago", type: "info" },
];

export default function WorkspacePage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [diseaseFilter, setDiseaseFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const demoMode = isDemoMode();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDisease, setNewProjectDisease] = useState("Oncology");
  const [newProjectTarget, setNewProjectTarget] = useState("Genomics Target");

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      if (isDemoMode()) {
        setProjects(MOCK_PROJECTS);
        return;
      }
      const wsId = localStorage.getItem("active_workspace_id");
      if (!wsId) {
        setProjects([]);
        return;
      }
      const res = await apiClient.get<any>("/projects", { params: { workspace_id: wsId } });
      if (res.success && res.data && Array.isArray(res.data.items)) {
        // Map backend projects to UI cards props
        const mapped = res.data.items.map((proj: any) => ({
          id: proj.id,
          name: proj.name,
          disease: proj.disease_type || "General Oncology",
          target: proj.cancer_type || "Multiple Targets",
          stage: "Target Discovery",
          status: (proj.status === "active" ? "active" : proj.status) as StatusType,
          progress: 0,
          candidates: { generated: 0, filtered: 0 },
          lastRun: "Just initialized",
          owner: "Current User",
          tags: ["Active", "Target Discovery"]
        }));
        setProjects(mapped);
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = () => {
    const wsId = localStorage.getItem("active_workspace_id");
    if (!wsId) {
      showToast({
        type: "warning",
        title: "Workspace Required",
        message: "Select or create a workspace before starting a research project.",
      });
      return;
    }
    setIsCreateProjectOpen(true);
  };

  const handleCreateProjectSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const wsId = localStorage.getItem("active_workspace_id");
    if (!wsId) {
      showToast({
        type: "warning",
        title: "Workspace Required",
        message: "Select or create a workspace before starting a research project.",
      });
      return;
    }

    const name = newProjectName.trim();
    const disease = newProjectDisease.trim() || "Oncology";
    const target = newProjectTarget.trim() || "Genomics Target";
    if (!name) {
      showToast({
        type: "warning",
        title: "Project Name Required",
        message: "Give the research project a clear name before creating it.",
      });
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiClient.post<any>("/projects", {
        body: {
          workspace_id: wsId,
          name,
          description: `Research project targeting ${target} for ${disease}`,
          disease_type: disease,
          cancer_type: target
        }
      });
      if (res.success) {
        showToast({
          type: "success",
          title: "Project Created",
          message: `${name} is ready for discovery workflows.`,
        });
        setIsCreateProjectOpen(false);
        setNewProjectName("");
        setNewProjectDisease("Oncology");
        setNewProjectTarget("Genomics Target");
        await fetchProjects();
      } else {
        showToast({
          type: "error",
          title: "Create Failed",
          message: res.message || "The backend could not create this project.",
        });
      }
    } catch (err) {
      showToast({
        type: "error",
        title: "Create Failed",
        message: err instanceof Error ? err.message : "The backend could not create this project.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDemoDataset = async () => {
    const wsId = localStorage.getItem("active_workspace_id");
    if (!wsId) {
      showToast({
        type: "warning",
        title: "Workspace Required",
        message: "Select or create a workspace before loading the demo dataset.",
      });
      return;
    }
    try {
      setIsLoading(true);
      const res = await apiClient.post<any>("/projects", {
        body: {
          workspace_id: wsId,
          name: "EGFR Demo Program",
          description: "One-click preloaded demo for EGFR L858R.",
          disease_type: "Non-Small Cell Lung Cancer",
          cancer_type: "EGFR (L858R / T790M)"
        }
      });
      if (res.success && res.data) {
        // Automatically route to the new project and pass a query param to trigger preloading
        router.push(`/research-projects/${res.data.id || res.data.project_id}?loadDemo=true`);
      } else {
        showToast({
          type: "error",
          title: "Demo Load Failed",
          message: res.message || "The backend could not create the demo project.",
        });
      }
    } catch (err) {
      showToast({
        type: "error",
        title: "Demo Load Failed",
        message: err instanceof Error ? err.message : "The backend could not create the demo project.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const diseases = Array.from(new Set(projects.map(p => p.disease)));
  const statuses = ["all", "active", "running", "completed", "warning", "draft", "archived"];

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          project.target.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const matchesDisease = diseaseFilter === "all" || project.disease === diseaseFilter;
    return matchesSearch && matchesStatus && matchesDisease;
  });

  const statusCounts = projects.reduce(
    (acc, project) => {
      const status = String(project.status || "draft").toLowerCase();
      if (status === "running" || status === "active") acc.active += 1;
      if (status === "completed") acc.completed += 1;
      if (status === "warning" || status === "failed") acc.warning += 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, active: 0, completed: 0, warning: 0 }
  );
  const otherProjectCount = Math.max(
    statusCounts.total - statusCounts.active - statusCounts.completed - statusCounts.warning,
    0
  );
  const statusWidth = (count: number) =>
    statusCounts.total > 0 ? `${Math.round((count / statusCounts.total) * 100)}%` : "0%";
  const statusLabel = (count: number) => count.toString().padStart(2, "0");
  const dataSourceLabel = demoMode
    ? "MOCK DATA"
    : projects.length > 0
      ? "REAL BACKEND DATA"
      : "NO BACKEND PROJECTS";

  return (
    <FadeIn className="page-shell flex flex-col gap-8 pb-10">
      <PageHeader 
        title="Research Projects"
        breadcrumb="QuDrugForge™ / Research Projects"
        description="Manage target discovery, molecule generation, docking, quantum reranking, and validation workflows across oncology research programs."
        actions={
          <ActionButtonGroup>
            <ActionButton 
              label="Load Demo Dataset" 
              onClick={handleLoadDemoDataset} 
              disabled={isLoading} 
              variant="outline"
              className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
              icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} 
            />
            <ActionButton label="Import Dataset" icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>} />
            <ActionButton label="New Project" variant="primary" onClick={handleCreateProject} disabled={isLoading} icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>} />
          </ActionButtonGroup>
        }
      />

      {isCreateProjectOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/70 px-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateProjectSubmit}
            className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black tracking-tight text-text">New Research Project</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-muted-text/70">
                  Define the disease context and primary target before initializing the discovery workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateProjectOpen(false)}
                className="rounded-md border border-border px-2 py-1 text-xs font-black uppercase tracking-widest text-muted-text transition-colors hover:text-text"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Project Name</span>
                <input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="e.g. EGFR NSCLC Discovery Program"
                  className="h-11 w-full rounded-lg border border-border/50 bg-muted-bg px-3 text-sm font-medium text-text outline-none transition-colors focus:border-accent"
                  autoFocus
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Disease Indication</span>
                <input
                  value={newProjectDisease}
                  onChange={(event) => setNewProjectDisease(event.target.value)}
                  placeholder="e.g. Lung Cancer"
                  className="h-11 w-full rounded-lg border border-border/50 bg-muted-bg px-3 text-sm font-medium text-text outline-none transition-colors focus:border-accent"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Target Protein / Gene</span>
                <input
                  value={newProjectTarget}
                  onChange={(event) => setNewProjectTarget(event.target.value)}
                  placeholder="e.g. EGFR L858R"
                  className="h-11 w-full rounded-lg border border-border/50 bg-muted-bg px-3 text-sm font-medium text-text outline-none transition-colors focus:border-accent"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCreateProjectOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-[11px] font-black uppercase tracking-widest text-muted-text transition-colors hover:text-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-lg bg-accent px-4 py-2 text-[11px] font-black uppercase tracking-widest text-bg transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dynamic Data Provenance Badge */}
      <div className="flex items-center gap-2 px-6 py-2 bg-muted-bg border border-border/20 rounded-lg max-w-max animate-fade-in" data-testid="data-source-badge">
        <span className="text-[10px] font-bold text-muted-text/60 uppercase tracking-widest">Data Source:</span>
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
          isDemoMode() ? "bg-warning/20 text-warning" :
          projects.length > 0 ? "bg-accent/20 text-accent" : "bg-warning/20 text-warning"
        }`}>
          {dataSourceLabel}
        </span>
      </div>

      {/* Search and Filters */}
      <div className="ui-card-surface p-4 bg-surface-subtle/30 border-border/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-text/40">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
              type="text" 
              placeholder="Search by project name or target..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-border/40 bg-card pl-10 pr-4 text-[11px] font-medium focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg border border-border/40 bg-card px-3 text-[10px] font-black uppercase tracking-widest focus:border-accent focus:outline-none"
            >
              <option value="all">All Statuses</option>
              {statuses.filter(s => s !== "all").map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select 
              value={diseaseFilter}
              onChange={(e) => setDiseaseFilter(e.target.value)}
              className="h-10 rounded-lg border border-border/40 bg-card px-3 text-[10px] font-black uppercase tracking-widest focus:border-accent focus:outline-none"
            >
              <option value="all">All Diseases</option>
              {diseases.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button className="flex items-center gap-2 rounded-lg border border-border/40 bg-card px-4 text-[10px] font-black uppercase tracking-widest text-muted-text hover:text-text hover:border-border transition-all">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4.5h18m-18 5h18m-18 5h18m-18 5h18" /></svg>
              Advanced
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Active Research Programs */}
        <div className="lg:col-span-2 space-y-6">
          <SectionHeader 
            title="Active Research Programs" 
            description={`${filteredProjects.length} discovery programs matching your criteria.`} 
          />
          
          {filteredProjects.length === 0 ? (
            <EmptyState 
              title="No Projects Found"
              description="No research programs match your search or filter criteria."
              action={<ActionButton label="Clear Filters" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDiseaseFilter("all"); }} />}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredProjects.map((project) => (
                <ResearchProjectCard key={project.id} {...project} />
              ))}
              <div 
                onClick={handleCreateProject}
                className="ui-card-surface flex flex-col items-center justify-center gap-3 border-dashed border-border/60 bg-transparent p-12 text-muted-text/40 hover:border-accent/40 hover:text-accent transition-all cursor-pointer group min-h-[280px]"
              >
                <div className="h-12 w-12 rounded-full bg-surface-subtle flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="block text-[10px] font-black uppercase tracking-widest">New Research Project</span>
                  <span className="mt-1 block text-[9px] font-medium opacity-60">Initialize discovery pipeline</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Activity & Status Overview */}
        <div className="space-y-8">
          {/* Status Overview */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60">Project Status Overview</h4>
            <div className="ui-card-surface p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[24px] font-black text-text">{statusLabel(statusCounts.total)}</span>
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-muted-text/50">Total Programs</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[24px] font-black text-accent">{statusLabel(statusCounts.active)}</span>
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-muted-text/50">Active Now</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-muted-bg rounded-full overflow-hidden flex">
                <div className="h-full bg-accent" style={{ width: statusWidth(statusCounts.active) }} />
                <div className="h-full bg-success" style={{ width: statusWidth(statusCounts.completed) }} />
                <div className="h-full bg-warning" style={{ width: statusWidth(statusCounts.warning) }} />
                <div className="h-full bg-muted-text/20" style={{ width: statusWidth(otherProjectCount) }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <span className="text-[9px] font-bold uppercase text-muted-text/70">Running ({statusCounts.active})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-success" />
                  <span className="text-[9px] font-bold uppercase text-muted-text/70">Completed ({statusCounts.completed})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-warning" />
                  <span className="text-[9px] font-bold uppercase text-muted-text/70">Warning ({statusCounts.warning})</span>
                </div>
              </div>
            </div>
          </section>

          {/* Recent Project Activity */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60">Recent Project Activity</h4>
            <div className="ui-card-surface p-0 overflow-hidden">
              <div className="divide-y divide-border/40">
                {demoMode ? (
                  RECENT_ACTIVITY.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-surface-subtle/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-text/90 leading-tight">{item.action}</p>
                          <p className="text-[9px] font-medium text-muted-text/60 uppercase tracking-widest">
                            Project: <span className="text-accent/80">{item.project}</span>
                          </p>
                        </div>
                        <span className="text-[8px] font-black text-muted-text/40 uppercase whitespace-nowrap">{item.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4">
                    <p className="text-[11px] font-medium leading-relaxed text-muted-text/70">
                      Backend activity events will appear here after project pipeline runs are recorded.
                    </p>
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={!demoMode}
                className="w-full py-3 text-[9px] font-black uppercase tracking-widest text-muted-text hover:text-accent hover:bg-accent/5 transition-all border-t border-border/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {demoMode ? "View All Activity" : "No Activity Feed"}
              </button>
            </div>
          </section>

          {/* Create New Project CTA */}
          <div className="ui-card-surface p-6 bg-accent/5 border-accent/20 relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/5 blur-3xl group-hover:bg-accent/10 transition-all" />
            <h4 className="relative z-10 text-xs font-black uppercase tracking-widest text-accent">Initiate New Discovery</h4>
            <p className="relative z-10 mt-2 text-[11px] text-muted-text/80 leading-relaxed">
              Ready to start a new oncology program? Configure your target, select datasets, and initialize the quantum discovery pipeline.
            </p>
            <button
              type="button"
              onClick={handleCreateProject}
              disabled={isLoading}
              className="relative z-10 mt-4 flex items-center gap-2 rounded bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg hover:bg-accent/90 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Start New Program
            </button>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}

