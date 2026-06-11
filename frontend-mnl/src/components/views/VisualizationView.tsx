"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import PageHeader from "@/components/ui/PageHeader";
import MetricCard from "@/components/ui/MetricCard";
import ActionButtonGroup, { ActionButton } from "@/components/ui/ActionButtonGroup";
import StatusBadge from "@/components/ui/StatusBadge";
import SectionHeader from "@/components/ui/SectionHeader";
import EmptyState from "@/components/ui/EmptyState";
import { isDemoMode, apiClient } from "@/services/api";

const ThreeDMoleculeViewer = dynamic(() => import("@/components/molecules/ThreeDMoleculeViewer"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[600px] flex flex-col items-center justify-center rounded-2xl border animate-pulse bg-muted-bg/30 border-border/20">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="mt-4 text-xs font-black uppercase tracking-widest text-muted-text/50">Initializing 3D Workbench...</span>
    </div>
  ),
});

// Mock data fallbacks for the program if backend has no results yet
const MOCK_POSES = [
  { id: "Pose 01", affinity: -10.2, cnnScore: 0.942, rmsd: 1.2, status: "completed", result_id: "mock_1", pose_file_id: null },
  { id: "Pose 02", affinity: -9.8, cnnScore: 0.885, rmsd: 0.8, status: "completed", result_id: "mock_2", pose_file_id: null },
  { id: "Pose 03", affinity: -9.5, cnnScore: 0.810, rmsd: 1.5, status: "completed", result_id: "mock_3", pose_file_id: null },
];

const MOCK_RESIDUES = [
  { name: "MET793", type: "H-Bond", distance: "2.8Å", confidence: 98 },
  { name: "LYS745", type: "Salt Bridge", distance: "3.2Å", confidence: 95 },
  { name: "ASP855", type: "Hydrophobic", distance: "3.8Å", confidence: 92 },
  { name: "THR790", type: "Gatekeeper", distance: "4.2Å", confidence: 99 },
];

const MOCK_INTERACTIONS = [
  { label: "Hydrogen Bonds", count: 4, color: "bg-cyan-500" },
  { label: "Hydrophobic Contacts", count: 12, color: "bg-emerald-500" },
  { label: "Pi-Stacking", count: 2, color: "bg-indigo-500" },
  { label: "Salt Bridges", count: 1, color: "bg-amber-500" },
];

function VisualizationViewContent({ projectId: propProjectId }: { projectId?: string }) {
  const searchParams = useSearchParams();
  const queryResultId = searchParams.get("result_id");
  const queryPoseFileId = searchParams.get("pose_file_id");

  const [dataSource, setDataSource] = useState<string>("MOCK DATA");
  const [proteins, setProteins] = useState<any[]>([]);
  const [ligands, setLigands] = useState<any[]>([]);
  const [poses, setPoses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [selectedProteinId, setSelectedProteinId] = useState<string>("");
  const [selectedLigandId, setSelectedLigandId] = useState<string>("");
  const [selectedPose, setSelectedPose] = useState<any>(null);

  const [viewerSource, setViewerSource] = useState<any>(null);
  const [receptorSource, setReceptorSource] = useState<any>(null);
  const [viewerLoading, setViewerLoading] = useState<boolean>(false);

  // Interaction network & residue states
  const [residues, setResidues] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);

  // Stats cards states
  const [stats, setStats] = useState({
    affinity: "-10.2",
    cnnScore: "0.94",
    hBondsCount: "4",
    rmsd: "1.2Å"
  });

  // Fetch initial viewer assets
  useEffect(() => {
    if (isDemoMode()) {
      setDataSource("MOCK DATA");
      setPoses(MOCK_POSES);
      setSelectedPose(MOCK_POSES[0]);
      setResidues(MOCK_RESIDUES);
      setInteractions(MOCK_INTERACTIONS);
      setIsLoading(false);
      return;
    }

    const fetchAssets = async () => {
      try {
        setIsLoading(true);
        const projectId = propProjectId || localStorage.getItem("active_project_id");
        if (!projectId) {
          setIsLoading(false);
          return;
        }

        const res = await apiClient.get<any>(`/projects/${projectId}/viewer/assets`);
        if (res.success && res.data && res.data.assets) {
          const list: any[] = res.data.assets;
          
          const proteinList = list.filter(a => a.asset_type === "protein_structure");
          const ligandList = list.filter(a => a.asset_type === "ligand");
          const poseList = list.filter(a => a.asset_type === "docking_pose" || a.asset_type === "gnina_pose");

          setProteins(proteinList);
          setLigands(ligandList);
          
          if (poseList.length > 0) {
            const mappedPoses = poseList.map((p, idx) => ({
              id: p.metadata?.compound_id || p.filename || `Pose ${idx + 1}`,
              affinity: p.metadata?.binding_affinity_kcal_mol || -8.5,
              cnnScore: p.metadata?.cnn_pose_score || 0.85,
              rmsd: 1.0,
              status: "completed",
              result_id: p.linked_result_id || p.asset_id,
              pose_file_id: p.file_id
            }));
            setPoses(mappedPoses);
            setDataSource("REAL BACKEND DATA");

            // Handle query deep linking if specified
            if (queryResultId) {
              const matched = mappedPoses.find(p => p.result_id === queryResultId);
              if (matched) {
                setSelectedPose(matched);
              } else {
                setSelectedPose(mappedPoses[0]);
              }
            } else {
              setSelectedPose(mappedPoses[0]);
            }
          } else {
            setPoses([]);
            setSelectedPose(null);
            setDataSource("REAL BACKEND DATA");
          }

          if (proteinList.length > 0) {
            setSelectedProteinId(proteinList[0].asset_id);
          }
          if (ligandList.length > 0) {
            setSelectedLigandId(ligandList[0].asset_id);
          }
        }
      } catch (err) {
        console.error("Failed to retrieve viewer assets", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssets();
  }, [queryResultId, propProjectId]);

  // Handle direct file query parameter fallback
  useEffect(() => {
    if (isDemoMode()) return;
    if (queryPoseFileId) {
      setSelectedPose({
        id: "Deep Linked Conformation",
        affinity: -9.5,
        cnnScore: 0.91,
        rmsd: 1.1,
        status: "completed",
        result_id: queryResultId || "deep_link",
        pose_file_id: queryPoseFileId
      });
    }
  }, [queryPoseFileId, queryResultId]);

  // When selected pose changes, fetch details & download pose file
  useEffect(() => {
    if (isDemoMode()) {
      if (selectedPose) {
        setStats({
          affinity: String(selectedPose.affinity),
          cnnScore: String(selectedPose.cnnScore),
          hBondsCount: "4",
          rmsd: `${selectedPose.rmsd}Å`
        });
        setViewerSource({
          format: "smiles",
          value: "CC(=O)OC1=CC=CC=C1C(=O)O",
          label: selectedPose.id
        });
      }
      return;
    }

    if (!selectedPose || !selectedPose.pose_file_id) {
      setViewerSource(null);
      setReceptorSource(null);
      return;
    }

    const fetchPoseData = async () => {
      setViewerLoading(true);
      try {
        const projectId = propProjectId || localStorage.getItem("active_project_id");
        if (!projectId) return;

        // Fetch pose metadata
        const metadataRes = await apiClient.get<any>(`/projects/${projectId}/viewer/pose/${selectedPose.result_id}`);
        if (metadataRes.success && metadataRes.data) {
          const data = metadataRes.data;
          
          // Update stats dynamically
          const aff = data.scores?.binding_affinity_kcal_mol !== undefined ? String(data.scores.binding_affinity_kcal_mol) : "-8.5";
          const cnn = data.scores?.cnn_pose_score !== undefined ? String(data.scores.cnn_pose_score) : "0.85";
          setStats(prev => ({
            ...prev,
            affinity: aff,
            cnnScore: cnn,
            rmsd: selectedPose.rmsd ? `${selectedPose.rmsd}Å` : "1.0Å"
          }));

          // Download visualizable structure file content
          const token = localStorage.getItem("auth_token") || localStorage.getItem("qai_access_token") || "";
          const downloadUrl = `/api/v1/files/${data.pose_file_id}/download`;
          
          const fileRes = await fetch(downloadUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });

          if (fileRes.ok) {
            const structureText = await fileRes.text();
            setViewerSource({
              format: data.viewer_format === "sdf" ? "sdf" : (data.viewer_format === "pdb" ? "pdb" : "sdf"),
              value: structureText,
              label: selectedPose.id
            });
          }

          // Resolve and download receptor structure
          const targetId = data.target_id;
          const proteinAsset = proteins.find(p => 
            p.metadata?.target_id === targetId || 
            p.metadata?.target === targetId || 
            p.asset_id === targetId ||
            (p.filename && p.filename.toLowerCase().includes((targetId || "").toLowerCase()))
          ) || proteins[0];

          if (proteinAsset) {
            const proteinRes = await fetch(proteinAsset.download_url || `/api/v1/files/${proteinAsset.file_id}/download`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (proteinRes.ok) {
              const proteinText = await proteinRes.text();
              setReceptorSource({
                format: "pdb",
                value: proteinText,
                label: proteinAsset.filename || "Receptor"
              });
            } else {
              setReceptorSource(null);
            }
          } else {
            setReceptorSource(null);
          }
        }

        // Fetch interaction fingerprint
        const fpRes = await apiClient.get<any>(`/projects/${projectId}/viewer/interaction-fingerprint/${selectedPose.result_id}`);
        if (fpRes.success && fpRes.data && fpRes.data.available) {
          const data = fpRes.data;
          setResidues(data.residue_contacts || MOCK_RESIDUES);
          setInteractions([
            { label: "Hydrogen Bonds", count: data.counts?.h_bonds || 0, color: "bg-cyan-500" },
            { label: "Hydrophobic Contacts", count: data.counts?.hydrophobic || 0, color: "bg-emerald-500" },
            { label: "Pi-Stacking", count: data.counts?.pi_stacking || 0, color: "bg-indigo-500" },
            { label: "Salt Bridges", count: data.counts?.salt_bridges || 0, color: "bg-amber-500" }
          ]);
          setStats(prev => ({
            ...prev,
            hBondsCount: String(data.counts?.h_bonds || 0)
          }));
        } else {
          setResidues([]);
          setInteractions([]);
        }
      } catch (err) {
        console.error("Failed to retrieve pose data", err);
      } finally {
        setViewerLoading(false);
      }
    };

    fetchPoseData();
  }, [selectedPose]);

  if (!isLoading && poses.length === 0) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="3D Visualization Lab"
          breadcrumb="Oncology Research / Molecular Workbench"
          description="High-fidelity 3D structural analysis of ligand-receptor docking poses."
          dataSource="missing"
        />
        <EmptyState
          title="No Visualizable 3D Poses Found"
          description="No 3D structural coordinates or docking pose artifacts are available in this project workspace yet. Complete a molecular docking or GNINA CNN scoring run first."
          action={
            <button className="flex items-center gap-2 rounded bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg hover:bg-accent/90 transition-all">
              Go to Docking Workspace
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
        title="3D Visualization Lab"
        breadcrumb="Oncology Research / Molecular Workbench"
        description="High-fidelity 3D structural analysis of ligand-receptor docking poses, hydrogen bonding networks, and electronic density surfaces."
        dataSource={isDemoMode() ? "mock" : (poses.length > 0 ? "real" : "missing")}
        actions={
          <ActionButtonGroup>
            <ActionButton label="Capture PNG" variant="outline" />
            <ActionButton label="Export Mesh" variant="secondary" />
            <ActionButton label="Show Fullscreen" variant="primary" />
          </ActionButtonGroup>
        }
      />

      {/* Dynamic Data Provenance Badge */}
      <div className="flex items-center gap-2 px-6 py-2 bg-muted-bg border border-border/20 rounded-lg max-w-max" data-testid="data-source-badge">
        <span className="text-[10px] font-bold text-muted-text/60 uppercase tracking-widest">Data Source:</span>
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
          isDemoMode() ? "bg-warning/20 text-warning" :
          dataSource === "IMPORTED Q-AI-DRUG DATA" ? "bg-emerald-500/20 text-emerald-400" :
          "bg-accent/20 text-accent"
        }`}>
          {isDemoMode() ? "MOCK DATA" : dataSource}
        </span>
      </div>

      {/* 2. Visualizer Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Binding Affinity" value={stats.affinity} unit="kcal/mol" helperText="Predicted energy" status="active" />
        <MetricCard label="CNN Pose Score" value={stats.cnnScore} helperText="Deep Learning confidence" status="completed" />
        <MetricCard label="Active H-Bonds" value={stats.hBondsCount} helperText="Hydrogen bonds in pocket" status="completed" />
        <MetricCard label="RMSD Deviation" value={stats.rmsd} helperText="Pose displacement vs reference" status="completed" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Side: 3D Viewer & Pose list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="ui-card-surface p-6 flex flex-col gap-6 min-h-[650px] relative">
            <div className="flex justify-between items-center">
              <SectionHeader title="3D Molecular Workbench" description={selectedPose ? `Inspecting conformation: ${selectedPose.id}` : "Select a pose to visualize"} />
              {viewerLoading && (
                <div className="flex items-center gap-2 text-xs font-bold text-accent">
                   <div className="w-3 h-3 animate-spin rounded-full border border-accent border-t-transparent" />
                   Downloading Coordinates...
                </div>
              )}
            </div>

            {/* Fenced 3D Canvas component */}
            <div className="flex-1 bg-slate-950 border border-border/20 rounded-2xl min-h-[500px] overflow-hidden relative">
              {viewerSource ? (
                <ThreeDMoleculeViewer source={viewerSource} receptorSource={receptorSource} />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-text/30 font-bold uppercase tracking-widest text-xs">
                   No structure loaded
                </div>
              )}
            </div>
          </div>

          {/* 3. Available Conformations List */}
          <div className="ui-card-surface p-5 space-y-4">
            <SectionHeader title="Conformation Pool" description="Priority docking and rescoring poses ready for active rendering." />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {poses.map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPose(p)}
                  className={`p-4 rounded-xl border cursor-pointer hover:border-accent/40 hover:shadow-lg transition-all flex flex-col justify-between h-28 ${
                    selectedPose?.id === p.id ? 'border-accent bg-accent/[0.02]' : 'border-border/30 bg-muted-bg/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] font-black text-accent uppercase tracking-widest leading-none">{p.id}</span>
                    <StatusBadge status={p.status} size="sm" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-text">Affinity: {p.affinity}</div>
                    <div className="text-[10px] text-muted-text uppercase font-bold tracking-widest">CNN: {p.cnnScore}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Control Dashboard & Interaction Ledger */}
        <div className="space-y-6">
          {/* 6. Active Protein & Ligand selection */}
          <div className="ui-card-surface p-5 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Receptor / Target Config
            </h4>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-text/60">Target Molecule</label>
                <select 
                  value={selectedProteinId} 
                  onChange={(e) => setSelectedProteinId(e.target.value)}
                  className="w-full bg-muted-bg border border-border/40 rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-accent/50 transition-all font-bold"
                >
                  {proteins.length > 0 ? (
                    proteins.map(p => (
                      <option key={p.asset_id} value={p.asset_id}>{p.filename}</option>
                    ))
                  ) : (
                    <>
                      <option>EGFR AlphaFold (P00533)</option>
                      <option>EGFR Crystal (PDB: 1M17)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-text/60">Ligand Candidate</label>
                <select 
                  value={selectedLigandId} 
                  onChange={(e) => setSelectedLigandId(e.target.value)}
                  className="w-full bg-muted-bg border border-border/40 rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-accent/50 transition-all font-bold"
                >
                  {ligands.length > 0 ? (
                    ligands.map(l => (
                      <option key={l.asset_id} value={l.asset_id}>{l.filename}</option>
                    ))
                  ) : (
                    <>
                      <option>QDF-EGFR-001</option>
                      <option>QDF-EGFR-014</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-text/60">Binding Pocket</label>
                <select className="w-full bg-muted-bg border border-border/40 rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-accent/50 transition-all font-bold">
                  <option>ATP-binding pocket</option>
                  <option>Allosteric site (C-helix)</option>
                  <option>Extracellular domain IV</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Overlay Controls */}
          <div className="ui-card-surface p-5 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              View Layers
            </h4>
            <div className="space-y-2.5">
              {[
                { label: "Protein Surface", checked: false },
                { label: "Cartoon Representation", checked: true },
                { label: "Ligand Sticks", checked: true },
                { label: "Hydrogen Bonds", checked: true },
                { label: "Hydrophobic Contacts", checked: false },
                { label: "Pi-Stacking", checked: false },
                { label: "Pocket Residues", checked: true },
                { label: "Electrostatic Surface", checked: false },
              ].map(layer => (
                <label key={layer.label} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted-bg/50 cursor-pointer transition-all">
                  <span className="text-[11px] font-bold text-text-secondary">{layer.label}</span>
                  <input type="checkbox" defaultChecked={layer.checked} className="w-3.5 h-3.5 rounded border-border/40 text-accent focus:ring-accent accent-accent" />
                </label>
              ))}
            </div>
          </div>

          {/* 7. Interaction Summary */}
          {interactions.length > 0 && (
            <div className="ui-card-surface p-5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent">Interaction Network</h4>
              <div className="space-y-4">
                {interactions.map(int => (
                  <div key={int.label} className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-text/60">
                      <span>{int.label}</span>
                      <span className="text-text">{int.count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-border/20 rounded-full overflow-hidden">
                      <div className={`h-full ${int.color}`} style={{ width: `${(int.count / 15) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. Viewer Actions */}
          <div className="flex flex-col gap-2">
            <button className="w-full py-3 rounded-lg bg-accent text-bg font-black uppercase tracking-[0.2em] text-[10px] hover:bg-accent/90 shadow-lg shadow-accent/10 transition-all">
              Initiate MD Refinement
            </button>
            <button className="w-full py-3 rounded-lg border border-border text-text font-black uppercase tracking-[0.2em] text-[10px] hover:bg-muted-bg transition-all">
              Compare with Benchmark
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface VisualizationViewProps {
  projectId?: string;
}

export default function VisualizationView({ projectId }: VisualizationViewProps) {
  return (
    <Suspense fallback={
      <div className="h-[600px] flex flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="mt-4 text-xs font-black uppercase tracking-widest text-muted-text/50">Loading Discovery Workspace...</span>
      </div>
    }>
      <VisualizationViewContent projectId={projectId} />
    </Suspense>
  );
}