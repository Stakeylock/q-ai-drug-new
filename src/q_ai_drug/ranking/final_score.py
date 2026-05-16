from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def _norm_high(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce")
    span = values.max() - values.min()
    if not np.isfinite(span) or span == 0:
        return pd.Series(0.5, index=series.index)
    return (values - values.min()) / span


def _norm_low(series: pd.Series) -> pd.Series:
    return 1 - _norm_high(series)


def build_final_ranking(project_dir: str | Path, out_csv: str | Path | None = None) -> pd.DataFrame:
    project_dir = Path(project_dir)
    docking = pd.read_csv(project_dir / "docking" / "results.csv")
    md_path = project_dir / "md" / "stability.csv"
    qm_path = project_dir / "qm" / "qm_descriptors.csv"
    qml_path = project_dir / "qml" / "quantum_kernel_scores.csv"
    if md_path.exists():
        md = pd.read_csv(md_path)
        docking = docking.merge(md, on=["target_id", "candidate_id"], how="left", suffixes=("", "_md"))
    if qm_path.exists():
        qm = pd.read_csv(qm_path)
        docking = docking.merge(qm, on=["target_id", "candidate_id"], how="left", suffixes=("", "_qm"))
    if qml_path.exists():
        qml = pd.read_csv(qml_path)
        docking = docking.merge(qml, on=["target_id", "candidate_id"], how="left", suffixes=("", "_qml"))
    out = docking.copy()
    out["activity_component"] = pd.to_numeric(out.get("activity_score", 0.5), errors="coerce").fillna(0.5)
    out["admet_component"] = pd.to_numeric(out.get("admet_score", out.get("QED", 0.5)), errors="coerce").fillna(0.5)
    out["docking_component"] = _norm_low(out["affinity_kcal_mol"])
    out["md_component"] = np.where(out.get("stability_class", "stable").fillna("stable").eq("stable"), 1.0, 0.35)
    out["early_quantum_component"] = pd.to_numeric(out.get("quantum_prefilter_score", 0.5), errors="coerce").fillna(0.5)
    out["quantum_component"] = pd.to_numeric(out.get("quantum_score", 0.5), errors="coerce").fillna(0.5)
    out["qml_component"] = pd.to_numeric(out.get("qml_score", out["quantum_component"]), errors="coerce").fillna(out["quantum_component"])
    out["late_stage_quantum_component"] = 0.55 * out["quantum_component"] + 0.45 * out["qml_component"]
    out["score_without_quantum"] = (
        0.30 * out["activity_component"]
        + 0.25 * out["admet_component"]
        + 0.30 * out["docking_component"]
        + 0.15 * out["md_component"]
    )
    out["final_score"] = (
        0.23 * out["activity_component"]
        + 0.18 * out["admet_component"]
        + 0.24 * out["docking_component"]
        + 0.14 * out["md_component"]
        + 0.06 * out["early_quantum_component"]
        + 0.15 * out["late_stage_quantum_component"]
    )
    out["quantum_ablation_delta"] = out["final_score"] - out["score_without_quantum"]
    out = out.sort_values(["target_id", "final_score"], ascending=[True, False])
    out["target_rank"] = out.groupby("target_id")["final_score"].rank(method="first", ascending=False).astype(int)
    out_path = Path(out_csv or project_dir / "final_ranked_candidates.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(out_path, index=False)
    out.groupby("target_id", group_keys=False).head(10).to_csv(project_dir / "top_candidates.csv", index=False)
    return out


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Build transparent final candidate ranking.")
    parser.add_argument("--project", default="outputs/cancer_proof_v1")
    parser.add_argument("--out", default=None)
    args = parser.parse_args(argv)
    result = build_final_ranking(args.project, args.out)
    print(f"Wrote {len(result)} ranked candidates")


if __name__ == "__main__":
    main()
