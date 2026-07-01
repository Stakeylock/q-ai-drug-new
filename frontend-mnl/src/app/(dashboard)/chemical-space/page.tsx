"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import PageHeader from "@/components/ui/PageHeader";
import MetricCard from "@/components/ui/MetricCard";
import ActionButtonGroup, { ActionButton } from "@/components/ui/ActionButtonGroup";
import StatusBadge from "@/components/ui/StatusBadge";
import SectionHeader from "@/components/ui/SectionHeader";
import EmptyState from "@/components/ui/EmptyState";
import { isDemoMode, apiClient } from "@/services/api";

const EmbeddingPlot = dynamic(() => import("@/components/embeddings/EmbeddingPlot"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] flex flex-col items-center justify-center rounded-2xl border animate-pulse bg-muted-bg/30 border-border/20">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="mt-4 text-xs font-black uppercase tracking-widest text-muted-text/50">Loading Chemical Space Manifold...</span>
    </div>
  ),
});
import type { EmbeddingPoint } from "@/types/api";

// Demo data used only when explicit demo mode is enabled.
const MOCK_POINTS: EmbeddingPoint[] = [
  { x: 1.5, y: -2.2, molecule_id: "QDF-EGFR-001", dataset: "Generated", qed: 0.85, mw: 421.4, logp: 3.82, source: "generated" },
  { x: -3.1, y: 4.2, molecule_id: "FDA-101", dataset: "FDA", qed: 0.72, mw: 320.5, logp: 2.1, source: "fda" },
  { x: 2.4, y: 1.8, molecule_id: "HIT-501", dataset: "Screening", qed: 0.65, mw: 380.0, logp: 3.2, source: "dataset" }
];

const CLUSTERS = [
  { name: "quinazoline-like", count: 450, avgScore: -9.2, novelty: "High", color: "bg-indigo-500" },
  { name: "pyrimidine-like", count: 320, avgScore: -8.8, novelty: "Medium", color: "bg-cyan-500" },
  { name: "indazole-like", count: 210, avgScore: -8.5, novelty: "High", color: "bg-emerald-500" },
  { name: "macrocycle-like", count: 120, avgScore: -8.2, novelty: "Extreme", color: "bg-amber-500" },
  { name: "approved-drug-like", count: 73, avgScore: -7.5, novelty: "Low", color: "bg-success" },
];

const SCAFFOLDS = [
  { name: "N-phenylquinazolin-4-amine", count: 124, avgDocking: -9.4, risk: "Low", novelty: 0.45 },
  { name: "pyrido[2,3-d]pyrimidine", count: 86, avgDocking: -8.9, risk: "Low", novelty: 0.72 },
  { name: "1H-indazol-3-amine", count: 62, avgDocking: -8.6, risk: "Medium", novelty: 0.81 },
  { name: "macrocyclic peptide mimic", count: 34, avgDocking: -8.1, risk: "Low", novelty: 0.94 },
];

const PROPERTIES = [
  { label: "Molecular Weight", val: "421.4", unit: "g/mol", dist: [20, 40, 80, 100, 60, 30] },
  { label: "LogP (Lipophilicity)", val: "3.82", unit: "o/w", dist: [10, 30, 70, 90, 80, 40] },
  { label: "QED (Drug-likeness)", val: "0.85", unit: "score", dist: [5, 15, 45, 95, 75, 25] },
];

export default function ChemicalSpacePage() {
  const [dataSource, setDataSource] = useState<string>(isDemoMode() ? "MOCK DATA" : "REAL BACKEND DATA");
  const [points, setPoints] = useState<EmbeddingPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<EmbeddingPoint | null>(null);
  const [colorMode, setColorMode] = useState<"dataset" | "qed">("dataset");
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPoints = async (forceRecompute: boolean = false) => {
    try {
      setIsLoading(true);
      const projectId = localStorage.getItem("active_project_id");
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      const res = await apiClient.get<any>(`/projects/${projectId}/chemical-space`, {
        params: forceRecompute ? { recompute: true } : undefined
      });

      if (res.success && res.data && res.data.points) {
        const mapped = res.data.points.map((p: any) => ({
          x: p.x,
          y: p.y,
          molecule_id: p.compound_id || p.molecule_id,
          dataset: p.status || "Generated",
          qed: p.qed || 0.0,
          mw: p.mw || 0.0,
          logp: p.logp || 0.0,
          source: p.status === "uploaded" ? "dataset" : "generated"
        }));
        setPoints(mapped);
        if (mapped.length > 0) {
          setSelectedPoint(mapped[0]);
        }
        setDataSource("REAL BACKEND DATA");
      }
    } catch (err) {
      console.error("Failed to load chemical space points", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isDemoMode()) {
      setDataSource("MOCK DATA");
      setPoints(MOCK_POINTS);
      setSelectedPoint(MOCK_POINTS[0]);
      setIsLoading(false);
      return;
    }
    fetchPoints();
  }, []);

  const handleRecompute = async () => {
    if (isDemoMode()) return;
    setIsRecomputing(true);
    try {
      const projectId = localStorage.getItem("active_project_id");
      if (!projectId) return;

      const res = await apiClient.post<any>(`/projects/${projectId}/chemical-space/recompute`, {
        body: {
          method: "deterministic_placeholder",
          limit: 1000,
          store: true
        }
      });
      if (res.success) {
        await fetchPoints();
      }
    } catch (err) {
      console.error("Recompute chemical space coordinates failed", err);
    } finally {
      setIsRecomputing(false);
    }
  };

  const displayPoints = isDemoMode() ? MOCK_POINTS : points;
  const displayClusters = useMemo(() => {
    if (isDemoMode()) {
      return CLUSTERS;
    }

    const colors = ["bg-indigo-500", "bg-cyan-500", "bg-emerald-500", "bg-amber-500", "bg-success"];
    const counts = displayPoints.reduce((acc, point) => {
      const key = point.dataset || point.source || "Unclassified";
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map<string, number>());

    return Array.from(counts.entries()).map(([name, count], index) => ({
      name,
      count,
      avgScore: 0,
      novelty: "Measured",
      color: colors[index % colors.length],
    }));
  }, [displayPoints]);

  if (!isLoading && displayPoints.length === 0) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="Chemical Space Topography"
          breadcrumb="Research / Spatial intelligence"
          description="Navigate the multidimensional landscape of molecular embeddings."
          dataSource="missing"
        />
        <EmptyState
          title="No Embedded Molecular Points Found"
          description="This project workspace doesn't have chemical space points calculated yet. Run a t-SNE or UMAP spatial embedding computation for your candidate compounds."
          action={
            <button className="flex items-center gap-2 rounded bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg hover:bg-accent/90 transition-all">
              Compute Embedding Space
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
        title="Chemical Space Topography"
        breadcrumb="Research / Spatial intelligence"
        description="Navigate the multidimensional landscape of molecular embeddings. Identify scaffold clusters, analyze diversity gradients, and detect novel regions relative to known pharmaceutical space."
        dataSource={isDemoMode() ? "mock" : (points.length > 0 ? "real" : "missing")}
        actions={
          <ActionButtonGroup>
            <ActionButton 
              label={isRecomputing ? "Recomputing..." : "Recompute Space"} 
              variant="primary" 
              onClick={handleRecompute} 
              disabled={isRecomputing || isDemoMode()} 
            />
            <ActionButton label="Export Embedding" variant="secondary" />
          </ActionButtonGroup>
        }
      />

      {/* Dynamic Data Provenance Badge */}
      <div className="flex items-center gap-2 px-6 py-2 bg-muted-bg border border-border/20 rounded-lg max-w-max" data-testid="data-source-badge">
        <span className="text-[10px] font-bold text-muted-text/60 uppercase tracking-widest">Data Source:</span>
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
          isDemoMode() ? "bg-warning/20 text-warning" :
          dataSource === "REAL BACKEND DATA" ? "bg-accent/20 text-accent" : "bg-warning/20 text-warning"
        }`}>
          {isDemoMode() ? "MOCK DATA" : dataSource}
        </span>
      </div>

      {/* 2. Chemical Space Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Embedded Molecules" value={String(displayPoints.length)} helperText="Total active manifold" status="completed" />
        <MetricCard label="Scaffold Clusters" value={isDemoMode() ? "42" : String(displayClusters.length)} helperText="Unique structural types" status="completed" />
        <MetricCard label="Novel Region Leads" value={isDemoMode() ? "186" : displayPoints.filter(p => p.qed > 0.8).length.toString()} helperText="Low similarity to FDA" status="active" />
        <MetricCard label="Approved Neighbors" value={isDemoMode() ? "73" : "0"} helperText="Similar to known drugs" status="completed" />
        <MetricCard label="Applicability Alerts" value="0" helperText="Out-of-domain detections" status="completed" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Main Content Area (3/4) */}
        <div className="lg:col-span-3 space-y-8">
          {/* 3. Embedding Visualization Panel */}
          <div className="h-[600px] relative">
            <EmbeddingPlot 
              data={displayPoints} 
              colorMode={colorMode} 
              onPointClick={(p) => setSelectedPoint(p)} 
            />
            
            {/* View Controls Overlay */}
            <div className="absolute top-20 right-6 z-20 flex flex-col gap-2">
              <button 
                onClick={() => setColorMode("dataset")}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${
                  colorMode === 'dataset' ? 'bg-primary text-white border-primary shadow-lg' : 'backdrop-blur-md border-border/40 text-text-secondary'
                }`}
                style={{ background: colorMode === 'dataset' ? "" : "color-mix(in srgb, var(--card) 80%, transparent)" }}
              >
                Color by Source
              </button>
              <button 
                onClick={() => setColorMode("qed")}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${
                  colorMode === 'qed' ? 'bg-primary text-white border-primary shadow-lg' : 'backdrop-blur-md border-border/40 text-text-secondary'
                }`}
                style={{ background: colorMode === 'qed' ? "" : "color-mix(in srgb, var(--card) 80%, transparent)" }}
              >
                Color by QED
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* 6. Scaffold Distribution */}
            <div className="space-y-4">
              <SectionHeader title="Scaffold Distribution" description="Primary structural frameworks and their average performance metrics." />
              <div className="space-y-3">
                {SCAFFOLDS.map(scaffold => (
                  <div key={scaffold.name} className="ui-card-surface p-4 flex items-center justify-between group hover:border-accent/40 transition-all cursor-pointer">
                    <div className="min-w-0">
                      <div className="text-[11px] font-black text-text truncate uppercase tracking-tight">{scaffold.name}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-muted-text">Count: {scaffold.count}</span>
                        <span className="text-[10px] font-bold text-emerald-500">Avg: {scaffold.avgDocking}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-black text-accent">{(scaffold.novelty * 100).toFixed(0)}%</div>
                      <div className="text-[9px] font-bold text-muted-text uppercase">Novelty</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7. Property Distribution */}
            <div className="space-y-4">
              <SectionHeader title="Property Gradients" description="Distribution of physicochemical properties across the embedded space." />
              <div className="space-y-4">
                {PROPERTIES.map(prop => (
                  <div key={prop.label} className="ui-card-surface p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{prop.label}</span>
                      <span className="text-[10px] font-black text-primary">
                        {selectedPoint ? (prop.label === "QED (Drug-likeness)" ? selectedPoint.qed : (prop.label === "Molecular Weight" ? selectedPoint.mw : selectedPoint.logp)) : "---"} 
                        <span className="text-[8px] text-muted-text/50"> {prop.unit}</span>
                      </span>
                    </div>
                    <div className="h-6 flex items-end gap-1">
                      {prop.dist.map((v, i) => (
                        <div key={i} className="flex-1 bg-primary/10 rounded-t-[1px]" style={{ height: `${v}%` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar (1/4) */}
        <div className="space-y-6">
          {/* 5. Candidate Highlight Panel */}
          {selectedPoint && (
            <div className="ui-card-surface p-5 space-y-5 border-accent/30 bg-accent/[0.02]">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Candidate Focus
              </h4>
              
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-xl font-black text-text tracking-tighter truncate" title={selectedPoint.molecule_id}>{selectedPoint.molecule_id}</span>
                  <span className="text-[10px] font-bold text-muted-text uppercase tracking-[0.2em]">{selectedPoint.dataset} Manifold</span>
                </div>

                <div className="grid grid-cols-1 gap-y-3 pt-4 border-t border-border/20">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-muted-text">MW</span>
                    <span className="text-[11px] font-black text-text">{selectedPoint.mw} g/mol</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-muted-text">LogP</span>
                    <span className="text-[11px] font-black text-text">{selectedPoint.logp}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-muted-text">QED score</span>
                    <span className="text-[11px] font-black text-accent">{selectedPoint.qed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-muted-text">Applicability Domain</span>
                    <span className="text-[11px] font-black text-text">Inside (High Conf)</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border/40 shadow-sm space-y-2" style={{ background: "var(--card)" }}>
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-muted-text/60">ADMET Risk</span>
                      <span className="text-success">Low</span>
                   </div>
                   <div className="h-1.5 w-full bg-border/20 rounded-full overflow-hidden">
                      <div className="h-full bg-success" style={{ width: '15%' }} />
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Cluster Legend */}
          <div className="ui-card-surface p-5 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-text-secondary/60">Manifold Clusters</h4>
            <div className="space-y-2">
              {displayClusters.map(cluster => (
                <div key={cluster.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted-bg/50 cursor-pointer transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${cluster.color}`} />
                    <span className="text-[11px] font-bold text-text truncate">{cluster.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-muted-text/50">{cluster.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 8. Actions */}
          <div className="flex flex-col gap-2">
            <button className="w-full py-3 rounded-lg bg-accent text-bg font-black uppercase tracking-[0.2em] text-[10px] hover:bg-accent/90 shadow-lg shadow-accent/10 transition-all">
              Filter Novel Regions
            </button>
            <button className="w-full py-3 rounded-lg border border-border text-text font-black uppercase tracking-[0.2em] text-[10px] hover:bg-muted-bg transition-all">
              Compare Scaffolds
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
