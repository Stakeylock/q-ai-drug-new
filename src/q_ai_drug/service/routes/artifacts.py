from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from q_ai_drug.service.access import get_project_for_principal
from q_ai_drug.service.auth import CurrentPrincipal, get_current_principal
from q_ai_drug.service.db import ArtifactRecord, session_scope
from q_ai_drug.service.storage import get_artifact_bytes, presigned_download_url


router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


def _artifact_for_principal(artifact_id: str, principal: CurrentPrincipal) -> ArtifactRecord:
    with session_scope() as session:
        record = session.get(ArtifactRecord, artifact_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
        if record.project_id:
            get_project_for_principal(record.project_id, principal, required_role="viewer")
        session.expunge(record)
        return record


@router.get("/projects/{project_id}/artifacts")
def list_project_artifacts(project_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> list[dict]:
    get_project_for_principal(project_id, principal, required_role="viewer")
    with session_scope() as session:
        rows = (
            session.query(ArtifactRecord)
            .filter(ArtifactRecord.project_id == project_id)
            .order_by(ArtifactRecord.created_at.desc())
            .limit(500)
            .all()
        )
        return [
            {
                "artifact_id": row.id,
                "run_id": row.run_id,
                "artifact_type": row.artifact_type,
                "storage_key": row.storage_key,
                "mime_type": row.mime_type,
                "size_bytes": row.size_bytes,
                "checksum": row.checksum,
                "visibility": row.visibility,
                "storage_backend": row.storage_backend,
                "metadata": row.metadata_json,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]


@router.get("/{artifact_id}")
def artifact_metadata(artifact_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> dict:
    record = _artifact_for_principal(artifact_id, principal)
    return {
        "artifact_id": record.id,
        "project_id": record.project_id,
        "run_id": record.run_id,
        "artifact_type": record.artifact_type,
        "storage_key": record.storage_key,
        "mime_type": record.mime_type,
        "size_bytes": record.size_bytes,
        "checksum": record.checksum,
        "visibility": record.visibility,
        "storage_backend": record.storage_backend,
        "metadata": record.metadata_json,
        "created_at": record.created_at.isoformat(),
    }


@router.get("/{artifact_id}/download")
def download_artifact(artifact_id: str, principal: CurrentPrincipal = Depends(get_current_principal)):
    record = _artifact_for_principal(artifact_id, principal)
    presigned = presigned_download_url(record)
    if presigned:
        return {"download_url": presigned, "expires_seconds": 900}
    data = get_artifact_bytes(record)
    return Response(content=data, media_type=record.mime_type or "application/octet-stream")
