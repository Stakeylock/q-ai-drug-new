# Developer Quick Reference: Using Module Runners

This guide explains how to use the newly implemented module runners and payload models.

---

## 1. Understanding Payload Models

All payloads are defined in `src/q_ai_drug/service/tool_payloads.py` with Pydantic validation.

### Example: Q-Filter Payload

```python
from q_ai_drug.service.tool_payloads import QFilterPayload, validate_payload

# User submits this JSON via API
payload_dict = {
    "candidate_upload_file": "molecules.csv",
    "filter_profile": "standard",
    "run_admet": True,
    "max_molecules": 500,
}

# Validate before queuing
try:
    validated = validate_payload("q_filter", payload_dict)
    print("✓ Payload is valid")
except ValueError as e:
    print(f"✗ Invalid payload: {e}")
    # Return 400 to user with helpful error message
```

### Available Payloads

```python
QFilterPayload
QOrbitalAnalyzerPayload
QDockStudioPayload
ActivityModelStudioPayload
QRankPayload
WetLabTriagePayload
QReportPayload
ApplicabilityDomainPayload
```

---

## 2. Running a Module

### Option A: Direct Python Call

```python
from q_ai_drug.product.module_runners import get_runner
from pathlib import Path

project_dir = Path("outputs/cancer_proof_v1")
run_id = "run_2026_05_15_001"
payload = {
    "candidate_upload_file": "molecules.csv",
    "filter_profile": "standard",
    "run_admet": True,
}

# Get the runner
runner_class = get_runner("q_filter")
runner = runner_class(project_dir, run_id, payload)

# Execute (returns module_result.json)
result = runner.execute()

print(result)
# {
#     "module_id": "q_filter",
#     "status": "succeeded",
#     "artifacts": [...],
#     "usage": {"requested": {...}, "actual": {...}},
#     ...
# }
```

### Option B: Via Function

```python
from q_ai_drug.product.module_runners.q_filter import run_q_filter
from pathlib import Path

project_dir = Path("outputs/cancer_proof_v1")
result = run_q_filter(
    project_dir=project_dir,
    run_id="run_2026_05_15_001",
    payload=payload
)
```

### Option C: Via Task Queue (Recommended for API)

```python
# In tools.py route
from q_ai_drug.service.queue import enqueue_module_task

job = enqueue_module_task(
    module_id="q_filter",
    project_id="cancer_proof_v1",
    payload=validated_payload,
)

# Job runs asynchronously, writes results to disk
# Frontend polls for job status
```

---

## 3. Understanding Module Results

Every module produces a standardized `module_result.json`:

```json
{
    "module_id": "q_filter",
    "module_name": "Q-Filter",
    "project_id": "cancer_proof_v1",
    "run_id": "run_2026_05_15_001",
    "status": "succeeded",
    "execution_mode": "standard",
    "queue": "scoring",
    "artifacts": [
        {
            "type": "csv",
            "name": "Filtered candidates",
            "uri": "/abs/path/to/filtered_candidates.csv",
            "relative_path": "module_runs/q_filter/run.../filtered_candidates.csv",
            "size_bytes": 45620,
            "checksum": "a1b2c3d4e5f6",
            "created_at": "2026-05-15T14:30:00Z"
        }
    ],
    "warnings": [
        "3 molecules (2.1%) failed parsing"
    ],
    "claim_boundary": "Computational research hypothesis only. Wet-lab validation required.",
    "usage": {
        "requested": {
            "molecule_count": 150
        },
        "actual": {
            "molecule_count": 150,
            "valid_molecule_count": 147,
            "failed_molecule_count": 3,
            "filtered_count": 95,
            "rejected_count": 52
        }
    },
    "created_at": "2026-05-15T14:30:05Z"
}
```

---

## 4. Available Runners

### Q-Filter (`q_filter.py`)

Filters molecules by drug-likeness and medchem risk.

**Input:**
```python
QFilterPayload(
    candidate_upload_file="molecules.csv",  # SMILES CSV or SDF
    filter_profile="standard",  # strict, standard, oncology_permissive
    run_admet=True,
    max_molecules=1000,
)
```

**Output:**
- `filtered_candidates.csv` — Passed molecules
- `rejected_candidates.csv` — Failed molecules
- `reject_reasons.csv` — Why each failed
- `medchem_risk_table.csv` — Structural alerts
- `q_filter_summary.json` — Statistics

**Usage Tracking:**
- `molecule_count`, `valid_molecule_count`, `failed_molecule_count`
- `filtered_count`, `rejected_count`

### Q-Orbital Analyzer (`q_orbital_analyzer.py`)

Computes quantum descriptors (HOMO/LUMO/gap).

**Input:**
```python
QOrbitalAnalyzerPayload(
    candidate_upload_file="molecules.sdf",  # SMILES CSV or SDF
    method="auto",  # xtb, rdkit_fallback, auto
    max_molecules=100,
)
```

**Output:**
- `qm_descriptors.csv` — HOMO, LUMO, gap, dipole
- `qm_failure_report.csv` — Failed molecules
- `qm_descriptor_summary.json` — Statistics

**Usage Tracking:**
- `completed_qm_rows`, `failed_qm_rows`

### Q-Dock Studio (`q_dock_studio.py`)

Runs molecular docking.

**Input:**
```python
QDockStudioPayload(
    receptor_upload_file="receptor.pdb",  # PDB/PDBQT/mmCIF
    ligand_upload_file="ligands.sdf",  # SDF or SMILES CSV
    pocket_source="uploaded_box",
    pocket_box=PocketBox(
        center_x=-10.5, center_y=5.3, center_z=12.1,
        size_x=20, size_y=20, size_z=20,
    ),
    engine="vina_smina",  # vina, smina, gnina, vina_smina, vina_smina_gnina
    exhaustiveness=8,
    max_ligands=500,
)
```

**Output:**
- `docking_results.csv` — Scores and metrics
- `docking_failure_table.csv` — Failed ligands
- `poses/` — Individual pose SDF files
- `q_dock_summary.json` — Statistics

**Usage Tracking:**
- `docking_pairs`, `completed_docking_pairs`, `failed_docking_pairs`

---

## 5. Error Handling

Runners catch errors gracefully and return structured failure information:

```python
# Invalid payload
try:
    validate_payload("q_filter", {"invalid_field": "x"})
except ValueError as e:
    print(e)
    # ValueError: Invalid Q-Filter payload: field required

# Missing input
runner.execute()
# Returns:
# {
#     "status": "failed",
#     "failure_code": "missing_input",
#     "failure_message": "Upload file not found: molecules.csv",
#     "actionable_message": "Upload a SMILES CSV or SDF file before running.",
# }

# Computation failure
# {
#     "status": "failed",
#     "failure_code": "failed_compute",
#     "failure_message": "Docking failed: Vina subprocess error",
# }
```

---

## 6. Usage Tracking for Billing

Every runner tracks requested vs actual usage:

```python
result["usage"] = {
    "requested": {
        "molecule_count": 500,  # What user asked for
    },
    "actual": {
        "molecule_count": 498,  # What was processed
        "valid_molecule_count": 475,
        "failed_molecule_count": 23,
        "filtered_count": 321,
        "rejected_count": 154,
    }
}
```

This allows:
- **Accurate billing:** Charge for what was actually computed
- **Quota tracking:** Count actual molecules processed, not requested
- **Transparency:** Users see why they were charged

---

## 7. Artifacts and Downloads

Every module output is registered as an artifact:

```python
# In runner.write_outputs()
path = self.write_csv(rows, "filtered_candidates")
artifact = self.register_artifact(path, "csv", "Filtered candidates")

# artifact dict:
{
    "type": "csv",
    "name": "Filtered candidates",
    "uri": "/abs/path/to/filtered_candidates.csv",
    "relative_path": "module_runs/q_filter/.../filtered_candidates.csv",
    "size_bytes": 45620,
    "checksum": "a1b2c3d4e5f6",
    "created_at": "2026-05-15T14:30:00Z",
}
```

**To download:**
```python
# Future: GET /projects/{project_id}/artifacts/{artifact_id}
# Checks user authorization before serving file
```

---

## 8. Integrating Into Routes

Example: Add Q-Filter to `/tools/run` endpoint

```python
# In service/routes/tools.py

@router.post("/projects/{project_id}/tools/{module_id}/run")
async def run_tool(
    project_id: str,
    module_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
    body: dict = Body(...),
):
    # Validate project access
    project = get_project_for_principal(project_id, principal)
    
    # NEW: Validate payload
    from q_ai_drug.service.tool_payloads import validate_payload
    try:
        payload = validate_payload(module_id, body.get("payload", {}))
    except ValueError as e:
        raise HTTPException(400, detail={"error": str(e), "type": "invalid_payload"})
    
    # Check tier access
    if not tier_allows(project.tier, module_id):
        raise HTTPException(403, detail="Tier does not support this module")
    
    # Estimate and reserve credits
    credits = estimate_credits(module_id, payload)
    try:
        consume_credits(project.id, credits)
    except QuotaError as e:
        raise HTTPException(402, detail=str(e))
    
    # Enqueue task (will call get_runner and execute)
    job = enqueue_module_task(
        module_id=module_id,
        project_id=project_id,
        payload=payload,
    )
    
    return {"job_id": job.id, "credits_reserved": credits}
```

---

## 9. Input Classification for Recommendations

After user uploads a file:

```python
from q_ai_drug.service.input_classifier import classify_upload, get_recommended_workflow

# Classify the upload
upload_info = classify_upload(Path("uploads/molecules.csv"))

# upload_info:
# UploadInfo(
#     file_name="molecules.csv",
#     classification="smiles_csv",
#     row_count=534,
#     sample_content="534 rows, columns: SMILES, name, ID, ...",
#     recommended_modules=["q_filter", "applicability_domain_guard", "activity_model_studio"],
#     error=None,
# )

# Get workflow
workflow = get_recommended_workflow(["smiles_csv"])
# [
#     {"step": 1, "module": "q_filter", "description": "Screen molecules..."},
#     {"step": 2, "module": "applicability_domain_guard", ...},
#     ...
# ]

# Return to frontend:
{
    "classification": upload_info.classification,
    "row_count": upload_info.row_count,
    "recommended_modules": upload_info.recommended_modules,
    "suggested_workflow": workflow,
}
```

---

## 10. Testing the Runners

```python
# tests/test_q_filter_standalone.py

from pathlib import Path
from q_ai_drug.product.module_runners.q_filter import QFilterRunner

def test_q_filter_with_molecules():
    project_dir = Path("test_data/project")
    run_id = "test_run_001"
    
    payload = {
        "candidate_upload_file": "test_molecules.csv",
        "filter_profile": "standard",
        "run_admet": True,
    }
    
    runner = QFilterRunner(project_dir, run_id, payload)
    result = runner.execute()
    
    # Assertions
    assert result["status"] == "succeeded"
    assert len(result["artifacts"]) >= 3
    assert result["usage"]["actual"]["molecule_count"] > 0
    assert any(a["name"] == "Filtered candidates" for a in result["artifacts"])
```

---

## 11. Common Patterns

### Pattern 1: Upload → Classify → Run

```python
# 1. Upload
file_path = save_upload("molecules.csv")

# 2. Classify
upload_info = classify_upload(file_path)
if upload_info.error:
    return {"error": upload_info.error}

# 3. Recommend
return {
    "file": upload_info.file_name,
    "classification": upload_info.classification,
    "recommended": upload_info.recommended_modules,
}

# 4. User selects "q_filter"
payload = {
    "candidate_upload_file": "molecules.csv",
    "filter_profile": "standard",
}

# 5. Validate & Run
result = run_q_filter(project_dir, run_id, payload)
```

### Pattern 2: Chaining Modules

```python
# Run Q-Filter
result1 = run_q_filter(project_dir, run_id_1, payload1)
filtered_artifact = result1["artifacts"][0]  # filtered_candidates.csv

# Use Q-Filter output as Q-Orbital input
payload2 = {
    "candidate_artifact_id": filtered_artifact["id"],  # Future: artifact ID
    "method": "auto",
}
result2 = run_q_orbital_analyzer(project_dir, run_id_2, payload2)
```

---

## Troubleshooting

### "No payload model registered for module"
Check that module_id is correct. Available modules:
- q_filter
- q_orbital_analyzer
- q_dock_studio
- activity_model_studio (not yet implemented)
- q_rank (not yet implemented)
- wet_lab_triage_board (not yet implemented)
- q_report (not yet implemented)

### "Upload file not found"
Ensure file was saved to project/uploads/ directory before running module.

### "Invalid SMILES"
Check that CSV has a SMILES column (case-insensitive). Supported column names:
- SMILES, smiles, smi, canonical_smiles

### "Docking failed"
Ensure receptor file is valid PDB/PDBQT/mmCIF with atoms. Check pocket box dimensions (must be positive and ≤ 100Å).

---

## Next Steps

1. ✅ Payloads implemented
2. ✅ Runners implemented
3. ⏳ Route integration (in progress)
4. ⏳ Forms in frontend
5. ⏳ Comprehensive tests

**See SPRINT_COMPLETION_REPORT.md for full details.**
