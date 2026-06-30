from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEV_ONLY_SECRETS = {
    "qai_dev_password",
    "qaiadmin123",
    "change-me",
    "CHANGE_ME",
    "dev-secret-change-me",
}


@dataclass(frozen=True)
class ServiceSettings:
    app_env: str
    database_url: str
    mongodb_uri: str
    mongodb_database: str
    mongodb_enabled: bool
    mongodb_required: bool
    mongodb_timeout_ms: int
    redis_url: str
    s3_endpoint: str | None
    s3_bucket: str
    s3_access_key_id: str | None
    s3_secret_access_key: str | None
    s3_region: str
    jwt_secret: str
    allowed_origins: str
    max_job_runtime: int
    max_upload_size: int
    use_queue: bool

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


def get_settings() -> ServiceSettings:
    app_env = os.getenv("APP_ENV", "local")
    local_sqlite = f"sqlite:///{Path(os.getenv('QAI_LOCAL_SQLITE_PATH', 'outputs/service_state.sqlite')).as_posix()}"
    mongo_enabled_raw = os.getenv("QAI_MONGO_ENABLED")
    mongo_enabled = (
        mongo_enabled_raw.strip().lower() in {"1", "true", "yes", "on"}
        if mongo_enabled_raw is not None
        else app_env != "production" or bool(os.getenv("MONGODB_URI"))
    )
    mongo_required_raw = os.getenv("QAI_MONGO_REQUIRED")
    mongo_required = (
        mongo_required_raw.strip().lower() in {"1", "true", "yes", "on"}
        if mongo_required_raw is not None
        else app_env == "production" and mongo_enabled
    )
    return ServiceSettings(
        app_env=app_env,
        database_url=os.getenv("DATABASE_URL", local_sqlite),
        mongodb_uri=os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017"),
        mongodb_database=os.getenv("MONGODB_DATABASE", "qai_drug_dev"),
        mongodb_enabled=mongo_enabled,
        mongodb_required=mongo_required,
        mongodb_timeout_ms=int(os.getenv("MONGODB_TIMEOUT_MS", "1200")),
        redis_url=os.getenv("REDIS_URL", "redis://redis:6379/0"),
        s3_endpoint=os.getenv("S3_ENDPOINT"),
        s3_bucket=os.getenv("S3_BUCKET", "qai-artifacts"),
        s3_access_key_id=os.getenv("S3_ACCESS_KEY_ID") or os.getenv("MINIO_ROOT_USER"),
        s3_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY") or os.getenv("MINIO_ROOT_PASSWORD"),
        s3_region=os.getenv("S3_REGION", "us-east-1"),
        jwt_secret=os.getenv("JWT_SECRET", "dev-secret-change-me"),
        allowed_origins=os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000"),
        max_job_runtime=int(os.getenv("MAX_JOB_RUNTIME", "86400")),
        max_upload_size=int(os.getenv("MAX_UPLOAD_SIZE", str(100 * 1024 * 1024))),
        use_queue=os.getenv("QAI_USE_QUEUE", "0").strip().lower() in {"1", "true", "yes"},
    )


def _contains_placeholder(value: str | None) -> bool:
    if not value:
        return False
    upper = value.upper()
    return any(secret.upper() in upper for secret in DEV_ONLY_SECRETS)


def validate_runtime_settings(settings: ServiceSettings | None = None) -> None:
    settings = settings or get_settings()
    if not settings.is_production:
        return
    errors: list[str] = []
    if settings.database_url.startswith("sqlite"):
        errors.append("DATABASE_URL must point to PostgreSQL in production.")
    if _contains_placeholder(settings.jwt_secret) or settings.jwt_secret in DEV_ONLY_SECRETS or len(settings.jwt_secret) < 32:
        errors.append("JWT_SECRET must be a non-default secret with at least 32 characters in production.")
    if "*" in settings.allowed_origins:
        errors.append("ALLOWED_ORIGINS must not contain '*' in production.")
    if not settings.s3_endpoint or _contains_placeholder(settings.s3_endpoint):
        errors.append("S3_ENDPOINT must be configured in production.")
    if (
        not settings.s3_access_key_id
        or not settings.s3_secret_access_key
        or _contains_placeholder(settings.s3_access_key_id)
        or _contains_placeholder(settings.s3_secret_access_key)
    ):
        errors.append("S3 credentials must be configured in production.")
    if _contains_placeholder(settings.database_url) or _contains_placeholder(settings.redis_url):
        errors.append("DATABASE_URL and REDIS_URL must not contain placeholder values in production.")
    if settings.mongodb_required and not settings.mongodb_enabled:
        errors.append("QAI_MONGO_REQUIRED cannot be true when QAI_MONGO_ENABLED is false.")
    if settings.mongodb_enabled and (
        _contains_placeholder(settings.mongodb_uri)
        or "127.0.0.1" in settings.mongodb_uri
        or "localhost" in settings.mongodb_uri
    ):
        errors.append("MONGODB_URI must point to a production MongoDB host when QAI_MONGO_ENABLED is true.")
    if errors:
        raise RuntimeError("Invalid production configuration: " + " ".join(errors))
