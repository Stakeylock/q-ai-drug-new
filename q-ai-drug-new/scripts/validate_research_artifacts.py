from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd


REQUIRED_PROJECT_FILES = [
    "generated.csv",
    "generated_scored.csv",
    "filtered.csv",
    "filtered_quantum.csv",
    "filtered_all.csv",
    "docking/results.csv",
    "docking/top10.csv",
    "gnina/results.csv",
    "md/stability.csv",
    "md/rmsd_summary.csv",
    "curation/dataset_curation_summary.csv",
    "dataset_curation_report.html",
    "benchmarks/enrichment_summary.csv",
    "generation/generation_metrics.csv",
    "generation/scaffold_novelty.csv",
    "inhibitors/inhibitor_registry.csv",
    "inhibitors/candidate_inhibitor_proximity.csv",
    "inhibitors/inhibitor_comparison_dossier.md",
    "models/model_comparison.csv",
    "models/applicability_domain.csv",
    "medchem/medchem_risk_table.csv",
    "admet/admet_endpoint_metrics.csv",
    "admet/candidate_admet_risk_table.csv",
    "docking/interaction_fingerprints.csv",
    "docking/top_candidate_pose_notes.md",
    "qm/qm_descriptors.csv",
    "qm/qm_descriptor_summary.csv",
    "qm/qm_failure_report.csv",
    "qml/quantum_kernel_scores.csv",
    "qml/quantum_prefilter_scores.csv",
    "qml/quantum_ablation_benchmark.csv",
    "qml/rank_shift_analysis.csv",
    "ranking/weight_ablation.csv",
    "ranking/calibrated_weights.yaml",
    "triage/wet_lab_triage_board.csv",
    "triage/wet_lab_triage_summary.json",
    "triage/wet_lab_assay_pack.md",
    "triage/wet_lab_triage_board.html",
    "controls/negative_control_results.csv",
    "candidate_evidence/candidate_evidence.jsonl",
    "candidate_evidence/candidate_evidence_summary.csv",
    "candidate_evidence/candidate_evidence_schema.json",
    "candidate_evidence/mongodb_candidate_documents.json",
    "candidate_evidence/mongodb_indexes.json",
    "platform/module_registry.json",
    "platform/tier_quotas.json",
    "platform/compute_depth_presets.json",
    "platform/module_execution_matrix.csv",
    "platform/module_result_schema.json",
    "models/baseline_activity_metrics.csv",
    "models/admet_model_metrics.csv",
    "models/rediscovery_metrics.csv",
    "models/model_cards.csv",
    "models/model_cards.json",
    "final_ranked_candidates.csv",
    "top_candidates.csv",
    "run_manifest.json",
    "run_summary.json",
    "external_tools_manifest.json",
    "scientific_claim_matrix.csv",
    "scientific_hardening_summary.json",
    "strict_scientific_report.md",
    "strict_scientific_report.html",
    "report.html",
    "report.pdf",
    "assets/candidate_gallery.html",
    "assets/ligand_asset_manifest.csv",
]


CSV_SCHEMAS = {
    "final_ranked_candidates.csv": [
        "target_id",
        "candidate_id",
        "canonical_smiles",
        "activity_score",
        "admet_score",
        "admet_model_score",
        "tox21_toxicity_probability",
        "clintox_toxicity_probability",
        "affinity_kcal_mol",
        "homo_lumo_gap_ev",
        "qml_score",
        "quantum_prefilter_score",
        "early_quantum_component",
        "score_without_quantum",
        "final_score",
        "quantum_ablation_delta",
        "target_rank",
    ],
    "top_candidates.csv": ["target_id", "candidate_id", "canonical_smiles", "final_score", "target_rank"],
    "docking/results.csv": ["target_id", "candidate_id", "affinity_kcal_mol", "binding_class", "docking_mode", "docking_is_real"],
    "gnina/results.csv": [
        "target_id",
        "candidate_id",
        "gnina_status",
        "gnina_affinity_kcal_mol",
        "gnina_cnn_pose_score",
        "gnina_cnn_affinity",
        "gnina_pose_sdf_path",
        "gnina_mode",
        "gnina_is_real",
    ],
    "md/stability.csv": [
        "target_id",
        "candidate_id",
        "rmsd_checkpoint_early",
        "rmsd_checkpoint_mid",
        "rmsd_checkpoint_final",
        "stability_class",
        "md_mode",
        "md_is_real",
        "trajectory_ps",
    ],
    "md/rmsd_summary.csv": ["target_id", "candidate_id", "checkpoint_label", "trajectory_ps", "rmsd", "md_mode", "md_is_real"],
    "curation/dataset_curation_summary.csv": ["target_id", "raw_records", "kept_records", "unique_molecules", "active_records", "inactive_records"],
    "benchmarks/enrichment_summary.csv": [
        "target_id",
        "model_name",
        "roc_auc",
        "pr_auc",
        "ef_1pct",
        "ef_5pct",
        "ef_10pct",
        "top10_active_hits",
        "top30_active_hits",
        "reference_drug_rank_summary",
        "decoy_source",
    ],
    "generation/generation_metrics.csv": ["target_id", "valid_fraction", "unique_fraction", "internal_diversity"],
    "generation/scaffold_novelty.csv": ["target_id", "generation_method", "candidate_category"],
    "inhibitors/inhibitor_registry.csv": [
        "target_id",
        "target_family",
        "inhibitor_name",
        "canonical_smiles",
        "activity_type",
        "assay_source",
        "status",
        "co_crystal_pdb",
        "ip_warning",
    ],
    "inhibitors/candidate_inhibitor_proximity.csv": [
        "target_id",
        "candidate_id",
        "canonical_smiles",
        "nearest_inhibitor_name",
        "nearest_inhibitor_similarity",
        "novelty_label",
        "too_close_for_novelty_claim",
        "comparison_note",
    ],
    "models/model_comparison.csv": [
        "target_id",
        "model_name",
        "split_strategy",
        "records_train",
        "records_eval",
        "roc_auc",
        "pr_auc",
        "average_precision",
        "brier_score",
        "accuracy",
        "calibration_note",
    ],
    "models/applicability_domain.csv": [
        "target_id",
        "candidate_id",
        "nearest_training_similarity",
        "nearest_active_similarity",
        "scaffold_novelty",
        "applicability_domain",
        "prediction_confidence",
    ],
    "medchem/medchem_risk_table.csv": ["target_id", "candidate_id", "sa_score_proxy", "structural_alert_count", "medchem_risk_class", "medchem_risk_reasons"],
    "admet/admet_endpoint_metrics.csv": ["dataset", "endpoint", "records_train", "records_eval", "roc_auc", "average_precision"],
    "admet/candidate_admet_risk_table.csv": [
        "target_id",
        "candidate_id",
        "admet_score",
        "admet_model_score",
        "tox21_toxicity_probability",
        "clintox_toxicity_probability",
        "fda_approval_probability",
        "admet_risk_class",
    ],
    "docking/redocking_validation.csv": [
        "target_id",
        "pdb_id",
        "reference_ligand",
        "reference_ligand_code",
        "pocket_source",
        "pocket_method_tier",
        "center_x",
        "center_y",
        "center_z",
        "size_x",
        "size_y",
        "size_z",
        "redocking_status",
        "redocking_rmsd_angstrom",
        "redocking_best_engine",
        "vina_redocking_rmsd_angstrom",
        "gnina_redocking_rmsd_angstrom",
        "redocking_reference_sdf",
        "redocking_pose_sdf",
        "redocking_log",
        "provenance_note",
    ],
    "docking/interaction_fingerprints.csv": [
        "target_id",
        "candidate_id",
        "contact_residue_count",
        "hbond_like_contacts",
        "hydrophobic_contacts",
        "key_residue_contact_count",
        "interaction_quality",
    ],
    "qm/qm_descriptors.csv": [
        "target_id",
        "candidate_id",
        "homo_ev",
        "lumo_ev",
        "homo_lumo_gap_ev",
        "xtb_total_energy_eh",
        "quantum_score",
        "qm_mode",
        "qm_is_real",
    ],
    "qml/quantum_kernel_scores.csv": ["target_id", "candidate_id", "qml_score", "qml_mode", "qml_is_real"],
    "qml/quantum_prefilter_scores.csv": [
        "target_id",
        "candidate_id",
        "quantum_prefilter_score",
        "quantum_prefilter_mode",
        "quantum_prefilter_is_real",
    ],
    "qml/quantum_ablation_benchmark.csv": ["experiment", "known_active_proxy_top10", "known_active_proxy_top30", "quantum_weight", "claim"],
    "qml/rank_shift_analysis.csv": ["experiment", "rank", "target_id", "candidate_id", "score"],
    "ranking/weight_ablation.csv": ["experiment", "known_active_proxy_top10", "known_active_proxy_top30", "quantum_weight"],
    "triage/wet_lab_triage_board.csv": [
        "target_id",
        "candidate_id",
        "final_score",
        "triage_class",
        "triage_confidence",
        "evidence_completeness",
        "reasons_to_test",
        "reasons_not_to_test",
        "recommended_assay_plan",
        "claim_boundary",
    ],
    "controls/negative_control_results.csv": ["target_id", "control_type", "control_score_proxy", "expected_result", "observed_result", "pass_fail", "notes"],
    "candidate_evidence/candidate_evidence_summary.csv": [
        "target_id",
        "candidate_id",
        "triage_class",
        "activity_score",
        "admet_risk_class",
        "interaction_quality",
        "nearest_inhibitor_similarity",
        "artifact_count",
    ],
    "scientific_claim_matrix.csv": [
        "evidence_level",
        "name",
        "definition",
        "current_status",
        "allowed_claim",
        "forbidden_claim",
        "required_next_evidence",
    ],
    "models/baseline_activity_metrics.csv": ["target_id", "records_train", "records_eval", "roc_auc", "average_precision"],
    "models/admet_model_metrics.csv": [
        "dataset",
        "endpoint",
        "records_train",
        "records_eval",
        "roc_auc",
        "average_precision",
        "split_strategy",
        "model_path",
    ],
    "models/model_cards.csv": ["checkpoint_path", "module_name", "integration_status", "research_use"],
    "assets/ligand_asset_manifest.csv": ["candidate_id", "target_id", "smiles", "smi_path", "sdf_path", "png_path"],
    "platform/module_execution_matrix.csv": [
        "module_id",
        "queue",
        "tier_minimum",
        "dry_run_supported",
        "small_mode_supported",
        "production_mode_supported",
        "execution_backend",
        "dry_run_backend",
        "standard_result_artifact",
        "status_values",
        "artifact_policy",
        "placeholder_policy",
        "claim_boundary",
    ],
}


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _bool_series(series: pd.Series) -> pd.Series:
    if series.dtype == bool:
        return series
    return series.astype(str).str.lower().isin({"true", "1", "yes"})


def _has_value(value: object) -> bool:
    return value is not None and not pd.isna(value) and str(value).strip() != ""


def _fill_top_candidate_assets(top_df: pd.DataFrame, asset_df: pd.DataFrame | None) -> pd.DataFrame:
    if asset_df is None or asset_df.empty or "candidate_id" not in top_df.columns:
        return top_df
    keep = [column for column in ["candidate_id", "png_path", "sdf_path", "smi_path"] if column in asset_df.columns]
    if len(keep) <= 1:
        return top_df
    merged = top_df.merge(asset_df[keep], on="candidate_id", how="left", suffixes=("", "_asset"))
    for column in ["png_path", "sdf_path", "smi_path"]:
        asset_column = f"{column}_asset"
        if asset_column not in merged.columns:
            continue
        if column not in merged.columns:
            merged[column] = merged[asset_column]
        else:
            merged[column] = merged[column].where(merged[column].notna() & (merged[column].astype(str).str.len() > 0), merged[asset_column])
    return merged


def _existing_paths(series: pd.Series) -> pd.Series:
    return series.map(lambda value: _has_value(value) and Path(str(value)).exists() and Path(str(value)).stat().st_size > 0)


def _finite_numeric(series: pd.Series) -> bool:
    values = pd.to_numeric(series, errors="coerce")
    return values.notna().all() and values.map(lambda value: math.isfinite(float(value))).all()


def _png_ok(path: Path) -> bool:
    if path.stat().st_size < 1000:
        return False
    with path.open("rb") as handle:
        return handle.read(8) == b"\x89PNG\r\n\x1a\n"


def _local_report_links(project_dir: Path, html_path: Path) -> list[Path]:
    html = html_path.read_text(encoding="utf-8")
    refs = re.findall(r'<img\s+[^>]*src="([^"]+)"', html)
    local_refs = []
    for ref in refs:
        if re.match(r"^[a-z]+://", ref):
            continue
        local_refs.append((project_dir / ref).resolve())
    return local_refs


def validate(project_dir: Path, *, tier: str = "proof") -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    checks: dict[str, Any] = {}

    def require(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    def warn(condition: bool, message: str) -> None:
        if not condition:
            warnings.append(message)

    require(project_dir.exists(), f"Project directory does not exist: {project_dir}")
    if not project_dir.exists():
        return {"status": "fail", "errors": errors, "warnings": warnings, "checks": checks}

    for rel in REQUIRED_PROJECT_FILES:
        path = project_dir / rel
        require(path.exists(), f"Missing required artifact: {path}")
        if path.exists() and path.is_file():
            require(path.stat().st_size > 0, f"Empty required artifact: {path}")

    dataframes: dict[str, pd.DataFrame] = {}
    for rel, columns in CSV_SCHEMAS.items():
        path = project_dir / rel
        if not path.exists():
            continue
        try:
            df = pd.read_csv(path)
        except Exception as exc:
            errors.append(f"Could not read CSV {path}: {exc}")
            continue
        dataframes[rel] = df
        require(len(df) > 0, f"CSV has no rows: {path}")
        missing = [column for column in columns if column not in df.columns]
        require(not missing, f"CSV {path} missing columns: {missing}")

    summary_path = project_dir / "run_summary.json"
    if summary_path.exists():
        summary = _read_json(summary_path)
        checks["run_summary"] = summary
        for key in ["generated_candidates", "filtered_candidates", "docking_rows", "md_rows", "qm_rows", "qml_rows", "ranked_rows"]:
            require(int(summary.get(key, 0)) > 0, f"Run summary has non-positive {key}: {summary.get(key)}")

    external_manifest = project_dir / "external_tools_manifest.json"
    if external_manifest.exists():
        manifest = _read_json(external_manifest)
        missing_tools = [name for name in ["vina", "smina", "gnina", "obabel", "xtb"] if not manifest.get(name, {}).get("available")]
        require(not missing_tools, f"Required external tools unavailable in manifest: {missing_tools}")
        checks["external_tools"] = {name: manifest.get(name, {}).get("version") for name in ["vina", "smina", "gnina", "obabel", "xtb"]}

    smoke_manifest = Path("outputs") / "tool_smoke" / "external_tool_smoke.json"
    if smoke_manifest.exists():
        smoke = _read_json(smoke_manifest)
        failed_smoke = [name for name, payload in smoke.items() if not payload.get("ok")]
        require(not failed_smoke, f"External smoke checks failed: {failed_smoke}")
        checks["tool_smoke_checks"] = sorted(smoke)
    else:
        warnings.append(f"Tool smoke manifest not found: {smoke_manifest}")

    final_df = dataframes.get("final_ranked_candidates.csv")
    if final_df is not None:
        require(final_df["target_id"].nunique() >= 3, "Final ranking should cover at least three targets.")
        require(_finite_numeric(final_df["final_score"]), "Final scores contain missing or non-finite values.")
        require(final_df["final_score"].between(0, 1).all(), "Final scores should be normalized to [0, 1].")
        require(final_df.groupby("target_id")["target_rank"].min().eq(1).all(), "Each target should have a rank-1 candidate.")
        checks["top_final_score"] = float(pd.to_numeric(final_df["final_score"]).max())

    top_df = dataframes.get("top_candidates.csv")
    if top_df is not None:
        require(top_df["target_id"].nunique() >= 3, "Top candidates should cover at least three targets.")
        require(len(top_df) >= 30, "Expected at least 30 top candidate rows for the full proof run.")
        top30 = top_df.head(30).copy()
        top30 = _fill_top_candidate_assets(top30, dataframes.get("assets/ligand_asset_manifest.csv"))
        docking_for_merge = dataframes.get("docking/results.csv")
        if docking_for_merge is not None and "docked_sdf_path" in docking_for_merge.columns and "candidate_id" in top30.columns:
            top30 = top30.merge(
                docking_for_merge[["candidate_id", "docked_sdf_path"]].drop_duplicates("candidate_id"),
                on="candidate_id",
                how="left",
                suffixes=("", "_docking"),
            )
            if "docked_sdf_path_docking" in top30.columns:
                if "docked_sdf_path" not in top_df.columns:
                    top30["docked_sdf_path"] = top30["docked_sdf_path_docking"]
                else:
                    top30["docked_sdf_path"] = top30["docked_sdf_path"].where(
                        top30["docked_sdf_path"].notna() & (top30["docked_sdf_path"].astype(str).str.len() > 0),
                        top30["docked_sdf_path_docking"],
                    )
        missing_images = top30.loc[~_existing_paths(top30.get("png_path", pd.Series(index=top30.index, dtype=object))), "candidate_id"].astype(str).tolist()
        missing_conformers = top30.loc[~_existing_paths(top30.get("sdf_path", pd.Series(index=top30.index, dtype=object))), "candidate_id"].astype(str).tolist()
        missing_docked = top30.loc[~_existing_paths(top30.get("docked_sdf_path", pd.Series(index=top30.index, dtype=object))), "candidate_id"].astype(str).tolist()
        require(not missing_images, f"Top 30 candidates missing image artifacts after manifest fallback: {missing_images[:10]}")
        require(not missing_conformers, f"Top 30 candidates missing conformer SDF artifacts after manifest fallback: {missing_conformers[:10]}")
        require(not missing_docked, f"Top 30 candidates missing Vina/Smina docked SDF poses: {missing_docked[:10]}")
        checks["top_candidate_pose_health"] = {
            "top30": int(len(top30)),
            "missing_images": len(missing_images),
            "missing_conformers": len(missing_conformers),
            "missing_docked_poses": len(missing_docked),
        }

    metrics_df = dataframes.get("models/baseline_activity_metrics.csv")
    if metrics_df is not None:
        require(metrics_df["target_id"].nunique() >= 3, "Baseline model metrics should cover all primary targets.")
        require(_finite_numeric(metrics_df["roc_auc"]), "ROC-AUC metrics contain missing or non-finite values.")
        warn(metrics_df["roc_auc"].ge(0.65).all(), "At least one activity model ROC-AUC is below 0.65.")
        checks["mean_activity_auc"] = float(pd.to_numeric(metrics_df["roc_auc"]).mean())

    model_comparison_df = dataframes.get("models/model_comparison.csv")
    if model_comparison_df is not None:
        required_models = {
            "ecfp_logistic_regression",
            "ecfp_random_forest",
            "rdkit_extra_trees",
            "similarity_to_known_actives",
            "current_selected_baseline",
        }
        observed_models = set(model_comparison_df["model_name"].astype(str))
        require(required_models.issubset(observed_models), f"Model comparison missing required baselines: {sorted(required_models - observed_models)}")
        require(model_comparison_df["split_strategy"].astype(str).str.contains("scaffold|random", case=False, na=False).all(), "Model comparison split strategy must be explicit.")
        checks["model_comparison_models"] = sorted(observed_models)

    registry_json = project_dir / "platform" / "module_registry.json"
    if registry_json.exists():
        registry = _read_json(registry_json)
        modules = registry.get("modules", [])
        require(int(registry.get("module_count", 0)) >= 18, "Module registry must expose all 18 scientist workflow modules.")
        required_module_fields = {
            "module_id",
            "name",
            "input_schema",
            "output_schema",
            "queue",
            "artifact_types",
            "tier_minimum",
            "credit_estimator",
            "claim_boundary",
            "quality_gate",
            "failure_policy",
        }
        missing_registry_fields = [
            module.get("module_id", "<unknown>")
            for module in modules
            if required_module_fields.difference(module)
        ]
        require(not missing_registry_fields, f"Module registry entries missing required fields: {missing_registry_fields[:5]}")
        checks["registered_modules"] = int(registry.get("module_count", len(modules)))

    execution_matrix = dataframes.get("platform/module_execution_matrix.csv")
    if execution_matrix is not None:
        require(len(execution_matrix) >= 18, "Module execution matrix must cover all 18 scientist modules.")
        require(execution_matrix["dry_run_supported"].astype(str).str.lower().isin({"true", "1"}).all(), "Every module must support dry-run mode.")
        require(execution_matrix["small_mode_supported"].astype(str).str.lower().isin({"true", "1"}).all(), "Every module must support small mode.")
        require(execution_matrix["production_mode_supported"].astype(str).str.lower().isin({"true", "1"}).all(), "Every module must support production mode.")
        require(
            not execution_matrix["placeholder_policy"].astype(str).str.contains("contract_recorded_placeholder_for_non_dry_run", case=False, na=False).any(),
            "Module execution matrix still permits contract-recorded placeholders for non-dry-run module execution.",
        )
        require(
            execution_matrix["standard_result_artifact"].astype(str).str.contains("module_result.json", na=False).all(),
            "Every module must declare the standardized module_result.json artifact.",
        )
        checks["module_execution_rows"] = int(len(execution_matrix))

    result_schema = project_dir / "platform" / "module_result_schema.json"
    if result_schema.exists():
        schema = _read_json(result_schema)
        required_keys = set(schema.get("required_keys", []))
        expected_keys = {"module_id", "project_id", "run_id", "status", "artifacts", "warnings", "limitations", "next_actions", "credits_used", "claim_boundary"}
        require(expected_keys.issubset(required_keys), f"Module result schema missing keys: {sorted(expected_keys - required_keys)}")
        require(set(schema.get("status_values", [])) == {"succeeded", "partial_success", "failed"}, "Module result status values must remain succeeded/partial_success/failed.")

    inhibitor_df = dataframes.get("inhibitors/candidate_inhibitor_proximity.csv")
    if inhibitor_df is not None:
        require(len(inhibitor_df) >= 30, "Inhibitor proximity should cover at least the top candidate set.")
        similarity = pd.to_numeric(inhibitor_df["nearest_inhibitor_similarity"], errors="coerce")
        too_close = inhibitor_df.loc[similarity.gt(0.90)]
        if not too_close.empty:
            require(
                too_close["novelty_label"].astype(str).str.contains("too_close|reference_reuse", case=False, na=False).all(),
                "Candidates above 0.90 reference-inhibitor similarity must not be labeled novel.",
            )
        checks["inhibitor_proximity_rows"] = int(len(inhibitor_df))

    admet_metrics = dataframes.get("models/admet_model_metrics.csv")
    if admet_metrics is not None:
        trained = admet_metrics[admet_metrics["model_path"].fillna("").astype(str).str.len() > 0].copy()
        require(len(trained) >= 4, "Expected at least four trained ADMET/toxicity endpoints.")
        require({"tox21", "clintox"}.issubset(set(trained["dataset"].astype(str))), "ADMET metrics should include Tox21 and ClinTox.")
        require(pd.to_numeric(trained["records_train"], errors="coerce").gt(0).all(), "Trained ADMET endpoints have non-positive train counts.")
        ap = pd.to_numeric(trained["average_precision"], errors="coerce").fillna(0)
        prevalence_source = trained["positive_rate_eval"] if "positive_rate_eval" in trained.columns else pd.Series(0, index=trained.index)
        prevalence = pd.to_numeric(prevalence_source, errors="coerce").replace(0, pd.NA)
        ap_lift = (ap / prevalence).astype(float)
        weak_ap = [
            f"{row.dataset}:{row.endpoint}"
            for row in trained.loc[ap.lt(0.20) & ap_lift.lt(2.0), ["dataset", "endpoint"]].astype(str).itertuples(index=False)
        ]
        warn(not weak_ap, f"ADMET endpoints have low AP and weak lift over prevalence: {weak_ap[:5]}")
        checks["trained_admet_endpoints"] = int(len(trained))
        checks["admet_ap_lift_min"] = float(ap_lift.min(skipna=True))
        checks["admet_low_absolute_ap_explained"] = trained.loc[ap.lt(0.20), ["dataset", "endpoint", "positive_rate_eval", "average_precision"]].to_dict("records")

    qm_df = dataframes.get("qm/qm_descriptors.csv")
    if qm_df is not None:
        require(_finite_numeric(qm_df["homo_lumo_gap_ev"]), "QM HOMO-LUMO gaps contain missing or non-finite values.")
        require(_bool_series(qm_df["qm_is_real"]).all(), "QM stage did not use real xTB/RDKit quantum descriptors for every row.")
        require(qm_df["qm_mode"].astype(str).str.contains("xtb", case=False, na=False).all(), "QM stage is not xTB-backed for every row.")
        checks["qm_modes"] = sorted(qm_df["qm_mode"].astype(str).unique().tolist())

    qml_df = dataframes.get("qml/quantum_kernel_scores.csv")
    if qml_df is not None:
        require(_finite_numeric(qml_df["qml_score"]), "QML scores contain missing or non-finite values.")
        require(_bool_series(qml_df["qml_is_real"]).all(), "QML stage did not run the Qiskit kernel for every row.")
        require(qml_df["qml_score"].between(0, 1).all(), "QML scores should be normalized to [0, 1].")
        checks["qml_modes"] = sorted(qml_df["qml_mode"].astype(str).unique().tolist())

    qprefilter_df = dataframes.get("qml/quantum_prefilter_scores.csv")
    if qprefilter_df is not None:
        require(_finite_numeric(qprefilter_df["quantum_prefilter_score"]), "Quantum prefilter scores contain missing or non-finite values.")
        require(qprefilter_df["quantum_prefilter_score"].between(0, 1).all(), "Quantum prefilter scores should be normalized to [0, 1].")
        require(_bool_series(qprefilter_df["quantum_prefilter_is_real"]).all(), "Quantum prefilter did not run the Qiskit kernel for every row.")
        checks["quantum_prefilter_modes"] = sorted(qprefilter_df["quantum_prefilter_mode"].astype(str).unique().tolist())

    docking_df = dataframes.get("docking/results.csv")
    if docking_df is not None:
        require(_finite_numeric(docking_df["affinity_kcal_mol"]), "Docking affinities contain missing or non-finite values.")
        real_docking = _bool_series(docking_df["docking_is_real"]).all()
        if tier == "production":
            require(real_docking, "Production tier requires real Vina/Smina docking for every selected candidate.")
        else:
            warn(real_docking, "Docking stage is currently proxy triage; Vina/Smina are smoke-tested but not yet used for every candidate.")
        checks["docking_modes"] = sorted(docking_df["docking_mode"].astype(str).unique().tolist())

    gnina_df = dataframes.get("gnina/results.csv")
    if gnina_df is not None:
        require(gnina_df["target_id"].nunique() >= 3, "GNINA screen should cover the three primary targets.")
        require(gnina_df["gnina_status"].astype(str).eq("completed").all(), "GNINA did not complete for every selected candidate.")
        require(_finite_numeric(gnina_df["gnina_affinity_kcal_mol"]), "GNINA affinities contain missing or non-finite values.")
        require(_finite_numeric(gnina_df["gnina_cnn_pose_score"]), "GNINA CNN pose scores contain missing or non-finite values.")
        require(_finite_numeric(gnina_df["gnina_cnn_affinity"]), "GNINA CNN affinities contain missing or non-finite values.")
        require(gnina_df["gnina_cnn_pose_score"].between(0, 1).all(), "GNINA CNN pose scores should be normalized to [0, 1].")
        require(_bool_series(gnina_df["gnina_is_real"]).all(), "GNINA screen is not marked as real for every row.")
        missing_poses = [path for path in gnina_df["gnina_pose_sdf_path"].astype(str) if not Path(path).exists()]
        require(not missing_poses, f"GNINA pose SDF files are missing: {missing_poses[:5]}")
        warn(
            not gnina_df["gnina_mode"].astype(str).str.contains("exploratory_blind_box", na=False).any(),
            "GNINA is running real CNN docking, but current boxes are exploratory receptor-centroid boxes rather than curated binding pockets.",
        )
        warning_text = ""
        for column in ["gnina_warnings", "gnina_output_excerpt"]:
            if column in gnina_df.columns:
                warning_text += " ".join(gnina_df[column].fillna("").astype(str).tolist()).lower()
        warn(
            "outside box" not in warning_text and "outside the box" not in warning_text,
            "GNINA reported at least one ligand outside-box warning; inspect pose and pocket coordinates before claiming docking validity.",
        )
        checks["gnina_modes"] = sorted(gnina_df["gnina_mode"].astype(str).unique().tolist())

    redocking_path = project_dir / "docking" / "redocking_validation.csv"
    if redocking_path.exists():
        redocking_df = pd.read_csv(redocking_path)
        require(redocking_df["target_id"].nunique() >= 3, "Redocking validation registry should cover all primary targets.")
        checks["redocking_validation"] = {
            "rows": int(len(redocking_df)),
            "statuses": sorted(redocking_df["redocking_status"].astype(str).unique().tolist()) if "redocking_status" in redocking_df.columns else [],
        }
        if "redocking_rmsd_angstrom" in redocking_df.columns:
            rmsd = pd.to_numeric(redocking_df["redocking_rmsd_angstrom"], errors="coerce")
            warn(rmsd.notna().any(), "Redocking validation registry exists, but no reference-ligand RMSD has been computed yet.")
            high_rmsd = [
                f"{row.target_id}:{row.redocking_rmsd_angstrom}"
                for row in redocking_df.loc[rmsd.gt(2.0), ["target_id", "redocking_rmsd_angstrom"]].astype(str).itertuples(index=False)
            ]
            warn(not high_rmsd, f"Reference ligand redocking RMSD exceeds 2.0 A for: {high_rmsd[:5]}")
    elif tier == "production":
        warnings.append("Redocking validation registry is missing; run python -m q_ai_drug.docking.redocking_validation before scientific review.")

    md_df = dataframes.get("md/stability.csv")
    if md_df is not None:
        forbidden_md_columns = {"rmsd_1ns", "rmsd_5ns", "rmsd_10ns", "time_ns", "production_md", "complex_md"}
        require(not forbidden_md_columns.intersection(set(md_df.columns)), f"MD stability output still contains forbidden legacy columns: {sorted(forbidden_md_columns.intersection(set(md_df.columns)))}")
        require(_finite_numeric(md_df["rmsd_checkpoint_final"]), "MD checkpoint RMSD values contain missing or non-finite values.")
        real_md = _bool_series(md_df["md_is_real"]).all()
        if tier == "production":
            require(real_md, "Production tier requires real OpenMM trajectories for every selected complex.")
        else:
            warn(real_md, "MD stage is currently proxy/pose triage; full explicit-solvent protein-ligand trajectories are not yet run.")
        warn(
            not md_df["md_mode"].astype(str).str.contains("ns|production_md", case=False, na=False).any(),
            "MD mode still contains wording that could be confused with nanosecond-scale production MD.",
        )
        checks["md_modes"] = sorted(md_df["md_mode"].astype(str).unique().tolist())

    md_series_df = dataframes.get("md/rmsd_summary.csv")
    if md_series_df is not None:
        forbidden_md_columns = {"rmsd_1ns", "rmsd_5ns", "rmsd_10ns", "time_ns", "production_md", "complex_md"}
        require(not forbidden_md_columns.intersection(set(md_series_df.columns)), f"MD RMSD summary still contains forbidden legacy columns: {sorted(forbidden_md_columns.intersection(set(md_series_df.columns)))}")

    app_df = dataframes.get("models/applicability_domain.csv")
    if app_df is not None:
        require(len(app_df) >= 30, "Applicability-domain table should cover the top 30 candidates.")
        require(app_df["applicability_domain"].astype(str).str.len().gt(0).all(), "Every candidate needs an applicability-domain label.")
        warn(
            not app_df["applicability_domain"].astype(str).eq("out-of-domain").any(),
            "At least one top candidate is out-of-domain; downgrade its model-confidence interpretation.",
        )
        checks["applicability_domains"] = app_df["applicability_domain"].astype(str).value_counts().to_dict()

    interaction_df = dataframes.get("docking/interaction_fingerprints.csv")
    if interaction_df is not None:
        require(len(interaction_df) >= 30, "Interaction fingerprints should cover the top 30 candidates.")
        warn(
            not interaction_df["interaction_quality"].astype(str).str.contains("implausible|missing", case=False, na=False).any(),
            "Some top candidates have missing or implausible interaction fingerprints; inspect receptor/pose quality.",
        )
        checks["interaction_quality"] = interaction_df["interaction_quality"].astype(str).value_counts().to_dict()

    claim_df = dataframes.get("scientific_claim_matrix.csv")
    if claim_df is not None:
        require(claim_df["evidence_level"].astype(str).str.contains("Level 3").any(), "Claim matrix must include the experimental-hit level.")
        level3 = claim_df[claim_df["evidence_level"].astype(str).eq("Level 3")]
        require(
            not level3.empty and level3["current_status"].astype(str).str.contains("not_available", case=False, na=False).all(),
            "Level 3 experimental hit status must remain not_available until wet-lab validation exists.",
        )

    controls_df = dataframes.get("controls/negative_control_results.csv")
    if controls_df is not None:
        required_controls = {
            "known_inactive_proxy",
            "random_druglike",
            "shuffled_target",
            "toxicity_risk_control",
            "docking_decoy_proxy",
            "random_quantum_control",
        }
        observed_controls = set(controls_df["control_type"].astype(str))
        require(required_controls.issubset(observed_controls), f"Negative controls missing required families: {sorted(required_controls - observed_controls)}")
        require(controls_df["pass_fail"].astype(str).isin({"pass", "fail", "review"}).all(), "Negative-control pass_fail values must be pass/fail/review.")
        checks["negative_control_types"] = sorted(observed_controls)

    triage_df = dataframes.get("triage/wet_lab_triage_board.csv")
    if triage_df is not None:
        allowed_classes = {"test_now", "test_after_review", "watchlist", "reject_hold"}
        observed_classes = set(triage_df["triage_class"].astype(str))
        require(observed_classes.issubset(allowed_classes), f"Unexpected wet-lab triage classes: {sorted(observed_classes - allowed_classes)}")
        require(triage_df["reasons_to_test"].astype(str).str.len().gt(0).all(), "Every triage row must include reasons_to_test.")
        require(triage_df["reasons_not_to_test"].astype(str).str.len().gt(0).all(), "Every triage row must include reasons_not_to_test.")
        require(triage_df["claim_boundary"].astype(str).str.contains("Computational hypothesis", case=False, na=False).all(), "Triage board must preserve computational-hypothesis claim boundary.")
        checks["triage_class_counts"] = triage_df["triage_class"].astype(str).value_counts().to_dict()

    triage_summary = project_dir / "triage" / "wet_lab_triage_summary.json"
    if triage_summary.exists():
        triage_payload = _read_json(triage_summary)
        require(bool(triage_payload.get("no_hard_top_n")), "Wet-lab triage summary must state no_hard_top_n=true.")

    evidence_summary = dataframes.get("candidate_evidence/candidate_evidence_summary.csv")
    if evidence_summary is not None:
        require(len(evidence_summary) >= 30, "Candidate evidence documents should cover at least the top candidate set.")
        require(pd.to_numeric(evidence_summary["artifact_count"], errors="coerce").fillna(0).ge(1).all(), "Candidate evidence rows should include at least one artifact pointer.")
        checks["candidate_evidence_rows"] = int(len(evidence_summary))

    evidence_jsonl = project_dir / "candidate_evidence" / "candidate_evidence.jsonl"
    if evidence_jsonl.exists():
        first_line = next((line for line in evidence_jsonl.read_text(encoding="utf-8").splitlines() if line.strip()), "")
        require(bool(first_line), "Candidate evidence JSONL is empty.")
        if first_line:
            doc = json.loads(first_line)
            required_doc_keys = {"candidate_id", "project_id", "target_id", "canonical_smiles", "activity", "admet", "docking", "interactions", "qm", "qml", "triage", "artifacts", "audit"}
            require(required_doc_keys.issubset(doc), f"Candidate evidence document missing keys: {sorted(required_doc_keys - set(doc))}")

    calibrated_weights = project_dir / "ranking" / "calibrated_weights.yaml"
    if calibrated_weights.exists():
        text = calibrated_weights.read_text(encoding="utf-8", errors="ignore")
        require("recommended_weights:" in text, "calibrated_weights.yaml missing recommended_weights.")
        require("limitation:" in text and "selection_basis:" in text, "calibrated_weights.yaml missing limitation or selection_basis.")

    dossier_dir = project_dir / "candidate_dossiers"
    if dossier_dir.exists():
        dossiers = sorted(dossier_dir.glob("*.md"))
        require(len(dossiers) >= 30, "Expected top-10-per-target candidate dossiers.")
        checks["candidate_dossiers"] = len(dossiers)
    else:
        require(False, f"Candidate dossier directory is missing: {dossier_dir}")

    model_cards = dataframes.get("models/model_cards.csv")
    if model_cards is not None:
        modules = set(model_cards["module_name"].astype(str))
        require("target_specific_activity_models" in modules, "Model cards missing target-specific activity models.")
        require("tox21_clintox_admet_models" in modules, "Model cards missing trained ADMET models.")
        require("qiskit_statevector_kernel_reranker" in modules, "Model cards missing Qiskit kernel reranker.")
        checks["model_card_modules"] = sorted(modules)

    figures = sorted((project_dir / "figures").glob("*.png"))
    require(len(figures) >= 4, "Expected at least four report figures.")
    for figure in figures:
        require(_png_ok(figure), f"Figure is not a valid non-empty PNG: {figure}")
    checks["figures"] = [figure.name for figure in figures]

    html_path = project_dir / "report.html"
    if html_path.exists():
        missing_links = [path for path in _local_report_links(project_dir, html_path) if not path.exists()]
        require(not missing_links, f"Report image links are missing local files: {missing_links[:10]}")
        html = html_path.read_text(encoding="utf-8")
        for section in ["Model Registry", "Model Metrics", "ADMET Model Metrics", "Docking Summary", "GNINA CNN Docking", "QM Descriptors", "Quantum Prefilter", "Quantum Kernel Reranking", "Top Candidates"]:
            require(section in html, f"Report missing section: {section}")
        for legacy in ["rmsd_1ns", "rmsd_5ns", "rmsd_10ns", "time_ns"]:
            require(legacy not in html, f"Report still exposes legacy MD label: {legacy}")

    strict_report = project_dir / "strict_scientific_report.md"
    if strict_report.exists():
        strict_text = strict_report.read_text(encoding="utf-8", errors="ignore")
        for section_number in range(1, 25):
            require(f"## {section_number}." in strict_text, f"Strict scientific report missing section {section_number}.")
        require("Computational hypothesis" in strict_text or "computational candidate hypotheses" in strict_text, "Strict report must state computational hypothesis boundary.")

    claim_text = ""
    for rel in ["report.html", "strict_scientific_report.md", "strict_scientific_report.html", "project_completion_report.html"]:
        path = project_dir / rel
        if path.exists():
            claim_text += "\n" + path.read_text(encoding="utf-8", errors="ignore").lower()
    banned_claims = [
        "validated cancer drug",
        "validated cancer drugs",
        "clinically effective",
        "approved therapy",
        "experimental hit confirmed",
    ]
    require(
        not any(phrase in claim_text for phrase in banned_claims),
        "Claim gate failed: report text contains therapeutic or clinical validation wording.",
    )

    status = "pass" if not errors and not warnings else "pass_with_warnings" if not errors else "fail"
    return {"status": status, "tier": tier, "errors": errors, "warnings": warnings, "checks": checks}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Validate generated research artifacts, reports, model outputs, and tool evidence.")
    parser.add_argument("--project", default="outputs/cancer_proof_v1")
    parser.add_argument("--tier", choices=["proof", "production"], default="proof")
    parser.add_argument("--output", default=None)
    parser.add_argument("--fail-on-warnings", action="store_true")
    args = parser.parse_args(argv)

    project_dir = Path(args.project)
    report = validate(project_dir, tier=args.tier)
    default_name = "production_validation_report.json" if args.tier == "production" else "validation_report.json"
    out_path = Path(args.output) if args.output else project_dir / default_name
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(json.dumps(report, indent=2, default=str))

    if report["errors"] or (args.fail_on_warnings and report["warnings"]):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
