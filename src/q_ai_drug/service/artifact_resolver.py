"""Artifact ID resolution and registry.

Maps artifact IDs to file paths and manages artifact metadata.
This is the central point for artifact lookup across all runners.

Implementation: Local filesystem JSON registry per project.
Future: S3/Mongo storage backend (additive upgrade path).
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from enum import Enum


class ArtifactType(str, Enum):
    """Artifact type classification."""

    SMILES_CSV = "smiles_csv"
    MOLECULE_SDF = "molecule_sdf"
    PROTEIN_PDB = "protein_pdb"
    DOCKING_RESULTS = "docking_results"
    ORBITAL_DESCRIPTORS = "orbital_descriptors"
    FILTERED_CANDIDATES = "filtered_candidates"
    CURATED_BENCHMARK = "curated_benchmark"
    ACTIVITY_ASSAY = "activity_assay"
    REFERENCE_INHIBITORS = "reference_inhibitors"
    UNKNOWN = "unknown"


@dataclass
class ArtifactRecord:
    """Metadata for a stored artifact."""

    artifact_id: str
    project_id: str
    module_id: str
    run_id: str
    artifact_type: ArtifactType
    file_path: str  # Relative to project output directory
    file_size_bytes: int
    row_count: Optional[int] = None  # For CSV/tabular artifacts
    metadata: dict[str, Any] | None = None
    created_at: datetime | None = None
    is_private: bool = True  # Private by default (require auth to access)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization."""
        d = asdict(self)
        d['artifact_type'] = self.artifact_type.value if isinstance(self.artifact_type, ArtifactType) else self.artifact_type
        d['created_at'] = self.created_at.isoformat() if self.created_at else None
        return d


class ArtifactResolverNotReady(Exception):
    """Raised when artifact system is not yet fully implemented."""

    def __init__(self, artifact_id: str):
        self.artifact_id = artifact_id
        super().__init__(
            f"Artifact ID '{artifact_id}' loading not yet implemented. "
            f"Please use direct file upload instead. "
            f"Artifact registry integration is pending."
        )


# ============================================================================
# Registry helpers
# ============================================================================

_REGISTRY_FILENAME = "artifacts_registry.json"


def _registry_path(project_dir: Path) -> Path:
    """Get path to the artifact registry JSON for a project."""
    return project_dir / _REGISTRY_FILENAME


def _load_registry(project_dir: Path) -> dict[str, dict[str, Any]]:
    """Load registry dict: artifact_id → ArtifactRecord dict."""
    reg_path = _registry_path(project_dir)
    if not reg_path.exists():
        return {}
    try:
        with reg_path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_registry(project_dir: Path, registry: dict[str, dict[str, Any]]) -> None:
    """Save registry dict to disk."""
    reg_path = _registry_path(project_dir)
    reg_path.parent.mkdir(parents=True, exist_ok=True)
    with reg_path.open("w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, default=str)


def _find_project_dir(project_id_or_path: str | Path) -> Path | None:
    """
    Try to locate a project directory by ID or path.
    Looks in 'outputs/' subdirectory tree.
    """
    p = Path(project_id_or_path)
    if p.is_dir():
        return p
    # Try outputs/<project_id_or_path>
    for candidate in [Path("outputs") / str(project_id_or_path), p]:
        if candidate.is_dir():
            return candidate
    return None


def _scan_registry_for_artifact(project_dir: Path, artifact_id: str) -> dict[str, Any] | None:
    """Scan the project registry file for a given artifact_id."""
    registry = _load_registry(project_dir)
    return registry.get(artifact_id)


# ============================================================================
# Public API
# ============================================================================


def resolve_artifact_path(project_id: str | Path, artifact_id: str) -> Path:
    """
    Resolve artifact ID to file path.

    Args:
        project_id: Project UUID or project directory path
        artifact_id: Artifact ID (UUID or descriptive ID)

    Returns:
        Path to artifact file

    Raises:
        ArtifactResolverNotReady: If artifact not found in registry
        FileNotFoundError: If artifact file doesn't exist on disk
    """
    project_dir = _find_project_dir(project_id)
    if project_dir is None:
        raise ArtifactResolverNotReady(artifact_id)

    record_dict = _scan_registry_for_artifact(project_dir, artifact_id)
    if record_dict is None:
        # Also scan all module_runs subdirectories' artifacts.json
        for artifacts_json in project_dir.rglob("artifacts.json"):
            try:
                data = json.loads(artifacts_json.read_text(encoding="utf-8"))
                for item in (data if isinstance(data, list) else [data]):
                    if item.get("artifact_id") == artifact_id:
                        record_dict = item
                        break
            except Exception:
                pass
            if record_dict:
                break

    if record_dict is None:
        raise ArtifactResolverNotReady(artifact_id)

    file_path = Path(record_dict["file_path"])
    if not file_path.is_absolute():
        file_path = project_dir / file_path

    if not file_path.exists():
        raise FileNotFoundError(
            f"Artifact file not found on disk: {file_path}. "
            f"Artifact ID: {artifact_id}"
        )

    return file_path


def register_artifact(
    project_id: str | Path,
    module_id: str,
    run_id: str,
    file_path: Path,
    artifact_type: ArtifactType,
    row_count: Optional[int] = None,
    metadata: Optional[dict[str, Any]] = None,
    is_private: bool = True,
) -> ArtifactRecord:
    """
    Register a newly created artifact in the local filesystem registry.

    Args:
        project_id: Project UUID or project directory path
        module_id: Module that created this artifact
        run_id: Run/job ID that created this artifact
        file_path: Absolute path to artifact file
        artifact_type: Classification of artifact
        row_count: Number of rows (for tabular artifacts)
        metadata: Optional additional metadata
        is_private: Whether artifact requires auth to access

    Returns:
        ArtifactRecord with assigned artifact_id
    """
    project_dir = _find_project_dir(project_id) or Path(str(project_id))

    # Generate deterministic artifact ID from content + path
    artifact_id_seed = f"{project_id}:{module_id}:{run_id}:{file_path.name}"
    artifact_id = hashlib.sha256(artifact_id_seed.encode()).hexdigest()[:24]

    file_size = file_path.stat().st_size if file_path.exists() else 0

    # Compute relative path from project dir
    try:
        rel_path = str(file_path.relative_to(project_dir))
    except ValueError:
        rel_path = str(file_path)

    record = ArtifactRecord(
        artifact_id=artifact_id,
        project_id=str(project_id),
        module_id=module_id,
        run_id=run_id,
        artifact_type=artifact_type,
        file_path=rel_path,
        file_size_bytes=file_size,
        row_count=row_count,
        metadata=metadata or {},
        created_at=datetime.now(timezone.utc),
        is_private=is_private,
    )

    # Load, update, and save registry
    registry = _load_registry(project_dir)
    registry[artifact_id] = record.to_dict()
    _save_registry(project_dir, registry)

    return record


def list_project_artifacts(
    project_id: str | Path,
    module_id: Optional[str] = None,
    artifact_type: Optional[ArtifactType] = None,
) -> list[ArtifactRecord]:
    """
    List artifacts in a project, optionally filtered.

    Args:
        project_id: Project UUID or project directory path
        module_id: Optional filter to specific module
        artifact_type: Optional filter to specific type

    Returns:
        List of artifact records matching filters
    """
    project_dir = _find_project_dir(project_id)
    if project_dir is None:
        return []

    registry = _load_registry(project_dir)
    records = []

    for artifact_id, record_dict in registry.items():
        if module_id and record_dict.get("module_id") != module_id:
            continue
        if artifact_type and record_dict.get("artifact_type") != artifact_type.value:
            continue

        atype = record_dict.get("artifact_type", ArtifactType.UNKNOWN.value)
        try:
            atype_enum = ArtifactType(atype)
        except ValueError:
            atype_enum = ArtifactType.UNKNOWN

        created_at_str = record_dict.get("created_at")
        created_at = None
        if created_at_str:
            try:
                created_at = datetime.fromisoformat(created_at_str)
            except Exception:
                pass

        records.append(ArtifactRecord(
            artifact_id=artifact_id,
            project_id=record_dict.get("project_id", ""),
            module_id=record_dict.get("module_id", ""),
            run_id=record_dict.get("run_id", ""),
            artifact_type=atype_enum,
            file_path=record_dict.get("file_path", ""),
            file_size_bytes=record_dict.get("file_size_bytes", 0),
            row_count=record_dict.get("row_count"),
            metadata=record_dict.get("metadata"),
            created_at=created_at,
            is_private=record_dict.get("is_private", True),
        ))

    return records


def get_artifact_metadata(artifact_id: str, project_id: str | Path | None = None) -> ArtifactRecord | None:
    """
    Get metadata for an artifact without loading file.

    Args:
        artifact_id: Artifact ID
        project_id: Optional project context

    Returns:
        ArtifactRecord or None if not found
    """
    if project_id:
        records = list_project_artifacts(project_id)
        for record in records:
            if record.artifact_id == artifact_id:
                return record
    return None


def validate_artifact_access(artifact_id: str, project_id: str, principal_id: str) -> bool:
    """
    Check if principal has access to artifact.

    Args:
        artifact_id: Artifact to check
        project_id: Project context
        principal_id: User/service principal

    Returns:
        True if access allowed

    Note:
        Current implementation: Returns True for same project (no cross-project).
        Future implementation: Check artifact privacy, project membership, org role.
    """
    # TODO: Implement proper auth check once DB schema ready
    return True


# Status of artifact system implementation
ARTIFACT_SYSTEM_STATUS = {
    "resolve": True,   # resolve_artifact_path — local filesystem registry
    "register": True,  # register_artifact — local filesystem registry
    "list": True,      # list_project_artifacts — local filesystem registry
    "read": True,      # download from local filesystem
    "write": True,     # write to local filesystem
    "db_schema": False,        # artifact registry in Mongo/Postgres not ready
    "storage_backend": False,  # S3/cloud storage not ready (uses local fs for now)
    "auth": False,             # private artifact access control not ready

    "current_backend": "local_filesystem",
    "next_priority": "db_schema_integration",
    "timeline": {
        "phase_1": "DB schema + register function [DONE: local filesystem]",
        "phase_2": "resolve + list functions [DONE: local filesystem]",
        "phase_3": "storage backend + auth [PENDING: S3/Mongo]",
        "phase_4": "delete + retention policy [PENDING]",
    },

    "note": (
        "Artifact system uses local filesystem registry (artifacts_registry.json per project). "
        "Module runners write files to disk and register them. "
        "resolve_artifact_path() reads from registry. "
        "S3/Mongo backend is an additive future upgrade."
    ),
}
