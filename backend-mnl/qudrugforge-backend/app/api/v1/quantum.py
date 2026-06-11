import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Path, Query

from app.core.dependencies import get_current_active_user
from app.schemas.quantum import CreateQuantumRunRequest, ExecuteQuantumRunRequest, QuantumResultItem
from app.services.job_simulation_service import run_experiment_simulation
from app.services.quantum_service import quantum_service

logger = logging.getLogger("qudrugforge-quantum-api")

router = APIRouter(prefix="/projects/{project_id}/quantum", tags=["Quantum/QML"])


@router.post("/runs", response_model=None)
async def create_quantum_run(
    background_tasks: BackgroundTasks,
    project_id: str = Path(...),
    body: CreateQuantumRunRequest = Body(...),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Queue a Quantum/QML run from a completed docking or GNINA experiment.

    This creates only the local experiment scaffold. Heavy descriptor/QML work is
    not executed synchronously.
    """
    user_id = str(current_user["_id"])

    result = await quantum_service.create_quantum_run(
        project_id=project_id,
        user_id=user_id,
        source_experiment_id=body.source_experiment_id,
        parameters=body.parameters.model_dump(),
        name=body.name,
        simulate=body.simulate,
    )

    experiment = result["experiment"]
    experiment_id = str(experiment["_id"])

    if body.simulate:
        background_tasks.add_task(run_experiment_simulation, experiment_id)

    return {
        "success": True,
        "data": {
            "experiment_id": experiment_id,
            "status": experiment.get("status", "queued"),
            "name": experiment.get("name"),
            "engine": experiment.get("engine", "qml"),
            "source_experiment_id": body.source_experiment_id,
            "source_experiment_type": result["source_experiment_type"],
        },
        "message": "Quantum/QML run queued",
    }


async def _list_quantum_result_kind(
    project_id: str,
    user_id: str,
    result_kind: str,
    experiment_id: Optional[str],
    limit: int,
    offset: int,
):
    items, total = await quantum_service.list_quantum_results(
        project_id=project_id,
        user_id=user_id,
        experiment_id=experiment_id,
        result_kind=result_kind,
        skip=offset,
        limit=limit,
    )
    serialized = []
    for item in items:
        try:
            serialized.append(QuantumResultItem.from_mongo(item).model_dump())
        except Exception as exc:
            logger.warning("Failed to serialize quantum result %s: %s", item.get("_id"), exc)

    return {
        "items": serialized,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/descriptors", response_model=None)
async def list_quantum_descriptors(
    project_id: str = Path(...),
    experiment_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_active_user),
):
    user_id = str(current_user["_id"])
    data = await _list_quantum_result_kind(
        project_id, user_id, "descriptors", experiment_id, limit, offset
    )
    return {"success": True, "data": data, "message": "Quantum descriptors fetched"}


@router.get("/qml-scores", response_model=None)
async def list_qml_scores(
    project_id: str = Path(...),
    experiment_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_active_user),
):
    user_id = str(current_user["_id"])
    data = await _list_quantum_result_kind(
        project_id, user_id, "qml_scores", experiment_id, limit, offset
    )
    return {"success": True, "data": data, "message": "QML scores fetched"}


@router.get("/reranking", response_model=None)
async def list_quantum_reranking(
    project_id: str = Path(...),
    experiment_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_active_user),
):
    user_id = str(current_user["_id"])
    data = await _list_quantum_result_kind(
        project_id, user_id, "reranking", experiment_id, limit, offset
    )
    return {"success": True, "data": data, "message": "Quantum reranking fetched"}


@router.get("/prefilter", response_model=None)
async def list_quantum_prefilter(
    project_id: str = Path(...),
    experiment_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_active_user),
):
    user_id = str(current_user["_id"])
    data = await _list_quantum_result_kind(
        project_id, user_id, "prefilter", experiment_id, limit, offset
    )
    return {"success": True, "data": data, "message": "Quantum prefilter fetched"}


# ─── POST /quantum/runs/{experiment_id}/execute ─────────────────────────────────

@router.post("/runs/{experiment_id}/execute", response_model=None)
async def execute_quantum_run(
    project_id: str = Path(...),
    experiment_id: str = Path(...),
    body: ExecuteQuantumRunRequest = Body(...),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Execute a queued quantum/QML run.

    This enqueues q_orbital_analyzer (QM descriptors) and/or
    q_portfolio_prefilter (QML prefilter) module jobs.
    """
    user_id = str(current_user["_id"])

    result = await quantum_service.execute_quantum_run(
        project_id=project_id,
        experiment_id=experiment_id,
        user_id=user_id,
        config_path=body.config_path,
        output_dir=body.output_dir,
        dry_run=body.dry_run,
    )

    return {
        "success": True,
        "data": result,
        "message": "Quantum/QML execution started",
    }


# ─── GET /quantum/runs/{experiment_id}/job-status ───────────────────────────────

@router.get("/runs/{experiment_id}/job-status", response_model=None)
async def get_quantum_job_status(
    project_id: str = Path(...),
    experiment_id: str = Path(...),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get the status of quantum/QML jobs.

    Returns the experiment status synced with the RQ job queue status.
    """
    user_id = str(current_user["_id"])

    result = await quantum_service.get_quantum_job_status(
        project_id=project_id,
        experiment_id=experiment_id,
        user_id=user_id,
    )

    return {
        "success": True,
        "data": result,
        "message": "Quantum job status fetched",
    }
