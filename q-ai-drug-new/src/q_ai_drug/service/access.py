from __future__ import annotations

from fastapi import HTTPException, status

from q_ai_drug.service.auth import CurrentPrincipal, ROLE_RANK
from q_ai_drug.service.db import ProjectRecord, session_scope


def role_at_least(role: str | None, required: str) -> bool:
    return ROLE_RANK.get(role or "", 0) >= ROLE_RANK[required]


def require_org_role(principal: CurrentPrincipal, organization_id: str | None, required: str = "viewer") -> None:
    if organization_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization context is required")
    if not role_at_least(principal.organizations.get(organization_id), required):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient organization role")


def get_project_for_principal(project_id: str, principal: CurrentPrincipal, required_role: str = "viewer") -> ProjectRecord:
    with session_scope() as session:
        project = session.get(ProjectRecord, project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        if project.owner_user_id == principal.user_id:
            return project
        if project.organization_id and role_at_least(principal.organizations.get(project.organization_id), required_role):
            return project
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project is not accessible")


def choose_organization(principal: CurrentPrincipal, requested_organization_id: str | None, required_role: str = "researcher") -> str:
    organization_id = requested_organization_id or principal.default_organization_id
    require_org_role(principal, organization_id, required_role)
    assert organization_id is not None
    return organization_id
