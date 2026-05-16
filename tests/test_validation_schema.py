from __future__ import annotations

from scripts.validate_research_artifacts import CSV_SCHEMAS, validate


def test_validation_requires_scientific_artifacts(tmp_path):
    project = tmp_path / "project"
    project.mkdir()
    report = validate(project, tier="proof")
    assert report["status"] == "fail"
    assert any("curation" in error and "dataset_curation_summary.csv" in error for error in report["errors"])
    assert "models/applicability_domain.csv" in CSV_SCHEMAS
    assert "scientific_claim_matrix.csv" in CSV_SCHEMAS
    assert "platform/module_execution_matrix.csv" in CSV_SCHEMAS
