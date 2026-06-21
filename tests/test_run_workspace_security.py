from __future__ import annotations

from fastapi.testclient import TestClient

from q_ai_drug.service import api
from q_ai_drug.service.routes import runs as runs_routes


def test_run_workspace_events_require_creation_token(tmp_path, monkeypatch):
    monkeypatch.setattr(runs_routes, "WORKSPACE_DIR", tmp_path / "workspace")
    client = TestClient(api.app)

    created = client.post("/v1/runs", json={"user_id": "alice", "inputs": {"case_id": "DEID-1"}})
    assert created.status_code == 200, created.text
    payload = created.json()
    run_id = payload["run_id"]
    token = payload["event_token"]
    assert token
    assert "event_token_hash" not in payload["manifest"]

    forged = client.post(
        f"/v1/runs/{run_id}/events?user_id=alice",
        json={"module": "03_docking", "event": "forged", "status": "info", "message": "should not write"},
    )
    assert forged.status_code == 403

    appended = client.post(
        f"/v1/runs/{run_id}/events?user_id=alice",
        headers={"X-QDF-Run-Token": token},
        json={"module": "03_docking", "event": "pose_written", "status": "completed", "message": "GNINA pose stored."},
    )
    assert appended.status_code == 200, appended.text

    hidden = client.get(f"/v1/runs/{run_id}/workspace-manifest?user_id=alice")
    assert hidden.status_code == 403

    manifest = client.get(f"/v1/runs/{run_id}/workspace-manifest?user_id=alice", headers={"X-QDF-Run-Token": token})
    assert manifest.status_code == 200, manifest.text
    assert "event_token_hash" not in manifest.json()

    events = client.get(f"/v1/runs/{run_id}/workspace-events?user_id=alice", headers={"X-QDF-Run-Token": token})
    assert events.status_code == 200, events.text
    assert any(row["event"] == "pose_written" for row in events.json()["events"])
