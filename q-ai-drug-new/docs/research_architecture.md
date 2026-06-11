# Q-AI Drug Discovery Research Architecture

This document is the implementation map behind the runnable project. It separates active, validated components from frontier integrations that are referenced in `references.bib` and staged for future architecture changes.

## Operating Principle

The project should never present computational ranking as therapeutic proof. Its goal is to produce reproducible, inspectable, research-grade hit hypotheses with traceable data, model cards, external-tool evidence, visual artifacts, and explicit limitations.

## Current Active Pipeline

| Tier | Active implementation | Evidence artifact |
| --- | --- | --- |
| Public data | ChEMBL activity retrieval, PubChem reference inhibitor retrieval, MoleculeNet Tox21/ClinTox cache, RCSB/AlphaFold structure retrieval | `data/processed/oncology_benchmark.csv`, `data/processed/reference_inhibitors.csv`, `data/processed/retrieval_manifest.json` |
| Activity modeling | Target-specific scaffold-split baseline models for EGFR, PARP1, PIK3CA, also mirrored to `models/activity/` | `outputs/cancer_proof_v1/models/baseline_activity_metrics.csv`, `models/activity/` |
| ADMET/toxicity modeling | Tox21 endpoint classifiers and ClinTox approval/toxicity classifiers used for candidate ADMET probabilities | `outputs/cancer_proof_v1/models/admet_model_metrics.csv`, `models/admet/admet_models.joblib` |
| Candidate generation | Target-conditioned analogue/seeding generator from reference inhibitors and benchmark actives | `outputs/cancer_proof_v1/generated.csv` |
| Medicinal chemistry filters | RDKit descriptors, Lipinski/Veber-like gates, PAINS/Brenk alerts, trained ADMET probabilities with descriptor fallback | `outputs/cancer_proof_v1/filtered.csv` |
| Early quantum portfolio prefilter | Qiskit statevector kernel over activity, ADMET, QED, and toxicity features; prioritizes candidates before docking/QM | `outputs/cancer_proof_v1/qml/quantum_prefilter_scores.csv`, `outputs/cancer_proof_v1/filtered_quantum.csv` |
| Structure assets | 2D PNGs, SMILES, 3D RDKit conformer SDFs | `outputs/cancer_proof_v1/assets/ligand_asset_manifest.csv` |
| External tools | WSL-aware Vina, Smina, GNINA, OpenBabel, xTB resolution and smoke tests | `outputs/external_tools_manifest.json`, `outputs/tool_smoke/external_tool_smoke.json` |
| Docking triage | Real AutoDock Vina global docking plus Smina local minimization/rescoring for selected candidates; exploratory receptor-centroid boxes until pocket definitions are curated | `outputs/cancer_proof_v1/docking/results.csv`, `outputs/cancer_proof_v1/docking/poses/` |
| GNINA CNN docking | Real GNINA CPU docking/rescoring for selected top candidates, with CNN pose/affinity scores and SDF pose artifacts | `outputs/cancer_proof_v1/gnina/results.csv`, `outputs/cancer_proof_v1/gnina/poses/` |
| MD triage | Real OpenMM CPU ligand-pose relaxation trajectories over docked poses; explicit-solvent protein-ligand MD/FEP remains future work | `outputs/cancer_proof_v1/md/stability.csv`, `outputs/cancer_proof_v1/md/trajectories/` |
| QM | Real xTB GFN2 single-point descriptors on top candidates | `outputs/cancer_proof_v1/qm/qm_descriptors.csv` |
| QML | Real Qiskit statevector quantum-kernel reranking | `outputs/cancer_proof_v1/qml/quantum_kernel_scores.csv` |
| Ranking | Weighted activity, ADMET, docking, MD, xTB, and QML ranking with quantum ablation | `outputs/cancer_proof_v1/final_ranked_candidates.csv` |
| 3D inspection | Dashboard viewer for AlphaFold EGFR/PARP1/PIK3CA receptors, generated ligand conformers, and real GNINA SDF poses; legacy receptors kept review-only | `http://127.0.0.1:8000/dashboard`, `data/structures_havetosee/` |
| Reporting | HTML/PDF report, molecule images, model metrics, rediscovery, docking, GNINA, QM, QML, top candidates | `outputs/cancer_proof_v1/report.html`, `outputs/cancer_proof_v1/report.pdf` |

## Validation Tiers

`scripts/validate_research_artifacts.py --tier proof` is the default gate. It requires complete artifacts, working community tools including GNINA, valid report visualizations, real GNINA selected-candidate pose artifacts, real xTB descriptors, real Qiskit kernel scores, non-empty activity and ADMET model metrics, and top-candidate coverage across all primary targets. It now passes with warnings for ADMET endpoint quality and exploratory binding boxes.

`scripts/validate_research_artifacts.py --tier production` is intentionally stricter. It now requires every docking row to be real and every MD row to be OpenMM-backed; the current artifact set passes with warnings. The next scientific upgrade is curated receptor pockets and fully parameterized explicit-solvent complex MD.

## SOTA Integration Map

| Area | Reference direction | Project action |
| --- | --- | --- |
| Biomolecular complex prediction | AlphaFold 3, RoseTTAFold All-Atom, Chai-1, Boltz-1, Boltz-2, FoldBench | Add an optional structure-prediction backend that can generate or compare protein-ligand complex and affinity hypotheses before docking. Prefer open or locally runnable systems first, and benchmark against FoldBench-style failure modes. |
| Protein-ligand docking | DiffDock, GNINA 1.3, AutoDock Vina 1.2, Smina/Vinardo, Folding-Docking-Affinity workflows | Keep Vina/Smina as transparent physics baselines; GNINA is now an artifact-backed CNN rescoring lane for selected top candidates; add DiffDock, FDA-style affinity comparison, or curated-pocket GNINA/Vina/Smina ensembles next. |
| 3D molecular representation | Uni-Mol and related 3D molecular pretraining | Add embedding export and candidate reranking using 3D pretrained molecular encoders. |
| Generative chemistry | REINVENT4, diffusion and fragment-constrained generators | Replace the simple analogue generator with a policy/score-optimized generator that is constrained by filters, novelty, synthesizability, and target activity. |
| ADMET/toxicity | Tox21, ClinTox, MoleculeNet, ADMET-AI, ADMETlab 3.0 | Keep local trainable Tox21/ClinTox models for transparent offline ranking, then compare against stronger ADMET suites as optional external predictors. |
| Molecular dynamics | OpenMM 8 and ML-potential workflows | Current OpenMM ligand-pose relaxation replaces the proxy table; next move to parameterized protein-ligand complexes, restrained relaxations, explicit solvent, and eventually FEP-like late-stage validation. |
| Quantum chemistry | xTB GFN2 now active; Psi4/DFT planned | Retain xTB for high-throughput triage and add optional DFT refinement for top 1-3 molecules per target. |
| Quantum machine learning | Quantum feature maps, hybrid QML drug-discovery reviews | Use Qiskit statevector kernels twice: early portfolio prefiltering before docking/QM and late QM-aware reranking. Add classical-kernel ablations and noise-aware hardware backends when available. |

## Immediate Research Backlog

1. Curate binding pockets for EGFR, PARP1, and PIK3CA with explicit center/box definitions from co-crystal structures or literature.
2. Replace receptor-centroid boxes with curated pocket definitions from co-crystal structures or literature.
3. Replace GNINA receptor-centroid exploratory boxes with curated binding-pocket boxes and compare GNINA CNN scores against Vina/Smina poses.
4. Parameterize top complexes for OpenMM minimization and short trajectories; keep proxy MD only as a fallback.
5. Add DFT/Psi4 refinement for the top ranked molecule per target.
6. Add benchmark notebooks or scripts comparing rankings with and without quantum features.
