"""Evidence-aware Q-Rank runner.

Consumes activity, docking, applicability-domain, and orbital/QM evidence;
penalizes mock, fallback, out-of-domain, and missing evidence; and writes
score-contribution artifacts for auditability.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from q_ai_drug.product.module_runners.base import BaseModuleRunner, ModuleInputError
from q_ai_drug.service.artifact_resolver import resolve_artifact_path
from q_ai_drug.service.tool_payloads import QRankPayload


def _safe_read_csv(path: Path | None) -> pd.DataFrame:
    if path is None or not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path)


def _resolve_path(project_dir: Path, artifact_id: str | None, upload_file: str | None, label: str) -> Path | None:
    if artifact_id:
        try:
            return resolve_artifact_path(project_dir, artifact_id)
        except Exception as exc:
            raise ModuleInputError(f"Cannot resolve {label} artifact '{artifact_id}': {exc}")
    if upload_file:
        path = project_dir / "uploads" / upload_file
        if not path.exists():
            raise ModuleInputError(f"{label} upload file not found: {upload_file}")
        return path
    return None


def _smiles_col(df: pd.DataFrame) -> str | None:
    for col in ["canonical_smiles", "SMILES", "smiles", "smi", "original_smiles"]:
        if col in df.columns:
            return col
    return None


def _candidate_id_col(df: pd.DataFrame) -> str | None:
    for col in ["candidate_id", "compound_id", "name", "id", "idx"]:
        if col in df.columns:
            return col
    return None


def _minmax_score(series: pd.Series, *, invert: bool = False) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    if numeric.notna().sum() == 0:
        scaled = pd.Series([0.5] * len(series), index=series.index)
    else:
        lo = numeric.min()
        hi = numeric.max()
        scaled = pd.Series([0.5] * len(series), index=series.index) if hi == lo else (numeric - lo) / (hi - lo)
    scaled = scaled.fillna(0.5).clip(0, 1)
    return 1 - scaled if invert else scaled


def _merge_evidence(base: pd.DataFrame, evidence: pd.DataFrame, base_cid: str, base_smi: str, suffix: str) -> pd.DataFrame:
    if evidence.empty:
        return base
    if "candidate_id" in evidence.columns and base_cid in base.columns:
        return base.merge(evidence, left_on=base_cid, right_on="candidate_id", how="left", suffixes=("", suffix))
    ev_smi = _smiles_col(evidence)
    if ev_smi and base_smi in base.columns:
        return base.merge(evidence, left_on=base_smi, right_on=ev_smi, how="left", suffixes=("", suffix))
    return base


class QRankRunner(BaseModuleRunner):
    """Scientific evidence-aware Q-Rank runner."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id, project_dir, run_id, payload)
        self.candidates = pd.DataFrame()
        self.activity = pd.DataFrame()
        self.docking = pd.DataFrame()
        self.domain = pd.DataFrame()
        self.orbital = pd.DataFrame()
        self.rankings = pd.DataFrame()
        self.rank_ablation = pd.DataFrame()
        self.evidence_status = pd.DataFrame()
        self.weight_config: dict[str, float] = {}

    def validate_payload(self) -> None:
        try:
            self.validated_payload = QRankPayload.model_validate(self.payload).model_dump()
        except Exception as exc:
            raise ModuleInputError(f"Invalid Q-Rank payload: {exc}")

    def resolve_inputs(self) -> None:
        payload = self.validated_payload or {}
        candidate_path = _resolve_path(self.project_dir, payload.get("candidate_artifact_id"), payload.get("candidate_upload_file"), "candidate")
        if candidate_path is None:
            raise ModuleInputError("candidate_artifact_id or candidate_upload_file is required for Q-Rank.")
        self.candidates = _safe_read_csv(candidate_path)
        if self.candidates.empty:
            raise ModuleInputError("Candidate table is empty.")
        self.activity = _safe_read_csv(_resolve_path(self.project_dir, payload.get("activity_predictions_artifact_id"), payload.get("activity_predictions_upload_file"), "activity"))
        self.docking = _safe_read_csv(_resolve_path(self.project_dir, payload.get("docking_results_artifact_id"), payload.get("docking_results_upload_file"), "docking"))
        self.domain = _safe_read_csv(_resolve_path(self.project_dir, payload.get("domain_artifact_id"), payload.get("domain_upload_file"), "domain"))
        self.orbital = _safe_read_csv(_resolve_path(self.project_dir, payload.get("orbital_artifact_id"), payload.get("orbital_upload_file"), "orbital"))
        self.add_usage_requested("candidate_count", len(self.candidates))

    def run(self) -> None:
        df = self.candidates.copy()
        cid_col = _candidate_id_col(df) or "candidate_id"
        if cid_col not in df.columns:
            df[cid_col] = [f"cand_{i}" for i in range(len(df))]
        smi_col = _smiles_col(df)
        if smi_col is None:
            raise ModuleInputError("Candidate table needs a SMILES/canonical_smiles column.")

        df = _merge_evidence(df, self.activity, cid_col, smi_col, "_activity")
        df = _merge_evidence(df, self.docking, cid_col, smi_col, "_dock")
        df = _merge_evidence(df, self.domain, cid_col, smi_col, "_domain")
        df = _merge_evidence(df, self.orbital, cid_col, smi_col, "_qm")

        has_activity = "activity_score" in df.columns
        docking_col = next((c for c in ["vina_score", "vina_affinity_kcal_mol", "affinity_kcal_mol"] if c in df.columns), None)
        has_docking = docking_col is not None
        has_property = "qed" in df.columns
        has_admet = "admet_risk_score" in df.columns
        has_domain = "domain_label" in df.columns
        qm_gap_col = next((c for c in ["homo_lumo_gap_ev", "gap", "gap_ev"] if c in df.columns), None)
        has_qm = qm_gap_col is not None or "qm_status" in df.columns

        activity_component = _minmax_score(df["activity_score"]) if has_activity else pd.Series([0.5] * len(df), index=df.index)
        docking_component = _minmax_score(df[docking_col], invert=True) if has_docking else pd.Series([0.5] * len(df), index=df.index)
        property_component = _minmax_score(df["qed"]) if has_property else pd.Series([0.5] * len(df), index=df.index)
        admet_component = _minmax_score(df["admet_risk_score"], invert=True) if has_admet else pd.Series([0.5] * len(df), index=df.index)
        domain_component = pd.Series([0.5] * len(df), index=df.index)
        if has_domain:
            domain_component = df["domain_label"].map({"high": 1.0, "medium": 0.7, "low": 0.4, "out_of_domain": 0.1}).fillna(0.5)
        qm_component = _minmax_score(df[qm_gap_col], invert=True) if qm_gap_col else pd.Series([0.5] * len(df), index=df.index)

        docking_real = df.get("docking_is_real", pd.Series([has_docking] * len(df), index=df.index)).fillna(False)
        heuristic = df.get("is_heuristic_fallback", pd.Series([False] * len(df), index=df.index)).fillna(False)
        qm_status = df.get("qm_status", pd.Series(["missing"] * len(df), index=df.index)).fillna("missing").astype(str)
        domain_label = df.get("domain_label", pd.Series(["missing"] * len(df), index=df.index)).fillna("missing").astype(str)

        evidence_quality = pd.Series([1.0] * len(df), index=df.index)
        evidence_quality[docking_real == False] *= 0.70
        evidence_quality[heuristic == True] *= 0.80
        evidence_quality[qm_status.str.contains("eht_fallback", na=False)] *= 0.90
        evidence_quality[qm_status.str.contains("failed|missing", na=False)] *= 0.85
        evidence_quality[domain_label == "out_of_domain"] *= 0.70
        evidence_quality[domain_label == "low"] *= 0.85

        self.weight_config = {"activity": 0.25, "docking": 0.20, "property": 0.12, "admet": 0.15, "domain": 0.15, "qm": 0.13}
        raw_score = (self.weight_config["activity"] * activity_component + self.weight_config["docking"] * docking_component + self.weight_config["property"] * property_component + self.weight_config["admet"] * admet_component + self.weight_config["domain"] * domain_component + self.weight_config["qm"] * qm_component).clip(0, 1)
        final_score = (raw_score * evidence_quality).clip(0, 1)

        why_high, why_low, missing_evidence = [], [], []
        for i in range(len(df)):
            high, low, miss = [], [], []
            if has_activity and activity_component.iloc[i] >= 0.7: high.append("strong activity prediction")
            if not has_activity: miss.append("activity")
            if has_docking and docking_component.iloc[i] >= 0.7 and bool(docking_real.iloc[i]): high.append("favorable real docking")
            if has_docking and not bool(docking_real.iloc[i]): low.append("mock docking evidence downgraded")
            if not has_docking: miss.append("docking")
            if has_domain and domain_label.iloc[i] in {"high", "medium"}: high.append(f"{domain_label.iloc[i]} applicability domain")
            if has_domain and domain_label.iloc[i] in {"low", "out_of_domain"}: low.append(f"{domain_label.iloc[i]} applicability domain")
            if not has_domain: miss.append("applicability_domain")
            if has_qm and qm_status.iloc[i] == "xtb_success": high.append("xTB QM evidence available")
            if has_qm and qm_status.iloc[i] == "eht_fallback": low.append("QM is EHT fallback, not xTB")
            if not has_qm: miss.append("qm_orbital")
            if has_admet and admet_component.iloc[i] < 0.3: low.append("high ADMET risk")
            if not has_admet: miss.append("admet")
            why_high.append("; ".join(high) if high else "no dominant positive evidence")
            why_low.append("; ".join(low) if low else "no dominant negative evidence")
            missing_evidence.append("; ".join(miss) if miss else "none")

        ranked = pd.DataFrame({"candidate_id": df[cid_col].astype(str), "canonical_smiles": df[smi_col].astype(str), "activity_component": activity_component.round(4), "docking_component": docking_component.round(4), "property_component": property_component.round(4), "admet_component": admet_component.round(4), "domain_component": domain_component.round(4), "qm_component": qm_component.round(4), "raw_score": raw_score.round(4), "evidence_quality_multiplier": evidence_quality.round(4), "final_score": final_score.round(4), "docking_is_real": docking_real.astype(bool), "qm_status": qm_status, "domain_label": domain_label, "why_high": why_high, "why_low": why_low, "missing_evidence": missing_evidence, "ranking_method": self.validated_payload.get("ranking_method", "ensemble"), "claim_boundary": "Prioritization index only; not measured potency or therapeutic probability."}).sort_values("final_score", ascending=False)
        if self.validated_payload.get("max_candidates"):
            ranked = ranked.head(int(self.validated_payload["max_candidates"]))
        ranked["rank"] = range(1, len(ranked) + 1)
        self.rankings = ranked
        self.rank_ablation = ranked[["candidate_id", "activity_component", "docking_component", "property_component", "admet_component", "domain_component", "qm_component", "evidence_quality_multiplier", "final_score"]].copy()
        self.evidence_status = ranked[["candidate_id", "docking_is_real", "qm_status", "domain_label", "missing_evidence"]].copy()
        self.add_usage_actual("candidate_count", len(ranked))
        self.add_usage_actual("rank_uses_domain", int(has_domain))
        self.add_usage_actual("rank_uses_orbital", int(has_qm))

    def write_outputs(self) -> None:
        self.register_artifact(self.write_csv(self.rankings.to_dict("records"), "ranked_candidates"), "csv", "ranked_candidates")
        if not self.rankings.empty:
            expl = self.rankings[["candidate_id", "why_high", "why_low", "missing_evidence"]]
            self.register_artifact(self.write_csv(expl.to_dict("records"), "rank_explanations"), "csv", "rank_explanations")
        if not self.rank_ablation.empty:
            self.register_artifact(self.write_csv(self.rank_ablation.to_dict("records"), "rank_ablation"), "csv", "rank_ablation")
        if not self.evidence_status.empty:
            self.register_artifact(self.write_csv(self.evidence_status.to_dict("records"), "evidence_status_report"), "csv", "evidence_status_report")
        missing = self.rankings[self.rankings["missing_evidence"] != "none"] if not self.rankings.empty else pd.DataFrame()
        if not missing.empty:
            self.register_artifact(self.write_csv(missing[["candidate_id", "missing_evidence"]].to_dict("records"), "missing_evidence_report"), "csv", "missing_evidence_report")
        self.register_artifact(self.write_json(self.weight_config, "weight_config_used"), "json", "weight_config_used")
        summary = {"rows": len(self.rankings), "uses_domain_evidence": bool(self.usage_actual.get("rank_uses_domain", 0)), "uses_orbital_evidence": bool(self.usage_actual.get("rank_uses_orbital", 0)), "claim_boundary": "Computational prioritization only; wet-lab validation required."}
        self.register_artifact(self.write_json(summary, "q_rank_summary"), "json", "q_rank_summary")
