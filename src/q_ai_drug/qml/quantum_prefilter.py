from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from q_ai_drug.qml.qsvm_rerank import _statevector


PREFILTER_FEATURES = [
    "activity_score",
    "admet_score",
    "admet_model_score",
    "QED",
    "tox21_toxicity_probability",
    "clintox_toxicity_probability",
]


def _normalize(values: pd.Series, *, invert: bool = False) -> np.ndarray:
    numeric = pd.to_numeric(values, errors="coerce").fillna(0.5).to_numpy(dtype=float)
    if invert:
        numeric = 1 - numeric
    span = numeric.max() - numeric.min()
    if not np.isfinite(span) or span == 0:
        return np.full_like(numeric, 0.5, dtype=float)
    return (numeric - numeric.min()) / span


def _feature_matrix(df: pd.DataFrame) -> np.ndarray:
    matrix = []
    for column in PREFILTER_FEATURES:
        invert = column.endswith("toxicity_probability")
        matrix.append(_normalize(df.get(column, pd.Series(0.5, index=df.index)), invert=invert))
    return np.vstack(matrix).T


def _objective(df: pd.DataFrame) -> np.ndarray:
    activity = pd.to_numeric(df.get("activity_score", 0.5), errors="coerce").fillna(0.5).to_numpy(dtype=float)
    admet = pd.to_numeric(df.get("admet_score", 0.5), errors="coerce").fillna(0.5).to_numpy(dtype=float)
    admet_series = pd.Series(admet, index=df.index)
    model_admet = pd.to_numeric(df.get("admet_model_score", admet_series), errors="coerce").fillna(admet_series).to_numpy(dtype=float)
    qed = pd.to_numeric(df.get("QED", 0.5), errors="coerce").fillna(0.5).to_numpy(dtype=float)
    tox21 = pd.to_numeric(df.get("tox21_toxicity_probability", 0.5), errors="coerce").fillna(0.5).to_numpy(dtype=float)
    tox21_series = pd.Series(tox21, index=df.index)
    clintox = pd.to_numeric(df.get("clintox_toxicity_probability", tox21_series), errors="coerce").fillna(tox21_series).to_numpy(dtype=float)
    return np.clip(0.38 * activity + 0.28 * admet + 0.16 * model_admet + 0.10 * qed + 0.08 * (1 - (tox21 + clintox) / 2), 0, 1)


def quantum_prefilter_scores(df: pd.DataFrame) -> pd.DataFrame:
    out = df.reset_index(drop=True).copy()
    if out.empty:
        out["quantum_prefilter_score"] = []
        return out

    out["quantum_prefilter_objective"] = _objective(out)
    out["quantum_kernel_centrality"] = 0.5
    out["quantum_diversity_score"] = 0.5
    out["quantum_prefilter_score"] = out["quantum_prefilter_objective"]
    out["quantum_prefilter_mode"] = "classical_objective_fallback"
    out["quantum_prefilter_is_real"] = False

    try:
        features = _feature_matrix(out)
        for _, idx_values in out.groupby("target_id").groups.items():
            positions = list(idx_values)
            if len(positions) == 1:
                out.loc[positions, "quantum_kernel_centrality"] = 1.0
                out.loc[positions, "quantum_diversity_score"] = 0.0
                continue
            states = np.vstack([_statevector(features[pos]) for pos in positions])
            kernel = np.abs(states @ np.conjugate(states.T)) ** 2
            objective = out.iloc[positions]["quantum_prefilter_objective"].to_numpy(dtype=float)
            elite_count = max(1, min(25, len(positions) // 10))
            elite_idx = np.argsort(objective)[-elite_count:]
            centrality = kernel.mean(axis=1)
            max_elite_similarity = kernel[:, elite_idx].max(axis=1)
            diversity = 1 - max_elite_similarity
            score = np.clip(0.72 * objective + 0.18 * centrality + 0.10 * diversity, 0, 1)
            out.loc[positions, "quantum_kernel_centrality"] = centrality
            out.loc[positions, "quantum_diversity_score"] = diversity
            out.loc[positions, "quantum_prefilter_score"] = score
        out["quantum_prefilter_mode"] = "qiskit_statevector_portfolio_kernel"
        out["quantum_prefilter_is_real"] = True
    except Exception as exc:
        out["quantum_prefilter_note"] = f"Qiskit prefilter fallback: {exc}"
        return out

    out["quantum_prefilter_note"] = "early-stage quantum-kernel portfolio scoring before docking/QM"
    return out


def run_quantum_prefilter(
    candidates_csv: str | Path,
    out_dir: str | Path,
    *,
    out_csv: str | Path | None = None,
) -> pd.DataFrame:
    candidates = pd.read_csv(candidates_csv)
    scored = quantum_prefilter_scores(candidates)
    scored = scored.sort_values(["target_id", "quantum_prefilter_score"], ascending=[True, False])
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    scored[
        [
            "target_id",
            "candidate_id",
            "quantum_prefilter_objective",
            "quantum_kernel_centrality",
            "quantum_diversity_score",
            "quantum_prefilter_score",
            "quantum_prefilter_mode",
            "quantum_prefilter_is_real",
            "quantum_prefilter_note",
        ]
    ].to_csv(out_dir / "quantum_prefilter_scores.csv", index=False)
    if out_csv is not None:
        out_path = Path(out_csv)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        scored.to_csv(out_path, index=False)
    return scored


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run early quantum-kernel candidate portfolio prefiltering.")
    parser.add_argument("--candidates", required=True)
    parser.add_argument("--out", default="outputs/cancer_proof_v1/qml")
    parser.add_argument("--out-csv", default=None)
    args = parser.parse_args(argv)
    result = run_quantum_prefilter(args.candidates, args.out, out_csv=args.out_csv)
    print(f"Wrote {len(result)} quantum-prefilter rows to {Path(args.out) / 'quantum_prefilter_scores.csv'}")


if __name__ == "__main__":
    main()
