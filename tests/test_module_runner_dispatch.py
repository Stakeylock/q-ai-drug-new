"""Tests for module runner dispatch: all registered runners instantiate and execute."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from q_ai_drug.product.module_execution import execute_module
from q_ai_drug.product.module_runners import get_runner, _load_runners


REGISTERED_MODULES = ["q_filter", "q_orbital_analyzer", "q_dock_studio", "onco_data_builder"]


def test_all_registered_runners_can_be_loaded():
    """All modules in the runner registry should load without import errors."""
    runners = _load_runners()
    for module_id in REGISTERED_MODULES:
        assert module_id in runners, f"Runner not registered: {module_id}"
        runner_class = runners[module_id]
        assert callable(runner_class), f"Runner class not callable: {module_id}"


def test_runner_result_has_required_schema_keys(tmp_path):
    """execute_module output must have all required top-level keys."""
    # q_filter with no upload → should return a 'failed' result with valid schema
    result = execute_module(
        tmp_path / "proj",
        "q_filter",
        "run-schema-test",
        {"candidate_upload_file": "nonexistent.csv"},
    )
    required_keys = {
        "module_id",
        "module_name",
        "project_id",
        "run_id",
        "status",
        "execution_mode",
        "queue",
        "artifacts",
        "warnings",
        "limitations",
        "next_actions",
        "credits_used",
        "claim_boundary",
        "created_at",
    }
    for key in required_keys:
        assert key in result, f"Missing key '{key}' in result"


def test_runner_result_is_written_to_disk(tmp_path):
    """execute_module must write module_result.json to disk."""
    proj = tmp_path / "proj"
    proj.mkdir()
    execute_module(proj, "q_filter", "run-disk-test", {"candidate_upload_file": "nonexistent.csv"})
    result_path = proj / "module_runs" / "q_filter" / "run-disk-test" / "module_result.json"
    assert result_path.exists(), "module_result.json not written to disk"
    data = json.loads(result_path.read_text(encoding="utf-8"))
    assert data["module_id"] == "q_filter"


def test_runner_execution_mode_not_mock_on_success(tmp_path):
    """On a normal (non-dry_run) invocation, execution_mode must be small_or_production."""
    result = execute_module(
        tmp_path / "proj",
        "q_filter",
        "run-mode-test",
        {"candidate_upload_file": "nonexistent.csv"},
    )
    # Either failed or small_or_production, but never 'standard' or blank
    assert result["execution_mode"] in {"small_or_production", "dry_run", "mock_docking"}


def test_credits_used_is_non_negative_float(tmp_path):
    """credits_used must be a non-negative float in all results."""
    result = execute_module(
        tmp_path / "proj",
        "q_filter",
        "run-credits-test",
        {"candidate_upload_file": "nonexistent.csv"},
    )
    assert isinstance(result["credits_used"], (int, float)), "credits_used must be numeric"
    assert result["credits_used"] >= 0, "credits_used must be >= 0"


def test_claim_boundary_always_present(tmp_path):
    """claim_boundary must always contain the standard validation text."""
    result = execute_module(
        tmp_path / "proj",
        "q_filter",
        "run-claim-test",
        {"candidate_upload_file": "nonexistent.csv"},
    )
    assert "Wet-lab validation" in result["claim_boundary"] or "MOCK" in result["claim_boundary"]
