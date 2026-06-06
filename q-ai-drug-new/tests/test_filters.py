import pandas as pd

from q_ai_drug.config import FiltersConfig
from q_ai_drug.filters.medchem_filters import apply_medchem_filters


def test_apply_medchem_filters_marks_passes() -> None:
    df = pd.DataFrame({"target_id": ["EGFR"], "candidate_id": ["x"], "smiles": ["CCO"]})
    out = apply_medchem_filters(df, FiltersConfig())
    assert "filter_pass" in out.columns
    assert len(out) == 1


def test_apply_medchem_filters_uses_trained_admet_scores() -> None:
    df = pd.DataFrame(
        {
            "target_id": ["EGFR", "EGFR"],
            "candidate_id": ["low_risk", "high_risk"],
            "smiles": ["CCO", "CCCl"],
            "tox21_toxicity_probability": [0.05, 0.90],
            "clintox_toxicity_probability": [0.05, 0.90],
            "fda_approval_probability": [0.80, 0.10],
            "admet_model_score": [0.90, 0.10],
        }
    )
    out = apply_medchem_filters(df, FiltersConfig(remove_pains=False, remove_brenk=False))
    scores = dict(zip(out["candidate_id"], out["admet_score"]))
    assert out["toxicity_risk_source"].eq("trained_admet_model").all()
    assert scores["low_risk"] > scores["high_risk"]
