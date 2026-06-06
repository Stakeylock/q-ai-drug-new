"""Tests for billing commit and refund functions."""
from __future__ import annotations

import pytest

from q_ai_drug.service.billing import (
    ensure_billing_account,
    credit_commit,
    credit_refund,
    billing_summary,
    QuotaError
)

def test_credit_commit_refunds_unused(monkeypatch):
    """If actual credits < reserved, the difference should be refunded."""
    import uuid
    org_id = f"org_{uuid.uuid4().hex}"
    
    # Setup account with initial 100 credits
    account = ensure_billing_account(org_id, "student_free")
    
    res = credit_commit(
        org_id,
        run_id="run1",
        module_id="test_module",
        actual_credits=5.0,
        reserved_credits=10.0
    )
    
    assert res["status"] == "committed"
    assert res["delta"] == -5.0
    assert res["refunded"] == 5.0
    assert res["additional_charged"] == 0.0

    summary = billing_summary(org_id)
    assert summary["credit_balance"] == 105.0


def test_credit_commit_charges_additional(monkeypatch):
    """If actual credits > reserved, the difference should be charged."""
    import uuid
    org_id = f"org_{uuid.uuid4().hex}"
    account = ensure_billing_account(org_id, "student_free")
    
    res = credit_commit(
        org_id,
        run_id="run2",
        module_id="test_module",
        actual_credits=15.0,
        reserved_credits=10.0
    )
    
    assert res["status"] == "committed"
    assert res["delta"] == 5.0
    assert res["refunded"] == 0.0
    assert res["additional_charged"] == 5.0

    summary = billing_summary(org_id)
    assert summary["credit_balance"] == 95.0


def test_credit_refund_on_failure(monkeypatch):
    """Test credit_refund directly restores balance."""
    import uuid
    org_id = f"org_{uuid.uuid4().hex}"
    account = ensure_billing_account(org_id, "student_free")
    
    res = credit_refund(
        org_id,
        run_id="run3",
        module_id="test_module",
        refund_amount=10.0,
        reason="execution_failed"
    )
    
    assert res["status"] == "refunded"
    assert res["refunded"] == 10.0

    summary = billing_summary(org_id)
    assert summary["credit_balance"] == 110.0
