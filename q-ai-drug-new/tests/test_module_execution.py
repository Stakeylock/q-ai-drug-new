from __future__ import annotations

import json

from q_ai_drug.product.module_execution import dry_run_module, execute_module
from q_ai_drug.product.module_registry import list_modules


def test_all_modules_emit_standard_result_schema(tmp_path):
    project = tmp_path / "module_project"
    project.mkdir()

    for module in list_modules():
        module_id = module["module_id"]
        result = execute_module(project, module_id, f"run-{module_id}", {"project_id": "test-project"})
        result_path = project / "module_runs" / module_id / f"run-{module_id}" / "module_result.json"

        assert result_path.exists()
        persisted = json.loads(result_path.read_text(encoding="utf-8"))
        assert persisted["module_id"] == module_id
        assert persisted["status"] in {"succeeded", "partial_success", "failed"}
        assert persisted["execution_mode"] == "small_or_production"
        assert isinstance(persisted["artifacts"], list)
        assert isinstance(persisted["warnings"], list)
        assert isinstance(persisted["limitations"], list)
        assert isinstance(persisted["next_actions"], list)
        assert persisted["credits_used"] >= 0
        assert "Wet-lab validation is required" in persisted["claim_boundary"]
        assert result == persisted


def test_module_dry_run_uses_same_status_schema(tmp_path):
    result = dry_run_module(tmp_path / "project", "q_filter", "dry-run-1", {"molecule_count": 1000})

    assert result["status"] == "succeeded"
    assert result["execution_mode"] == "dry_run"
    assert result["credits_used"] == 0.1
    assert "no scientific compute" in " ".join(result["limitations"]).lower()
