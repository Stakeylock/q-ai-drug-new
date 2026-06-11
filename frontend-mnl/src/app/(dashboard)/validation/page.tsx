"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import { apiClient } from "@/services/api";

function ValidationPageContent() {
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const isAdmetView = panel === "admet" || !panel; // Default to admet if no panel

  const [realAdmet, setRealAdmet] = useState<any[]>([]);
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

  const fetchData = async () => {
    try {
      const projectId = localStorage.getItem("active_project_id");
      if (!projectId) return null;
      
      const [admetRes, summaryRes] = await Promise.all([
        apiClient.get<any>(`/projects/${projectId}/admet/results`),
        apiClient.get<any>(`/projects/${projectId}/pipeline/summary`)
      ]);

      if (admetRes.success && admetRes.data?.items) {
        setRealAdmet(admetRes.data.items);
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
  }, []);

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
  }, [polling]);

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
    const projectId = localStorage.getItem("active_project_id");
    if (!projectId) return;
    
    try {
      setRunningStage(true);
      setPolling(true);
      setRunStartTime(new Date());
      const res = await apiClient.post<any>(`/projects/${projectId}/pipeline/run`, {
        body: {
          pipeline: ["admet"],
          parameters: {}
        }
      });
      if (res.success) {
        alert("ADMET workflow triggered successfully!");
        fetchData();
      } else {
        alert("Execution trigger failed: " + res.message);
        setPolling(false);
        setRunningStage(false);
      }
    } catch (err: any) {
      alert("Error: " + (err.message || "Failed to trigger background execution adapter."));
      setPolling(false);
      setRunningStage(false);
    }
  };

  useEffect(() => {
    if (realAdmet.length > 0) {
      const hasImported = realAdmet.some((r: any) => r.source === "q_ai_drug_import" || r.metadata?.import_id);
      setDataSource(hasImported ? "IMPORTED Q-AI-DRUG DATA" : "REAL BACKEND DATA");
    }
  }, [realAdmet]);

  const displayAdmet = realAdmet.map((r: any) => {
    const rawTox = r.critical_risks || {};
    const hergVal = rawTox.herg_risk?.level || "low";
    const hepVal = rawTox.hepatotoxicity_risk?.level || "low";
    const cypVal = r.radar?.metabolism?.label || "low";
    const bbbVal = r.radar?.permeability?.label || "low";
    
    return {
      candidate: r.compound_id || "CAND-ADMET",
      overallRisk: r.overall_risk ? r.overall_risk.charAt(0).toUpperCase() + r.overall_risk.slice(1) : "Low",
      herg: hergVal.charAt(0).toUpperCase() + hergVal.slice(1),
      cyp3a4: cypVal.charAt(0).toUpperCase() + cypVal.slice(1),
      cyp2d6: "Low",
      bbb: bbbVal === "High" || bbbVal === "high" ? "High" : bbbVal === "medium" || bbbVal === "Medium" ? "Med" : "Low",
      clearance: "Med",
      hepatotox: hepVal.charAt(0).toUpperCase() + hepVal.slice(1),
      lipinski: r.lipinski_violations === 0 ? "Pass" : "Fail",
      uncertainty: r.metadata?.uncertainty || 0.05,
      applicability_domain: r.metadata?.applicability_domain_status || "within_domain",
      status: "completed"
    };
  });

  const [selectedResult, setSelectedResult] = useState<any>(null);

  useEffect(() => {
    if (displayAdmet && displayAdmet.length > 0 && !selectedResult) {
      setSelectedResult(displayAdmet[0]);
    }
  }, [displayAdmet, selectedResult]);

  if (isLoading && !polling) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title={isAdmetView ? "ADMET & Toxicity Risk" : "Scientific Validation"}
          breadcrumb={isAdmetView ? "Oncology Research / ADMET Profiling" : "Oncology Research / Validation Audit"}
          description="Connecting to database and pipeline orchestration registry..."
        />
        <LoadingState message="Loading ADMET physiological and toxicity assessments..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title={isAdmetView ? "ADMET & Toxicity Risk" : "Scientific Validation"}
          breadcrumb={isAdmetView ? "Oncology Research / ADMET Profiling" : "Oncology Research / Validation Audit"}
          description="A computation or network exception occurred."
        />
        <ErrorState
          title="Validation compute session error"
          explanation={error}
          action={<Button variant="outline" size="sm" onClick={() => void fetchData()}>Retry Connection</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title={isAdmetView ? "ADMET & Toxicity Risk" : "Scientific Validation"}
        breadcrumb={isAdmetView ? "Oncology Research / ADMET Profiling" : "Oncology Research / Validation Audit"}
        description={isAdmetView 
          ? "Evaluate Absorption, Distribution, Metabolism, Excretion, and Toxicity profiles for top candidates."
          : "Audit computational workflows, benchmarking results, and reproducibility metrics."
        }
        dataSource={displayAdmet.length > 0 ? "real" : "missing"}
        actions={
          <ActionButtonGroup>
            <ActionButton label="Export Risk Report" variant="outline" />
            <ActionButton 
              label={runningStage ? "Executing..." : "Execute ADMET Workflow"} 
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
          <SectionHeader title="ADMET Discovery Ledger" description="Comprehensive risk assessment across endpoints." />
          
          {displayAdmet.length === 0 ? (
            <EmptyState
              title="No ADMET Profiles Found"
              description="Start an ADMET run or import q-ai-drug results."
              action={
                <button onClick={handleRunStage} className="bg-accent px-4 py-2 text-[10px] font-black uppercase text-bg hover:bg-accent/90">
                  Execute ADMET Workflow
                </button>
              }
            />
          ) : (
            <div className="ui-card-surface overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                    <th className="px-4 py-4">Candidate</th>
                    <th className="px-4 py-4 text-center">Risk</th>
                    <th className="px-4 py-4 text-center">hERG</th>
                    <th className="px-4 py-4 text-center">CYP3A4</th>
                    <th className="px-4 py-4 text-center">BBB</th>
                    <th className="px-4 py-4 text-center">Lipinski</th>
                    <th className="px-4 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {displayAdmet.map(res => (
                    <tr 
                      key={res.candidate} 
                      className={`group hover:bg-muted-bg/20 transition-colors cursor-pointer ${selectedResult?.candidate === res.candidate ? 'bg-accent/[0.03]' : ''}`}
                      onClick={() => setSelectedResult(res)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-text group-hover:text-accent">{res.candidate}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          res.overallRisk === 'Low' ? 'text-success' : res.overallRisk === 'Medium' ? 'text-warning' : 'text-error'
                        }`}>
                          {res.overallRisk}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black ${res.herg === 'High' ? 'text-error' : res.herg === 'Med' ? 'text-warning' : 'text-success'}`}>
                          {res.herg[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black ${res.cyp3a4 === 'High' ? 'text-error' : 'text-success'}`}>
                          {res.cyp3a4[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black ${res.bbb === 'High' ? 'text-accent' : 'text-muted-text/40'}`}>
                          {res.bbb === 'High' ? 'Y' : 'N'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black ${res.lipinski === 'Pass' ? 'text-success' : 'text-error'}`}>
                          {res.lipinski}
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

        {selectedResult && (
          <div className="space-y-6">
            <div className="ui-card-surface p-5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent">Toxicity Profiling & Uncertainty</h4>
              <div className="space-y-4">
                 <div className={`p-4 rounded-xl border space-y-3 ${
                   selectedResult.applicability_domain === 'outside_domain' ? 'bg-error/10 border-error/20' : 'bg-accent/[0.03] border-accent/20'
                 }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-muted-text/50">Applicability Domain</span>
                      <span className={`text-xs font-black ${selectedResult.applicability_domain === 'outside_domain' ? 'text-error' : 'text-emerald-500'}`}>
                        {selectedResult.applicability_domain}
                      </span>
                    </div>
                    {selectedResult.applicability_domain === 'outside_domain' && (
                      <p className="text-[11px] text-error leading-relaxed italic">
                        Warning: High prediction uncertainty. This candidate exceeds the ADMET model's training applicability domain.
                      </p>
                    )}
                 </div>

                 <div className="grid grid-cols-1 gap-y-3 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="font-bold text-muted-text">hERG Inhibition</span>
                      <span className={`font-mono ${selectedResult.herg === 'High' ? 'text-error' : 'text-text'}`}>{selectedResult.herg}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="font-bold text-muted-text">Hepatotoxicity</span>
                      <span className={`font-mono ${selectedResult.hepatotox === 'High' ? 'text-error' : 'text-text'}`}>{selectedResult.hepatotox}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="font-bold text-muted-text">CYP3A4</span>
                      <span className={`font-mono ${selectedResult.cyp3a4 === 'High' ? 'text-error' : 'text-text'}`}>{selectedResult.cyp3a4}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="font-bold text-muted-text">Uncertainty</span>
                      <span className={`font-mono ${selectedResult.uncertainty > 0.1 ? 'text-warning' : 'text-text'}`}>{selectedResult.uncertainty}</span>
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

export default function ValidationPage() {
  return (
    <Suspense fallback={<div>Loading Validation...</div>}>
      <ValidationPageContent />
    </Suspense>
  );
}
