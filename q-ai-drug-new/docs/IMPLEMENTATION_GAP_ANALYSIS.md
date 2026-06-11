# Q-AI Drug — Updated Implementation Gap Analysis

**Repository:** `Stakeylock/q-ai-drug`  
**Focus:** what is still missing after the standalone runner sprint, especially for turning the platform into a scientist-usable, input-driven computational drug-discovery product.

---

## 1. Current Status After Latest Repo Check

The repository has now moved beyond a pure artifact-wrapper architecture. The latest code introduces a real standalone module-runner layer.

### Newly present and important

- `src/q_ai_drug/product/module_runners/`
- `src/q_ai_drug/product/module_runners/base.py`
- `src/q_ai_drug/product/module_runners/onco_data_builder.py`
- `src/q_ai_drug/product/module_runners/q_filter.py`
- `src/q_ai_drug/product/module_runners/q_orbital_analyzer.py`
- `src/q_ai_drug/product/module_runners/q_dock_studio.py`
- `src/q_ai_drug/service/tool_payloads.py`
- Updated `module_execution.py` that attempts to dispatch to standalone runners before falling back to legacy artifact-first execution.

This is a major architectural improvement. The project is no longer only saying that modules should exist; it now has a runner lifecycle and the first real module implementations.

However, the implementation gap is not closed yet. The system has started becoming input-driven, but the first runner implementations are still partial, and a few critical correctness issues remain.

---

## 2. Updated Brutal Summary

Previous core gap:

> The modules were mostly wrappers around existing proof-run artifacts.

Current core gap:

> The module-runner architecture now exists, but the first runners are incomplete and uneven: Q-Filter is closest to real use, OncoData Builder still depends on an existing processed benchmark, Q-Orbital Analyzer is mostly RDKit fallback rather than real xTB/QM, and Q-Dock Studio currently produces mock docking results rather than actual Vina/Smina/GNINA docking.

The next stage is not more architecture. The next stage is **making the first four runners scientifically and operationally real**.

---

## 3. Current Module Readiness Score

| Module | Current State | Readiness |
|---|---|---:|
| OncoData Builder | Runner exists; validates targets; calls curation; still depends on existing `data/processed/oncology_benchmark.csv`; uploaded assay CSV not implemented | 5.5/10 |
| Q-Filter | Runner exists; loads CSV/SDF uploads; computes RDKit descriptors; filters molecules; writes filtered/rejected outputs | 7/10 |
| Q-Orbital Analyzer | Runner exists; loads molecules; generates conformers; writes descriptor/failure outputs; xTB not actually called; HOMO/LUMO/gap are `None` | 5/10 |
| Q-Dock Studio | Runner exists; accepts receptor/ligand/pocket; loads ligands; writes docking result table; actual docking is mocked | 4.5/10 |
| Activity Model Studio | Payload model exists; no standalone runner yet | 3/10 |
| Applicability Domain Guard | Payload model exists; no standalone runner yet | 3/10 |
| Q-Rank | Legacy path exists; no fully input-driven standalone runner yet | 5/10 |
| Wet-Lab Triage | Strong research function exists; runner not fully separated yet | 7/10 |
| Q-Report | Legacy path packages report/candidate evidence; needs user-selected candidate report support | 5.5/10 |

---

## 4. Critical Gap 1 — Runner Constructor Mismatch

### Problem

`module_execution.py` dispatches to standalone runners like this:

```python
runner = runner_class(module_id, project_dir, run_id, payload)
```

But not all runners use that constructor signature.

Observed patterns:

- `OncoDataBuilderRunner` accepts `(module_id, project_dir, run_id, payload)`.
- `QFilterRunner` accepts `(project_dir, run_id, payload)`.
- `QOrbitalAnalyzerRunner` accepts `(project_dir, run_id, payload)`.
- `QDockStudioRunner` accepts `(project_dir, run_id, payload)`.

This means Q-Filter, Q-Orbital Analyzer, and Q-Dock Studio may fail when invoked through the shared dispatcher.

### Required fix

Standardize all runner constructors.

Recommended standard:

```python
class SomeRunner(BaseModuleRunner):
    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id, project_dir, run_id, payload)
```

Then every registered runner works with the same dispatcher.

### Definition of done

- `execute_module()` can dispatch to all registered runners without `TypeError`.
- Unit test verifies every runner class can be instantiated through `get_runner(module_id)`.

Test to add:

```text
tests/test_module_runner_dispatch.py
```

---

## 5. Critical Gap 2 — Payload Validation Must Happen Before Credit Reservation

### Problem

Typed payload models now exist in `service/tool_payloads.py`, which is good. But payload validation must happen before:

1. quota check,
2. credit reservation,
3. job creation,
4. queue enqueue.

If validation happens only inside the worker/runner, a user may reserve credits for a payload that was invalid from the start.

### Required implementation

In the tool run route, before quota/credit reservation:

```python
from q_ai_drug.service.tool_payloads import validate_payload

validated_payload = validate_payload(module_id, request.payload)
```

Then use `validated_payload` for quota checks, credit estimates, and job payload.

### Definition of done

- Invalid payload returns HTTP 422 or clean validation error before billing.
- No credits are consumed/reserved for invalid payloads.
- Error message is user-readable.

Tests:

```text
tests/test_tool_payload_validation.py
tests/test_no_credit_reserved_for_invalid_payload.py
```

---

## 6. Critical Gap 3 — OncoData Builder Still Depends on Existing Processed Benchmark

### Current state

`OncoDataBuilderRunner` exists and calls `curate_activity_benchmark()`. This is good.

But it still requires:

```text
data/processed/oncology_benchmark.csv
```

This means it is not yet a true data builder from user input or public source configuration. It is mostly a curation runner over a prebuilt benchmark.

### Required behavior

OncoData Builder should support three modes:

```text
public_only
uploaded_only
public_plus_uploaded
```

### Required inputs

```text
target_ids
activity_types
max_records_per_target
curation_profile
data_sources
uploaded_assay_csv or assay_csv_artifact_id
known_inhibitors_csv or known_inhibitors_artifact_id
```

### Required execution

```text
Validate payload
→ Resolve targets
→ Retrieve public records if public source enabled
→ Load uploaded assay CSV if provided
→ Normalize uploaded assay columns
→ Merge public + uploaded records
→ Standardize units
→ Compute pActivity
→ Apply curation flags
→ Remove/flag duplicates and conflicts
→ Create scaffold splits
→ Write curated benchmark and excluded rows
→ Write manifest/provenance/hash
→ Register artifacts
```

### Immediate bugs to fix

#### Bug A — filtered dataframe not persisted

The runner sets `self.curated_activity = curated_df` before target/profile filtering. After filtering, `self.curated_activity` should be updated.

Fix:

```python
# after target/profile filtering
self.curated_activity = curated_df
```

#### Bug B — uploaded assay CSV payload unused

`uploaded_assay_csv` exists in the payload model but is not integrated into the curation flow.

#### Bug C — Pydantic errors are not cleanly caught

`validate_payload()` should catch general validation exceptions, not only `TypeError`.

### Required outputs

```text
curated_activity.csv
excluded_activity_rows.csv
duplicate_resolution.csv
dataset_curation_summary.csv
target_coverage_summary.csv
reference_inhibitors.csv
scaffold_split_summary.csv
dataset_manifest.json
dataset_provenance_card.json
activity_distribution_by_target.csv/html/png
```

### Definition of done

- User can run OncoData Builder with public data only.
- User can run OncoData Builder with uploaded assay CSV only.
- User can run public + uploaded merge.
- Target/profile filtering is reflected in final outputs.
- No dependency on a pre-existing benchmark unless `mode = existing_benchmark` is explicitly chosen.

---

## 7. Critical Gap 4 — Q-Filter Is Close, But Not Complete

### Current state

Q-Filter now:

- accepts CSV or SDF uploads from `project_dir/uploads`,
- detects SMILES column,
- parses molecules using RDKit,
- canonicalizes SMILES,
- calculates descriptors,
- applies strictness profiles,
- writes filtered and rejected outputs,
- writes reject reasons,
- writes medchem risk table,
- records actual usage.

This is the strongest standalone runner right now.

### Remaining gaps

#### Gap A — Artifact ID loading missing

If `candidate_library_artifact_id` is supplied, the runner raises:

```text
Artifact loading not yet implemented
```

Need artifact resolver:

```python
resolve_artifact_path(project_id, artifact_id)
```

#### Gap B — ADMET not actually run

Payload has `run_admet`, but the runner does not call ADMET models. It only writes medchem-style filtering.

Need:

```text
if run_admet:
    load ADMET model
    score molecules
    write admet_risk_table.csv
```

#### Gap C — duplicate removal missing

The docstring says duplicate detection, but actual canonical-SMILES deduplication is not implemented.

#### Gap D — PAINS/Brenk alerts are simplified

Current alert SMARTS are minimal/demo-like. Use RDKit `FilterCatalog` where possible.

### Required output schema

```text
filtered_candidates.csv
rejected_candidates.csv
reject_reasons.csv
medchem_risk_table.csv
admet_risk_table.csv
q_filter_summary.json
q_filter_report.html
```

### Definition of done

- Upload CSV/SDF works.
- Artifact ID input works.
- Duplicate molecules are handled.
- ADMET is executed if requested and models exist.
- Every rejected molecule has a reason.
- Summary includes requested vs actual molecule counts.

---

## 8. Critical Gap 5 — Q-Orbital Analyzer Is Not Real QM Yet

### Current state

Q-Orbital Analyzer now:

- accepts CSV/SDF upload,
- parses molecules,
- generates 3D conformers,
- computes RDKit descriptors,
- writes descriptor and failure outputs.

### Problem

The module does not actually call xTB yet. HOMO/LUMO/gap/dipole fields are currently `None`, and the method is effectively fallback descriptor mode.

### Required implementation

Add real xTB subprocess execution:

```text
SMILES/SDF
→ RDKit conformer
→ write XYZ/MOL/SDF temporary structure
→ run xtb
→ parse HOMO/LUMO/gap/energy/dipole
→ write qm_descriptors.csv
→ write qm_failure_report.csv
```

### Required fallback modes

```text
xtb_success
rdkit_fallback
failed
skipped_tier_limit
```

### Required scientific wording

Until xTB is wired:

```text
RDKit fallback descriptor mode only; not real orbital analysis.
```

After xTB is wired:

```text
xTB semiempirical quantum descriptor analysis; not binding validation.
```

### Definition of done

- xTB path works inside scientific worker container.
- Every molecule has status: `xtb_success`, `rdkit_fallback`, or `failed`.
- HOMO/LUMO/gap are populated when xTB succeeds.
- Failure table has clear reasons.
- No binding/therapeutic claim is made.

---

## 9. Critical Gap 6 — Q-Dock Studio Is Mocked

### Current state

Q-Dock Studio now:

- validates receptor upload,
- validates ligand upload,
- loads ligands from CSV/SDF,
- validates uploaded pocket box,
- writes docking results and summary.

### Problem

The docking score is mocked with a hash-based pseudo-score. No actual Vina/Smina/GNINA execution is happening.

### Required implementation

Replace mock scoring with real execution:

```text
receptor validation
→ receptor preparation
→ ligand preparation
→ Vina docking
→ optional Smina rescoring/minimization
→ optional GNINA scoring
→ pose writing
→ docking logs
→ failure table
```

### Required engines

Minimum MVP:

```text
Vina real execution
Smina optional if binary available
GNINA optional if binary/GPU available
```

### Required outputs

```text
docking_results.csv
docking_failure_table.csv
poses/*.sdf
logs/*.log
q_dock_summary.json
redocking_validation.csv if reference ligand provided
```

### Required claim boundary

Until real docking is implemented, the module must return:

```text
execution_mode: mock_docking
claim_boundary: Mock docking output for plumbing test only; not scientific docking evidence.
```

### Definition of done

- Real Vina binary is called.
- Scores come from docking engine output, not hash values.
- Pose files are generated and can open in Q-View 3D.
- Failed ligands are reported separately.
- Redocking validation can run when reference ligand is provided.

---

## 10. Critical Gap 7 — Artifact ID Loading Is Missing Across Runners

### Problem

The new runners mainly support upload filenames inside:

```text
project_dir/uploads/
```

But professional SaaS flow needs artifact IDs, not raw filenames.

### Required implementation

Create artifact resolver:

```text
src/q_ai_drug/service/artifact_resolver.py
```

Functions:

```python
resolve_artifact_path(project_id: str, artifact_id: str) -> Path
register_module_artifact(project_id, run_id, module_id, path, artifact_type, metadata) -> ArtifactRecord
```

### Definition of done

- `candidate_library_artifact_id` works in Q-Filter.
- `candidate_artifact_id` works in Q-Orbital Analyzer.
- `receptor_artifact_id` and `ligand_artifact_id` work in Q-Dock Studio.
- Runners do not require users to know filesystem names.

---

## 11. Critical Gap 8 — Actual Usage Metering Is Only Partially Implemented

### Current state

Base runner now supports:

```text
usage_requested
usage_actual
```

Q-Filter, Q-Orbital, and Q-Dock record some actual counts.

### Remaining gaps

Need standard usage schema across all modules:

```text
requested_molecule_count
actual_molecule_count
valid_molecule_count
failed_molecule_count
requested_docking_pairs
attempted_docking_pairs
completed_docking_pairs
failed_docking_pairs
requested_qm_rows
completed_qm_rows
failed_qm_rows
runtime_seconds
storage_bytes_written
```

### Billing integration gap

Runner actual usage is not yet clearly committed back into the credit ledger using reserve/commit/refund semantics.

### Definition of done

- Module result includes usage requested/actual.
- Billing ledger receives actual usage after job completion.
- Credits are committed/refunded based on actual execution policy.

---

## 12. Critical Gap 9 — Tests Are Still Missing

Search did not surface dedicated runner tests. Given the new runner layer, tests are now urgent.

### Required tests

```text
tests/test_module_runner_dispatch.py
tests/test_tool_payloads.py
tests/test_onco_data_builder_runner.py
tests/test_q_filter_runner.py
tests/test_q_orbital_runner.py
tests/test_q_dock_runner.py
tests/test_artifact_resolver.py
tests/test_tool_route_payload_validation.py
tests/test_billing_no_charge_invalid_payload.py
```

### Test cases

- Every registered runner instantiates through `execute_module()`.
- Bad payload fails before credit reservation.
- OncoData Builder writes filtered target-specific curated data.
- Q-Filter accepts tiny SMILES CSV and writes filtered/rejected outputs.
- Q-Orbital accepts tiny SMILES CSV and writes fallback descriptor output.
- Q-Dock rejects missing receptor.
- Q-Dock marks mock mode until real engine is wired.
- Module result contains claim boundary and usage data.

### Definition of done

- CI runs the above tests.
- The first four standalone runners have smoke tests.
- Any constructor mismatch is caught automatically.

---

## 13. Critical Gap 10 — UI Still Needs Guided Forms

### Current state

The Scientist Module Console exists, but users still interact heavily through JSON payloads.

### Required UI work

Create guided forms for:

```text
OncoData Builder
Q-Filter
Q-Orbital Analyzer
Q-Dock Studio
Q-Rank
Wet-Lab Triage
Q-Report
```

### Minimum form requirements

Each form should show:

```text
required inputs
upload/select artifact controls
parameter fields
dry-run button
estimate credits button
run button
tier requirement
expected outputs
claim boundary
```

### Definition of done

- A scientist can run Q-Filter without editing JSON.
- A scientist can run Q-Orbital without editing JSON.
- A scientist can run Q-Dock without editing JSON.
- Advanced JSON is hidden behind an advanced toggle.

---

## 14. Updated Priority Order

### Priority 0 — Fix dispatch bug

- Standardize runner constructors.
- Add dispatch smoke test.

### Priority 1 — Make OncoData Builder correct

- Fix filtered dataframe assignment.
- Implement uploaded assay CSV support.
- Add existing benchmark mode explicitly.
- Add manifest/provenance artifact registration.

### Priority 2 — Make Q-Filter production-useful

- Add artifact ID loading.
- Add duplicate removal.
- Add real ADMET scoring integration.
- Add stronger structural alert system.

### Priority 3 — Make Q-Orbital scientifically real

- Add xTB subprocess execution.
- Add status labels: `xtb_success`, `rdkit_fallback`, `failed`.
- Populate HOMO/LUMO/gap when possible.

### Priority 4 — Make Q-Dock scientifically real

- Replace mock hash scoring with real Vina execution.
- Add pose files.
- Add failure logs.
- Add optional Smina/GNINA integration.
- Add redocking validation.

### Priority 5 — Stabilize platform contracts

- Artifact resolver.
- Actual usage metering.
- Billing commit/refund.
- Tests.
- Guided forms.

---

## 15. Updated Final Acceptance Criteria

The implementation gap is closed for the first sprint when:

```text
[ ] execute_module("onco_data_builder") runs through standalone runner.
[ ] execute_module("q_filter") runs through standalone runner.
[ ] execute_module("q_orbital_analyzer") runs through standalone runner.
[ ] execute_module("q_dock_studio") runs through standalone runner.
[ ] No runner constructor mismatch exists.
[ ] Bad payloads fail before credit reservation.
[ ] Q-Filter can process uploaded CSV/SDF and produce filtered/rejected outputs.
[ ] Q-Orbital can process uploaded CSV/SDF and produce descriptor/failure outputs.
[ ] Q-Dock either runs real Vina or clearly marks mock mode.
[ ] OncoData Builder writes target-filtered curated outputs.
[ ] All outputs include claim boundaries.
[ ] Tests cover the first four runners.
```

The implementation gap is closed for real scientist usability when:

```text
[ ] Users can upload data and run modules from guided forms.
[ ] Users do not need filesystem paths or raw JSON for common workflows.
[ ] Artifact IDs work across modules.
[ ] Results are saved project-by-project.
[ ] Billing uses actual completed compute.
[ ] Q-Dock uses real docking engines.
[ ] Q-Orbital uses real xTB where available.
[ ] Q-Filter includes ADMET when requested.
[ ] Candidate evidence and wet-lab triage are generated from user data, not only proof-run data.
```

---

## 16. Final Short Critique

The repo has finally started closing the implementation gap in code. This is good.

But the current standalone runner layer is at the **first draft** stage:

- architecture is right,
- payload models are right,
- Q-Filter is promising,
- OncoData Builder is partially real,
- Q-Orbital is fallback-only,
- Q-Dock is mocked,
- tests are missing,
- artifact IDs are not wired,
- billing does not yet finalize actual usage.

The next commit should focus on correctness and scientific truthfulness:

1. fix dispatch,
2. fix OncoData Builder filtering,
3. mark Q-Dock mock mode or implement real Vina,
4. mark Q-Orbital fallback mode or implement xTB,
5. add tests.

Do that, and the platform moves from good architecture to trustworthy runnable science modules.
