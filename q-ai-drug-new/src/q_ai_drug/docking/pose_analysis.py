from __future__ import annotations

import pandas as pd


def summarize_docking(results: pd.DataFrame) -> pd.DataFrame:
    return (
        results.groupby("target_id")
        .agg(
            candidates=("candidate_id", "nunique"),
            best_affinity=("affinity_kcal_mol", "min"),
            median_affinity=("affinity_kcal_mol", "median"),
            strong_rate=("binding_class", lambda values: float((values == "strong").mean())),
        )
        .reset_index()
    )
