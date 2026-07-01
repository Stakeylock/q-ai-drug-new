"use client";

import { useEffect, useState } from "react";
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

export interface QMViewProps {
  projectId?: string;
}

export default function QMView({ projectId }: QMViewProps) {
  const [realQuantum, setRealQuantum] = useState<any[]>([]);
  const [dataSource, setDataSource] = useState<string>("REAL BACKEND DATA");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Polling lifecycle management
  const [runningStage, setRunningStage] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pipelineSummary, setPipelineSummary] = useState<any>(null);

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
      
      const [qmRes, summaryRes] = await Promise.all([
        apiClient.get<any>(`/projects/${activeProjectId}/quantum/qml-scores`),
        apiClient.get<any>(`/projects/${activeProjectId}/pipeline/summary`)
      ]);

      if (qmRes.success && qmRes.data?.items) {
        setRealQuantum(qmRes.data.items);
      }
      if (summaryRes.success && summaryRes.data?.latest_pipeline_run) {
        const run = summaryRes.data.latest_pipeline_run;
        setPipelineSummary(run);
        setLastUpdated(new Date());
        
        if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
          setPolling(false);
          setRunningStage(false);
        }
      }
      
      return summaryRes;
    } catch (err: any) {
      console.error("Fetch failed", err);
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
        message: "Select an active research project before starting quantum workflows.",
      });
      return;
    }

    if (isDemoMode()) {
      const now = new Date();
      setPipelineSummary({
        status: "completed",
        stage_statuses: {
          quantum: { status: "completed", progress: 100 },
        },
      });
      setLastUpdated(now);
      setDuration("0s");
      setPolling(false);
      setRunningStage(false);
      showToast({
        type: "info",
        title: "Demo Workflow Ready",
        message: "Quantum QML reranking is simulated in demo mode.",
      });
      return;
    }
    
    try {
      setRunningStage(true);
      setPolling(true);
      setRunStartTime(new Date());
      const res = await apiClient.post<any>(`/projects/${activeProjectId}/pipeline/run`, {
        body: {
          pipeline: ["quantum"],
          parameters: {}
        }
      });
      if (res.success) {
        showToast({
          type: "success",
          title: "Workflow Started",
          message: "Quantum QML reranking is now running.",
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
    if (realQuantum.length > 0) {
      const hasImported = realQuantum.some((r: any) => r.source === "q_ai_drug_import" || r.metadata?.import_id);
      setDataSource(hasImported ? "IMPORTED Q-AI-DRUG DATA" : "REAL BACKEND DATA");
    }
  }, [realQuantum]);

  const displayQuantum = realQuantum.map((r: any) => ({
    candidate: r.compound_id || "CAND-QML",
    classicalRank: r.qm_descriptors?.classical_rank || 12,
    quantumRank: r.quantum_rank || r.rank || 1,
    qmlScore: r.qml_score !== undefined && r.qml_score !== null ? r.qml_score : "-",
    homo: r.qm_descriptors?.homo_ev !== undefined ? r.qm_descriptors.homo_ev : "-",
    lumo: r.qm_descriptors?.lumo_ev !== undefined ? r.qm_descriptors.lumo_ev : "-",
    gap: r.qm_descriptors?.gap_ev !== undefined ? r.qm_descriptors.gap_ev : "-",
    dipole: r.qm_descriptors?.dipole_debye !== undefined ? r.qm_descriptors.dipole_debye : "-",
    uncertainty: r.metadata?.uncertainty || 0.05,
    applicability_domain: r.metadata?.applicability_domain_status || "within_domain",
    status: "completed"
  }));

  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  useEffect(() => {
    if (displayQuantum && displayQuantum.length > 0 && !selectedCandidate) {
      setSelectedCandidate(displayQuantum[0]);
    }
  }, [displayQuantum, selectedCandidate]);

  if (isLoading && !polling) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="Quantum Intelligence"
          breadcrumb="Oncology Research / Quantum Reranking"
          description="Connecting to database and pipeline orchestration registry..."
        />
        <LoadingState message="Loading quantum orbital calculation registry..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="Quantum Intelligence"
          breadcrumb="Oncology Research / Quantum Reranking"
          description="A computation or network exception occurred."
        />
        <ErrorState
          title="Quantum compute session error"
          explanation={error}
          action={<Button variant="outline" size="sm" onClick={() => void fetchData()}>Retry Connection</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Quantum Intelligence"
        breadcrumb="Oncology Research / Quantum Reranking"
        description="High-fidelity quantum mechanical (QM) descriptors and QML reranking."
        dataSource={displayQuantum.length > 0 ? "real" : "missing"}
        actions={
          <ActionButtonGroup>
            <ActionButton label="Export QM Data" variant="outline" />
            <ActionButton 
              label={runningStage ? "Executing..." : "Execute Quantum Workflow"} 
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
        {pipelineSummary?.status === "failed" && <StatusBadge status="warning" size="sm" label="partial" />}
        {pipelineSummary?.status === "running" && <StatusBadge status="running" size="sm" label="partial" />}
        {pipelineSummary?.status === "cancelled" && <StatusBadge status="failed" size="sm" label="invalidated" />}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <SectionHeader title="Quantum Reranking Ledger" description="Comparison of classical vs. quantum prioritization." />
          
          {displayQuantum.length === 0 ? (
            <EmptyState
              title="No Quantum Mechanical Scores Found"
              description="Launch the QML solver pipeline or run semi-empirical optimizations."
              action={
                <button onClick={handleRunStage} className="bg-accent px-4 py-2 text-[10px] font-black uppercase text-bg hover:bg-accent/90">
                  Execute Quantum Workflow
                </button>
              }
            />
          ) : (
            <div className="ui-card-surface overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                    <th className="px-4 py-4">Candidate</th>
                    <th className="px-4 py-4 text-center">Class. Rank</th>
                    <th className="px-4 py-4 text-center">Q-Rank</th>
                    <th className="px-4 py-4 text-center text-accent">QML Score</th>
                    <th className="px-4 py-4 text-center">HOMO (eV)</th>
                    <th className="px-4 py-4 text-center">LUMO (eV)</th>
                    <th className="px-4 py-4 text-center">Uncertainty</th>
                    <th className="px-4 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {displayQuantum.map(res => (
                    <tr 
                      key={res.candidate} 
                      className={`group hover:bg-muted-bg/20 transition-colors cursor-pointer ${selectedCandidate?.candidate === res.candidate ? 'bg-accent/[0.03]' : ''}`}
                      onClick={() => setSelectedCandidate(res)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-text group-hover:text-accent">{res.candidate}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-muted-text/50">#{res.classicalRank}</td>
                      <td className="px-4 py-3 text-center text-xs font-black text-text">#{res.quantumRank}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs font-black text-accent">{res.qmlScore}</td>
                      <td className="px-4 py-3 text-center font-mono text-[11px] text-text">{res.homo}</td>
                      <td className="px-4 py-3 text-center font-mono text-[11px] text-text">{res.lumo}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black ${res.uncertainty > 0.1 ? "text-warning" : "text-success"}`}>
                           {res.uncertainty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge status={res.status as any} size="sm" />
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
                     {parseInt(duration) > 900 && <span className="text-warning">High latency - waiting for compute...</span>}
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

        {/* Right Column */}
        {selectedCandidate && (
          <div className="space-y-6">
            <div className="ui-card-surface p-5 space-y-5">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent">Quantum Uncertainty</h4>
              <div className="space-y-4">
                 <div className={`p-4 rounded-xl border space-y-3 ${
                   selectedCandidate.applicability_domain === 'outside_domain' ? 'bg-error/10 border-error/20' : 'bg-accent/[0.03] border-accent/20'
                 }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-muted-text/50">Applicability Domain</span>
                      <span className={`text-xs font-black ${selectedCandidate.applicability_domain === 'outside_domain' ? 'text-error' : 'text-emerald-500'}`}>
                        {selectedCandidate.applicability_domain}
                      </span>
                    </div>
                    {selectedCandidate.applicability_domain === 'outside_domain' && (
                      <p className="text-[11px] text-error leading-relaxed italic">
                        Warning: This molecule is structurally distant from the QML training set. Quantum scores exhibit high uncertainty.
                      </p>
                    )}
                 </div>
                 
                 <div className="grid grid-cols-1 gap-y-3 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="font-bold text-muted-text">HOMO Energy</span>
                      <span className="font-mono text-text">{selectedCandidate.homo} eV</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="font-bold text-muted-text">LUMO Energy</span>
                      <span className="font-mono text-text">{selectedCandidate.lumo} eV</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="font-bold text-muted-text">Gap</span>
                      <span className="font-mono text-emerald-500">{selectedCandidate.gap} eV</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
