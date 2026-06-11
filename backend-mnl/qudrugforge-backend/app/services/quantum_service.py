import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pymongo
from bson import ObjectId

from app.core.exceptions import AppException
from app.repositories.experiment_repository import experiment_repository
from app.repositories.project_repository import project_repository
from app.repositories.quantum_result_repository import quantum_result_repository
from app.repositories.workspace_repository import workspace_repository
from app.utils.datetime import utc_now

# Pipeline execution
from app.services.pipeline_execution_service import (
    enqueue_module_job,
    get_job_status,
)

logger = logging.getLogger("qudrugforge-quantum-service")


class QuantumService:
    async def _check_workspace_access(self, workspace_id: str, user_id: str) -> dict:
        membership = await workspace_repository.get_membership(workspace_id, user_id)
        if not membership:
            raise AppException(
                status_code=403,
                code="WORKSPACE_ACCESS_DENIED",
                message="User is not an active member of this workspace",
            )
        return membership

    async def _get_project_and_workspace(
        self, project_id: str, user_id: str
    ) -> Tuple[dict, str]:
        project = await project_repository.get_project_by_id(project_id)
        if not project:
            raise AppException(
                status_code=404,
                code="PROJECT_NOT_FOUND",
                message="Project not found",
            )
        workspace_id = str(project["workspace_id"])
        await self._check_workspace_access(workspace_id, user_id)
        return project, workspace_id

    async def create_quantum_run(
        self,
        project_id: str,
        user_id: str,
        source_experiment_id: str,
        parameters: Dict[str, Any],
        name: Optional[str] = None,
        simulate: bool = False,
    ) -> dict:
        project, workspace_id = await self._get_project_and_workspace(project_id, user_id)

        source_exp = await experiment_repository.get_experiment_by_id_and_project(
            source_experiment_id, project_id
        )
        if not source_exp:
            raise AppException(
                status_code=404,
                code="SOURCE_EXPERIMENT_NOT_FOUND",
                message=f"Source experiment '{source_experiment_id}' not found in this project",
            )

        source_type = source_exp.get("type")
        if source_type not in ("gnina", "docking"):
            raise AppException(
                status_code=400,
                code="SOURCE_EXPERIMENT_INVALID",
                message="source_experiment_id must reference a GNINA or docking experiment",
            )

        if str(source_exp.get("workspace_id")) != workspace_id:
            raise AppException(
                status_code=403,
                code="WORKSPACE_ACCESS_DENIED",
                message="Source experiment does not belong to this workspace",
            )

        if not name:
            name = f"Quantum/QML Run - {source_exp.get('name', source_experiment_id)}"

        now = utc_now()
        exp_doc = {
            "workspace_id": ObjectId(workspace_id),
            "project_id": ObjectId(project_id),
            "name": name,
            "type": "quantum",
            "engine": "qml",
            "status": "queued",
            "progress": 0,
            "parameters": {
                "source_experiment_id": source_experiment_id,
                "source_experiment_type": source_type,
                "quantum_parameters": parameters,
            },
            "input_file_ids": list(source_exp.get("output_file_ids", [])),
            "output_file_ids": [],
            "logs": [
                {
                    "timestamp": now,
                    "level": "info",
                    "message": "Quantum/QML run queued",
                    "stage": "queued",
                    "metadata": {
                        "source_experiment_id": source_experiment_id,
                        "source_experiment_type": source_type,
                    },
                }
            ],
            "q_ai_drug_job_id": None,
            "q_ai_drug_run_name": None,
            "import_id": None,
            "error": None,
            "started_at": None,
            "completed_at": None,
            "created_by": ObjectId(user_id),
            "created_at": now,
            "updated_at": now,
        }

        await experiment_repository.ensure_indexes()
        created = await experiment_repository.create_experiment(exp_doc)

        return {
            "experiment": created,
            "source_experiment": source_exp,
            "source_experiment_type": source_type,
            "simulate": simulate,
        }

    async def list_quantum_results(
        self,
        project_id: str,
        user_id: str,
        experiment_id: Optional[str] = None,
        result_kind: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[dict], int]:
        await self._get_project_and_workspace(project_id, user_id)

        sort_by = "created_at"
        sort_order = pymongo.ASCENDING
        if result_kind == "prefilter":
            sort_by = "quantum_prefilter_score"
            sort_order = pymongo.DESCENDING
        elif result_kind == "reranking":
            sort_by = "quantum_rank"
            sort_order = pymongo.ASCENDING
        elif result_kind == "qml_scores":
            sort_by = "quantum_kernel_score"
            sort_order = pymongo.DESCENDING

        await quantum_result_repository.ensure_indexes()
        return await quantum_result_repository.list_results(
            project_id=project_id,
            experiment_id=experiment_id,
            result_kind=result_kind,
            skip=skip,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    # ─── Execute Quantum Run ────────────────────────────────────────────────────

    async def execute_quantum_run(
        self,
        project_id: str,
        experiment_id: str,
        user_id: str,
        *,
        config_path: Optional[str] = None,
        output_dir: Optional[str] = None,
        dry_run: bool = False,
    ) -> dict:
        """
        Execute a queued quantum/QML run using the q-ai-drug pipeline.

        This enqueues a q_orbital_analyzer (QM) and/or q_portfolio_prefilter (QML)
        module job depending on the parameters.
        """
        # Get the experiment to validate and get parameters
        from app.repositories.experiment_repository import experiment_repository
        experiment = await experiment_repository.get_experiment_by_id_and_project(
            experiment_id, project_id
        )
        if not experiment:
            raise AppException(
                status_code=404,
                code="EXPERIMENT_NOT_FOUND",
                message="Quantum experiment not found in this project",
            )
        if experiment.get("type") != "quantum":
            raise AppException(
                status_code=404,
                code="EXPERIMENT_NOT_FOUND",
                message="This experiment is not a quantum run",
            )

        if experiment.get("status") not in ("queued", "failed"):
            raise AppException(
                status_code=400,
                code="INVALID_EXPERIMENT_STATUS",
                message=f"Cannot execute experiment with status '{experiment.get('status')}'",
            )

        params = experiment.get("parameters", {})
        source_experiment_id = params.get("source_experiment_id")
        quantum_params = params.get("quantum_parameters", {})

        # Get project for config path and output dir
        project = await project_repository.get_project_by_id(project_id)
        project_name = project.get("name", "project")

        if not config_path:
            config_path = str(Path("configs") / "cancer_targets.yaml")

        if not output_dir:
            output_dir = str(Path("outputs") / project_name)

        # Get user/org IDs for billing
        workspace_id = str(project.get("workspace_id"))
        membership = await workspace_repository.get_membership(workspace_id, user_id)
        organization_id = str(membership.get("organization_id")) if membership else None

        # Determine which module(s) to run based on parameters
        run_qm = quantum_params.get("run_qm", True)
        run_qml = quantum_params.get("run_qml", True)

        job_ids = []

        if run_qm:
            # Enqueue QM module
            module_payload = {
                "source_experiment_id": source_experiment_id,
                "quantum_parameters": quantum_params,
                "experiment_id": experiment_id,
                "run_qm_only": True,
            }

            job_id = enqueue_module_job(
                project_id=project_id,
                module_id="q_orbital_analyzer",
                payload=module_payload,
                output_dir=output_dir,
                dry_run=dry_run,
                user_id=user_id,
                organization_id=organization_id,
                experiment_id=experiment_id,
            )
            job_ids.append(("qm", job_id))

        if run_qml:
            # Enqueue QML module
            module_payload = {
                "source_experiment_id": source_experiment_id,
                "quantum_parameters": quantum_params,
                "experiment_id": experiment_id,
                "run_qml_only": True,
            }

            job_id = enqueue_module_job(
                project_id=project_id,
                module_id="q_portfolio_prefilter",
                payload=module_payload,
                output_dir=output_dir,
                dry_run=dry_run,
                user_id=user_id,
                organization_id=organization_id,
                experiment_id=experiment_id,
            )
            job_ids.append(("qml", job_id))

        # Update experiment with job IDs and status
        from app.utils.datetime import utc_now
        from bson import ObjectId

        primary_job_id = job_ids[0][1] if job_ids else None

        await experiment_repository.collection.update_one(
            {"_id": ObjectId(experiment_id)},
            {"$set": {
                "status": "running",
                "progress": 10,
                "stage": "quantum",
                "started_at": utc_now(),
                "q_ai_drug_job_id": primary_job_id,
                "q_ai_drug_job_ids": {k: v for k, v in job_ids},
                "updated_at": utc_now(),
            }}
        )

        await experiment_repository.append_log(experiment_id, {
            "timestamp": utc_now(),
            "level": "info",
            "message": f"Quantum jobs enqueued: {job_ids}",
            "stage": "queued",
            "metadata": {"job_ids": job_ids},
        })

        return {
            "experiment_id": experiment_id,
            "job_ids": {k: v for k, v in job_ids},
            "status": "running",
            "message": "Quantum/QML execution started",
        }

    # ─── Get Quantum Job Status ─────────────────────────────────────────────────

    async def get_quantum_job_status(
        self,
        project_id: str,
        experiment_id: str,
        user_id: str,
    ) -> dict:
        """Get the status of quantum/QML jobs."""
        from app.repositories.experiment_repository import experiment_repository
        experiment = await experiment_repository.get_experiment_by_id_and_project(
            experiment_id, project_id
        )
        if not experiment:
            raise AppException(
                status_code=404,
                code="EXPERIMENT_NOT_FOUND",
                message="Quantum experiment not found in this project",
            )

        job_ids = experiment.get("q_ai_drug_job_ids", {})
        primary_job_id = experiment.get("q_ai_drug_job_id")

        job_statuses = {}
        overall_status = experiment.get("status", "queued")
        overall_progress = experiment.get("progress", 0)
        completed_count = 0
        failed_count = 0

        for job_type, job_id in job_ids.items():
            status = get_job_status(job_id)
            job_state = status.get("status", "unknown")
            job_statuses[job_type] = {
                "job_id": job_id,
                "status": job_state,
                "result": status.get("result"),
                "error": status.get("exc_info"),
            }

            if job_state == "finished":
                completed_count += 1
            elif job_state == "failed":
                failed_count += 1

        # Determine overall status
        if failed_count > 0:
            overall_status = "failed"
            overall_progress = 50
        elif completed_count == len(job_ids) and len(job_ids) > 0:
            overall_status = "completed"
            overall_progress = 100
        elif len(job_ids) > 0:
            overall_status = "running"
            overall_progress = 50

        # Sync experiment status
        if overall_status != experiment.get("status"):
            from app.utils.datetime import utc_now
            from bson import ObjectId
            await experiment_repository.collection.update_one(
                {"_id": ObjectId(experiment_id)},
                {"$set": {
                    "status": overall_status,
                    "progress": overall_progress,
                    "updated_at": utc_now(),
                    **({"completed_at": utc_now()} if overall_status in ("completed", "failed") else {}),
                }}
            )

        return {
            "experiment_id": experiment_id,
            "job_ids": job_ids,
            "job_statuses": job_statuses,
            "status": overall_status,
            "progress": overall_progress,
            "stage": experiment.get("stage"),
        }


quantum_service = QuantumService()
