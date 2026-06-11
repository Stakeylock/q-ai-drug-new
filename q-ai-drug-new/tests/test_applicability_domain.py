from __future__ import annotations

import pandas as pd

from q_ai_drug.models.applicability_domain import build_applicability_domain


def test_applicability_domain_labels_all_candidates(tmp_path):
    candidates = pd.DataFrame(
        [
            {"target_id": "EGFR", "candidate_id": "A", "canonical_smiles": "CCO"},
            {"target_id": "EGFR", "candidate_id": "B", "canonical_smiles": "c1ccccc1"},
        ]
    )
    benchmark = pd.DataFrame(
        [
            {"target_id": "EGFR", "canonical_smiles": "CCO", "label_active": 1, "split": "train", "murcko_scaffold": ""},
            {"target_id": "EGFR", "canonical_smiles": "CCN", "label_active": 0, "split": "validation", "murcko_scaffold": ""},
        ]
    )
    refs = pd.DataFrame([{"target_id": "EGFR", "query_name": "ethanol", "canonical_smiles": "CCO"}])

    result = build_applicability_domain(candidates, benchmark, tmp_path / "ad.csv", reference_drugs=refs)

    assert len(result) == len(candidates)
    assert result["applicability_domain"].isin({"high", "medium", "low", "out-of-domain"}).all()
    assert result["prediction_confidence"].between(0, 1).all()
    assert (tmp_path / "ad.csv").exists()
