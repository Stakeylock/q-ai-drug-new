from __future__ import annotations

import pandas as pd

from q_ai_drug.data.curate_activity import curate_activity_benchmark


def test_curate_activity_outputs_required_columns(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    benchmark = tmp_path / "benchmark.csv"
    pd.DataFrame(
        [
            {
                "target_chembl_id": "CHEMBL_T",
                "molecule_chembl_id": "CHEMBL_M",
                "canonical_smiles": "CCO",
                "standard_type": "EC50",
                "standard_relation": "=",
                "standard_value_nm": 100.0,
                "standard_units": "nM",
                "p_activity": 7.0,
                "label_active": 1,
                "target_id": "EGFR",
                "murcko_scaffold": "",
                "split": "train",
                "source": "unit",
            }
        ]
    ).to_csv(benchmark, index=False)

    curated, summary = curate_activity_benchmark(benchmark, tmp_path / "project")

    required = {
        "target_id",
        "canonical_smiles",
        "standardized_activity_nM",
        "p_activity",
        "assay_confidence",
        "assay_type",
        "organism",
        "target_variant",
        "activity_relation",
        "activity_value_raw",
        "activity_unit_raw",
        "curation_flag",
        "curation_kept",
        "active_threshold_p_activity",
        "inactive_threshold_p_activity",
        "split",
        "murcko_scaffold",
    }
    assert required.issubset(curated.columns)
    assert curated.loc[0, "assay_type"] == "biochemical_or_binding_public_assay"
    assert {"raw_records", "kept_records", "unique_molecules", "reference_drugs_configured"}.issubset(summary.columns)
    assert (tmp_path / "project" / "dataset_curation_report.html").exists()
    assert (tmp_path / "docs" / "dataset_curation_protocol.md").exists()
