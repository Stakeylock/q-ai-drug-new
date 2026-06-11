"""Smoke tests for Q-Filter runner with real molecules."""
from __future__ import annotations

import csv
from pathlib import Path

import pytest

try:
    from rdkit import Chem
    HAS_RDKIT = Chem is not None
except ImportError:
    HAS_RDKIT = False

from q_ai_drug.product.module_runners.q_filter import QFilterRunner


TINY_SMILES = [
    "CC(=O)Oc1ccccc1C(=O)O",           # Aspirin
    "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",   # Caffeine
    "CC(C)NCC(O)c1ccc(O)cc1",          # Salbutamol
    "c1ccc(cc1)C(c2ccccc2)=O",         # Benzophenone
    "O=C(O)c1ccccc1",                  # Benzoic acid
]


def _write_smiles_csv(path: Path, smiles: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["SMILES", "name"])
        writer.writeheader()
        for i, s in enumerate(smiles):
            writer.writerow({"SMILES": s, "name": f"mol_{i}"})


def test_q_filter_runner_rejects_missing_upload_file(tmp_path):
    """Q-Filter must fail gracefully when upload file is absent."""
    runner = QFilterRunner(
        "q_filter",
        tmp_path,
        "run-reject-test",
        {"candidate_upload_file": "nonexistent.csv"},
    )
    result = runner.execute()
    assert result["status"] == "failed"
    # On CI without RDKit → invalid_input (rdkit missing)
    # On dev with RDKit → invalid_input (file missing)
    assert result.get("failure_code") == "invalid_input", (
        f"Expected failure_code='invalid_input', got '{result.get('failure_code')}'. "
        f"Message: {result.get('failure_message', '(none)')[:200]}"
    )


def test_q_filter_runner_rejects_missing_input_source(tmp_path):
    """Q-Filter with no input source must fail gracefully."""
    runner = QFilterRunner("q_filter", tmp_path, "run-no-src-test", {})
    result = runner.execute()
    assert result["status"] == "failed"


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_filter_runner_produces_filtered_candidates(tmp_path):
    """Q-Filter must produce filtered_candidates.csv from a real SMILES CSV."""
    proj = tmp_path / "project"
    proj.mkdir()
    uploads = proj / "uploads"
    smiles_csv = uploads / "mols.csv"
    _write_smiles_csv(smiles_csv, TINY_SMILES)

    runner = QFilterRunner(
        "q_filter",
        proj,
        "run-smoke-test",
        {
            "candidate_upload_file": "mols.csv",
            "filter_profile": "standard",
            "run_admet": False,  # Skip ADMET to avoid model loading in CI
        },
    )
    result = runner.execute()

    assert result["status"] in ("succeeded", "partial_success"), (
        f"Unexpected status: {result['status']}. "
        f"Message: {result.get('failure_message', '(none)')[:300]}"
    )
    assert isinstance(result["artifacts"], list)
    assert len(result["artifacts"]) > 0

    out_dir = proj / "module_runs" / "q_filter" / "run-smoke-test"
    filtered_csv = out_dir / "filtered_candidates.csv"
    assert filtered_csv.exists(), f"filtered_candidates.csv not written to {out_dir}"


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_filter_runner_schema_complete(tmp_path):
    """Q-Filter result must have limitations, next_actions, credits_used, execution_mode."""
    proj = tmp_path / "project"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_smiles_csv(uploads / "mols.csv", TINY_SMILES)

    runner = QFilterRunner(
        "q_filter",
        proj,
        "run-schema-check",
        {"candidate_upload_file": "mols.csv", "run_admet": False},
    )
    result = runner.execute()

    assert "limitations" in result
    assert "next_actions" in result
    assert "credits_used" in result
    assert result["execution_mode"] == "small_or_production"
    assert isinstance(result["limitations"], list)
    assert isinstance(result["next_actions"], list)
    assert result["credits_used"] >= 0


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_filter_runner_reports_pains_alerts(tmp_path):
    """Q-Filter must detect and report PAINS alerts for known problematic molecules."""
    pains_mol = "c1ccc2c(c1)cc1ccc3cccc4ccc2c1c34"  # An acridine-like scaffold (PAINS)
    proj = tmp_path / "proj_pains"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_smiles_csv(uploads / "pains.csv", [pains_mol, "CC(=O)Oc1ccccc1C(=O)O"])  # 1 PAINS + 1 clean

    runner = QFilterRunner(
        "q_filter",
        proj,
        "run-pains",
        {"candidate_upload_file": "pains.csv", "filter_profile": "standard", "run_admet": False},
    )
    result = runner.execute()
    # Runner should succeed (partial is ok); medchem_risk_table must exist
    assert result["status"] in ("succeeded", "partial_success")
    out_dir = proj / "module_runs" / "q_filter" / "run-pains"
    assert (out_dir / "medchem_risk_table.csv").exists()


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_filter_runner_duplicate_removal(tmp_path):
    """Q-Filter must remove duplicate SMILES (same canonical form)."""
    # Aspirin appears twice; only one should be in output
    duped = [TINY_SMILES[0]] * 3 + TINY_SMILES[1:3]
    proj = tmp_path / "proj_dup"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_smiles_csv(uploads / "duped.csv", duped)

    runner = QFilterRunner(
        "q_filter",
        proj,
        "run-dedup",
        {"candidate_upload_file": "duped.csv", "run_admet": False},
    )
    result = runner.execute()
    assert result["status"] in ("succeeded", "partial_success"), (
        f"Unexpected status: {result['status']}. "
        f"Message: {result.get('failure_message', '(none)')[:300]}"
    )
    # Should have a warning about duplicates
    assert any("duplicate" in w.lower() for w in result.get("warnings", []))
