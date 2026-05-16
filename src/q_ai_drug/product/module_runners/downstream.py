"""Standalone downstream runners for user-artifact workflows.

These runners close the product gap between raw scientific modules and user-facing
candidate decision workflows. They intentionally use transparent, conservative
heuristics when a trained project model is unavailable, and they record those
limitations in every output.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from q_ai_drug.product.module_runners.base import BaseModuleRunner, ModuleExecutionError, ModuleInputError
from q_ai_drug.service.artifact_resolver import resolve_artifact_path
from q_ai_drug.service.tool_payloads import (
    ActivityModelStudioPayload,
    ApplicabilityDomainPayload,
    QRankPayload,
    QReportPayload,
    WetLabTriagePayload,
)


def _safe_read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path)


def _smiles_col(df: pd.DataFrame) -> str | None:
    for candidate in ["canonical_smiles", "SMILES", "smiles", "smi", "original_smiles"]:
        if candidate in df.columns:
            return candidate
    return None


def _candidate_id_col(df: pd.DataFrame) -> str | None:
    for candidate in ["candidate_id", "compound_id", "name", "id", "idx"]:
        if candidate in df.columns:
            return candidate
    return None


def _resolve_csv_artifact(project_dir: Path, artifact_id: str, label: str) -> Path:
    try:
        return resolve_artifact_path(project_dir, artifact_id)
    except Exception as exc:
        raise ModuleInputError(f"Cannot resolve {label} artifact '{artifact_id}': {exc}")


def _load_candidate_table_from_upload(project_dir: Path, upload_file: str) -> pd.DataFrame:
    path = project_dir / "uploads" / upload_file
    if not path.exists():
        raise ModuleInputError(f"Upload file not found: {upload_file}")
    if path.suffix.lower() != ".csv":
        raise ModuleInputError("This runner currently accepts CSV candidate uploads. Run Q-Filter first for SDF inputs.")
    return _safe_read_csv(path)


def _load_candidate_table(project_dir: Path, artifact_id: str | None = None, upload_file: str | None = None) -> pd.DataFrame:
    if artifact_id:
        return _safe_read_csv(_resolve_csv_artifact(project_dir, artifact_id, "candidate"))
    if upload_file:
        return _load_candidate_table_from_upload(project_dir, upload_file)
    raise ModuleInputError("A candidate artifact ID or candidate upload file is required.")


def _minmax_score(series: pd.Series, *, invert: bool = False) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    if numeric.notna().sum() == 0:
        return pd.Series([0.5] * len(series), index=series.index)
    lo = numeric.min()
    hi = numeric.max()
    if hi == lo:
        scaled = pd.Series([0.5] * len(series), index=series.index)
    else:
        scaled = (numeric - lo) / (hi - lo)
    scaled = scaled.fillna(0.5).clip(0, 1)
    return 1 - scaled if invert else scaled


class ActivityModelStudioRunner(BaseModuleRunner):
    """Activity prediction with real training or transparent heuristic fallback."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id, project_dir, run_id, payload)
        self.candidates = pd.DataFrame()
        self.predictions = pd.DataFrame()
        self.train_data = pd.DataFrame()
        self.model_metrics: dict[str, Any] = {}
        self.model_comparison: list[dict[str, Any]] = []
        self.prediction_failures: list[dict[str, Any]] = []
        self.is_heuristic = True
        self.trained_model = None
        self.model_hash: str | None = None

    def validate_payload(self) -> None:
        try:
            self.validated_payload = ActivityModelStudioPayload.model_validate(self.payload).model_dump()
        except Exception as exc:
            raise ModuleInputError(f"Invalid Activity Model Studio payload: {exc}")

    def resolve_inputs(self) -> None:
        payload = self.validated_payload or {}
        mode = payload.get("mode", "predict")
        if mode == "train":
            assay_id = payload.get("assay_csv_artifact_id") or payload.get("candidate_artifact_id")
            if not assay_id:
                raise ModuleInputError("assay_csv_artifact_id or candidate_artifact_id required for train mode.")
            self.train_data = _load_candidate_table(self.project_dir, assay_id)
            if self.train_data.empty:
                raise ModuleInputError("Training data is empty.")
            if "p_activity" not in self.train_data.columns:
                raise ModuleInputError("Training data must have a p_activity column.")
            self.add_usage_requested("training_rows", len(self.train_data))
        else:
            self.candidates = _load_candidate_table(
                self.project_dir, payload.get("candidate_artifact_id"), payload.get("candidate_upload_file"))
            if self.candidates.empty:
                raise ModuleInputError("Candidate table is empty.")
            max_mol = payload.get("max_molecules")
            if max_mol:
                self.candidates = self.candidates.head(int(max_mol)).copy()
            self.add_usage_requested("molecule_count", len(self.candidates))

    def _train(self) -> None:
        """Train RF and GBT models on scaffold-split data."""
        df = self.train_data.copy()
        smiles_column = _smiles_col(df)
        if smiles_column is None:
            raise ModuleInputError("Training data needs a SMILES column.")

        try:
            from rdkit import Chem
            from rdkit.Chem import AllChem
            import numpy as np
            has_rdkit = True
        except ImportError:
            has_rdkit = False
            self.add_warning("RDKit not available; using random features for training demo.")

        # Generate fingerprints
        fps, valid_idx = [], []
        for i, smi in enumerate(df[smiles_column]):
            if has_rdkit:
                mol = Chem.MolFromSmiles(str(smi)) if smi else None
                if mol:
                    fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=1024)
                    fps.append(list(fp))
                    valid_idx.append(i)
                else:
                    self.prediction_failures.append({"idx": i, "smiles": str(smi), "reason": "Invalid SMILES"})
            else:
                import hashlib
                h = int(hashlib.md5(str(smi).encode()).hexdigest(), 16)
                fps.append([(h >> j) & 1 for j in range(1024)])
                valid_idx.append(i)

        if len(fps) < 10:
            self.add_warning("Too few valid molecules for meaningful training.")
            return

        import numpy as np
        X = np.array(fps)
        y = pd.to_numeric(df.iloc[valid_idx]["p_activity"], errors="coerce").values

        # Use scaffold split if available
        split_col = "split" if "split" in df.columns else None
        if split_col:
            train_mask = df.iloc[valid_idx][split_col].isin(["train"]).values
            test_mask = df.iloc[valid_idx][split_col].isin(["test", "valid"]).values
        else:
            np.random.seed(42)
            mask = np.random.rand(len(X)) < 0.8
            train_mask, test_mask = mask, ~mask
            self.add_warning("No scaffold split column found; using random 80/20 split.")

        X_train, y_train = X[train_mask], y[train_mask]
        X_test, y_test = X[test_mask], y[test_mask]

        if len(X_train) < 5 or len(X_test) < 2:
            self.add_warning("Insufficient data for train/test split.")
            return

        try:
            from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
            from sklearn.metrics import mean_squared_error, r2_score
        except ImportError:
            self.add_warning("scikit-learn not installed; cannot train models.")
            return

        models = {"RandomForest": RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=1),
                  "GradientBoosting": GradientBoostingRegressor(n_estimators=100, random_state=42)}
        best_r2, best_name = -999, None
        for name, model in models.items():
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            r2 = r2_score(y_test, preds)
            rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
            self.model_comparison.append({"model": name, "r2_test": round(r2, 4), "rmse_test": round(rmse, 4),
                                          "train_size": int(train_mask.sum()), "test_size": int(test_mask.sum()),
                                          "split_method": "scaffold" if split_col else "random"})
            if r2 > best_r2:
                best_r2, best_name = r2, name
                self.trained_model = model

        # Save model
        try:
            import joblib, hashlib
            model_path = self.output_dir / "trained_model.joblib"
            joblib.dump(self.trained_model, model_path)
            self.model_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()[:16]
            self.register_artifact(model_path, "joblib", "trained_model")
        except Exception:
            self.add_warning("Could not save model artifact (joblib not available).")

        self.model_metrics = {"best_model": best_name, "best_r2": round(best_r2, 4),
                              "model_hash": self.model_hash, "split_method": "scaffold" if split_col else "random"}
        self.is_heuristic = False
        self.add_usage_actual("trained_model", best_name)

    def _predict(self) -> None:
        """Predict using trained model or transparent heuristic fallback."""
        df = self.candidates.copy()
        smiles_column = _smiles_col(df)
        if smiles_column is None:
            raise ModuleInputError("Candidate table needs a SMILES/canonical_smiles column.")
        cid_col = _candidate_id_col(df) or "candidate_id"
        if cid_col not in df.columns:
            df[cid_col] = [f"cand_{i}" for i in range(len(df))]

        if "activity_score" in df.columns:
            activity_score = _minmax_score(df["activity_score"])
            model_used = "existing_activity_score_column"
        elif "p_activity" in df.columns:
            activity_score = _minmax_score(df["p_activity"])
            model_used = "existing_p_activity_column"
        elif "qed" in df.columns:
            activity_score = _minmax_score(df["qed"])
            model_used = "qed_proxy_no_trained_model"
        else:
            activity_score = pd.Series([0.5] * len(df), index=df.index)
            model_used = "neutral_proxy_no_model"
            self.add_warning("No trained model or activity column; using neutral 0.5 proxy.")

        self.is_heuristic = model_used.endswith("no_model") or model_used.endswith("no_trained_model")
        self.predictions = pd.DataFrame({
            "candidate_id": df[cid_col].astype(str),
            "canonical_smiles": df[smiles_column].astype(str),
            "target_id": self.validated_payload.get("target_id") or df.get("target_id", pd.Series([None] * len(df))),
            "activity_score": activity_score.round(4),
            "confidence": 0.4 if self.is_heuristic else 0.7,
            "model_id": self.validated_payload.get("model_id") or "best_available",
            "model_hash": self.model_hash or "none",
            "model_used": model_used,
            "is_heuristic_fallback": self.is_heuristic,
            "claim_boundary": "Prediction is computational prioritization only; not measured activity.",
        })
        self.add_usage_actual("molecule_count", len(self.predictions))

    def run(self) -> None:
        if self.validated_payload.get("mode") == "train":
            self._train()
        else:
            self._predict()

    def write_outputs(self) -> None:
        if not self.predictions.empty:
            path = self.write_csv(self.predictions.to_dict("records"), "activity_predictions")
            self.register_artifact(path, "csv", "activity_predictions")
        if self.prediction_failures:
            path = self.write_csv(self.prediction_failures, "prediction_failures")
            self.register_artifact(path, "csv", "prediction_failures")
        if self.model_comparison:
            path = self.write_csv(self.model_comparison, "model_comparison")
            self.register_artifact(path, "csv", "model_comparison")
        if self.model_metrics:
            path = self.write_json(self.model_metrics, "model_metrics")
            self.register_artifact(path, "json", "model_metrics")
        manifest = {
            "mode": self.validated_payload.get("mode", "predict"),
            "is_heuristic": self.is_heuristic,
            "model_hash": self.model_hash,
            "rows": len(self.predictions) if not self.predictions.empty else len(self.train_data),
            "limitations": ["Uses transparent fallback scoring when trained model artifacts are unavailable."] if self.is_heuristic else [],
        }
        self.register_artifact(self.write_json(manifest, "activity_model_manifest"), "json", "activity_model_manifest")


class ApplicabilityDomainGuardRunner(BaseModuleRunner):
    """True ECFP fingerprint nearest-neighbor applicability domain guard."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id, project_dir, run_id, payload)
        self.candidates = pd.DataFrame()
        self.training_set = pd.DataFrame()
        self.domain = pd.DataFrame()
        self.nearest_neighbors: list[dict[str, Any]] = []
        self.scaffold_novelty: list[dict[str, Any]] = []

    def validate_payload(self) -> None:
        try:
            self.validated_payload = ApplicabilityDomainPayload.model_validate(self.payload).model_dump()
        except Exception as exc:
            raise ModuleInputError(f"Invalid Applicability Domain payload: {exc}")

    def resolve_inputs(self) -> None:
        payload = self.validated_payload or {}
        self.candidates = _load_candidate_table(
            self.project_dir, 
            artifact_id=payload.get("candidate_artifact_id"),
            upload_file=payload.get("candidate_upload_file")
        )
        if self.candidates.empty:
            raise ModuleInputError("Candidate table is empty.")
        if payload.get("max_molecules"):
            self.candidates = self.candidates.head(int(payload["max_molecules"])).copy()
        if payload.get("training_set_artifact_id") or payload.get("training_set_upload_file"):
            self.training_set = _load_candidate_table(
                self.project_dir, 
                artifact_id=payload.get("training_set_artifact_id"),
                upload_file=payload.get("training_set_upload_file")
            )
        self.add_usage_requested("molecule_count", len(self.candidates))

    def run(self) -> None:
        df = self.candidates.copy()
        cid_col = _candidate_id_col(df) or "candidate_id"
        if cid_col not in df.columns:
            df[cid_col] = [f"cand_{i}" for i in range(len(df))]
        smiles_column = _smiles_col(df)
        if smiles_column is None:
            raise ModuleInputError("Candidate table needs a SMILES/canonical_smiles column.")

        try:
            from rdkit import Chem
            from rdkit.Chem import AllChem, DataStructs
            from rdkit.Chem.Scaffolds.MurckoScaffold import MurckoScaffoldSmiles
            has_rdkit = True
        except ImportError:
            has_rdkit = False

        if has_rdkit and not self.training_set.empty:
            train_smi_col = _smiles_col(self.training_set)
            if train_smi_col:
                self._fingerprint_domain(df, cid_col, smiles_column, Chem, AllChem, DataStructs, MurckoScaffoldSmiles)
                self.add_usage_actual("method", "ecfp_nearest_neighbor")
                return

        # Fallback to proxy-based method
        self._proxy_domain(df, cid_col, smiles_column)
        self.add_usage_actual("method", "proxy_qed_alerts")
        self.add_warning("Using proxy domain guard (QED/alerts); provide training_set_artifact_id for true ECFP fingerprint domain.")

    def _fingerprint_domain(self, df, cid_col, smiles_column, Chem, AllChem, DataStructs, MurckoScaffoldSmiles):
        """True ECFP Morgan fingerprint nearest-neighbor domain guard."""
        train_smi_col = _smiles_col(self.training_set)
        # Build training fingerprints
        train_fps, train_scaffolds = [], set()
        for smi in self.training_set[train_smi_col]:
            mol = Chem.MolFromSmiles(str(smi)) if smi else None
            if mol:
                train_fps.append(AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048))
                try:
                    train_scaffolds.add(MurckoScaffoldSmiles(str(smi)))
                except Exception:
                    pass

        rows, nn_rows, scaf_rows = [], [], []
        threshold = self.validated_payload.get("threshold_percentile", 95.0) / 100.0

        for _, row in df.iterrows():
            smi = str(row[smiles_column])
            cid = str(row[cid_col])
            mol = Chem.MolFromSmiles(smi) if smi else None
            if not mol or not train_fps:
                rows.append({"candidate_id": cid, "canonical_smiles": smi, "domain_score": 0.0,
                             "domain_label": "out_of_domain", "nearest_training_similarity": 0.0,
                             "descriptor_method": "ecfp4_2048"})
                continue
            fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048)
            sims = DataStructs.BulkTanimotoSimilarity(fp, train_fps)
            max_sim = max(sims) if sims else 0.0
            top3_idx = sorted(range(len(sims)), key=lambda i: sims[i], reverse=True)[:3]
            # Domain label
            if max_sim >= 0.6:
                label = "high"
            elif max_sim >= 0.4:
                label = "medium"
            elif max_sim >= 0.2:
                label = "low"
            else:
                label = "out_of_domain"

            rows.append({"candidate_id": cid, "canonical_smiles": smi, "domain_score": round(max_sim, 4),
                         "domain_label": label, "nearest_training_similarity": round(max_sim, 4),
                         "descriptor_method": "ecfp4_2048"})
            nn_rows.append({"candidate_id": cid, "nearest_similarity": round(max_sim, 4),
                            "top3_similarities": [round(sims[i], 4) for i in top3_idx]})
            # Scaffold novelty
            try:
                cand_scaffold = MurckoScaffoldSmiles(smi)
                is_novel = cand_scaffold not in train_scaffolds
                scaf_rows.append({"candidate_id": cid, "scaffold": cand_scaffold,
                                  "scaffold_novel": is_novel})
            except Exception:
                scaf_rows.append({"candidate_id": cid, "scaffold": "error", "scaffold_novel": True})

        self.domain = pd.DataFrame(rows)
        self.nearest_neighbors = nn_rows
        self.scaffold_novelty = scaf_rows
        self.add_usage_actual("molecule_count", len(self.domain))

    def _proxy_domain(self, df, cid_col, smiles_column):
        """Fallback proxy domain using QED and alert counts."""
        qed_score = _minmax_score(df["qed"]) if "qed" in df.columns else pd.Series([0.5] * len(df), index=df.index)
        alert_penalty = _minmax_score(df["alerts_count"], invert=True) if "alerts_count" in df.columns else pd.Series([0.5] * len(df), index=df.index)
        domain_score = ((qed_score + alert_penalty) / 2).clip(0, 1)
        labels = pd.cut(domain_score, bins=[-0.01, 0.35, 0.6, 0.8, 1.01], labels=["out_of_domain", "low", "medium", "high"])
        self.domain = pd.DataFrame({
            "candidate_id": df[cid_col].astype(str), "canonical_smiles": df[smiles_column].astype(str),
            "domain_score": domain_score.round(4), "domain_label": labels.astype(str),
            "nearest_training_similarity": None,
            "descriptor_method": "proxy_qed_alerts",
        })
        self.add_usage_actual("molecule_count", len(self.domain))

    def write_outputs(self) -> None:
        path = self.write_csv(self.domain.to_dict("records"), "applicability_domain")
        self.register_artifact(path, "csv", "applicability_domain")
        if self.nearest_neighbors:
            path = self.write_csv(self.nearest_neighbors, "nearest_neighbors")
            self.register_artifact(path, "csv", "nearest_neighbors")
        if self.scaffold_novelty:
            path = self.write_csv(self.scaffold_novelty, "scaffold_novelty")
            self.register_artifact(path, "csv", "scaffold_novelty")
        summary = self.domain["domain_label"].value_counts().to_dict() if not self.domain.empty else {}
        summary["method"] = self.usage_actual.get("method", "unknown")
        self.register_artifact(self.write_json({"label_counts": summary}, "applicability_domain_summary"), "json", "applicability_domain_summary")


class QRankRunner(BaseModuleRunner):
    """Rank candidates from one or more evidence artifacts."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id, project_dir, run_id, payload)
        self.rankings = pd.DataFrame()

    def validate_payload(self) -> None:
        try:
            self.validated_payload = QRankPayload.model_validate(self.payload).model_dump()
        except Exception as exc:
            raise ModuleInputError(f"Invalid Q-Rank payload: {exc}")

    def resolve_inputs(self) -> None:
        payload = self.validated_payload or {}
        if not payload.get("candidate_artifact_id") and not payload.get("candidate_upload_file"):
            raise ModuleInputError("candidate_artifact_id or upload_file is required for standalone Q-Rank.")
        self.candidates = _load_candidate_table(
            self.project_dir, 
            artifact_id=payload.get("candidate_artifact_id"),
            upload_file=payload.get("candidate_upload_file")
        )
        if self.candidates.empty:
            raise ModuleInputError("Candidate table is empty.")
            
        # load docking if present
        docking_path = None
        if payload.get("docking_results_artifact_id"):
            docking_path = _resolve_csv_artifact(self.project_dir, payload["docking_results_artifact_id"], "docking")
        elif payload.get("docking_results_upload_file"):
            docking_path = self.project_dir / "uploads" / payload["docking_results_upload_file"]
        self.docking = _safe_read_csv(docking_path) if docking_path else pd.DataFrame()

        # load activity if present
        activity_path = None
        if payload.get("activity_predictions_artifact_id"):
            activity_path = _resolve_csv_artifact(self.project_dir, payload["activity_predictions_artifact_id"], "activity")
        elif payload.get("activity_predictions_upload_file"):
            activity_path = self.project_dir / "uploads" / payload["activity_predictions_upload_file"]
        self.activity = _safe_read_csv(activity_path) if activity_path else pd.DataFrame()
        self.add_usage_requested("candidate_count", len(self.candidates))

    def run(self) -> None:
        df = self.candidates.copy()
        cid_col = _candidate_id_col(df) or "candidate_id"
        if cid_col not in df.columns:
            df[cid_col] = [f"cand_{i}" for i in range(len(df))]
        smiles_column = _smiles_col(df)
        if smiles_column is None:
            raise ModuleInputError("Candidate table needs a SMILES/canonical_smiles column.")

        # Merge evidence
        if not self.activity.empty:
            merge_col = "candidate_id" if "candidate_id" in self.activity.columns and cid_col in df.columns else None
            if merge_col:
                df = df.merge(self.activity, left_on=cid_col, right_on="candidate_id", how="left", suffixes=("", "_activity"))
        if not self.docking.empty:
            merge_key = "canonical_smiles" if "canonical_smiles" in self.docking.columns and smiles_column in df.columns else None
            if merge_key:
                df = df.merge(self.docking, left_on=smiles_column, right_on="canonical_smiles", how="left", suffixes=("", "_dock"))

        # Default weights
        weights = {"activity": 0.30, "docking": 0.25, "property": 0.15, "admet": 0.15, "domain": 0.15}

        # Score components
        has_activity = "activity_score" in df.columns
        has_docking = any(c in df.columns for c in ["vina_score", "vina_affinity_kcal_mol", "affinity_kcal_mol"])
        has_qed = "qed" in df.columns
        has_admet = "admet_risk_score" in df.columns
        has_domain = "domain_label" in df.columns

        activity_component = _minmax_score(df["activity_score"]) if has_activity else pd.Series([0.5] * len(df), index=df.index)
        docking_col = next((c for c in ["vina_score", "vina_affinity_kcal_mol", "affinity_kcal_mol"] if c in df.columns), None)
        docking_component = _minmax_score(df[docking_col], invert=True) if docking_col else pd.Series([0.5] * len(df), index=df.index)
        qed_component = _minmax_score(df["qed"]) if has_qed else pd.Series([0.5] * len(df), index=df.index)
        admet_component = _minmax_score(df["admet_risk_score"], invert=True) if has_admet else pd.Series([0.5] * len(df), index=df.index)

        # Domain penalization
        domain_component = pd.Series([0.5] * len(df), index=df.index)
        if has_domain:
            domain_map = {"high": 1.0, "medium": 0.7, "low": 0.4, "out_of_domain": 0.1}
            domain_component = df["domain_label"].map(domain_map).fillna(0.5)

        # Mock/fallback evidence penalization
        docking_real = df.get("docking_is_real", pd.Series([True] * len(df), index=df.index))
        is_heuristic = df.get("is_heuristic_fallback", pd.Series([False] * len(df), index=df.index))
        mock_penalty = pd.Series([1.0] * len(df), index=df.index)
        mock_penalty[docking_real == False] *= 0.7
        mock_penalty[is_heuristic == True] *= 0.8

        final = (weights["activity"] * activity_component + weights["docking"] * docking_component +
                 weights["property"] * qed_component + weights["admet"] * admet_component +
                 weights["domain"] * domain_component) * mock_penalty
        final = final.clip(0, 1)

        # Build explanations
        why_high, why_low, missing_evidence = [], [], []
        for i in range(len(df)):
            highs, lows, miss = [], [], []
            if has_activity and activity_component.iloc[i] > 0.7: highs.append("strong activity score")
            if has_activity and activity_component.iloc[i] < 0.3: lows.append("weak activity score")
            if not has_activity: miss.append("activity_score")
            if has_docking and docking_component.iloc[i] > 0.7: highs.append("favorable docking")
            if has_docking and docking_component.iloc[i] < 0.3: lows.append("poor docking")
            if not has_docking: miss.append("docking_score")
            if has_qed and qed_component.iloc[i] > 0.7: highs.append("good drug-likeness")
            if has_qed and qed_component.iloc[i] < 0.3: lows.append("poor drug-likeness")
            if has_domain and domain_component.iloc[i] < 0.3: lows.append("out of applicability domain")
            if not has_domain: miss.append("domain_label")
            why_high.append("; ".join(highs) if highs else "no strong evidence")
            why_low.append("; ".join(lows) if lows else "no negative signals")
            missing_evidence.append("; ".join(miss) if miss else "none")

        out = pd.DataFrame({
            "candidate_id": df[cid_col].astype(str),
            "canonical_smiles": df[smiles_column].astype(str),
            "activity_component": activity_component.round(4),
            "docking_component": docking_component.round(4),
            "property_component": qed_component.round(4),
            "admet_component": admet_component.round(4),
            "domain_component": domain_component.round(4),
            "mock_penalty": mock_penalty.round(4),
            "final_score": final.round(4),
            "why_high": why_high,
            "why_low": why_low,
            "missing_evidence": missing_evidence,
            "ranking_method": self.validated_payload.get("ranking_method", "ensemble"),
            "claim_boundary": "Prioritization index only; not a biological probability.",
        }).sort_values("final_score", ascending=False)
        if self.validated_payload.get("max_candidates"):
            out = out.head(int(self.validated_payload["max_candidates"]))
        out["rank"] = range(1, len(out) + 1)
        self.rankings = out
        self.weight_config = weights
        self.add_usage_actual("candidate_count", len(out))

    def write_outputs(self) -> None:
        path = self.write_csv(self.rankings.to_dict("records"), "ranked_candidates")
        self.register_artifact(path, "csv", "ranked_candidates")
        # Explanations
        if not self.rankings.empty:
            expl_cols = ["candidate_id", "why_high", "why_low", "missing_evidence"]
            expl = self.rankings[[c for c in expl_cols if c in self.rankings.columns]]
            self.register_artifact(self.write_csv(expl.to_dict("records"), "rank_explanations"), "csv", "rank_explanations")
        # Missing evidence report
        if not self.rankings.empty:
            miss = self.rankings[self.rankings["missing_evidence"] != "none"][["candidate_id", "missing_evidence"]]
            if not miss.empty:
                self.register_artifact(self.write_csv(miss.to_dict("records"), "missing_evidence_report"), "csv", "missing_evidence_report")
        # Weight config
        self.register_artifact(self.write_json(getattr(self, "weight_config", {}), "weight_config_used"), "json", "weight_config_used")
        self.register_artifact(self.write_json({"rows": len(self.rankings), "claim_boundary": self.claim_boundary}, "q_rank_summary"), "json", "q_rank_summary")


class WetLabTriageBoardRunner(BaseModuleRunner):
    """Create triage classes and reasons from ranked/user candidate artifacts."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id, project_dir, run_id, payload)
        self.candidates = pd.DataFrame()
        self.board = pd.DataFrame()

    def validate_payload(self) -> None:
        try:
            self.validated_payload = WetLabTriagePayload.model_validate(self.payload).model_dump()
        except Exception as exc:
            raise ModuleInputError(f"Invalid Wet-Lab Triage payload: {exc}")

    def resolve_inputs(self) -> None:
        self.candidates = _load_candidate_table(
            self.project_dir, 
            artifact_id=self.validated_payload.get("candidate_artifact_id"),
            upload_file=self.validated_payload.get("candidate_upload_file")
        )
        if self.candidates.empty:
            raise ModuleInputError("Candidate table is empty.")
        if self.validated_payload.get("max_to_triage"):
            self.candidates = self.candidates.head(int(self.validated_payload["max_to_triage"])).copy()
        self.add_usage_requested("candidate_count", len(self.candidates))

    def run(self) -> None:
        df = self.candidates.copy()
        cid_col = _candidate_id_col(df) or "candidate_id"
        if cid_col not in df.columns:
            df[cid_col] = [f"cand_{i}" for i in range(len(df))]
        smiles_column = _smiles_col(df) or cid_col
        score = pd.to_numeric(df.get("final_score", pd.Series([0.5] * len(df))), errors="coerce").fillna(0.5)
        admet = pd.to_numeric(df.get("admet_risk_score", pd.Series([0.0] * len(df))), errors="coerce").fillna(0.0)
        
        # Determine if mock/heuristic data heavily influenced the score
        is_heuristic = df.get("is_heuristic_fallback", pd.Series([False] * len(df))).fillna(False)
        missing_ev = df.get("missing_evidence", pd.Series(["none"] * len(df))).fillna("none")
        
        classes = []
        reasons_to_test = []
        reasons_not = []
        scientific_utility = []
        
        for s, a, heur, miss in zip(score, admet, is_heuristic, missing_ev):
            has_major_gap = heur or "activity_score" in miss or "docking_score" in miss
            
            if s >= 0.70 and a <= 0.6 and not has_major_gap:
                classes.append("test_now")
                reasons_to_test.append("High integrated computational score with real predictive/QM evidence.")
                reasons_not.append("Requires biochemical/cellular validation before any therapeutic claim.")
                scientific_utility.append("High confidence prior for biochemical assay.")
            elif s >= 0.55:
                classes.append("test_after_review")
                if has_major_gap:
                    reasons_to_test.append("Moderate score, but heavily relies on proxy/heuristic fallbacks.")
                    reasons_not.append(f"Missing or heuristic evidence ({miss}). Must run real Q-Dock/Activity models first.")
                    scientific_utility.append("Needs higher fidelity computation before wet-lab.")
                else:
                    reasons_to_test.append("Moderate computational score; review before assay spend.")
                    reasons_not.append("Evidence package may have conflicting signals.")
                    scientific_utility.append("Borderline candidate; evaluate for scaffold novelty.")
            elif s >= 0.35:
                classes.append("watchlist")
                reasons_to_test.append("Potentially useful backup/scaffold-diversity candidate.")
                reasons_not.append("Score is below immediate testing threshold.")
                scientific_utility.append("Hold for SAR expansion if primary scaffolds fail.")
            else:
                classes.append("reject_hold")
                reasons_to_test.append("No immediate testing rationale from current evidence.")
                reasons_not.append("Low integrated score; keep only if strategic scaffold reason exists.")
                scientific_utility.append("Low priority; likely true negative.")
                
        self.board = pd.DataFrame({
            "candidate_id": df[cid_col].astype(str),
            "canonical_smiles": df[smiles_column].astype(str),
            "final_score": score.round(4),
            "triage_class": classes,
            "scientific_utility": scientific_utility,
            "reasons_to_test": reasons_to_test,
            "reasons_not_to_test": reasons_not,
            "recommended_first_assay": "target biochemical IC50 or cell viability dose-response",
        })
        self.add_usage_actual("candidate_count", len(self.board))

    def write_outputs(self) -> None:
        path = self.write_csv(self.board.to_dict("records"), "wet_lab_triage_board")
        self.register_artifact(path, "csv", "wet_lab_triage_board")
        for label in ["test_now", "test_after_review", "watchlist", "reject_hold"]:
            subset = self.board[self.board["triage_class"] == label]
            if not subset.empty:
                self.register_artifact(self.write_csv(subset.to_dict("records"), label), "csv", label)
        assay_pack = "# Wet-Lab Assay Pack\n\n" + "\n".join(
            f"- {row.candidate_id}: {row.triage_class} — {row.scientific_utility} — {row.recommended_first_assay}"
            for row in self.board.itertuples()
        )
        pack_path = self.output_dir / "assay_pack.md"
        pack_path.write_text(assay_pack, encoding="utf-8")
        self.register_artifact(pack_path, "markdown", "assay_pack")


class QReportRunner(BaseModuleRunner):
    """Generate a lightweight report package from selected candidate IDs."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id, project_dir, run_id, payload)
        self.report_payload: dict[str, Any] = {}

    def validate_payload(self) -> None:
        try:
            self.validated_payload = QReportPayload.model_validate(self.payload).model_dump()
        except Exception as exc:
            raise ModuleInputError(f"Invalid Q-Report payload: {exc}")

    def resolve_inputs(self) -> None:
        self.add_usage_requested("candidate_count", len(self.validated_payload.get("candidate_ids", [])))

    def run(self) -> None:
        candidate_ids = self.validated_payload.get("candidate_ids", [])
        self.report_payload = {
            "candidate_ids": candidate_ids,
            "report_template": self.validated_payload.get("report_template", "standard"),
            "include_evidence": self.validated_payload.get("include_evidence", []),
            "include_limitations": self.validated_payload.get("include_limitations", True),
            "claim_boundary": "Computational candidate dossier only. No therapeutic claims can be made without biological assay validation. Scores represent priority indices, not activity probabilities.",
        }
        self.add_usage_actual("candidate_count", len(candidate_ids))

    def write_outputs(self) -> None:
        candidate_rows = [{"candidate_id": cid, "selected_for_report": True} for cid in self.report_payload["candidate_ids"]]
        self.register_artifact(self.write_csv(candidate_rows, "selected_candidates"), "csv", "selected_candidates")
        markdown = [
            f"# Q-AI Drug Candidate Report ({self.report_payload['report_template']})",
            "",
            "## Scientific Claim Boundaries",
            f"> **WARNING:** {self.report_payload['claim_boundary']}",
            "",
            "## Selected Candidates",
        ]
        for cid in self.report_payload["candidate_ids"]:
            markdown.append(f"- `{cid}`")
            
        md_path = self.output_dir / "report.md"
        md_path.write_text("\n".join(markdown), encoding="utf-8")
        self.register_artifact(md_path, "markdown", "report_markdown")
        html_path = self.output_dir / "report.html"
        html_path.write_text("<html><body>" + "<br/>".join(markdown) + "</body></html>", encoding="utf-8")
        self.register_artifact(html_path, "html", "report_html")
        self.register_artifact(self.write_json(self.report_payload, "report_manifest"), "json", "report_manifest")
