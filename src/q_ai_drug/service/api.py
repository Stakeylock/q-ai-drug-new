from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pandas as pd
import yaml
from fastapi import Body, Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from q_ai_drug.config import FiltersConfig
from q_ai_drug.docking.gnina_runner import run_gnina_screen
from q_ai_drug.filters.medchem_filters import apply_medchem_filters
from q_ai_drug.models.admet import score_admet_candidates
from q_ai_drug.models.baseline_activity import score_candidates
from q_ai_drug.reporting.product_metrics import build_investor_metrics
from q_ai_drug.reporting.scientific_evidence import build_scientific_evidence
from q_ai_drug.service.access import choose_organization, get_project_for_principal
from q_ai_drug.service.auth import CurrentPrincipal, get_current_principal
from q_ai_drug.service.db import CandidateRecord, JobLogRecord, JobRecord, ProjectRecord, RunRecord, TargetRecord, init_database, session_scope
from q_ai_drug.service.models import Job, JobCreate, ModelPredictRequest, Project, ProjectCreate
from q_ai_drug.service.queue import enqueue_cancer_proof_run, queue_enabled, redis_connection
from q_ai_drug.service.routes.artifacts import router as artifacts_router
from q_ai_drug.service.routes.auth import router as auth_router
from q_ai_drug.service.routes.tools import router as tools_router
from q_ai_drug.service.routes.uploads import router as uploads_router
from q_ai_drug.service.settings import get_settings
from q_ai_drug.service.usage import record_usage
from q_ai_drug.service.workers import run_cancer_proof_job

app = FastAPI(title="Q-AI Drug Discovery Platform", version="0.1.0")
DEFAULT_OUTPUT_DIR = Path(os.getenv("QAI_OUTPUT_DIR", "outputs/cancer_proof_v1"))
ROOT_MODELS_DIR = Path(os.getenv("QAI_MODELS_DIR", "models"))
FRONTEND_DIR = Path(os.getenv("QAI_FRONTEND_DIR", "frontend"))
ACTIVE_STRUCTURES_DIR = Path(os.getenv("QAI_STRUCTURES_DIR", "data/structures"))
LEGACY_STRUCTURES_DIR = Path(os.getenv("QAI_LEGACY_STRUCTURES_DIR", "data/structures_havetosee"))

GNINA_THREAD: threading.Thread | None = None
GNINA_LOCK = threading.Lock()

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR), check_dir=False), name="static")
app.mount("/artifacts", StaticFiles(directory=str(DEFAULT_OUTPUT_DIR), check_dir=False), name="artifacts")
app.mount("/structures", StaticFiles(directory=str(ACTIVE_STRUCTURES_DIR), check_dir=False), name="structures")
app.mount("/structures-havetosee", StaticFiles(directory=str(LEGACY_STRUCTURES_DIR), check_dir=False), name="legacy_structures")
app.include_router(auth_router)
app.include_router(uploads_router)
app.include_router(artifacts_router)
app.include_router(tools_router)


def _project_from_record(record: ProjectRecord) -> Project:
    return Project(
        id=record.id,
        name=record.name,
        config_path=record.config_path,
        organization_id=record.organization_id,
        owner_user_id=record.owner_user_id,
        created_at=record.created_at,
    )


def _job_from_record(record: JobRecord | RunRecord) -> Job:
    return Job(
        id=record.id,
        project_id=record.project_id,
        status=record.status,  # type: ignore[arg-type]
        output_dir=record.output_dir,
        error=record.error,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _get_project_record(project_id: str) -> Project | None:
    with session_scope() as session:
        record = session.get(ProjectRecord, project_id)
        return _project_from_record(record) if record else None


def _get_job_record(job_id: str) -> Job | None:
    with session_scope() as session:
        record = session.get(JobRecord, job_id) or session.get(RunRecord, job_id)
        return _job_from_record(record) if record else None


def _upsert_job(job: Job) -> None:
    with session_scope() as session:
        record = session.get(JobRecord, job.id)
        if not record:
            record = JobRecord(
                id=job.id,
                project_id=job.project_id,
                run_id=job.id,
                created_at=job.created_at,
            )
            session.add(record)
        record.status = job.status
        record.output_dir = job.output_dir
        record.error = job.error
        record.updated_at = job.updated_at
        run = session.get(RunRecord, job.id)
        if run:
            run.status = job.status
            run.output_dir = job.output_dir
            run.error = job.error
            run.updated_at = job.updated_at


def _append_job_log(job_id: str, message: str, level: str = "info") -> None:
    with session_scope() as session:
        session.add(
            JobLogRecord(
                job_id=job_id,
                run_id=job_id,
                created_at=datetime.now(timezone.utc),
                level=level,
                message=message,
            )
        )


init_database()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, Any]:
    with session_scope() as session:
        session.execute(select(ProjectRecord.id).limit(1)).first()
    return {
        "status": "ready",
        "database": "ok",
        "queue_enabled": queue_enabled(),
    }


@app.get("/metrics", response_class=PlainTextResponse)
def metrics() -> str:
    with session_scope() as session:
        project_count = len(session.scalars(select(ProjectRecord.id)).all())
        run_count = len(session.scalars(select(RunRecord.id)).all())
        job_count = len(session.scalars(select(JobRecord.id)).all())
    return "\n".join(
        [
            "# HELP qai_projects_total Total persisted projects.",
            "# TYPE qai_projects_total gauge",
            f"qai_projects_total {project_count}",
            "# HELP qai_runs_total Total persisted runs.",
            "# TYPE qai_runs_total gauge",
            f"qai_runs_total {run_count}",
            "# HELP qai_jobs_total Total persisted jobs.",
            "# TYPE qai_jobs_total gauge",
            f"qai_jobs_total {job_count}",
            "",
        ]
    )


@app.get("/")
def root() -> RedirectResponse:
    return RedirectResponse(url="/app")


@app.get("/dashboard")
def dashboard() -> FileResponse:
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Dashboard frontend has not been built.")
    return FileResponse(index_path)


@app.get("/app")
@app.get("/modules")
def main_app() -> FileResponse:
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Application frontend has not been built.")
    return FileResponse(index_path)


@app.get("/investor")
def investor_site() -> FileResponse:
    index_path = FRONTEND_DIR / "investor.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Investor frontend has not been built.")
    return FileResponse(index_path)


@app.get("/completion-report")
def completion_report() -> FileResponse:
    path = DEFAULT_OUTPUT_DIR / "project_completion_report.html"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project completion report has not been generated yet.")
    return FileResponse(path)


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _read_records(path: Path, limit: int = 100) -> list[dict]:
    if not path.exists():
        return []
    df = pd.read_csv(path).head(limit).astype(object)
    return df.where(pd.notna(df), None).to_dict("records")


def _read_jsonl(path: Path, limit: int = 100) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            rows.append({"event": "unparsed", "message": line})
    return rows[-max(1, min(limit, 500)) :]


def _clean_record(row: dict) -> dict:
    return {key: (None if pd.isna(value) else value) for key, value in row.items()}


def _json_clean(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _json_clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_clean(item) for item in value]
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def _artifact_url(raw_path: object) -> str | None:
    if raw_path is None or pd.isna(raw_path):
        return None
    text = str(raw_path).replace("\\", "/")
    prefix = "outputs/cancer_proof_v1/"
    if prefix in text:
        rel = text.split(prefix, 1)[1]
    else:
        try:
            rel = Path(text).resolve().relative_to(DEFAULT_OUTPUT_DIR.resolve()).as_posix()
        except Exception:
            rel = text
    return "/artifacts/" + "/".join(quote(part) for part in rel.split("/"))


def _local_artifact_exists(raw_path: object) -> bool:
    if raw_path is None or pd.isna(raw_path):
        return False
    path = Path(str(raw_path))
    return path.exists() and path.stat().st_size > 0


def _has_value(value: object) -> bool:
    return value is not None and not pd.isna(value) and str(value).strip() != ""


def _fill_asset_fallbacks(candidates: pd.DataFrame) -> pd.DataFrame:
    assets_path = DEFAULT_OUTPUT_DIR / "assets" / "ligand_asset_manifest.csv"
    if not assets_path.exists() or "candidate_id" not in candidates.columns:
        return candidates
    assets = pd.read_csv(assets_path)
    keep = [column for column in ["candidate_id", "png_path", "sdf_path", "smi_path", "structure_mode"] if column in assets.columns]
    if not keep:
        return candidates
    merged = candidates.merge(assets[keep], on="candidate_id", how="left", suffixes=("", "_asset"))
    for column in ["png_path", "sdf_path", "smi_path", "structure_mode"]:
        asset_column = f"{column}_asset"
        if asset_column not in merged.columns:
            continue
        if column not in merged.columns:
            merged[column] = merged[asset_column]
        else:
            merged[column] = merged[column].where(merged[column].notna() & (merged[column].astype(str).str.len() > 0), merged[asset_column])
    return merged


def _merge_supplement(
    frame: pd.DataFrame,
    path: Path,
    columns: list[str],
    *,
    suffix: str,
) -> pd.DataFrame:
    if not path.exists() or "candidate_id" not in frame.columns:
        return frame
    supplement = pd.read_csv(path)
    keep = [column for column in ["candidate_id", *columns] if column in supplement.columns]
    if len(keep) <= 1:
        return frame
    merged = frame.merge(supplement[keep], on="candidate_id", how="left", suffixes=("", suffix))
    for column in keep:
        if column == "candidate_id":
            continue
        supplement_column = f"{column}{suffix}"
        if supplement_column not in merged.columns:
            continue
        if column not in frame.columns:
            merged[column] = merged[supplement_column]
        else:
            merged[column] = merged[column].where(merged[column].notna() & (merged[column].astype(str).str.len() > 0), merged[supplement_column])
    return merged


def _method_tier(row: pd.Series | dict, mode_key: str, status_key: str | None = None) -> str:
    status = str(row.get(status_key, "") if status_key else "").lower()
    if status_key and status and status not in {"completed", "nan", "none"}:
        return "FAILED"
    mode = str(row.get(mode_key, "") or "").lower()
    if "exploratory" in mode or "centroid" in mode:
        return "EXPLORATORY"
    if "proxy" in mode or "generated" in mode:
        return "PROXY"
    return "REAL"


def _candidate_warnings(row: pd.Series | dict) -> list[str]:
    warnings = []
    for mode_key in ["docking_mode", "gnina_mode"]:
        mode = str(row.get(mode_key, "") or "").lower()
        if "exploratory" in mode or "centroid" in mode:
            warnings.append("Search box is exploratory; treat docking as computational triage until redocking validation is completed.")
    text = " ".join(
        str(row.get(key, "") or "")
        for key in ["gnina_warnings", "gnina_output_excerpt", "docking_note", "pocket_provenance_note"]
    ).lower()
    if "outside box" in text or "outside the box" in text:
        warnings.append("GNINA reported ligand outside box or an initial pose box warning.")
    if not _has_value(row.get("docked_sdf_url")) and _has_value(row.get("sdf_url")):
        warnings.append("Generated conformer fallback is used because no docked pose was available.")
    return sorted(set(warnings))


def _build_pose_sources(row: pd.Series | dict) -> list[dict[str, Any]]:
    sources = []
    if _has_value(row.get("docked_sdf_url")):
        sources.append(
            {
                "id": "docked",
                "label": "Vina/Smina docked pose",
                "url": row.get("docked_sdf_url"),
                "receptor_url": row.get("receptor_url"),
                "format": "sdf",
                "method_tier": _method_tier(row, "docking_mode", "docking_status"),
                "download_url": row.get("docked_sdf_url"),
            }
        )
    if _has_value(row.get("gnina_pose_sdf_url")):
        sources.append(
            {
                "id": "gnina",
                "label": "GNINA CNN docked pose",
                "url": row.get("gnina_pose_sdf_url"),
                "receptor_url": row.get("gnina_receptor_url") or row.get("receptor_url"),
                "format": "sdf",
                "method_tier": _method_tier(row, "gnina_mode", "gnina_status"),
                "download_url": row.get("gnina_pose_sdf_url"),
            }
        )
    if _has_value(row.get("sdf_url")):
        sources.append(
            {
                "id": "conformer",
                "label": "Generated RDKit conformer",
                "url": row.get("sdf_url"),
                "format": "sdf",
                "method_tier": "PROXY",
                "download_url": row.get("sdf_url"),
            }
        )
    return sources


def _structure_url(path_text: object) -> str | None:
    if not _has_value(path_text):
        return None
    path = Path(str(path_text))
    if path.parent.name == ACTIVE_STRUCTURES_DIR.name or str(path).replace("\\", "/").startswith("data/structures/"):
        return "/structures/" + quote(path.name)
    if path.parent.name == LEGACY_STRUCTURES_DIR.name or str(path).replace("\\", "/").startswith("data/structures_havetosee/"):
        return "/structures-havetosee/" + quote(path.name)
    return None


def _load_target_config() -> dict[str, Any]:
    path = Path("configs/cancer_targets.yaml")
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _load_retrieval_manifest() -> dict[str, Any]:
    return _read_json(Path("data/processed/retrieval_manifest.json"))


def _write_gnina_status(status: str, **extra: Any) -> None:
    gnina_dir = DEFAULT_OUTPUT_DIR / "gnina"
    gnina_dir.mkdir(parents=True, exist_ok=True)
    payload = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat(), **extra}
    (gnina_dir / "status.json").write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def _model_record(path: Path, alias: str, root: Path) -> dict:
    rel = path.relative_to(root).as_posix()
    model_id = f"{alias}/{rel}"
    suffix = path.suffix.lower()
    if suffix == ".joblib":
        kind = "trained_model"
    elif suffix == ".csv":
        kind = "metrics_table"
    elif suffix == ".json":
        kind = "manifest"
    else:
        kind = "artifact"
    return {
        "id": model_id,
        "name": path.name,
        "kind": kind,
        "scope": alias,
        "relative_path": rel,
        "size_bytes": path.stat().st_size,
        "updated_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
        "download_url": "/research/models/download/" + "/".join(quote(part) for part in model_id.split("/")),
    }


def _resolve_model_path(model_path: str) -> Path:
    parts = [part for part in model_path.replace("\\", "/").split("/") if part]
    if len(parts) < 2:
        raise HTTPException(status_code=404, detail="Model path must include a scope and file path.")
    alias = parts[0]
    if alias == "root":
        root = ROOT_MODELS_DIR.resolve()
    elif alias == "project":
        root = (DEFAULT_OUTPUT_DIR / "models").resolve()
    else:
        raise HTTPException(status_code=404, detail="Unknown model scope.")
    candidate = (root / Path(*parts[1:])).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=403, detail="Model path escapes allowed directories.") from None
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="Model artifact not found.")
    return candidate


@app.get("/research/summary")
def research_summary() -> dict:
    return {
        "run": _read_json(DEFAULT_OUTPUT_DIR / "run_summary.json"),
        "validation": _read_json(DEFAULT_OUTPUT_DIR / "validation_report.json"),
        "production_gate": _read_json(DEFAULT_OUTPUT_DIR / "production_validation_report.json"),
        "root_models": _read_json(ROOT_MODELS_DIR / "research_model_manifest.json"),
    }


@app.get("/research/investor-metrics")
def research_investor_metrics() -> dict:
    metrics = build_investor_metrics(DEFAULT_OUTPUT_DIR)
    for artifact in metrics.get("artifacts", []):
        artifact["url"] = _artifact_url(artifact.get("path")) if artifact.get("available") else None
    metrics["urls"] = {
        "dashboard": "/dashboard",
        "investor_site": "/investor",
        "api_docs": "/docs",
        "scientific_report": "/artifacts/report.html",
        "scientific_report_pdf": "/artifacts/report.pdf",
        "completion_report": "/completion-report",
        "completion_report_html": _artifact_url(DEFAULT_OUTPUT_DIR / "project_completion_report.html"),
        "product_readiness_json": _artifact_url(DEFAULT_OUTPUT_DIR / "product_readiness_report.json"),
    }
    return metrics


@app.get("/research/demo-flow")
def research_demo_flow() -> list[dict]:
    return build_investor_metrics(DEFAULT_OUTPUT_DIR).get("demo_flow", [])


@app.get("/research/product-readiness")
def research_product_readiness() -> dict:
    metrics = build_investor_metrics(DEFAULT_OUTPUT_DIR)
    return {
        "status": metrics["headline"]["production_gate"],
        "proof_gate": metrics["headline"]["proof_gate"],
        "tool_suite": metrics["tool_suite"],
        "validation": metrics["validation"],
        "limitations": metrics["limitations"],
        "next_scientific_upgrades": metrics["next_scientific_upgrades"],
    }


@app.get("/research/scientific-evidence")
def research_scientific_evidence() -> dict:
    return build_scientific_evidence(DEFAULT_OUTPUT_DIR, Path("references.bib"))


@app.get("/research/model-cards")
def research_model_cards() -> list[dict]:
    return _read_records(DEFAULT_OUTPUT_DIR / "models" / "model_cards.csv", limit=200)


@app.get("/research/admet-metrics")
def research_admet_metrics() -> list[dict]:
    return _read_records(DEFAULT_OUTPUT_DIR / "models" / "admet_model_metrics.csv", limit=200)


@app.get("/research/activity-metrics")
def research_activity_metrics() -> list[dict]:
    return _read_records(DEFAULT_OUTPUT_DIR / "models" / "baseline_activity_metrics.csv", limit=100)


@app.get("/research/validation")
def research_validation() -> dict:
    return {
        "proof": _read_json(DEFAULT_OUTPUT_DIR / "validation_report.json"),
        "production": _read_json(DEFAULT_OUTPUT_DIR / "production_validation_report.json"),
    }


@app.get("/research/tools")
def research_tools() -> dict:
    return {
        "external_tools": _read_json(DEFAULT_OUTPUT_DIR / "external_tools_manifest.json"),
        "smoke_tests": _read_json(Path("outputs") / "tool_smoke" / "external_tool_smoke.json"),
    }


@app.get("/research/qm-descriptors")
def research_qm_descriptors(limit: int = 100) -> list[dict]:
    return _read_records(DEFAULT_OUTPUT_DIR / "qm" / "qm_descriptors.csv", limit=max(1, min(limit, 500)))


@app.get("/research/qml-scores")
def research_qml_scores(limit: int = 100) -> list[dict]:
    return _read_records(DEFAULT_OUTPUT_DIR / "qml" / "quantum_kernel_scores.csv", limit=max(1, min(limit, 500)))


@app.get("/research/quantum-prefilter")
def research_quantum_prefilter(limit: int = 200) -> list[dict]:
    return _read_records(DEFAULT_OUTPUT_DIR / "qml" / "quantum_prefilter_scores.csv", limit=max(1, min(limit, 1000)))


@app.get("/research/artifact-health")
def research_artifact_health() -> dict:
    candidates = research_top_candidates(limit=30)
    missing_image = [row.get("candidate_id") for row in candidates if not row.get("png_url")]
    missing_conformer = [row.get("candidate_id") for row in candidates if not row.get("sdf_url")]
    missing_docked = [row.get("candidate_id") for row in candidates if not row.get("docked_sdf_url")]
    gnina_pose = [row.get("candidate_id") for row in candidates if row.get("gnina_pose_sdf_url")]
    validation = _read_json(DEFAULT_OUTPUT_DIR / "validation_report.json")
    production = _read_json(DEFAULT_OUTPUT_DIR / "production_validation_report.json")
    return {
        "top_candidate_count": len(candidates),
        "missing_image_count": len(missing_image),
        "missing_conformer_count": len(missing_conformer),
        "missing_docked_pose_count": len(missing_docked),
        "gnina_pose_count": len(gnina_pose),
        "active_output_dir": str(DEFAULT_OUTPUT_DIR.resolve()),
        "validation_status": validation.get("status", "not_checked"),
        "production_status": production.get("status", "not_checked"),
        "missing_image_candidates": missing_image,
        "missing_conformer_candidates": missing_conformer,
        "missing_docked_pose_candidates": missing_docked,
        "static_paths": {
            "dashboard": "/dashboard",
            "investor": "/investor",
            "artifacts": "/artifacts/",
        },
    }


@app.get("/research/target-workspace")
def research_target_workspace() -> list[dict]:
    config = _load_target_config()
    manifest = _load_retrieval_manifest().get("targets", {})
    pocket_payload = yaml.safe_load(Path("configs/oncology_pockets.yaml").read_text(encoding="utf-8")) if Path("configs/oncology_pockets.yaml").exists() else {}
    pockets = {item.get("target_id"): item for item in pocket_payload.get("pockets", []) if item.get("target_id")}
    candidates = research_top_candidates(limit=120)
    relevance = {
        "EGFR": "EGFR is an oncogenic receptor tyrosine kinase with validated clinical relevance in NSCLC and other solid tumors.",
        "PARP1": "PARP1 is a DNA-damage repair target central to synthetic-lethality strategies, especially BRCA-associated tumors.",
        "PIK3CA": "PIK3CA activates PI3K-alpha signaling and is a clinically validated target in PIK3CA-mutant breast and solid tumors.",
    }
    dossiers = []
    for target_id, payload in sorted((config.get("primary_targets") or {}).items()):
        target_rows = [row for row in candidates if row.get("target_id") == target_id]
        best = max(target_rows, key=lambda row: float(row.get("final_score") or 0), default={})
        target_manifest = manifest.get(target_id, {})
        structures = []
        for raw_path in target_manifest.get("structures", []):
            structures.append(
                {
                    "name": Path(str(raw_path)).name,
                    "path": raw_path,
                    "url": _structure_url(raw_path),
                    "source": "AlphaFold" if "alphafold" in str(raw_path).lower() else "RCSB PDB",
                }
            )
        pocket = pockets.get(target_id, {})
        if pocket.get("pdb_id"):
            pocket_path = ACTIVE_STRUCTURES_DIR / f"{pocket['pdb_id']}.pdb"
            if pocket_path.exists() and all(item["name"] != pocket_path.name for item in structures):
                structures.append(
                    {
                        "name": pocket_path.name,
                        "path": str(pocket_path),
                        "url": _structure_url(pocket_path),
                        "source": f"Curated pocket ({pocket.get('reference_ligand', 'reference ligand')})",
                    }
                )
        coverage = {
            "candidates": len(target_rows),
            "docking": sum(1 for row in target_rows if row.get("docked_sdf_url")),
            "gnina": sum(1 for row in target_rows if row.get("gnina_pose_sdf_url")),
            "qm": sum(1 for row in target_rows if _has_value(row.get("homo_lumo_gap_ev"))),
            "qml": sum(1 for row in target_rows if _has_value(row.get("qml_score"))),
        }
        dossiers.append(
            {
                "target_id": target_id,
                "gene": payload.get("gene", target_id),
                "uniprot_id": payload.get("uniprot_id"),
                "chembl_target_id": target_manifest.get("chembl_target_id"),
                "cancer_relevance": relevance.get(target_id, ", ".join(payload.get("cancer_types", []))),
                "reference_drugs": payload.get("reference_drugs", []),
                "structures": structures,
                "benchmark_activity_records": target_manifest.get("activity_records", 0),
                "rcsb_candidates": target_manifest.get("rcsb_candidates", []),
                "best_candidate": {
                    "candidate_id": best.get("candidate_id"),
                    "final_score": best.get("final_score"),
                    "affinity_kcal_mol": best.get("affinity_kcal_mol"),
                    "gnina_cnn_pose_score": best.get("gnina_cnn_pose_score"),
                    "pose_method_tier": best.get("pose_method_tier"),
                },
                "coverage": coverage,
            }
        )
    return dossiers


@app.get("/research/experiments")
def research_experiments() -> dict:
    summary_path = DEFAULT_OUTPUT_DIR / "experiments" / "experiment_summary.json"
    if not summary_path.exists():
        return {"status": "not_run", "experiment_count": 0, "hybrid_top5": [], "best_experiments": []}
    payload = _read_json(summary_path)
    payload["urls"] = {
        "report_html": _artifact_url(DEFAULT_OUTPUT_DIR / "experiments" / "experiment_report.html"),
        "report_md": _artifact_url(DEFAULT_OUTPUT_DIR / "experiments" / "experiment_report.md"),
        "experiment_matrix": _artifact_url(DEFAULT_OUTPUT_DIR / "experiments" / "experiment_matrix.csv"),
        "hybrid_consensus": _artifact_url(DEFAULT_OUTPUT_DIR / "experiments" / "hybrid_candidate_consensus.csv"),
        "hybrid_top5": _artifact_url(DEFAULT_OUTPUT_DIR / "experiments" / "hybrid_top5_candidates.csv"),
    }
    payload["figure_urls"] = [_artifact_url(path) for path in payload.get("figures", [])]
    return payload


@app.get("/research/pose-viewer-data")
def research_pose_viewer_data(limit: int = 60) -> dict:
    structures = {}
    for path in sorted(ACTIVE_STRUCTURES_DIR.glob("*_alphafold.pdb")):
        target_id = path.name.replace("_alphafold.pdb", "")
        structures[target_id] = {
            "name": path.name,
            "url": "/structures/" + quote(path.name),
            "source": "active_alphafold_structure",
        }
    legacy = []
    for path in sorted(LEGACY_STRUCTURES_DIR.glob("*_alphafold.pdb")):
        legacy.append(
            {
                "name": path.name,
                "url": "/structures-havetosee/" + quote(path.name),
                "source": "legacy_phase2_review_structure",
            }
        )
    return {
        "structures": structures,
        "legacy_structures": legacy,
        "candidates": research_top_candidates(limit=limit),
        "note": "Viewer defaults to Vina/Smina docked SDF poses. GNINA poses are selectable when available; generated RDKit conformers are shown only as fallback evidence. Exploratory boxes are labelled explicitly.",
    }


@app.get("/research/gnina/status")
def research_gnina_status() -> dict:
    return _read_json(DEFAULT_OUTPUT_DIR / "gnina" / "status.json") or {"status": "not_started"}


@app.get("/research/gnina/log")
def research_gnina_log(limit: int = 100) -> list[dict]:
    return _read_jsonl(DEFAULT_OUTPUT_DIR / "gnina" / "run_log.jsonl", limit=limit)


@app.get("/research/gnina/results")
def research_gnina_results(limit: int = 100) -> list[dict]:
    rows = _read_records(DEFAULT_OUTPUT_DIR / "gnina" / "results.csv", limit=max(1, min(limit, 500)))
    for row in rows:
        row["gnina_pose_sdf_url"] = _artifact_url(row.get("gnina_pose_sdf_path"))
        row["gnina_log_url"] = _artifact_url(row.get("gnina_log_path"))
    return rows


def _run_gnina_background(options: dict[str, Any]) -> None:
    try:
        run_gnina_screen(
            out_dir=DEFAULT_OUTPUT_DIR / "gnina",
            top_per_target=int(options.get("top_per_target", 1)),
            depth_mode=options.get("depth_mode"),
            box_size=float(options.get("box_size", 30.0)),
            exhaustiveness=int(options.get("exhaustiveness", 1)),
            num_modes=int(options.get("num_modes", 3)),
            cpu=int(options.get("cpu", 4)),
        )
    except Exception as exc:
        _write_gnina_status("failed", error=str(exc))


@app.post("/research/gnina/start")
def research_gnina_start(payload: dict[str, Any] | None = Body(default=None)) -> dict:
    global GNINA_THREAD
    options = payload or {}
    depth_modes = {"quick": 1, "investor": 3, "scientific": 10}
    depth_mode = str(options.get("depth_mode") or options.get("mode") or "quick").lower()
    if depth_mode not in depth_modes:
        depth_mode = "custom"
    top_default = depth_modes.get(depth_mode, 1)
    options["depth_mode"] = depth_mode
    options["top_per_target"] = max(1, min(int(options.get("top_per_target", top_default)), 10))
    options["box_size"] = max(8.0, min(float(options.get("box_size", 30.0)), 80.0))
    options["exhaustiveness"] = max(1, min(int(options.get("exhaustiveness", 1)), 32))
    options["num_modes"] = max(1, min(int(options.get("num_modes", 3)), 20))
    options["cpu"] = max(1, min(int(options.get("cpu", 4)), 16))

    with GNINA_LOCK:
        if GNINA_THREAD and GNINA_THREAD.is_alive():
            return {"accepted": False, "status": research_gnina_status(), "message": "GNINA screen is already running."}
        _write_gnina_status("queued", **options)
        GNINA_THREAD = threading.Thread(target=_run_gnina_background, args=(options,), daemon=True)
        GNINA_THREAD.start()
    return {"accepted": True, "status": research_gnina_status()}


@app.get("/research/models")
def research_models() -> list[dict]:
    rows = []
    roots = [("root", ROOT_MODELS_DIR), ("project", DEFAULT_OUTPUT_DIR / "models")]
    for alias, root in roots:
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if path.is_file() and path.suffix.lower() in {".joblib", ".csv", ".json", ".pt"}:
                rows.append(_model_record(path, alias, root))
    return rows


@app.get("/research/models/download/{model_path:path}")
def download_research_model(model_path: str) -> FileResponse:
    path = _resolve_model_path(model_path)
    return FileResponse(path, filename=path.name)


@app.post("/research/models/predict")
@app.post("/models/predict")
def predict_with_research_models(payload: ModelPredictRequest) -> dict:
    activity_dir = ROOT_MODELS_DIR / "activity"
    if not activity_dir.exists():
        activity_dir = DEFAULT_OUTPUT_DIR / "models"
    admet_dir = ROOT_MODELS_DIR / "admet"
    frame = pd.DataFrame(
        [
            {
                "target_id": payload.target_id,
                "candidate_id": "interactive_query",
                "smiles": payload.smiles,
                "canonical_smiles": payload.smiles,
            }
        ]
    )
    scored = score_candidates(frame, activity_dir)
    scored = score_admet_candidates(scored, admet_dir)
    filtered = apply_medchem_filters(scored, FiltersConfig())
    if filtered.empty:
        raise HTTPException(status_code=400, detail="SMILES could not be scored after medicinal-chemistry parsing.")
    row = _clean_record(filtered.iloc[0].to_dict())
    return {
        "target_id": payload.target_id,
        "smiles": payload.smiles,
        "activity_score": row.get("activity_score"),
        "predicted_p_activity": row.get("predicted_p_activity"),
        "admet_score": row.get("admet_score"),
        "admet_model_score": row.get("admet_model_score"),
        "tox21_toxicity_probability": row.get("tox21_toxicity_probability"),
        "clintox_toxicity_probability": row.get("clintox_toxicity_probability"),
        "fda_approval_probability": row.get("fda_approval_probability"),
        "qed": row.get("QED"),
        "pains_alert": row.get("pains_alert"),
        "brenk_alert": row.get("brenk_alert"),
        "filter_pass": row.get("filter_pass"),
    }


@app.post("/research/models/batch-predict")
@app.post("/models/batch-predict")
def batch_predict_with_research_models(payload: list[ModelPredictRequest] = Body(...)) -> dict:
    if len(payload) > 100:
        raise HTTPException(status_code=400, detail="Batch prediction is capped at 100 molecules per request.")
    rows = []
    for item in payload:
        try:
            rows.append({"ok": True, "result": predict_with_research_models(item)})
        except HTTPException as exc:
            rows.append({"ok": False, "target_id": item.target_id, "smiles": item.smiles, "error": exc.detail})
    return {"count": len(rows), "results": rows}


@app.get("/research/top-candidates")
def research_top_candidates(limit: int = 100) -> list[dict]:
    candidates_path = DEFAULT_OUTPUT_DIR / "top_candidates.csv"
    if not candidates_path.exists():
        return []
    candidates = pd.read_csv(candidates_path).head(max(1, min(limit, 500)))
    candidates = _fill_asset_fallbacks(candidates)
    candidates = _merge_supplement(
        candidates,
        DEFAULT_OUTPUT_DIR / "docking" / "results.csv",
        [
            "docking_status",
            "docking_mode",
            "docking_note",
            "docking_center_x",
            "docking_center_y",
            "docking_center_z",
            "docking_box_size",
            "docking_box_size_x",
            "docking_box_size_y",
            "docking_box_size_z",
            "vina_affinity_kcal_mol",
            "smina_affinity_kcal_mol",
            "smina_mode",
            "receptor_path",
            "receptor_pdbqt_path",
            "ligand_sdf_path",
            "ligand_pdbqt_path",
            "vina_pose_pdbqt_path",
            "smina_pose_pdbqt_path",
            "docked_sdf_path",
            "pocket_source",
            "pocket_pdb_id",
            "reference_ligand",
            "pocket_method_tier",
            "pocket_provenance_note",
        ],
        suffix="_docking",
    )
    candidates = _merge_supplement(
        candidates,
        DEFAULT_OUTPUT_DIR / "gnina" / "results.csv",
        [
            "gnina_status",
            "gnina_affinity_kcal_mol",
            "gnina_cnn_pose_score",
            "gnina_cnn_affinity",
            "gnina_pose_sdf_path",
            "gnina_log_path",
            "gnina_mode",
            "gnina_warnings",
            "gnina_returncode",
            "gnina_runtime_s",
            "gnina_center_x",
            "gnina_center_y",
            "gnina_center_z",
            "gnina_box_size",
            "gnina_box_size_x",
            "gnina_box_size_y",
            "gnina_box_size_z",
            "gnina_output_excerpt",
            "receptor_path",
        ],
        suffix="_gnina",
    )
    for column in ("png_path", "sdf_path", "smi_path", "docked_sdf_path", "vina_pose_pdbqt_path", "smina_pose_pdbqt_path", "receptor_pdbqt_path", "ligand_sdf_path", "ligand_pdbqt_path"):
        if column in candidates.columns:
            candidates[column.replace("_path", "_url")] = candidates[column].map(_artifact_url)
    if "receptor_path" in candidates.columns:
        candidates["receptor_url"] = candidates["receptor_path"].map(_structure_url)
    if "receptor_path_gnina" in candidates.columns:
        candidates["gnina_receptor_url"] = candidates["receptor_path_gnina"].map(lambda value: _artifact_url(value) or _structure_url(value))
    for column in ("gnina_pose_sdf_path", "gnina_log_path"):
        if column in candidates.columns:
            candidates[column.replace("_path", "_url")] = candidates[column].map(_artifact_url)
    if "docked_sdf_url" in candidates.columns:
        candidates["pose_method_tier"] = candidates.apply(lambda row: _method_tier(row, "docking_mode", "docking_status"), axis=1)
    candidates["pose_sources"] = candidates.apply(_build_pose_sources, axis=1)
    candidates["default_pose_source"] = candidates["pose_sources"].map(
        lambda sources: "docked"
        if any(source.get("id") == "docked" for source in sources)
        else "gnina"
        if any(source.get("id") == "gnina" for source in sources)
        else "conformer"
        if any(source.get("id") == "conformer" for source in sources)
        else None
    )
    candidates["docking_warnings"] = candidates.apply(_candidate_warnings, axis=1)
    candidates["box_center"] = candidates.apply(
        lambda row: {
            "x": row.get("docking_center_x") if _has_value(row.get("docking_center_x")) else row.get("gnina_center_x"),
            "y": row.get("docking_center_y") if _has_value(row.get("docking_center_y")) else row.get("gnina_center_y"),
            "z": row.get("docking_center_z") if _has_value(row.get("docking_center_z")) else row.get("gnina_center_z"),
        },
        axis=1,
    )
    candidates["box_size"] = candidates.apply(
        lambda row: {
            "x": row.get("docking_box_size_x") if _has_value(row.get("docking_box_size_x")) else row.get("docking_box_size"),
            "y": row.get("docking_box_size_y") if _has_value(row.get("docking_box_size_y")) else row.get("docking_box_size"),
            "z": row.get("docking_box_size_z") if _has_value(row.get("docking_box_size_z")) else row.get("docking_box_size"),
        },
        axis=1,
    )
    candidates = candidates.astype(object)
    return [_json_clean(row) for row in candidates.to_dict("records")]


@app.post("/v1/projects", response_model=Project)
@app.post("/projects", response_model=Project)
def create_project(payload: ProjectCreate, principal: CurrentPrincipal = Depends(get_current_principal)) -> Project:
    organization_id = choose_organization(principal, payload.organization_id, required_role="researcher")
    project = Project(
        id=str(uuid.uuid4()),
        name=payload.name,
        config_path=payload.config_path,
        organization_id=organization_id,
        owner_user_id=principal.user_id,
        created_at=datetime.now(timezone.utc),
    )
    with session_scope() as session:
        session.add(
            ProjectRecord(
                id=project.id,
                organization_id=organization_id,
                owner_user_id=principal.user_id,
                name=project.name,
                config_path=project.config_path,
                status="created",
                created_at=project.created_at,
            )
        )
    record_usage("project_created", 1, user_id=principal.user_id, organization_id=organization_id, project_id=project.id)
    return project


@app.get("/v1/projects", response_model=list[Project])
@app.get("/projects", response_model=list[Project])
def list_projects(principal: CurrentPrincipal = Depends(get_current_principal)) -> list[Project]:
    organization_ids = list(principal.organizations)
    with session_scope() as session:
        rows = session.scalars(
            select(ProjectRecord)
            .where((ProjectRecord.owner_user_id == principal.user_id) | (ProjectRecord.organization_id.in_(organization_ids)))
            .order_by(ProjectRecord.created_at.desc())
        ).all()
        return [_project_from_record(row) for row in rows]


@app.get("/v1/projects/{project_id}", response_model=Project)
@app.get("/projects/{project_id}", response_model=Project)
def get_project(project_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> Project:
    return _project_from_record(get_project_for_principal(project_id, principal, required_role="viewer"))


@app.post("/v1/projects/{project_id}/targets")
def add_project_target(
    project_id: str,
    payload: dict | None = Body(default=None),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> dict:
    payload = payload or {}
    get_project_for_principal(project_id, principal, required_role="researcher")
    target_id = str(payload.get("target_id") or payload.get("gene") or "").strip().upper()
    if not target_id:
        raise HTTPException(status_code=422, detail="target_id or gene is required")
    record_id = str(uuid.uuid4())
    with session_scope() as session:
        session.add(
            TargetRecord(
                id=record_id,
                project_id=project_id,
                target_id=target_id,
                gene=payload.get("gene") or target_id,
                metadata_json=payload,
                created_at=datetime.now(timezone.utc),
            )
        )
    record_usage("target_added", 1, user_id=principal.user_id, project_id=project_id, metadata={"target_id": target_id})
    return {"id": record_id, "project_id": project_id, "target_id": target_id, "metadata": payload}


def _run_job(job_id: str, payload: JobCreate) -> None:
    job = _get_job_record(job_id)
    if not job:
        return
    _upsert_job(job.model_copy(update={"status": "running", "updated_at": datetime.now(timezone.utc)}))
    _append_job_log(job_id, "Cancer proof workflow started.")
    project = _get_project_record(payload.project_id)
    if not project:
        _upsert_job(job.model_copy(update={"status": "failed", "error": "Project not found", "updated_at": datetime.now(timezone.utc)}))
        _append_job_log(job_id, "Project not found.", level="error")
        return
    out = Path("outputs") / project.name
    try:
        if payload.dry_run:
            from q_ai_drug.service.tasks import PIPELINE_STAGES, _record_run_usage, _stage_result

            for stage in PIPELINE_STAGES:
                _stage_result(project.id, stage, job_id=job_id, status="dry_run_completed")
            _record_run_usage(job_id, project.id, out, 0.0, dry_run=True)
            completed = _get_job_record(job_id) or job
            _upsert_job(completed.model_copy(update={"status": "succeeded", "output_dir": str(out), "updated_at": datetime.now(timezone.utc)}))
            _append_job_log(job_id, "Dry-run workflow completed without scientific compute.")
            return
        run_cancer_proof_job(
            project.config_path,
            str(out),
            max_records_per_target=payload.max_records_per_target,
            n_generate=payload.n_generate,
            skip_download=payload.skip_download,
        )
        from q_ai_drug.service.tasks import _ingest_candidates

        _ingest_candidates(job_id, project.id, job_id, out)
        completed = _get_job_record(job_id) or job
        _upsert_job(completed.model_copy(update={"status": "succeeded", "output_dir": str(out), "updated_at": datetime.now(timezone.utc)}))
        _append_job_log(job_id, f"Cancer proof workflow completed: {out}")
    except Exception as exc:
        failed = _get_job_record(job_id) or job
        _upsert_job(failed.model_copy(update={"status": "failed", "error": str(exc), "updated_at": datetime.now(timezone.utc)}))
        _append_job_log(job_id, str(exc), level="error")


@app.post("/jobs/cancer-proof", response_model=Job)
def create_cancer_proof_job(payload: JobCreate, principal: CurrentPrincipal = Depends(get_current_principal)) -> Job:
    project_record = get_project_for_principal(payload.project_id, principal, required_role="researcher")
    settings = get_settings()
    if settings.is_production and not queue_enabled():
        raise HTTPException(status_code=503, detail="Production runs require QAI_USE_QUEUE=1 and active workers.")
    now = datetime.now(timezone.utc)
    job = Job(
        id=str(uuid.uuid4()),
        project_id=payload.project_id,
        status="queued",
        created_at=now,
        updated_at=now,
    )
    with session_scope() as session:
        session.add(
            RunRecord(
                id=job.id,
                project_id=job.project_id,
                status="queued",
                stage="queued",
                config=payload.model_dump(),
                created_at=now,
                updated_at=now,
            )
        )
        session.add(
            JobRecord(
                id=job.id,
                project_id=job.project_id,
                run_id=job.id,
                queue="default",
                task_name="run_cancer_proof",
                status="queued",
                payload=payload.model_dump(),
                created_at=now,
                updated_at=now,
            )
    )
    _append_job_log(job.id, "Run queued.")
    record_usage(
        "run_queued",
        1,
        user_id=principal.user_id,
        organization_id=project_record.organization_id,
        project_id=project_record.id,
        run_id=job.id,
        metadata={"dry_run": payload.dry_run},
    )
    if queue_enabled():
        try:
            rq_job_id = enqueue_cancer_proof_run(job.id, payload.model_dump())
        except Exception as exc:
            failed = _get_job_record(job.id) or job
            _upsert_job(failed.model_copy(update={"status": "failed", "error": str(exc), "updated_at": datetime.now(timezone.utc)}))
            _append_job_log(job.id, f"Queue enqueue failed: {exc}", level="error")
            raise HTTPException(status_code=503, detail=f"Queue enqueue failed; job was not run locally: {exc}") from exc
        with session_scope() as session:
            record = session.get(JobRecord, job.id)
            if record:
                record.rq_job_id = rq_job_id
        _append_job_log(job.id, f"Enqueued on Redis/RQ as {rq_job_id}.")
    else:
        _append_job_log(job.id, "QAI_USE_QUEUE is disabled; running in a local background thread for developer mode.", level="warning")
        thread = threading.Thread(target=_run_job, args=(job.id, payload), daemon=True)
        thread.start()
    return job


@app.post("/v1/projects/{project_id}/runs", response_model=Job)
@app.post("/projects/{project_id}/runs", response_model=Job)
def create_project_run(
    project_id: str,
    payload: JobCreate | None = None,
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> Job:
    payload = payload or JobCreate(project_id=project_id)
    payload = payload.model_copy(update={"project_id": project_id})
    return create_cancer_proof_job(payload, principal)


@app.get("/jobs/{job_id}", response_model=Job)
def get_job(job_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> Job:
    job = _get_job_record(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    get_project_for_principal(job.project_id, principal, required_role="viewer")
    return job


@app.post("/jobs/{job_id}/retry", response_model=Job)
def retry_job(job_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> Job:
    with session_scope() as session:
        record = session.get(JobRecord, job_id)
        if not record:
            raise HTTPException(status_code=404, detail="Job not found")
        get_project_for_principal(record.project_id, principal, required_role="researcher")
        if record.status not in {"failed", "cancelled"}:
            raise HTTPException(status_code=409, detail="Only failed or cancelled jobs can be retried.")
        payload_data = record.payload or {"project_id": record.project_id}
        payload = JobCreate(**payload_data)
        record.status = "queued"
        record.error = None
        record.updated_at = datetime.now(timezone.utc)
        run = session.get(RunRecord, record.run_id or record.id)
        if run:
            run.status = "queued"
            run.stage = "queued"
            run.error = None
            run.updated_at = record.updated_at
    _append_job_log(job_id, "Retry requested.")
    if queue_enabled():
        rq_job_id = enqueue_cancer_proof_run(job_id, payload.model_dump())
        with session_scope() as session:
            record = session.get(JobRecord, job_id)
            if record:
                record.rq_job_id = rq_job_id
        _append_job_log(job_id, f"Re-enqueued on Redis/RQ as {rq_job_id}.")
    else:
        _append_job_log(job_id, "QAI_USE_QUEUE is disabled; retry is running in a local background thread.", level="warning")
        thread = threading.Thread(target=_run_job, args=(job_id, payload), daemon=True)
        thread.start()
    return get_job(job_id, principal)


@app.post("/jobs/{job_id}/cancel", response_model=Job)
def cancel_job(job_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> Job:
    with session_scope() as session:
        record = session.get(JobRecord, job_id)
        if not record:
            raise HTTPException(status_code=404, detail="Job not found")
        get_project_for_principal(record.project_id, principal, required_role="researcher")
        if record.status in {"succeeded", "failed", "cancelled"}:
            return _job_from_record(record)
        rq_job_id = record.rq_job_id
        record.status = "cancelled"
        record.error = "Cancelled by user."
        record.updated_at = datetime.now(timezone.utc)
        run = session.get(RunRecord, record.run_id or record.id)
        if run:
            run.status = "cancelled"
            run.error = "Cancelled by user."
            run.updated_at = record.updated_at
    if rq_job_id:
        try:
            from rq.command import send_stop_job_command

            send_stop_job_command(redis_connection(), rq_job_id)
        except Exception as exc:
            _append_job_log(job_id, f"RQ stop command could not be sent: {exc}", level="warning")
    _append_job_log(job_id, "Run cancelled.")
    return get_job(job_id, principal)


@app.get("/v1/runs/{run_id}", response_model=Job)
@app.get("/runs/{run_id}", response_model=Job)
def get_run(run_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> Job:
    return get_job(run_id, principal)


@app.get("/v1/runs/{run_id}/events")
@app.get("/runs/{run_id}/logs")
def get_run_logs(run_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> list[dict]:
    job = _get_job_record(run_id)
    if not job:
        raise HTTPException(status_code=404, detail="Run not found")
    get_project_for_principal(job.project_id, principal, required_role="viewer")
    with session_scope() as session:
        rows = session.scalars(select(JobLogRecord).where(JobLogRecord.job_id == run_id).order_by(JobLogRecord.id)).all()
        return [{"created_at": row.created_at.isoformat(), "level": row.level, "message": row.message} for row in rows]


@app.get("/projects/{project_id}/candidates")
def list_candidates(project_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> list[dict]:
    project_record = get_project_for_principal(project_id, principal, required_role="viewer")
    with session_scope() as session:
        records = session.scalars(select(CandidateRecord).where(CandidateRecord.project_id == project_id).order_by(CandidateRecord.rank)).all()
        if records:
            return [record.payload or {} for record in records[:100]]
    path = Path("outputs") / project_record.name / "top_candidates.csv"
    if not path.exists():
        return []
    return pd.read_csv(path).head(100).to_dict("records")


@app.get("/runs/{run_id}/candidates")
def list_run_candidates(run_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> list[dict]:
    job = get_job(run_id, principal)
    with session_scope() as session:
        records = session.scalars(select(CandidateRecord).where(CandidateRecord.run_id == run_id).order_by(CandidateRecord.rank)).all()
        if records:
            return [record.payload or {} for record in records[:100]]
    path = Path(job.output_dir or "") / "top_candidates.csv"
    if not path.exists():
        return []
    return pd.read_csv(path).head(100).astype(object).where(lambda frame: pd.notna(frame), None).to_dict("records")
