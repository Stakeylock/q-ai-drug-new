# AWS And MongoDB Deployment Architecture

The blueprint target architecture is AWS plus MongoDB Atlas for large-scale scientist workspaces.

## Components

- CloudFront + WAF: public web delivery and protection.
- Cognito/Auth0: identity, SSO, MFA, and API-token workflows.
- API Gateway or ALB: routes browser and API traffic to FastAPI services.
- ECS Fargate or EKS: API, web app, and light workers.
- AWS Batch or EKS GPU pools: docking, GNINA, OpenMM, xTB, and QML jobs.
- SageMaker: optional model training and serving registry.
- S3: CSV, SDF, PDB/PDBQT, trajectory, log, model, HTML, and PDF artifacts.
- MongoDB Atlas: users, organizations, projects, runs, candidates, evidence documents, artifacts, reports, usage events, audit logs, and billing metadata.
- MongoDB Atlas Vector Search: molecule, target, literature, and candidate dossier retrieval.
- Redis/SQS/Step Functions: job queues, retries, recovery, fan-out/fan-in.
- CloudWatch/OpenTelemetry: logs, metrics, traces, cost events.
- KMS/Secrets Manager: secrets and per-tenant encryption controls.

## MongoDB Candidate Evidence Document

The generated JSONL document at `outputs/cancer_proof_v1/candidate_evidence/candidate_evidence.jsonl` is shaped for a future MongoDB collection:

```json
{
  "candidate_id": "EGFR_CAND_0001",
  "project_id": "project_id",
  "target_id": "EGFR",
  "canonical_smiles": "...",
  "source": {"type": "generated", "method": "seed_expansion"},
  "activity": {"score": 0.82, "confidence": 0.70},
  "admet": {"risk_class": "low", "endpoint_risks": {}},
  "medchem": {"risk_class": "acceptable_oncology_like"},
  "docking": [{"engine": "vina_smina", "affinity_kcal_mol": -8.1}],
  "interactions": {"interaction_quality": "plausible_key_pocket_contacts"},
  "qm": {"homo_lumo_gap_ev": 4.2},
  "qml": {"qml_score": 0.61},
  "triage": {
    "class": "test_after_review",
    "reasons_to_test": [],
    "reasons_not_to_test": []
  },
  "artifacts": [],
  "audit": {}
}
```

## Cost Controls

- Estimate credits before every module run.
- Enforce plan-tier quotas before enqueueing scientific jobs.
- Persist credit reservations/refunds in a credit ledger.
- Store per-project usage events for molecules requested, docking pairs, QM rows, compute seconds, reports, and storage.
- Stage expensive work: preview first, docking later, QM later.
- Cap molecules for expensive stages.
- Cache receptor preparation and descriptors.
- Deduplicate libraries by canonical SMILES.
- Scale GPU workers to zero when idle.
- Reserve dedicated enterprise capacity only for contracted campaigns.

## Artifact Visibility

Runtime artifacts should use this convention when moved from local storage to S3 or MongoDB-backed metadata:

```text
private/projects/{organization_id}/{project_id}/runs/{run_id}/...
public/demo/{project_id}/reports/...
```

API uploads are private by default. Each artifact metadata row records storage backend, storage key, MIME type, checksum, size, visibility, and quality-card metadata. Public artifacts should be limited to explicitly exported demo reports and non-sensitive sample assets.
