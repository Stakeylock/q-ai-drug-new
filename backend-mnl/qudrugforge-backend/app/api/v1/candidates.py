from fastapi import APIRouter, Depends, Path, Query

from app.core.dependencies import get_current_active_user
from app.services.candidate_service import candidate_service


router = APIRouter(prefix="/projects/{project_id}/candidates", tags=["Candidates"])


@router.get("")
async def get_project_candidates(
    project_id: str = Path(...),
    limit: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    data = await candidate_service.get_ranked_candidates(project_id, str(current_user["_id"]), limit)
    return {
        "success": True,
        "data": data,
        "message": "Ranked project candidates fetched",
    }
