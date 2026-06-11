import logging
from pathlib import Path
from typing import List, Optional, Tuple

import pymongo
from bson import ObjectId

from app.core.exceptions import AppException
from app.repositories.admet_result_repository import admet_result_repository
from app.repositories.experiment_repository import experiment_repository
from app.repositories.molecule_repository import molecule_repository
from app.repositories.project_repository import project_repository
from app.repositories.workspace_repository import workspace_repository
from app.schemas.admet import ALLOWED_ADMET_MODELS
from app.utils.admet_risk import summarize_admet_results
from app.utils.datetime import utc_now

# Pipeline execution
from app.services.pipeline_execution_service import (
    enqueue_module_job,
    get_job_status,
)

logger = logging.getLogger("qudrugforge-admet-service")


class AdmetService:
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

    async def create_admet_run(
        self,
        project_id: str,
        user_id: str,
        source_molecule_set: str,
        molecule_ids: List[str],
        models: List[str],
        name: Optional[str] = None,
        simulate: bool = False,
    ) -> dict:
        project, workspace_id = await self._get_project_and_workspace(project_id, user_id)

        if source_molecule_set not in ("filtered", "top_candidates", "selected"):
            raise AppException(
                status_code=400,
                code="VALIDATION_ERROR",
                message="source_molecule_set must be filtered, top_candidates, or selected",
            )

        invalid_models = [model for model in models if model not in ALLOWED_ADMET_MODELS]
        if invalid_models:
            raise AppException(
                status_code=400,
                code="VALIDATION_ERROR",
                message=f"Unsupported ADMET models: {invalid_models}",
            )

        molecule_count: Optional[int] = None

        if source_molecule_set == "selected":
            if not molecule_ids:
                raise AppException(
                    status_code=400,
                    code="VALIDATION_ERROR",
                    message="molecule_ids must be non-empty when source_molecule_set is selected",
                )

            invalid_ids = []
            for molecule_id in molecule_ids:
                molecule = await molecule_repository.get_molecule_by_id(molecule_id)
                if not molecule or str(molecule.get("project_id")) != project_id:
                    invalid_ids.append(molecule_id)
                    continue
            if invalid_ids:
                raise AppException(
                    status_code=403,
                    code="MOLECULE_ACCESS_DENIED",
                    message=f"Molecules not found or not in this project: {invalid_ids}",
                )
            molecule_count = len(molecule_ids)
        else:
            query = {"project_id": ObjectId(project_id)}
            if source_molecule_set == "filtered":
                query["status"] = {"$in": ["filtered", "selected"]}
            elif source_molecule_set == "top_candidates":
                query["status"] = "selected"
            molecule_count = await molecule_repository.collection.count_documents(query)

        if not name:
            name = f"ADMET Run - {source_molecule_set}"

        now = utc_now()
        exp_doc = {
            "workspace_id": ObjectId(workspace_id),
            "project_id": ObjectId(project_id),
            "name": name,
            "type": "admet",
            "engine": "admet",
            "status": "queued",
            "progress": 0,
            "parameters": {
                "source_molecule_set": source_molecule_set,
                "molecule_ids": molecule_ids,
                "models": models,
                "molecule_count": molecule_count,
            },
            "input_file_ids": [],
            "output_file_ids": [],
            "logs": [
                {
                    "timestamp": now,
                    "level": "info",
                    "message": "ADMET run queued",
                    "stage": "queued",
                    "metadata": {
                        "source_molecule_set": source_molecule_set,
                        "molecule_count": molecule_count,
                        "models": models,
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
            "molecule_count": molecule_count,
            "simulate": simulate,
        }

    async def list_admet_results(
        self,
        project_id: str,
        user_id: str,
        experiment_id: Optional[str] = None,
        risk_level: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[dict], int]:
        await self._get_project_and_workspace(project_id, user_id)
        await admet_result_repository.ensure_indexes()
        return await admet_result_repository.list_results(
            project_id=project_id,
            experiment_id=experiment_id,
            risk_level=risk_level,
            skip=skip,
            limit=limit,
            sort_by="created_at",
            sort_order=pymongo.ASCENDING,
        )

    async def get_admet_summary(self, project_id: str, user_id: str) -> dict:
        await self._get_project_and_workspace(project_id, user_id)
        await admet_result_repository.ensure_indexes()
        items, total = await admet_result_repository.list_results(
            project_id=project_id,
            skip=0,
            limit=10000,
        )
        summary = summarize_admet_results(items, total=total)
        summary["models"] = sorted(ALLOWED_ADMET_MODELS)
        return summary


    async def execute_admet_run(
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
        Execute a queued ADMET run using the q-ai-drug pipeline.

        This enqueues a q_filter module job which runs ADMET risk scoring.
        """
        experiment = await experiment_repository.get_experiment_by_id_and_project(
            experiment_id, project_id
        )
        if not experiment:
            raise AppException(
                status_code=404,
                code="EXPERIMENT_NOT_FOUND",
                message="ADMET experiment not found in this project",
            )
        if experiment.get("type") != "admet":
            raise AppException(
                status_code=404,
                code="EXPERIMENT_NOT_FOUND",
                message="This experiment is not an ADMET run",
            )

        if experiment.get("status") not in ("queued", "failed"):
            raise AppException(
                status_code=400,
                code="INVALID_EXPERIMENT_STATUS",
                message=f"Cannot execute experiment with status '{experiment.get('status')}'",
            )

        params = experiment.get("parameters", {})
        source_molecule_set = params.get("source_molecule_set")
        molecule_ids = params.get("molecule_ids", [])
        models = params.get("models", [])

        project = await project_repository.get_project_by_id(project_id)
        project_name = project.get("name", "project")

        if not config_path:
            config_path = str(Path("configs") / "cancer_targets.yaml")

        if not output_dir:
            output_dir = str(Path("outputs") / project_name)

        workspace_id = str(project.get("workspace_id"))
        membership = await workspace_repository.get_membership(workspace_id, user_id)
        organization_id = str(membership.get("organization_id")) if membership else None

        # Build module payload
        module_payload = {
            "source_molecule_set": source_molecule_set,
            "molecule_ids": molecule_ids,
            "models": models,
            "experiment_id": experiment_id,
        }

        # Enqueue the ADMET module job
        job_id = enqueue_module_job(
            project_id=project_id,
            module_id="q_filter",
            payload=module_payload,
            output_dir=output_dir,
            dry_run=dry_run,
            user_id=user_id,
            organization_id=organization_id,
            experiment_id=experiment_id,
        )

        # Update experiment with job ID and status
        from app.utils.datetime import utc_now
        from bson import ObjectId

        await experiment_repository.collection.update_one(
            {"_id": ObjectId(experiment_id)},
            {"$set": {
                "status": "running",
                "progress": 10,
                "stage": "admet",
                "started_at": utc_now(),
                "q_ai_drug_job_id": job_id,
                "updated_at": utc_now(),
            }}
        )

        await experiment_repository.append_log(experiment_id, {
            "timestamp": utc_now(),
            "level": "info",
            "message": f"ADMET job enqueued: {job_id}",
            "stage": "queued",
            "metadata": {"job_id": job_id, "module": "q_filter"},
        })

        return {
            "experiment_id": experiment_id,
            "job_id": job_id,
            "status": "running",
            "message": "ADMET execution started",
        }

    # ─── Get ADMET Job Status ───────────────────────────────────────────────────

    async def get_admet_job_status(
        self,
        project_id: str,
        experiment_id: str,
        user_id: str,
    ) -> dict:
        """Get the status of an ADMET job."""
        experiment = await experiment_repository.get_experiment_by_id_and_project(
            experiment_id, project_id
        )
        if not experiment:
            raise AppException(
                status_code=404,
                code="EXPERIMENT_NOT_FOUND",
                message="ADMET experiment not found in this project",
            )

        job_id = experiment.get("q_ai_drug_job_id")

        if not job_id:
            return {
                "experiment_id": experiment_id,
                "status": experiment.get("status", "queued"),
                "progress": experiment.get("progress", 0),
                "stage": experiment.get("stage"),
                "job_status": "not_started",
            }

        job_status = get_job_status(job_id)

        # Sync experiment status with job status
        job_state = job_status.get("status", "unknown")
        if job_state == "finished":
            new_status = "completed"
            progress = 100
        elif job_state == "failed":
            new_status = "failed"
            progress = 50
        elif job_state == "started":
            new_status = "running"
            progress = experiment.get("progress", 50)
        else:
            new_status = experiment.get("status", "queued")
            progress = experiment.get("progress", 0)

        if new_status != experiment.get("status"):
            from app.utils.datetime import utc_now
            from bson import ObjectId
            await experiment_repository.collection.update_one(
                {"_id": ObjectId(experiment_id)},
                {"$set": {
                    "status": new_status,
                    "progress": progress,
                    "updated_at": utc_now(),
                    **({"completed_at": utc_now()} if new_status in ("completed", "failed") else {}),
                }}
            )

        return {
            "experiment_id": experiment_id,
            "job_id": job_id,
            "status": new_status,
            "progress": progress,
            "stage": experiment.get("stage"),
            "job_status": job_state,
            "job_result": job_status.get("result"),
            "job_error": job_status.get("exc_info"),
        }


admet_service = AdmetService()
