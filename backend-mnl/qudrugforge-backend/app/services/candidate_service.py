from typing import Any, Dict, List, Optional

from app.core.exceptions import AppException
from app.repositories.admet_result_repository import admet_result_repository
from app.repositories.docking_result_repository import docking_result_repository
from app.repositories.molecule_repository import molecule_repository
from app.repositories.project_repository import project_repository
from app.repositories.quantum_result_repository import quantum_result_repository
from app.repositories.workspace_repository import workspace_repository


def _as_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _key(doc: Dict[str, Any]) -> str:
    for field in ("compound_id", "molecule_id", "smiles"):
        value = doc.get(field)
        if value:
            return str(value)
    if doc.get("_id"):
        return str(doc["_id"])
    return ""


def _first_number(doc: Optional[Dict[str, Any]], *fields: str) -> Optional[float]:
    if not doc:
        return None
    for field in fields:
        value = _as_float(doc.get(field))
        if value is not None:
            return value
    raw = doc.get("raw") if isinstance(doc.get("raw"), dict) else {}
    for field in fields:
        value = _as_float(raw.get(field))
        if value is not None:
            return value
    return None


class CandidateService:
    async def _authorize_project(self, project_id: str, user_id: str) -> None:
        project = await project_repository.get_project_by_id(project_id)
        if not project:
            raise AppException(status_code=404, code="PROJECT_NOT_FOUND", message="Project not found")
        membership = await workspace_repository.get_membership(str(project["workspace_id"]), user_id)
        if not membership:
            raise AppException(
                status_code=403,
                code="WORKSPACE_ACCESS_DENIED",
                message="User is not an active member of this workspace",
            )

    async def get_ranked_candidates(self, project_id: str, user_id: str, limit: int) -> dict:
        await self._authorize_project(project_id, user_id)

        molecules, molecule_total = await molecule_repository.list_molecules(project_id, limit=max(limit, 100))
        docking, _ = await docking_result_repository.list_results(project_id, limit=500)
        quantum, _ = await quantum_result_repository.list_results(project_id, result_kind="qml_scores", limit=500)
        admet, _ = await admet_result_repository.list_results(project_id, limit=500)

        docking_by_key = {_key(item): item for item in docking if _key(item)}
        quantum_by_key = {_key(item): item for item in quantum if _key(item)}
        admet_by_key = {_key(item): item for item in admet if _key(item)}

        base_rows: List[Dict[str, Any]] = list(molecules)
        if not base_rows:
            base_rows = list(docking)

        items: List[Dict[str, Any]] = []
        for index, row in enumerate(base_rows):
            key = _key(row)
            dock = docking_by_key.get(key)
            qres = quantum_by_key.get(key)
            ares = admet_by_key.get(key)

            binding_affinity = _first_number(dock or row, "binding_affinity_kcal_mol", "binding_energy", "affinity", "score")
            quantum_score = _first_number(qres, "qml_score", "quantum_kernel_score", "quantum_prefilter_score")
            qed = _first_number(row, "qed")
            logp = _first_number(row, "logp")
            mw = _first_number(row, "mw", "molecular_weight")
            risk_score = _first_number(ares, "risk_score", "admet_risk_score")

            ranking_score = 0.0
            if binding_affinity is not None:
                ranking_score += abs(binding_affinity)
            if quantum_score is not None:
                ranking_score += quantum_score * 5
            if qed is not None:
                ranking_score += qed * 2
            if risk_score is not None:
                ranking_score -= risk_score

            molecule_id = str(row.get("_id") or row.get("molecule_id") or row.get("compound_id") or f"candidate-{index + 1}")
            compound_id = str(row.get("compound_id") or row.get("molecule_id") or molecule_id)
            items.append({
                "molecule_id": compound_id,
                "backend_molecule_id": molecule_id,
                "compound_id": compound_id,
                "smiles": row.get("smiles") or "",
                "binding_affinity": binding_affinity if binding_affinity is not None else 0,
                "qed": qed if qed is not None else 0,
                "logp": logp if logp is not None else 0,
                "mw": mw if mw is not None else 0,
                "quantum_score": quantum_score if quantum_score is not None else 0,
                "admet_risk_score": risk_score if risk_score is not None else 0,
                "ranking_score": round(ranking_score, 4),
                "status": row.get("status") or "imported",
            })

        items.sort(key=lambda item: item["ranking_score"], reverse=True)
        return {
            "source": "generated",
            "file": "mongo:molecules+docking+quantum+admet",
            "count": molecule_total or len(items),
            "items": items[:limit],
        }


candidate_service = CandidateService()
