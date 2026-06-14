"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AuthCard, AuthHeader, AuthStatusMessage } from "../_components";
import { apiClient, toFriendlyErrorMessage } from "@/services";

type Workspace = {
  id: string;
  name: string;
  organization: string;
  projects: number;
  members: number;
  lastActive: string;
  status: "Active" | "Sandbox";
};

type RecentProject = {
  name: string;
  diseaseArea: string;
  stage: string;
  status: "Active" | "Idle" | "Completed";
  lastUpdated: string;
};

const STATIC_WORKSPACES: Workspace[] = [
  {
    id: "oncology",
    name: "Oncology Research Workspace",
    organization: "Quinfosys Research Division",
    projects: 4,
    members: 12,
    lastActive: "10m ago",
    status: "Active",
  },
  {
    id: "academic",
    name: "Academic Collaboration Lab",
    organization: "University Partner Program",
    projects: 2,
    members: 6,
    lastActive: "4h ago",
    status: "Active",
  },
  {
    id: "demo",
    name: "Demo Workspace",
    organization: "QuDrugForge Demo",
    projects: 3,
    members: 1,
    lastActive: "2d ago",
    status: "Sandbox",
  },
];

const RECENT_PROJECTS: RecentProject[] = [
  {
    name: "EGFR NSCLC Discovery Program",
    diseaseArea: "Oncology",
    stage: "Lead Optimization",
    status: "Active",
    lastUpdated: "2 hours ago",
  },
  {
    name: "PARP1 Oncology Program",
    diseaseArea: "Oncology",
    stage: "Hit Validation",
    status: "Idle",
    lastUpdated: "1 day ago",
  },
  {
    name: "PIK3CA Molecular Screening",
    diseaseArea: "Oncology",
    stage: "De Novo Generation",
    status: "Completed",
    lastUpdated: "3 days ago",
  },
  {
    name: "KRAS G12D Exploratory Campaign",
    diseaseArea: "Oncology",
    stage: "Target Identification",
    status: "Active",
    lastUpdated: "1 week ago",
  },
];

export default function WorkspaceSelectorPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    try {
      setErrorMessage(null);
      const res = await apiClient.get<{ success: boolean; data: any }>("/workspaces");
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map((ws: any) => ({
          id: ws.id,
          name: ws.name,
          organization: "Quinfosys R&D Platform",
          projects: 0,
          members: 1,
          lastActive: "Just now",
          status: "Active" as const,
        }));
        setWorkspaces(mapped);
        return;
      }
    } catch (err) {
      console.warn("Failed to fetch /workspaces, trying /auth/me fallback:", err);
    }

    // Fallback: try /auth/me which also returns workspace list
    try {
      const meRes = await apiClient.get<{ success: boolean; data: any }>("/auth/me");
      if (meRes.success && meRes.data?.workspaces?.length > 0) {
        const mapped = meRes.data.workspaces.map((ws: any) => ({
          id: ws.id,
          name: ws.name,
          organization: "Quinfosys R&D Platform",
          projects: 0,
          members: 1,
          lastActive: "Just now",
          status: "Active" as const,
        }));
        setWorkspaces(mapped);
        return;
      }
    } catch (err2) {
      console.warn("Failed /auth/me fallback:", err2);
    }

    // Final fallback: show static demo workspaces
    setWorkspaces(STATIC_WORKSPACES);
    setIsLoading(false);
  };

  // Ensure loading state is cleared after fetch completes
  const loadWorkspaces = async () => {
    await fetchWorkspaces();
    setIsLoading(false);
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const handleEnterWorkspace = async (workspace: Workspace) => {
    setSelectedId(workspace.id);
    setIsLoading(true);
    setStatusMessage(`Authorizing security key for ${workspace.name}...`);

    try {
      // POST select workspace
      await apiClient.post(`/workspaces/${workspace.id}/select`);
      
      // Store locally
      localStorage.setItem("active_workspace_id", workspace.id);
      localStorage.setItem("active_workspace_name", workspace.name);

      setStatusMessage("Quantum simulation nodes mapped. Syncing active pipelines...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 600);
    } catch (err) {
      console.error("Selection failed:", err);
      // Even if API fails, fallback to local storage set to proceed in presentation/offline mode
      localStorage.setItem("active_workspace_id", workspace.id);
      localStorage.setItem("active_workspace_name", workspace.name);
      setTimeout(() => {
        router.push("/dashboard");
      }, 600);
    }
  };

  const handleContinueDashboard = () => {
    setIsLoading(true);
    setStatusMessage("Reconnecting to most recent active session...");
    
    // Choose first workspace or fallback if none
    const firstWs = workspaces[0] || STATIC_WORKSPACES[0];
    localStorage.setItem("active_workspace_id", firstWs.id);
    localStorage.setItem("active_workspace_name", firstWs.name);

    setTimeout(() => {
      router.push("/dashboard");
    }, 600);
  };

  const handleCreateWorkspace = async () => {
    const name = prompt("Create Workspace Wizard:\n\nEnter a name for the new research workspace:");
    if (!name || !name.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiClient.post<any>("/workspaces", { body: { name: name.trim() } });
      if (res.success) {
        setStatusMessage(`Workspace "${name}" created successfully.`);
        await fetchWorkspaces();
      } else {
        alert("Failed to create workspace.");
      }
    } catch (err) {
      alert("Failed to create workspace: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Page Header */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
          SECURE PROTOCOL INITIALIZED
        </span>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Select a research workspace
        </h1>
        <p className="text-xs max-w-2xl" style={{ color: "var(--muted-text)" }}>
          Choose an organization workspace or continue into a recent discovery program.
        </p>
      </div>

      {statusMessage ? (
        <div className="w-full">
          <AuthStatusMessage type="success" message={statusMessage} />
        </div>
      ) : null}

      {/* Main Grid Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Workspaces & Recent Projects */}
        <div className="lg:col-span-8 space-y-6">
          {/* Workspaces Section */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              Organization Workspaces
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workspaces.map((workspace) => {
                const isSelected = selectedId === workspace.id;
                return (
                  <div
                    key={workspace.id}
                    className="rounded-xl border p-4.5 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/25 flex flex-col justify-between h-[180px]"
                    style={{
                      borderColor: isSelected
                        ? "var(--accent)"
                        : "color-mix(in srgb, var(--border) 60%, transparent)",
                    }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                          {workspace.name}
                        </h3>
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border shrink-0"
                          style={{
                            backgroundColor: workspace.status === "Active" ? "rgba(6, 182, 212, 0.08)" : "rgba(168, 85, 247, 0.08)",
                            borderColor: workspace.status === "Active" ? "rgba(6, 182, 212, 0.2)" : "rgba(168, 85, 247, 0.2)",
                            color: workspace.status === "Active" ? "var(--accent)" : "#c084fc",
                          }}
                        >
                          {workspace.status}
                        </span>
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--muted-text)" }}>
                        Org: <span className="font-semibold">{workspace.organization}</span>
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 pt-3 border-t border-border/20 text-[10px] font-mono">
                      <div>
                        <span className="opacity-60 block">PROJECTS</span>
                        <span className="font-bold">{workspace.projects} runs</span>
                      </div>
                      <div>
                        <span className="opacity-60 block">MEMBERS</span>
                        <span className="font-bold">{workspace.members} active</span>
                      </div>
                      <div>
                        <span className="opacity-60 block">LAST ACTIVE</span>
                        <span className="font-bold">{workspace.lastActive}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleEnterWorkspace(workspace)}
                      className="mt-3.5 w-full rounded-lg py-2 text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all duration-200"
                      style={{
                        background: "var(--bg)",
                        borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
                        color: "var(--text)"
                      }}
                      onMouseEnter={(e) => {
                        if (!isLoading) {
                          e.currentTarget.style.borderColor = "var(--accent)";
                          e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--accent) 5%, var(--bg))";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isLoading) {
                          e.currentTarget.style.borderColor = "color-mix(in srgb, var(--border) 70%, transparent)";
                          e.currentTarget.style.backgroundColor = "var(--bg)";
                        }
                      }}
                    >
                      Enter Workspace
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Projects Section */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              Recent Discovery Programs
            </h2>
            <div className="rounded-xl border overflow-hidden bg-card/40 backdrop-blur-sm" style={{ borderColor: "color-mix(in srgb, var(--border) 70%, transparent)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr 
                      className="border-b text-[10px] font-bold uppercase tracking-wider"
                      style={{ 
                        borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
                        color: "var(--muted-text)",
                        background: "rgba(255, 255, 255, 0.01)" 
                      }}
                    >
                      <th className="p-3.5 pl-4">Program Name</th>
                      <th className="p-3.5">Disease Area</th>
                      <th className="p-3.5">Workflow Stage</th>
                      <th className="p-3.5">Telemetry</th>
                      <th className="p-3.5 pr-4 text-right">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_PROJECTS.map((project, idx) => (
                      <tr 
                        key={idx}
                        className="hover:bg-slate-900/10 dark:hover:bg-slate-100/5 transition-colors border-b last:border-0"
                        style={{ borderColor: "color-mix(in srgb, var(--border) 40%, transparent)" }}
                      >
                        <td className="p-3.5 pl-4 font-semibold text-text">{project.name}</td>
                        <td className="p-3.5" style={{ color: "var(--muted-text)" }}>{project.diseaseArea}</td>
                        <td className="p-3.5 font-mono text-[10px]">{project.stage}</td>
                        <td className="p-3.5">
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide border"
                            style={{
                              backgroundColor: project.status === "Active" ? "rgba(16, 185, 129, 0.08)" : project.status === "Idle" ? "rgba(245, 158, 11, 0.08)" : "rgba(6, 182, 212, 0.08)",
                              borderColor: project.status === "Active" ? "rgba(16, 185, 129, 0.2)" : project.status === "Idle" ? "rgba(245, 158, 11, 0.2)" : "rgba(6, 182, 212, 0.2)",
                              color: project.status === "Active" ? "var(--success)" : project.status === "Idle" ? "var(--warning)" : "var(--accent)"
                            }}
                          >
                            {project.status}
                          </span>
                        </td>
                        <td className="p-3.5 pr-4 text-right font-mono text-[10px] opacity-75">{project.lastUpdated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Research Summary Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions Panel */}
          <div className="rounded-xl border p-4.5 bg-card/65 backdrop-blur-sm space-y-3.5" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)" }}>
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              Workspace Controls
            </h2>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleCreateWorkspace}
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 hover:scale-[1.01] transition-all"
                style={{ 
                  background: "var(--card)", 
                  borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
                  color: "var(--text)"
                }}
              >
                <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Create Workspace
              </button>

              <button
                type="button"
                onClick={() => alert("Join Workspace:\n\nEnter institutional hash key invite to link profiles.")}
                className="w-full py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 hover:scale-[1.01] transition-all"
                style={{ 
                  background: "var(--card)", 
                  borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
                  color: "var(--text)"
                }}
              >
                <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Join Workspace
              </button>

              <button
                type="button"
                onClick={() => alert("Import Program:\n\nAccepted structures: SDF, PDB, Mol2, SDF-ZIP datasets.")}
                className="w-full py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 hover:scale-[1.01] transition-all"
                style={{ 
                  background: "var(--card)", 
                  borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
                  color: "var(--text)"
                }}
              >
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import Project
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleContinueDashboard}
                className="w-full py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                style={{
                  background: "linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)",
                  color: "#ffffff"
                }}
              >
                <span>Continue to Dashboard</span>
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Research Environment Summary Panel */}
          <div className="rounded-xl border p-4.5 bg-card/65 backdrop-blur-sm space-y-4" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)" }}>
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              Research Environment
            </h2>

            {/* Compute credits */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono opacity-60 block">ACTIVE COMPUTE CREDITS</span>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span>QPU Quantum Simulator</span>
                  <span className="font-bold">14,200 hrs remaining</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: "68%" }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span>HPC GPU Core Array</span>
                  <span className="font-bold">84,000 hrs remaining</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: "42%" }} />
                </div>
              </div>
            </div>

            {/* Connected integrations */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono opacity-60 block">INTEGRATIONS STATUS</span>
              <div className="space-y-1">
                {[
                  "GNINA Neural Scorer v1.2",
                  "AutoDock Vina Engine v4.0",
                  "Schrödinger Maestro API"
                ].map((int, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="opacity-90">{int}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent reports */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono opacity-60 block">RECENT REPORTS GENERATED</span>
              <div className="space-y-1 text-[10px] font-mono">
                <div className="flex items-center justify-between hover:text-cyan-400 cursor-pointer">
                  <span className="truncate">📄 EGFR-L858R_Hit_Assessment.pdf</span>
                  <span className="opacity-50 shrink-0 font-sans">1d ago</span>
                </div>
                <div className="flex items-center justify-between hover:text-cyan-400 cursor-pointer">
                  <span className="truncate">📄 JAK3_Toxicity_Assay_Dossier.pdf</span>
                  <span className="opacity-50 shrink-0 font-sans">3d ago</span>
                </div>
              </div>
            </div>

            {/* Running experiments */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono opacity-60 block">ACTIVE CALCULATIONS (SIMULATOR)</span>
              <div className="space-y-1 text-[10px] font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span className="truncate">GNINA EGFR Docking Run #42</span>
                  </div>
                  <span className="opacity-70 shrink-0">82%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span className="truncate">Quantum Rerank PIK3CA-01</span>
                  </div>
                  <span className="opacity-70 shrink-0">14%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
