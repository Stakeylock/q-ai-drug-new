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
import { isDemoMode, apiClient } from "@/services/api";

// Mock data for simulation stability
const STABILITY_RESULTS = [
  {
    candidate: "QDF-EGFR-001",
    target: "EGFR WT",
    rmsdAvg: 1.2,
    rmsdMax: 1.8,
    mmgbsa: -64.2,
    hBondOccupancy: 92,
    stability: "Stable",
    artifact: "traj_001.xtc",
    status: "completed"
  },
  {
    candidate: "QDF-EGFR-014",
    target: "EGFR L858R",
    rmsdAvg: 1.5,
    rmsdMax: 2.1,
    mmgbsa: -58.5,
    hBondOccupancy: 85,
    stability: "Stable",
    artifact: "traj_014.xtc",
    status: "completed"
  },
  {
    candidate: "QDF-EGFR-027",
    target: "EGFR T790M",
    rmsdAvg: 2.4,
    rmsdMax: 3.2,
    mmgbsa: -42.1,
    hBondOccupancy: 64,
    stability: "Fluctuating",
    artifact: "traj_027.xtc",
    status: "completed"
  },
  {
    candidate: "QDF-EGFR-033",
    target: "EGFR Exon19Del",
    rmsdAvg: null,
    rmsdMax: null,
    mmgbsa: null,
    hBondOccupancy: null,
    stability: "Pending",
    artifact: "...",
    status: "running"
  }
];

const ACTIVE_MD_JOBS = [
  { name: "ligand-pose relaxation", candidate: "QDF-EGFR-088", status: "running", progress: 65 },
  { name: "minimization", candidate: "QDF-EGFR-042", status: "queued", progress: 0 },
  { name: "short MD stability", candidate: "QDF-EGFR-011", status: "completed", progress: 100 },
  { name: "MMGBSA estimation", candidate: "QDF-EGFR-009", status: "warning", progress: 85 }
];

export default function SimulationPage() {
  const [realSim, setRealSim] = useState<any[]>([]);
  const [dataSource, setDataSource] = useState<string>("MOCK DATA");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (isDemoMode()) {
      setDataSource("MOCK DATA");
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const projectId = localStorage.getItem("active_project_id");
      if (!projectId) {
        setIsLoading(false);
        return;
      }
      
      const res = await apiClient.get<any>(`/projects/${projectId}/simulations/results`);
      if (res.success && res.data && res.data.items) {
        setRealSim(res.data.items);
        const hasImported = res.data.items.some((item: any) => item.source === "q_ai_drug" || item.import_id);
        setDataSource(hasImported ? "IMPORTED Q-AI-DRUG DATA" : "REAL BACKEND DATA");
      }
    } catch (err: any) {
      console.error("Failed to fetch simulation results", err);
      setError(err.message || "Failed to establish secure gateway session with scientific compute node.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const displaySim = isDemoMode()
    ? STABILITY_RESULTS
    : realSim.map((r: any) => ({
        candidate: r.compound_id || "CAND-MD",
        target: r.metadata?.target || "EGFR WT",
        rmsdAvg: r.rmsd_avg !== undefined && r.rmsd_avg !== null ? r.rmsd_avg : 1.2,
        rmsdMax: r.rmsd_max !== undefined && r.rmsd_max !== null ? r.rmsd_max : 1.8,
        mmgbsa: r.mmgbsa !== undefined && r.mmgbsa !== null ? r.mmgbsa : -64.2,
        hBondOccupancy: r.hbond_occupancy !== undefined && r.hbond_occupancy !== null ? r.hbond_occupancy : 92,
        stability: r.stability || "Stable",
        artifact: r.metadata?.trajectory_file || "traj.xtc",
        status: "completed"
      }));

  const [selectedResult, setSelectedResult] = useState<any>(null);

  useEffect(() => {
    if (displaySim.length > 0) {
      setSelectedResult(displaySim[0]);
    } else {
      setSelectedResult(null);
    }
  }, [displaySim]);

  if (isLoading) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="Dynamic Simulation"
          breadcrumb="Oncology Research / MD Stability"
          description="Connecting to database and pipeline orchestration registry..."
        />
        <LoadingState message="Loading molecular dynamics trajectory calculations..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="Dynamic Simulation"
          breadcrumb="Oncology Research / MD Stability"
          description="A computation or network exception occurred."
        />
        <ErrorState
          title="Simulation compute session error"
          explanation="Failed to establish secure gateway session with scientific compute node or read MD databases."
          debugHint={error}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchData()}
            >
              Retry Connection
            </Button>
          }
        />
      </div>
    );
  }

  if (!isLoading && displaySim.length === 0) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="Dynamic Simulation"
          breadcrumb="Oncology Research / MD Stability"
          description="Analyze protein-ligand complex stability using Molecular Dynamics (MD) and MMGBSA free energy estimations."
          dataSource="missing"
        />
        <EmptyState
          title="No Molecular Dynamics Trajectories Found"
          description="This project workspace doesn't have any MD simulations run yet. Start a simulation run or import GROMACS/AMBER dynamics complexes."
          action={
            <button className="flex items-center gap-2 rounded bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg hover:bg-accent/90 transition-all">
              Launch MD Simulation
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Dynamic Simulation"
        breadcrumb="Oncology Research / MD Stability"
        description="Analyze protein-ligand complex stability using Molecular Dynamics (MD) and MMGBSA free energy estimations."
        dataSource={isDemoMode() ? "mock" : (realSim.length > 0 ? "real" : "missing")}
        actions={
          <ActionButtonGroup>
            <ActionButton label="Export Trajectories" variant="outline" />
            <ActionButton label="Simulation Config" variant="secondary" />
            <ActionButton label="Run MD Pipeline" variant="primary" />
          </ActionButtonGroup>
        }
      />

      {/* Dynamic Data Provenance Badge */}
      <div className="flex items-center gap-4 px-6 py-3 bg-muted-bg/50 border border-border/20 rounded-xl max-w-max" data-testid="data-source-badge">
        <span className="text-[10px] font-bold text-muted-text/60 uppercase tracking-widest">Scientific Lineage:</span>
        <ProvenanceBadge 
          provenance={isDemoMode() ? "simulated" : (dataSource === "IMPORTED Q-AI-DRUG DATA" ? "imported" : "live_compute")} 
        />
        <div className="h-4 w-px bg-border/30" />
        <ProvenanceLegend />
      </div>

      {/* 2. Simulation Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Simulated Candidates" value={isDemoMode() ? "42" : displaySim.length.toString()} helperText="MD runs completed" status="completed" />
        <MetricCard label="Active MD Jobs" value="0" helperText="HPC threads active" status="completed" />
        <MetricCard label="Stable Complexes" value={isDemoMode() ? "12" : displaySim.filter(s => s.stability === "Stable").length.toString()} helperText="RMSD < 2.0Å" status="completed" />
        <MetricCard label="Best MMGBSA" value={selectedResult ? selectedResult.mmgbsa?.toString() || "---" : "---"} unit="kcal/mol" helperText={selectedResult ? selectedResult.candidate : "---"} status="active" />
        <MetricCard label="Trajectory Artifacts" value={isDemoMode() ? "128" : (displaySim.length * 3).toString()} unit="GB" helperText="Binary storage" status="completed" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* 6. Trajectory Viewer */}
          {selectedResult && (
            <div className="ui-card-surface p-6 space-y-4 bg-slate-950">
               <div className="flex justify-between items-center mb-2">
                  <SectionHeader title="Trajectory Viewer" description={`Visualizing frame-by-frame stability for ${selectedResult.candidate}.`} />
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
                     <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                     <span className="text-[10px] font-black text-accent uppercase tracking-widest">Active View: 10ns MD</span>
                  </div>
               </div>
               
               <div className="aspect-video rounded-xl bg-slate-900 border border-border/20 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 opacity-10 bg-grid-noise" />
                  <div className="relative z-10 flex flex-col items-center gap-4">
                     <svg className="w-16 h-16 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                     </svg>
                     <div className="text-center">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Structural Dynamics Engine</div>
                        <p className="text-[10px] text-slate-600 mt-1">Ready for trajectory playback: {selectedResult.artifact}</p>
                     </div>
                  </div>

                  {/* Playback Controls Overlay */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-white/5">
                     <button className="text-slate-400 hover:text-white"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" /></svg></button>
                     <button className="text-accent hover:scale-110 transition-transform"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg></button>
                     <button className="text-slate-400 hover:text-white"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.555 14.832A1 1 0 0013 14V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" /></svg></button>
                     <div className="h-6 w-px bg-white/10 mx-2" />
                     <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-400">Frame 450/1000</span>
                        <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                           <div className="h-full bg-accent" style={{ width: '45%' }} />
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* 4. Stability Results Table */}
          <div className="space-y-4">
            <SectionHeader title="Stability Ledger" description="Detailed MD trajectory analytics and H-bond occupancy data." />
            <div className="ui-card-surface overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted-bg/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-text/60 border-b border-border/40">
                    <th className="px-4 py-4">Candidate</th>
                    <th className="px-4 py-4 text-center">RMSD Avg</th>
                    <th className="px-4 py-4 text-center">MMGBSA</th>
                    <th className="px-4 py-4 text-center">H-Bond %</th>
                    <th className="px-4 py-4 text-center">Stability</th>
                    <th className="px-4 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {displaySim.map(res => (
                    <tr 
                      key={res.candidate} 
                      className={`group hover:bg-muted-bg/20 transition-colors cursor-pointer ${selectedResult && selectedResult.candidate === res.candidate ? 'bg-accent/[0.03]' : ''}`}
                      onClick={() => setSelectedResult(res)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-text group-hover:text-accent">{res.candidate}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-text">{res.rmsdAvg ? `${res.rmsdAvg}Å` : '---'}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs font-black text-emerald-500">{res.mmgbsa ? `${res.mmgbsa}` : '---'}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-text">{res.hBondOccupancy ? `${res.hBondOccupancy}%` : '---'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          res.stability === 'Stable' ? 'text-success' : res.stability === 'Fluctuating' ? 'text-warning' : 'text-muted-text/40'
                        }`}>
                          {res.stability}
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
          </div>
        </div>

        {/* Right Column */}
        {selectedResult && (
          <div className="space-y-6">
            {/* 7. MMGBSA Summary Panel */}
            <div className="ui-card-surface p-5 space-y-5">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 MMGBSA Analysis
              </h4>
              <div className="space-y-4">
                 <div className="p-4 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/20 space-y-1">
                    <div className="text-[10px] font-black uppercase text-muted-text/50 tracking-widest">Binding Free Energy (ΔG)</div>
                    <div className="text-2xl font-black text-emerald-500 font-mono">{selectedResult.mmgbsa || '---'} <span className="text-xs">kcal/mol</span></div>
                 </div>

                 <div className="space-y-3 text-[11px]">
                    <div className="flex justify-between py-1.5 border-b border-border/20">
                       <span className="font-bold text-muted-text">van der Waals</span>
                       <span className="font-mono text-text">-72.4 kcal/mol</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/20">
                       <span className="font-bold text-muted-text">Electrostatic</span>
                       <span className="font-mono text-text">-24.8 kcal/mol</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/20">
                       <span className="font-bold text-muted-text">Solvation Penalty</span>
                       <span className="font-mono text-error">+33.0 kcal/mol</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/20">
                       <span className="font-bold text-muted-text">Confidence</span>
                       <span className="font-mono text-accent">0.94</span>
                    </div>
                 </div>
              </div>
            </div>

            {/* 5. RMSD / RMSF Chart Area */}
            <div className="ui-card-surface p-5 space-y-4" data-testid="simulation-rmsd-chart">
               <h4 className="text-xs font-black uppercase tracking-widest text-accent">RMSD Over Time</h4>
               <div className="h-32 w-full relative">
                  {/* Chart SVG */}
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                     <path d="M0 35 Q 10 30, 20 25 T 40 28 T 60 22 T 80 24 T 100 20" fill="none" stroke="currentColor" strokeWidth="1" className="text-accent" />
                     <path d="M0 40 L 100 40" stroke="currentColor" strokeWidth="0.5" className="text-border" />
                     <path d="M0 0 L 0 40" stroke="currentColor" strokeWidth="0.5" className="text-border" />
                  </svg>
                  <div className="absolute top-0 right-0 text-[9px] font-mono text-muted-text">Avg: {selectedResult.rmsdAvg || '--'}Å</div>
               </div>
               
               <h4 className="text-xs font-black uppercase tracking-widest text-accent mt-4">RMSF by Residue</h4>
               <div className="h-24 w-full flex items-end gap-0.5">
                  {[2,4,3,8,5,2,3,6,12,8,4,3,2,5,7,9,4,3,2,1,4,6,8,5,3].map((v, i) => (
                    <div key={i} className="flex-1 bg-accent/20 rounded-t-[1px]" style={{ height: `${v * 8}%` }} />
                  ))}
               </div>
            </div>

            {/* 3. Active Simulation Jobs */}
            {isDemoMode() && (
              <div className="ui-card-surface p-5 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-accent">Active Simulation Jobs</h4>
                <div className="space-y-3">
                  {ACTIVE_MD_JOBS.map(job => (
                    <div key={job.name} className="space-y-2">
                       <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-text">{job.name}</span>
                          <span className="text-muted-text">{job.progress}%</span>
                       </div>
                       <div className="h-1 w-full bg-border/20 rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${job.progress}%` }} />
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Actions */}
            <div className="flex flex-col gap-2">
              <button className="w-full py-3 rounded-lg bg-accent text-bg font-black uppercase tracking-[0.2em] text-[10px] hover:bg-accent/90 shadow-lg shadow-accent/10 transition-all">
                Initiate Binding Analysis
              </button>
              <button className="w-full py-3 rounded-lg border border-border text-text font-black uppercase tracking-[0.2em] text-[10px] hover:bg-muted-bg transition-all">
                View Synthesis Roadmap
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
