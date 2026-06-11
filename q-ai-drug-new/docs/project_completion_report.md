# Q-AI Drug Discovery Project Completion Report

This report maps the investor product plan to the current runnable research platform. It is written as research evidence, not as a therapeutic claim.

**Research-use statement:** All outputs are computational research hypotheses. Synthesis, assays, ADMET experiments, selectivity profiling, safety studies, and regulatory review are required before therapeutic claims.

## Executive Status

| Metric | Value |
| --- | --- |
| Cancer proof targets | 3 |
| Generated candidates | 15000 |
| Filtered candidates | 1500 |
| Vina/Smina docking rows | 300 |
| GNINA CNN rows | 3 |
| OpenMM ligand-pose relaxation rows | 30 |
| xTB QM rows | 30 |
| Qiskit QML rows | 30 |
| Final ranked rows | 300 |
| Trained ADMET endpoints | 14 |
| Proof gate | Pass |
| Research evidence gate | Pass |

## Target Coverage

| Target | Benchmark rows | Top candidates | Best candidate | Best score | Quantum delta | Docking | GNINA | QM | QML |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EGFR | 737 | 10 | EGFR_CAND_00119 | 0.7254107806607423 | -0.0470246088321277 | 100 | 1 | 10 | 10 |
| PARP1 | 905 | 10 | PARP1_CAND_00012 | 0.8723587113308873 | -0.0530460826657243 | 100 | 1 | 10 | 10 |
| PIK3CA | 900 | 10 | PIK3CA_CAND_00071 | 0.7848124542839363 | -0.0423985414002662 | 100 | 1 | 10 | 10 |

## Product Tool Completion

| Tool | Status | Evidence | User Output |
| --- | --- | --- | --- |
| OncoData Builder | REAL | ChEMBL/PubChem/MoleculeNet/RCSB/AlphaFold cache | Benchmark and reference inhibitor tables |
| Q-Generate | REAL | Target-conditioned candidate generation | Generated SMILES and scored candidates |
| Q-Filter | REAL | RDKit descriptors, PAINS/Brenk, trained ADMET probabilities | Filtered medicinal chemistry table |
| Q-Portfolio Prefilter | REAL | Qiskit statevector quantum kernel | Quantum-prioritized docking portfolio |
| Q-Dock Studio | REAL | AutoDock Vina plus Smina local minimization | Docking scores, PDBQT/SDF poses, logs |
| GNINA CNN Docking | REAL | GNINA 1.3 CPU CNN rescoring | CNN pose scores, CNN affinity, docked SDF poses |
| Q-View 3D | REAL | 3Dmol.js receptor/ligand viewer | Protein-ligand visual inspection |
| Q-Orbital Analyzer | REAL | xTB GFN2 single-point descriptors | HOMO/LUMO/gap/energy descriptors |
| Q-Rank | REAL | Classical plus quantum ablation ranking | Final ranked candidates with quantum delta |
| Q-Report | REAL | HTML/PDF report builder | Shareable evidence package |
| Model Playground | REAL | FastAPI single and batch prediction endpoints | Interactive target/activity/ADMET scoring |
| External Tool Chain | REAL | openbabel_conversion, xtb_single_point, vina_executable, vina_mini_docking, smina_executable, smina_mini_docking, gnina_executable, gnina_mini_docking | Vina/Smina/GNINA/OpenBabel/xTB smoke evidence |

## Research Pipeline Funnel

| Stage | Rows | Method Tier | Evidence |
| --- | --- | --- | --- |
| Benchmark records | 2542 | REAL | Public dataset retrieval and curation |
| Generated candidates | 15000 | REAL | Q-Generate |
| Filtered candidates | 1500 | REAL | Q-Filter |
| Quantum prefilter rows | 1500 | REAL | Qiskit portfolio kernel |
| Docking rows | 300 | REAL | Vina/Smina |
| OpenMM relaxation rows | 30 | REAL | Ligand-pose relaxation |
| xTB QM rows | 30 | REAL | GFN2 single-point descriptors |
| QML rerank rows | 30 | REAL | Qiskit statevector kernel |
| GNINA CNN rows | 3 | REAL | GNINA selected top candidates |
| Ranked rows | 300 | REAL | Final ranking and ablation |

## Model and Quantum Evidence

| Evidence | Value |
| --- | --- |
| Activity models | 3 |
| Mean activity ROC-AUC | 0.8757636222979017 |
| Mean activity AP | 0.8996864710046978 |
| Trained ADMET endpoints | 14 |
| Mean ADMET ROC-AUC | 0.7817975422334225 |
| Mean ADMET AP | 0.38059210907086466 |
| Quantum prefilter rows | 1500 |
| Qiskit rerank rows | 30 |
| xTB rows | 30 |
| Mean quantum ablation delta | -0.049875345293383465 |
| Quantum claim | Qiskit statevector kernels and xTB descriptors are active research signals; no hardware speedup is claimed. |

## Validation Gate

- Proof gate: Pass
- Research evidence gate: Pass
- Research evidence warnings: None

## Investor Demo Flow

| Minute | Screen | Proof Shown |
| --- | --- | --- |
| 0:00-1:00 | Investor website | Product story, proof metrics, research-use disclaimer |
| 1:00-2:00 | Platform workflow | Named Q-AI tools and architecture |
| 2:00-3:30 | Discovery Console overview | Cached cancer proof run, validation gates, report links |
| 3:30-5:00 | Target workspace | EGFR/PARP1/PIK3CA data and model coverage |
| 5:00-6:30 | Candidate table | 2D structures, scores, quantum deltas |
| 6:30-8:00 | 3D viewer and GNINA | Protein-ligand pose and CNN scores |
| 8:00-9:00 | Quantum tab | Q-Portfolio, xTB descriptors, QML reranking |
| 9:00-10:00 | Reports | Downloadable HTML/PDF evidence package and business path |

## Current Limitations

- Current Vina/Smina/GNINA boxes are exploratory receptor-centroid boxes until curated oncology pocket definitions are added.
- OpenMM output is a real ligand-pose relaxation/trajectory triage layer, not full explicit-solvent protein-ligand MD or FEP.
- Tox21/ClinTox ADMET models are useful triage signals and must be expanded before therapeutic decision-making.
- Quantum components are active research prioritization features with classical ablations; they do not claim hardware superiority.

## Next Scientific Upgrades

- Curated pocket registry for EGFR, PARP1, and PIK3CA with co-crystal/literature provenance.
- DiffDock/Boltz-style complex hypothesis lane for comparison with Vina/Smina/GNINA.
- Expanded ADMET endpoints including hERG, CYP, permeability, metabolic stability, and selectivity.
- Explicit-solvent OpenMM complex preparation and late-stage FEP-style validation for a tiny top set.

## Shareable Artifacts

| Artifact | Path | Available |
| --- | --- | --- |
| Scientific HTML report | outputs\cancer_proof_v1\report.html | True |
| Scientific PDF report | outputs\cancer_proof_v1\report.pdf | True |
| Top candidates | outputs\cancer_proof_v1\top_candidates.csv | True |
| Final ranking | outputs\cancer_proof_v1\final_ranked_candidates.csv | True |
| GNINA results | outputs\cancer_proof_v1\gnina\results.csv | True |
| Run manifest | outputs\cancer_proof_v1\run_manifest.json | True |
