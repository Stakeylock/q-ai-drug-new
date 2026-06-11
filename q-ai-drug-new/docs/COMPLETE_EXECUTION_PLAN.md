# Q-AI Drug — Complete Execution Plan

**Goal:** turn the current Q-AI Drug repository into a scientist-usable, deployable computational drug-discovery platform where users can upload their own data, run modules, inspect evidence, prioritize cancer drug candidates, and export wet-lab-ready reports.

This plan assumes the current repo already contains:

- module registry and tier definitions;
- standalone runners for OncoData Builder, Q-Filter, Q-Orbital Analyzer, Q-Dock Studio;
- MVP downstream runners for Activity Model Studio, Applicability Domain Guard, Q-Rank, Wet-Lab Triage Board, and Q-Report;
- local artifact registry;
- billing reserve/commit/refund skeleton;
- initial tests for payload validation, runners, billing, and artifacts.

The remaining work is to harden science, workflow, UI, billing, artifacts, deployment, and validation until the system is useful to real users.

---

## 1. Product Definition

The application should allow a scientist to complete this flow without touching code:

```text
Create account
→ Create project
→ Upload data
→ System detects file types
→ System recommends workflow
→ User runs modules from guided forms
→ Jobs execute with progress/status
→ Results are saved as project artifacts
→ Candidate evidence is reviewed in a board
→ Wet-lab triage produces test decisions
→ Reports/export packages are generated
```

The golden-path cancer discovery workflow is:

```text
OncoData Builder
→ Q-Filter
→ Activity Model Studio
→ Applicability Domain Guard
→ Q-Dock Studio
→ Q-Orbital Analyzer
→ Q-Rank
→ Wet-Lab Triage Board
→ Q-Report
```

The system must not claim that a molecule is a validated drug. The system should claim only:

```text
computational candidate prioritization;
computational evidence generation;
wet-lab triage support;
research hypothesis generation.
```

---

## 2. Current State Summary

### Strong parts already present

- Module contracts exist.
- Typed payloads exist for core modules.
- Several standalone module runners exist.
- Q-Filter can process molecules and perform medchem filtering.
- Q-Orbital has xTB/EHT-style paths.
- Q-Dock has a real Vina path with mock fallback.
- OncoData has live/fallback data-source handling and schema normalization.
- Local artifact resolver exists.
- Billing reserve/commit/refund functions exist.
- Initial tests exist.

### Main remaining gaps

- Downstream MVP runners need scientific hardening.
- Guided UI forms are still required.
- Upload classifier and workflow recommendations are missing or incomplete.
- Candidate Evidence Board is missing or incomplete.
- Artifact auth/private access is not complete.
- Billing should commit from actual measured usage, not only estimated credits.
- Q-Dock needs redocking validation, stronger logs, and optional advanced scoring integration.
- Q-Orbital needs logs, method-specific behavior, and stricter output validation.
- Q-Filter ADMET metadata/model versioning must be explicit.
- OncoData needs duplicate/conflict resolution and stronger uploaded-assay curation.
- Deployment worker environment needs documented tool checks.

---

## 3. Workstream Overview

Work should be split into nine parallel tracks:

1. **Scientific Module Hardening**
2. **Artifact and Storage System**
3. **Billing and Usage Metering**
4. **Scientist UX and Frontend Forms**
5. **Candidate Evidence and Reporting**
6. **Testing and CI**
7. **Security and Access Control**
8. **Deployment Readiness**
9. **Documentation and Investor Demo Readiness**

Each track has specific deliverables below.

---

## 4. Phase 0 — Immediate Stabilization

### 4.1 Run and fix the test suite

**Goal:** make sure the current repo is not broken after the latest runner additions.

Commands:

```bash
pip install -e ".[dev,chem,data]"
pytest
```

If full scientific dependencies are not available:

```bash
pip install -e ".[dev]"
pytest -m "not chemistry"
```

### Required actions

- Verify `tests/test_module_runner_dispatch.py` sees all implemented runners.
- Verify `tests/test_q_filter_runner.py` passes with RDKit installed.
- Verify `tests/test_q_orbital_runner.py` passes with xTB unavailable and EHT fallback.
- Verify `tests/test_q_dock_runner.py` passes when Vina/OpenBabel are unavailable by checking mock mode.
- Verify `tests/test_onco_data_builder_runner.py` passes after schema normalization changes.
- Verify artifact resolver tests pass.
- Verify billing commit/refund tests pass.

### Acceptance criteria

```text
[ ] pytest passes locally with dev extras.
[ ] chemistry tests either pass with chem extras or skip cleanly.
[ ] no import error from downstream.py.
[ ] module registry returns all implemented runner classes.
```

---

## 5. Phase 1 — Scientific Module Hardening

## 5.1 OncoData Builder

### Current purpose

OncoData Builder should create curated, versioned, target-specific oncology datasets from public and uploaded data.

### Remaining tasks

#### A. Uploaded assay normalization

Implement robust uploaded CSV normalization for:

```text
smiles / SMILES / canonical_smiles
compound_id / molecule_id / id
target / gene / target_id
IC50 / EC50 / Ki / Kd / AC50 / activity_value / standard_value
unit / units / standard_units
pActivity / p_activity / pchembl_value
assay_type / activity_type / standard_type
```

Outputs:

```text
uploaded_assay_normalized.csv
uploaded_assay_rejected_rows.csv
uploaded_assay_curation_summary.json
```

#### B. Duplicate/conflict resolution

Add duplicate handling by:

```text
target_id + canonical_smiles + standard_type
```

Generate:

```text
duplicate_resolution.csv
conflicting_measurements.csv
```

Columns:

```text
duplicate_group_id
measurement_count
min_p_activity
median_p_activity
max_p_activity
activity_std
conflict_flag
resolution_rule
```

#### C. Scaffold split

Generate scaffold-aware train/validation/test splits where RDKit is available.

Outputs:

```text
curated_activity_with_split.csv
train.csv
valid.csv
test.csv
scaffold_split_summary.csv
```

#### D. Provenance hardening

Provenance should include:

```text
source_mode
source_files
source_api
fallback_reason
retrieved_at
target_query
dataset_hash
schema_version
curation_profile
```

### Acceptance criteria

```text
[ ] public-only mode works.
[ ] uploaded-only mode works.
[ ] public-plus-uploaded mode works.
[ ] p_activity and pActivity are always synchronized.
[ ] duplicate/conflict report is generated.
[ ] downstream Activity Model Studio can consume curated_activity.csv directly.
```

---

## 5.2 Q-Filter

### Current purpose

Q-Filter filters molecules using RDKit descriptors, structural alerts, medchem rules, and optional ADMET scoring.

### Remaining tasks

#### A. ADMET model metadata

When ADMET is used, write:

```text
admet_model_manifest.json
```

with:

```text
model_path
model_hash
model_version
endpoint_names
fingerprint_type
fingerprint_radius
fingerprint_bits
training_dataset
output_dimension
claim_boundary
```

#### B. Endpoint-specific outputs

Do not only output generic toxicity risk. Output endpoint columns where available:

```text
tox21_NR_AR
tox21_NR_AhR
tox21_SR_p53
clintox_toxic
clintox_fda_approved_proxy
```

If endpoint mapping is unknown, write:

```text
endpoint_mapping_unknown: true
```

#### C. SDF export

Write:

```text
filtered_candidates.sdf
```

so Q-Dock and Q-Orbital can consume selected molecules.

#### D. Stronger chemistry alerts

Use RDKit FilterCatalog when available:

```text
PAINS
Brenk
NIH
ZINC
```

Fallback to simple SMARTS only if FilterCatalog is unavailable.

### Acceptance criteria

```text
[ ] invalid molecules are reported.
[ ] duplicate molecules are reported.
[ ] every rejected molecule has a reason.
[ ] filtered_candidates.csv and filtered_candidates.sdf are both written.
[ ] ADMET manifest is written when run_admet=true.
```

---

## 5.3 Q-Orbital Analyzer

### Current purpose

Q-Orbital computes molecular electronic descriptors using xTB where available and RDKit/EHT fallback otherwise.

### Remaining tasks

#### A. Method-specific behavior

Define behavior clearly:

```text
method=xtb → fail if xTB unavailable unless allow_fallback=true
method=rdkit_fallback → never call xTB
method=auto → try xTB, fallback to EHT
```

#### B. Per-molecule logs

Write:

```text
qm/logs/<candidate_id>.stdout.txt
qm/logs/<candidate_id>.stderr.txt
```

#### C. Output schema

Standardize descriptor columns:

```text
candidate_id
canonical_smiles
qm_mode
qm_is_real
homo_ev
lumo_ev
homo_lumo_gap_ev
total_energy
basis_or_method
failure_reason
claim_boundary
```

#### D. Failure policy

Every molecule must be one of:

```text
xtb_success
eht_fallback
failed_conformer
failed_xtb
failed_parse
skipped_limit
```

### Acceptance criteria

```text
[ ] xTB unavailable path is tested.
[ ] EHT fallback path is tested.
[ ] method=xtb has explicit behavior.
[ ] no molecule disappears silently.
[ ] qm_failure_report.csv is always written.
```

---

## 5.4 Q-Dock Studio

### Current purpose

Q-Dock performs receptor-ligand docking and produces scores, poses, and logs.

### Remaining tasks

#### A. Real Vina verification

Add fixture-based tests with a tiny receptor and ligand. If Vina is unavailable in CI, mock the subprocess and verify parsing.

#### B. Pose output

Ensure all successful docking rows include:

```text
pose_file
pose_format
log_file
docking_is_real
engine_used
```

#### C. Redocking validation

Add support for:

```text
reference_ligand_file
reference_ligand_artifact_id
run_redocking_validation=true
```

Outputs:

```text
redocking_validation.csv
reference_pose.sdf
redocked_pose.sdf
rmsd_angstrom
validation_status
```

Rules:

```text
RMSD <= 2.0 Å: pass
RMSD > 2.0 Å: fail/downgrade docking confidence
missing reference: validation_not_run
```

#### D. GNINA/Smina honesty

Either implement real GNINA/Smina or change engine labels so the UI does not claim unsupported engines.

#### E. Interaction fingerprints

After docking, generate or trigger:

```text
interaction_fingerprints.csv
```

Minimum columns:

```text
candidate_id
pose_file
contact_residues
hbond_like_contacts
hydrophobic_contacts
salt_bridge_like_contacts
interaction_quality
```

### Acceptance criteria

```text
[ ] real Vina path works or is tested with mocked subprocess.
[ ] mock mode is clearly marked.
[ ] pose files open in Q-View 3D.
[ ] failed ligands are reported.
[ ] redocking validation exists when reference ligand is provided.
```

---

## 5.5 Activity Model Studio

### Current state

MVP runner exists, but it is currently fallback/heuristic when no trained model artifact is linked.

### Required final behavior

Support two modes:

```text
predict
train
```

#### Predict mode

Inputs:

```text
candidate_artifact_id
candidate_upload_file
model_id
target_id
```

Outputs:

```text
activity_predictions.csv
prediction_failures.csv
activity_model_summary.json
```

#### Train mode

Inputs:

```text
curated_activity_artifact_id
target_id
split_strategy
model_family
```

Outputs:

```text
trained_model.joblib
model_metrics.json
model_comparison.csv
calibration_curve.png
scaffold_split_metrics.json
```

### Acceptance criteria

```text
[ ] predict mode works from Q-Filter output.
[ ] train mode works from OncoData output.
[ ] model artifact hash/version is recorded.
[ ] prediction rows contain model_id and confidence.
```

---

## 5.6 Applicability Domain Guard

### Current state

MVP runner exists, using simple proxy labels.

### Required final behavior

Implement true applicability domain using fingerprints/descriptors.

Inputs:

```text
candidate_artifact_id
training_set_artifact_id
reference_inhibitors_artifact_id optional
```

Compute:

```text
ECFP fingerprint
nearest training similarity
nearest active similarity
nearest inhibitor similarity
scaffold novelty
out-of-domain label
confidence adjustment
```

Outputs:

```text
applicability_domain.csv
applicability_domain_summary.json
scaffold_novelty.csv
```

### Acceptance criteria

```text
[ ] candidates receive high/medium/low/out-of-domain labels.
[ ] out-of-domain predictions are downgraded in Q-Rank.
[ ] nearest-neighbor evidence is included.
```

---

## 5.7 Q-Rank

### Current state

MVP runner exists and combines evidence heuristically.

### Required final behavior

Q-Rank should combine:

```text
Q-Filter output
Activity predictions
Applicability domain output
Q-Dock output
Q-Orbital output
ADMET risk
Medchem risk
```

Output:

```text
ranked_candidates.csv
rank_explanations.csv
weight_config_used.json
missing_evidence_report.csv
```

Every row should include:

```text
final_score
rank
why_high
why_low
missing_evidence
claim_boundary
```

### Acceptance criteria

```text
[ ] ranking works when some evidence is missing.
[ ] missing evidence is explicit, not silent.
[ ] user can change ranking method/weights.
[ ] ranked output can feed Wet-Lab Triage.
```

---

## 5.8 Wet-Lab Triage Board

### Current state

MVP runner exists.

### Required final behavior

Use ranking plus evidence to classify candidates:

```text
test_now
test_after_review
watchlist
reject_hold
```

Outputs:

```text
wet_lab_triage_board.csv
test_now.csv
test_after_review.csv
watchlist.csv
reject_hold.csv
assay_pack.md
wet_lab_triage_summary.json
```

Each row must include:

```text
reasons_to_test
reasons_not_to_test
recommended_first_assay
minimum_next_validation
procurement_or_synthesis_note
```

### Acceptance criteria

```text
[ ] no hard top-N cutoff is required.
[ ] every decision has reasons.
[ ] assay pack is generated.
[ ] report can consume triage board.
```

---

## 5.9 Q-Report

### Current state

MVP markdown/HTML report exists.

### Required final behavior

Generate professional exports:

```text
report.html
report.pdf
report.md
selected_candidates.csv
selected_candidates.sdf
candidate_dossiers/*.md
candidate_dossiers/*.pdf optional
assay_pack.md
limitations.md
claim_matrix.csv
```

### Acceptance criteria

```text
[ ] user can select candidates.
[ ] report includes evidence and limitations.
[ ] report includes wet-lab triage if requested.
[ ] report package can be downloaded.
```

---

## 6. Phase 2 — Artifact System

### Current state

Local filesystem artifact registry exists.

### Remaining tasks

#### A. Register all module artifacts

Every output file must have:

```text
artifact_id
project_id
module_id
run_id
artifact_type
file_path
size_bytes
checksum
row_count
metadata
created_at
is_private
```

#### B. Artifact download route

Add authenticated endpoints:

```text
GET /projects/{project_id}/artifacts
GET /projects/{project_id}/artifacts/{artifact_id}
GET /projects/{project_id}/artifacts/{artifact_id}/download
```

#### C. Cross-module selection

Frontend module forms must allow selecting prior artifacts instead of typing IDs manually.

#### D. Future storage compatibility

Artifact records should support:

```text
local_path
storage_uri
s3_uri optional
mongo_document_id optional
```

### Acceptance criteria

```text
[ ] every module output has artifact_id.
[ ] artifact list endpoint works.
[ ] artifact download enforces project access.
[ ] module forms can consume previous artifacts.
```

---

## 7. Phase 3 — Billing and Usage Metering

### Current state

Credit reservation, commit, and refund functions exist.

### Remaining tasks

#### A. Actual usage calculator

Implement:

```text
src/q_ai_drug/service/usage_pricing.py
```

Function:

```python
calculate_actual_credits(module_id: str, usage_actual: dict, payload: dict) -> float
```

Use actual usage fields:

```text
molecule_count
valid_molecule_count
failed_molecule_count
docking_pairs_completed
qm_rows_completed
runtime_seconds
storage_bytes_written
reports_generated
```

#### B. Wire into task completion

`run_module_task()` should:

```text
reserve estimated credits before queue
run module
read module_result.usage.actual
calculate actual credits
commit actual credits
refund difference if needed
record usage events
```

#### C. Billing UI

Show:

```text
reserved credits
actual credits
refunded credits
remaining balance
quota used
quota remaining
```

### Acceptance criteria

```text
[ ] failed validation does not charge.
[ ] partial failure charges according to policy.
[ ] successful run commits actual usage.
[ ] user sees requested vs actual usage.
```

---

## 8. Phase 4 — Scientist UX

### 8.1 Scientist Home Page

Add a landing page that asks:

```text
What do you want to do?
```

Cards:

```text
Build oncology dataset
Filter my molecules
Predict activity
Check applicability domain
Dock molecules
Run orbital descriptors
Rank candidates
Create wet-lab shortlist
Generate report
```

Each card should show:

```text
required inputs
expected outputs
estimated credits
tier requirement
recommended next step
```

### 8.2 Guided Forms

Build forms for:

```text
OncoData Builder
Q-Filter
Activity Model Studio
Applicability Domain Guard
Q-Dock Studio
Q-Orbital Analyzer
Q-Rank
Wet-Lab Triage
Q-Report
```

Forms should have:

```text
upload/select artifact controls
parameter fields
estimate button
run button
expected outputs
claim boundary
```

### 8.3 Upload Classifier

When a file is uploaded, classify it as:

```text
SMILES CSV
SDF molecule library
PDB/PDBQT receptor
assay CSV
known inhibitors CSV
pocket config
ranking/evidence CSV
unknown
```

Recommend modules:

```text
SMILES CSV → Q-Filter
SDF → Q-Filter/Q-Orbital/Q-Dock
PDB → Q-Dock
assay CSV → OncoData/Activity Model Studio
ranking CSV → Wet-Lab Triage/Q-Report
```

### Acceptance criteria

```text
[ ] user can run common workflows without raw JSON.
[ ] uploaded files trigger recommended modules.
[ ] user can select previous artifacts from dropdowns.
```

---

## 9. Phase 5 — Candidate Evidence Board

Create a central candidate review workspace.

Columns:

```text
candidate_id
target_id
canonical_smiles
final_score
rank
triage_class
activity_score
activity_confidence
applicability_domain
docking_score
docking_is_real
qm_mode
homo_lumo_gap_ev
ADMET risk
medchem risk
reasons_to_test
reasons_not_to_test
```

Actions:

```text
open 3D pose
send to Q-Dock
send to Q-Orbital
send to Q-Rank
send to Wet-Lab Triage
add scientist note
export selected
create report
```

### Acceptance criteria

```text
[ ] user can review candidate evidence in one place.
[ ] user can select candidates for report.
[ ] evidence gaps are visible.
[ ] wet-lab triage classes are visible.
```

---

## 10. Phase 6 — Security and Access Control

### Required controls

- Project membership check.
- Organization role check.
- Artifact access check.
- Private upload protection.
- Private output protection.
- No private project artifacts through public static mounts.
- Audit logs for downloads and module runs.

### Artifact access policy

```text
same project + authorized user → allow
same organization + sufficient role → allow
public demo artifact → allow
otherwise → deny
```

### Acceptance criteria

```text
[ ] user cannot access another project artifact.
[ ] artifact downloads require auth.
[ ] demo artifacts are clearly separated from private artifacts.
```

---

## 11. Phase 7 — Deployment Readiness

### Science worker environment

Create:

```text
Dockerfile.science-worker
scripts/check_science_tools.py
docs/aws_worker_requirements.md
```

Tool checks:

```text
Python version
RDKit
FilterCatalog
OpenBabel/obabel
Vina
Smina optional
GNINA optional
xTB
Qiskit optional
CUDA optional
```

### Deployment components

Backend:

```text
FastAPI API service
worker service
Redis/RQ queue
Postgres or Mongo metadata store
object storage for artifacts
```

Worker classes:

```text
cpu-light: Q-Filter, OncoData, Activity predictions
cpu-heavy: Q-Dock, Q-Orbital
optional-gpu: GNINA/deep models
```

### Acceptance criteria

```text
[ ] science-worker image can run check_science_tools.py.
[ ] each worker type declares required binaries.
[ ] module queues route to correct worker class.
```

---

## 12. Phase 8 — Documentation

Required docs:

```text
docs/user_workflows.md
docs/module_input_output_contracts.md
docs/artifact_uri_contract.md
docs/billing_usage_contract.md
docs/aws_worker_requirements.md
docs/scientific_claim_boundaries.md
docs/demo_script_investor_pitch.md
```

Each module doc should include:

```text
what it does
inputs
outputs
limitations
claim boundary
example payload
example output
common failure states
recommended next module
```

---

## 13. Phase 9 — Investor Demo Script

The demo should show:

```text
1. Login.
2. Create project.
3. Upload molecule library.
4. Q-Filter filters molecules.
5. Activity Model Studio scores candidates.
6. Applicability Domain Guard labels confidence.
7. Q-Dock docks selected candidates.
8. Q-Orbital computes descriptors.
9. Q-Rank produces ranked candidates.
10. Wet-Lab Triage gives test decisions.
11. Q-Report exports a report.
12. Billing/artifact history shows traceability.
```

Avoid claiming:

```text
we discovered a validated drug
this molecule cures cancer
quantum superiority is proven
wet-lab success is guaranteed
```

Use:

```text
we generated computationally prioritized candidates
we reduced the search space
we produced auditable evidence packages
we identify candidates for wet-lab validation
```

---

## 14. Team Split

### Person A — Scientific backend

Owns:

```text
OncoData hardening
Q-Filter ADMET metadata
Q-Orbital logs/schema
Q-Dock redocking/interactions
Activity Model Studio train/predict
Applicability Domain Guard
```

### Person B — Product/backend infra

Owns:

```text
artifact endpoints
billing actual-usage pricing
job progress timeline
private artifact access
module forms API support
queue routing
```

### Person C — Frontend/demo/docs

Owns:

```text
Scientist Home
guided forms
upload classifier UI
Candidate Evidence Board
Q-Report UI
investor demo flow
user docs
```

AWS/Mongo teammate owns:

```text
object storage
Mongo/Postgres deployment
worker deployment
cloud auth/secrets
monitoring
```

---

## 15. Immediate Next Sprint

### Sprint target

Make the product demoable with user-uploaded molecules and a complete module chain.

### Tasks

1. Run tests and fix failures.
2. Add actual-usage credit calculator.
3. Add artifact list/download endpoints.
4. Add Q-Filter guided form.
5. Add Q-Rank/Wet-Lab/Q-Report smoke tests.
6. Add upload classifier backend.
7. Add Candidate Evidence Board skeleton.
8. Add Q-Dock redocking stub with honest status.
9. Add Q-Orbital log output.
10. Write investor demo script.

### Demo acceptance

```text
[ ] user uploads CSV molecules.
[ ] Q-Filter runs.
[ ] Activity Model Studio runs.
[ ] Applicability Domain Guard runs.
[ ] Q-Rank runs.
[ ] Wet-Lab Triage runs.
[ ] Q-Report runs.
[ ] all outputs have artifact IDs.
[ ] user sees limitations and claim boundaries.
```

---

## 16. Final Definition of Done

The platform is ready to call a deployable scientist-facing drug-discovery SaaS when:

```text
[ ] every common workflow runs without JSON editing.
[ ] every module accepts project artifacts as inputs.
[ ] every output is registered as an artifact.
[ ] artifact access is private and project-scoped.
[ ] billing uses actual usage after execution.
[ ] candidate evidence is visible in a board.
[ ] wet-lab triage produces reasons to test/not test.
[ ] reports export selected candidates and limitations.
[ ] tests cover module runners and core API flows.
[ ] deployment worker requirements are documented and testable.
[ ] claims are scientifically conservative and auditable.
```

Until then, the correct positioning is:

```text
research-grade computational drug-discovery platform prototype with growing SaaS infrastructure
```

After completion, the positioning becomes:

```text
scientist-facing computational drug-discovery SaaS for auditable in-silico candidate prioritization
```
