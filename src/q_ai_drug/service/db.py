from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import time
from typing import Any, Iterator

from pathlib import Path

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, create_engine, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import inspect as sqlalchemy_inspect
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from q_ai_drug.service.settings import get_settings, validate_runtime_settings


class Base(DeclarativeBase):
    pass


class UserRecord(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class OrganizationRecord(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class OrganizationMemberRecord(Base):
    __tablename__ = "organization_members"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(32), default="viewer", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ProjectRecord(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    config_path: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="created", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    runs: Mapped[list["RunRecord"]] = relationship(back_populates="project")


class RunRecord(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="created", index=True)
    stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    output_dir: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    project: Mapped[ProjectRecord] = relationship(back_populates="runs")


class JobRecord(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"), index=True, nullable=True)
    queue: Mapped[str] = mapped_column(String(64), default="default", nullable=False)
    task_name: Mapped[str] = mapped_column(String(128), default="run_cancer_proof", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    output_dir: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    rq_job_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class JobLogRecord(Base):
    __tablename__ = "job_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    level: Mapped[str] = mapped_column(String(32), default="info", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)


class TargetRecord(Base):
    __tablename__ = "targets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    target_id: Mapped[str] = mapped_column(String(64), index=True)
    gene: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class MoleculeRecord(Base):
    __tablename__ = "molecules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    canonical_smiles: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class CandidateRecord(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"), index=True, nullable=True)
    target_id: Mapped[str] = mapped_column(String(64), index=True)
    candidate_id: Mapped[str] = mapped_column(String(128), index=True)
    canonical_smiles: Mapped[str | None] = mapped_column(Text, nullable=True)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    final_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class CandidateScoreRecord(Base):
    __tablename__ = "candidate_scores"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), index=True)
    score_type: Mapped[str] = mapped_column(String(64), index=True)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    method: Mapped[str | None] = mapped_column(String(128), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ModelRecord(Base):
    __tablename__ = "models"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    model_type: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ModelVersionRecord(Base):
    __tablename__ = "model_versions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id"), index=True)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    training_dataset_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    artifact_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="created", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ArtifactRecord(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), index=True, nullable=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"), index=True, nullable=True)
    artifact_type: Mapped[str] = mapped_column(String(128), index=True)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    visibility: Mapped[str] = mapped_column(String(32), default="private", nullable=False)
    storage_backend: Mapped[str] = mapped_column(String(32), default="local", nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ReportRecord(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"), index=True, nullable=True)
    report_type: Mapped[str] = mapped_column(String(128), nullable=False)
    artifact_id: Mapped[str | None] = mapped_column(ForeignKey("artifacts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ApiKeyRecord(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class UsageEventRecord(Base):
    __tablename__ = "usage_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(128), index=True)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class BillingAccountRecord(Base):
    __tablename__ = "billing_accounts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), unique=True, index=True)
    plan_tier: Mapped[str] = mapped_column(String(64), default="student_free", nullable=False)
    credit_balance: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    monthly_credit_limit: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class CreditLedgerRecord(Base):
    __tablename__ = "credit_ledger"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), index=True, nullable=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"), index=True, nullable=True)
    module_id: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    transaction_type: Mapped[str] = mapped_column(String(32), nullable=False)
    credits: Mapped[float] = mapped_column(Float, nullable=False)
    balance_after: Mapped[float] = mapped_column(Float, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


settings = get_settings()
validate_runtime_settings(settings)
if settings.database_url.startswith("sqlite:///"):
    Path(settings.database_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


MONGO_MIRRORED_TABLES = {
    UserRecord.__tablename__,
    OrganizationRecord.__tablename__,
    OrganizationMemberRecord.__tablename__,
    ProjectRecord.__tablename__,
    RunRecord.__tablename__,
    JobRecord.__tablename__,
    JobLogRecord.__tablename__,
    TargetRecord.__tablename__,
    MoleculeRecord.__tablename__,
    CandidateRecord.__tablename__,
    CandidateScoreRecord.__tablename__,
    ModelRecord.__tablename__,
    ModelVersionRecord.__tablename__,
    ArtifactRecord.__tablename__,
    ReportRecord.__tablename__,
    ApiKeyRecord.__tablename__,
    UsageEventRecord.__tablename__,
    BillingAccountRecord.__tablename__,
    CreditLedgerRecord.__tablename__,
}


def _mongo_safe_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, dict):
        return {str(key): _mongo_safe_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_mongo_safe_value(item) for item in value]
    return value


def _mongo_document_from_model(instance: object) -> tuple[str, dict[str, Any]] | None:
    table_name = getattr(instance, "__tablename__", None)
    if table_name not in MONGO_MIRRORED_TABLES:
        return None
    mapper = sqlalchemy_inspect(instance).mapper
    document = {column.key: _mongo_safe_value(getattr(instance, column.key)) for column in mapper.column_attrs}
    if document.get("id") is None:
        return None
    document["_sql_table"] = table_name
    document["_record_class"] = instance.__class__.__name__
    return table_name, document


@event.listens_for(Session, "after_flush")
def _collect_mongo_sync_documents(session: Session, flush_context: object) -> None:
    del flush_context
    pending: dict[tuple[str, Any], tuple[str, dict[str, Any]]] = session.info.setdefault("_mongo_sync_documents", {})
    for instance in list(session.new) + list(session.dirty):
        document = _mongo_document_from_model(instance)
        if document is None:
            continue
        collection_name, payload = document
        pending[(collection_name, payload["id"])] = document


@event.listens_for(Session, "after_commit")
def _sync_mongo_documents_after_commit(session: Session) -> None:
    pending = session.info.pop("_mongo_sync_documents", None)
    if not pending:
        return
    try:
        from q_ai_drug.service import mongo_store

        mongo_store.sync_core_documents(pending.values())
    except Exception:
        # SQL remains the compatibility source of truth; /ready exposes Mongo failures.
        return


@event.listens_for(Session, "after_rollback")
def _discard_mongo_documents_after_rollback(session: Session) -> None:
    session.info.pop("_mongo_sync_documents", None)


def init_database(retries: int = 8, delay_seconds: float = 1.5) -> None:
    last_error: SQLAlchemyError | None = None
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            _repair_sqlite_schema()
            from q_ai_drug.service import mongo_store

            mongo_store.init_mongo_store(required=settings.mongodb_required)
            return
        except SQLAlchemyError as exc:
            last_error = exc
            if attempt == retries:
                break
            time.sleep(delay_seconds)
    if last_error is not None:
        raise last_error


def _repair_sqlite_schema() -> None:
    if engine.dialect.name != "sqlite":
        return
    additive_columns = {
        "projects": {
            "organization_id": "VARCHAR(64)",
            "owner_user_id": "VARCHAR(64)",
            "status": "VARCHAR(32) DEFAULT 'created' NOT NULL",
        },
        "jobs": {
            "run_id": "VARCHAR(64)",
            "queue": "VARCHAR(64) DEFAULT 'default' NOT NULL",
            "task_name": "VARCHAR(128) DEFAULT 'run_cancer_proof' NOT NULL",
            "rq_job_id": "VARCHAR(128)",
            "payload": "JSON",
        },
        "runs": {
            "stage": "VARCHAR(64)",
            "config": "JSON",
        },
        "job_logs": {
            "run_id": "VARCHAR(64)",
            "level": "VARCHAR(32) DEFAULT 'info' NOT NULL",
        },
        "artifacts": {
            "checksum": "VARCHAR(128)",
            "visibility": "VARCHAR(32) DEFAULT 'private' NOT NULL",
            "storage_backend": "VARCHAR(32) DEFAULT 'local' NOT NULL",
            "metadata_json": "JSON",
        },
    }
    with engine.begin() as connection:
        table_names = {row[0] for row in connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'")}
        for table_name, columns in additive_columns.items():
            if table_name not in table_names:
                continue
            existing = {row[1] for row in connection.exec_driver_sql(f"PRAGMA table_info({table_name})")}
            for column_name, column_type in columns.items():
                if column_name not in existing:
                    connection.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
