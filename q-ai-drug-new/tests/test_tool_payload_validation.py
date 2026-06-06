"""Tests for tool payload validation and credit handling on invalid payloads."""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from q_ai_drug.service.tasks import run_module_task
from q_ai_drug.service.db import ProjectRecord, session_scope

def test_run_module_task_fails_invalid_payload_and_refunds(monkeypatch):
    """If payload is invalid and module execution fails immediately, reserved credits must be refunded."""
    
    # We will simulate the tasks.py run_module_task flow.
    # We need a dummy project to exist in the database.
    from q_ai_drug.service.db import ProjectRecord
    import uuid
    from datetime import datetime
    
    project_id = str(uuid.uuid4())
    org_id = "org_invalid_payload"
    
    with session_scope() as session:
        from q_ai_drug.service.billing import ensure_billing_account
        ensure_billing_account(org_id, "student_free")
        
        project = ProjectRecord(
            id=project_id,
            name="test_proj_invalid",
            organization_id=org_id,
            owner_user_id="user_123",
            config_path="configs/cancer_targets.yaml",
            created_at=datetime.now(timezone.utc)
        )
        session.add(project)
        session.commit()
    
    payload = {
        "project_id": project_id,
        "module_id": "q_filter",
        "payload": {
            # Completely missing required files to trigger validation error in execute_module
            "candidate_upload_file": "missing.csv"
        }
    }
    
    # Execute the task; it should gracefully fail and commit actual_credits=0.0, refunding the reserved 0.1
    run_module_task("job_invalid_1", payload)
        
    # Verify that a refund was issued in the ledger
    with session_scope() as session:
        from q_ai_drug.service.db import CreditLedgerRecord
        refund_row = session.query(CreditLedgerRecord).filter(
            CreditLedgerRecord.run_id == "job_invalid_1",
            CreditLedgerRecord.transaction_type == "credit_refund"
        ).first()
        assert refund_row is not None, "A credit_refund ledger record must be created when task execution fails"
        assert refund_row.credits < 0, "Refunded credits should be negative in the ledger"
