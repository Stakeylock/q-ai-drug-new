from pathlib import Path

import pandas as pd

from q_ai_drug.reporting.product_metrics import build_investor_metrics


def test_build_investor_metrics_minimal_project(tmp_path: Path) -> None:
    project = tmp_path / "project"
    (project / "models").mkdir(parents=True)
    (project / "docking").mkdir()
    (project / "gnina").mkdir()
    (project / "md").mkdir()
    (project / "qm").mkdir()
    (project / "qml").mkdir()
    (project / "figures").mkdir()

    (project / "run_summary.json").write_text(
        """
        {
          "benchmark_records": 3,
          "generated_candidates": 30,
          "filtered_candidates": 12,
          "quantum_prefilter_rows": 12,
          "docking_rows": 6,
          "docking_real": true,
          "md_rows": 3,
          "md_real": true,
          "qm_rows": 3,
          "qml_rows": 3,
          "gnina_rows": 3,
          "gnina_completed": 3,
          "ranked_rows": 6,
          "external_tools": {
            "vina": {"available": true},
            "smina": {"available": true},
            "gnina": {"available": true},
            "obabel": {"available": true},
            "xtb": {"available": true}
          }
        }
        """,
        encoding="utf-8",
    )
    (project / "validation_report.json").write_text('{"status": "pass", "errors": [], "warnings": []}', encoding="utf-8")
    (project / "production_validation_report.json").write_text('{"status": "pass", "errors": [], "warnings": []}', encoding="utf-8")
    (project / "report.html").write_text("<html></html>", encoding="utf-8")
    (project / "report.pdf").write_bytes(b"%PDF-1.4\n%test")

    pd.DataFrame(
        {
            "target_id": ["EGFR", "PARP1", "PIK3CA"],
            "candidate_id": ["a", "b", "c"],
            "final_score": [0.9, 0.8, 0.7],
            "quantum_ablation_delta": [0.1, 0.0, -0.1],
        }
    ).to_csv(project / "top_candidates.csv", index=False)
    pd.DataFrame({"target_id": ["EGFR", "PARP1", "PIK3CA"]}).to_csv(project / "docking" / "results.csv", index=False)
    pd.DataFrame({"target_id": ["EGFR", "PARP1", "PIK3CA"]}).to_csv(project / "gnina" / "results.csv", index=False)
    pd.DataFrame({"target_id": ["EGFR", "PARP1", "PIK3CA"]}).to_csv(project / "qm" / "qm_descriptors.csv", index=False)
    pd.DataFrame({"target_id": ["EGFR", "PARP1", "PIK3CA"]}).to_csv(project / "qml" / "quantum_kernel_scores.csv", index=False)
    pd.DataFrame({"target_id": ["EGFR", "PARP1", "PIK3CA"]}).to_csv(project / "qml" / "quantum_prefilter_scores.csv", index=False)
    pd.DataFrame({"target_id": ["EGFR", "PARP1", "PIK3CA"], "roc_auc": [0.8, 0.7, 0.9], "average_precision": [0.5, 0.4, 0.6]}).to_csv(
        project / "models" / "baseline_activity_metrics.csv",
        index=False,
    )
    pd.DataFrame(
        {
            "dataset": ["tox21", "clintox"],
            "endpoint": ["A", "B"],
            "roc_auc": [0.8, 0.75],
            "average_precision": [0.3, 0.4],
            "model_path": ["a.joblib", "b.joblib"],
        }
    ).to_csv(project / "models" / "admet_model_metrics.csv", index=False)
    pd.DataFrame({"target_id": ["EGFR", "PARP1", "PIK3CA"]}).to_csv(project / "models" / "rediscovery_metrics.csv", index=False)
    benchmark = tmp_path / "benchmark.csv"
    pd.DataFrame({"target_id": ["EGFR", "PARP1", "PIK3CA"]}).to_csv(benchmark, index=False)

    metrics = build_investor_metrics(project, benchmark)

    assert metrics["headline"]["generated_candidates"] == 30
    assert metrics["headline"]["production_gate"] == "pass"
    assert metrics["model_quality"]["admet_trained_endpoints"] == 2
    assert {row["target_id"] for row in metrics["targets"]} == {"EGFR", "PARP1", "PIK3CA"}
    assert any(tool["name"] == "Q-Dock Studio" and tool["status"] == "REAL" for tool in metrics["tool_suite"])
