from pathlib import Path

import pandas as pd

from q_ai_drug.research.candidate_evidence import build_candidate_evidence_documents


def test_candidate_evidence_documents_are_mongodb_shaped(tmp_path: Path):
    project = tmp_path
    pd.DataFrame(
        [
            {
                "target_id": "EGFR",
                "candidate_id": "A",
                "canonical_smiles": "CCO",
                "activity_score": 0.8,
                "admet_score": 0.7,
                "affinity_kcal_mol": -7.1,
                "final_score": 0.75,
                "png_path": "a.png",
            }
        ]
    ).to_csv(project / "final_ranked_candidates.csv", index=False)
    (project / "triage").mkdir()
    pd.DataFrame(
        [
            {
                "target_id": "EGFR",
                "candidate_id": "A",
                "triage_class": "test_after_review",
                "triage_confidence": "medium",
                "reasons_to_test": "activity prediction inside domain",
                "reasons_not_to_test": "requires assay validation",
                "recommended_assay_plan": "biochemical IC50",
            }
        ]
    ).to_csv(project / "triage" / "wet_lab_triage_board.csv", index=False)

    summary = build_candidate_evidence_documents(project, project_id="p1")

    assert summary["candidate_evidence_documents"] == 1
    jsonl = project / "candidate_evidence" / "candidate_evidence.jsonl"
    assert jsonl.exists()
    text = jsonl.read_text(encoding="utf-8")
    assert '"candidate_id": "A"' in text
    assert (project / "candidate_evidence" / "mongodb_indexes.json").exists()

