# Pharma Readiness Gap Analysis

Generated: 2026-06-21

This product should not compete by pretending docking scores are medicines. Its edge should be an evidence-governed research operating system: target biology, structure provenance, chemistry, docking, ADMET, QM, omics, uncertainty, and wet-lab handoff in one reproducible workflow.

## What is already strong

- Local oncology proof pipeline with ChEMBL/PubChem/AlphaFold/PDB-style retrieval, candidate generation, RDKit assets, Vina/Smina docking, GNINA hooks, xTB/QM descriptors, Qiskit-style reranking, ADMET, reporting, and a structured frontend.
- Downloaded pharma asset library with selected AlphaFold receptor files and ChEMBL reference ligands.
- Tool-runner architecture for target building, filtering, docking, orbital analysis, ranking, wet-lab triage, and reporting.
- Claim-boundary language that keeps the system in computational research planning rather than diagnosis or treatment recommendation.

## Main gaps before serious pharma use

| Priority | Gap | Required next work |
| --- | --- | --- |
| P0 | Data governance | Dataset cards, licenses, checksums, refresh dates, release IDs, provenance fields on every rankable number. |
| P0 | Evidence calibration | Retrospective benchmarks, redocking RMSD, enrichment factors, uncertainty intervals, score ablations, and model cards per target family. |
| P0 | Structure preparation | Protonation, tautomers, cofactors, conserved waters, metal handling, alternate chains, mutation mapping, covalent docking modes, and pocket suitability flags. |
| P0 | Docking honesty | No proxy pose in ranking evidence; validate receptor/ligand coordinate frames, pose source, box, method tier, and failure warnings. |
| P0 | ADMET depth | hERG, CYP inhibition/induction, transporter, permeability, solubility, clearance, plasma protein binding, genotox, mitochondrial and endocrine panels. |
| P1 | Disease biology | Open Targets, DepMap, GDSC/PRISM, LINCS/CMap, TCGA/cBioPortal connectors, pathway and resistance evidence. |
| P1 | Generative chemistry | Purchasable-space search, retrosynthesis, reaction feasibility, scaffold constraints, novelty/IP triage, diversity selection. |
| P1 | Physics depth | Ensemble docking, GNINA consensus, MM/GBSA, FEP planning/execution, explicit solvent MD, protein flexibility, water networks. |
| P1 | Foundation models | ESM-family protein embeddings, Uni-Mol-style molecular/pocket embeddings, DiffDock ensemble adapter, Chemprop/DeepChem baselines, and multimodal QA adapters with strict evidence boundaries. |
| P1 | Pharma operations | Audit logs, LIMS/ELN export, organization roles, batch queues, GPU/HPC orchestration, validation reports, tenant-isolated storage. |

## Always-present resource stack

Core local or connector-backed resources should be:

- ChEMBL: assay, molecule, drug, mechanism, indication, warning, target, and structure data.
- BindingDB: experimental binding affinities and thermodynamic assay fields.
- PubChem: compound IDs, synonyms, properties, bioassays, and cross-reference enrichment.
- RCSB PDB: experimental holo structures, ligands, cofactors, waters, and pocket anchors.
- AlphaFold DB: selected predicted structures plus PAE/pLDDT confidence, never full bulk by default.
- UniProt: isoforms, domains, sequence, function, diseases, and cross references.
- Open Targets: disease-target evidence, genetics, tractability, and safety evidence.
- MoleculeNet/TDC: ML benchmark datasets for ADMET, affinity, DTI, docking, toxicity, and generalization tests.
- DepMap/GDSC/LINCS: disease-context and perturbation evidence for translational prioritization.
- xTB/Psi4/OpenFermion/Qiskit: QM/QML layers used with explicit ablations against classical baselines.
- GNINA/DiffDock/Uni-Mol/ESM-family: optional advanced AI layers with calibration and disagreement-aware consensus.
- DiffusionGemma/MedGemma: optional multimodal/text review layers for docking-scene QA and biomedical documentation; use only as visual/provenance triage, not binding validation.

## Foundation-model integration policy

- ESM evidence can support target-context triage, sequence similarity, mutation-domain review, and applicability-domain checks. It must not directly claim binding, efficacy, or safety.
- DiffusionGemma can review a rendered docking scene for visible placement/provenance bugs, especially detached ligands, wrong coordinate frames, hidden poses, and proxy-pose confusion.
- MedGemma is medically oriented and access-gated. Use it only through a private/local endpoint after accepting model terms, and keep it as a secondary biomedical/visual reviewer rather than a docking physics judge.
- Gemma Copilot personalization should use de-identified app state, selected targets, run status, and evidence summaries, never secret keys or hidden chain-of-thought.

## Realtime Data Fabric Policy

- Use connectors for ChEMBL activity, PubChem compound properties, UniProt target metadata, Open Targets disease associations, and RDKit descriptors during a run.
- Cache every live response with source, timestamp, and TTL so repeated runs are fast and reproducible.
- Treat large or license-sensitive resources such as BindingDB full mirrors, DepMap, GDSC, LINCS, ZINC/Enamine, and model weights as explicit admin downloads or private connectors.
- Use AI models as processing layers: ESM for protein context, Chemprop/Uni-Mol/DiffDock as optional local/API model hooks, and Gemma-family models for research explanation and visual QA.
- Never let data volume alone raise a candidate to “good”; ranking should separate datapoint richness from experimental binding, docking physics, ADMET, QM, and validation evidence.

## Immediate implementation policy

1. Keep small public benchmark datasets locally with checksums.
2. Keep huge or license-sensitive datasets as connectors with release/version metadata.
3. Never rank a candidate as strong unless evidence source, method tier, receptor, ligand pose, and limitations are visible.
4. Treat quantum and foundation-model outputs as additive evidence only after classical baselines and ablations are shown.
5. Every export must say what can be claimed, what cannot be claimed, and what wet-lab validation is required next.
