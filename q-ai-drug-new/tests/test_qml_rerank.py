import pandas as pd

from q_ai_drug.qml.qsvm_rerank import quantum_kernel_scores


def test_quantum_kernel_scores_adds_columns() -> None:
    df = pd.DataFrame(
        {
            "target_id": ["EGFR", "EGFR"],
            "candidate_id": ["a", "b"],
            "homo_lumo_gap_ev": [4.1, 5.2],
            "dipole_debye": [2.0, 4.0],
            "quantum_score": [0.8, 0.7],
            "affinity_kcal_mol": [-9.0, -8.0],
        }
    )
    out = quantum_kernel_scores(df)
    assert "qml_score" in out.columns
    assert out["qml_score"].between(0, 1).all()
