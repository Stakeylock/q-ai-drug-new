"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import MetricCard from "@/components/ui/MetricCard";
import ActionButtonGroup, { ActionButton } from "@/components/ui/ActionButtonGroup";
import StatusBadge from "@/components/ui/StatusBadge";
import SectionHeader from "@/components/ui/SectionHeader";
import EmptyState from "@/components/ui/EmptyState";
import { isDemoMode, apiClient } from "@/services/api";

// Realistic technical data for the targets
const TARGETS = [
  {
    id: "P00533",
    gene: "EGFR",
    proteinName: "Epidermal growth factor receptor",
    organism: "Homo sapiens",
    length: "1210 aa",
    diseaseRelevance: "Primary driver in NSCLC; mutated in ~15% of Western and ~50% of Asian patients.",
    confidence: 0.98,
    pathway: "ErbB / PI3K-Akt / MAPK",
    structureStatus: "X-ray / AlphaFold / co-crystal",
    assayAvailability: "Biochemical (HTRF), Cellular (Ba/F3), In-vivo (PDX)",
    recommendation: "Primary Target",
    domains: "L1, CR1, L2, CR2 (Extracellular); Kinase Domain (Intracellular)",
    bindingSite: "ATP-binding pocket (Kinase Domain). Key residues: L858, T790, C797.",
    mutations: "L858R, Exon 19 del (sensitizing); T790M (gatekeeper resistance); C797S (Osimertinib resistance).",
    pathwayDetails: {
      name: "ERBB Signaling Pathway",
      association: "Strongly associated with cell proliferation and apoptosis evasion.",
      role: "Receptor Tyrosine Kinase activation.",
      oncogenic: "Constitutive activation via mutation leads to uncontrolled growth.",
      evidence: "High (Level 1 Clinical Evidence)"
    },
    structures: [
      { type: "AlphaFold", id: "AF-P00533-F1", confidence: "98.2" },
      { type: "PDB", id: "1M17", resolution: "2.6Å", ligand: "Erlotinib" },
      { type: "PDB", id: "2ITX", resolution: "2.1Å", ligand: "Gefitinib" },
      { type: "mmCIF", id: "3W2S", source: "RCSB" }
    ],
    evidenceMetrics: {
      literature: 0.95,
      assay: 0.92,
      structure: 0.99,
      druggability: 0.94,
      completeness: 0.88
    }
  },
  {
    id: "P04626",
    gene: "ERBB2",
    proteinName: "Receptor tyrosine-protein kinase erbB-2",
    organism: "Homo sapiens",
    length: "1255 aa",
    diseaseRelevance: "Amplified in breast/gastric; emerging driver in NSCLC (exon 20 insertions).",
    confidence: 0.85,
    pathway: "ErbB Signaling",
    structureStatus: "X-ray / AlphaFold",
    assayAvailability: "Biochemical, Cell-based (HER2+)",
    recommendation: "Secondary/Bypass",
    domains: "Similar to EGFR; lacks ligand-binding activity (constitutively active-ready).",
    bindingSite: "Homology to EGFR kinase domain; distinct cysteine mapping.",
    mutations: "Exon 20 insertions (A775_G776insYVMA) most common in NSCLC.",
    pathwayDetails: {
      name: "ERBB2/HER2 Pathway",
      association: "Cross-talk with EGFR; bypass mechanism for EGFR TKIs.",
      role: "Heterodimerization partner for other ErbB receptors.",
      oncogenic: "Amplification or mutation drives aggressive phenotypes.",
      evidence: "High (Level 1 in Breast, Level 2 in Lung)"
    },
    structures: [
      { type: "AlphaFold", id: "AF-P04626-F1", confidence: "96.5" },
      { type: "PDB", id: "3PP0", resolution: "2.25Å", ligand: "SYR-475" }
    ],
    evidenceMetrics: {
      literature: 0.90,
      assay: 0.82,
      structure: 0.94,
      druggability: 0.88,
      completeness: 0.75
    }
  },
  {
    id: "P08581",
    gene: "MET",
    proteinName: "Hepatocyte growth factor receptor",
    organism: "Homo sapiens",
    length: "1390 aa",
    diseaseRelevance: "MET amplification is a major resistance mechanism to EGFR TKIs.",
    confidence: 0.78,
    pathway: "HGF/MET Signaling",
    structureStatus: "X-ray / Cryo-EM",
    assayAvailability: "Biochemical, Phospho-MET ELISA",
    recommendation: "Resistance Mechanism",
    domains: "SEMA domain (HGF binding), PSI domain, IPT domains, Kinase domain.",
    bindingSite: "Deep ATP-binding cleft; hinge region targets available.",
    mutations: "Exon 14 skipping (METex14); Y1003X.",
    pathwayDetails: {
      name: "HGF/SF-MET Axis",
      association: "Involved in EMT, invasion, and TKI resistance bypass.",
      role: "Activation of PI3K/Akt and Ras/MAPK pathways.",
      oncogenic: "Hyperactivation promotes metastasis and drug tolerance.",
      evidence: "Medium-High (Level 2 Evidence)"
    },
    structures: [
      { type: "AlphaFold", id: "AF-P08581-F1", confidence: "94.1" },
      { type: "PDB", id: "3DKC", resolution: "1.8Å", ligand: "Tivantinib" }
    ],
    evidenceMetrics: {
      literature: 0.85,
      assay: 0.75,
      structure: 0.91,
      druggability: 0.82,
      completeness: 0.70
    }
  },
  {
    id: "Q9UM73",
    gene: "ALK",
    proteinName: "ALk tyrosine kinase receptor",
    organism: "Homo sapiens",
    length: "1620 aa",
    diseaseRelevance: "Rearrangements (EML4-ALK) found in 3-5% of NSCLC.",
    confidence: 0.72,
    pathway: "ALK Signaling",
    structureStatus: "X-ray / AlphaFold",
    assayAvailability: "IHC, FISH, Biochemical",
    recommendation: "Alternative Driver",
    domains: "MAM domains, LDL-receptor class A domain, Kinase domain.",
    bindingSite: "Kinase domain target for Crizotinib, Alectinib.",
    mutations: "Fusion proteins (EML4-ALK); secondary mutations (G1202R).",
    pathwayDetails: {
      name: "ALK Signaling Network",
      association: "Potent oncogenic driver when fused or mutated.",
      role: "Regulates cell proliferation via STAT3 and PI3K.",
      oncogenic: "Fusion leads to constitutive kinase activity.",
      evidence: "High (Level 1 Evidence for Fusions)"
    },
    structures: [
      { type: "AlphaFold", id: "AF-Q9UM73-F1", confidence: "92.8" },
      { type: "PDB", id: "3L9P", resolution: "1.9Å", ligand: "Crizotinib" }
    ],
    evidenceMetrics: {
      literature: 0.88,
      assay: 0.80,
      structure: 0.85,
      druggability: 0.80,
      completeness: 0.65
    }
  }
];

export interface TargetsViewProps {
  projectId?: string;
}

export default function TargetsView({ projectId: propProjectId }: TargetsViewProps) {
  const [selectedTargetId, setSelectedTargetId] = useState(TARGETS[0].id);
  const [realTargets, setRealTargets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const projectId = propProjectId || (typeof window !== "undefined" ? localStorage.getItem("active_project_id") : null);

  useEffect(() => {
    if (isDemoMode()) {
      setIsLoading(false);
      return;
    }

    const fetchTargets = async () => {
      try {
        setIsLoading(true);
        if (projectId) {
          const res = await apiClient.get<any>(`/projects/${projectId}/targets`);
          if (res.success && res.data && Array.isArray(res.data.items)) {
            const mapped = res.data.items.map((t: any) => ({
              id: t.uniprot_id || t.id || "P00000",
              gene: t.gene_name || t.name || "UNKNOWN",
              proteinName: t.description || "Protein target description not provided.",
              organism: t.organism || "Homo sapiens",
              length: t.length ? `${t.length} aa` : "1200 aa",
              diseaseRelevance: t.disease_association || "No clinical data linked to this target yet.",
              confidence: t.confidence_score || 0.75,
              pathway: t.pathway || "General Cellular Signaling",
              structureStatus: t.has_structure ? "X-ray / AlphaFold" : "Homology Model / AlphaFold",
              assayAvailability: t.has_assays ? "Biochemical, Cell-based" : "Biochemical (HTRF)",
              recommendation: t.status === "primary" ? "Primary Target" : "Secondary/Bypass",
              domains: t.domains || "Kinase Domain",
              bindingSite: t.binding_site_description || "Catalytic pocket residues undefined.",
              mutations: t.clinical_mutations || "None reported in active clinical files.",
              pathwayDetails: {
                name: t.pathway || "General Pathway",
                association: "Pathway involvement in oncology progression.",
                role: "Downstream signaling cascade regulation.",
                oncogenic: "Mutational status may lead to activation.",
                evidence: "Medium (Level 2 Evidence)"
              },
              structures: [
                { type: "AlphaFold", id: `AF-${t.uniprot_id || "AF-00"}-F1`, confidence: "95.0" }
              ],
              evidenceMetrics: {
                literature: 0.80,
                assay: 0.70,
                structure: t.has_structure ? 0.95 : 0.70,
                druggability: 0.85,
                completeness: 0.75
              }
            }));
            setRealTargets(mapped);
            if (mapped.length > 0) {
              setSelectedTargetId(mapped[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load targets:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTargets();
  }, [projectId]);

  const activeTargets = isDemoMode() ? TARGETS : realTargets;
  const selectedTarget = activeTargets.find(t => t.id === selectedTargetId) || activeTargets[0];

  if (!isLoading && activeTargets.length === 0) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="Target Intelligence"
          breadcrumb="Oncology Research / Discovery"
          description="Rank and analyze biological protein targets for the current discovery program."
          dataSource="missing"
        />
        <EmptyState
          title="No Targets Prioritized"
          description="This project workspace doesn't have any biological protein targets prioritized yet. Register or prioritize a target to proceed."
          action={
            <button className="flex items-center gap-2 rounded bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg hover:bg-accent/90 transition-all">
              Prioritize Protein Target
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
        title="Target Intelligence"
        breadcrumb="Oncology Research / Discovery"
        description="Rank and analyze biological protein targets for the current discovery program. Inspect structural evidence, pathway associations, and druggability metrics."
        dataSource={isDemoMode() ? "mock" : (activeTargets.length > 0 ? "real" : "missing")}
        actions={
          <ActionButtonGroup>
            <ActionButton label="Export Data" variant="outline" />
            <ActionButton label="Update Literature" variant="secondary" />
            <ActionButton label="Compare Targets" variant="primary" />
          </ActionButtonGroup>
        }
      />

      {/* 2. Target Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Ranked Targets"
          value={activeTargets.length}
          helperText="Active in program"
          status="completed"
        />
        <MetricCard
          label="Primary Confidence"
          value={selectedTarget ? (selectedTarget.confidence * 100).toFixed(0) : "0"}
          unit="%"
          helperText={`${selectedTarget?.gene || "Target"} validation`}
          status="completed"
        />
        <MetricCard
          label="Structures"
          value={selectedTarget?.structures?.length || 0}
          helperText="Available PDB/AF"
          status="active"
        />
        <MetricCard
          label="Literature"
          value="4.2k"
          helperText="Relevant papers"
          status="completed"
        />
        <MetricCard
          label="Assay Coverage"
          value="85"
          unit="%"
          helperText="Across panel"
          status="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* 3. Ranked Target Cards */}
        <div className="lg:col-span-2 space-y-4">
          <SectionHeader title="Prioritized Target Candidates" description="Ranked by biological relevance and druggability score." />
          
          <div className="grid grid-cols-1 gap-4">
            {activeTargets.map((target, index) => (
              <div
                key={target.id}
                onClick={() => setSelectedTargetId(target.id)}
                className={`ui-card-surface group cursor-pointer p-5 transition-all hover:shadow-lg ${
                  selectedTargetId === target.id ? "border-accent ring-1 ring-accent/20 bg-accent/[0.02]" : "hover:border-border"
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted-bg font-black text-accent border border-border/40">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-text">{target.gene}</h3>
                        <span className="font-mono text-[10px] font-bold text-muted-text/60">/ {target.id}</span>
                        <StatusBadge status={target.confidence > 0.9 ? "completed" : "running"} label={target.recommendation} size="sm" />
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-muted-text line-clamp-1">{target.proteinName}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:flex md:items-center md:gap-8">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-text/40">Confidence</span>
                      <span className="font-mono text-xs font-black text-text">{(target.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-text/40">Pathway</span>
                      <span className="text-[10px] font-bold text-text truncate max-w-[100px]">{target.pathway}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-text/40">Structures</span>
                      <span className="text-[10px] font-bold text-accent">{target.structureStatus.split(' / ')[0]}...</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-border/40 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-muted-bg px-2 py-0.5 text-[9px] font-bold text-muted-text/80 uppercase">NSCLC</span>
                    <span className="rounded bg-muted-bg px-2 py-0.5 text-[9px] font-bold text-muted-text/80 uppercase">Tyrosine Kinase</span>
                    <span className="rounded bg-muted-bg px-2 py-0.5 text-[9px] font-bold text-muted-text/80 uppercase">{target.assayAvailability.split(',')[0]}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Details Panels */}
        {selectedTarget && (
          <div className="space-y-6">
            {/* 4. Protein Metadata Panel */}
            <div className="ui-card-surface p-5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Target Metadata
              </h4>
              
              <div className="grid grid-cols-1 gap-y-3 text-[11px]">
                <div className="flex justify-between py-1 border-b border-border/20">
                  <span className="font-bold text-muted-text">Gene / Protein</span>
                  <span className="font-black text-text">{selectedTarget.gene} / {selectedTarget.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/20">
                  <span className="font-bold text-muted-text">Organism</span>
                  <span className="font-bold text-text">{selectedTarget.organism}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/20">
                  <span className="font-bold text-muted-text">Length</span>
                  <span className="font-mono text-text">{selectedTarget.length}</span>
                </div>
                <div className="space-y-1 py-1">
                  <span className="font-bold text-muted-text block mb-1">Functional Domains</span>
                  <p className="text-text leading-tight">{selectedTarget.domains}</p>
                </div>
                <div className="space-y-1 py-1">
                  <span className="font-bold text-muted-text block mb-1">Binding Site</span>
                  <p className="text-text leading-tight italic">{selectedTarget.bindingSite}</p>
                </div>
                <div className="space-y-1 py-1">
                  <span className="font-bold text-error/70 block mb-1">Clinical Mutations</span>
                  <p className="text-text leading-tight">{selectedTarget.mutations}</p>
                </div>
              </div>
            </div>

            {/* 5. Pathway Panel */}
            <div className="ui-card-surface p-5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.485V6.414m12.922 13.51a2 2 0 01-1.42.574c-.544 0-1.076-.217-1.421-.574l-4.507-4.507a2 2 0 010-2.828l4.507-4.507a2 2 0 012.828 0l4.507 4.507a2 2 0 010 2.828l-4.507 4.507z" /></svg>
                Pathway & Disease
              </h4>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-muted-text/40 block mb-1">Pathway</span>
                  <p className="text-xs font-bold text-text">{selectedTarget.pathwayDetails.name}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-muted-text/40 block mb-1">Role & Association</span>
                  <p className="text-[11px] text-muted-text leading-relaxed">{selectedTarget.pathwayDetails.association}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-muted-text/40">Evidence Level</span>
                  <span className="text-[10px] font-black text-accent">{selectedTarget.pathwayDetails.evidence}</span>
                </div>
              </div>
            </div>

            {/* 6. Structure Availability Panel */}
            <div className="ui-card-surface p-5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                Structural Data
              </h4>
              <div className="space-y-2">
                {selectedTarget.structures.map((struct: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-muted-bg/50 border border-border/20">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                        struct.type === 'AlphaFold' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {struct.type}
                      </span>
                      <span className="text-xs font-mono font-bold text-text">{struct.id}</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-text">{struct.confidence || struct.resolution}</span>
                  </div>
                ))}
              </div>
              <button className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-accent hover:bg-accent/5 rounded border border-accent/20 transition-all">
                Launch 3D Explorer
              </button>
            </div>

            {/* 7. Confidence & Evidence Panel */}
            <div className="ui-card-surface p-5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Confidence Profile
              </h4>
              <div className="space-y-4">
                {[
                  { label: "Literature", val: selectedTarget.evidenceMetrics.literature },
                  { label: "Assay Data", val: selectedTarget.evidenceMetrics.assay },
                  { label: "Structural", val: selectedTarget.evidenceMetrics.structure },
                  { label: "Druggability", val: selectedTarget.evidenceMetrics.druggability },
                ].map((m) => (
                  <div key={m.label} className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-muted-text/60 uppercase">{m.label}</span>
                      <span className="text-text">{(m.val * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1 w-full bg-border/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-1000" 
                        style={{ width: `${m.val * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 8. Next Actions */}
            <div className="ui-card-surface p-5 bg-accent/[0.03] border-accent/20">
               <h4 className="text-xs font-black uppercase tracking-widest text-accent mb-4">Strategic Next Actions</h4>
               <div className="grid grid-cols-1 gap-2">
                  <button className="flex items-center gap-3 w-full p-2.5 rounded-lg border border-border/40 bg-card hover:bg-muted-bg transition-all text-left">
                    <div className="h-8 w-8 rounded flex items-center justify-center bg-indigo-500/10 text-indigo-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase text-text">Attach Structure</div>
                      <div className="text-[9px] text-muted-text font-medium">Link mmCIF or PDB files</div>
                    </div>
                  </button>
                  <button className="flex items-center gap-3 w-full p-2.5 rounded-lg border border-border/40 bg-card hover:bg-muted-bg transition-all text-left">
                    <div className="h-8 w-8 rounded flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m10 0a2 2 0 100-4m0 4a2 2 0 110-4m-6 0a2 2 0 002 2h2a2 2 0 002-2m-8 2v1a2 2 0 002 2h2a2 2 0 002-2v-1" /></svg>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase text-text">Define Binding Pocket</div>
                      <div className="text-[9px] text-muted-text font-medium">Specify active site residues</div>
                    </div>
                  </button>
                  <button className="flex items-center gap-3 w-full p-2.5 rounded-lg border border-accent/20 bg-accent text-bg hover:bg-accent/90 transition-all text-left">
                    <div className="h-8 w-8 rounded flex items-center justify-center bg-bg/20 text-bg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase">Start Generation</div>
                      <div className="text-[9px] font-medium opacity-80">Trigger de-novo molecule engine</div>
                    </div>
                  </button>
                  <button className="flex items-center gap-3 w-full p-2.5 rounded-lg border border-border/40 bg-card hover:bg-muted-bg transition-all text-left">
                    <div className="h-8 w-8 rounded flex items-center justify-center bg-purple-500/10 text-purple-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase text-text">Ask Pharma LLM</div>
                      <div className="text-[9px] text-muted-text font-medium">Query literature insights</div>
                    </div>
                  </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
