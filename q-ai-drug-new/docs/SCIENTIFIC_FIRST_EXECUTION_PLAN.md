# Q-AI Drug — Scientific-First Execution Plan

**Purpose:** prioritize the scientific validity and usefulness of the drug-discovery workflow before production SaaS polish, frontend overhaul, enterprise security, or cloud-scale backend work.

This plan intentionally delays full production backend/frontend work and focuses on making the scientific modules credible, testable, and useful for cancer-focused in-silico candidate discovery.

---

## 1. Scientific-First Goal

The immediate goal is not to build a perfect SaaS. The immediate goal is:

```text
Show that the platform can take cancer-relevant targets and molecules,
curate credible datasets,
filter and score candidates,
produce real docking/QM/model evidence,
rank candidates transparently,
and generate a wet-lab triage list with reasons to test and reasons not to test.
```

The project should prove:

1. The data is curated correctly.
2. The molecular filters are chemically meaningful.
3. The activity/ADMET predictions are traceable and validated.
4. Docking is real when claimed.
5. Quantum/QM descriptors are real when claimed.
6. Ranking combines evidence transparently.
7. Wet-lab triage gives scientifically defensible next steps.

---

## 2. What We Will NOT Prioritize Right Now

Delay these until after the scientific core is credible:

```text
full frontend redesign
all guided forms
premium UI styling
enterprise artifact authorization
S3/Mongo production storage
full AWS deployment
advanced billing plans
subscription dashboards
large-scale org/team permissions
```

These are still important, but they do not prove scientific value.

---

## 3. Scientific Priority Order

### Priority 1 — OncoData Builder scientific quality

OncoData Builder must become a reliable dataset factory.

Required work:

- Normalize uploaded assay data robustly.
- Support ChEMBL/public data retrieval where available.
- Support benchmark fallback honestly.
- Standardize activity values to nM.
- Compute `p_activity` consistently.
- Track source, assay type, confidence, target, and curation flag.
- Detect duplicates and conflicting measurements.
- Generate target-level data coverage reports.
- Generate scaffold splits for model training.
- Generate rejected-row reports.
- Generate full provenance.

Required outputs:

```text
curated_activity.csv
uploaded_assay_normalized.csv
uploaded_assay_rejected_rows.csv
duplicate_resolution.csv
conflicting_measurements.csv
target_coverage_summary.csv
curated_activity_with_split.csv
train.csv
valid.csv
test.csv
scaffold_split_summary.csv
dataset_manifest.json
dataset_provenance.json
```

Scientific acceptance criteria:

```text
[ ] every retained row has target_id, canonical_smiles, standard_type, standardized_activity_nM, p_activity, source.
[ ] every rejected uploaded row has a reason.
[ ] duplicates are not silently collapsed without a report.
[ ] train/test split is scaffold-aware when RDKit is available.
[ ] dataset provenance says whether data came from ChEMBL, benchmark fallback, uploaded assays, or mixed sources.
```

---

### Priority 2 — Q-Filter chemical validity

Q-Filter should become a serious first-pass medchem/ADMET filtering module.

Required work:

- Use RDKit FilterCatalog for PAINS/Brenk/NIH/ZINC alerts when available.
- Keep fallback SMARTS only as fallback.
- Add SDF export of passed molecules.
- Add invalid molecule report.
- Add duplicate report.
- Add endpoint-specific ADMET scoring when model metadata exists.
- Write ADMET model manifest with model hash and endpoint mapping.
- Avoid vague ADMET outputs if endpoint mapping is unknown.

Required outputs:

```text
filtered_candidates.csv
filtered_candidates.sdf
rejected_candidates.csv
reject_reasons.csv
invalid_molecules.csv
duplicate_molecules.csv
medchem_risk_table.csv
admet_risk_table.csv
admet_model_manifest.json
q_filter_summary.json
```

Scientific acceptance criteria:

```text
[ ] every rejection has a reason.
[ ] every alert has a named alert source.
[ ] ADMET predictions include model version/hash or are clearly marked unavailable.
[ ] output SDF can feed Q-Dock/Q-Orbital.
```

---

### Priority 3 — Activity Model Studio scientific validity

Activity models should not be treated as magic scores.

Required work:

- Add real train mode from OncoData output.
- Use scaffold splits, not only random splits.
- Report baseline models.
- Report cross-validation or held-out test metrics.
- Save model artifact with version/hash.
- Add calibration/uncertainty where possible.
- Add batch prediction mode from Q-Filter output.
- Mark heuristic fallback predictions clearly when no trained model exists.

Required outputs:

```text
trained_model.joblib
model_metrics.json
model_comparison.csv
scaffold_split_metrics.json
calibration_curve.png
activity_predictions.csv
prediction_failures.csv
activity_model_manifest.json
```

Scientific acceptance criteria:

```text
[ ] training uses scaffold-aware split.
[ ] model metrics are reported per target.
[ ] prediction output includes model_id, model_hash, confidence/uncertainty, and applicability-domain warning if available.
[ ] fallback heuristic mode is clearly labelled and not confused with trained prediction.
```

---

### Priority 4 — Applicability Domain Guard

Predictions must say whether the candidate is inside or outside the training domain.

Required work:

- Use ECFP/Morgan fingerprints.
- Compare candidate fingerprints to training/reference molecules.
- Compute nearest training similarity.
- Compute nearest active similarity where labels exist.
- Compute scaffold novelty.
- Label domain class.
- Downgrade confidence for out-of-domain candidates.

Required outputs:

```text
applicability_domain.csv
scaffold_novelty.csv
nearest_neighbors.csv
applicability_domain_summary.json
```

Scientific acceptance criteria:

```text
[ ] every candidate has high/medium/low/out-of-domain label.
[ ] nearest-neighbor evidence is traceable.
[ ] Q-Rank can use domain labels to penalize unsupported predictions.
```

---

### Priority 5 — Q-Dock scientific credibility

Docking must be real whenever the output is used as evidence.

Required work:

- Verify Vina execution path with fixture tests.
- Verify receptor preparation.
- Verify ligand preparation.
- Save docking logs.
- Save pose files.
- Parse real docking scores.
- Mark mock mode clearly when Vina/OpenBabel is unavailable.
- Add redocking validation when reference ligand is supplied.
- Add interaction fingerprints or contact summaries.
- Do not claim GNINA/Smina unless actually called.

Required outputs:

```text
docking_results.csv
docking_failure_table.csv
poses/*.sdf
logs/*.log
redocking_validation.csv
interaction_fingerprints.csv
q_dock_summary.json
```

Scientific acceptance criteria:

```text
[ ] real docking rows have docking_is_real=true.
[ ] mock rows have docking_is_real=false and are excluded/downgraded in final scientific ranking.
[ ] every failed ligand has a failure reason.
[ ] redocking validation status is visible when reference ligand exists.
[ ] pose files can be inspected visually.
```

---

### Priority 6 — Q-Orbital/QM credibility

Quantum/QM outputs must distinguish real xTB, EHT fallback, and failures.

Required work:

- Enforce method-specific behavior.
- Add per-molecule xTB stdout/stderr logs.
- Save conformer generation failure reasons.
- Standardize output columns.
- Mark QM mode per molecule.
- Ensure xTB output parsing is tested.
- Ensure EHT fallback is tested.

Required outputs:

```text
qm_descriptors.csv
qm_failure_report.csv
qm/logs/*.stdout.txt
qm/logs/*.stderr.txt
q_orbital_summary.json
```

Scientific acceptance criteria:

```text
[ ] every molecule has qm_status.
[ ] xTB success, EHT fallback, and failure states are distinct.
[ ] HOMO/LUMO/gap fields are only trusted when method supports them.
[ ] Q-Rank knows whether QM evidence is real, fallback, or missing.
```

---

### Priority 7 — Q-Rank evidence fusion

Ranking should be explainable, not just a single final score.

Required work:

- Combine activity, ADMET, medchem, domain, docking, interaction, and QM evidence.
- Penalize missing evidence explicitly.
- Penalize mock docking or fallback-only evidence.
- Penalize out-of-domain predictions.
- Support weight configuration.
- Add per-candidate explanations.
- Add ablation report showing score contribution.

Required outputs:

```text
ranked_candidates.csv
rank_explanations.csv
weight_config_used.json
missing_evidence_report.csv
rank_ablation.csv
```

Scientific acceptance criteria:

```text
[ ] every candidate has why_high and why_low.
[ ] missing evidence is explicit.
[ ] mock/fallback evidence is not treated as equal to real evidence.
[ ] ranking is reproducible from weight_config_used.json.
```

---

### Priority 8 — Wet-Lab Triage scientific usefulness

Triage should help decide what to test, not just show top-N candidates.

Required work:

- Classify into test_now/test_after_review/watchlist/reject_hold.
- Add reasons to test.
- Add reasons not to test.
- Add first recommended assay.
- Add minimum next validation.
- Add procurement/synthesis note where possible.
- Avoid hard top-N cutoff.

Required outputs:

```text
wet_lab_triage_board.csv
test_now.csv
test_after_review.csv
watchlist.csv
reject_hold.csv
assay_pack.md
wet_lab_triage_summary.json
```

Scientific acceptance criteria:

```text
[ ] each candidate has reasons_to_test and reasons_not_to_test.
[ ] candidates can be rejected/held for explicit scientific reasons.
[ ] assay_pack.md is usable as a wet-lab planning artifact.
```

---

### Priority 9 — Q-Report scientific report quality

Reports should communicate evidence, limitations, and next steps.

Required work:

- Generate candidate dossiers.
- Include evidence tables.
- Include limitations automatically.
- Include claim boundaries automatically.
- Include wet-lab triage board.
- Include selected candidates CSV/SDF.

Required outputs:

```text
report.html
report.md
selected_candidates.csv
selected_candidates.sdf
candidate_dossiers/*.md
assay_pack.md
limitations.md
claim_matrix.csv
```

Scientific acceptance criteria:

```text
[ ] report never claims therapeutic validation.
[ ] report distinguishes real, fallback, missing, and mock evidence.
[ ] report includes reasons to test and reasons not to test.
```

---

## 4. Scientific Validation Tests

Before SaaS polish, add these scientific tests:

```text
tests/test_scientific_oncodata_schema.py
tests/test_q_filter_scientific_outputs.py
tests/test_activity_model_scaffold_split.py
tests/test_applicability_domain_guard.py
tests/test_q_dock_real_or_mock_evidence.py
tests/test_q_orbital_qm_status.py
tests/test_q_rank_evidence_fusion.py
tests/test_wet_lab_triage_reasons.py
tests/test_q_report_claim_boundaries.py
```

Most important golden test:

```text
Upload tiny cancer-focused molecule CSV
→ Q-Filter
→ Activity Model Studio
→ Applicability Domain Guard
→ Q-Dock or mock-dock with downgrade
→ Q-Orbital or fallback-QM with downgrade
→ Q-Rank
→ Wet-Lab Triage
→ Q-Report
```

Acceptance criteria:

```text
[ ] chain completes.
[ ] all modules produce artifacts.
[ ] all candidates carry evidence-status fields.
[ ] final report includes limitations.
```

---

## 5. Scientific Demo Definition

A scientific demo is ready when it can show:

```text
1. Dataset curation for cancer target.
2. Candidate library filtering.
3. Activity/ADMET/domain predictions with caveats.
4. Docking evidence with real/mock status.
5. QM evidence with xTB/EHT/failure status.
6. Explainable ranking.
7. Wet-lab triage board.
8. Evidence report.
```

Do not require:

```text
perfect frontend
cloud deployment
enterprise auth
billing UI
S3/Mongo integration
```

---

## 6. Immediate Sprint: Scientific Core Only

Sprint objective: make scientific outputs trustworthy enough for a professor/investor/research reviewer to inspect.

Tasks in order:

```text
1. OncoData duplicate/conflict reports.
2. OncoData scaffold split.
3. Q-Filter SDF export and ADMET manifest.
4. Activity Model Studio train mode with scaffold split.
5. Applicability Domain true ECFP nearest-neighbor guard.
6. Q-Orbital status/log hardening.
7. Q-Dock real/mock evidence hardening and redocking stub.
8. Q-Rank evidence-status-aware ranking.
9. Wet-Lab Triage reason quality.
10. Q-Report claim-boundary quality.
11. Scientific golden-path test.
```

---

## 7. Definition of Scientific Readiness

The scientific core is ready when:

```text
[ ] data provenance is clear.
[ ] model training/evaluation is scaffold-aware.
[ ] every prediction has domain/confidence context.
[ ] every docking score says whether it is real or mock.
[ ] every QM descriptor says whether it is xTB/EHT/failure.
[ ] ranking explains evidence and missing evidence.
[ ] wet-lab triage gives reasons to test/not test.
[ ] reports include limitations and claim boundaries.
[ ] full scientific workflow passes a golden-path test.
```

Only after this should production frontend/backend polish become the main priority.
