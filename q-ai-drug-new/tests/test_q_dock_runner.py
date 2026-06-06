"""Smoke tests for Q-Dock Studio runner."""
from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

try:
    from rdkit import Chem
    HAS_RDKIT = Chem is not None
except ImportError:
    HAS_RDKIT = False

from q_ai_drug.product.module_runners.q_dock_studio import QDockStudioRunner


TINY_SMILES = [
    "CC(=O)Oc1ccccc1C(=O)O",           # Aspirin
    "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",   # Caffeine
]

POCKET_BOX = {
    "center_x": 10.0, "center_y": 20.0, "center_z": 30.0,
    "size_x": 20.0, "size_y": 20.0, "size_z": 20.0,
}


def _write_smiles_csv(path: Path, smiles: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["SMILES", "name"])
        writer.writeheader()
        for i, s in enumerate(smiles):
            writer.writerow({"SMILES": s, "name": f"lig_{i}"})


def _write_dummy_receptor(path: Path) -> None:
    """Write a minimal PDB receptor file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "ATOM      1  CA  ALA A   1      10.000  20.000  30.000  1.00  0.00           C\n"
        "END\n",
        encoding="utf-8",
    )


# ============================================================================
# Error handling — these tests run on CI even without RDKit
# ============================================================================

def test_q_dock_rejects_missing_receptor(tmp_path):
    """Q-Dock must fail with invalid_input when receptor file is absent."""
    proj = tmp_path / "proj"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_smiles_csv(uploads / "ligs.csv", TINY_SMILES)

    runner = QDockStudioRunner(
        "q_dock_studio",
        proj,
        "run-no-rec",
        {
            "receptor_upload_file": "nonexistent_receptor.pdb",
            "ligand_upload_file": "ligs.csv",
            "pocket_source": "uploaded_box",
            "pocket_box": POCKET_BOX,
        },
    )
    result = runner.execute()
    assert result["status"] == "failed"
    # Whether RDKit is missing or receptor file is missing, failure_code must be invalid_input
    assert result.get("failure_code") == "invalid_input", (
        f"Expected failure_code='invalid_input', got '{result.get('failure_code')}'. "
        f"Message: {result.get('failure_message', '(none)')[:200]}"
    )


def test_q_dock_rejects_missing_ligand_file(tmp_path):
    """Q-Dock must fail with invalid_input when ligand file is absent."""
    proj = tmp_path / "proj2"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_dummy_receptor(uploads / "receptor.pdb")

    runner = QDockStudioRunner(
        "q_dock_studio",
        proj,
        "run-no-lig",
        {
            "receptor_upload_file": "receptor.pdb",
            "ligand_upload_file": "nonexistent_ligands.csv",
            "pocket_source": "uploaded_box",
            "pocket_box": POCKET_BOX,
        },
    )
    result = runner.execute()
    assert result["status"] == "failed"


def test_q_dock_rejects_no_inputs_at_all(tmp_path):
    """Q-Dock with no inputs must fail with invalid_input."""
    runner = QDockStudioRunner("q_dock_studio", tmp_path, "run-empty", {})
    result = runner.execute()
    assert result["status"] == "failed"


# ============================================================================
# Mock docking behavior — requires RDKit for molecule parsing
# ============================================================================

@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_dock_mock_mode_when_vina_unavailable(tmp_path):
    """When Vina is not installed, Q-Dock must produce labeled mock output."""
    proj = tmp_path / "proj_mock"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_dummy_receptor(uploads / "receptor.pdb")
    _write_smiles_csv(uploads / "ligs.csv", TINY_SMILES)

    runner = QDockStudioRunner(
        "q_dock_studio",
        proj,
        "run-mock",
        {
            "receptor_upload_file": "receptor.pdb",
            "ligand_upload_file": "ligs.csv",
            "pocket_source": "uploaded_box",
            "pocket_box": POCKET_BOX,
        },
    )
    result = runner.execute()

    # Even in mock mode, result must have all schema keys
    assert "limitations" in result
    assert "credits_used" in result
    assert "execution_mode" in result

    if result["status"] in ("succeeded", "partial_success"):
        # Check docking_results.csv was produced
        out_dir = proj / "module_runs" / "q_dock_studio" / "run-mock"
        docking_csv = out_dir / "docking_results.csv"
        assert docking_csv.exists(), "docking_results.csv should be written"

        # In mock mode, check that mock warning is present and scores are labeled
        if result["execution_mode"] == "mock_docking":
            assert any("mock" in w.lower() or "vina" in w.lower() for w in result.get("warnings", []))


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_dock_mock_scores_are_labeled_not_real(tmp_path):
    """Mock docking scores must be labeled as non-real."""
    proj = tmp_path / "proj_labeled"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_dummy_receptor(uploads / "receptor.pdb")
    _write_smiles_csv(uploads / "ligs.csv", TINY_SMILES)

    runner = QDockStudioRunner(
        "q_dock_studio",
        proj,
        "run-labeled",
        {
            "receptor_upload_file": "receptor.pdb",
            "ligand_upload_file": "ligs.csv",
            "pocket_source": "uploaded_box",
            "pocket_box": POCKET_BOX,
        },
    )
    result = runner.execute()

    if result["execution_mode"] == "mock_docking":
        # In mock mode, claim_boundary must mention MOCK explicitly
        assert "MOCK" in result.get("claim_boundary", "") or "mock" in result.get("claim_boundary", "").lower()


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_dock_real_vina_path_mocked(tmp_path, monkeypatch):
    """Verify that when Vina is available, Q-Dock runs the real path and parses scores correctly."""
    proj = tmp_path / "proj_real"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_dummy_receptor(uploads / "receptor.pdb")
    _write_smiles_csv(uploads / "ligs.csv", TINY_SMILES)

    # Mock tool availability via resolve_tool
    original_resolve = __import__("q_ai_drug.tools.external", fromlist=["resolve_tool"]).resolve_tool
    def mock_resolve_tool(tool_name):
        from types import SimpleNamespace
        if tool_name in ("vina", "obabel"):
            return SimpleNamespace(available=True, via_wsl=True, path="mock_path")
        return original_resolve(tool_name)
        
    monkeypatch.setattr("q_ai_drug.tools.external.resolve_tool", mock_resolve_tool)
    monkeypatch.setattr("q_ai_drug.docking.vina_runner.vina_available", lambda: True)

    # Mock the actual _dock_with_vina subprocess call
    def mock_dock_with_vina(tool_name, receptor_pdbqt, ligand_pdbqt, out_pose, center, **kwargs):
        out_pose.write_text("MODEL 1\nREMARK VINA RESULT:    -7.5      0.000      0.000\nENDMDL\n")
        from types import SimpleNamespace
        return SimpleNamespace(returncode=0, stdout="Vina Output", stderr=""), -7.5

    monkeypatch.setattr("q_ai_drug.docking.vina_runner._dock_with_vina", mock_dock_with_vina)
    
    # Mock _run_obabel to avoid real subprocess calls and create dummy files
    def mock_run_obabel(input_path, output_path, *extra, timeout=600):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("DUMMY PDBQT CONTENT")
        from types import SimpleNamespace
        return SimpleNamespace(returncode=0, stdout="", stderr="")
        
    monkeypatch.setattr("q_ai_drug.docking.vina_runner._run_obabel", mock_run_obabel)

    runner = QDockStudioRunner(
        "q_dock_studio",
        proj,
        "run-real",
        {
            "receptor_upload_file": "receptor.pdb",
            "ligand_upload_file": "ligs.csv",
            "pocket_source": "uploaded_box",
            "pocket_box": POCKET_BOX,
        },
    )
    result = runner.execute()

    assert result["status"] in ("succeeded", "partial_success")
    # Default engine is vina_smina, so it should report real_docking_smina
    assert result["execution_mode"] in ("real_docking_vina", "real_docking_smina")
    
    # Verify scores were parsed
    out_dir = proj / "module_runs" / "q_dock_studio" / "run-real"
    docking_csv = out_dir / "docking_results.csv"
    assert docking_csv.exists()
    
    content = docking_csv.read_text()
    assert "-7.5" in content


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_dock_standalone_gnina_path_is_real_and_cnn_labeled(tmp_path, monkeypatch):
    """GNINA requests must execute the GNINA branch and emit CNN fields when available."""
    proj = tmp_path / "proj_gnina"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_dummy_receptor(uploads / "receptor.pdb")
    _write_smiles_csv(uploads / "ligs.csv", [TINY_SMILES[0]])

    def mock_resolve_tool(tool_name):
        from types import SimpleNamespace
        if tool_name == "gnina":
            return SimpleNamespace(available=True, via_wsl=False, path="mock_gnina")
        if tool_name in ("vina", "smina", "obabel"):
            return SimpleNamespace(available=False, via_wsl=False, path=None)
        return SimpleNamespace(available=False, via_wsl=False, path=None)

    def mock_run_external(name, args, *, cwd=None, timeout=600, check=True):
        from types import SimpleNamespace
        ligand_path = Path(args[args.index("-l") + 1])
        output_path = Path(args[args.index("-o") + 1])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(ligand_path.read_text(encoding="utf-8", errors="ignore"), encoding="utf-8")
        stdout = "\n".join([
            "mode | affinity | intramol | CNN pose score | CNN affinity",
            "1 -7.6 0.2 0.81 -8.9",
        ])
        return SimpleNamespace(returncode=0, stdout=stdout, stderr="")

    monkeypatch.setattr("q_ai_drug.tools.external.resolve_tool", mock_resolve_tool)
    monkeypatch.setattr("q_ai_drug.tools.external.run_external", mock_run_external)
    monkeypatch.setattr("q_ai_drug.docking.vina_runner.vina_available", lambda: False)

    runner = QDockStudioRunner(
        "q_dock_studio",
        proj,
        "run-gnina",
        {
            "receptor_upload_file": "receptor.pdb",
            "ligand_upload_file": "ligs.csv",
            "pocket_source": "uploaded_box",
            "pocket_box": POCKET_BOX,
            "engine": "gnina",
            "max_ligands": 1,
        },
    )
    result = runner.execute()

    assert result["status"] in ("succeeded", "partial_success")
    assert result["execution_mode"] == "real_docking_gnina"
    assert result["gnina_executed"] is True
    assert result["actual_engine_used"] == "gnina"

    out_dir = proj / "module_runs" / "q_dock_studio" / "run-gnina"
    rows = list(csv.DictReader((out_dir / "docking_results.csv").open()))
    assert rows[0]["engine"] == "gnina"
    assert rows[0]["docking_is_real"] == "True"
    assert rows[0]["gnina_status"] == "completed"
    assert rows[0]["gnina_cnn_pose_score"] == "0.81"
    assert rows[0]["gnina_cnn_affinity"] == "-8.9"
    assert Path(rows[0]["gnina_pose_sdf_path"]).exists()
    assert Path(rows[0]["gnina_log_path"]).exists()

    summary = json.loads((out_dir / "q_dock_summary.json").read_text(encoding="utf-8"))
    assert summary["gnina_executed"] is True
    assert summary["gnina_rows"] == 1
    assert summary["actual_engine_used"] == "gnina"


# ============================================================================
# Schema completeness
# ============================================================================

def test_q_dock_result_schema_complete(tmp_path):
    """Q-Dock result must have all required schema keys regardless of outcome."""
    proj = tmp_path / "proj_schema"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_dummy_receptor(uploads / "receptor.pdb")
    _write_smiles_csv(uploads / "ligs.csv", TINY_SMILES)

    runner = QDockStudioRunner(
        "q_dock_studio",
        proj,
        "run-schema",
        {
            "receptor_upload_file": "receptor.pdb",
            "ligand_upload_file": "ligs.csv",
            "pocket_source": "uploaded_box",
            "pocket_box": POCKET_BOX,
        },
    )
    result = runner.execute()

    required_keys = {"module_id", "status", "execution_mode", "artifacts", "warnings",
                     "limitations", "next_actions", "credits_used", "claim_boundary"}
    for key in required_keys:
        assert key in result, f"Missing key: {key}"
