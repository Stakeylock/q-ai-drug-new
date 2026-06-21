from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from q_ai_drug.service.routes import industrial


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setattr(industrial, "WORKSPACE_DIR", tmp_path / "workspace")
    app = FastAPI()
    app.include_router(industrial.router)
    return TestClient(app)


def test_wet_lab_plan_packet_results_and_audit_loop(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    candidate = {
        "id": "EGFR-QAI-001",
        "target": "EGFR",
        "smiles": "CCO",
        "predicted_activity": 0.84,
        "admet_score": 0.71,
        "uncertainty": 0.22,
        "pose_url": "/artifacts/docking/EGFR-QAI-001_gnina.sdf",
        "evidence_tier": "exploratory_computational",
    }

    plan = client.post("/v1/industrial/wet-lab/assay-plan", json={"candidates": [candidate], "requester": "qa"}).json()

    assert plan["summary"]["candidate_count"] == 1
    assert plan["summary"]["assay_types_per_candidate"] >= 10
    assert plan["candidates"][0]["decision_gate"]["gate"] == "test_now"
    assert any(assay["assay"] == "hERG electrophysiology or binding" for assay in plan["candidates"][0]["assays"])

    packet = client.post("/v1/industrial/wet-lab/assay-packet", json={"candidates": [candidate], "requester": "qa"}).json()

    assert "assay_result_import_template.csv" in packet["exports"]
    assert "benchling_style_registration.csv" in packet["exports"]
    assert "pdbqt_manifest.csv" in packet["exports"]

    result_csv = "candidate_id,assay,endpoint,value,unit,qc_status\nEGFR-QAI-001,Biochemical IC50/Ki,IC50,42,nM,pass\n"
    result = client.post("/v1/industrial/wet-lab/results/import", json={"csv_text": result_csv, "actor": "qa"}).json()

    assert result["imported_rows"] == 1
    assert result["per_candidate"]["EGFR-QAI-001"]["pass"] == 1

    pending = client.post(
        "/v1/industrial/decision-gates",
        json={"candidate_id": "EGFR-QAI-001", "action": "promote_to_wet_lab", "actor": "qa", "reason": "strong research packet"},
    ).json()

    assert pending["status"] == "pending_second_review"

    approved = client.post(
        "/v1/industrial/decision-gates",
        json={
            "candidate_id": "EGFR-QAI-001",
            "action": "promote_to_wet_lab",
            "actor": "qa",
            "second_reviewer": "medchem-lead",
            "reason": "second reviewer approves research assay spend",
        },
    ).json()

    assert approved["status"] == "approved"

    signature = client.post(
        "/v1/industrial/e-signatures",
        json={"report_id": "EGFR-QAI-001-report", "signer": "qa", "report_payload": {"candidate": candidate}},
    ).json()

    assert signature["locked"] is True
    assert signature["payload_hash"]

    audit = client.get("/v1/industrial/audit-log").json()

    assert audit["count"] >= 5
    assert all(row["event_hash"] for row in audit["rows"])


def test_benchmark_readiness_and_feature_matrix(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    benchmark = client.get("/v1/industrial/benchmarks/validation-plan").json()
    features = client.get("/v1/industrial/cheminformatics/feature-matrix").json()
    readiness = client.get("/v1/industrial/readiness").json()

    assert benchmark["target_count"] >= 20
    assert "near-reference inhibitor Tanimoto" in benchmark["time_split_validation"]["leakage_checks"]
    assert any(feature["id"] == "hERG" for feature in features["features"])
    assert "wet-lab assay recommendation engine" in readiness["executable_modules"]
