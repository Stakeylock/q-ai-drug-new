from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from q_ai_drug.service.db import ArtifactRecord, session_scope
from q_ai_drug.service.settings import get_settings


@dataclass(frozen=True)
class StoredArtifact:
    artifact_id: str
    storage_key: str
    checksum: str
    size_bytes: int


def _safe_name(filename: str) -> str:
    return "".join(ch if ch.isalnum() or ch in {"-", "_", "."} else "_" for ch in filename).strip("._") or "artifact.bin"


def _local_object_root() -> Path:
    root = Path("outputs/object_storage")
    root.mkdir(parents=True, exist_ok=True)
    return root


def _s3_client():
    settings = get_settings()
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
    )


def _use_s3() -> bool:
    settings = get_settings()
    return bool(settings.s3_endpoint and settings.s3_access_key_id and settings.s3_secret_access_key)


def put_artifact_bytes(
    data: bytes,
    *,
    filename: str,
    artifact_type: str,
    project_id: str | None,
    run_id: str | None = None,
    mime_type: str | None = None,
    visibility: str = "private",
    metadata: dict | None = None,
) -> ArtifactRecord:
    settings = get_settings()
    artifact_id = str(uuid.uuid4())
    checksum = hashlib.sha256(data).hexdigest()
    visibility = "public" if visibility == "public" else "private"
    storage_key = "/".join(
        part
        for part in [
            visibility,
            "projects",
            project_id or "global",
            "runs",
            run_id or "unassigned",
            artifact_type,
            f"{artifact_id}-{_safe_name(filename)}",
        ]
        if part
    )
    if _use_s3():
        client = _s3_client()
        try:
            client.head_bucket(Bucket=settings.s3_bucket)
        except Exception:
            client.create_bucket(Bucket=settings.s3_bucket)
        client.put_object(Bucket=settings.s3_bucket, Key=storage_key, Body=data, ContentType=mime_type or "application/octet-stream")
        storage_backend = "s3"
    else:
        path = _local_object_root() / storage_key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        storage_backend = "local"
    with session_scope() as session:
        record = ArtifactRecord(
            id=artifact_id,
            project_id=project_id,
            run_id=run_id,
            artifact_type=artifact_type,
            storage_key=storage_key,
            mime_type=mime_type,
            size_bytes=len(data),
            checksum=checksum,
            visibility=visibility,
            storage_backend=storage_backend,
            metadata_json=metadata,
            created_at=datetime.now(timezone.utc),
        )
        session.add(record)
        session.flush()
        session.expunge(record)
        return record


def get_artifact_bytes(record: ArtifactRecord) -> bytes:
    settings = get_settings()
    if _use_s3():
        response = _s3_client().get_object(Bucket=settings.s3_bucket, Key=record.storage_key)
        return response["Body"].read()
    return (_local_object_root() / record.storage_key).read_bytes()


def presigned_download_url(record: ArtifactRecord, expires_seconds: int = 900) -> str | None:
    settings = get_settings()
    if not _use_s3():
        return None
    return _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": record.storage_key},
        ExpiresIn=expires_seconds,
    )
