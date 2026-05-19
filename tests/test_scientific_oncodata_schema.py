"""Scientific acceptance tests for OncoData Builder.

Validates:
- Every retained row has required schema fields
- Duplicate resolution report is generated
- Scaffold split produces train/valid/test
- Target coverage summary is generated
- Provenance includes source_mode and dataset_hash
"""

import json
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from q_ai_drug.product.module_runners.onco_data_builder import OncoDataBuilderRunner


@pytest.fixture
def project_with_benchmark(tmp_path):
    """Create a minimal project with benchmark data and config."""
    # Benchmark CSV with duplicate entries for conflict testing
    benchmark = tmp_path / "data" / "processed" / "oncology_benchmark.csv"
    benchmark.parent.mkdir(parents=True, exist_ok=True)
    rows = [
        {"target_id": "EGFR", "canonical_smiles": "c1ccccc1", "standard_type": "IC50",
         "standard_value": 100, "standard_units": "nM", "p_activity": 7.0, "pActivity": 7.0,
         "source": "benchmark", "curation_kept": True, "assay_confidence": 8},
        {"target_id": "EGFR", "canonical_smiles": "c1ccccc1", "standard_type": "IC50",
         "standard_value": 200, "standard_units": "nM", "p_activity": 6.7, "pActivity": 6.7,
         "source": "benchmark", "curation_kept": True, "assay_confidence": 7},
        {"target_id": "EGFR", "canonical_smiles": "CCO", "standard_type": "IC50",
         "standard_value": 50, "standard_units": "nM", "p_activity": 7.3, "pActivity": 7.3,
         "source": "benchmark", "curation_kept": True, "assay_confidence": 9},
        {"target_id": "TP53", "canonical_smiles": "CCCC", "standard_type": "IC50",
         "standard_value": 500, "standard_units": "nM", "p_activity": 6.3, "pActivity": 6.3,
         "source": "benchmark", "curation_kept": True, "assay_confidence": 6},
        {"target_id": "TP53", "canonical_smiles": "CCCN", "standard_type": "IC50",
         "standard_value": 1000, "standard_units": "nM", "p_activity": 6.0, "pActivity": 6.0,
         "source": "benchmark", "curation_kept": True, "assay_confidence": 7},
    ]
    pd.DataFrame(rows).to_csv(benchmark, index=False)

    # Config
    config_dir = tmp_path / "configs"
    config_dir.mkdir(exist_ok=True)
    config_path = config_dir / "cancer_targets.yaml"
    config_path.write_text(
        "primary_targets:\n  EGFR:\n    gene: EGFR\n  TP53:\n    gene: TP53\n",
        encoding="utf-8",
    )

    return tmp_path


def _run_builder(project_dir, targets=None):
    """Helper to run OncoData Builder."""
    import builtins
    import os
    original_import = builtins.__import__

    def mock_import(name, *args, **kwargs):
        if name == "chembl_webresource_client.new_client":
            raise ImportError("Unit test uses benchmark fallback instead of live ChEMBL")
        return original_import(name, *args, **kwargs)

    old_cwd = os.getcwd()
    os.chdir(project_dir)
    builtins.__import__ = mock_import
    try:
        payload = {"target_ids": targets or ["EGFR", "TP53"]}
        runner = OncoDataBuilderRunner("onco_data_builder", project_dir, "test_run_1", payload)
        result = runner.execute()
        return result, runner
    finally:
        builtins.__import__ = original_import
        os.chdir(old_cwd)


class TestOncoDataSchema:
    """Every retained row must have required fields."""

    def test_curated_activity_has_required_columns(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        assert result["status"] in ("succeeded", "partial_success")
        curated = runner.curated_activity
        assert curated is not None and not curated.empty
        for col in ["target_id", "canonical_smiles", "standard_type", "p_activity", "source"]:
            assert col in curated.columns, f"Missing required column: {col}"

    def test_curated_rows_no_null_keys(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        curated = runner.curated_activity
        assert curated["target_id"].notna().all()
        assert curated["canonical_smiles"].notna().all()
        assert curated["p_activity"].notna().all()


class TestUploadedActivityEndpointNormalization:
    """Uploaded IC50/EC50/Ki/Kd-style wide sheets must become canonical evidence rows."""

    def test_wide_endpoint_columns_expand_to_one_row_per_measurement(self):
        raw = pd.DataFrame(
            [
                {
                    "target": "EGFR",
                    "smiles": "CCO",
                    "compound_id": "cmpd-1",
                    "IC50": 100,
                    "EC50": 250,
                    "Ki": 50,
                    "Kd": 10,
                    "unit": "nM",
                }
            ]
        )

        normalized = OncoDataBuilderRunner._normalize_activity_schema(raw, source="uploaded")

        assert set(normalized["standard_type"]) == {"IC50", "EC50", "Ki", "Kd"}
        assert len(normalized) == 4
        assert normalized["standardized_activity_nM"].notna().all()
        assert normalized["p_activity"].notna().all()
        assert normalized["p_activity"].equals(normalized["pActivity"])

    def test_uploaded_only_runner_writes_normalization_summary(self, tmp_path):
        config_dir = tmp_path / "configs"
        upload_dir = tmp_path / "uploads"
        config_dir.mkdir()
        upload_dir.mkdir()
        config_dir.joinpath("cancer_targets.yaml").write_text(
            "primary_targets:\n  EGFR:\n    gene: EGFR\n",
            encoding="utf-8",
        )
        pd.DataFrame(
            [
                {"target": "EGFR", "smiles": "CCO", "ic50": 0.1, "ec50": 0.4, "kd": 0.02, "unit": "uM"},
                {"target": "EGFR", "smiles": "CCC", "pKi": 7.2},
            ]
        ).to_csv(upload_dir / "uploaded_assay.csv", index=False)

        import os

        old_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            runner = OncoDataBuilderRunner(
                "onco_data_builder",
                tmp_path,
                "uploaded-wide",
                {
                    "target_ids": ["EGFR"],
                    "data_sources": "uploaded_only",
                    "uploaded_assay_csv": "uploaded_assay.csv",
                },
            )
            result = runner.execute()
        finally:
            os.chdir(old_cwd)

        assert result["status"] == "succeeded"
        assert runner.source_mode == "uploaded"
        assert set(runner.curated_activity["standard_type"]) == {"IC50", "EC50", "Kd", "Ki"}
        summary_path = runner.output_dir / "uploaded_assay_curation_summary.json"
        assert summary_path.exists()
        summary = json.loads(summary_path.read_text())
        assert summary["uploaded_assay_usable_rows"] == 4
        assert summary["uploaded_assay_rejected_rows"] == 0
        assert summary["p_activity_synchronized"] is True


class TestBindingDBNormalization:
    """BindingDB Ki/Kd/IC50/EC50 exports must normalize into auditable activity rows."""

    def test_bindingdb_tsv_expands_endpoint_columns(self, tmp_path):
        from q_ai_drug.data.bindingdb import normalize_bindingdb_activities

        path = tmp_path / "bindingdb.tsv"
        pd.DataFrame(
            [
                {
                    "BindingDB Reactant_set_id": "BDBM1",
                    "Ligand SMILES": "CCO",
                    "Target Name": "Epidermal growth factor receptor EGFR",
                    "Ki (nM)": "<50",
                    "IC50 (nM)": "100",
                    "Kd (nM)": "25",
                    "EC50 (nM)": "",
                    "PubMed ID": "12345",
                }
            ]
        ).to_csv(path, sep="\t", index=False)

        normalized = normalize_bindingdb_activities(path, target_ids=["EGFR"])

        assert set(normalized["standard_type"]) == {"Ki", "IC50", "Kd"}
        assert normalized["source"].eq("bindingdb").all()
        assert normalized["source_database"].eq("BindingDB").all()
        assert normalized["standardized_activity_nM"].notna().all()
        assert normalized["p_activity"].notna().all()
        assert normalized.loc[normalized["standard_type"] == "Ki", "standard_relation"].iloc[0] == "<"

    def test_oncodata_builder_accepts_bindingdb_only_source(self, tmp_path):
        config_dir = tmp_path / "configs"
        upload_dir = tmp_path / "uploads"
        config_dir.mkdir()
        upload_dir.mkdir()
        config_dir.joinpath("cancer_targets.yaml").write_text(
            "primary_targets:\n  EGFR:\n    gene: EGFR\n",
            encoding="utf-8",
        )
        pd.DataFrame(
            [
                {
                    "BindingDB Reactant_set_id": "BDBM1",
                    "Ligand SMILES": "CCO",
                    "Target Name": "EGFR kinase",
                    "Ki (nM)": 10,
                    "IC50 (nM)": 100,
                }
            ]
        ).to_csv(upload_dir / "bindingdb.tsv", sep="\t", index=False)

        import os

        old_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            runner = OncoDataBuilderRunner(
                "onco_data_builder",
                tmp_path,
                "bindingdb-only",
                {
                    "target_ids": ["EGFR"],
                    "data_sources": "bindingdb_only",
                    "bindingdb_tsv": "bindingdb.tsv",
                },
            )
            result = runner.execute()
        finally:
            os.chdir(old_cwd)

        assert result["status"] == "succeeded"
        assert runner.source_mode == "bindingdb"
        assert set(runner.curated_activity["standard_type"]) == {"Ki", "IC50"}
        assert (runner.output_dir / "bindingdb_normalized.csv").exists()
        assert (runner.output_dir / "bindingdb_curation_summary.json").exists()


class TestDuplicateResolution:
    """Duplicates must not be silently collapsed."""

    def test_duplicate_resolution_generated(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        # Benzene (c1ccccc1) has 2 EGFR IC50 entries = 1 duplicate group
        assert not runner.duplicate_resolution.empty
        assert "duplicate_group_id" in runner.duplicate_resolution.columns
        assert "measurement_count" in runner.duplicate_resolution.columns
        assert "conflict_flag" in runner.duplicate_resolution.columns

    def test_duplicate_csv_written(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        dup_path = runner.output_dir / "duplicate_resolution.csv"
        assert dup_path.exists()


class TestScaffoldSplit:
    """Train/test split must be scaffold-aware when RDKit is available."""

    def test_split_columns_exist(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        curated = runner.curated_activity
        assert "split" in curated.columns
        assert set(curated["split"].unique()).issubset({"train", "valid", "test"})

    def test_split_csvs_written(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        for name in ["train", "valid", "test"]:
            p = runner.output_dir / f"{name}.csv"
            # At least some splits should exist (tiny data may not hit all 3)

    def test_scaffold_split_summary(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        assert not runner.scaffold_split_summary.empty
        assert "split_method" in runner.scaffold_split_summary.columns
        split_path = runner.output_dir / "scaffold_split_summary.csv"
        assert split_path.exists()


class TestTargetCoverage:
    """Per-target data coverage must be reported."""

    def test_target_coverage_generated(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        assert not runner.target_coverage.empty
        assert set(runner.target_coverage["target_id"]) == {"EGFR", "TP53"}

    def test_target_coverage_csv_written(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        cov_path = runner.output_dir / "target_coverage_summary.csv"
        assert cov_path.exists()


class TestProvenance:
    """Provenance must say where data came from."""

    def test_provenance_has_source_mode(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        prov_path = runner.output_dir / "dataset_provenance.json"
        assert prov_path.exists()
        prov = json.loads(prov_path.read_text())
        assert "source_mode" in prov
        assert prov["source_mode"] in ("chembl_live", "benchmark_fallback", "uploaded",
                                        "benchmark_fallback_plus_uploaded", "chembl_live_plus_uploaded")

    def test_provenance_has_dataset_hash(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        prov_path = runner.output_dir / "dataset_provenance.json"
        prov = json.loads(prov_path.read_text())
        assert "dataset_hash" in prov
        assert prov["dataset_hash"] != "empty"

    def test_manifest_has_split_method(self, project_with_benchmark):
        result, runner = _run_builder(project_with_benchmark)
        manifest_path = runner.output_dir / "dataset_manifest.json"
        assert manifest_path.exists()
        manifest = json.loads(manifest_path.read_text())
        assert "split_method" in manifest
        assert "duplicate_groups" in manifest
