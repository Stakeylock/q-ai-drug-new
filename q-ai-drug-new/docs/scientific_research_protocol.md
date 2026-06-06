# Scientific Research Protocol

## Study Claim

This project is a computational oncology hit-prioritization workflow for EGFR, PARP1, and PIK3CA. It produces ranked computational candidate hypotheses. It does not produce experimentally validated drugs.

## Reproducible Workflow

1. Retrieve public oncology bioactivity and structure data.
2. Build a scaffold-split activity benchmark.
3. Curate public activity rows with explicit curation flags.
4. Train and compare baseline activity models and similarity baselines.
5. Train early ADMET/toxicity triage models from Tox21 and ClinTox.
6. Generate a target-conditioned seed-expanded and template-enumerated analogue library.
7. Filter candidates with drug-likeness, medchem, ADMET, and quantum-prefilter scores.
8. Dock selected candidates with Vina/Smina and rescore selected candidates with GNINA.
9. Validate docking setup with reference-ligand redocking where co-crystal structures are available.
10. Compute interaction fingerprints instead of relying on docking score alone.
11. Run OpenMM ligand-pose relaxation as local pose triage.
12. Compute xTB/QM descriptor summaries for late-stage electronic plausibility.
13. Run Qiskit quantum-kernel reranking and compare with classical and random controls.
14. Calibrate or label ranking weights using retrospective proxy benchmarks.
15. Build candidate dossiers with failure risks and wet-lab next steps.

## Evidence Levels

- Level 0: generated hypothesis.
- Level 1: computationally prioritized hit.
- Level 2: high-confidence computational hit hypothesis.
- Level 3: experimental hit, not available unless biochemical or cellular validation exists.

## Required Commands

```powershell
q-ai-drug run-cancer-proof --config configs/cancer_targets.yaml --out outputs/cancer_proof_v1 --max-records-per-target 1000
q-ai-drug harden-scientific-study --project outputs/cancer_proof_v1 --config configs/cancer_targets.yaml --benchmark data/processed/oncology_benchmark.csv --references data/processed/reference_inhibitors.csv
python scripts/validate_research_artifacts.py --project outputs/cancer_proof_v1 --tier proof
```

## Claim Boundary

Use "computational candidate hypothesis", "retrospective benchmark", "early-stage computational triage", and "requires wet-lab validation". Do not claim clinical validation, therapeutic efficacy, or experimental hit confirmation from repository outputs alone.
