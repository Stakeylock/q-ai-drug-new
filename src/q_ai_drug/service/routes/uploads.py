from __future__ import annotations

import io
import json
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from q_ai_drug.service.access import get_project_for_principal
from q_ai_drug.service.auth import CurrentPrincipal, get_current_principal
from q_ai_drug.service.db import MoleculeRecord, session_scope
from q_ai_drug.service.input_validation import validate_upload_bytes
from q_ai_drug.service.models import UploadResponse
from q_ai_drug.service.settings import get_settings
from q_ai_drug.service.storage import put_artifact_bytes
from q_ai_drug.service.usage import record_usage


router = APIRouter(tags=["uploads"])

ALLOWED_SUFFIXES = {".csv", ".smi", ".sdf", ".pdb", ".pdbqt", ".yaml", ".yml"}
TYPE_BY_SUFFIX = {
    ".csv": "smiles_csv",
    ".smi": "smiles_file",
    ".sdf": "ligand_sdf",
    ".pdb": "receptor_pdb",
    ".pdbqt": "pdbqt",
    ".yaml": "target_config_yaml",
    ".yml": "target_config_yaml",
}


def _infer_artifact_type(filename: str, explicit: str | None) -> str:
    if explicit:
        return explicit
    suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return TYPE_BY_SUFFIX.get(suffix, "user_upload")


def _validate_filename(filename: str) -> None:
    suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported upload type: {suffix or 'unknown'}")


def _ingest_smiles(project_id: str, data: bytes) -> int:
    frame = pd.read_csv(io.BytesIO(data))
    smiles_column = next((column for column in frame.columns if column.lower() in {"smiles", "canonical_smiles"}), None)
    if not smiles_column:
        return 0
    rows = []
    now = datetime.now(timezone.utc)
    for _, row in frame.head(100_000).iterrows():
        smiles = str(row.get(smiles_column) or "").strip()
        if not smiles:
            continue
        rows.append(
            MoleculeRecord(
                id=str(uuid.uuid4()),
                project_id=project_id,
                canonical_smiles=smiles,
                source="user_upload",
                metadata_json=json.loads(
                    json.dumps({key: None if pd.isna(value) else value for key, value in row.to_dict().items()}, default=str)
                ),
                created_at=now,
            )
        )
    if rows:
        with session_scope() as session:
            session.add_all(rows)
    return len(rows)


@router.post("/projects/{project_id}/uploads", response_model=UploadResponse)
async def upload_project_artifact(
    project_id: str,
    file: UploadFile = File(...),
    artifact_type: str | None = Form(default=None),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> UploadResponse:
    project = get_project_for_principal(project_id, principal, required_role="researcher")
    filename = file.filename or "upload.bin"
    _validate_filename(filename)
    data = await file.read()
    if len(data) > get_settings().max_upload_size:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Upload exceeds MAX_UPLOAD_SIZE")
    inferred_type = _infer_artifact_type(filename, artifact_type)
    quality_card = validate_upload_bytes(data, filename=filename, artifact_type=inferred_type)
    try:
        artifact = put_artifact_bytes(
            data,
            filename=filename,
            artifact_type=inferred_type,
            project_id=project.id,
            mime_type=file.content_type,
            visibility="private",
            metadata={"quality_card": quality_card, "source": "user_upload"},
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Object storage upload failed: {exc}") from exc
    molecule_count = _ingest_smiles(project.id, data) if inferred_type in {"smiles_csv", "smiles_file"} else 0
    record_usage(
        "artifact_uploaded",
        1,
        user_id=principal.user_id,
        organization_id=project.organization_id,
        project_id=project.id,
        metadata={"artifact_type": inferred_type, "size_bytes": len(data)},
    )
    if molecule_count:
        record_usage(
            "molecules_uploaded",
            molecule_count,
            user_id=principal.user_id,
            organization_id=project.organization_id,
            project_id=project.id,
        )
    return UploadResponse(
        artifact_id=artifact.id,
        artifact_type=artifact.artifact_type,
        storage_key=artifact.storage_key,
        mime_type=artifact.mime_type,
        size_bytes=artifact.size_bytes,
        checksum=artifact.checksum,
        molecule_records=molecule_count,
        quality_card=quality_card,
    )


@router.post("/v1/projects/{project_id}/molecules/upload", response_model=UploadResponse)
@router.post("/projects/{project_id}/uploads/molecules", response_model=UploadResponse)
async def upload_molecules(
    project_id: str,
    file: UploadFile = File(...),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> UploadResponse:
    return await upload_project_artifact(project_id, file, "smiles_csv", principal)


@router.post("/v1/projects/{project_id}/proteins/upload", response_model=UploadResponse)
@router.post("/projects/{project_id}/uploads/receptor", response_model=UploadResponse)
async def upload_receptor(
    project_id: str,
    file: UploadFile = File(...),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> UploadResponse:
    return await upload_project_artifact(project_id, file, "receptor_structure", principal)


@router.post("/projects/{project_id}/uploads/target-config", response_model=UploadResponse)
async def upload_target_config(
    project_id: str,
    file: UploadFile = File(...),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> UploadResponse:
    return await upload_project_artifact(project_id, file, "target_config_yaml", principal)


@router.post("/v1/projects/{project_id}/assays/upload", response_model=UploadResponse)
async def upload_assay_csv(
    project_id: str,
    file: UploadFile = File(...),
    principal: CurrentPrincipal = Depends(get_current_principal),
) -> UploadResponse:
    return await upload_project_artifact(project_id, file, "assay_csv", principal)
