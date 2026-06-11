import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId

from app.core.exceptions import AppException
from app.repositories.experiment_repository import experiment_repository
from app.repositories.file_metadata_repository import file_metadata_repository
from app.repositories.project_repository import project_repository
from app.repositories.simulation_result_repository import simulation_result_repository
from app.repositories.workspace_repository import workspace_repository
from app.services.file_service import file_service
from app.utils.datetime import utc_now
from app.utils.simulation_stability import (
    build_simulation_result_payload,
    classify_stability,
    compute_stability_score,
    extract_chart_time,
)

# Pipeline execution
from app.services.pipeline_execution_service import (
    enqueue_module_job,
    get_job_status,
)


logger = logging.getLogger("qudrugforge-simulation-service")


class SimulationService:
    async def _check_workspace_access(self, workspace_id: str, user_id: str) -> dict:
        membership = await workspace_repository.get_membership(workspace_id, user_id)
        if not membership:
            raise AppException(
                status_code=403,
                code="WORKSPACE_ACCESS_DENIED",
                message="User is not an active member of this workspace",
            )
        return membership

    async def _get_project_and_workspace(self, project_id: str, user_id: str) -> Tuple[dict, str]:
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

    async def create_simulation_run(
        self,
        project_id: str,
        user_id: str,
        simulation_type: str,
        engine: str,
        source_experiment_id: Optional[str],
        parameters: Dict[str, Any],
        name: Optional[str] = None,
        simulate: bool = False,
    ) -> dict:
        project, workspace_id = await self._get_project_and_workspace(project_id, user_id)

        source_experiment = None
        source_experiment_type = None
        if source_experiment_id:
            source_experiment = await experiment_repository.get_experiment_by_id_and_project(
                source_experiment_id, project_id
            )
            if not source_experiment:
                raise AppException(
                    status_code=404,
                    code="SOURCE_EXPERIMENT_NOT_FOUND",
                    message=f"Source experiment '{source_experiment_id}' not found in this project",
                )

            source_experiment_type = source_experiment.get("type")
            if source_experiment_type not in {"docking", "gnina", "quantum"}:
                raise AppException(
                    status_code=400,
                    code="SOURCE_EXPERIMENT_INVALID",
                    message="source_experiment_id must reference a docking, GNINA, or quantum experiment",
                )

            if str(source_experiment.get("workspace_id")) != workspace_id:
                raise AppException(
                    status_code=403,
                    code="WORKSPACE_ACCESS_DENIED",
                    message="Source experiment does not belong to this workspace",
                )

        if not name:
            if source_experiment_id:
                name = f"Simulation Run - {source_experiment.get('name', source_experiment_id)}"
            else:
                name = "Simulation Run"

        now = utc_now()
        exp_doc = {
            "workspace_id": ObjectId(workspace_id),
            "project_id": ObjectId(project_id),
            "name": name,
            "type": "simulation",
            "engine": engine,
            "status": "queued",
            "progress": 0,
            "parameters": {
                "simulation_type": simulation_type,
                "source_experiment_id": source_experiment_id,
                "source_experiment_type": source_experiment_type,
                "simulation_parameters": parameters,
            },
            "input_file_ids": list(source_experiment.get("output_file_ids", [])) if source_experiment else [],
            "output_file_ids": [],
            "logs": [
                {
                    "timestamp": now,
                    "level": "info",
                    "message": "Simulation run queued",
                    "stage": "queued",
                    "metadata": {
                        "simulation_type": simulation_type,
                        "engine": engine,
                        "source_experiment_id": source_experiment_id,
                        "source_experiment_type": source_experiment_type,
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
            "source_experiment": source_experiment,
            "source_experiment_type": source_experiment_type,
            "simulate": simulate,
        }

    async def list_simulation_results(
        self,
        project_id: str,
        user_id: str,
        experiment_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[dict], int]:
        await self._get_project_and_workspace(project_id, user_id)
        await simulation_result_repository.ensure_indexes()
        return await simulation_result_repository.list_results(
            project_id=project_id,
            experiment_id=experiment_id,
            skip=skip,
            limit=limit,
        )

    async def get_simulation_stability(
        self,
        project_id: str,
        user_id: str,
        experiment_id: Optional[str] = None,
    ) -> dict:
        await self._get_project_and_workspace(project_id, user_id)
        await simulation_result_repository.ensure_indexes()
        items, total = await simulation_result_repository.list_results(
            project_id=project_id,
            experiment_id=experiment_id,
            skip=0,
            limit=10000,
        )

        stable = moderate = unstable = unknown = 0
        warning = imported = 0
        stability_class_counts: Dict[str, int] = {}
        scored_items: List[dict] = []
        chart_data: List[dict] = []
        rmsd_values: List[float] = []
        rmsf_values: List[float] = []

        for index, item in enumerate(items, start=1):
            enriched = build_simulation_result_payload(item)
            scored_items.append(enriched)

            score = enriched.get("stability_score")

            rmsd_value = enriched.get("rmsd_avg")
            if rmsd_value is not None:
                rmsd_values.append(float(rmsd_value))

            rmsf_value = enriched.get("rmsf_avg")
            if rmsf_value is not None:
                rmsf_values.append(float(rmsf_value))

            stability_class = enriched.get("stability_class") or classify_stability(score)
            stability_class_counts[stability_class] = stability_class_counts.get(stability_class, 0) + 1
            if stability_class == "stable":
                stable += 1
            elif stability_class == "moderate":
                moderate += 1
            elif stability_class == "unstable":
                unstable += 1
            else:
                unknown += 1

            chart_data.append(
                {
                    "frame_index": index,
                    "time": extract_chart_time(item, index),
                    "rmsd": rmsd_value,
                    "rmsf": rmsf_value,
                    "stability_score": score,
                    "stability_class": stability_class,
                    "trajectory_file_id": enriched.get("trajectory_file_id"),
                    "experiment_id": enriched.get("experiment_id"),
                }
            )

        warning = moderate
        imported = unknown

        scored_items.sort(
            key=lambda item: (
                float(item.get("stability_score") or item.get("md_stability_score") or 0.0),
                -(float(item.get("rmsd_avg") or item.get("rmsd") or 0.0)),
            ),
            reverse=True,
        )

        rmsd_avg = (sum(rmsd_values) / len(rmsd_values)) if rmsd_values else None
        rmsf_avg = (sum(rmsf_values) / len(rmsf_values)) if rmsf_values else None
        stability_score = compute_stability_score(rmsd_avg=rmsd_avg, rmsf_avg=rmsf_avg)
        stability_class = classify_stability(stability_score)

        return {
            "total": total,
            "stable": stable,
            "warning": warning,
            "moderate": moderate,
            "unstable": unstable,
            "imported": imported,
            "unknown": unknown,
            "average_md_stability_score": stability_score,
            "average_rmsd": rmsd_avg,
            "average_rmsf": rmsf_avg,
            "rmsd_avg": rmsd_avg,
            "rmsd_max": max(rmsd_values) if rmsd_values else None,
            "rmsf_avg": rmsf_avg,
            "rmsf_max": max(rmsf_values) if rmsf_values else None,
            "stability_score": stability_score,
            "stability_class": stability_class,
            "stability_class_counts": stability_class_counts,
            "chart_data": chart_data,
            "top_candidates": scored_items[:10],
        }

    async def list_simulation_trajectories(
        self,
        project_id: str,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[dict], int]:
        await self._get_project_and_workspace(project_id, user_id)
        await file_metadata_repository.ensure_indexes()
        return await file_metadata_repository.list_metadata_by_project(
            project_id=project_id,
            file_type="simulation_trajectory",
            source_module="simulations",
            skip=skip,
            limit=limit,
        )

    async def get_simulation_trajectory_file_metadata(
        self,
        project_id: str,
        user_id: str,
        file_id: str,
    ) -> dict:
        await self._get_project_and_workspace(project_id, user_id)

        metadata = await file_metadata_repository.get_metadata_by_file_id(file_id)
        if not metadata:
            raise AppException(
                status_code=404,
                code="FILE_NOT_FOUND",
                message=f"Trajectory file '{file_id}' not found",
            )

        if str(metadata.get("project_id")) != project_id:
            raise AppException(
                status_code=403,
                code="FILE_ACCESS_DENIED",
                message="Trajectory file does not belong to this project",
            )

        await file_service.get_file_download_path(file_id, user_id)
        return metadata


    async def get_simulation_trajectory_by_file_id(
        self,
        project_id: str,
        user_id: str,
        file_id: str,
    ) -> dict:
        return await self.get_simulation_trajectory_file_metadata(
            project_id=project_id,
            user_id=user_id,
            file_id=file_id,
        )

    # ─── Execute Simulation Run ─────────────────────────────────────────────────

    async def execute_simulation_run(
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
        Execute a queued simulation run using the q-ai-drug pipeline.

        This enqueues a ligand_pose_relaxation module job which runs
        OpenMM ligand-pose relaxation (short MD).
        """
        experiment = await experiment_repository.get_experiment_by_id_and_project(
            experiment_id, project_id
        )
        if not experiment:
            raise AppException(
                status_code=404,
                code="EXPERIMENT_NOT_FOUND",
                message="Simulation experiment not found in this project",
            )
        if experiment.get("type") != "simulation":
            raise AppException(
                status_code=404,
                code="EXPERIMENT_NOT_FOUND",
                message="This experiment is not a simulation run",
            )

        if experiment.get("status") not in ("queued", "failed"):
            raise AppException(
                status_code=400,
                code="INVALID_EXPERIMENT_STATUS",
                message=f"Cannot execute experiment with status '{experiment.get('status')}'",
            )

        params = experiment.get("parameters", {})
        source_experiment_id = params.get("source_experiment_id")
        simulation_params = params.get("simulation_parameters", {})

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
            "source_experiment_id": source_experiment_id,
            "simulation_parameters": simulation_params,
            "experiment_id": experiment_id,
        }

        # Enqueue the simulation module job
        job_id = enqueue_module_job(
            project_id=project_id,
            module_id="ligand_pose_relaxation",
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
                "stage": "simulation",
                "started_at": utc_now(),
                "q_ai_drug_job_id": job_id,
                "updated_at": utc_now(),
            }}
        )

        await experiment_repository.append_log(experiment_id, {
            "timestamp": utc_now(),
            "level": "info",
            "message": f"Simulation job enqueued: {job_id}",
            "stage": "queued",
            "metadata": {"job_id": job_id, "module": "ligand_pose_relaxation"},
        })

        return {
            "experiment_id": experiment_id,
            "job_id": job_id,
            "status": "running",
            "message": "Simulation execution started",
        }

    # ─── Get Simulation Job Status ──────────────────────────────────────────────

    async def get_simulation_job_status(
        self,
        project_id: str,
        experiment_id: str,
        user_id: str,
    ) -> dict:
        """Get the status of a simulation job."""
        experiment = await experiment_repository.get_experiment_by_id_and_project(
            experiment_id, project_id
        )
        if not experiment:
            raise AppException(
                status_code=404,
                code="EXPERIMENT_NOT_FOUND",
                message="Simulation experiment not found in this project",
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


simulation_service = SimulationService()