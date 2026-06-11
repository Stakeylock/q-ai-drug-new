# SOTA Review and Integration Notes

The citations below are tracked in `references.bib`. This review is intentionally implementation-oriented: each paper or tool is mapped to a concrete role in the Q-AI pipeline.

## Data and Benchmarks

- ChEMBL, PubChem, MoleculeNet, BindingDB, RCSB PDB, and AlphaFold DB provide the public data backbone. The current pipeline uses ChEMBL/PubChem/MoleculeNet/RCSB/AlphaFold DB directly and keeps BindingDB as an expansion target because it is larger and needs stronger target/assay curation.
- Scaffold splits and rediscovery checks remain mandatory because random splits can overstate medicinal chemistry model quality.
- Tox21 and ClinTox are now active model-training datasets, not just cached references. The project trains local endpoint classifiers into `models/admet/` and records per-endpoint ROC-AUC/AP so candidate filtering uses learned toxicity and approval-likeness evidence.

## Structure and Docking

- AlphaFold 3, RoseTTAFold All-Atom, Chai-1, Boltz-1, Boltz-2, and FoldBench indicate the field is moving from isolated protein structure prediction to joint biomolecular complex modeling and benchmarked affinity-oriented workflows. The project should treat these as upstream complex hypothesis generators, not as replacements for docking, rescoring, and experimental validation.
- AutoDock Vina and Smina remain important transparent baselines. The current repository now uses Vina global docking plus Smina local minimization/rescoring for the selected docking portfolio, with mini smoke tests retained for setup validation. The next architectural step is curated receptor pocket definitions.
- GNINA is now an installed, artifact-backed CNN docking/rescoring lane for selected top candidates. GNINA 1.3 moved the deep learning stack to PyTorch, retrained CNN scoring on CrossDocked2020 v1.3, and added knowledge-distilled models for faster screening. The local project writes pose SDFs, CNN pose scores, CNN affinity estimates, logs, and dashboard visualizations. The current run still uses exploratory receptor-centroid boxes, so the scientific next step is curated binding pockets and comparison against Vina/Smina poses.
- Folding-Docking-Affinity style workflows and Boltz-2-style affinity predictors are now tracked as next-tier architecture options. They should enter the platform as comparison lanes with provenance and confidence intervals, not as single-source truth.
- DiffDock remains a strong future ensemble addition once curated receptors, binding boxes, and a pose-quality benchmark are in place.

## Generative Chemistry

- REINVENT4 is the most practical near-term community integration for score-guided molecular design because it is designed for iterative scoring and medicinal chemistry constraints.
- Uni-Mol and modern 3D molecular encoders are valuable for representation learning and reranking after conformer generation.
- Diffusion-based 3D generation is promising, but should be introduced only behind validity, synthesizability, novelty, and docking/QM gates.

## ADMET and Toxicity

- ADMET-AI and ADMETlab 3.0 are useful references for broad production ADMET coverage, but the current repository keeps the first active layer local and inspectable: Random Forest endpoint models over RDKit descriptors, hashed SMILES features, and Morgan fingerprints.
- The trained Tox21/ClinTox layer should be treated as a triage model. It improves the pipeline over a descriptor-only toxicity proxy, but it does not replace experimental cytotoxicity, hERG, CYP, metabolic stability, permeability, or selectivity assays.

## Quantum AI Layer

- xTB GFN2 is now an active high-throughput quantum chemistry layer in the project. It produces orbital energies, HOMO-LUMO gaps, total energies, and quantum-score features for top candidates.
- Qiskit statevector kernels are now active in two places: early candidate portfolio prefiltering before docking/QM and late-stage reranking after xTB. The early pass is designed as a research-grade quantum feature-space prioritizer; it does not assert hardware speedup on local statevector simulation.
- The project should remain conservative about hardware superiority claims. Current QML evidence in drug discovery is early-stage; every quantum component should have a classical ablation and explicit cost/benefit tracking.

## Validation Requirements

The proof-tier validator must pass before any result is shown. The production-tier validator now requires real docking and OpenMM-backed trajectory rows, and the current artifact set passes with warnings. The warnings remain important: current boxes are exploratory and the OpenMM layer is ligand-pose relaxation, not full explicit-solvent protein-ligand MD.
