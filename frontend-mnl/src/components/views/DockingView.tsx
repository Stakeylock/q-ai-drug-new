"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  PageHeader, 
  MetricCard, 
  ActionButtonGroup, 
  ActionButton, 
  StatusBadge, 
  SectionHeader, 
  EmptyState,
  ErrorState,
  LoadingState,
  ProvenanceBadge,
  ProvenanceLegend,
  Button
} from "@/components/ui";
import { apiClient, isDemoMode } from "@/services/api";
import { showToast } from "@/utils/toast";

export interface DockingViewProps {
  projectId?: string;
}

function DockingWorkspaceContent({ projectId }: DockingViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const engine = searchParams.get("engine");
  const isGnina = engine === "gnina";

  const [realDocking, setRealDocking] = useState<any[]>([]);
  const [realGnina, setRealGnina] = useState<any[]>([]);
  const [dataSource, setDataSource] = useState<string>("REAL BACKEND DATA");
  const [isLoading, setIsLoading] = useState(true);
  
  // Polling lifecycle management
  const [runningStage, setRunningStage] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pipelineSummary, setPipelineSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Long-running stage UX
  const [runStartTime, setRunStartTime] = useState<Date | null>(null);
  const [duration, setDuration] = useState<string>("0s");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const activeProjectId = projectId || (typeof window !== "undefined" ? localStorage.getItem("active_project_id") : null);

  const fetchData = async () => {
    if (isDemoMode()) {
      setError(null);
      setDataSource("DEMO DATA");
      setIsLoading(false);
      return null;
    }

    try {
      if (!activeProjectId) return null;
      
      const [docRes, gninaRes, summaryRes] = await Promise.all([
        apiClient.get<any>(`/projects/${activeProjectId}/docking/results`),
        apiClient.get<any>(`/projects/${activeProjectId}/gnina/results`),
        apiClient.get<any>(`/projects/${activeProjectId}/pipeline/summary`)
      ]);

      if (docRes.success && docRes.data?.items) {
        setRealDocking(docRes.data.items);
      }
      if (gninaRes.success && gninaRes.data?.items) {
        setRealGnina(gninaRes.data.items);
      }
      if (summaryRes.success && summaryRes.data?.latest_pipeline_run) {
        const run = summaryRes.data.latest_pipeline_run;
        setPipelineSummary(run);
        setLastUpdated(new Date());
        
        // Stop polling on completion or fatal failure
        if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
          setPolling(false);
          setRunningStage(false);
        }
      }
      
      return summaryRes;
    } catch (err: any) {
      console.error("Fetch failed", err);
      // Stop polling on fatal failure
      setPolling(false);
      setRunningStage(false);
      setError(err.message || "Failed to establish secure gateway session.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeProjectId]);

  // Polling hook (Cleanup on unmount, prevent duplicate intervals)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (polling) {
      intervalId = setInterval(() => {
        fetchData();
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [polling, activeProjectId]);

  // Duration timer
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (runningStage && runStartTime) {
      intervalId = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - runStartTime.getTime()) / 1000);
        setDuration(`${diff}s`);
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [runningStage, runStartTime]);

  const handleRunStage = async () => {
    if (!activeProjectId) {
      showToast({
        type: "warning",
        title: "Project Required",
        message: "Select an active research project before starting a workflow.",
      });
      return;
    }

    const stage = isGnina ? "gnina" : "docking";
    if (isDemoMode()) {
      const now = new Date();
      setPipelineSummary({
        status: "completed",
        stage_statuses: {
          [stage]: { status: "completed", progress: 100 },
        },
      });
      setLastUpdated(now);
      setDuration("0s");
      setPolling(false);
      setRunningStage(false);
      showToast({
        type: "info",
        title: "Demo Workflow Ready",
        message: `${isGnina ? "GNINA CNN rescoring" : "Molecular docking"} is simulated in demo mode.`,
      });
      return;
    }
    
    try {
      setRunningStage(true);
      setPolling(true);
      setRunStartTime(new Date());
      const res = await apiClient.post<any>(`/projects/${activeProjectId}/pipeline/run`, {
        body: {
          pipeline: [stage],
          parameters: {}
        }
      });
      if (res.success) {
        showToast({
          type: "success",
          title: "Workflow Started",
          message: `${isGnina ? "GNINA CNN rescoring" : "Molecular docking"} is now running.`,
        });
        fetchData();
      } else {
        showToast({
          type: "error",
          title: "Execution Failed",
          message: res.message || "The backend could not start this workflow.",
        });
        setPolling(false);
        setRunningStage(false);
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Execution Failed",
        message: err.message || "Failed to trigger background execution adapter.",
      });
      setPolling(false);
      setRunningStage(false);
    }
  };

  useEffect(() => {
    if (isGnina) {
      const hasImported = realGnina.some((r: any) => r.source === "q_ai_drug_import" || r.metadata?.import_id);
      setDataSource(hasImported ? "IMPORTED Q-AI-DRUG DATA" : "REAL BACKEND DATA");
    } else {
      const hasImported = realDocking.some((r: any) => r.source === "q_ai_drug_import" || r.metadata?.import_id);
      setDataSource(hasImported ? "IMPORTED Q-AI-DRUG DATA" : "REAL BACKEND DATA");
    }
  }, [isGnina, realDocking, realGnina]);

  const activeResults = isGnina ? realGnina : realDocking;
  const [selectedResult, setSelectedResult] = useState<any>(null);

  useEffect(() => {
    if (activeResults.length > 0 && !selectedResult) {
      setSelectedResult(activeResults[0]);
    }
  }, [activeResults, selectedResult]);

  const handleOpenPoseViewer = () => {
    if (!selectedResult) return;
    router.push(`/visualization?result_id=${selectedResult.id || ""}`);
  };

  if (isLoading && !polling) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title={isGnina ? "GNINA CNN Rescoring" : "Docking Workspace"}
          breadcrumb={isGnina ? "Oncology Research / CNN Scoring" : "Oncology Research / Molecular Docking"}
          description="Connecting to database and pipeline orchestration registry..."
        />
        <LoadingState message="Loading scientific data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader title={isGnina ? "GNINA" : "Docking"} breadcrumb="Error" description="Failed to load" />
        <ErrorState title="Compute session error" explanation={error} action={<Button onClick={() => void fetchData()}>Retry</Button>} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title={isGnina ? "GNINA CNN Rescoring" : "Docking Workspace"}
        breadcrumb={isGnina ? "Oncology Research / CNN Scoring" : "Oncology Research / Molecular Docking"}
        description={isGnina 
          ? "Apply Deep Learning CNN scoring to refine docking poses and improve binding affinity predictions."
          : "Configure binding pockets, execute docking simulations, and analyze ligand-protein interaction affinities."
        }
        dataSource={activeResults.length > 0 ? "real" : "missing"}
        actions={
          <ActionButtonGroup>
            <ActionButton label={isGnina ? "Export SDF" : "Export Poses"} variant="outline" />
            <ActionButton 
              label={runningStage ? "Executing..." : (isGnina ? "Launch GNINA Workflow" : "Execute Docking Workflow")} 
              variant="primary" 
              onClick={handleRunStage}
              disabled={runningStage}
            />
          </ActionButtonGroup>
        }
      />

      <div className="flex items-center gap-4 px-6 py-3 bg-muted-bg/50 border border-border/20 rounded-xl max-w-max">
        <span className="text-[10px] font-bold text-muted-text/60 uppercase tracking-widest">Scientific Lineage:</span>
        <ProvenanceBadge provenance={dataSource === "IMPORTED Q-AI-DRUG DATA" ? "imported" : "live_compute"} />
        <div className="h-4 w-px bg-border/30" />
        {/* Partial Stage Rendering & Provenance Badges */}
        {pipelineSummary?.status === "failed" && <StatusBadge status="warning" size="sm" label="partial" />}
        {pipelineSummary?.status === "running" && <StatusBadge status="running" size="sm" label="partial" />}
        {pipelineSummary?.status === "cancelled" && <StatusBadge status="failed" size="sm" label="invalidated" />}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <SectionHeader title={isGnina ? "CNN Rescoring Results" : "Simulation Ledger"} description="Live execution results." />
          
          {activeResults.length === 0 ? (
            <EmptyState
              title={isGnina ? "No GNINA CNN Poses Scored" : "No Docking Results Found"}
              description="Execute a simulation run or import AutoDock Vina files."
              action={<button onClick={handleRunStage} className="bg-accent px-4 py-2 text-[10px] font-black uppercase text-bg hover:bg-accent/90">{isGnina ? "Execute Workflow" : "Execute Workflow"}</button>}
            />
          ) : (
            <div className="ui-card-surface overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                    <th className="px-4 py-4">Candidate</th>
                    <th className="px-4 py-4 text-center">{isGnina ? "CNN Affinity" : "Affinity (kcal/mol)"}</th>
                    <th className="px-4 py-4 text-center">{isGnina ? "CNN Score" : "RMSD (l.b.)"}</th>
                    <th className="px-4 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {activeResults.map((res: any) => (
                    <tr 
                      key={res.id} 
                      onClick={() => setSelectedResult(res)}
                      className={`group hover:bg-muted-bg/20 transition-colors cursor-pointer ${selectedResult?.id === res.id ? 'bg-accent/[0.03]' : ''}`}
                    >
                      <td className="px-4 py-4 font-mono text-xs font-bold text-text">{res.compound_id || res.id}</td>
                      <td className="px-4 py-4 text-center font-mono text-xs font-black text-accent">
                        {isGnina ? (res.cnn_affinity ?? "-") : (res.binding_energy ?? "-")}
                      </td>
                      <td className="px-4 py-4 text-center font-mono text-xs text-text">
                        {isGnina ? (res.cnn_pose_score ?? "-") : (res.metadata?.rmsd ?? "-")}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <StatusBadge status="completed" size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Real Orchestration Queue */}
          {pipelineSummary && (
            <div className="space-y-4">
              <SectionHeader title="Orchestration Queue" description="Live status of pipeline execution." />
              
              {/* Long-Running Stage UX */}
              {runningStage && (
                 <div className="flex justify-between items-center bg-accent/10 border border-accent/20 p-3 rounded-lg mb-4">
                   <div className="text-[10px] font-bold uppercase text-accent">Pipeline Active</div>
                   <div className="flex gap-4 text-[10px] text-muted-text font-mono">
                     <span>Duration: {duration}</span>
                     <span>Last heartbeat: {lastUpdated?.toLocaleTimeString()}</span>
                     {parseInt(duration) > 600 && <span className="text-warning">High latency - waiting for compute...</span>}
                   </div>
                 </div>
              )}

              {/* Retry UX with Lineage Awareness */}
              {pipelineSummary.status === "failed" && (
                 <div className="flex justify-between items-center bg-error/10 border border-error/20 p-4 rounded-lg mb-4">
                   <div>
                     <div className="text-[11px] font-bold uppercase text-error">Downstream Invalidation Warning</div>
                     <div className="text-[10px] text-muted-text mt-1">Stale downstream artifacts detected due to failure. Retry parent linkage required.</div>
                   </div>
                   <button onClick={handleRunStage} className="px-4 py-2 bg-error text-white font-black uppercase text-[10px] rounded hover:bg-error/80">Retry Orchestration Run</button>
                 </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Object.entries(pipelineSummary.stage_statuses || {}).map(([stage, details]: [string, any]) => (
                  <div key={stage} className="ui-card-surface p-4 flex flex-col justify-between h-28">
                     <div className="flex justify-between items-start mb-2">
                       <div>
                         <h4 className="text-xs font-black text-text uppercase tracking-widest">{stage}</h4>
                       </div>
                       <StatusBadge status={details.status as any} size="sm" />
                     </div>
                     <div className="space-y-2">
                       <div className="flex justify-between text-[9px] font-bold">
                         <span className="text-muted-text/60">
                           {/* Artifact Availability Timing */}
                           {details.status === "running" ? "artifact_pending" : (details.status === "completed" ? "artifact_ready" : "artifact_indexing")}
                         </span>
                         <span className="text-accent">{details.progress || 0}%</span>
                       </div>
                       <div className="h-1 w-full bg-border/20 rounded-full overflow-hidden">
                         <div className="h-full bg-accent transition-all duration-500" style={{ width: `${details.progress || 0}%` }} />
                       </div>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleRunStage}
              disabled={runningStage}
              className="w-full py-3 rounded-lg bg-accent text-bg font-black uppercase tracking-[0.2em] text-[10px] hover:bg-accent/90 disabled:opacity-50"
            >
              {runningStage ? "Executing Workflow..." : (isGnina ? "Execute GNINA Workflow" : "Execute Docking Workflow")}
            </button>
            {selectedResult && (
              <button 
                onClick={handleOpenPoseViewer}
                className="w-full py-3 rounded-lg bg-indigo-600 text-white border border-indigo-500 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-700 transition-all"
              >
                View 3D Pose in Workbench
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DockingView({ projectId }: DockingViewProps) {
  return (
    <Suspense fallback={<div>Loading docking workspace...</div>}>
      <DockingWorkspaceContent projectId={projectId} />
    </Suspense>
  );
}
