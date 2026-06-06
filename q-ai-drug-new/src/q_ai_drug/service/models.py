from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(default="cancer_proof_v1")
    config_path: str = Field(default="configs/cancer_targets.yaml")
    organization_id: str | None = None


class Project(BaseModel):
    id: str
    name: str
    config_path: str
    organization_id: str | None = None
    owner_user_id: str | None = None
    created_at: datetime


class JobCreate(BaseModel):
    project_id: str
    max_records_per_target: int | None = 750
    n_generate: int | None = 500
    skip_download: bool = False
    dry_run: bool = False


class Job(BaseModel):
    id: str
    project_id: str
    status: Literal["created", "queued", "running", "succeeded", "failed", "cancelled"]
    output_dir: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class ModelPredictRequest(BaseModel):
    target_id: Literal["EGFR", "PARP1", "PIK3CA"] = "EGFR"
    smiles: str = Field(min_length=1, max_length=500)


class SignupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)
    display_name: str | None = Field(default=None, max_length=255)
    organization_name: str = Field(default="Default Organization", max_length=255)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    organization_id: str | None = None
    role: str | None = None


class ApiKeyCreate(BaseModel):
    name: str = Field(default="default", min_length=1, max_length=255)
    organization_id: str | None = None


class ApiKeyCreated(BaseModel):
    id: str
    name: str
    api_key: str
    organization_id: str | None = None
    created_at: datetime


class ApiKeyView(BaseModel):
    id: str
    name: str
    organization_id: str | None = None
    revoked_at: datetime | None = None
    created_at: datetime


class CurrentUserView(BaseModel):
    user_id: str
    email: str
    organizations: list[dict]


class UploadResponse(BaseModel):
    artifact_id: str
    artifact_type: str
    storage_key: str
    mime_type: str | None = None
    size_bytes: int | None = None
    checksum: str | None = None
    molecule_records: int = 0
    quality_card: dict | None = None


class ToolRunRequest(BaseModel):
    project_id: str | None = None
    payload: dict = Field(default_factory=dict)
    dry_run: bool = False
    tier: str = "student_free"
    compute_depth: str | None = None


class ToolEstimateResponse(BaseModel):
    module_id: str
    tier: str
    allowed: bool
    estimated_credits: float
    credit_estimator: str
    queue: str
    quota_status: str | None = None
    quota_detail: str | None = None
    credit_balance: float | None = None
    quotas: dict | None = None
