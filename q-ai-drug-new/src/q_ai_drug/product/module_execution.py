from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from q_ai_drug.product.module_registry import estimate_credits, get_module
from q_ai_drug.research.candidate_evidence import build_candidate_evidence_documents
from q_ai_drug.research.inhibitors import build_inhibitor_artifacts
from q_ai_drug.research.wet_lab_triage import build_wet_lab_triage_board


CLAIM_BOUNDARY = "Computational research hypothesis only. Wet-lab validation is required."


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path) if path.exists() and path.stat().st_size > 0 else pd.DataFrame()


def _write_json(path: Path, payload: dict[str, Any] | list[dict[str, Any]]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return path


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(path, index=False)
    return path


def _artifact(path: Path, artifact_type: str, name: str | None = None) -> dict[str, Any]:
    return {
        "type": artifact_type,
        "name": name or path.stem,
        "uri": path.as_posix(),
        "exists": path.exists(),
        "size_bytes": path.stat().st_size if path.exists() else 0,
    }


def _copy_if_exists(source: Path, destination: Path) -> Path | None:
    if not source.exists():
        return None
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination


def _standard_result(
    *,
    project_dir: Path,
    module_id: str,
    run_id: str,
    status: str,
    artifacts: list[dict[str, Any]],
    warnings: list[str] | None = None,
    limitations: list[str] | None = None,
    next_actions: list[str] | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    module = get_module(module_id)
    credits = 0.1 if (payload or {}).get("_dry_run") else estimate_credits(module_id, payload or {})
    return {
        "module_id": module_id,
        "module_name": module.name,
        "project_id": project_dir.name,
        "run_id": run_id,
        "status": status,
        "execution_mode": (payload or {}).get("execution_mode") or ("dry_run" if (payload or {}).get("_dry_run") else "small_or_production"),
        "queue": module.queue,
        "artifacts": artifacts,
        "warnings": warnings or [],
        "limitations": limitations or [module.claim_boundary],
        "next_actions": next_actions or [],
        "credits_used": credits,
        "claim_boundary": CLAIM_BOUNDARY,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _module_dir(project_dir: Path, module_id: str, run_id: str) -> Path:
    return project_dir / "module_runs" / module_id / run_id


def _dataset_builder(project_dir: Path, out_dir: Path) -> list[dict[str, Any]]:
    artifacts = []
    for rel, artifact_type in [
        ("curation/curated_activity.csv", "csv"),
        ("curation/dataset_curation_summary.csv", "csv"),
        ("dataset_curation_report.html", "html"),
        ("run_summary.json", "json"),
    ]:
        src = project_dir / rel
        copied = _copy_if_exists(src, out_dir / Path(rel).name)
        artifacts.append(_artifact(copied or src, artifact_type, Path(rel).stem))
    manifest = {
        "dataset_version_hash_note": "Use checksum of curated_activity.csv plus target config for production dataset versions.",
        "source_notes": "Public ChEMBL/PubChem/MoleculeNet/RCSB/AlphaFold-derived computational curation.",
        "claim_boundary": "Computational public-data curation, not expert manual assay review.",
    }
    artifacts.append(_artifact(_write_json(out_dir / "dataset_provenance_card.json", manifest), "json", "dataset_provenance_card"))
    return artifacts


def _target_intelligence(project_dir: Path, out_dir: Path) -> list[dict[str, Any]]:
    rows = []
    for dossier in sorted((Path("docs") / "targets").glob("*_dossier.md")):
        target_id = dossier.stem.replace("_dossier", "")
        rows.append(
            {
                "target_id": target_id,
                "dossier_path": dossier.as_posix(),
                "evidence_source": "configured target dossier and current proof artifacts",
                "target_score_proxy": 1.0,
                "limitation": "Target score is a workspace evidence proxy until disease/omics evidence graph is connected.",
            }
        )
    path = _write_csv(out_dir / "target_intelligence_summary.csv", rows)
    return [_artifact(path, "csv", "target_intelligence_summary")]


def _protein_workbench(project_dir: Path, out_dir: Path) -> list[dict[str, Any]]:
    rows = []
    pockets = Path("configs") / "oncology_pockets.yaml"
    for structure in sorted(Path("data/structures").glob("*.pdb")):
        text = structure.read_text(encoding="utf-8", errors="ignore")
        atom_count = sum(1 for line in text.splitlines() if line.startswith(("ATOM", "HETATM")))
        rows.append(
            {
                "structure_path": structure.as_posix(),
                "atom_count": atom_count,
                "status": "passed" if atom_count else "failed",
                "next_action": "Use pocket registry and redocking validation before docking claims.",
            }
        )
    report = _write_csv(out_dir / "structure_quality_report.csv", rows)
    return [_artifact(report, "csv", "structure_quality_report"), _artifact(pockets, "yaml", "curated_pocket_registry")]


def _inhibitor_library(project_dir: Path, out_dir: Path) -> list[dict[str, Any]]:
    build_inhibitor_artifacts(project_dir)
    artifacts = []
    for rel in [
        "inhibitors/inhibitor_registry.csv",
        "inhibitors/candidate_inhibitor_proximity.csv",
        "inhibitors/inhibitor_comparison_dossier.md",
    ]:
        artifacts.append(_artifact(project_dir / rel, rel.rsplit(".", 1)[-1], Path(rel).stem))
    return artifacts


def _summarize_csv(project_dir: Path, out_dir: Path, rel: str, artifact_name: str) -> list[dict[str, Any]]:
    source = project_dir / rel
    df = _read_csv(source)
    summary = {
        "source": source.as_posix(),
        "rows": int(len(df)),
        "columns": list(df.columns),
        "claim_boundary": CLAIM_BOUNDARY,
    }
    return [_artifact(source, rel.rsplit(".", 1)[-1], artifact_name), _artifact(_write_json(out_dir / f"{artifact_name}_summary.json", summary), "json", f"{artifact_name}_summary")]


def _view_payload(project_dir: Path, out_dir: Path) -> list[dict[str, Any]]:
    top = _read_csv(project_dir / "top_candidates.csv").head(30)
    payload = {
        "candidate_count": int(len(top)),
        "default_pose_source": "docked",
        "viewer_sources": ["vina_smina_docked_sdf", "gnina_pose_sdf", "rdkit_conformer_sdf"],
        "surface_cartoon_sticks": True,
        "claim_boundary": "Visualization supports expert review; it is not experimental binding observation.",
    }
    return [_artifact(_write_json(out_dir / "q_view_3d_payload.json", payload), "json", "q_view_3d_payload")]


def _collaboration(project_dir: Path, out_dir: Path, payload: dict[str, Any]) -> list[dict[str, Any]]:
    annotation = {
        "project_id": project_dir.name,
        "annotation": payload.get("annotation", "Module run initialized decision log."),
        "decision_state": payload.get("decision_state", "review_pending"),
        "assay_feedback_supported": True,
        "audit": {"created_at": datetime.now(timezone.utc).isoformat()},
        "claim_boundary": CLAIM_BOUNDARY,
    }
    return [_artifact(_write_json(out_dir / "decision_log.json", annotation), "json", "decision_log")]


def execute_module(project_dir: str | Path, module_id: str, run_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    project_dir = Path(project_dir)
    payload = payload or {}
    
    # Try to use new standalone runner if available
    from q_ai_drug.product.module_runners import get_runner
    runner_class = get_runner(module_id)
    if runner_class:
        runner = runner_class(module_id, project_dir, run_id, payload)
        result = runner.execute()
        return result
    
    # Fallback to legacy artifact-first execution (for modules not yet ported)
    out_dir = _module_dir(project_dir, module_id, run_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    warnings: list[str] = []
    limitations: list[str] = []
    next_actions: list[str] = []

    if module_id == "onco_data_builder":
        # Should not reach here if runner registered, but fallback just in case
        artifacts = _dataset_builder(project_dir, out_dir)
        next_actions.append("Use curated benchmark in Activity Model Studio.")
    elif module_id == "target_intelligence_workspace":
        artifacts = _target_intelligence(project_dir, out_dir)
        limitations.append("Disease/omics evidence graph is not yet connected; current target scoring is dossier-backed.")
        next_actions.append("Review target dossier and select receptor/pocket in Protein Workbench.")
    elif module_id == "protein_workbench":
        artifacts = _protein_workbench(project_dir, out_dir)
        next_actions.append("Run redocking validation before relying on docking evidence.")
    elif module_id == "inhibitor_library_studio":
        artifacts = _inhibitor_library(project_dir, out_dir)
        next_actions.append("Use inhibitor proximity labels in generation, ranking, and triage.")
    elif module_id == "q_generate":
        artifacts = _summarize_csv(project_dir, out_dir, "generated.csv", "generated_candidates")
        limitations.append("Current generator is target-conditioned seed expansion and template enumeration.")
    elif module_id == "activity_model_studio":
        artifacts = _summarize_csv(project_dir, out_dir, "models/model_comparison.csv", "model_comparison")
        next_actions.append("Inspect similarity baseline before trusting activity model uplift.")
    elif module_id == "q_filter":
        artifacts = _summarize_csv(project_dir, out_dir, "filtered.csv", "filtered_candidates")
        artifacts += _summarize_csv(project_dir, out_dir, "medchem/medchem_risk_table.csv", "medchem_risk_table")
        artifacts += _summarize_csv(project_dir, out_dir, "admet/candidate_admet_risk_table.csv", "admet_risk_table")
    elif module_id == "applicability_domain_guard":
        artifacts = _summarize_csv(project_dir, out_dir, "models/applicability_domain.csv", "applicability_domain")
        next_actions.append("Downgrade out-of-domain predictions in all downstream outputs.")
    elif module_id == "q_portfolio_prefilter":
        artifacts = _summarize_csv(project_dir, out_dir, "qml/quantum_prefilter_scores.csv", "quantum_prefilter")
        limitations.append("Exploratory quantum prioritization signal; no hardware superiority claim.")
    elif module_id == "q_dock_studio":
        artifacts = _summarize_csv(project_dir, out_dir, "docking/results.csv", "docking_results")
        artifacts += _summarize_csv(project_dir, out_dir, "gnina/results.csv", "gnina_results")
        artifacts += _summarize_csv(project_dir, out_dir, "docking/redocking_validation.csv", "redocking_validation")
    elif module_id == "q_view_3d":
        artifacts = _view_payload(project_dir, out_dir)
    elif module_id == "interaction_fingerprint_analyzer":
        artifacts = _summarize_csv(project_dir, out_dir, "docking/interaction_fingerprints.csv", "interaction_fingerprints")
    elif module_id == "ligand_pose_relaxation":
        artifacts = _summarize_csv(project_dir, out_dir, "md/stability.csv", "ligand_pose_relaxation")
        limitations.append("This is OpenMM ligand-pose relaxation, not explicit-solvent protein-ligand MD.")
    elif module_id == "q_orbital_analyzer":
        artifacts = _summarize_csv(project_dir, out_dir, "qm/qm_descriptor_summary.csv", "qm_descriptor_summary")
        artifacts += _summarize_csv(project_dir, out_dir, "qm/qm_failure_report.csv", "qm_failure_report")
    elif module_id == "q_rank":
        build_wet_lab_triage_board(project_dir, budget=payload.get("budget"))
        artifacts = _summarize_csv(project_dir, out_dir, "final_ranked_candidates.csv", "final_ranked_candidates")
        artifacts += _summarize_csv(project_dir, out_dir, "ranking/weight_ablation.csv", "weight_ablation")
        artifacts.append(_artifact(project_dir / "ranking" / "calibrated_weights.yaml", "yaml", "calibrated_weights"))
        artifacts.append(_artifact(project_dir / "triage" / "wet_lab_triage_board.csv", "csv", "wet_lab_triage_board"))
    elif module_id == "wet_lab_triage_board":
        build_wet_lab_triage_board(project_dir, budget=payload.get("budget"))
        artifacts = [
            _artifact(project_dir / "triage" / "wet_lab_triage_board.csv", "csv", "wet_lab_triage_board"),
            _artifact(project_dir / "triage" / "wet_lab_triage_board.html", "html", "wet_lab_triage_board"),
            _artifact(project_dir / "triage" / "wet_lab_assay_pack.md", "md", "wet_lab_assay_pack"),
        ]
    elif module_id == "q_report_and_candidate_dossiers":
        build_inhibitor_artifacts(project_dir)
        build_wet_lab_triage_board(project_dir, budget=payload.get("budget"))
        build_candidate_evidence_documents(project_dir, project_id=payload.get("project_id"))
        artifacts = [
            _artifact(project_dir / "report.html", "html", "report"),
            _artifact(project_dir / "report.pdf", "pdf", "report"),
            _artifact(project_dir / "candidate_evidence" / "candidate_evidence.jsonl", "jsonl", "candidate_evidence"),
            _artifact(project_dir / "scientific_claim_matrix.csv", "csv", "claim_matrix"),
        ]
    elif module_id == "collaboration_and_eln_bridge":
        artifacts = _collaboration(project_dir, out_dir, payload)
        limitations.append("ELN/LIMS integrations are represented as export-ready decision logs until external connectors are configured.")
    else:
        raise ValueError(f"Unknown module_id: {module_id}")

    missing = [artifact["name"] for artifact in artifacts if not artifact.get("exists")]
    if missing:
        warnings.append(f"Missing expected artifacts: {', '.join(missing[:8])}")
    status = "partial_success" if missing else "succeeded"
    result = _standard_result(
        project_dir=project_dir,
        module_id=module_id,
        run_id=run_id,
        status=status,
        artifacts=artifacts,
        warnings=warnings,
        limitations=limitations or None,
        next_actions=next_actions,
        payload=payload,
    )
    _write_json(out_dir / "module_result.json", result)
    return result


def dry_run_module(project_dir: str | Path, module_id: str, run_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    project_dir = Path(project_dir)
    payload = payload or {}
    module = get_module(module_id)
    out_dir = _module_dir(project_dir, module_id, run_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    result = _standard_result(
        project_dir=project_dir,
        module_id=module_id,
        run_id=run_id,
        status="succeeded",
        artifacts=[
            {
                "type": "json",
                "name": "module_contract",
                "uri": "registry",
                "exists": True,
                "size_bytes": 0,
            }
        ],
        warnings=[],
        limitations=[module.claim_boundary, "Dry run validates access, quota, and contract only; no scientific compute was executed."],
        next_actions=["Run without dry_run to generate module artifacts."],
        payload={**payload, "_dry_run": True, "execution_mode": "dry_run"},
    )
    _write_json(out_dir / "module_result.json", result)
    return result
