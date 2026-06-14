from fastapi import APIRouter, Depends, Path

from app.core.dependencies import get_current_active_user
from app.services.claim_matrix_service import claim_matrix_service


router = APIRouter(prefix="/projects/{project_id}/claim-matrix", tags=["Claim Matrix"])


@router.get("")
async def list_claim_matrix(
    project_id: str = Path(...),
    current_user: dict = Depends(get_current_active_user),
):
    claims, file_doc = await claim_matrix_service.list_claims(project_id, str(current_user["_id"]))
    return {
        "success": True,
        "data": {
            "items": claims,
            "total": len(claims),
            "source_file_id": file_doc.get("file_id") if file_doc else None,
        },
        "message": "Claim matrix fetched",
    }


@router.get("/summary")
async def get_claim_matrix_summary(
    project_id: str = Path(...),
    current_user: dict = Depends(get_current_active_user),
):
    summary = await claim_matrix_service.get_summary(project_id, str(current_user["_id"]))
    return {
        "success": True,
        "data": summary,
        "message": "Claim matrix summary fetched",
    }
