from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from q_ai_drug.service.routes import ai_models


def test_docking_visual_qa_accepts_viewer_data_uri(monkeypatch):
    monkeypatch.setattr(ai_models, "_dgemma_api_key", lambda: None)
    monkeypatch.setattr(ai_models, "_medgemma_base_url", lambda: None)
    app = FastAPI()
    app.include_router(ai_models.router)
    client = TestClient(app)
    image_url = "data:image/png;base64," + ("A" * 12000)

    response = client.post(
        "/v1/vision/docking-review",
        json={
            "candidate_id": "KRAS-QAI-001",
            "target": "KRAS",
            "pose_source": "GNINA CNN docked pose",
            "receptor_url": "/artifacts/receptors/KRAS.pdb",
            "ligand_url": "/artifacts/realtime_docking/KRAS/KRAS-QAI-001/KRAS-QAI-001_gnina.sdf",
            "image_url": image_url,
            "notes": "Regression test for browser 3Dmol screenshot data URI.",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "deterministic-visual-qa-fallback"
    assert "Visual QA fallback for KRAS-QAI-001" in payload["answer"]
