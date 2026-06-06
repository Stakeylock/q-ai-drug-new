"""End-to-End Scientific Golden Path integration test.

Validates the full 9-module chain:
1. OncoData Builder (Curation, split)
2. Q-Filter (Structure filtering, ADMET proxies)
3. Activity Model Studio (Train then predict)
4. Applicability Domain Guard (Fingerprint domain)
5. Q-Dock Studio (Docking prioritization)
6. Q-Orbital Analyzer (QM prioritization)
7. Q-Rank (Evidence fusion)
8. Wet-Lab Triage (Triage classes)
9. Q-Report (Final dossier)
"""

from pathlib import Path

import pandas as pd
import pytest

from q_ai_drug.product.module_runners import get_runner

try:
    from rdkit import Chem
    HAS_RDKIT = True
except ImportError:
    HAS_RDKIT = False


@pytest.fixture
def project_dir(tmp_path):
    """Setup project directory structure."""
    proj = tmp_path / "project"
    proj.mkdir()
    (proj / "uploads").mkdir()
    (proj / "configs").mkdir()
    (proj / "data" / "processed").mkdir(parents=True)
    return proj


def test_scientific_golden_path(project_dir):
    """Run the entire pipeline and verify scientific boundaries."""
    if not HAS_RDKIT:
        pytest.skip("RDKit required for full golden path execution.")

    def make_runner(module_id, run_id, payload):
        runner_class = get_runner(module_id)
        assert runner_class is not None, f"{module_id} is not registered"
        return runner_class(module_id, project_dir, run_id, payload)

    # 1. Provide initial benchmark data
    benchmark_csv = project_dir / "data" / "processed" / "oncology_benchmark.csv"
    pd.DataFrame([
        {"target_id": "EGFR", "canonical_smiles": "c1ccccc1", "p_activity": 7.0, "source": "benchmark", "curation_kept": True},
        {"target_id": "EGFR", "canonical_smiles": "CCO", "p_activity": 6.5, "source": "benchmark", "curation_kept": True},
        {"target_id": "EGFR", "canonical_smiles": "CCC", "p_activity": 5.0, "source": "benchmark", "curation_kept": True},
        {"target_id": "EGFR", "canonical_smiles": "CC(C)C", "p_activity": 5.5, "source": "benchmark", "curation_kept": True},
        {"target_id": "EGFR", "canonical_smiles": "CCCC", "p_activity": 6.0, "source": "benchmark", "curation_kept": True},
    ]).to_csv(benchmark_csv, index=False)
    upload_benchmark_csv = project_dir / "uploads" / "oncology_benchmark_upload.csv"
    upload_benchmark_csv.write_bytes(benchmark_csv.read_bytes())

    config_path = project_dir / "configs" / "cancer_targets.yaml"
    config_path.write_text("primary_targets:\n  EGFR:\n    gene: EGFR\n")

    def get_artifact(res, desc_fragment):
        for a in res["artifacts"]:
            if desc_fragment.lower() in a.get("name", "").lower() or desc_fragment.lower() in a.get("type", "").lower():
                return Path(a["uri"])
        raise ValueError(f"Artifact {desc_fragment} not found in {res['artifacts']}")
        
    def chain_file(res, desc_fragment, new_name):
        path = get_artifact(res, desc_fragment)
        dest = project_dir / "uploads" / new_name
        dest.write_bytes(path.read_bytes())
        return new_name

    # 1. OncoData Builder
    runner1 = make_runner(
        "onco_data_builder",
        "run1",
        {
            "target_ids": ["EGFR"],
            "data_sources": "uploaded_only",
            "uploaded_assay_csv": upload_benchmark_csv.name,
        },
    )
    res1 = runner1.execute()
    assert res1["status"] == "succeeded"
    onco_file = chain_file(res1, "curated_activity_with_split", "onco_out.csv")

    # 2. Q-Filter
    runner2 = make_runner("q_filter", "run2", {
        "candidate_upload_file": onco_file,
        "filter_profile": "standard"
    })
    res2 = runner2.execute()
    print("Q-FILTER RESULT:", res2)
    assert res2["status"] == "succeeded", str(res2)
    filtered_file = chain_file(res2, "filtered", "filtered_out.csv")

    # 3. Activity Model Studio (Predict fallback)
    runner3 = make_runner("activity_model_studio", "run3", {
        "candidate_upload_file": filtered_file,
        "mode": "predict"
    })
    res3 = runner3.execute()
    assert res3["status"] == "succeeded", res3.get("failure_message", str(res3))
    activity_file = chain_file(res3, "activity_predictions", "activity_out.csv")

    # 4. Applicability Domain Guard
    runner4 = make_runner("applicability_domain_guard", "run4", {
        "candidate_upload_file": filtered_file,
        "training_set_upload_file": onco_file,
    })
    res4 = runner4.execute()
    assert res4["status"] == "succeeded", str(res4)
    domain_file = chain_file(res4, "applicability_domain", "domain_out.csv")

    # 5. Q-Dock Studio (Mock since no real Vina setup in tmp_path)
    receptor_path = project_dir / "uploads" / "rec.pdb"
    receptor_path.write_text("ATOM      1  CA  ALA A   1      10.000  20.000  30.000  1.00  0.00           C\n")
    runner5 = make_runner("q_dock_studio", "run5", {
        "receptor_upload_file": "rec.pdb",
        "ligand_upload_file": filtered_file,
        "pocket_source": "uploaded_box",
        "pocket_box": {"center_x": 0, "center_y": 0, "center_z": 0, "size_x": 10, "size_y": 10, "size_z": 10}
    })
    res5 = runner5.execute()
    assert res5["status"] == "succeeded", res5.get("failure_message", str(res5))
    docking_file = chain_file(res5, "docking results", "docking_out.csv")

    # 6. Q-Orbital Analyzer (EHT fallback)
    runner6 = make_runner("q_orbital_analyzer", "run6", {
        "candidate_upload_file": filtered_file,
        "method": "auto"
    })
    res6 = runner6.execute()
    assert res6["status"] == "succeeded", res6.get("failure_message", str(res6))
    orbital_file = chain_file(res6, "qm descriptors", "orbital_out.csv")

    # 7. Q-Rank (Evidence fusion)
    q_rank_class = get_runner("q_rank")
    assert q_rank_class is not None
    assert q_rank_class.__module__ == "q_ai_drug.product.module_runners.q_rank_scientific"
    runner7 = make_runner("q_rank", "run7", {
        "candidate_upload_file": domain_file,  # Has domain features
        "docking_results_upload_file": docking_file,
        "activity_predictions_upload_file": activity_file,
        "domain_upload_file": domain_file,
        "orbital_upload_file": orbital_file,
    })
    res7 = runner7.execute()
    assert res7["status"] == "succeeded", res7.get("failure_message", str(res7))
    rank_file = chain_file(res7, "ranked_candidates", "rank_out.csv")
    evidence_status_file = chain_file(res7, "evidence_status_report", "evidence_status_out.csv")
    rank_ablation_file = chain_file(res7, "rank_ablation", "rank_ablation_out.csv")

    # 8. Wet-Lab Triage
    runner8 = make_runner("wet_lab_triage_board", "run8", {
        "candidate_upload_file": rank_file
    })
    res8 = runner8.execute()
    assert res8["status"] == "succeeded", res8.get("failure_message", str(res8))
    triage_file = chain_file(res8, "wet_lab_triage_board", "triage_out.csv")

    # Verify Wet-Lab Triage output schema and reasoning
    triage_csv = project_dir / "module_runs" / "wet_lab_triage_board" / "run8" / "wet_lab_triage_board.csv"
    triage_df = pd.read_csv(triage_csv)
    assert "triage_class" in triage_df.columns
    assert "scientific_utility" in triage_df.columns
    assert "reasons_to_test" in triage_df.columns
    assert "reasons_not_to_test" in triage_df.columns
    assert len(triage_df) > 0

    # 9. Q-Report
    q_report_class = get_runner("q_report")
    assert q_report_class is not None
    assert q_report_class.__module__ == "q_ai_drug.product.module_runners.q_report_scientific"
    runner9 = make_runner("q_report", "run9", {
        "candidate_ids": [str(cid) for cid in triage_df["candidate_id"]],
        "ranked_candidates_upload_file": rank_file,
        "triage_upload_file": triage_file,
        "evidence_status_upload_file": evidence_status_file,
        "rank_ablation_upload_file": rank_ablation_file,
        "report_template": "comprehensive",
    })
    res9 = runner9.execute()
    assert res9["status"] == "succeeded"
    report_md = project_dir / "module_runs" / "q_report" / "run9" / "report.md"
    content = report_md.read_text()
    assert "WARNING" in content
    assert "Scientific Claim Boundaries" in content
    assert "Computational candidate dossier only" in content
