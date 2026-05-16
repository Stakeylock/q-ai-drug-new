from __future__ import annotations

import traceback
from datetime import datetime, timezone
import json
from pathlib import Path
import time
from typing import Any

from q_ai_drug.service.db import CandidateRecord, CandidateScoreRecord, JobLogRecord, JobRecord, ProjectRecord, RunRecord, session_scope
from q_ai_drug.service.usage import record_usage
from q_ai_drug.service.workers import run_cancer_proof_job
from q_ai_drug.product.module_registry import estimate_credits, get_module
from q_ai_drug.product.module_execution import dry_run_module, execute_module


PIPELINE_STAGES = [
    "data_retrieval",
    "benchmark_build",
    "model_training",
    "candidate_generation",
    "filtering",
    "quantum_prefilter",
    "docking",
    "gnina",
    "md_triage",
    "qm",
    "qml",
    "ranking",
    "reporting",
]


def _log(job_id: str, message: str, *, level: str = "info") -> None:
    with session_scope() as session:
        record = session.get(JobRecord, job_id)
        session.add(JobLogRecord(job_id=job_id, run_id=record.run_id if record else job_id, level=level, message=message, created_at=datetime.now(timezone.utc)))


def _set_status(job_id: str, status: str, *, stage: str | None = None, output_dir: str | None = None, error: str | None = None) -> None:
    with session_scope() as session:
        now = datetime.now(timezone.utc)
        job = session.get(JobRecord, job_id)
        if job:
            job.status = status
            job.output_dir = output_dir or job.output_dir
            job.error = error
            job.updated_at = now
        run = session.get(RunRecord, job.run_id if job else job_id) if job else session.get(RunRecord, job_id)
        if run:
            run.status = status
            run.stage = stage or run.stage
            run.output_dir = output_dir or run.output_dir
            run.error = error
            run.updated_at = now


def _ingest_candidates(job_id: str, project_id: str, run_id: str, output_dir: Path) -> None:
    import pandas as pd

    path = output_dir / "top_candidates.csv"
    if not path.exists():
        _log(job_id, "No top_candidates.csv found for DB ingestion.", level="warning")
        return
    df = pd.read_csv(path).head(100).astype(object).where(lambda frame: pd.notna(frame), None)
    score_columns = [
        "activity_score",
        "admet_score",
        "affinity_kcal_mol",
        "vina_affinity_kcal_mol",
        "smina_affinity_kcal_mol",
        "gnina_cnn_pose_score",
        "quantum_prefilter_score",
        "qml_score",
        "final_score",
    ]
    with session_scope() as session:
        for row in df.to_dict("records"):
            row = json.loads(json.dumps(row, default=str))
            candidate_pk = f"{run_id}:{row.get('candidate_id')}"
            session.merge(
                CandidateRecord(
                    id=candidate_pk,
                    project_id=project_id,
                    run_id=run_id,
                    target_id=str(row.get("target_id") or ""),
                    candidate_id=str(row.get("candidate_id") or candidate_pk),
                    canonical_smiles=row.get("canonical_smiles") or row.get("smiles"),
                    rank=int(row["target_rank"]) if row.get("target_rank") is not None else None,
                    final_score=float(row["final_score"]) if row.get("final_score") is not None else None,
                    payload=row,
                    created_at=datetime.now(timezone.utc),
                )
            )
            for column in score_columns:
                if row.get(column) is None:
                    continue
                try:
                    value = float(row[column])
                except (TypeError, ValueError):
                    continue
                session.merge(
                    CandidateScoreRecord(
                        id=f"{candidate_pk}:{column}",
                        candidate_id=candidate_pk,
                        score_type=column,
                        value=value,
                        method=str(row.get(column.replace("_score", "_mode")) or ""),
                        payload=None,
                        created_at=datetime.now(timezone.utc),
                    )
                )
    _log(job_id, f"Ingested {len(df)} top candidates into PostgreSQL query tables.")


def _record_run_usage(job_id: str, project_id: str, output_dir: Path, runtime_s: float, *, dry_run: bool = False) -> None:
    with session_scope() as session:
        project = session.get(ProjectRecord, project_id)
        organization_id = project.organization_id if project else None
        user_id = project.owner_user_id if project else None
    summary_path = output_dir / "run_summary.json"
    summary: dict[str, Any] = {}
    if summary_path.exists():
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    usage_items = {
        "compute_seconds": runtime_s,
        "molecules_generated": summary.get("generated_candidates", 0),
        "molecules_filtered": summary.get("filtered_candidates", 0),
        "docking_jobs": summary.get("docking_rows", 0),
        "gnina_jobs": summary.get("gnina_rows", 0),
        "qm_jobs": summary.get("qm_rows", 0),
        "qml_jobs": summary.get("qml_rows", 0),
        "reports_generated": 1 if summary.get("reports") else 0,
    }
    if dry_run:
        usage_items = {"compute_seconds": runtime_s, "dry_run_jobs": 1}
    for event_type, quantity in usage_items.items():
        if quantity:
            record_usage(
                event_type,
                float(quantity),
                user_id=user_id,
                organization_id=organization_id,
                project_id=project_id,
                run_id=job_id,
                metadata={"dry_run": dry_run},
            )


def _stage_result(project_id: str, stage: str, job_id: str | None = None, status: str = "completed") -> dict[str, Any]:
    if job_id:
        _set_status(job_id, "running", stage=stage)
        _log(job_id, f"Stage {stage} {status}.")
    return {"project_id": project_id, "stage": stage, "status": status}


def run_cancer_proof_task(job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    project_id = str(payload["project_id"])
    with session_scope() as session:
        project = session.get(ProjectRecord, project_id)
        if not project:
            raise RuntimeError(f"Project not found: {project_id}")
        config_path = project.config_path
        project_name = project.name
    output_dir = Path("outputs") / project_name
    started = time.monotonic()
    try:
        _set_status(job_id, "running", stage="queued")
        _log(job_id, "Worker started cancer proof workflow.")
        if payload.get("dry_run"):
            for stage in PIPELINE_STAGES:
                _stage_result(project_id, stage, job_id=job_id, status="dry_run_completed")
            runtime_s = time.monotonic() - started
            _record_run_usage(job_id, project_id, output_dir, runtime_s, dry_run=True)
            _set_status(job_id, "succeeded", stage="reporting", output_dir=str(output_dir))
            _log(job_id, "Dry-run workflow completed without scientific compute.")
            return {"project_id": project_id, "dry_run": True, "stages": PIPELINE_STAGES}
        for stage in PIPELINE_STAGES[:5]:
            _stage_result(project_id, stage, job_id=job_id, status="started")
        result = run_cancer_proof_job(
            config_path,
            str(output_dir),
            max_records_per_target=payload.get("max_records_per_target"),
            n_generate=payload.get("n_generate"),
            skip_download=bool(payload.get("skip_download", False)),
        )
        for stage in PIPELINE_STAGES[5:]:
            _stage_result(project_id, stage, job_id=job_id, status="artifact_completed")
        _ingest_candidates(job_id, project_id, job_id, output_dir)
        _record_run_usage(job_id, project_id, output_dir, time.monotonic() - started)
        _set_status(job_id, "succeeded", stage="reporting", output_dir=str(output_dir))
        _log(job_id, f"Worker completed cancer proof workflow: {output_dir}")
        return result
    except Exception as exc:
        _set_status(job_id, "failed", error=str(exc))
        _log(job_id, traceback.format_exc(), level="error")
        raise


def retrieve_datasets(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "data_retrieval", job_id=job_id)


def build_benchmark(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "benchmark_build", job_id=job_id)


def train_activity_models(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "model_training", job_id=job_id)


def train_admet_models(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "model_training", job_id=job_id)


def generate_candidates(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "candidate_generation", job_id=job_id)


def filter_candidates(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "filtering", job_id=job_id)


def run_quantum_prefilter(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "quantum_prefilter", job_id=job_id)


def run_docking(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "docking", job_id=job_id)


def run_gnina(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "gnina", job_id=job_id)


def run_md_triage(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "md_triage", job_id=job_id)


def run_qm_descriptors(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "qm", job_id=job_id)


def run_qml_rerank(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "qml", job_id=job_id)


def build_report(project_id: str, job_id: str | None = None) -> dict[str, Any]:
    return _stage_result(project_id, "reporting", job_id=job_id)


def run_module_task(job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    module_id = str(payload["module_id"])
    project_id = str(payload["project_id"])
    module = get_module(module_id)
    with session_scope() as session:
        project = session.get(ProjectRecord, project_id)
        if not project:
            raise RuntimeError(f"Project not found: {project_id}")
        output_dir = Path("outputs") / project.name
        organization_id = project.organization_id
        user_id = project.owner_user_id
        
    reserved_credits = 0.1 if payload.get("dry_run") else estimate_credits(module_id, payload.get("payload", {}))
    started = time.monotonic()
    
    try:
        _set_status(job_id, "running", stage=module_id)
        _log(job_id, f"Module {module.name} started on queue {module.queue}.")
        if payload.get("dry_run"):
            result = dry_run_module(output_dir, module_id, job_id, payload.get("payload", {}))
            _log(job_id, f"Dry-run module contract validated for {module_id}: {result['status']}.")
            actual_credits = 0.1
        else:
            module_payload = dict(payload.get("payload", {}))
            module_payload["project_id"] = project_id
            result = execute_module(output_dir, module_id, job_id, module_payload)
            _log(job_id, f"Module result artifact written with status {result['status']}.")
            actual_credits = result.get("credits_used", reserved_credits)
            
        # Commit credits
        if organization_id:
            from q_ai_drug.service.billing import credit_commit
            credit_commit(
                organization_id,
                run_id=job_id,
                module_id=module_id,
                actual_credits=actual_credits,
                reserved_credits=reserved_credits,
                project_id=project_id,
                metadata={"dry_run": bool(payload.get("dry_run"))}
            )

        record_usage(
            "module_run",
            actual_credits,
            user_id=user_id,
            organization_id=organization_id,
            project_id=project_id,
            run_id=job_id,
            metadata={"module_id": module_id, "dry_run": bool(payload.get("dry_run"))},
        )
        _set_status(job_id, "succeeded", stage=module_id, output_dir=str(output_dir))
        _log(job_id, f"Module {module.name} completed. Actual credits: {actual_credits}.")
        return {"project_id": project_id, "module_id": module_id, "status": "succeeded", "credits": actual_credits}
    except Exception as exc:
        _set_status(job_id, "failed", stage=module_id, error=str(exc))
        _log(job_id, traceback.format_exc(), level="error")
        # Refund reserved credits on failure
        if organization_id:
            from q_ai_drug.service.billing import credit_refund
            credit_refund(
                organization_id,
                run_id=job_id,
                module_id=module_id,
                refund_amount=reserved_credits,
                reason="module_execution_failed",
                project_id=project_id,
            )
        raise
    finally:
        runtime_s = time.monotonic() - started
        record_usage("module_compute_seconds", runtime_s, project_id=project_id, run_id=job_id, metadata={"module_id": module_id})
