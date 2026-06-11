from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from q_ai_drug.product.module_registry import (
    COMPUTE_DEPTH_PRESETS,
    TIER_ORDER,
    TIER_QUOTAS,
    estimate_credits,
    get_module,
    list_modules,
    module_registry_document,
    tier_allows,
)
from q_ai_drug.service.access import get_project_for_principal, require_org_role
from q_ai_drug.service.auth import CurrentPrincipal, get_current_principal
from q_ai_drug.service.billing import QuotaError, billing_summary, check_quota, consume_credits, set_plan_tier
from q_ai_drug.service.db import JobLogRecord, JobRecord, ProjectRecord, RunRecord, session_scope
from q_ai_drug.service.models import Job, ToolEstimateResponse, ToolRunRequest
from q_ai_drug.service.queue import enqueue_module_task, queue_enabled
from q_ai_drug.service.tasks import run_module_task
from q_ai_drug.service.usage import record_usage
from q_ai_drug.service.tool_payloads import validate_payload


router = APIRouter(tags=["tools"])


def _job_view(record: JobRecord) -> Job:
    return Job(
        id=record.id,
        project_id=record.project_id,
        status=record.status,  # type: ignore[arg-type]
        output_dir=record.output_dir,
        error=record.error,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _append_log(job_id: str, message: str, level: str = "info") -> None:
    with session_scope() as session:
        record = session.get(JobRecord, job_id)
        session.add(JobLogRecord(job_id=job_id, run_id=record.run_id if record else job_id, level=level, message=message, created_at=datetime.now(timezone.utc)))


def _project_output_dir(project: ProjectRecord) -> Path:
    return Path("outputs") / project.name


def _module_id_from_job(record: JobRecord | None) -> str | None:
    if not record:
        return None
    if record.task_name and record.task_name.startswith("module:"):
        return record.task_name.split(":", 1)[1]
    payload = record.payload or {}
    module_id = payload.get("module_id")
    return str(module_id) if module_id else None


def _module_result_path(project: ProjectRecord, record: JobRecord) -> Path | None:
    module_id = _module_id_from_job(record)
    if not module_id:
        return None
    return _project_output_dir(project) / "module_runs" / module_id / record.id / "module_result.json"


def _project_file(project: ProjectRecord, file_path: str) -> Path:
    root = _project_output_dir(project).resolve()
    target = (root / file_path).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requested path escapes the project output directory.") from None
    if not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project file not found")
    return target


def _queue_priority(tier: str) -> str:
    tier_key = tier.lower().replace(" ", "_").replace("/", "").replace("-", "_")
    if tier_key not in TIER_ORDER:
        tier_key = "student_free"
    return "high" if TIER_ORDER.index(tier_key) >= TIER_ORDER.index("startup_team") else "normal"


def _record_requested_quota_usage(
    request: ToolRunRequest,
    *,
    principal: CurrentPrincipal,
    organization_id: str | None,
    project_id: str,
    run_id: str,
    module_id: str,
) -> None:
    counters = {
        "molecules_requested": request.payload.get("molecule_count") or request.payload.get("candidate_count") or request.payload.get("n_generate"),
        "docking_pairs_requested": request.payload.get("docking_pairs"),
        "qm_rows_requested": request.payload.get("qm_rows"),
    }
    for event_type, quantity in counters.items():
        if not quantity:
            continue
        record_usage(
            event_type,
            float(quantity),
            user_id=principal.user_id,
            organization_id=organization_id,
            project_id=project_id,
            run_id=run_id,
            metadata={"module_id": module_id, "tier": request.tier, "dry_run": request.dry_run},
        )


def _create_tool_job(module_id: str, request: ToolRunRequest, principal: CurrentPrincipal, *, project_id: str | None = None) -> Job:
    module = get_module(module_id)
    resolved_project_id = project_id or request.project_id
    if not resolved_project_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="project_id is required")
    project = get_project_for_principal(resolved_project_id, principal, required_role="researcher")
    require_org_role(principal, project.organization_id, required="researcher")
    if not tier_allows(request.tier, module_id):
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=f"{module.name} requires tier {module.tier_minimum}")
    
    quota_payload = dict(request.payload)
    quota_payload["_dry_run"] = request.dry_run
    try:
        quota = check_quota(str(project.organization_id), module_id, quota_payload, request.tier)
    except QuotaError as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc)) from exc
    
    # Validate payload BEFORE credit reservation to prevent wasting credits on invalid inputs
    try:
        validated_payload = validate_payload(module_id, request.payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid payload for {module.name}: {str(exc)}"
        ) from exc
    now = datetime.now(timezone.utc)
    job_id = str(uuid.uuid4())
    queue_priority = _queue_priority(str(quota["tier"]))
    payload = {
        "project_id": project.id,
        "module_id": module_id,
        "payload": validated_payload,
        "dry_run": request.dry_run,
        "tier": request.tier,
        "compute_depth": request.compute_depth,
        "queue_priority": queue_priority,
    }
    with session_scope() as session:
        session.add(
            RunRecord(
                id=job_id,
                project_id=project.id,
                status="queued",
                stage=module_id,
                config=payload,
                created_at=now,
                updated_at=now,
            )
        )
        record = JobRecord(
            id=job_id,
            project_id=project.id,
            run_id=job_id,
            queue=module.queue,
            task_name=f"module:{module_id}",
            status="queued",
            payload=payload,
            created_at=now,
            updated_at=now,
        )
        session.add(record)
        session.flush()
        view = _job_view(record)
    credits = float(quota["estimated_credits"])
    ledger = consume_credits(
        str(project.organization_id),
        credits=credits,
        transaction_type="module_reserve",
        project_id=project.id,
        run_id=job_id,
        module_id=module_id,
        metadata={"tier": request.tier, "compute_depth": request.compute_depth, "dry_run": request.dry_run},
    )
    _record_requested_quota_usage(
        request,
        principal=principal,
        organization_id=project.organization_id,
        project_id=project.id,
        run_id=job_id,
        module_id=module_id,
    )
    record_usage(
        "module_queued",
        credits,
        user_id=principal.user_id,
        organization_id=project.organization_id,
        project_id=project.id,
        run_id=job_id,
        metadata={"module_id": module_id, "tier": request.tier, "compute_depth": request.compute_depth},
    )
    _append_log(job_id, f"Module {module.name} queued. Credits reserved: {credits}. Balance after reserve: {ledger.balance_after:.2f}.")
    if queue_enabled():
        try:
            rq_job_id = enqueue_module_task(module.queue, job_id, payload, priority=queue_priority)
        except Exception as exc:
            try:
                consume_credits(
                    str(project.organization_id),
                    credits=-credits,
                    transaction_type="module_refund",
                    project_id=project.id,
                    run_id=job_id,
                    module_id=module_id,
                    metadata={"reason": "enqueue_failed"},
                )
            except Exception:
                pass
            with session_scope() as session:
                record = session.get(JobRecord, job_id)
                run = session.get(RunRecord, job_id)
                if record:
                    record.status = "failed"
                    record.error = str(exc)
                    record.updated_at = datetime.now(timezone.utc)
                if run:
                    run.status = "failed"
                    run.error = str(exc)
                    run.updated_at = datetime.now(timezone.utc)
            _append_log(job_id, f"Queue enqueue failed: {exc}", level="error")
            raise HTTPException(status_code=503, detail=f"Queue enqueue failed; module was not run locally: {exc}") from exc
        with session_scope() as session:
            record = session.get(JobRecord, job_id)
            if record:
                record.rq_job_id = rq_job_id
        _append_log(job_id, f"Enqueued on {module.queue} as {rq_job_id} with {queue_priority} priority.")
    else:
        _append_log(job_id, "QAI_USE_QUEUE is disabled; running module in a local developer thread.", level="warning")
        thread = threading.Thread(target=run_module_task, args=(job_id, payload), daemon=True)
        thread.start()
    return view


@router.get("/v1/tools")
def get_tools() -> dict[str, Any]:
    return module_registry_document()


@router.get("/v1/tools/{module_id}")
def get_tool(module_id: str) -> dict[str, Any]:
    try:
        return get_module(module_id).to_dict()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/projects/{project_id}/tools")
def get_project_tools(project_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> dict[str, Any]:
    get_project_for_principal(project_id, principal, required_role="viewer")
    return {
        "project_id": project_id,
        "modules": list_modules(),
        "tier_quotas": TIER_QUOTAS,
        "compute_depth_presets": COMPUTE_DEPTH_PRESETS,
    }


@router.post("/projects/{project_id}/tools/{module_id}/estimate", response_model=ToolEstimateResponse)
def estimate_project_tool(
    project_id: str,
    module_id: str,
    request: ToolRunRequest | None = Body(default=None),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> ToolEstimateResponse:
    request = request or ToolRunRequest()
    project = get_project_for_principal(project_id, principal, required_role="viewer")
    try:
        module = get_module(module_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    quota_status = "not_checked"
    quota_detail = None
    credit_balance = None
    quotas = None
    if project.organization_id:
        quota_payload = dict(request.payload)
        quota_payload["_dry_run"] = request.dry_run
        try:
            quota = check_quota(project.organization_id, module_id, quota_payload, request.tier)
            quota_status = "allowed"
            credit_balance = float(quota["credit_balance"])
            quotas = dict(quota["quotas"])
        except QuotaError as exc:
            quota_status = "blocked"
            quota_detail = str(exc)
    return ToolEstimateResponse(
        module_id=module_id,
        tier=request.tier,
        allowed=tier_allows(request.tier, module_id),
        estimated_credits=0.1 if request.dry_run else estimate_credits(module_id, request.payload),
        credit_estimator=module.credit_estimator,
        queue=module.queue,
        quota_status=quota_status,
        quota_detail=quota_detail,
        credit_balance=credit_balance,
        quotas=quotas,
    )


@router.post("/projects/{project_id}/tools/{module_id}/run", response_model=Job)
def run_project_tool(
    project_id: str,
    module_id: str,
    request: ToolRunRequest | None = Body(default=None),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> Job:
    request = request or ToolRunRequest()
    try:
        return _create_tool_job(module_id, request, principal, project_id=project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/v1/tools/{module_id}/run", response_model=Job)
def run_versioned_tool(
    module_id: str,
    request: ToolRunRequest,
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> Job:
    try:
        return _create_tool_job(module_id, request, principal)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/v1/billing/summary")
def get_billing_summary(principal: CurrentPrincipal = Depends(get_current_principal)) -> dict[str, Any]:
    organization_id = principal.default_organization_id
    require_org_role(principal, organization_id, required="viewer")
    assert organization_id is not None
    return billing_summary(organization_id)


@router.post("/v1/billing/plan")
def update_billing_plan(
    payload: dict[str, str] = Body(...),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> dict[str, Any]:
    organization_id = payload.get("organization_id") or principal.default_organization_id
    require_org_role(principal, organization_id, required="admin")
    assert organization_id is not None
    tier = payload.get("tier") or payload.get("plan_tier")
    if not tier:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="tier is required")
    return set_plan_tier(organization_id, tier)


@router.get("/projects/{project_id}/usage")
def get_project_usage(project_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> dict[str, Any]:
    project = get_project_for_principal(project_id, principal, required_role="viewer")
    if not project.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization context is required")
    summary = billing_summary(project.organization_id)
    return {
        "project_id": project_id,
        "organization_id": project.organization_id,
        "plan_tier": summary["plan_tier"],
        "credit_balance": summary["credit_balance"],
        "monthly_credit_limit": summary["monthly_credit_limit"],
        "ledger": [row for row in summary["ledger"] if row.get("project_id") == project_id],
        "recent_usage": [row for row in summary["recent_usage"] if row.get("project_id") == project_id],
    }


@router.get("/projects/{project_id}/module-runs")
def list_project_module_runs(
    project_id: str,
    limit: int = 50,
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> list[dict[str, Any]]:
    project = get_project_for_principal(project_id, principal, required_role="viewer")
    with session_scope() as session:
        rows = session.scalars(
            select(JobRecord)
            .where(JobRecord.project_id == project.id)
            .where(JobRecord.task_name.like("module:%"))
            .order_by(JobRecord.created_at.desc())
            .limit(max(1, min(limit, 200)))
        ).all()
        payload: list[dict[str, Any]] = []
        for row in rows:
            module_id = _module_id_from_job(row)
            result_path = _module_result_path(project, row)
            result_rel = None
            result_available = False
            if result_path:
                result_available = result_path.is_file()
                try:
                    result_rel = result_path.resolve().relative_to(_project_output_dir(project).resolve()).as_posix()
                except ValueError:
                    result_rel = None
            payload.append(
                {
                    "job_id": row.id,
                    "run_id": row.run_id or row.id,
                    "module_id": module_id,
                    "queue": row.queue,
                    "task_name": row.task_name,
                    "status": row.status,
                    "error": row.error,
                    "output_dir": row.output_dir,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                    "result_available": result_available,
                    "result_path": result_rel,
                }
            )
        return payload


@router.get("/projects/{project_id}/module-runs/{run_id}/result")
def get_project_module_result(
    project_id: str,
    run_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> dict[str, Any]:
    project = get_project_for_principal(project_id, principal, required_role="viewer")
    with session_scope() as session:
        record = session.get(JobRecord, run_id)
        if not record or record.project_id != project.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module run not found")
        result_path = _module_result_path(project, record)
    if not result_path or not result_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module result is not available yet")
    return json.loads(result_path.read_text(encoding="utf-8"))


@router.get("/projects/{project_id}/files/{file_path:path}")
def download_project_file(
    project_id: str,
    file_path: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> FileResponse:
    project = get_project_for_principal(project_id, principal, required_role="viewer")
    target = _project_file(project, file_path)
    return FileResponse(target, filename=target.name)


@router.get("/projects/{project_id}/triage")
def get_project_triage(project_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> dict[str, Any]:
    project = get_project_for_principal(project_id, principal, required_role="viewer")
    project_dir = Path("outputs") / project.name
    board = project_dir / "triage" / "wet_lab_triage_board.csv"
    summary = project_dir / "triage" / "wet_lab_triage_summary.json"
    if not board.exists():
        return {"project_id": project_id, "rows": [], "summary": {"status": "missing", "action": "Run wet_lab_triage_board first."}}
    import pandas as pd

    rows = pd.read_csv(board).head(500).astype(object).where(lambda frame: pd.notna(frame), None).to_dict("records")
    return {
        "project_id": project_id,
        "summary": json.loads(summary.read_text(encoding="utf-8")) if summary.exists() else {},
        "rows": rows,
    }


@router.get("/projects/{project_id}/candidate-evidence")
def get_project_candidate_evidence(project_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> dict[str, Any]:
    project = get_project_for_principal(project_id, principal, required_role="viewer")
    path = Path("outputs") / project.name / "candidate_evidence" / "candidate_evidence_summary.csv"
    if not path.exists():
        return {"project_id": project_id, "rows": [], "summary": {"status": "missing", "action": "Run q_report_and_candidate_dossiers first."}}
    import pandas as pd

    rows = pd.read_csv(path).head(500).astype(object).where(lambda frame: pd.notna(frame), None).to_dict("records")
    return {"project_id": project_id, "rows": rows}


@router.get("/v1/candidates/{candidate_id}/dossier")
def get_candidate_dossier(
    candidate_id: str,
    project_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> dict[str, Any]:
    project = get_project_for_principal(project_id, principal, required_role="viewer")
    dossier = Path("outputs") / project.name / "candidate_dossiers" / f"{candidate_id}.md"
    if not dossier.exists():
        raise HTTPException(status_code=404, detail="Candidate dossier not found")
    return {
        "project_id": project_id,
        "candidate_id": candidate_id,
        "dossier_markdown": dossier.read_text(encoding="utf-8"),
        "claim_boundary": "Computational hypothesis only. Requires biochemical/cellular validation.",
    }
