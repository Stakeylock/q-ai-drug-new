# LLM Scientific Hardening Playbook

This playbook is designed so a smaller coding LLM, including a Claude Haiku-class model, can safely implement the remaining hard scientific features without overclaiming results or destabilizing the repository.

The remaining scientific features are:

1. Real standalone GNINA execution path, or removal of GNINA from standalone Q-Dock engine choices.
2. Real redocking RMSD computation in standalone Q-Dock.
3. Real residue-level receptor-pose interaction fingerprint parsing.
4. Deeper Activity Model train mode using actual training-set artifacts.
5. Deeper Applicability Domain Guard using training-set nearest-neighbor fingerprints.

The guiding rule is:

```text
Never mark fallback, mock, missing, or failed evidence as real scientific evidence.
```

---

## 1. How To Use This Playbook With A Small LLM

Use one micro-task per prompt. Do not ask the model to rewrite multiple modules at once.

Recommended loop:

```text
1. Ask the LLM to inspect only the relevant files.
2. Ask for a patch plan.
3. Ask it to modify only one file or add one new helper file.
4. Ask it to add tests for that change.
5. Ask it to update README.md.
6. Run tests.
7. Only then continue to the next micro-task.
```

Do not ask:

```text
Implement all scientific hardening at once.
```

Ask instead:

```text
Implement GNINA availability detection and command construction only. Do not modify Q-Dock yet.
```

Each LLM-generated patch must satisfy:

```text
[ ] no therapeutic claims
[ ] no hidden mock/fallback evidence
[ ] explicit status column for every row
[ ] failure rows are preserved
[ ] tests cover the new contract
[ ] README updated
```

---

## 2. Current Scientific Runner Structure

Important files:

```text
src/q_ai_drug/product/module_runners/q_dock_studio.py
src/q_ai_drug/product/module_runners/q_orbital_analyzer.py
src/q_ai_drug/product/module_runners/q_rank_scientific.py
src/q_ai_drug/product/module_runners/q_report_scientific.py
src/q_ai_drug/product/module_runners/downstream.py
src/q_ai_drug/service/tool_payloads.py
src/q_ai_drug/product/module_runners/__init__.py
tests/test_scientific_runner_contracts.py
README.md
```

Current science-first status:

```text
Q-Orbital: explicit xTB/EHT/failure status exists.
Q-Dock: standalone runner avoids GNINA overclaiming and marks mock rows.
Q-Rank: evidence-aware runner exists and penalizes mock/fallback/missing evidence.
Q-Report: evidence-aware report runner exists and writes claim matrix.
Tests: lightweight contract tests exist.
```

Remaining hard work should extend this structure, not replace it.

---

# PART A — Real Standalone GNINA Execution

## A1. Scientific Goal

Standalone Q-Dock should only produce GNINA evidence if it actually runs the GNINA binary and parses GNINA output.

If GNINA is unavailable, one of two acceptable behaviors is allowed:

```text
Option 1: run Vina/Smina-compatible path and record gnina_executed=false.
Option 2: fail/skip GNINA rows with tool_unavailable.
```

Unacceptable behavior:

```text
requested_engine=gnina but output says real_docking_gnina without executing GNINA.
```

## A2. Files To Add Or Modify

Recommended new helper:

```text
src/q_ai_drug/docking/gnina_runner.py
```

Modify:

```text
src/q_ai_drug/product/module_runners/q_dock_studio.py
src/q_ai_drug/service/tool_payloads.py if engine choices change
tests/test_q_dock_gnina_contract.py
README.md
```

## A3. GNINA Helper API

Create:

```python
from pathlib import Path
from dataclasses import dataclass

@dataclass
class GninaResult:
    success: bool
    pose_file: Path | None
    log_file: Path
    cnn_score: float | None
    cnn_affinity: float | None
    vina_affinity: float | None
    raw_stdout: str
    raw_stderr: str
    failure_reason: str | None = None


def gnina_available() -> bool:
    ...


def run_gnina(
    receptor_pdbqt_or_pdb: Path,
    ligand_sdf_or_pdbqt: Path,
    output_sdf: Path,
    log_file: Path,
    center: tuple[float, float, float],
    size: tuple[float, float, float],
    exhaustiveness: int = 8,
    score_only: bool = False,
    timeout: int = 900,
) -> GninaResult:
    ...


def parse_gnina_output(stdout: str, stderr: str) -> dict:
    ...
```

## A4. Required GNINA Output Columns

`docking_results.csv` rows from GNINA must include:

```text
candidate_id
canonical_smiles
requested_engine
actual_engine_used = gnina
execution_mode = real_docking_gnina
vina_score
cnn_score
cnn_affinity
pose_sdf_path
log_path
docking_is_real = true
gnina_executed = true
failure_reason
```

If GNINA is missing:

```text
actual_engine_used = vina OR mock OR none
gnina_executed = false
execution_mode != real_docking_gnina
warning explains fallback/skip
```

## A5. GNINA Tests

Add tests that do not require GNINA installed:

```text
tests/test_q_dock_gnina_contract.py
```

Test cases:

```text
[ ] parse_gnina_output extracts cnn_score and cnn_affinity from sample text.
[ ] GNINA requested but unavailable never returns execution_mode=real_docking_gnina.
[ ] GNINA successful mocked subprocess returns gnina_executed=true.
[ ] GNINA failure writes docking_failure_table row.
```

## A6. Small LLM Prompt For GNINA Helper

Use this prompt:

```text
You are editing q-ai-drug-new. Implement only src/q_ai_drug/docking/gnina_runner.py.
Do not modify Q-Dock yet. Add gnina_available(), run_gnina(), parse_gnina_output(), and GninaResult.
Use subprocess.run with timeout. Always write stdout/stderr to log_file.
Parse CNNscore, CNNaffinity, and Vina affinity if present.
If parsing fails, return success=false with failure_reason.
Do not make therapeutic claims. Do not mark anything as real unless subprocess returncode is 0 and pose/log exist.
Also add tests/test_gnina_runner_parser.py using static sample GNINA log text only.
```

## A7. Small LLM Prompt For Q-Dock Integration

```text
Now integrate gnina_runner into src/q_ai_drug/product/module_runners/q_dock_studio.py only.
When engine contains gnina and gnina_available() is true, call run_gnina().
When GNINA succeeds, write execution_mode=real_docking_gnina and gnina_executed=true.
When GNINA is unavailable or fails, do not label GNINA as real. Fall back to Vina/Smina only if allowed by existing runner behavior and add warning.
Update q_dock_summary.json with gnina_available, gnina_executed_rows, gnina_failed_rows.
Add tests that mock gnina_available and run_gnina.
Update README.md Latest Science-First Runner Updates.
```

---

# PART B — Real Redocking RMSD Computation

## B1. Scientific Goal

Redocking validation should test whether the docking setup can recover a known/reference ligand pose. It should output RMSD and a pass/fail/incomplete status.

Pass rule:

```text
RMSD <= 2.0 Å → redocking_pass
RMSD > 2.0 Å → redocking_fail
No reference/docked pose → validation_not_run or validation_failed
```

## B2. Files To Modify

```text
src/q_ai_drug/product/module_runners/q_dock_studio.py
tests/test_q_dock_redocking_rmsd.py
README.md
```

Optional helper:

```text
src/q_ai_drug/docking/redocking.py
```

## B3. Helper API

```python
from pathlib import Path
from dataclasses import dataclass

@dataclass
class RedockingValidation:
    status: str
    rmsd_angstrom: float | None
    validation_pass: bool | None
    reason: str | None


def compute_pose_rmsd(reference_sdf: Path, docked_sdf: Path) -> RedockingValidation:
    ...
```

Preferred implementation:

```text
Use RDKit SDMolSupplier to load both molecules.
Remove hydrogens for RMSD unless hydrogens are needed.
Use rdMolAlign.GetBestRMS(reference, docked).
Catch atom-count and conformer errors.
Return status instead of raising when possible.
```

## B4. Required Output

`redocking_validation.csv`:

```text
reference_ligand_file
docked_pose_file
rmsd_angstrom
validation_status
validation_pass
reason
rmsd_threshold_angstrom
```

`q_dock_summary.json`:

```text
redocking_requested
redocking_status
redocking_rmsd_angstrom
redocking_validation_pass
```

## B5. Tests

```text
[ ] identical generated conformers produce RMSD near 0.
[ ] mismatched atom counts return validation_failed.
[ ] missing reference returns validation_not_run.
[ ] Q-Dock summary contains redocking status when requested.
```

## B6. Small LLM Prompt

```text
Implement src/q_ai_drug/docking/redocking.py with compute_pose_rmsd(reference_sdf, docked_sdf).
Use RDKit rdMolAlign.GetBestRMS. Return a dataclass result, do not throw on bad molecules.
Add unit tests using two tiny temporary SDF files made from ethanol with the same conformer.
Then wire q_dock_studio.py _write_redocking_validation_stub into real redocking when reference_ligand_file and at least one docked pose_sdf_path exist.
Update README.md.
```

---

# PART C — Residue-Level Interaction Fingerprints

## C1. Scientific Goal

Interaction fingerprints should identify receptor residues near the docked ligand and classify simple contact types. Until full PLIP/ProLIF-level analysis is integrated, implement a conservative geometric parser.

## C2. Files To Add Or Modify

```text
src/q_ai_drug/docking/interactions.py
src/q_ai_drug/product/module_runners/q_dock_studio.py
tests/test_interaction_fingerprints.py
README.md
```

## C3. Minimal Interaction API

```python
from pathlib import Path
from dataclasses import dataclass

@dataclass
class InteractionFingerprint:
    candidate_id: str
    pose_file: str
    contact_residues: str
    hbond_like_contacts: int
    hydrophobic_contacts: int
    salt_bridge_like_contacts: int
    interaction_quality: str
    failure_reason: str | None = None


def compute_interaction_fingerprint(
    receptor_pdb: Path,
    ligand_sdf: Path,
    candidate_id: str,
    distance_cutoff: float = 4.5,
) -> InteractionFingerprint:
    ...
```

## C4. Conservative Geometry Rules

Minimum rules:

```text
Any receptor heavy atom within 4.5 Å → contact residue.
N/O/S ligand atom near N/O/S receptor atom within 3.5 Å → hbond_like_contact.
C/S ligand atom near C/S receptor atom within 4.5 Å → hydrophobic_contact.
Oppositely charged atom heuristics within 4.0 Å → salt_bridge_like_contact.
```

Important: label as:

```text
interaction_quality = geometric_proxy
```

not full biochemical interaction proof.

## C5. Required Output Columns

```text
candidate_id
pose_file
contact_residues
contact_count
hbond_like_contacts
hydrophobic_contacts
salt_bridge_like_contacts
interaction_quality
failure_reason
claim_boundary
```

## C6. Tests

```text
[ ] simple toy receptor + ligand within cutoff reports contact residue.
[ ] far ligand reports no contacts.
[ ] missing pose returns failure_reason.
```

## C7. Small LLM Prompt

```text
Implement src/q_ai_drug/docking/interactions.py with a conservative geometry-based contact parser.
Do not add heavyweight dependencies unless already present. Prefer RDKit for ligand SDF and a simple PDB ATOM/HETATM parser for receptor atoms.
Classify contacts as geometric_proxy only.
Wire Q-Dock _add_interaction_fingerprint to call compute_interaction_fingerprint when docking_is_real and receptor_path plus pose_sdf exist.
Fallback to current placeholder if parsing fails.
Add tests with toy PDB/SDF files.
Update README.md.
```

---

# PART D — Deeper Activity Model Train Mode

## D1. Scientific Goal

Activity Model Studio train mode should train real target-specific activity models from curated assay artifacts and report scaffold-aware performance.

## D2. Files To Modify

```text
src/q_ai_drug/product/module_runners/downstream.py
src/q_ai_drug/service/tool_payloads.py
tests/test_activity_model_train_mode.py
README.md
```

Optional helper:

```text
src/q_ai_drug/models/activity_training.py
```

## D3. Required Inputs

Training artifact must contain:

```text
canonical_smiles or SMILES
target_id optional
p_activity
split optional
```

If `split` exists, use it. If missing, create scaffold split if RDKit is available. If RDKit is unavailable, random split is allowed only with warning.

## D4. Required Models

At minimum:

```text
ECFP RandomForestRegressor
ECFP ExtraTreesRegressor
ECFP HistGradientBoostingRegressor if available
Similarity-to-known-actives baseline when labels allow
```

## D5. Required Metrics

```text
train_size
valid_size
test_size
split_method
r2_test
rmse_test
mae_test
spearman_test optional
model_hash
fingerprint_spec
```

## D6. Required Outputs

```text
trained_model.joblib
model_metrics.json
model_comparison.csv
scaffold_split_metrics.json
activity_model_manifest.json
prediction_failures.csv
```

## D7. Tests

```text
[ ] train mode rejects missing p_activity.
[ ] train mode uses split column when present.
[ ] train mode writes model_comparison.csv and model_metrics.json.
[ ] too-small datasets produce warning, not fake performance.
```

## D8. Small LLM Prompt

```text
Improve ActivityModelStudioRunner train mode in downstream.py only.
Use RDKit Morgan fingerprints when available. Use split column if present; otherwise create scaffold split if possible; otherwise random split with warning.
Train RandomForestRegressor and ExtraTreesRegressor. Report R2, RMSE, MAE, train/test sizes, split_method, model_hash, and fingerprint spec.
Never report model as scientifically validated if dataset is too small. Write prediction_failures for invalid SMILES.
Add tests with a tiny synthetic assay CSV. Update README.md.
```

---

# PART E — Deeper Applicability Domain Guard

## E1. Scientific Goal

Applicability Domain Guard should use training-set nearest-neighbor fingerprints, not only QED/alert proxy scores.

## E2. Files To Modify

```text
src/q_ai_drug/product/module_runners/downstream.py
src/q_ai_drug/service/tool_payloads.py
tests/test_applicability_domain_guard.py
README.md
```

Optional helper:

```text
src/q_ai_drug/models/applicability_domain.py
```

## E3. Required Inputs

```text
candidate_artifact_id or candidate_upload_file
training_set_artifact_id or training_set_upload_file
reference_inhibitors_artifact_id optional
```

## E4. Required Computation

For each candidate:

```text
ECFP4/Morgan 2048-bit fingerprint
nearest_training_similarity
nearest_active_similarity if active labels exist
nearest_reference_inhibitor_similarity if reference set exists
Murcko scaffold
scaffold_seen_in_training
scaffold_novel
```

## E5. Suggested Domain Labels

```text
nearest_training_similarity >= 0.60 → high
0.40 to 0.60 → medium
0.20 to 0.40 → low
< 0.20 → out_of_domain
```

If thresholds are later calibrated from validation data, update them in config.

## E6. Required Outputs

```text
applicability_domain.csv
nearest_neighbors.csv
scaffold_novelty.csv
applicability_domain_summary.json
```

Columns:

```text
candidate_id
canonical_smiles
domain_score
domain_label
nearest_training_similarity
nearest_active_similarity
nearest_reference_inhibitor_similarity
murcko_scaffold
scaffold_seen_in_training
scaffold_novel
descriptor_method
claim_boundary
```

## E7. Tests

```text
[ ] identical candidate/training SMILES gets high domain.
[ ] unrelated candidate gets low/out_of_domain.
[ ] missing training set triggers proxy mode warning.
[ ] outputs nearest_neighbors.csv and scaffold_novelty.csv.
```

## E8. Small LLM Prompt

```text
Improve ApplicabilityDomainGuardRunner in downstream.py.
When training_set_artifact_id or training_set_upload_file is provided and RDKit is available, compute Morgan fingerprints and Tanimoto nearest-neighbor similarities.
Write applicability_domain.csv, nearest_neighbors.csv, scaffold_novelty.csv, and summary JSON.
Keep QED/alerts proxy only as fallback when no training set or no RDKit is available.
Add tests where candidate SMILES equals a training SMILES and must be high-domain.
Update README.md.
```

---

# PART F — Golden Scientific Chain Test

After A-E are implemented, add one end-to-end scientific contract test.

## F1. Test File

```text
tests/test_scientific_golden_chain.py
```

## F2. What It Should Test

Use tiny CSV fixtures and no heavy external binaries. Mock GNINA/Vina/xTB if necessary.

Chain:

```text
candidate CSV
→ Q-Filter or minimal candidate artifact
→ Activity Model prediction/train smoke
→ Applicability Domain Guard
→ Q-Dock mock/real-status smoke
→ Q-Orbital fallback-status smoke
→ Q-Rank evidence fusion
→ Q-Report claim matrix
```

Assertions:

```text
[ ] every module result has status.
[ ] Q-Rank writes evidence_status_report.csv.
[ ] Q-Report writes claim_matrix.csv.
[ ] mock/fallback/missing evidence appears in claim matrix.
[ ] no report contains wording like "validated drug" except in disallowed_claim.
```

## F3. Small LLM Prompt

```text
Add tests/test_scientific_golden_chain.py.
Use temporary project_dir and CSV uploads only.
Do not require Vina, GNINA, xTB, or OpenBabel.
Use existing runners with mock/fallback status where needed.
Assert Q-Rank and Q-Report preserve evidence status and claim boundaries.
Update README.md with the test name.
```

---

# PART G — Recommended Implementation Order

Execute in this order:

```text
1. Applicability Domain nearest-neighbor fingerprints.
2. Activity Model train mode metrics and scaffold split.
3. Redocking RMSD helper.
4. Residue-level geometric interaction fingerprints.
5. GNINA standalone runner.
6. Golden scientific chain test.
```

Why this order?

```text
Applicability Domain and Activity Model require only Python/RDKit/scikit-learn.
Redocking and interactions need docking artifacts but can be tested with small SDF/PDB fixtures.
GNINA requires external binary logic and is the most environment-sensitive.
The golden chain test should come after the pieces exist.
```

---

# PART H — Definition Of Done

This scientific hardening track is complete when:

```text
[ ] GNINA is either truly executed in standalone Q-Dock or removed from standalone engine choices.
[ ] Redocking validation computes RMSD and writes pass/fail/incomplete status.
[ ] Interaction fingerprints contain real receptor residue contacts or are explicitly marked as geometric_proxy/failure.
[ ] Activity Model train mode trains real models and reports scaffold-aware metrics.
[ ] Applicability Domain Guard uses training-set nearest-neighbor fingerprints.
[ ] Q-Rank uses domain/QM/docking evidence-status columns.
[ ] Q-Report produces claim_matrix.csv and evidence-aware report.
[ ] Golden scientific chain test passes without external binaries.
[ ] README documents the current scientific contract.
```

---

# PART I — Safety And Claim Language

Allowed claims:

```text
computational hypothesis
in-silico prioritization
candidate shortlist
wet-lab triage recommendation
model-predicted activity
real docking run
xTB-derived descriptor
geometric interaction proxy
```

Disallowed claims:

```text
validated drug
cancer treatment
clinically effective
experimentally active
safe compound
wet-lab proven
quantum advantage proven
```

Every report should include:

```text
These outputs are computational hypotheses only. Wet-lab validation is required before any biological activity, safety, efficacy, or therapeutic claim.
```
