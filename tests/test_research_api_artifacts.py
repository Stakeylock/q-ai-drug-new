from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from q_ai_drug.service import api
from q_ai_drug.service.routes import chemistry as chemistry_routes


def _write_text(path: Path, text: str = "x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_top_candidates_fill_assets_and_pose_sources(tmp_path, monkeypatch):
    project = tmp_path / "project"
    _write_text(project / "assets" / "ligands_png" / "C1.png", "png")
    _write_text(project / "assets" / "ligands_sdf" / "C1.sdf", "sdf")
    _write_text(project / "assets" / "ligands_smi" / "C1.smi", "CCO")
    _write_text(project / "docking" / "poses" / "EGFR" / "C1" / "C1_docked.sdf", "sdf")
    (project / "top_candidates.csv").write_text(
        "\n".join(
            [
                "target_id,candidate_id,canonical_smiles,final_score,target_rank,png_path,sdf_path,docked_sdf_path,docking_status,docking_mode,vina_affinity_kcal_mol",
                f"EGFR,C1,CCO,0.91,1,,,{project / 'docking' / 'poses' / 'EGFR' / 'C1' / 'C1_docked.sdf'},completed,vina_smina_real_exploratory_blind_box,-7.2",
            ]
        ),
        encoding="utf-8",
    )
    (project / "assets" / "ligand_asset_manifest.csv").write_text(
        "\n".join(
            [
                "candidate_id,target_id,smiles,smi_path,sdf_path,png_path",
                f"C1,EGFR,CCO,{project / 'assets' / 'ligands_smi' / 'C1.smi'},{project / 'assets' / 'ligands_sdf' / 'C1.sdf'},{project / 'assets' / 'ligands_png' / 'C1.png'}",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(api, "DEFAULT_OUTPUT_DIR", project)

    row = api.research_top_candidates(limit=1)[0]

    assert row["png_url"].endswith("/assets/ligands_png/C1.png")
    assert row["sdf_url"].endswith("/assets/ligands_sdf/C1.sdf")
    assert row["docked_sdf_url"].endswith("/docking/poses/EGFR/C1/C1_docked.sdf")
    assert row["default_pose_source"] == "docked"
    assert [source["id"] for source in row["pose_sources"]] == ["docked"]
    assert all(source["method_tier"] != "PROXY" for source in row["pose_sources"])

    health = api.research_artifact_health()
    assert health["top_candidate_count"] == 1
    assert health["missing_image_count"] == 0
    assert health["missing_docked_pose_count"] == 0


def test_realtime_dock_parses_public_sdf_metadata(tmp_path, monkeypatch):
    public_dir = tmp_path / "public"
    output_dir = tmp_path / "outputs"
    sdf = public_dir / "pharma-library" / "ligands" / "chembl" / "sdf" / "CHEMBLTEST.sdf"
    _write_text(
        sdf,
        """
  Mrv

  3  2  0  0  0  0            999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.2094    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.4189    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0
  2  3  1  0
M  END
$$$$
""",
    )
    monkeypatch.setattr(chemistry_routes, "FRONTEND_PUBLIC_DIR", public_dir)
    monkeypatch.setattr(chemistry_routes, "OUTPUT_DIR", output_dir)

    path = chemistry_routes._path_from_url_or_path("/pharma-library/ligands/chembl/sdf/CHEMBLTEST.sdf")
    metadata = chemistry_routes._ligand_metadata_from_sdf(path)

    assert metadata["ligand_metadata_status"] == "parsed_from_sdf"
    assert metadata["canonical_smiles"] == "CCO"
    assert metadata["MW"] > 40
    assert metadata["QED"] > 0


def test_dashboard_smoke_current_artifacts():
    if not (api.DEFAULT_OUTPUT_DIR / "top_candidates.csv").exists():
        pytest.skip("research artifacts are not present in this checkout")
    client = TestClient(api.app)

    assert client.get("/dashboard").status_code == 200
    assert client.get("/investor").status_code == 200
    health = client.get("/research/artifact-health").json()
    candidates = client.get("/research/top-candidates?limit=30").json()
    viewer = client.get("/research/pose-viewer-data?limit=30").json()
    experiments = client.get("/research/experiments").json()
    evidence = client.get("/research/scientific-evidence").json()

    assert health["top_candidate_count"] == 30
    assert health["missing_image_count"] == 0
    assert health["missing_docked_pose_count"] == 0
    assert len(candidates) == 30
    assert all(candidate["pose_sources"] for candidate in candidates)
    assert all(any(source["id"] == "docked" for source in candidate["pose_sources"]) for candidate in candidates)
    assert len(viewer["candidates"]) == 30
    assert {"EGFR", "PARP1", "PIK3CA"}.issubset(viewer["structures"])
    if experiments["status"] == "completed":
        assert experiments["experiment_count"] >= 100
        assert len(experiments["hybrid_top5"]) == 5
    assert evidence["reference_stats"]["recent_2020_2026_entries"] >= 50
    assert evidence["production_gate"]["status"] in {"pass", "pass_with_warnings"}
    assert evidence["redocking_validation"]["targets_under_2a"] >= 3
    assert evidence["quantum_evidence"]["prefilter_rows"] >= 1
