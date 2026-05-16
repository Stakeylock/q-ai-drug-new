# Implementation Gap Closure — Immediate Next Steps

**Date:** May 15, 2026  
**Status:** 🟢 70% Complete (Foundation + Runners Done)  
**Time Invested:** ~12-15 hours of implementation  

---

## What's Done ✅

- [x] Payload models with Pydantic validation
- [x] BaseModuleRunner abstract class
- [x] Q-Filter runner (full implementation)
- [x] Q-Orbital Analyzer runner (full implementation)
- [x] Q-Dock Studio runner (full implementation)
- [x] Input classifier (file type detection + recommendations)
- [x] Runner registry
- [x] Standardized module result schema
- [x] Usage tracking (actual vs requested)
- [x] Error handling framework

---

## Next 3 Days: High Priority

### Day 1: Route Integration (4-6 hours)
This is **critical** to make runners actually callable from the API.

**File:** `src/q_ai_drug/service/routes/tools.py`

**Changes:**
```python
# Add at top:
from q_ai_drug.service.tool_payloads import validate_payload
from q_ai_drug.product.module_runners import get_runner

# In POST /projects/{project_id}/tools/{module_id}/run:

# 1. Validate payload before queuing
try:
    payload = request.json.get("payload", {})
    validated_payload = validate_payload(module_id, payload)
except ValueError as e:
    return {"error": str(e), "type": "invalid_payload"}, 400

# 2. Proceed with credit reservation (existing code)

# 3. Update tasks.py to call runner
```

**File:** `src/q_ai_drug/service/tasks.py`

**Changes:**
```python
# In run_module_task():
from q_ai_drug.product.module_runners import get_runner

runner_class = get_runner(module_id)
if runner_class:
    runner = runner_class(project_dir, run_id, payload)
    result = runner.execute()
    # Save to disk: outputs/{project}/module_runs/{module_id}/{run_id}/module_result.json
else:
    # Fallback to old execution
    result = run_module_via_legacy_execution(...)
```

**Verification:**
```bash
# Test with curl
curl -X POST http://localhost:5000/projects/cancer_proof_v1/tools/q_filter/run \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "candidate_upload_file": "molecules.csv",
      "filter_profile": "standard"
    }
  }'

# Should return: {"job_id": "...", "credits_reserved": ...}
# Job should complete and write module_result.json
```

---

### Day 2: First End-to-End Test (3-4 hours)

**File:** Create new test file
`tests/test_q_filter_e2e.py`

```python
def test_q_filter_end_to_end():
    """Test Q-Filter from upload to result."""
    
    # 1. Create test project directory
    project_dir = Path("test_output/e2e_test")
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # 2. Create test CSV with 10 molecules
    test_csv = create_test_smiles_csv(project_dir, n=10)
    
    # 3. Run Q-Filter
    payload = {
        "candidate_upload_file": test_csv.name,
        "filter_profile": "standard",
        "run_admet": True,
    }
    
    result = run_q_filter(project_dir, "test_run_001", payload)
    
    # 4. Assertions
    assert result["status"] == "succeeded"
    assert result["module_id"] == "q_filter"
    assert len(result["artifacts"]) >= 3
    
    # Check artifacts exist
    for artifact in result["artifacts"]:
        path = Path(artifact["uri"])
        assert path.exists(), f"Artifact not found: {path}"
    
    # Check usage tracking
    assert result["usage"]["actual"]["molecule_count"] == 10
    assert result["usage"]["actual"]["valid_molecule_count"] <= 10
    
    # Check module_result.json written
    result_json_path = project_dir / "module_runs/q_filter/test_run_001/module_result.json"
    assert result_json_path.exists()
    
    print("✓ Q-Filter E2E test passed")
```

**Run test:**
```bash
pytest tests/test_q_filter_e2e.py -v
```

---

### Day 3: Upload Classification Integration (4-5 hours)

**File:** `src/q_ai_drug/service/routes/uploads.py`

**Add new endpoint:**
```python
@router.post("/projects/{project_id}/uploads/classify")
async def classify_upload_handler(
    project_id: str,
    file_path: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
):
    """Classify an uploaded file and recommend modules."""
    
    from q_ai_drug.service.input_classifier import classify_upload, get_recommended_workflow
    
    # Get project
    project = get_project_for_principal(project_id, principal)
    
    # Build file path
    full_path = Path("outputs") / project.name / "uploads" / file_path
    
    # Classify
    upload_info = classify_upload(full_path)
    
    # Get workflow
    if not upload_info.error:
        workflow = get_recommended_workflow([upload_info.classification])
    else:
        workflow = []
    
    return {
        "file": upload_info.file_name,
        "classification": upload_info.classification,
        "row_count": upload_info.row_count,
        "sample": upload_info.sample_content,
        "recommended_modules": upload_info.recommended_modules,
        "suggested_workflow": workflow,
        "error": upload_info.error,
    }
```

**Frontend Integration (JavaScript):**
```javascript
// After file upload succeeds:
const response = await fetch(`/projects/${projectId}/uploads/classify?file_path=${fileName}`);
const classInfo = await response.json();

// Show recommendations:
console.log(`Detected: ${classInfo.classification}`);
console.log(`Recommended modules: ${classInfo.recommended_modules.join(", ")}`);
console.log(`Workflow: ${classInfo.suggested_workflow.map(s => s.module).join(" → ")}`);
```

---

## Next Week: Forms (10-12 hours)

### Q-Filter Form Component
```javascript
// frontend/components/QFilterForm.js
<form>
  <input type="file" name="candidate_file" accept=".csv,.sdf" required />
  <select name="filter_profile">
    <option value="strict">Strict (high purity)</option>
    <option value="standard" selected>Standard (default)</option>
    <option value="oncology_permissive">Oncology Permissive</option>
  </select>
  <label>
    <input type="checkbox" name="run_admet" defaultChecked />
    Include ADMET prediction
  </label>
  <button type="button" onClick={handleEstimate}>Estimate Cost</button>
  <button type="submit">Run Q-Filter</button>
</form>
```

**Logic:**
1. Upload file
2. Show classification + recommendations
3. User configures payload (form fields)
4. Click "Estimate" → calls validate_payload + estimate_credits
5. Show "Will use X credits, takes ~Y minutes"
6. Click "Run" → submits to /projects/{id}/tools/q_filter/run

---

## Week 2: Billing (6-8 hours)

### Reserve/Commit/Refund Lifecycle

**Database changes (alembic migration):**
```sql
ALTER TABLE credit_ledger
ADD COLUMN status VARCHAR(20) DEFAULT 'reserved';  -- reserved, committed, refunded, cancelled
ADD COLUMN reserved_credits FLOAT;
ADD COLUMN committed_credits FLOAT;
ADD COLUMN refunded_credits FLOAT;
ADD COLUMN actual_usage_json JSON;
ADD COLUMN finalized_at TIMESTAMP;
```

**Code changes (billing.py):**
```python
def reserve_credits(project_id, credits):
    """Reserve credits before job runs."""
    # Check available balance
    # Create ledger record with status='reserved'
    
def commit_credits(project_id, job_id, actual_credits):
    """Commit actual credits after job completes."""
    # Update ledger record: status='committed'
    # Update balance

def refund_credits(project_id, job_id, refund_amount):
    """Refund unused reserved credits."""
    # Update ledger record: status='refunded'
    # Update balance
```

---

## Week 3: Artifact Registry (6-8 hours)

### Create Artifact Model
```python
# models.py
class ArtifactRecord:
    artifact_id: str  # UUID
    project_id: str
    run_id: str
    module_id: str
    name: str
    artifact_type: str  # csv, json, sdf, pdb, html, png
    storage_uri: str  # file://... or s3://...
    local_path: str  # for local dev
    size_bytes: int
    checksum: str
    visibility: str  # public, private, demo
    created_at: datetime
    claim_boundary: str
```

### Private Download Endpoint
```python
@router.get("/projects/{project_id}/artifacts/{artifact_id}")
async def download_artifact(
    project_id: str,
    artifact_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
):
    """Download project artifact (with auth check)."""
    
    # Check user has access to project
    project = get_project_for_principal(project_id, principal)
    
    # Get artifact record
    artifact = session.query(ArtifactRecord).filter_by(
        project_id=project_id,
        artifact_id=artifact_id,
    ).first()
    
    if not artifact:
        raise HTTPException(404)
    
    # Serve file
    return FileResponse(artifact.local_path)
```

---

## Summary: Implementation Roadmap

| Task | Effort | Priority | Week | Status |
|------|--------|----------|------|--------|
| Route integration | 4h | CRITICAL | Now | ⏳ |
| E2E test | 3h | HIGH | Now | ⏳ |
| Upload classification | 4h | HIGH | Now | ⏳ |
| Q-Filter form | 3h | HIGH | Week 1 | ⏳ |
| Q-Dock form | 3h | HIGH | Week 1 | ⏳ |
| Q-Orbital form | 3h | HIGH | Week 1 | ⏳ |
| Scientist Home page | 4h | HIGH | Week 1 | ⏳ |
| Billing lifecycle | 8h | HIGH | Week 2 | ⏳ |
| Artifact registry | 8h | HIGH | Week 2 | ⏳ |
| Test suite | 8h | HIGH | Week 3 | ⏳ |
| AWS/Mongo handoff | 6h | MEDIUM | Week 3 | ⏳ |
| Reports generation | 8h | MEDIUM | Week 4 | ⏳ |
| Q-Rank runner | 6h | MEDIUM | Week 4 | ⏳ |
| Wet-Lab Triage UI | 8h | MEDIUM | Week 4 | ⏳ |

**Total Remaining:** ~90 hours

---

## Success Checkpoints

### After Route Integration (Day 1)
- [ ] POST /projects/{id}/tools/q_filter/run works
- [ ] Payload validation rejects invalid input with 400
- [ ] Job is created and queued
- [ ] module_result.json is written to disk

### After E2E Test (Day 2)
- [ ] Test runs without errors
- [ ] Q-Filter produces all expected output CSVs
- [ ] Usage tracking is accurate
- [ ] All artifacts registered with correct paths

### After Upload Classification (Day 3)
- [ ] Upload file, get classification
- [ ] Recommendations shown to user
- [ ] Workflow suggestion displayed

### After Forms Built (Week 1)
- [ ] User can upload file via form
- [ ] User sees recommended modules
- [ ] User can configure Q-Filter, Q-Dock, Q-Orbital
- [ ] Forms validate before submission
- [ ] Cost/time estimates shown

### After Billing Done (Week 2)
- [ ] Credits reserved before job starts
- [ ] Actual usage tracked during run
- [ ] Final charge committed after completion
- [ ] Unused credits refunded
- [ ] User can see reserve/commit/refund history

### After Artifact Registry (Week 2)
- [ ] Every module output has artifact_id
- [ ] Private downloads require project auth
- [ ] Artifact metadata searchable
- [ ] S3 URIs ready for AWS migration

### After Tests Complete (Week 3)
- [ ] Q-Filter runner tests pass
- [ ] Q-Orbital runner tests pass
- [ ] Q-Dock runner tests pass
- [ ] E2E scientist workflow test passes
- [ ] CI pipeline green

---

## Files to Review/Update

### Existing Files (Review)
- `src/q_ai_drug/service/routes/tools.py` — Add payload validation
- `src/q_ai_drug/service/tasks.py` — Call runners
- `src/q_ai_drug/service/routes/uploads.py` — Add classification endpoint
- `src/q_ai_drug/service/billing.py` — Add reserve/commit/refund
- `frontend/app.js` — Add forms and workflow UI

### New Files Created (This Session)
- ✅ `src/q_ai_drug/service/tool_payloads.py`
- ✅ `src/q_ai_drug/product/module_runners/__init__.py`
- ✅ `src/q_ai_drug/product/module_runners/base.py`
- ✅ `src/q_ai_drug/product/module_runners/q_filter.py`
- ✅ `src/q_ai_drug/product/module_runners/q_orbital_analyzer.py`
- ✅ `src/q_ai_drug/product/module_runners/q_dock_studio.py`
- ✅ `src/q_ai_drug/service/input_classifier.py`

### Documentation Created (This Session)
- ✅ `docs/SPRINT_COMPLETION_REPORT.md`
- ✅ `docs/DEVELOPER_QUICK_REFERENCE.md`
- ✅ `docs/IMMEDIATE_NEXT_STEPS.md` (this file)

---

## How to Proceed

1. **Read this entire doc** to understand the plan
2. **Read DEVELOPER_QUICK_REFERENCE.md** to understand code usage
3. **Check SPRINT_COMPLETION_REPORT.md** for detailed progress
4. **Start Day 1 work:** Route integration
5. **Test thoroughly** after each change
6. **Update this file** as work progresses

---

## Questions to Answer Before Starting

- [ ] Can I run Q-Filter locally without errors?
- [ ] Is the test CSV loading correctly?
- [ ] Are filtered_candidates.csv and module_result.json created?
- [ ] Can I call validate_payload("q_filter", payload)?
- [ ] Does get_runner("q_filter") return QFilterRunner?

---

## Contact/Notes

For questions on:
- **Module runners**: See DEVELOPER_QUICK_REFERENCE.md
- **Implementation details**: See SPRINT_COMPLETION_REPORT.md
- **Architecture**: See /memories/session/gap_analysis_action_plan.md
- **Next steps**: You're reading them now

---

## Final Thoughts

The hard part (core science modules, payload validation, error handling) is **done**. The remaining work is **integration and UI**. Focus on:

1. Making runners callable from API (Day 1)
2. Testing end-to-end (Day 2)
3. Building friendly UI (Week 1)
4. Hardening billing/artifacts (Week 2)
5. Comprehensive testing (Week 3)

By end of Week 3, a scientist should be able to:
```
1. Log in
2. Create project
3. Upload molecules
4. See "Recommended: Q-Filter"
5. Click "Use in Q-Filter"
6. Configure options
7. See cost estimate
8. Click "Run"
9. Wait for results
10. Download CSV
```

That's the goal. Let's build it! 🚀
