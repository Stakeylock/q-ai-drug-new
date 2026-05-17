"""Lightweight scientific contract tests for standalone module runners.

These tests intentionally avoid RDKit, Vina, xTB, GNINA, and other heavyweight
runtime tools. They lock the Python-level contracts that protect scientific
honesty in user-facing module runs.
"""

from q_ai_drug.product.module_runners import get_runner
from q_ai_drug.service.tool_payloads import validate_payload


def test_q_orbital_payload_supports_strict_xtb_no_fallback():
    payload = validate_payload(
        "q_orbital_analyzer",
        {
            "candidate_upload_file": "molecules.csv",
            "method": "xtb",
            "allow_fallback": False,
            "max_molecules": 5,
        },
    )
    assert payload["method"] == "xtb"
    assert payload["allow_fallback"] is False
    assert payload["max_molecules"] == 5


def test_q_rank_payload_accepts_domain_and_orbital_evidence():
    payload = validate_payload(
        "q_rank",
        {
            "candidate_upload_file": "candidates.csv",
            "activity_predictions_upload_file": "activity.csv",
            "docking_results_upload_file": "docking.csv",
            "domain_upload_file": "domain.csv",
            "orbital_upload_file": "qm.csv",
            "ranking_method": "ensemble",
        },
    )
    assert payload["domain_upload_file"] == "domain.csv"
    assert payload["orbital_upload_file"] == "qm.csv"


def test_q_report_payload_accepts_evidence_artifacts():
    payload = validate_payload(
        "q_report",
        {
            "candidate_ids": ["cand_1", "cand_2"],
            "ranked_candidates_upload_file": "ranked_candidates.csv",
            "triage_upload_file": "wet_lab_triage_board.csv",
            "evidence_status_upload_file": "evidence_status_report.csv",
            "rank_ablation_upload_file": "rank_ablation.csv",
            "report_template": "comprehensive",
        },
    )
    assert payload["candidate_ids"] == ["cand_1", "cand_2"]
    assert payload["ranked_candidates_upload_file"] == "ranked_candidates.csv"
    assert payload["evidence_status_upload_file"] == "evidence_status_report.csv"
    assert payload["rank_ablation_upload_file"] == "rank_ablation.csv"


def test_q_rank_routes_to_scientific_runner():
    runner = get_runner("q_rank")
    assert runner is not None
    assert runner.__module__ == "q_ai_drug.product.module_runners.q_rank_scientific"


def test_q_report_routes_to_scientific_runner():
    runner = get_runner("q_report")
    assert runner is not None
    assert runner.__module__ == "q_ai_drug.product.module_runners.q_report_scientific"


def test_q_dock_payload_preserves_gnina_request_for_honest_downgrade():
    payload = validate_payload(
        "q_dock_studio",
        {
            "receptor_upload_file": "receptor.pdb",
            "ligand_upload_file": "ligands.csv",
            "engine": "vina_smina_gnina",
            "pocket_source": "uploaded_box",
            "pocket_box": {
                "center_x": 0,
                "center_y": 0,
                "center_z": 0,
                "size_x": 20,
                "size_y": 20,
                "size_z": 20,
            },
            "run_redocking_validation": True,
        },
    )
    assert payload["engine"] == "vina_smina_gnina"
    assert payload["run_redocking_validation"] is True
