from __future__ import annotations

import pandas as pd

from q_ai_drug.md.openmm_workflow import run_proxy_md


def test_md_outputs_use_checkpoint_names(tmp_path):
    docking = tmp_path / "docking.csv"
    pd.DataFrame(
        [
            {"target_id": "EGFR", "candidate_id": "A", "canonical_smiles": "CCO", "affinity_kcal_mol": -7.0},
        ]
    ).to_csv(docking, index=False)

    run_proxy_md(docking, tmp_path / "md", top=1)
    stability = pd.read_csv(tmp_path / "md" / "stability.csv")
    series = pd.read_csv(tmp_path / "md" / "rmsd_summary.csv")

    forbidden = {"rmsd_1ns", "rmsd_5ns", "rmsd_10ns", "time_ns"}
    assert forbidden.isdisjoint(stability.columns)
    assert forbidden.isdisjoint(series.columns)
    assert {"rmsd_checkpoint_early", "rmsd_checkpoint_mid", "rmsd_checkpoint_final"}.issubset(stability.columns)
    assert "checkpoint_label" in series.columns
