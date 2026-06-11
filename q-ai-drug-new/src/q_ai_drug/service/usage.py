from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from q_ai_drug.service.db import ProjectRecord, UsageEventRecord, session_scope


def record_usage(
    event_type: str,
    quantity: float = 1.0,
    *,
    user_id: str | None = None,
    organization_id: str | None = None,
    project_id: str | None = None,
    run_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    with session_scope() as session:
        if project_id and not organization_id:
            project = session.get(ProjectRecord, project_id)
            if project:
                organization_id = project.organization_id
                user_id = user_id or project.owner_user_id
        session.add(
            UsageEventRecord(
                id=str(uuid.uuid4()),
                organization_id=organization_id,
                user_id=user_id,
                project_id=project_id,
                run_id=run_id,
                event_type=event_type,
                quantity=float(quantity),
                metadata_json=metadata,
                created_at=datetime.now(timezone.utc),
            )
        )
