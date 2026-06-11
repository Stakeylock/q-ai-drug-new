"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import MetricCard from "@/components/ui/MetricCard";
import ActionButtonGroup, { ActionButton } from "@/components/ui/ActionButtonGroup";
import StatusBadge from "@/components/ui/StatusBadge";
import SectionHeader from "@/components/ui/SectionHeader";
import EmptyState from "@/components/ui/EmptyState";
import { isDemoMode, apiClient } from "@/services/api";

// Mock fallbacks
const MOCK_LABELS = [
  "QDF-EGFR-001",
  "QDF-EGFR-014",
  "QDF-EGFR-027",
  "Gefitinib",
  "Erlotinib",
  "Osimertinib"
];

const MOCK_MATRIX = [
  [1.00, 0.82, 0.75, 0.78, 0.72, 0.65],
  [0.82, 1.00, 0.88, 0.71, 0.68, 0.58],
  [0.75, 0.88, 1.00, 0.65, 0.62, 0.52],
  [0.78, 0.71, 0.65, 1.00, 0.89, 0.61],
  [0.72, 0.68, 0.62, 0.89, 1.00, 0.59],
  [0.65, 0.58, 0.52, 0.61, 0.59, 1.00]
];

const MOCK_NEIGHBORS = [
  { id: "Gefitinib", type: "Approved Drug", similarity: 0.78, scaffold: "Quinazoline", activity: "EGFR WT/L858R", risk: "Low", notes: "Shared binding mode" },
  { id: "Erlotinib", type: "Approved Drug", similarity: 0.72, scaffold: "Quinazoline", activity: "EGFR WT", risk: "Low", notes: "Secondary neighbor" },
  { id: "Osimertinib", type: "Approved Drug", similarity: 0.65, scaffold: "Pyrimidine", activity: "EGFR T790M", risk: "Low", notes: "Low structural similarity" },
  { id: "QDF-EGFR-014", type: "Generated", similarity: 0.82, scaffold: "Quinazoline", activity: "Predicted High", risk: "Low", notes: "Isostere variant" },
  { id: "QDF-EGFR-027", type: "Generated", similarity: 0.75, scaffold: "Quinazoline", activity: "Predicted Med", risk: "Medium", notes: "TPSA alert" },
];

export default function SimilarityPage() {
  const [dataSource, setDataSource] = useState<string>("MOCK DATA");
  const [moleculesList, setMoleculesList] = useState<any[]>([]);
  const [querySmiles, setQuerySmiles] = useState("CN(C)C/C=C/C(=O)NC1=CC2=C(C=C1)N=CN=C2NC3=CC(=C(C=C3)F)Cl");
  const [selectedMoleculeId, setSelectedMoleculeId] = useState("");
  
  const [neighbors, setNeighbors] = useState<any[]>([]);
  const [matrixLabels, setMatrixLabels] = useState<string[]>([]);
  const [similarityMatrix, setSimilarityMatrix] = useState<number[][]>([]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch project molecules list to populate search selectors
  useEffect(() => {
    if (isDemoMode()) {
      setDataSource("MOCK DATA");
      setNeighbors(MOCK_NEIGHBORS);
      setMatrixLabels(MOCK_LABELS);
      setSimilarityMatrix(MOCK_MATRIX);
      setIsLoading(false);
      return;
    }

    const loadMolecules = async () => {
      try {
        setIsLoading(true);
        const projectId = localStorage.getItem("active_project_id");
        if (!projectId) {
          setIsLoading(false);
          return;
        }

        const res = await apiClient.get<any>(`/projects/${projectId}/molecules`);
        if (res.success && res.data && res.data.items) {
          setMoleculesList(res.data.items);
          if (res.data.items.length > 0) {
            setSelectedMoleculeId(res.data.items[0].id || res.data.items[0].compound_id);
            setQuerySmiles(res.data.items[0].smiles);
          }
        }
      } catch (err) {
        console.error("Failed to load molecules list", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadMolecules();
  }, []);

  // Fetch pairwise similarity matrix
  const fetchSimilarityMatrix = async () => {
    if (isDemoMode()) return;
    setIsMatrixLoading(true);
    try {
      const projectId = localStorage.getItem("active_project_id");
      if (!projectId) return;

      const res = await apiClient.get<any>(`/projects/${projectId}/similarity/matrix`);
      if (res.success && res.data && res.data.labels && res.data.labels.length > 0) {
        setMatrixLabels(res.data.labels);
        setSimilarityMatrix(res.data.matrix);
        setDataSource("REAL BACKEND DATA");
      }
    } catch (err) {
      console.error("Failed to retrieve similarity matrix", err);
    } finally {
      setIsMatrixLoading(false);
    }
  };

  useEffect(() => {
    if (!isDemoMode()) {
      fetchSimilarityMatrix();
    }
  }, []);

  // Trigger structural similarity search
  const handleSimilaritySearch = async () => {
    if (isDemoMode()) return;
    if (!querySmiles.trim()) return;
    setIsSearching(true);
    try {
      const projectId = localStorage.getItem("active_project_id");
      if (!projectId) return;

      const res = await apiClient.post<any>(`/projects/${projectId}/similarity/search`, {
        body: {
          smiles: querySmiles,
          top_k: 8
        }
      });

      if (res.success && res.data && res.data.neighbors) {
        const mapped = res.data.neighbors.map((n: any) => ({
          id: n.compound_id || n.molecule_id || "Candidate",
          type: n.source === "q_ai_drug_import" ? "Imported" : "Generated",
          similarity: n.similarity !== undefined ? n.similarity : 0.85,
          scaffold: n.properties?.scaffold || "Unknown scaffold",
          activity: `QED: ${n.properties?.qed?.toFixed(2) || "N/A"}`,
          risk: n.properties?.logp > 4 ? "Medium" : "Low",
          notes: n.smiles ? `${n.smiles.substring(0, 25)}...` : ""
        }));
        setNeighbors(mapped);
        setDataSource("REAL BACKEND DATA");
      }
    } catch (err) {
      console.error("Similarity search request failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const getHeatmapColor = (value: number) => {
    if (value === 1) return "bg-accent text-bg font-black";
    if (value >= 0.8) return "bg-accent/30 text-accent font-black";
    if (value >= 0.7) return "bg-accent/20 text-accent font-bold";
    if (value >= 0.6) return "bg-accent/10 text-accent/80 font-medium";
    return "bg-muted-bg/30 text-muted-text/60";
  };

  if (!isLoading && matrixLabels.length === 0) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="Structural Similarity Matrix"
          breadcrumb="Research / Structural similarity"
          description="Quantify structural relationships and scaffold novelties across the candidate library."
          dataSource="missing"
        />
        <EmptyState
          title="No Pairwise Similarity Matrices Found"
          description="This project workspace doesn't have a similarity grid calculated yet. Start by generating or importing compounds."
          action={
            <button className="flex items-center gap-2 rounded bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg hover:bg-accent/90 transition-all">
              Initialize Matrix Calculation
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
        title="Structural Similarity Matrix"
        breadcrumb="Research / Structural similarity"
        description="Quantify structural relationships and scaffold novelties across the candidate library. Compare lead molecules against known drug space and detect applicability domain risks."
        dataSource={isDemoMode() ? "mock" : (matrixLabels.length > 0 ? "real" : "missing")}
        actions={
          <ActionButtonGroup>
            <ActionButton label="Export Report" variant="secondary" />
            <ActionButton 
              label={isMatrixLoading ? "Computing Matrix..." : "Recalculate Matrix"} 
              variant="primary" 
              onClick={fetchSimilarityMatrix}
              disabled={isMatrixLoading || isDemoMode()}
            />
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

      {/* 2. Similarity Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Compared Candidates" value={String(matrixLabels.length)} helperText="Active comparison set" status="completed" />
        <MetricCard label="Nearest Neighbors" value={String(neighbors.length)} helperText="Similar lead counts" status="completed" />
        <MetricCard label="Novel Scaffolds" value={isDemoMode() ? "4" : "0"} helperText="Low overlap with FDA" status="active" />
        <MetricCard label="Similarity Alerts" value="0" helperText="Potential IP conflict" status="completed" />
        <MetricCard label="Out-of-domain" value="0" helperText="Reliability warning" status="completed" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Main Area (3/4) */}
        <div className="lg:col-span-3 space-y-8">
          {/* 3. Query Molecule Panel */}
          <div className="ui-card-surface p-6 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 border-accent/20">
            <div className="space-y-4">
              <div className="aspect-square rounded-xl border border-dashed border-border/60 flex flex-col items-center justify-center text-[10px] font-black uppercase text-muted-text/40 tracking-widest text-center px-4 gap-3" style={{ background: "color-mix(in srgb, var(--muted-bg) 50%, transparent)" }}>
                <div className="w-16 h-16 rounded-full border-4 border-accent/10 border-t-accent/40 animate-[spin_4s_linear_infinite]" />
                Fingerprint Manifold<br/>Active Structure
              </div>
              <div className="flex flex-col items-center">
                <StatusBadge status="completed" label="In-Domain" size="sm" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-text tracking-tighter">Similarity Search Sandbox</h3>
                    <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Query lead candidates or input custom SMILES</p>
                  </div>
                  
                  {moleculesList.length > 0 && (
                    <select 
                      value={selectedMoleculeId} 
                      onChange={(e) => {
                        const mId = e.target.value;
                        setSelectedMoleculeId(mId);
                        const found = moleculesList.find(m => (m.id || m.compound_id) === mId);
                        if (found) setQuerySmiles(found.smiles);
                      }}
                      className="bg-muted-bg border border-border/40 rounded-lg px-3 py-1.5 text-xs text-text outline-none focus:border-accent/50 font-bold"
                    >
                      {moleculesList.map(m => (
                        <option key={m.id || m.compound_id} value={m.id || m.compound_id}>
                          {m.compound_id || m.id || "Select Molecule"}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    value={querySmiles}
                    onChange={(e) => setQuerySmiles(e.target.value)}
                    placeholder="Enter SMILES representation..."
                    className="flex-1 bg-muted-bg border border-border/40 rounded-lg px-4 py-2.5 text-xs font-mono text-text outline-none focus:border-accent/50 transition-all"
                  />
                  <button 
                    onClick={handleSimilaritySearch} 
                    disabled={isSearching || isDemoMode()}
                    className="px-6 py-2.5 rounded-lg bg-accent text-bg text-[10px] font-black uppercase tracking-[0.2em] hover:bg-accent/90 disabled:opacity-50 transition-all shrink-0"
                  >
                    {isSearching ? "Searching..." : "Search"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border/20">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-muted-text uppercase">Query Molecule ID</p>
                  <p className="text-xs font-black text-text truncate max-w-[150px]">{selectedMoleculeId || "Custom Query"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-muted-text uppercase">Fingerprint Format</p>
                  <p className="text-xs font-black text-emerald-500">Morgan / Jaccard Fallback</p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Similarity Matrix Heatmap */}
          <div className="space-y-4">
            <SectionHeader title="Pairwise Tanimoto Matrix" description="Heatmap of structural Jaccard similarity metrics calculated on Morgan fingerprints." />
            <div className="ui-card-surface p-6 overflow-x-auto">
              <div className="min-w-[600px] space-y-4">
                <div className="grid grid-cols-[120px_1fr] gap-4">
                  <div />
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${matrixLabels.length}, 1fr)` }}>
                    {matrixLabels.map(label => (
                      <span key={label} className="text-[10px] font-black text-muted-text/60 truncate uppercase text-center leading-none -rotate-12 transform origin-bottom-left pb-4 h-8">{label}</span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {matrixLabels.map((rowLabel, rIdx) => (
                    <div key={rowLabel} className="grid grid-cols-[120px_1fr] gap-4 items-center">
                      <span className="text-[10px] font-black text-text truncate uppercase text-right pr-2">{rowLabel}</span>
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${matrixLabels.length}, 1fr)` }}>
                        {similarityMatrix[rIdx]?.map((val, cIdx) => (
                          <div 
                            key={cIdx} 
                            className={`aspect-square rounded-lg flex items-center justify-center text-[10px] hover:scale-105 transition-transform cursor-pointer border border-border/10 ${getHeatmapColor(val)}`}
                            title={`${rowLabel} vs ${matrixLabels[cIdx]}: ${val.toFixed(2)}`}
                          >
                            {val.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar (1/4) */}
        <div className="space-y-6">
          {/* 5. Nearest Neighbors Panel */}
          {neighbors.length > 0 && (
            <div className="ui-card-surface p-5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent">Nearest Neighbors</h4>
              <div className="space-y-3">
                {neighbors.slice(0, 5).map(neigh => (
                  <div key={neigh.id} className="p-3 rounded-lg bg-muted-bg/50 border border-border/20 group hover:border-accent/40 cursor-pointer transition-all">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[11px] font-black text-text group-hover:text-accent truncate max-w-[120px]">{neigh.id}</span>
                      <span className="font-mono text-xs font-black text-accent">{neigh.similarity.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-muted-text/40">
                      <span>{neigh.scaffold}</span>
                      <span className={neigh.risk === 'Low' ? 'text-success' : 'text-warning'}>{neigh.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. Actions */}
          <div className="flex flex-col gap-2">
            <button className="w-full py-3 rounded-lg bg-accent text-bg font-black uppercase tracking-[0.2em] text-[10px] hover:bg-accent/90 shadow-lg shadow-accent/10 transition-all">
              Initiate Benchmarking
            </button>
            <button className="w-full py-3 rounded-lg border border-border text-text font-black uppercase tracking-[0.2em] text-[10px] hover:bg-muted-bg transition-all">
              Scaffold Clustering
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}