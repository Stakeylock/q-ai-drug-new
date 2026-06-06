from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from q_ai_drug.service import api


def _auth_client() -> tuple[TestClient, dict[str, str]]:
    client = TestClient(api.app)
    email = f"billing-{uuid.uuid4().hex[:10]}@example.com"
    signup = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": "test-password-123",
            "display_name": "Billing Test",
            "organization_name": f"Billing Org {uuid.uuid4().hex[:6]}",
        },
    )
    assert signup.status_code == 200, signup.text
    token = signup.json()["access_token"]
    return client, {"Authorization": f"Bearer {token}"}


def test_tool_run_reserves_credits_and_records_project_usage():
    client, headers = _auth_client()
    project_response = client.post(
        "/v1/projects",
        json={"name": f"billing_project_{uuid.uuid4().hex[:8]}", "config_path": "configs/cancer_targets.yaml"},
        headers=headers,
    )
    assert project_response.status_code == 200, project_response.text
    project_id = project_response.json()["id"]

    estimate = client.post(
        f"/projects/{project_id}/tools/q_filter/estimate",
        json={"payload": {"molecule_count": 50}, "tier": "student_free", "dry_run": True},
        headers=headers,
    )
    assert estimate.status_code == 200, estimate.text
    assert estimate.json()["quota_status"] == "allowed"
    assert estimate.json()["estimated_credits"] == 0.1

    run = client.post(
        f"/projects/{project_id}/tools/q_filter/run",
        json={"payload": {"molecule_count": 50}, "tier": "student_free", "dry_run": True},
        headers=headers,
    )
    assert run.status_code == 200, run.text
    run_id = run.json()["id"]

    summary = client.get("/v1/billing/summary", headers=headers)
    assert summary.status_code == 200, summary.text
    ledger = summary.json()["ledger"]
    assert any(row["run_id"] == run_id and row["module_id"] == "q_filter" and row["transaction_type"] == "module_reserve" for row in ledger)

    usage = client.get(f"/projects/{project_id}/usage", headers=headers)
    assert usage.status_code == 200, usage.text
    assert any(row["event_type"] == "molecules_requested" for row in usage.json()["recent_usage"])


def test_tool_run_blocks_plan_quota_escape():
    client, headers = _auth_client()
    project_response = client.post(
        "/v1/projects",
        json={"name": f"quota_project_{uuid.uuid4().hex[:8]}", "config_path": "configs/cancer_targets.yaml"},
        headers=headers,
    )
    assert project_response.status_code == 200, project_response.text
    project_id = project_response.json()["id"]

    blocked = client.post(
        f"/projects/{project_id}/tools/q_dock_studio/run",
        json={"payload": {"docking_pairs": 1}, "tier": "academic_researcher", "dry_run": True},
        headers=headers,
    )

    assert blocked.status_code == 402
    assert "exceeds organization plan" in blocked.text or "requires tier" in blocked.text
