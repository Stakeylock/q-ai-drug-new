from __future__ import annotations

import time
import uuid

from fastapi.testclient import TestClient

from q_ai_drug.service import api


def _auth_client() -> tuple[TestClient, dict[str, str]]:
    client = TestClient(api.app)
    email = f"module-console-{uuid.uuid4().hex[:10]}@example.com"
    signup = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": "test-password-123",
            "display_name": "Module Console Test",
            "organization_name": f"Module Console Org {uuid.uuid4().hex[:6]}",
        },
    )
    assert signup.status_code == 200, signup.text
    return client, {"Authorization": f"Bearer {signup.json()['access_token']}"}


def test_module_console_can_read_run_result_and_project_file() -> None:
    client, headers = _auth_client()
    project_response = client.post(
        "/v1/projects",
        json={"name": f"module_console_project_{uuid.uuid4().hex[:8]}", "config_path": "configs/cancer_targets.yaml"},
        headers=headers,
    )
    assert project_response.status_code == 200, project_response.text
    project_id = project_response.json()["id"]

    run_response = client.post(
        f"/projects/{project_id}/tools/q_filter/run",
        json={"payload": {"molecule_count": 12}, "tier": "student_free", "dry_run": True},
        headers=headers,
    )
    assert run_response.status_code == 200, run_response.text
    run_id = run_response.json()["id"]

    job = run_response.json()
    for _ in range(30):
        if job["status"] in {"succeeded", "failed", "cancelled"}:
            break
        time.sleep(0.2)
        job_response = client.get(f"/jobs/{run_id}", headers=headers)
        assert job_response.status_code == 200, job_response.text
        job = job_response.json()
    assert job["status"] == "succeeded", job

    runs = client.get(f"/projects/{project_id}/module-runs", headers=headers)
    assert runs.status_code == 200, runs.text
    assert any(row["job_id"] == run_id and row["result_available"] for row in runs.json())

    result = client.get(f"/projects/{project_id}/module-runs/{run_id}/result", headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["module_id"] == "q_filter"
    assert result.json()["status"] == "succeeded"

    project_file = client.get(f"/projects/{project_id}/files/module_runs/q_filter/{run_id}/module_result.json", headers=headers)
    assert project_file.status_code == 200, project_file.text
    assert project_file.json()["module_id"] == "q_filter"

