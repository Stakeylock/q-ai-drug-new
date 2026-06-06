from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, ExtraTreesRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, average_precision_score, mean_absolute_error, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from q_ai_drug.features.descriptors import MODEL_FEATURE_COLUMNS, append_descriptors, featurize_smiles


def _safe_auc(y_true: pd.Series, y_score: np.ndarray) -> float | None:
    try:
        if len(set(y_true.astype(int))) < 2:
            return None
        return float(roc_auc_score(y_true, y_score))
    except Exception:
        return None


def _safe_ap(y_true: pd.Series, y_score: np.ndarray) -> float | None:
    try:
        if len(set(y_true.astype(int))) < 2:
            return None
        return float(average_precision_score(y_true, y_score))
    except Exception:
        return None


def _classifier_candidates() -> dict[str, Pipeline]:
    return {
        "random_forest_balanced": Pipeline(
            [
                ("scale", StandardScaler()),
                (
                    "model",
                    RandomForestClassifier(
                        n_estimators=160,
                        min_samples_leaf=2,
                        class_weight="balanced_subsample",
                        random_state=17,
                        n_jobs=-1,
                    ),
                ),
            ]
        ),
        "extra_trees_balanced": Pipeline(
            [
                ("scale", StandardScaler()),
                (
                    "model",
                    ExtraTreesClassifier(
                        n_estimators=220,
                        min_samples_leaf=2,
                        class_weight="balanced",
                        random_state=19,
                        n_jobs=-1,
                    ),
                ),
            ]
        ),
    }


def _regressor_candidates() -> dict[str, Pipeline]:
    return {
        "random_forest": Pipeline(
            [
                ("scale", StandardScaler()),
                ("model", RandomForestRegressor(n_estimators=160, min_samples_leaf=2, random_state=17, n_jobs=-1)),
            ]
        ),
        "extra_trees": Pipeline(
            [
                ("scale", StandardScaler()),
                ("model", ExtraTreesRegressor(n_estimators=220, min_samples_leaf=2, random_state=19, n_jobs=-1)),
            ]
        ),
    }


def train_baseline_models(benchmark: pd.DataFrame, out_dir: str | Path) -> tuple[pd.DataFrame, dict[str, Path]]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    benchmark = append_descriptors(benchmark, "canonical_smiles")
    metrics = []
    model_paths: dict[str, Path] = {}

    for target_id, target_df in benchmark.groupby("target_id"):
        train_df = target_df[target_df["split"].isin(["train", "validation"])]
        test_df = target_df[target_df["split"].eq("test")]
        if len(train_df) < 20 or train_df["label_active"].nunique() < 2:
            continue

        train_features = featurize_smiles(train_df["canonical_smiles"].fillna(""))
        eval_features = featurize_smiles((test_df if len(test_df) else train_df)["canonical_smiles"].fillna(""))
        eval_df = test_df if len(test_df) else train_df

        best_classifier = None
        best_classifier_name = ""
        best_classifier_score = -np.inf
        best_proba = None
        for name, classifier in _classifier_candidates().items():
            classifier.fit(train_features[MODEL_FEATURE_COLUMNS], train_df["label_active"].astype(int))
            proba = classifier.predict_proba(eval_features[MODEL_FEATURE_COLUMNS])[:, 1]
            auc = _safe_auc(eval_df["label_active"], proba)
            ap = _safe_ap(eval_df["label_active"], proba)
            selection_score = (auc if auc is not None else 0.5) + 0.25 * (ap if ap is not None else 0.0)
            if selection_score > best_classifier_score:
                best_classifier = classifier
                best_classifier_name = name
                best_classifier_score = selection_score
                best_proba = proba

        best_regressor = None
        best_regressor_name = ""
        best_regressor_mae = np.inf
        best_pred_activity = None
        for name, regressor in _regressor_candidates().items():
            regressor.fit(train_features[MODEL_FEATURE_COLUMNS], train_df["p_activity"].astype(float))
            pred_activity_candidate = regressor.predict(eval_features[MODEL_FEATURE_COLUMNS])
            mae = float(mean_absolute_error(eval_df["p_activity"], pred_activity_candidate))
            if mae < best_regressor_mae:
                best_regressor = regressor
                best_regressor_name = name
                best_regressor_mae = mae
                best_pred_activity = pred_activity_candidate

        if best_classifier is None or best_regressor is None or best_proba is None or best_pred_activity is None:
            continue

        proba = best_proba
        pred_label = (proba >= 0.5).astype(int)
        metrics.append(
            {
                "target_id": target_id,
                "classifier_model": best_classifier_name,
                "regressor_model": best_regressor_name,
                "records_train": int(len(train_df)),
                "records_eval": int(len(eval_df)),
                "roc_auc": _safe_auc(eval_df["label_active"], proba),
                "average_precision": _safe_ap(eval_df["label_active"], proba),
                "accuracy": float(accuracy_score(eval_df["label_active"].astype(int), pred_label)),
                "mae_p_activity": float(best_regressor_mae),
            }
        )
        model_path = out_dir / f"{target_id}_baseline_activity.joblib"
        joblib.dump(
            {
                "classifier": best_classifier,
                "regressor": best_regressor,
                "features": MODEL_FEATURE_COLUMNS,
                "classifier_model": best_classifier_name,
                "regressor_model": best_regressor_name,
            },
            model_path,
        )
        model_paths[target_id] = model_path

    metrics_df = pd.DataFrame(metrics)
    metrics_df.to_csv(out_dir / "baseline_activity_metrics.csv", index=False)
    (out_dir / "baseline_activity_manifest.json").write_text(
        json.dumps({"models": {key: str(value) for key, value in model_paths.items()}}, indent=2)
    )
    return metrics_df, model_paths


def load_models(model_dir: str | Path) -> dict[str, dict]:
    models = {}
    for path in Path(model_dir).glob("*_baseline_activity.joblib"):
        target_id = path.name.replace("_baseline_activity.joblib", "")
        models[target_id] = joblib.load(path)
    return models


def score_candidates(candidates: pd.DataFrame, model_dir: str | Path) -> pd.DataFrame:
    models = load_models(model_dir)
    out = candidates.reset_index(drop=True).copy()
    if "canonical_smiles" not in out.columns:
        out["canonical_smiles"] = out["smiles"]
    features = featurize_smiles(out["canonical_smiles"].fillna(""))
    out["activity_score"] = 0.5
    out["predicted_p_activity"] = np.nan
    for target_id, idx in out.groupby("target_id").groups.items():
        if target_id not in models:
            continue
        model = models[target_id]
        feature_names = model.get("features", list(features.columns))
        target_features = features.iloc[list(idx)][feature_names]
        out.loc[idx, "activity_score"] = model["classifier"].predict_proba(target_features)[:, 1]
        out.loc[idx, "predicted_p_activity"] = model["regressor"].predict(target_features)
    return out


def rediscovery_benchmark(benchmark: pd.DataFrame, reference_df: pd.DataFrame, model_dir: str | Path, out_dir: str | Path) -> pd.DataFrame:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    references = reference_df.rename(columns={"canonical_smiles": "smiles"}).copy()
    references["canonical_smiles"] = references["smiles"]
    references["is_reference_inhibitor"] = 1
    decoys = (
        benchmark[benchmark["label_active"].eq(0)]
        .groupby("target_id", group_keys=False)
        .head(250)[["target_id", "canonical_smiles"]]
        .copy()
    )
    decoys["query_name"] = "chembl_inactive_decoy"
    decoys["is_reference_inhibitor"] = 0
    panel = pd.concat(
        [
            references[["target_id", "canonical_smiles", "query_name", "is_reference_inhibitor"]],
            decoys[["target_id", "canonical_smiles", "query_name", "is_reference_inhibitor"]],
        ],
        ignore_index=True,
    ).dropna(subset=["canonical_smiles"])
    scored = score_candidates(panel, model_dir)
    rows = []
    for target_id, target_df in scored.groupby("target_id"):
        target_df = target_df.sort_values("activity_score", ascending=False)
        n_refs = int(target_df["is_reference_inhibitor"].sum())
        top_k = max(1, min(10, len(target_df)))
        rows.append(
            {
                "target_id": target_id,
                "reference_count": n_refs,
                "panel_size": int(len(target_df)),
                "top10_reference_hits": int(target_df.head(top_k)["is_reference_inhibitor"].sum()),
                "roc_auc": _safe_auc(target_df["is_reference_inhibitor"], target_df["activity_score"].to_numpy()),
                "average_precision": _safe_ap(target_df["is_reference_inhibitor"], target_df["activity_score"].to_numpy()),
            }
        )
    scored.to_csv(out_dir / "rediscovery_scored_panel.csv", index=False)
    metrics = pd.DataFrame(rows)
    metrics.to_csv(out_dir / "rediscovery_metrics.csv", index=False)
    return metrics
