from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, average_precision_score, roc_auc_score
from sklearn.model_selection import train_test_split

from q_ai_drug.data.build_oncology_benchmark import canonicalize_smiles, murcko_scaffold
from q_ai_drug.data.retrieve_public_oncology_data import download_moleculenet_admet
from q_ai_drug.features.descriptors import MODEL_FEATURE_COLUMNS, featurize_smiles


TOX21_DATASET = "tox21"
CLINTOX_DATASET = "clintox"
ADMET_BUNDLE_NAME = "admet_models.joblib"
ADMET_METRICS_NAME = "admet_model_metrics.csv"
ADMET_MANIFEST_NAME = "admet_model_manifest.json"

CLINTOX_TOXICITY_ENDPOINT = "CT_TOX"
CLINTOX_APPROVAL_ENDPOINT = "FDA_APPROVED"


def _safe_auc(y_true: pd.Series, y_score: np.ndarray) -> float | None:
    try:
        if len(set(y_true.astype(int))) < 2:
            return None
        return float(roc_auc_score(y_true.astype(int), y_score))
    except Exception:
        return None


def _safe_ap(y_true: pd.Series, y_score: np.ndarray) -> float | None:
    try:
        if len(set(y_true.astype(int))) < 2:
            return None
        return float(average_precision_score(y_true.astype(int), y_score))
    except Exception:
        return None


def _endpoint_column_name(dataset: str, endpoint: str) -> str:
    safe_endpoint = re.sub(r"[^a-z0-9]+", "_", endpoint.lower()).strip("_")
    return f"{dataset}_{safe_endpoint}_probability"


def _hash_bucket(value: str) -> int:
    return int(hashlib.sha1(value.encode("utf-8")).hexdigest(), 16) % 10


def _scaffold_split(canonical_smiles: str) -> str:
    scaffold = murcko_scaffold(canonical_smiles)
    bucket = _hash_bucket(scaffold or canonical_smiles)
    if bucket < 8:
        return "train"
    return "test"


def _prepare_endpoint_frame(raw: pd.DataFrame, *, endpoint: str, smiles_column: str) -> pd.DataFrame:
    if smiles_column not in raw.columns or endpoint not in raw.columns:
        return pd.DataFrame(columns=["canonical_smiles", "label", "split"])
    frame = raw[[smiles_column, endpoint]].rename(columns={smiles_column: "smiles", endpoint: "label"}).copy()
    frame["label"] = pd.to_numeric(frame["label"], errors="coerce")
    frame = frame.dropna(subset=["smiles", "label"]).copy()
    frame["canonical_smiles"] = frame["smiles"].map(canonicalize_smiles)
    frame = frame.dropna(subset=["canonical_smiles"]).copy()
    if frame.empty:
        return pd.DataFrame(columns=["canonical_smiles", "label", "split"])
    frame["label"] = (frame["label"].astype(float) >= 0.5).astype(int)
    frame = (
        frame.groupby("canonical_smiles", as_index=False)["label"]
        .max()
        .sort_values("canonical_smiles")
        .reset_index(drop=True)
    )
    frame["split"] = frame["canonical_smiles"].map(_scaffold_split)
    return frame


def _split_endpoint_frame(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, str]:
    train_df = frame[frame["split"].eq("train")].copy()
    test_df = frame[frame["split"].eq("test")].copy()
    scaffold_ok = (
        len(train_df) >= 40
        and len(test_df) >= 10
        and train_df["label"].nunique() == 2
        and test_df["label"].nunique() == 2
    )
    if scaffold_ok:
        return train_df, test_df, "murcko_scaffold_hash"

    stratify = frame["label"] if frame["label"].nunique() == 2 else None
    train_df, test_df = train_test_split(
        frame,
        test_size=0.2,
        random_state=23,
        shuffle=True,
        stratify=stratify,
    )
    return train_df.copy(), test_df.copy(), "stratified_random_fallback"


def _train_classifier(train_df: pd.DataFrame) -> RandomForestClassifier:
    features = featurize_smiles(train_df["canonical_smiles"].fillna(""))
    model = RandomForestClassifier(
        n_estimators=180,
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=29,
        n_jobs=-1,
    )
    model.fit(features[MODEL_FEATURE_COLUMNS], train_df["label"].astype(int))
    return model


def _evaluate_classifier(model: RandomForestClassifier, eval_df: pd.DataFrame) -> dict[str, float | None]:
    features = featurize_smiles(eval_df["canonical_smiles"].fillna(""))
    proba = model.predict_proba(features[MODEL_FEATURE_COLUMNS])[:, 1]
    pred = (proba >= 0.5).astype(int)
    return {
        "roc_auc": _safe_auc(eval_df["label"], proba),
        "average_precision": _safe_ap(eval_df["label"], proba),
        "accuracy": float(accuracy_score(eval_df["label"].astype(int), pred)),
        "positive_rate_eval": float(eval_df["label"].astype(int).mean()),
    }


def _train_dataset(
    *,
    dataset: str,
    raw: pd.DataFrame,
    endpoints: list[str],
    smiles_column: str,
    out_dir: Path,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    models: dict[str, Any] = {}
    rows: list[dict[str, Any]] = []
    for endpoint in endpoints:
        frame = _prepare_endpoint_frame(raw, endpoint=endpoint, smiles_column=smiles_column)
        if len(frame) < 80 or frame["label"].nunique() < 2:
            rows.append(
                {
                    "dataset": dataset,
                    "endpoint": endpoint,
                    "records_total": int(len(frame)),
                    "records_train": 0,
                    "records_eval": 0,
                    "positive_rate_train": None,
                    "positive_rate_eval": None,
                    "roc_auc": None,
                    "average_precision": None,
                    "accuracy": None,
                    "split_strategy": "skipped_insufficient_labels",
                    "model_path": "",
                }
            )
            continue
        train_df, eval_df, split_strategy = _split_endpoint_frame(frame)
        model = _train_classifier(train_df)
        metrics = _evaluate_classifier(model, eval_df)
        model_info = {
            "dataset": dataset,
            "endpoint": endpoint,
            "probability_column": _endpoint_column_name(dataset, endpoint),
            "model": model,
            "features": MODEL_FEATURE_COLUMNS,
            "split_strategy": split_strategy,
        }
        models[endpoint] = model_info
        rows.append(
            {
                "dataset": dataset,
                "endpoint": endpoint,
                "records_total": int(len(frame)),
                "records_train": int(len(train_df)),
                "records_eval": int(len(eval_df)),
                "positive_rate_train": float(train_df["label"].astype(int).mean()),
                "positive_rate_eval": metrics["positive_rate_eval"],
                "roc_auc": metrics["roc_auc"],
                "average_precision": metrics["average_precision"],
                "accuracy": metrics["accuracy"],
                "split_strategy": split_strategy,
                "model_path": str(out_dir / ADMET_BUNDLE_NAME),
            }
        )
    return models, rows


def _read_admet_sources(raw_dir: Path, *, force_download: bool = False) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, str]]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    tox21_path = raw_dir / "tox21.csv"
    clintox_path = raw_dir / "clintox.csv"
    if force_download or not tox21_path.exists() or not clintox_path.exists():
        download_moleculenet_admet(raw_dir)
    if not tox21_path.exists():
        raise FileNotFoundError(f"Missing Tox21 dataset: {tox21_path}")
    if not clintox_path.exists():
        raise FileNotFoundError(f"Missing ClinTox dataset: {clintox_path}")
    return (
        pd.read_csv(tox21_path),
        pd.read_csv(clintox_path),
        {"tox21_csv": str(tox21_path), "clintox_csv": str(clintox_path)},
    )


def train_admet_models(
    raw_dir: str | Path,
    out_dir: str | Path,
    *,
    force_download: bool = False,
) -> tuple[pd.DataFrame, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    tox21_raw, clintox_raw, sources = _read_admet_sources(Path(raw_dir), force_download=force_download)

    tox21_endpoints = [column for column in tox21_raw.columns if column not in {"smiles", "mol_id"}]
    clintox_endpoints = [column for column in (CLINTOX_APPROVAL_ENDPOINT, CLINTOX_TOXICITY_ENDPOINT) if column in clintox_raw.columns]

    tox21_models, tox21_rows = _train_dataset(
        dataset=TOX21_DATASET,
        raw=tox21_raw,
        endpoints=tox21_endpoints,
        smiles_column="smiles",
        out_dir=out_dir,
    )
    clintox_models, clintox_rows = _train_dataset(
        dataset=CLINTOX_DATASET,
        raw=clintox_raw,
        endpoints=clintox_endpoints,
        smiles_column="smiles",
        out_dir=out_dir,
    )

    bundle = {
        "models": {TOX21_DATASET: tox21_models, CLINTOX_DATASET: clintox_models},
        "features": MODEL_FEATURE_COLUMNS,
        "sources": sources,
        "score_formula": {
            "tox21_weight": 0.45,
            "clintox_toxicity_weight": 0.35,
            "fda_approval_weight": 0.20,
            "description": "Higher score means lower predicted toxicity and higher ClinTox approval-likeness.",
        },
    }
    bundle_path = out_dir / ADMET_BUNDLE_NAME
    joblib.dump(bundle, bundle_path)

    metrics = pd.DataFrame(tox21_rows + clintox_rows)
    metrics.to_csv(out_dir / ADMET_METRICS_NAME, index=False)
    manifest = {
        "bundle_path": str(bundle_path),
        "metrics_path": str(out_dir / ADMET_METRICS_NAME),
        "sources": sources,
        "datasets": {
            TOX21_DATASET: {"endpoints": list(tox21_models), "records": int(len(tox21_raw))},
            CLINTOX_DATASET: {"endpoints": list(clintox_models), "records": int(len(clintox_raw))},
        },
        "model_type": "RandomForestClassifier per endpoint on RDKit descriptors, hashed SMILES fingerprints, and Morgan fingerprints",
    }
    (out_dir / ADMET_MANIFEST_NAME).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return metrics, bundle_path


def _empty_scores(candidates: pd.DataFrame, note: str) -> pd.DataFrame:
    out = candidates.copy()
    out["tox21_toxicity_probability"] = np.nan
    out["clintox_toxicity_probability"] = np.nan
    out["fda_approval_probability"] = np.nan
    out["admet_model_score"] = np.nan
    out["admet_model_available"] = False
    out["admet_model_note"] = note
    return out


def load_admet_bundle(model_dir: str | Path) -> dict[str, Any] | None:
    bundle_path = Path(model_dir) / ADMET_BUNDLE_NAME
    if not bundle_path.exists():
        return None
    return joblib.load(bundle_path)


def score_admet_candidates(candidates: pd.DataFrame, model_dir: str | Path) -> pd.DataFrame:
    bundle = load_admet_bundle(model_dir)
    if bundle is None:
        return _empty_scores(candidates, f"ADMET bundle not found in {model_dir}")
    out = candidates.reset_index(drop=True).copy()
    if "canonical_smiles" not in out.columns:
        out["canonical_smiles"] = out["smiles"]
    features = featurize_smiles(out["canonical_smiles"].fillna(""))
    feature_columns = bundle.get("features", MODEL_FEATURE_COLUMNS)

    tox21_probability_columns: list[str] = []
    for dataset, endpoints in bundle.get("models", {}).items():
        for endpoint, model_info in endpoints.items():
            model = model_info["model"]
            probability_column = model_info.get("probability_column") or _endpoint_column_name(dataset, endpoint)
            try:
                out[probability_column] = model.predict_proba(features[feature_columns])[:, 1]
            except Exception:
                out[probability_column] = np.nan
            if dataset == TOX21_DATASET:
                tox21_probability_columns.append(probability_column)

    if tox21_probability_columns:
        out["tox21_toxicity_probability"] = out[tox21_probability_columns].mean(axis=1)
    else:
        out["tox21_toxicity_probability"] = np.nan

    clintox_tox_col = _endpoint_column_name(CLINTOX_DATASET, CLINTOX_TOXICITY_ENDPOINT)
    fda_approval_col = _endpoint_column_name(CLINTOX_DATASET, CLINTOX_APPROVAL_ENDPOINT)
    out["clintox_toxicity_probability"] = pd.to_numeric(out.get(clintox_tox_col, np.nan), errors="coerce")
    out["fda_approval_probability"] = pd.to_numeric(out.get(fda_approval_col, np.nan), errors="coerce")

    tox21 = out["tox21_toxicity_probability"].fillna(0.5)
    clintox_tox = out["clintox_toxicity_probability"].fillna(tox21)
    approval = out["fda_approval_probability"].fillna(0.5)
    out["admet_model_score"] = np.clip(0.45 * (1 - tox21) + 0.35 * (1 - clintox_tox) + 0.20 * approval, 0, 1)
    out["admet_model_available"] = True
    out["admet_model_note"] = "trained_tox21_clintox_random_forest"
    return out
