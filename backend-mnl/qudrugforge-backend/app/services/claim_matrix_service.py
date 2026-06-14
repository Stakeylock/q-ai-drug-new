from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.core.exceptions import AppException
from app.repositories.file_metadata_repository import file_metadata_repository
from app.repositories.project_repository import project_repository
from app.repositories.workspace_repository import workspace_repository
from app.storage.service import storage_service
from app.utils.csv_import import parse_csv_to_dicts


CLAIM_MATRIX_FILENAMES = {"scientific_claim_matrix.csv", "claim_matrix.csv"}
DEFAULT_LEVEL_COUNTS = {"Level 0": 0, "Level 1": 0, "Level 2": 0, "Level 3": 0}


def _iso(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if value:
        return str(value)
    return ""


def _get(row: Dict[str, Any], *keys: str, default: Any = "") -> Any:
    lowered = {str(key).lower(): value for key, value in row.items()}
    for key in keys:
        if key in row:
            return row[key]
        lowered_value = lowered.get(key.lower())
        if lowered_value not in (None, ""):
            return lowered_value
    return default


def _humanize(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text.replace("_", " ").replace("-", " ").title()


def _normalize_level(value: Any, boundary: Any = "") -> str:
    text = str(value or boundary or "").strip().lower()
    if text in {"level 0", "0", "simulated", "hypothesis_only"}:
        return "Level 0"
    if text in {"level 1", "1", "computational", "computational_prediction", "exploratory_research_only"}:
        return "Level 1"
    if text in {"level 2", "2", "hybrid", "benchmarked", "benchmark_reference", "preclinical_candidate"}:
        return "Level 2"
    if text in {"level 3", "3", "experimental_reference", "wet_lab_validated", "validated_experimental_evidence"}:
        return "Level 3"
    return _humanize(value) or "Level 0"


def _normalize_status(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text in {"active", "available", "approved", "investor_safe", "non_regulated_research"}:
        return "available"
    if text in {"pending_review", "validation_required", "restricted", "preclinical", "partial"}:
        return "partial"
    if text in {"blocked", "prohibited", "unsupported_claim", "deprecated", "unavailable"}:
        return "unavailable"
    return text or "unavailable"


def _allowed_claim(boundary: Any, policy: Any) -> str:
    boundary_text = str(boundary or "").strip()
    policy_text = str(policy or "").strip()
    if boundary_text:
        return _humanize(boundary_text)
    if policy_text:
        return _humanize(policy_text)
    return "Computational research claim only"


def _forbidden_claim(restriction: Any, wet_lab_required: Any) -> str:
    restriction_text = str(restriction or "").strip()
    if restriction_text:
        return _humanize(restriction_text)
    required_text = str(wet_lab_required or "").strip().lower()
    if required_text in {"true", "1", "yes"}:
        return "Clinical or therapeutic validation claim"
    return "Unsupported clinical claim"


class ClaimMatrixService:
    async def _authorize_project(self, project_id: str, user_id: str) -> dict:
        project = await project_repository.get_project_by_id(project_id)
        if not project:
            raise AppException(status_code=404, code="PROJECT_NOT_FOUND", message="Project not found")

        workspace_id = str(project["workspace_id"])
        membership = await workspace_repository.get_membership(workspace_id, user_id)
        if not membership:
            raise AppException(
                status_code=403,
                code="WORKSPACE_ACCESS_DENIED",
                message="User is not an active member of this workspace",
            )
        return project

    async def _find_latest_claim_matrix_file(self, project_id: str) -> Optional[dict]:
        items, _ = await file_metadata_repository.list_metadata_by_project(
            project_id=project_id,
            skip=0,
            limit=500,
        )
        for item in items:
            filename = str(item.get("original_filename") or "").lower()
            file_type = str(item.get("file_type") or "").lower()
            rel_source = str((item.get("metadata") or {}).get("relative_source_path") or "").lower()
            local_path = str(item.get("local_path") or "").lower()
            if (
                filename in CLAIM_MATRIX_FILENAMES
                or file_type == "claim_matrix"
                or rel_source in CLAIM_MATRIX_FILENAMES
                or local_path.endswith("scientific_claim_matrix.csv")
                or local_path.endswith("claim_matrix.csv")
            ):
                return item
        return None

    def _normalize_claim(self, row: Dict[str, Any], project_id: str, index: int, created_at: str) -> dict:
        boundary = _get(row, "claim_boundary", "allowed_claim", "communication_policy")
        evidence = _get(row, "evidence_level", "level", default=boundary)
        artifact = _get(row, "artifact_name", "artifact", "file", "report_id")
        module = _get(row, "module_name", "module", "source_module")
        name = _get(row, "name", "claim_name", "claim_id")
        definition = _get(row, "definition", "description")

        if not name:
            pieces = [piece for piece in (module, artifact, boundary) if piece]
            name = " / ".join(str(piece) for piece in pieces) or f"Claim {index + 1}"

        if not definition:
            if artifact or module:
                definition = f"{_humanize(module) or 'Pipeline'} policy for {_humanize(artifact) or 'artifact'}."
            else:
                definition = "Scientific communication boundary for generated research evidence."

        status = _normalize_status(_get(row, "current_status", "status", "enforcement_status", "regulatory_status"))

        return {
            "_id": str(_get(row, "_id", "claim_id", default=f"{project_id}-claim-{index + 1}")),
            "project_id": project_id,
            "evidence_level": _normalize_level(evidence, boundary),
            "name": str(name),
            "definition": str(definition),
            "current_status": status,
            "allowed_claim": str(_get(row, "allowed_claim", default=_allowed_claim(boundary, _get(row, "communication_policy")))),
            "forbidden_claim": str(
                _get(
                    row,
                    "forbidden_claim",
                    default=_forbidden_claim(_get(row, "clinical_restriction"), _get(row, "wet_lab_required")),
                )
            ),
            "required_next_evidence": str(
                _get(row, "required_next_evidence", "required_next_validation", "missing_evidence", default="wet_lab_validation")
            ),
            "created_at": str(_get(row, "created_at", default=created_at)),
        }

    async def list_claims(self, project_id: str, user_id: str) -> Tuple[List[dict], Optional[dict]]:
        await self._authorize_project(project_id, user_id)
        file_doc = await self._find_latest_claim_matrix_file(project_id)
        if not file_doc:
            return [], None

        provider = storage_service.get_provider()
        if not await provider.exists(file_doc["local_path"]):
            raise AppException(
                status_code=404,
                code="FILE_MISSING_ON_STORAGE",
                message="Claim matrix metadata exists, but the file is missing on storage.",
            )

        resolved_path = await provider.get_file_path(file_doc["local_path"])
        rows = parse_csv_to_dicts(Path(resolved_path))
        created_at = _iso(file_doc.get("created_at"))
        claims = [self._normalize_claim(row, project_id, idx, created_at) for idx, row in enumerate(rows)]
        return claims, file_doc

    async def get_summary(self, project_id: str, user_id: str) -> dict:
        claims, _ = await self.list_claims(project_id, user_id)
        level_counts = dict(DEFAULT_LEVEL_COUNTS)
        level_counts.update(Counter(claim["evidence_level"] for claim in claims))
        status_counts = dict(Counter(claim["current_status"] for claim in claims))
        return {
            "total_claims": len(claims),
            "levels_count": level_counts,
            "status_counts": status_counts,
        }


claim_matrix_service = ClaimMatrixService()
