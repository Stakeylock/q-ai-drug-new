from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pandas as pd


REFERENCE_WINDOW = range(2020, 2027)


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    import json

    return json.loads(path.read_text(encoding="utf-8"))


def _read_csv(path: Path, limit: int | None = None) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    df = pd.read_csv(path)
    if limit:
        return df.head(limit)
    return df


def _reference_stats(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    keys = re.findall(r"^@\w+\{([^,\s]+)", text, flags=re.MULTILINE)
    years = [int(match) for match in re.findall(r"year\s*=\s*\{?(\d{4})", text, flags=re.IGNORECASE)]
    recent = [year for year in years if year in REFERENCE_WINDOW]
    return {
        "file": str(path),
        "total_entries": len(keys),
        "recent_2020_2026_entries": len(recent),
        "oldest_year": min(years) if years else None,
        "newest_year": max(years) if years else None,
    }


def _records(df: pd.DataFrame, columns: list[str] | None = None) -> list[dict[str, Any]]:
    if df.empty:
        return []
    if columns:
        available = [column for column in columns if column in df.columns]
        df = df[available]
    return df.astype(object).where(pd.notna(df), None).to_dict("records")


def build_scientific_evidence(project_dir: str | Path = "outputs/cancer_proof_v1", references_path: str | Path = "references.bib") -> dict[str, Any]:
    project_dir = Path(project_dir)
    references_path = Path(references_path)
    validation = _read_json(project_dir / "production_validation_report.json")
    redocking = _read_csv(project_dir / "docking" / "redocking_validation.csv")
    summary = _read_json(project_dir / "run_summary.json")
    ranking = _read_csv(project_dir / "final_ranked_candidates.csv")
    top = _read_csv(project_dir / "top_candidates.csv", limit=30)
    gnina = _read_csv(project_dir / "gnina" / "results.csv")
    qml = _read_csv(project_dir / "qml" / "quantum_kernel_scores.csv")
    qprefilter = _read_csv(project_dir / "qml" / "quantum_prefilter_scores.csv")

    high_confidence_redocking = 0
    if not redocking.empty and "redocking_rmsd_angstrom" in redocking.columns:
        rmsd = pd.to_numeric(redocking["redocking_rmsd_angstrom"], errors="coerce")
        high_confidence_redocking = int(rmsd.le(2.0).sum())

    top_quantum_delta = None
    mean_quantum_delta = None
    max_abs_quantum_delta = None
    mean_abs_rank_shift = None
    promoted_top30: list[dict[str, Any]] = []
    if not top.empty and "quantum_ablation_delta" in top.columns:
        deltas = pd.to_numeric(top["quantum_ablation_delta"], errors="coerce")
        if deltas.notna().any():
            top_quantum_delta = float(deltas.max())
            mean_quantum_delta = float(deltas.mean())
            max_abs_quantum_delta = float(deltas.abs().max())
    if not ranking.empty and {"target_id", "candidate_id", "target_rank", "score_without_quantum"}.issubset(ranking.columns):
        rank_df = ranking.copy()
        rank_df["baseline_rank"] = rank_df.groupby("target_id")["score_without_quantum"].rank(method="first", ascending=False)
        rank_df["quantum_rank_shift"] = rank_df["baseline_rank"] - pd.to_numeric(rank_df["target_rank"], errors="coerce")
        top_rank_df = rank_df.loc[pd.to_numeric(rank_df["target_rank"], errors="coerce").le(10)].copy()
        if not top_rank_df.empty:
            mean_abs_rank_shift = float(top_rank_df["quantum_rank_shift"].abs().mean())
            promoted_top30 = _records(
                top_rank_df.sort_values("quantum_rank_shift", ascending=False).head(5),
                ["target_id", "candidate_id", "target_rank", "baseline_rank", "quantum_rank_shift", "quantum_ablation_delta"],
            )

    return {
        "reference_stats": _reference_stats(references_path),
        "production_gate": {
            "status": validation.get("status", "not_checked"),
            "warnings": validation.get("warnings", []),
            "errors": validation.get("errors", []),
        },
        "redocking_validation": {
            "targets": int(redocking["target_id"].nunique()) if "target_id" in redocking.columns else 0,
            "targets_under_2a": high_confidence_redocking,
            "rows": _records(
                redocking,
                [
                    "target_id",
                    "pdb_id",
                    "reference_ligand",
                    "redocking_rmsd_angstrom",
                    "redocking_best_engine",
                    "vina_redocking_rmsd_angstrom",
                    "gnina_redocking_rmsd_angstrom",
                    "gnina_redocking_cnn_pose_score",
                ],
            ),
        },
        "quantum_evidence": {
            "prefilter_rows": int(len(qprefilter)),
            "kernel_rerank_rows": int(len(qml)),
            "prefilter_modes": sorted(qprefilter["quantum_prefilter_mode"].dropna().astype(str).unique().tolist()) if "quantum_prefilter_mode" in qprefilter.columns else [],
            "rerank_modes": sorted(qml["qml_mode"].dropna().astype(str).unique().tolist()) if "qml_mode" in qml.columns else [],
            "top30_max_quantum_ablation_delta": top_quantum_delta,
            "top30_mean_quantum_ablation_delta": mean_quantum_delta,
            "top30_max_abs_quantum_ablation_delta": max_abs_quantum_delta,
            "top30_mean_abs_rank_shift": mean_abs_rank_shift,
            "top_promoted_by_quantum": promoted_top30,
            "current_claim": "Quantum kernels are used for portfolio diversity and reranking with classical ablations; this is not claimed as hardware superiority.",
        },
        "architecture": [
            {
                "tier": "Data and target selection",
                "implemented": "ChEMBL/oncology benchmark, EGFR/PARP1/PIK3CA target workspace, reference inhibitors, scaffold-aware splits.",
                "paper_basis": ["TDC", "ChEMBL", "AlphaFold DB", "RCSB PDB"],
            },
            {
                "tier": "Molecule generation and filtering",
                "implemented": "Generative candidate expansion, medicinal chemistry filters, QED/SA/logP/TPSA filters, reference-drug rediscovery.",
                "paper_basis": ["REINVENT4", "SELFIES", "MOSES", "generative molecular design surveys"],
            },
            {
                "tier": "Docking and pose evidence",
                "implemented": "Curated co-crystal pockets, Vina/Smina poses, GNINA CNN rescoring, multi-engine redocking validation.",
                "paper_basis": ["AutoDock Vina 1.2", "GNINA", "DiffDock", "PDBbind/CASF-style validation"],
            },
            {
                "tier": "ADMET and activity modeling",
                "implemented": "Target-specific activity models plus Tox21/ClinTox ADMET classifiers with lift checks.",
                "paper_basis": ["DeepPurpose", "TDC", "ADMET-AI", "XAI drug discovery"],
            },
            {
                "tier": "Quantum and QM layer",
                "implemented": "Qiskit statevector kernel prefilter, xTB GFN2 descriptors, Qiskit reranking, explicit quantum ablation columns.",
                "paper_basis": ["QML drug discovery reviews", "drug design on quantum computers", "xTB GFN methods"],
            },
            {
                "tier": "Decision robustness",
                "implemented": "144 stress-test experiments, hybrid top-5 consensus, research evidence gate, API/UI smoke checks.",
                "paper_basis": ["prospective validation guidance", "uncertainty and ablation practice"],
            },
        ],
        "scientist_critique": [
            "The ranked molecules remain computational hypotheses until synthesis and biochemical assays are completed.",
            "Vina/Smina/GNINA agreement is useful triage evidence, but not a substitute for selectivity, resistance-mutant, and ADMET experiments.",
            "The current quantum layer is a rigorous simulated-kernel workflow with ablations; hardware acceleration should be treated as a future backend, not a current speedup claim.",
            "The next scientific upgrade is explicit-solvent complex MD and FEP-style relative binding free energy for the hybrid top set.",
        ],
        "coverage": {
            "generated_candidates": summary.get("generated_candidates"),
            "filtered_candidates": summary.get("filtered_candidates"),
            "docking_rows": summary.get("docking_rows"),
            "gnina_rows": int(len(gnina)),
            "qm_rows": summary.get("qm_rows"),
            "qml_rows": summary.get("qml_rows"),
            "top30_rows": int(len(top)),
        },
    }
