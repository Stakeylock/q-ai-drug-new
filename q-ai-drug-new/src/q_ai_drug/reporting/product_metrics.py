from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


PRIMARY_TARGETS = ["EGFR", "PARP1", "PIK3CA"]


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_csv(path)
    except Exception:
        return pd.DataFrame()


def _count(path: Path) -> int:
    df = _read_csv(path)
    return int(len(df)) if not df.empty else 0


def _safe_float(value: object, default: float | None = None) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if pd.isna(number):
        return default
    return number


def _safe_int(value: object, default: int = 0) -> int:
    try:
        if pd.isna(value):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _artifact_available(path: Path) -> bool:
    return path.exists() and path.is_file() and path.stat().st_size > 0


def _target_rows(project_dir: Path, benchmark_path: Path) -> list[dict[str, Any]]:
    benchmark = _read_csv(benchmark_path)
    top = _read_csv(project_dir / "top_candidates.csv")
    docking = _read_csv(project_dir / "docking" / "results.csv")
    gnina = _read_csv(project_dir / "gnina" / "results.csv")
    qm = _read_csv(project_dir / "qm" / "qm_descriptors.csv")
    qml = _read_csv(project_dir / "qml" / "quantum_kernel_scores.csv")

    rows: list[dict[str, Any]] = []
    for target_id in PRIMARY_TARGETS:
        target_top = top[top.get("target_id", pd.Series(dtype=str)).astype(str).eq(target_id)] if not top.empty else pd.DataFrame()
        best = target_top.sort_values("final_score", ascending=False).head(1) if "final_score" in target_top.columns else target_top.head(1)
        best_row = best.iloc[0].to_dict() if not best.empty else {}
        rows.append(
            {
                "target_id": target_id,
                "benchmark_records": int((benchmark["target_id"].astype(str) == target_id).sum()) if "target_id" in benchmark.columns else 0,
                "top_candidates": int(len(target_top)),
                "best_candidate": best_row.get("candidate_id"),
                "best_final_score": _safe_float(best_row.get("final_score")),
                "best_quantum_delta": _safe_float(best_row.get("quantum_ablation_delta")),
                "docking_rows": int((docking["target_id"].astype(str) == target_id).sum()) if "target_id" in docking.columns else 0,
                "gnina_rows": int((gnina["target_id"].astype(str) == target_id).sum()) if "target_id" in gnina.columns else 0,
                "qm_rows": int((qm["target_id"].astype(str) == target_id).sum()) if "target_id" in qm.columns else 0,
                "qml_rows": int((qml["target_id"].astype(str) == target_id).sum()) if "target_id" in qml.columns else 0,
            }
        )
    return rows


def _model_quality(project_dir: Path) -> dict[str, Any]:
    activity = _read_csv(project_dir / "models" / "baseline_activity_metrics.csv")
    admet = _read_csv(project_dir / "models" / "admet_model_metrics.csv")
    rediscovery = _read_csv(project_dir / "models" / "rediscovery_metrics.csv")
    trained_admet = admet[admet.get("model_path", pd.Series(dtype=str)).fillna("").astype(str).str.len() > 0] if not admet.empty else pd.DataFrame()
    return {
        "activity_models": int(activity["target_id"].nunique()) if "target_id" in activity.columns else 0,
        "activity_mean_roc_auc": _safe_float(pd.to_numeric(activity.get("roc_auc", pd.Series(dtype=float)), errors="coerce").mean()),
        "activity_mean_average_precision": _safe_float(pd.to_numeric(activity.get("average_precision", pd.Series(dtype=float)), errors="coerce").mean()),
        "admet_trained_endpoints": int(len(trained_admet)),
        "admet_mean_roc_auc": _safe_float(pd.to_numeric(trained_admet.get("roc_auc", pd.Series(dtype=float)), errors="coerce").mean()),
        "admet_mean_average_precision": _safe_float(pd.to_numeric(trained_admet.get("average_precision", pd.Series(dtype=float)), errors="coerce").mean()),
        "rediscovery_rows": int(len(rediscovery)),
    }


def _tool_suite(project_dir: Path) -> list[dict[str, Any]]:
    summary = _read_json(project_dir / "run_summary.json")
    tools = summary.get("external_tools") or _read_json(project_dir / "external_tools_manifest.json")
    smoke = _read_json(Path("outputs") / "tool_smoke" / "external_tool_smoke.json")
    return [
        {
            "name": "OncoData Builder",
            "status": "REAL" if Path("data/processed/oncology_benchmark.csv").exists() else "FAILED",
            "evidence": "ChEMBL/PubChem/MoleculeNet/RCSB/AlphaFold cache",
            "output": "Benchmark and reference inhibitor tables",
        },
        {
            "name": "Q-Generate",
            "status": "REAL" if _count(project_dir / "generated.csv") else "FAILED",
            "evidence": "Target-conditioned candidate generation",
            "output": "Generated SMILES and scored candidates",
        },
        {
            "name": "Q-Filter",
            "status": "REAL" if _count(project_dir / "filtered.csv") else "FAILED",
            "evidence": "RDKit descriptors, PAINS/Brenk, trained ADMET probabilities",
            "output": "Filtered medicinal chemistry table",
        },
        {
            "name": "Q-Portfolio Prefilter",
            "status": "REAL" if _count(project_dir / "qml" / "quantum_prefilter_scores.csv") else "FAILED",
            "evidence": "Qiskit statevector quantum kernel",
            "output": "Quantum-prioritized docking portfolio",
        },
        {
            "name": "Q-Dock Studio",
            "status": "REAL" if _safe_int(summary.get("docking_rows")) and summary.get("docking_real") else "EXPLORATORY",
            "evidence": "AutoDock Vina plus Smina local minimization",
            "output": "Docking scores, PDBQT/SDF poses, logs",
        },
        {
            "name": "GNINA CNN Docking",
            "status": "REAL" if _safe_int(summary.get("gnina_completed")) else "PLANNED",
            "evidence": "GNINA 1.3 CPU CNN rescoring",
            "output": "CNN pose scores, CNN affinity, docked SDF poses",
        },
        {
            "name": "Q-View 3D",
            "status": "REAL" if Path("data/structures/EGFR_alphafold.pdb").exists() else "FAILED",
            "evidence": "3Dmol.js receptor/ligand viewer",
            "output": "Protein-ligand visual inspection",
        },
        {
            "name": "Q-Orbital Analyzer",
            "status": "REAL" if _count(project_dir / "qm" / "qm_descriptors.csv") else "FAILED",
            "evidence": "xTB GFN2 single-point descriptors",
            "output": "HOMO/LUMO/gap/energy descriptors",
        },
        {
            "name": "Q-Rank",
            "status": "REAL" if _count(project_dir / "final_ranked_candidates.csv") else "FAILED",
            "evidence": "Classical plus quantum ablation ranking",
            "output": "Final ranked candidates with quantum delta",
        },
        {
            "name": "Q-Report",
            "status": "REAL" if _artifact_available(project_dir / "report.html") and _artifact_available(project_dir / "report.pdf") else "FAILED",
            "evidence": "HTML/PDF report builder",
            "output": "Shareable evidence package",
        },
        {
            "name": "Model Playground",
            "status": "REAL" if Path("models/activity").exists() and Path("models/admet/admet_models.joblib").exists() else "FAILED",
            "evidence": "FastAPI single and batch prediction endpoints",
            "output": "Interactive target/activity/ADMET scoring",
        },
        {
            "name": "External Tool Chain",
            "status": "REAL" if all((tools.get(name) or {}).get("available") for name in ["vina", "smina", "gnina", "obabel", "xtb"]) else "FAILED",
            "evidence": ", ".join(name for name, payload in smoke.items() if payload.get("ok")) or "Tool manifest",
            "output": "Vina/Smina/GNINA/OpenBabel/xTB smoke evidence",
        },
    ]


def _pipeline_funnel(project_dir: Path) -> list[dict[str, Any]]:
    summary = _read_json(project_dir / "run_summary.json")
    stages = [
        ("Benchmark records", summary.get("benchmark_records"), "REAL", "Public dataset retrieval and curation"),
        ("Generated candidates", summary.get("generated_candidates"), "REAL", "Q-Generate"),
        ("Filtered candidates", summary.get("filtered_candidates"), "REAL", "Q-Filter"),
        ("Quantum prefilter rows", summary.get("quantum_prefilter_rows"), "REAL", "Qiskit portfolio kernel"),
        ("Docking rows", summary.get("docking_rows"), "REAL" if summary.get("docking_real") else "EXPLORATORY", "Vina/Smina"),
        ("OpenMM relaxation rows", summary.get("md_rows"), "REAL" if summary.get("md_real") else "EXPLORATORY", "Ligand-pose relaxation"),
        ("xTB QM rows", summary.get("qm_rows"), "REAL", "GFN2 single-point descriptors"),
        ("QML rerank rows", summary.get("qml_rows"), "REAL", "Qiskit statevector kernel"),
        ("GNINA CNN rows", summary.get("gnina_rows"), "REAL" if summary.get("gnina_completed") else "PLANNED", "GNINA selected top candidates"),
        ("Ranked rows", summary.get("ranked_rows"), "REAL", "Final ranking and ablation"),
    ]
    return [{"stage": label, "count": _safe_int(value), "method_tier": tier, "evidence": evidence} for label, value, tier, evidence in stages]


def _demo_flow() -> list[dict[str, str]]:
    return [
        {"minute": "0:00-1:00", "screen": "Investor website", "proof": "Product story, proof metrics, research-use disclaimer"},
        {"minute": "1:00-2:00", "screen": "Platform workflow", "proof": "Named Q-AI tools and architecture"},
        {"minute": "2:00-3:30", "screen": "Discovery Console overview", "proof": "Cached cancer proof run, validation gates, report links"},
        {"minute": "3:30-5:00", "screen": "Target workspace", "proof": "EGFR/PARP1/PIK3CA data and model coverage"},
        {"minute": "5:00-6:30", "screen": "Candidate table", "proof": "2D structures, scores, quantum deltas"},
        {"minute": "6:30-8:00", "screen": "3D viewer and GNINA", "proof": "Protein-ligand pose and CNN scores"},
        {"minute": "8:00-9:00", "screen": "Quantum tab", "proof": "Q-Portfolio, xTB descriptors, QML reranking"},
        {"minute": "9:00-10:00", "screen": "Reports", "proof": "Downloadable HTML/PDF evidence package and business path"},
    ]


def build_investor_metrics(
    project_dir: str | Path = "outputs/cancer_proof_v1",
    benchmark_path: str | Path = "data/processed/oncology_benchmark.csv",
) -> dict[str, Any]:
    project_dir = Path(project_dir)
    benchmark_path = Path(benchmark_path)
    summary = _read_json(project_dir / "run_summary.json")
    validation = _read_json(project_dir / "validation_report.json")
    production = _read_json(project_dir / "production_validation_report.json")
    figures = sorted((project_dir / "figures").glob("*.png"))
    model_quality = _model_quality(project_dir)
    top = _read_csv(project_dir / "top_candidates.csv")
    quantum_delta = pd.to_numeric(top.get("quantum_ablation_delta", pd.Series(dtype=float)), errors="coerce") if not top.empty else pd.Series(dtype=float)
    payload: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project_dir": str(project_dir),
        "research_use_statement": (
            "All outputs are computational research hypotheses. Synthesis, assays, ADMET experiments, "
            "selectivity profiling, safety studies, and regulatory review are required before therapeutic claims."
        ),
        "headline": {
            "targets": len(PRIMARY_TARGETS),
            "generated_candidates": _safe_int(summary.get("generated_candidates")),
            "filtered_candidates": _safe_int(summary.get("filtered_candidates")),
            "docking_rows": _safe_int(summary.get("docking_rows")),
            "gnina_rows": _safe_int(summary.get("gnina_rows")),
            "qm_rows": _safe_int(summary.get("qm_rows")),
            "qml_rows": _safe_int(summary.get("qml_rows")),
            "ranked_candidates": _safe_int(summary.get("ranked_rows")),
            "trained_admet_endpoints": model_quality["admet_trained_endpoints"],
            "activity_mean_roc_auc": model_quality["activity_mean_roc_auc"],
            "production_gate": production.get("status", "not_checked"),
            "proof_gate": validation.get("status", "not_checked"),
            "figures": len(figures),
            "report_html": _artifact_available(project_dir / "report.html"),
            "report_pdf": _artifact_available(project_dir / "report.pdf"),
        },
        "targets": _target_rows(project_dir, benchmark_path),
        "pipeline_funnel": _pipeline_funnel(project_dir),
        "tool_suite": _tool_suite(project_dir),
        "model_quality": model_quality,
        "quantum": {
            "prefilter_rows": _safe_int(summary.get("quantum_prefilter_rows")),
            "qml_rows": _safe_int(summary.get("qml_rows")),
            "qm_rows": _safe_int(summary.get("qm_rows")),
            "mean_quantum_delta": _safe_float(quantum_delta.mean()) if not quantum_delta.empty else None,
            "max_quantum_delta": _safe_float(quantum_delta.max()) if not quantum_delta.empty else None,
            "current_claim": "Qiskit statevector kernels and xTB descriptors are active research signals; no hardware speedup is claimed.",
        },
        "validation": {
            "proof": {
                "status": validation.get("status", "not_checked"),
                "errors": validation.get("errors", []),
                "warnings": validation.get("warnings", []),
            },
            "production": {
                "status": production.get("status", "not_checked"),
                "errors": production.get("errors", []),
                "warnings": production.get("warnings", []),
            },
        },
        "artifacts": [
            {"label": "Scientific HTML report", "path": str(project_dir / "report.html"), "available": _artifact_available(project_dir / "report.html")},
            {"label": "Scientific PDF report", "path": str(project_dir / "report.pdf"), "available": _artifact_available(project_dir / "report.pdf")},
            {"label": "Top candidates", "path": str(project_dir / "top_candidates.csv"), "available": _artifact_available(project_dir / "top_candidates.csv")},
            {"label": "Final ranking", "path": str(project_dir / "final_ranked_candidates.csv"), "available": _artifact_available(project_dir / "final_ranked_candidates.csv")},
            {"label": "GNINA results", "path": str(project_dir / "gnina" / "results.csv"), "available": _artifact_available(project_dir / "gnina" / "results.csv")},
            {"label": "Run manifest", "path": str(project_dir / "run_manifest.json"), "available": _artifact_available(project_dir / "run_manifest.json")},
        ],
        "demo_flow": _demo_flow(),
        "limitations": [
            "Current Vina/Smina/GNINA boxes are exploratory receptor-centroid boxes until curated oncology pocket definitions are added.",
            "OpenMM output is a real ligand-pose relaxation/trajectory triage layer, not full explicit-solvent protein-ligand MD or FEP.",
            "Tox21/ClinTox ADMET models are useful triage signals and must be expanded before therapeutic decision-making.",
            "Quantum components are active research prioritization features with classical ablations; they do not claim hardware superiority.",
        ],
        "next_scientific_upgrades": [
            "Curated pocket registry for EGFR, PARP1, and PIK3CA with co-crystal/literature provenance.",
            "DiffDock/Boltz-style complex hypothesis lane for comparison with Vina/Smina/GNINA.",
            "Expanded ADMET endpoints including hERG, CYP, permeability, metabolic stability, and selectivity.",
            "Explicit-solvent OpenMM complex preparation and late-stage FEP-style validation for a tiny top set.",
        ],
    }
    return payload
