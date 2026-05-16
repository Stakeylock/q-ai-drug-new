# Scientist-First Modular SaaS Implementation

This repository implements the scientist-facing blueprint as module contracts plus generated evidence artifacts. The product claim remains bounded: the platform outputs computational candidate hypotheses for research planning, not validated drugs or clinical recommendations.

## Implemented Product Modules

The canonical module registry is generated at:

```text
outputs/cancer_proof_v1/platform/module_registry.json
outputs/cancer_proof_v1/platform/module_execution_matrix.csv
outputs/cancer_proof_v1/platform/module_result_schema.json
```

It registers 18 modules:

- OncoData Builder
- Target Intelligence Workspace
- Protein Workbench
- Inhibitor Library Studio
- Q-Generate
- Activity Model Studio
- Q-Filter
- Applicability Domain Guard
- Q-Portfolio Prefilter
- Q-Dock Studio
- Q-View 3D
- Interaction Fingerprint Analyzer
- Ligand-Pose Relaxation
- Q-Orbital Analyzer
- Q-Rank
- Wet-Lab Triage Board
- Q-Report and Candidate Dossiers
- Collaboration and ELN Bridge

Each entry includes input schema, output schema, queue, artifact types, minimum tier, credit estimator, quality gate, failure policy, dependencies, export formats, and claim boundary.

Every registered module is executable through `q_ai_drug.product.module_execution.execute_module`. Dry runs use the same result schema through `dry_run_module` and do not perform scientific compute.

Standard module result shape:

```json
{
  "module_id": "q_filter",
  "project_id": "cancer_proof_v1",
  "run_id": "...",
  "status": "succeeded",
  "execution_mode": "dry_run|small_or_production",
  "artifacts": [],
  "warnings": [],
  "limitations": [],
  "next_actions": [],
  "credits_used": 0.1,
  "claim_boundary": "Computational research hypothesis only. Wet-lab validation is required."
}
```

The validation gate checks that the execution matrix covers all 18 modules, declares dry-run/small/production support, and does not permit contract-recorded placeholders for non-dry-run production paths.

## No-Hard-Limit Wet-Lab Triage

The platform no longer treats a fixed top-N as the scientific output. The triage board classifies all available ranked candidates into:

- `test_now`
- `test_after_review`
- `watchlist`
- `reject_hold`

Generated artifacts:

```text
outputs/cancer_proof_v1/triage/wet_lab_triage_board.csv
outputs/cancer_proof_v1/triage/wet_lab_triage_summary.json
outputs/cancer_proof_v1/triage/wet_lab_assay_pack.md
outputs/cancer_proof_v1/triage/wet_lab_triage_board.html
```

Every row carries reasons to test, reasons not to test, evidence completeness, confidence class, and a recommended assay plan. The triage board is a research planning tool only.

## Inhibitor Registry And Proximity Guard

Known inhibitors are implemented as controls, seeds, benchmarks, novelty guards, and explainability anchors.

Generated artifacts:

```text
outputs/cancer_proof_v1/inhibitors/inhibitor_registry.csv
outputs/cancer_proof_v1/inhibitors/candidate_inhibitor_proximity.csv
outputs/cancer_proof_v1/inhibitors/inhibitor_comparison_dossier.md
```

Candidates with Tanimoto similarity greater than 0.90 to a configured reference inhibitor are explicitly blocked from novelty claims.

## Candidate Evidence Documents

MongoDB-shaped candidate evidence documents are generated for downstream SaaS ingestion:

```text
outputs/cancer_proof_v1/candidate_evidence/candidate_evidence.jsonl
outputs/cancer_proof_v1/candidate_evidence/mongodb_candidate_documents.json
outputs/cancer_proof_v1/candidate_evidence/candidate_evidence_schema.json
outputs/cancer_proof_v1/candidate_evidence/mongodb_indexes.json
```

Each document contains identity, source, activity, ADMET, medchem, applicability domain, inhibitor proximity, docking, interactions, pose relaxation, QM, QML, triage, artifacts, and audit metadata.

## Service APIs

Core module APIs:

```text
GET  /v1/tools
GET  /v1/tools/{module_id}
GET  /projects/{project_id}/tools
POST /projects/{project_id}/tools/{module_id}/estimate
POST /projects/{project_id}/tools/{module_id}/run
POST /v1/tools/{module_id}/run
GET  /v1/billing/summary
POST /v1/billing/plan
GET  /projects/{project_id}/usage
GET  /projects/{project_id}/triage
GET  /projects/{project_id}/candidate-evidence
GET  /v1/candidates/{candidate_id}/dossier?project_id=...
```

Upload endpoints return professional input quality cards for CSV/SMILES, SDF, PDB/PDBQT, and YAML inputs.

## Credit Ledger And Quotas

The service now creates an organization billing account on first use, checks module tier/quota limits before enqueueing a job, reserves credits in `credit_ledger`, and records requested molecules, docking pairs, and QM rows in `usage_events`.

Quota enforcement happens before compute starts:

- The requested module tier cannot exceed the organization's plan tier.
- Per-run molecule limits use the active plan's `molecules_per_run`.
- Docking and QM monthly request counters are checked against tier quotas.
- Dry runs reserve a minimal 0.1 credit and validate access/quota/result contracts only.
- Higher team/enterprise tiers are enqueued with high RQ priority when queue mode is active.

Artifacts uploaded through the API are private by default and carry storage backend plus quality-card metadata. Public/demo reports should be explicitly marked public when object storage policies are added.

## Claim Boundary

Every module and report must preserve:

```text
Computational research hypothesis only. Not a therapeutic, diagnostic, clinical, or regulatory claim. Wet-lab validation is required.
```
