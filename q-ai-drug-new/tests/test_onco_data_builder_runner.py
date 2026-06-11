"""Smoke tests for OncoData Builder runner."""
from __future__ import annotations

from pathlib import Path
import pytest

from q_ai_drug.product.module_runners.onco_data_builder import OncoDataBuilderRunner

def test_onco_data_missing_target(tmp_path):
    """OncoData Builder must fail with invalid_input if no target or upload is provided."""
    runner = OncoDataBuilderRunner(
        "onco_data_builder",
        tmp_path,
        "run-no-target",
        {"target_ids": [], "candidate_upload_file": ""}
    )
    result = runner.execute()
    assert result["status"] == "failed"
    assert result.get("failure_code") == "invalid_input"


def test_onco_data_chembl_unavailable_fallback(tmp_path, monkeypatch):
    """When ChEMBL client is unavailable, it must warn and fall back to benchmark data."""
    # Ensure a dummy benchmark CSV exists to avoid failure
    benchmark_dir = Path("data/processed")
    benchmark_dir.mkdir(parents=True, exist_ok=True)
    benchmark_csv = benchmark_dir / "oncology_benchmark.csv"
    
    if not benchmark_csv.exists():
        benchmark_csv.write_text("target_id,canonical_smiles,p_activity,curation_kept\nEGFR,C,6.5,True\n")

    # Mock the internal import error
    original_import = __import__
    def mock_import(name, *args, **kwargs):
        if name == 'chembl_webresource_client.new_client':
            raise ImportError("Mocked missing chembl_webresource_client")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr("builtins.__import__", mock_import)

    runner = OncoDataBuilderRunner(
        "onco_data_builder",
        tmp_path,
        "run-chembl-fail",
        {"target_ids": ["EGFR"]}
    )
    result = runner.execute()
    
    # Should succeed with fallback
    assert result["status"] in ("succeeded", "partial_success")
    warnings = result.get("warnings", [])
    assert any("benchmark" in w.lower() or "chembl" in w.lower() for w in warnings)
    
    # Check outputs
    out_dir = tmp_path / "module_runs" / "onco_data_builder" / "run-chembl-fail"
    assert (out_dir / "curated_activity.csv").exists()
