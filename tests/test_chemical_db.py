from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from q_ai_drug.service.routes import chemistry


def test_chemical_db_registers_route_card_and_handoff(tmp_path, monkeypatch):
    monkeypatch.setattr(chemistry, "OUTPUT_DIR", tmp_path / "outputs")
    app = FastAPI()
    app.include_router(chemistry.router)
    client = TestClient(app)

    response = client.post(
        "/v1/chemistry/chemical-db/register",
        json={
            "candidate_id": "EGFR-QAI-900",
            "target": "EGFR",
            "smiles": "CC(=O)Nc1ccc(F)cc1",
            "synthesis_status": "analytical_passed",
            "analytical_status": "passed",
            "docking_status": "completed",
            "evidence": {
                "canonical_smiles": "CC(=O)Nc1ccc(F)cc1",
                "gnina_status": "completed",
                "gnina_pose_sdf_url": "/artifacts/realtime_docking/EGFR/EGFR-QAI-900/pose.sdf",
                "default_pose_source": "gnina",
            },
            "wet_lab_assays": ["biochemical IC50/Ki", "hERG risk screen"],
        },
    )

    assert response.status_code == 200
    record = response.json()
    assert record["docking_gate"]["gate"] == "passed_primary_docking"
    assert record["wet_lab_ready"] is True
    assert record["route_card_url"].endswith(".md")
    assert "non-executable planning support" in record["synthesis_route_card"]["claim_boundary"]

    listing = client.get("/v1/chemistry/chemical-db").json()
    assert listing["count"] == 1
    assert listing["ready_for_wet_lab"] == 1

    handoff = client.post(f"/v1/chemistry/chemical-db/{record['chemical_id']}/handoff").json()
    assert handoff["wet_lab_ready"] is True
    assert "analytical release certificate" in handoff["required_package"]
