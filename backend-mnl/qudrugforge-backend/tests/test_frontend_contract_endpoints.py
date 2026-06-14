import pytest


@pytest.mark.asyncio
async def test_forgot_password_acknowledges_without_auth(async_client):
    response = await async_client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "scientist@example.com"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["success"] is True
    assert "password reset instructions" in payload["message"]


@pytest.mark.asyncio
async def test_claim_matrix_routes_parse_uploaded_csv(async_client, auth_headers, project):
    csv_bytes = (
        b"claim_id,artifact_name,module_name,claim_boundary,evidence_level,"
        b"wet_lab_required,clinical_restriction,regulatory_status,missing_evidence,enforcement_status\n"
        b"CLAIM_001,top_candidates.csv,qml_reranking,computational_prediction,computational,"
        b"true,research_only,validation_required,no_in_vivo_validation,active\n"
    )
    upload_response = await async_client.post(
        f"/api/v1/projects/{project['id']}/files/upload",
        files={"file": ("scientific_claim_matrix.csv", csv_bytes, "text/csv")},
        data={"file_type": "claim_matrix", "source_module": "claim_matrix"},
        headers=auth_headers,
    )
    assert upload_response.status_code == 200, upload_response.text

    list_response = await async_client.get(
        f"/api/v1/projects/{project['id']}/claim-matrix",
        headers=auth_headers,
    )
    assert list_response.status_code == 200, list_response.text
    data = list_response.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["_id"] == "CLAIM_001"
    assert data["items"][0]["evidence_level"] == "Level 1"
    assert data["items"][0]["current_status"] == "available"

    summary_response = await async_client.get(
        f"/api/v1/projects/{project['id']}/claim-matrix/summary",
        headers=auth_headers,
    )
    assert summary_response.status_code == 200, summary_response.text
    summary = summary_response.json()["data"]
    assert summary["total_claims"] == 1
    assert summary["levels_count"]["Level 1"] == 1


@pytest.mark.asyncio
async def test_project_candidates_route_returns_frontend_shape(
    async_client,
    auth_headers,
    project,
    uploaded_ligands_csv,
):
    import_response = await async_client.post(
        f"/api/v1/projects/{project['id']}/molecules/import",
        json={
            "source_file_id": uploaded_ligands_csv["file_id"],
            "smiles_column": "canonical_smiles",
            "compound_id_column": "compound_id",
        },
        headers=auth_headers,
    )
    assert import_response.status_code == 200, import_response.text

    candidates_response = await async_client.get(
        f"/api/v1/projects/{project['id']}/candidates?limit=3",
        headers=auth_headers,
    )
    assert candidates_response.status_code == 200, candidates_response.text
    data = candidates_response.json()["data"]
    assert data["source"] == "generated"
    assert data["count"] >= 3
    assert len(data["items"]) == 3
    assert {"molecule_id", "binding_affinity", "qed", "logp"}.issubset(data["items"][0].keys())
