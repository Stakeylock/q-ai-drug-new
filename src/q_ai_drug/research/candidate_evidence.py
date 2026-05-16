from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size <= 0:
        return pd.DataFrame()
    try:
        return pd.read_csv(path)
    except pd.errors.EmptyDataError:
        return pd.DataFrame()


def _row_by_candidate(frame: pd.DataFrame, target_id: str, candidate_id: str) -> dict[str, Any]:
    if frame.empty or "candidate_id" not in frame.columns:
        return {}
    mask = frame["candidate_id"].astype(str).eq(str(candidate_id))
    if "target_id" in frame.columns:
        mask &= frame["target_id"].astype(str).eq(str(target_id))
    match = frame.loc[mask].head(1)
    if match.empty:
        return {}
    row = match.astype(object).where(pd.notna(match), None).to_dict("records")[0]
    return {str(key): value for key, value in row.items()}


def _clean(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_clean(item) for item in value]
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return value


def _artifact_list(row: dict[str, Any]) -> list[dict[str, Any]]:
    artifacts = []
    for key, artifact_type in [
        ("png_path", "2d_structure_png"),
        ("sdf_path", "rdkit_conformer_sdf"),
        ("docked_sdf_path", "docked_pose_sdf"),
        ("vina_pose_pdbqt_path", "vina_pose_pdbqt"),
        ("smina_pose_pdbqt_path", "smina_pose_pdbqt"),
        ("trajectory_path", "openmm_ligand_pose_trajectory"),
    ]:
        if row.get(key):
            artifacts.append({"artifact_type": artifact_type, "path": row.get(key)})
    return artifacts


def _schema() -> dict[str, Any]:
    return {
        "collection": "candidate_evidence",
        "required": [
            "candidate_id",
            "project_id",
            "target_id",
            "canonical_smiles",
            "source",
            "activity",
            "admet",
            "medchem",
            "applicability_domain",
            "docking",
            "interactions",
            "qm",
            "qml",
            "triage",
            "artifacts",
            "audit",
        ],
        "claim_boundary": "Computational candidate evidence document; not an experimental hit record.",
    }


def build_candidate_evidence_documents(project_dir: str | Path, project_id: str | None = None) -> dict[str, Any]:
    project_dir = Path(project_dir)
    out_dir = project_dir / "candidate_evidence"
    out_dir.mkdir(parents=True, exist_ok=True)
    ranked = _read_csv(project_dir / "final_ranked_candidates.csv")
    if ranked.empty:
        ranked = _read_csv(project_dir / "top_candidates.csv")
    app = _read_csv(project_dir / "models" / "applicability_domain.csv")
    medchem = _read_csv(project_dir / "medchem" / "medchem_risk_table.csv")
    admet = _read_csv(project_dir / "admet" / "candidate_admet_risk_table.csv")
    interactions = _read_csv(project_dir / "docking" / "interaction_fingerprints.csv")
    triage = _read_csv(project_dir / "triage" / "wet_lab_triage_board.csv")
    inhibitors = _read_csv(project_dir / "inhibitors" / "candidate_inhibitor_proximity.csv")
    redocking = _read_csv(project_dir / "docking" / "redocking_validation.csv")
    documents: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc).isoformat()
    for _, row in ranked.astype(object).where(pd.notna(ranked), None).iterrows():
        base = row.to_dict()
        target_id = str(base.get("target_id") or "")
        candidate_id = str(base.get("candidate_id") or "")
        app_row = _row_by_candidate(app, target_id, candidate_id)
        medchem_row = _row_by_candidate(medchem, target_id, candidate_id)
        admet_row = _row_by_candidate(admet, target_id, candidate_id)
        interaction_row = _row_by_candidate(interactions, target_id, candidate_id)
        triage_row = _row_by_candidate(triage, target_id, candidate_id)
        inhibitor_row = _row_by_candidate(inhibitors, target_id, candidate_id)
        redocking_row = redocking.loc[redocking["target_id"].astype(str).eq(target_id)].head(1).to_dict("records")[0] if not redocking.empty and "target_id" in redocking.columns and redocking["target_id"].astype(str).eq(target_id).any() else {}
        doc = {
            "candidate_id": candidate_id,
            "project_id": project_id or project_dir.name,
            "target_id": target_id,
            "canonical_smiles": base.get("canonical_smiles") or base.get("smiles"),
            "source": {
                "type": base.get("source"),
                "method": base.get("generation_method"),
                "parent_name": base.get("parent_name"),
            },
            "activity": {
                "score": base.get("activity_score"),
                "predicted_p_activity": base.get("predicted_p_activity"),
                "confidence": app_row.get("prediction_confidence"),
            },
            "admet": {
                "score": base.get("admet_score"),
                "risk_class": admet_row.get("admet_risk_class"),
                "endpoint_risks": {key: value for key, value in admet_row.items() if key.endswith("_probability")},
            },
            "medchem": {
                "risk_class": medchem_row.get("medchem_risk_class"),
                "risk_reasons": medchem_row.get("medchem_risk_reasons"),
                "risk_points": medchem_row.get("medchem_risk_points"),
            },
            "applicability_domain": app_row,
            "inhibitor_proximity": inhibitor_row,
            "docking": [
                {
                    "engine": "vina_smina",
                    "affinity_kcal_mol": base.get("affinity_kcal_mol"),
                    "vina_affinity_kcal_mol": base.get("vina_affinity_kcal_mol"),
                    "smina_affinity_kcal_mol": base.get("smina_affinity_kcal_mol"),
                    "status": base.get("docking_status"),
                    "mode": base.get("docking_mode"),
                    "pose_sdf_path": base.get("docked_sdf_path"),
                    "pocket": {
                        "source": base.get("pocket_source"),
                        "method_tier": base.get("pocket_method_tier"),
                        "pdb_id": base.get("pocket_pdb_id"),
                    },
                    "redocking_context": redocking_row,
                }
            ],
            "interactions": interaction_row,
            "pose_relaxation": {
                "mode": base.get("md_mode"),
                "rmsd_checkpoint_early": base.get("rmsd_checkpoint_early"),
                "rmsd_checkpoint_mid": base.get("rmsd_checkpoint_mid"),
                "rmsd_checkpoint_final": base.get("rmsd_checkpoint_final"),
                "trajectory_ps": base.get("trajectory_ps"),
                "claim_boundary": "Ligand-pose relaxation triage only; not explicit-solvent protein-ligand MD.",
            },
            "qm": {
                "homo_ev": base.get("homo_ev"),
                "lumo_ev": base.get("lumo_ev"),
                "homo_lumo_gap_ev": base.get("homo_lumo_gap_ev"),
                "xtb_total_energy_eh": base.get("xtb_total_energy_eh"),
                "quantum_score": base.get("quantum_score"),
                "mode": base.get("qm_mode"),
                "is_real": base.get("qm_is_real"),
            },
            "qml": {
                "qml_score": base.get("qml_score"),
                "qml_mode": base.get("qml_mode"),
                "quantum_ablation_delta": base.get("quantum_ablation_delta"),
                "claim_boundary": "Exploratory quantum prioritization signal with classical ablation; no hardware superiority claim.",
            },
            "triage": {
                "class": triage_row.get("triage_class"),
                "confidence": triage_row.get("triage_confidence"),
                "reasons_to_test": str(triage_row.get("reasons_to_test") or "").split(" | ") if triage_row.get("reasons_to_test") else [],
                "reasons_not_to_test": str(triage_row.get("reasons_not_to_test") or "").split(" | ") if triage_row.get("reasons_not_to_test") else [],
                "recommended_assay_plan": str(triage_row.get("recommended_assay_plan") or "").split(" | ") if triage_row.get("recommended_assay_plan") else [],
            },
            "artifacts": _artifact_list(base),
            "audit": {
                "created_at": now,
                "source_project_dir": str(project_dir),
                "claim_boundary": "Computational research hypothesis only. Wet-lab validation is required.",
            },
        }
        documents.append(_clean(doc))
    jsonl_path = out_dir / "candidate_evidence.jsonl"
    jsonl_path.write_text("\n".join(json.dumps(doc, default=str) for doc in documents) + ("\n" if documents else ""), encoding="utf-8")
    (out_dir / "mongodb_candidate_documents.json").write_text(json.dumps(documents[:100], indent=2, default=str), encoding="utf-8")
    (out_dir / "candidate_evidence_schema.json").write_text(json.dumps(_schema(), indent=2), encoding="utf-8")
    indexes = [
        {"keys": {"project_id": 1, "target_id": 1, "candidate_id": 1}, "unique": True},
        {"keys": {"target_id": 1, "triage.class": 1, "activity.score": -1}},
        {"keys": {"inhibitor_proximity.nearest_inhibitor_similarity": -1}},
        {"keys": {"audit.created_at": -1}},
    ]
    (out_dir / "mongodb_indexes.json").write_text(json.dumps(indexes, indent=2), encoding="utf-8")
    summary = pd.DataFrame(
        [
            {
                "target_id": doc["target_id"],
                "candidate_id": doc["candidate_id"],
                "triage_class": doc["triage"]["class"],
                "activity_score": doc["activity"]["score"],
                "admet_risk_class": doc["admet"]["risk_class"],
                "interaction_quality": doc["interactions"].get("interaction_quality") if isinstance(doc["interactions"], dict) else None,
                "nearest_inhibitor_similarity": doc["inhibitor_proximity"].get("nearest_inhibitor_similarity") if isinstance(doc["inhibitor_proximity"], dict) else None,
                "artifact_count": len(doc["artifacts"]),
            }
            for doc in documents
        ]
    )
    summary.to_csv(out_dir / "candidate_evidence_summary.csv", index=False)
    return {
        "candidate_evidence_documents": len(documents),
        "jsonl": str(jsonl_path),
        "schema": str(out_dir / "candidate_evidence_schema.json"),
        "indexes": str(out_dir / "mongodb_indexes.json"),
    }
