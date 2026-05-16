from pathlib import Path

import pandas as pd

from q_ai_drug.research.wet_lab_triage import build_wet_lab_triage_board


def test_wet_lab_triage_generates_reasons_for_all_candidates(tmp_path: Path):
    project = tmp_path
    pd.DataFrame(
        [
            {"target_id": "EGFR", "candidate_id": "A", "canonical_smiles": "CCO", "final_score": 0.82, "activity_score": 0.9, "qm_is_real": True},
            {"target_id": "EGFR", "candidate_id": "B", "canonical_smiles": "CCC", "final_score": 0.40, "activity_score": 0.2, "qm_is_real": False},
        ]
    ).to_csv(project / "final_ranked_candidates.csv", index=False)
    (project / "models").mkdir()
    pd.DataFrame(
        [
            {"target_id": "EGFR", "candidate_id": "A", "prediction_confidence": 0.9},
            {"target_id": "EGFR", "candidate_id": "B", "prediction_confidence": 0.2},
        ]
    ).to_csv(project / "models" / "applicability_domain.csv", index=False)
    (project / "medchem").mkdir()
    pd.DataFrame(
        [
            {"target_id": "EGFR", "candidate_id": "A", "medchem_risk_class": "clean", "medchem_risk_reasons": "clean"},
            {"target_id": "EGFR", "candidate_id": "B", "medchem_risk_class": "reject", "medchem_risk_reasons": "test reject"},
        ]
    ).to_csv(project / "medchem" / "medchem_risk_table.csv", index=False)
    (project / "admet").mkdir()
    pd.DataFrame(
        [
            {"target_id": "EGFR", "candidate_id": "A", "admet_risk_class": "low"},
            {"target_id": "EGFR", "candidate_id": "B", "admet_risk_class": "high"},
        ]
    ).to_csv(project / "admet" / "candidate_admet_risk_table.csv", index=False)
    (project / "docking").mkdir()
    pd.DataFrame(
        [
            {"target_id": "EGFR", "candidate_id": "A", "interaction_quality": "plausible_key_pocket_contacts"},
            {"target_id": "EGFR", "candidate_id": "B", "interaction_quality": "missing_pose"},
        ]
    ).to_csv(project / "docking" / "interaction_fingerprints.csv", index=False)
    pd.DataFrame(
        [{"target_id": "EGFR", "redocking_rmsd_angstrom": 1.2, "redocking_status": "completed"}]
    ).to_csv(project / "docking" / "redocking_validation.csv", index=False)
    (project / "inhibitors").mkdir()
    pd.DataFrame(
        [
            {"target_id": "EGFR", "candidate_id": "A", "nearest_inhibitor_similarity": 0.5},
            {"target_id": "EGFR", "candidate_id": "B", "nearest_inhibitor_similarity": 0.95},
        ]
    ).to_csv(project / "inhibitors" / "candidate_inhibitor_proximity.csv", index=False)

    triage = build_wet_lab_triage_board(project)

    assert len(triage) == 2
    assert triage["reasons_to_test"].astype(str).str.len().gt(0).all()
    assert triage["reasons_not_to_test"].astype(str).str.len().gt(0).all()
    assert (project / "triage" / "wet_lab_triage_summary.json").exists()
    assert set(triage["triage_class"]).issubset({"test_now", "test_after_review", "watchlist", "reject_hold"})

