from __future__ import annotations

import argparse
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

try:
    from rdkit import Chem
    from rdkit import RDLogger
    from rdkit.Chem.Scaffolds import MurckoScaffold
    RDLogger.DisableLog("rdApp.*")
except Exception:
    Chem = None
    MurckoScaffold = None


@dataclass(frozen=True)
class ExperimentConfig:
    experiment_id: str
    activity_weight: float
    admet_weight: float
    docking_weight: float
    quantum_weight: float
    gnina_weight: float
    md_weight: float
    novelty_weight: float
    safety_weight: float
    strict_filter: bool
    target_balance: bool
    strategy: str


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path) if path.exists() else pd.DataFrame()


def _normalize(series: pd.Series, *, higher_is_better: bool = True, fill: float = 0.5) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce")
    if values.notna().sum() == 0:
        return pd.Series(fill, index=series.index, dtype=float)
    lo = float(values.min())
    hi = float(values.max())
    if math.isclose(lo, hi):
        normalized = pd.Series(fill, index=series.index, dtype=float)
    else:
        normalized = (values - lo) / (hi - lo)
    if not higher_is_better:
        normalized = 1.0 - normalized
    return normalized.fillna(fill).clip(0, 1)


def _column(df: pd.DataFrame, name: str, default: object = np.nan) -> pd.Series:
    if name in df.columns:
        return df[name]
    return pd.Series(default, index=df.index)


def _scaffold(smiles: str) -> str:
    if Chem is None or MurckoScaffold is None:
        return smiles[:24]
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return str(smiles)[:24]
    scaffold = MurckoScaffold.MurckoScaffoldSmiles(mol=mol, includeChirality=False)
    return scaffold or str(smiles)[:24]


def _sdf_centroid(path: object) -> tuple[float, float, float] | None:
    if not path or pd.isna(path) or Chem is None:
        return None
    sdf_path = Path(str(path))
    if not sdf_path.exists():
        return None
    supplier = Chem.SDMolSupplier(str(sdf_path), removeHs=False, sanitize=False)
    mol = next((item for item in supplier if item is not None and item.GetNumConformers() > 0), None)
    if mol is None:
        return None
    conf = mol.GetConformer()
    coords = np.array([[conf.GetAtomPosition(i).x, conf.GetAtomPosition(i).y, conf.GetAtomPosition(i).z] for i in range(mol.GetNumAtoms())])
    center = coords.mean(axis=0)
    return float(center[0]), float(center[1]), float(center[2])


def _pose_sanity(row: pd.Series) -> dict[str, Any]:
    center = _sdf_centroid(row.get("docked_sdf_path"))
    if center is None:
        return {"pose_centroid_distance": np.nan, "pose_inside_box": False}
    box_center = np.array(
        [
            float(row.get("docking_center_x", 0) or 0),
            float(row.get("docking_center_y", 0) or 0),
            float(row.get("docking_center_z", 0) or 0),
        ]
    )
    ligand_center = np.array(center)
    distance = float(np.linalg.norm(ligand_center - box_center))
    box_size = float(row.get("docking_box_size", 30) or 30)
    inside = bool(np.all(np.abs(ligand_center - box_center) <= (box_size / 2.0 + 1.5)))
    return {"pose_centroid_distance": distance, "pose_inside_box": inside}


def _load_candidate_matrix(project_dir: Path) -> pd.DataFrame:
    ranked = _read_csv(project_dir / "final_ranked_candidates.csv")
    if ranked.empty:
        raise FileNotFoundError(f"Missing final ranked candidates: {project_dir / 'final_ranked_candidates.csv'}")
    gnina = _read_csv(project_dir / "gnina" / "results.csv")
    if not gnina.empty:
        keep = [
            column
            for column in [
                "candidate_id",
                "gnina_status",
                "gnina_affinity_kcal_mol",
                "gnina_cnn_pose_score",
                "gnina_cnn_affinity",
                "gnina_mode",
                "gnina_warnings",
                "gnina_input_pose_source",
            ]
            if column in gnina.columns
        ]
        ranked = ranked.merge(gnina[keep], on="candidate_id", how="left", suffixes=("", "_gnina"))
    ranked["scaffold"] = ranked["canonical_smiles"].map(_scaffold)
    scaffold_counts = ranked["scaffold"].value_counts()
    ranked["scaffold_frequency"] = ranked["scaffold"].map(scaffold_counts).fillna(1)
    ranked["novelty_component"] = 1.0 - _normalize(ranked["scaffold_frequency"], higher_is_better=True, fill=0.0)
    ranked["toxicity_safety_component"] = 1.0 - pd.concat(
        [
            pd.to_numeric(_column(ranked, "tox21_toxicity_probability", 0), errors="coerce"),
            pd.to_numeric(_column(ranked, "clintox_toxicity_probability", 0), errors="coerce"),
        ],
        axis=1,
    ).max(axis=1).fillna(0.5)
    ranked["fda_component"] = pd.to_numeric(_column(ranked, "fda_approval_probability", 0.5), errors="coerce").fillna(0.5)
    ranked["druglike_component"] = pd.to_numeric(_column(ranked, "QED", 0.5), errors="coerce").fillna(0.5)
    ranked["affinity_component"] = _normalize(ranked["affinity_kcal_mol"], higher_is_better=False, fill=0.5)
    ranked["gnina_component"] = _normalize(_column(ranked, "gnina_cnn_pose_score"), fill=0.48)
    ranked["gnina_affinity_component"] = _normalize(_column(ranked, "gnina_cnn_affinity"), fill=0.48)
    ranked["md_component_filled"] = pd.to_numeric(_column(ranked, "md_component", 0.5), errors="coerce").fillna(0.5)
    ranked["quantum_component_filled"] = pd.concat(
        [
            pd.to_numeric(_column(ranked, "early_quantum_component", 0.5), errors="coerce"),
            pd.to_numeric(_column(ranked, "late_stage_quantum_component", 0.5), errors="coerce"),
            pd.to_numeric(_column(ranked, "quantum_prefilter_score", 0.5), errors="coerce"),
        ],
        axis=1,
    ).mean(axis=1).fillna(0.5)
    sanity = pd.DataFrame([_pose_sanity(row) for _, row in ranked.iterrows()])
    return pd.concat([ranked.reset_index(drop=True), sanity], axis=1)


def _generate_experiments(limit: int) -> list[ExperimentConfig]:
    experiments: list[ExperimentConfig] = []
    strategies = ["balanced", "safety_first", "structure_first", "quantum_first"]
    base_weights = {
        "balanced": (0.24, 0.20, 0.19, 0.12, 0.08, 0.06, 0.05, 0.06),
        "safety_first": (0.20, 0.27, 0.16, 0.09, 0.06, 0.05, 0.05, 0.12),
        "structure_first": (0.20, 0.16, 0.28, 0.08, 0.14, 0.08, 0.03, 0.03),
        "quantum_first": (0.19, 0.17, 0.17, 0.22, 0.08, 0.05, 0.06, 0.06),
    }
    idx = 1
    for strategy in strategies:
        base = np.array(base_weights[strategy], dtype=float)
        for activity_shift in [-0.04, 0.0, 0.04]:
            for docking_shift in [-0.04, 0.0, 0.04]:
                for quantum_shift in [-0.03, 0.0, 0.03]:
                    for strict_filter in [False, True]:
                        for target_balance in [True, False]:
                            weights = base.copy()
                            weights[0] = max(0.02, weights[0] + activity_shift)
                            weights[2] = max(0.02, weights[2] + docking_shift)
                            weights[3] = max(0.02, weights[3] + quantum_shift)
                            weights = weights / weights.sum()
                            experiments.append(
                                ExperimentConfig(
                                    experiment_id=f"EXP_{idx:03d}",
                                    activity_weight=float(weights[0]),
                                    admet_weight=float(weights[1]),
                                    docking_weight=float(weights[2]),
                                    quantum_weight=float(weights[3]),
                                    gnina_weight=float(weights[4]),
                                    md_weight=float(weights[5]),
                                    novelty_weight=float(weights[6]),
                                    safety_weight=float(weights[7]),
                                    strict_filter=strict_filter,
                                    target_balance=target_balance,
                                    strategy=strategy,
                                )
                            )
                            idx += 1
                            if len(experiments) >= limit:
                                return experiments
    return experiments


def _score(df: pd.DataFrame, config: ExperimentConfig) -> pd.DataFrame:
    scored = df.copy()
    scored["experiment_score"] = (
        config.activity_weight * pd.to_numeric(scored["activity_component"], errors="coerce").fillna(0.5)
        + config.admet_weight * pd.to_numeric(scored["admet_component"], errors="coerce").fillna(0.5)
        + config.docking_weight * scored["affinity_component"]
        + config.quantum_weight * scored["quantum_component_filled"]
        + config.gnina_weight * ((scored["gnina_component"] + scored["gnina_affinity_component"]) / 2.0)
        + config.md_weight * scored["md_component_filled"]
        + config.novelty_weight * scored["novelty_component"]
        + config.safety_weight * ((scored["toxicity_safety_component"] + scored["fda_component"] + scored["druglike_component"]) / 3.0)
    )
    if config.strict_filter:
        clean = (
            _column(scored, "filter_pass", True).astype(str).str.lower().isin({"true", "1", "yes"})
            & ~_column(scored, "pains_alert", False).astype(str).str.lower().isin({"true", "1", "yes"})
            & ~_column(scored, "brenk_alert", False).astype(str).str.lower().isin({"true", "1", "yes"})
            & pd.to_numeric(_column(scored, "lipinski_violations", 0), errors="coerce").fillna(0).le(1)
        )
        scored.loc[~clean, "experiment_score"] *= 0.78
    scored["experiment_rank"] = scored.groupby("target_id")["experiment_score"].rank(method="first", ascending=False)
    return scored


def _experiment_summary(scored: pd.DataFrame, config: ExperimentConfig) -> dict[str, Any]:
    top = scored.loc[scored["experiment_rank"].le(1)].copy() if config.target_balance else scored.nlargest(3, "experiment_score").copy()
    return {
        **asdict(config),
        "top_candidates": ";".join(top["candidate_id"].astype(str).tolist()),
        "target_coverage": int(top["target_id"].nunique()),
        "mean_top_score": float(top["experiment_score"].mean()),
        "mean_top_affinity": float(pd.to_numeric(top["affinity_kcal_mol"], errors="coerce").mean()),
        "mean_top_admet": float(pd.to_numeric(top["admet_score"], errors="coerce").mean()),
        "mean_top_toxicity": float(pd.to_numeric(top["tox21_toxicity_probability"], errors="coerce").mean()),
        "mean_top_qed": float(pd.to_numeric(top["QED"], errors="coerce").mean()),
        "gnina_coverage": int(top["gnina_cnn_pose_score"].notna().sum()) if "gnina_cnn_pose_score" in top else 0,
        "pose_inside_box_rate": float(top["pose_inside_box"].mean()) if "pose_inside_box" in top else 0.0,
    }


def _build_consensus(all_top: pd.DataFrame, matrix: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        all_top.groupby(["target_id", "candidate_id"], as_index=False)
        .agg(
            experiment_appearances=("experiment_id", "nunique"),
            mean_experiment_score=("experiment_score", "mean"),
            score_std=("experiment_score", "std"),
            best_experiment_rank=("experiment_rank", "min"),
        )
        .fillna({"score_std": 0.0})
    )
    metadata_cols = [
        "target_id",
        "candidate_id",
        "canonical_smiles",
        "final_score",
        "activity_score",
        "admet_score",
        "affinity_kcal_mol",
        "tox21_toxicity_probability",
        "clintox_toxicity_probability",
        "fda_approval_probability",
        "QED",
        "qml_score",
        "quantum_prefilter_score",
        "pose_inside_box",
    ]
    available = [column for column in metadata_cols if column in matrix.columns]
    consensus = grouped.merge(matrix[available].drop_duplicates("candidate_id"), on=["target_id", "candidate_id"], how="left")
    max_appearances = max(float(consensus["experiment_appearances"].max()), 1.0)
    consensus["robustness_component"] = consensus["experiment_appearances"] / max_appearances
    consensus["consensus_score"] = (
        0.50 * consensus["mean_experiment_score"]
        + 0.25 * consensus["robustness_component"]
        + 0.15 * pd.to_numeric(consensus.get("final_score", 0.5), errors="coerce").fillna(0.5)
        + 0.10 * consensus.get("pose_inside_box", False).astype(float)
    )
    consensus["consensus_rank"] = consensus["consensus_score"].rank(method="first", ascending=False).astype(int)
    consensus["in_silico_validation_tier"] = np.where(
        (consensus["consensus_score"] >= consensus["consensus_score"].quantile(0.90)) & consensus.get("pose_inside_box", False),
        "high_priority_computational_hit_hypothesis",
        "computational_followup_candidate",
    )
    return consensus.sort_values("consensus_score", ascending=False)


def _select_diverse_top5(consensus: pd.DataFrame) -> pd.DataFrame:
    selected = []
    used_targets = set()
    for _, row in consensus.iterrows():
        if row["target_id"] not in used_targets:
            selected.append(row)
            used_targets.add(row["target_id"])
        if len(selected) >= 3:
            break
    for _, row in consensus.iterrows():
        if row["candidate_id"] in {item["candidate_id"] for item in selected}:
            continue
        selected.append(row)
        if len(selected) >= 5:
            break
    return pd.DataFrame(selected).reset_index(drop=True)


def _write_figures(out_dir: Path, summaries: pd.DataFrame, consensus: pd.DataFrame, top5: pd.DataFrame) -> list[str]:
    fig_dir = out_dir / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)
    figures = []
    plt.figure(figsize=(8, 4.5))
    summaries["mean_top_score"].hist(bins=24, color="#11736f")
    plt.xlabel("Mean top experiment score")
    plt.ylabel("Experiment count")
    plt.tight_layout()
    path = fig_dir / "experiment_score_distribution.png"
    plt.savefig(path, dpi=180)
    plt.close()
    figures.append(str(path))

    top_freq = consensus.head(20).sort_values("experiment_appearances")
    plt.figure(figsize=(8, 5))
    plt.barh(top_freq["candidate_id"], top_freq["experiment_appearances"], color="#3d55a6")
    plt.xlabel("Top-candidate appearances across experiments")
    plt.tight_layout()
    path = fig_dir / "consensus_candidate_frequency.png"
    plt.savefig(path, dpi=180)
    plt.close()
    figures.append(str(path))

    plt.figure(figsize=(8, 4.5))
    colors = {"EGFR": "#11736f", "PARP1": "#3d55a6", "PIK3CA": "#b46c1b"}
    plt.bar(top5["candidate_id"], top5["consensus_score"], color=[colors.get(item, "#667085") for item in top5["target_id"]])
    plt.xticks(rotation=30, ha="right")
    plt.ylabel("Consensus score")
    plt.tight_layout()
    path = fig_dir / "hybrid_top5_consensus.png"
    plt.savefig(path, dpi=180)
    plt.close()
    figures.append(str(path))
    return figures


def run_experiments(project_dir: str | Path = "outputs/cancer_proof_v1", *, n_experiments: int = 144) -> dict[str, Any]:
    project_dir = Path(project_dir)
    out_dir = project_dir / "experiments"
    out_dir.mkdir(parents=True, exist_ok=True)
    matrix = _load_candidate_matrix(project_dir)
    matrix.to_csv(out_dir / "candidate_experiment_matrix.csv", index=False)

    configs = _generate_experiments(max(100, n_experiments))
    summaries = []
    top_rows = []
    for config in configs:
        scored = _score(matrix, config)
        top = scored.loc[scored["experiment_rank"].le(5)].copy()
        top["experiment_id"] = config.experiment_id
        top["strategy"] = config.strategy
        top_rows.append(top)
        summaries.append(_experiment_summary(scored, config))
    summary_df = pd.DataFrame(summaries).sort_values("mean_top_score", ascending=False)
    top_df = pd.concat(top_rows, ignore_index=True)
    consensus = _build_consensus(top_df, matrix)
    top5 = _select_diverse_top5(consensus)

    summary_df.to_csv(out_dir / "experiment_matrix.csv", index=False)
    top_df.to_csv(out_dir / "experiment_top_hits_long.csv", index=False)
    consensus.to_csv(out_dir / "hybrid_candidate_consensus.csv", index=False)
    top5.to_csv(out_dir / "hybrid_top5_candidates.csv", index=False)
    figures = _write_figures(out_dir, summary_df, consensus, top5)

    top5_records = top5.where(pd.notna(top5), None).to_dict("records")
    report = {
        "status": "completed",
        "experiment_count": len(configs),
        "candidate_count": int(len(matrix)),
        "best_experiments": summary_df.head(5).where(pd.notna(summary_df), None).to_dict("records"),
        "hybrid_top5": top5_records,
        "warning_analysis": _warning_analysis(project_dir),
        "figures": figures,
        "research_claim": "Computational hit hypotheses only; wet-lab synthesis, biochemical assays, cellular assays, and orthogonal ADMET are required before therapeutic claims.",
    }
    (out_dir / "experiment_summary.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    _write_report(out_dir, report)
    return report


def _warning_analysis(project_dir: Path) -> dict[str, Any]:
    admet = _read_csv(project_dir / "models" / "admet_model_metrics.csv")
    low_ap = []
    if not admet.empty:
        admet["ap_lift_over_prevalence"] = pd.to_numeric(admet["average_precision"], errors="coerce") / pd.to_numeric(
            admet["positive_rate_eval"], errors="coerce"
        ).replace(0, np.nan)
        low_ap = admet.loc[pd.to_numeric(admet["average_precision"], errors="coerce").lt(0.20)].where(pd.notna(admet), None).to_dict("records")
    gnina = _read_csv(project_dir / "gnina" / "results.csv")
    outside_box = []
    if not gnina.empty:
        text = _column(gnina, "gnina_output_excerpt", "").fillna("").astype(str) + " " + _column(gnina, "gnina_warnings", "").fillna("").astype(str)
        outside_box = gnina.loc[text.str.contains("outside box|outside the box|initial pose", case=False, regex=True)].where(pd.notna(gnina), None).to_dict("records")
    return {
        "low_absolute_admet_ap_endpoints": low_ap,
        "gnina_outside_box_rows": outside_box,
        "redocking_note": "Redocking RMSD is generated only when curated co-crystal receptor and ligand extraction succeeds.",
    }


def _write_report(out_dir: Path, report: dict[str, Any]) -> None:
    lines = [
        "# Q-AI Research Experiment Report",
        "",
        f"Experiments run: {report['experiment_count']}",
        f"Candidates evaluated: {report['candidate_count']}",
        "",
        "## Best Five Experiment Strategies",
    ]
    for item in report["best_experiments"]:
        lines.append(
            f"- {item['experiment_id']} ({item['strategy']}): mean top score {item['mean_top_score']:.3f}; top candidates {item['top_candidates']}"
        )
    lines.extend(["", "## Hybrid Top 5 Computational Hit Hypotheses"])
    for item in report["hybrid_top5"]:
        lines.append(
            f"- {item['target_id']} {item['candidate_id']}: consensus {item['consensus_score']:.3f}; "
            f"affinity {item.get('affinity_kcal_mol')}; QED {item.get('QED')}; tier {item['in_silico_validation_tier']}"
        )
    lines.extend(["", "## Research Claim Boundary", report["research_claim"], ""])
    (out_dir / "experiment_report.md").write_text("\n".join(lines), encoding="utf-8")
    html = "<html><head><title>Q-AI Experiment Report</title></head><body>" + "\n".join(
        f"<p>{line}</p>" if not line.startswith("#") else f"<h{min(line.count('#'), 3)}>{line.lstrip('# ').strip()}</h{min(line.count('#'), 3)}>"
        for line in lines
    ) + "</body></html>"
    (out_dir / "experiment_report.html").write_text(html, encoding="utf-8")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run 100+ in silico ranking stress tests and build a hybrid consensus package.")
    parser.add_argument("--project", default="outputs/cancer_proof_v1")
    parser.add_argument("--n-experiments", type=int, default=144)
    args = parser.parse_args(argv)
    report = run_experiments(args.project, n_experiments=args.n_experiments)
    print(json.dumps({"status": report["status"], "experiment_count": report["experiment_count"], "top5": report["hybrid_top5"]}, indent=2, default=str))


if __name__ == "__main__":
    main()
