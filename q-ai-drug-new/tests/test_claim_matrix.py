from __future__ import annotations

from q_ai_drug.research.scientific_study import _claim_matrix, _strict_report


def test_claim_matrix_level3_not_available(tmp_path):
    matrix = _claim_matrix(tmp_path)
    level3 = matrix[matrix["evidence_level"].eq("Level 3")].iloc[0]
    assert level3["current_status"] == "not_available"
    assert {"forbidden_claim", "required_next_evidence"}.issubset(matrix.columns)


def test_strict_report_has_no_forbidden_therapeutic_claims(tmp_path):
    _strict_report(tmp_path, {"curated_rows": 0, "baseline_rows": 0, "applicability_rows": 0, "interaction_rows": 0, "candidate_dossiers": 0})
    text = (tmp_path / "strict_scientific_report.md").read_text(encoding="utf-8").lower()
    for forbidden in ["validated cancer drug", "clinically effective", "approved therapy", "confirmed experimental hit", "we discovered a cancer drug"]:
        assert forbidden not in text
    for section in range(1, 25):
        assert f"## {section}." in text
