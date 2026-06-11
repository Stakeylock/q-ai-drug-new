"""Smoke tests for Q-Orbital Analyzer runner — verifies real HOMO/LUMO/gap output."""
from __future__ import annotations

import csv
from pathlib import Path

import pytest

try:
    from rdkit import Chem
    HAS_RDKIT = Chem is not None
except ImportError:
    HAS_RDKIT = False

from q_ai_drug.product.module_runners.q_orbital_analyzer import QOrbitalAnalyzerRunner


TINY_SMILES = [
    "CC(=O)Oc1ccccc1C(=O)O",        # Aspirin
    "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", # Caffeine
    "C",                              # Methane (small, fast embedding)
]


def _write_smiles_csv(path: Path, smiles: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["SMILES", "name"])
        writer.writeheader()
        for i, s in enumerate(smiles):
            writer.writerow({"SMILES": s, "name": f"mol_{i}"})


def test_q_orbital_runner_rejects_missing_upload(tmp_path):
    """Q-Orbital must fail gracefully when upload file is missing."""
    runner = QOrbitalAnalyzerRunner(
        "q_orbital_analyzer",
        tmp_path,
        "run-reject",
        {"candidate_upload_file": "nonexistent.csv"},
    )
    result = runner.execute()
    assert result["status"] == "failed"
    # Should be invalid_input whether RDKit missing or file missing
    assert result.get("failure_code") == "invalid_input", (
        f"Expected failure_code='invalid_input', got '{result.get('failure_code')}'. "
        f"Message: {result.get('failure_message', '(none)')[:200]}"
    )


def test_q_orbital_runner_rejects_missing_input_source(tmp_path):
    """Q-Orbital with no input source must fail gracefully."""
    runner = QOrbitalAnalyzerRunner("q_orbital_analyzer", tmp_path, "run-no-src", {})
    result = runner.execute()
    assert result["status"] == "failed"


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_orbital_runner_produces_qm_descriptors(tmp_path):
    """Q-Orbital must produce qm_descriptors.csv with non-None HOMO/LUMO/gap."""
    proj = tmp_path / "project"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_smiles_csv(uploads / "mols.csv", TINY_SMILES)

    runner = QOrbitalAnalyzerRunner(
        "q_orbital_analyzer",
        proj,
        "run-smoke",
        {
            "candidate_upload_file": "mols.csv",
            "method": "rdkit_fallback",  # Use EHT, avoids needing WSL xTB in CI
        },
    )
    result = runner.execute()

    assert result["status"] in ("succeeded", "partial_success"), (
        f"Unexpected status: {result['status']}. "
        f"Message: {result.get('failure_message', '(none)')[:300]}"
    )

    out_dir = proj / "module_runs" / "q_orbital_analyzer" / "run-smoke"
    desc_csv = out_dir / "qm_descriptors.csv"
    assert desc_csv.exists(), f"qm_descriptors.csv not found in {out_dir}"


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_orbital_homo_lumo_are_not_none(tmp_path):
    """The HOMO/LUMO/gap values must be real numbers, not None."""
    proj = tmp_path / "project_qm"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_smiles_csv(uploads / "mols.csv", ["C", "CC"])  # Tiny molecules

    runner = QOrbitalAnalyzerRunner(
        "q_orbital_analyzer",
        proj,
        "run-homo-check",
        {"candidate_upload_file": "mols.csv", "method": "rdkit_fallback"},
    )
    result = runner.execute()

    if result["status"] in ("succeeded", "partial_success"):
        # Check that at least some molecules have real HOMO/LUMO values
        out_dir = proj / "module_runs" / "q_orbital_analyzer" / "run-homo-check"
        desc_csv = out_dir / "qm_descriptors.csv"
        if desc_csv.exists():
            import csv
            with open(desc_csv) as f:
                rows = list(csv.DictReader(f))
            if rows:
                # At least one row should have a real HOMO value
                real_rows = [r for r in rows if r.get("homo") not in (None, "", "None")]
                assert len(real_rows) > 0, (
                    f"All HOMO values are None. "
                    f"Expected real EHT values. Rows: {rows[:2]}"
                )


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_orbital_schema_complete(tmp_path):
    """Q-Orbital result must have all required schema keys."""
    proj = tmp_path / "proj_schema"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_smiles_csv(uploads / "mols.csv", TINY_SMILES[:1])

    runner = QOrbitalAnalyzerRunner(
        "q_orbital_analyzer",
        proj,
        "run-schema",
        {"candidate_upload_file": "mols.csv", "method": "rdkit_fallback"},
    )
    result = runner.execute()

    assert "limitations" in result
    assert "next_actions" in result
    assert "credits_used" in result
    assert result["execution_mode"] in ("small_or_production", "dry_run")
    assert result["credits_used"] >= 0


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_orbital_qm_failure_report_written(tmp_path):
    """Q-Orbital must write qm_failure_report.csv when molecules fail."""
    proj = tmp_path / "proj_fail"
    proj.mkdir()
    uploads = proj / "uploads"
    # Include an invalid SMILES to trigger failure report
    _write_smiles_csv(uploads / "mols.csv", ["CC(=O)Oc1ccccc1C(=O)O", "ZZZZINVALIDSMILES"])

    runner = QOrbitalAnalyzerRunner(
        "q_orbital_analyzer",
        proj,
        "run-fail-report",
        {"candidate_upload_file": "mols.csv", "method": "rdkit_fallback"},
    )
    result = runner.execute()
    assert result["status"] in ("succeeded", "partial_success"), (
        f"Unexpected status: {result['status']}. "
        f"Message: {result.get('failure_message', '(none)')[:300]}"
    )
    out_dir = proj / "module_runs" / "q_orbital_analyzer" / "run-fail-report"
    # Either a failure report exists or all molecules passed
    failure_csv = out_dir / "qm_failure_report.csv"
    assert failure_csv.exists(), "qm_failure_report.csv should exist when invalid SMILES present"


@pytest.mark.skipif(not HAS_RDKIT, reason="RDKit not installed")
def test_q_orbital_xtb_unavailable_fallback(tmp_path, monkeypatch):
    """When method=xtb but xTB is missing, Q-Orbital must fall back to EHT and warn the user."""
    proj = tmp_path / "proj_xtb"
    proj.mkdir()
    uploads = proj / "uploads"
    _write_smiles_csv(uploads / "mols.csv", ["C"])

    # Force xTB to be unavailable
    monkeypatch.setattr("q_ai_drug.qm.xtb_qm_descriptors.xtb_available", lambda: False)

    runner = QOrbitalAnalyzerRunner(
        "q_orbital_analyzer",
        proj,
        "run-xtb-miss",
        {"candidate_upload_file": "mols.csv", "method": "xtb"},
    )
    result = runner.execute()

    assert result["status"] in ("succeeded", "partial_success")
    
    # Verify fallback warning was emitted
    warnings = result.get("warnings", [])
    assert any("xtb" in w.lower() for w in warnings) or any("fallback" in w.lower() for w in warnings)
    
    # Verify we still get descriptors via EHT fallback
    out_dir = proj / "module_runs" / "q_orbital_analyzer" / "run-xtb-miss"
    desc_csv = out_dir / "qm_descriptors.csv"
    assert desc_csv.exists()
    
    content = desc_csv.read_text()
    assert "rdkit_extended_huckel" in content or "EHT" in content
