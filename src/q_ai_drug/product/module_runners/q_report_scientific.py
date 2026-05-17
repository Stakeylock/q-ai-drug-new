"""Evidence-aware Q-Report runner.

Generates candidate reports that explicitly distinguish real, fallback, mock,
missing, and wet-lab-required evidence. This runner is intentionally conservative:
all conclusions remain computational hypotheses.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from q_ai_drug.product.module_runners.base import BaseModuleRunner, ModuleInputError
from q_ai_drug.service.artifact_resolver import resolve_artifact_path
from q_ai_drug.service.tool_payloads import QReportPayload


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


def _filter_candidates(df: pd.DataFrame, ids: list[str]) -> pd.DataFrame:
    if df.empty or not ids:
        return df
    id_cols = [c for c in ["candidate_id", "compound_id", "name", "id"] if c in df.columns]
    if not id_cols:
        return df
    col = id_cols[0]
    return df[df[col].astype(str).isin([str(i) for i in ids])].copy()


def _markdown_table(df: pd.DataFrame, columns: list[str], max_rows: int = 20) -> list[str]:
    cols = [c for c in columns if c in df.columns]
    if df.empty or not cols:
        return ["_No table data available._"]
    table = df[cols].head(max_rows).fillna("").astype(str)
    lines = ["| " + " | ".join(cols) + " |", "| " + " | ".join(["---"] * len(cols)) + " |"]
    for _, row in table.iterrows():
        lines.append("| " + " | ".join(row[c].replace("|", "/") for c in cols) + " |")
    return lines


class QReportRunner(BaseModuleRunner):
    """Evidence-aware report generator."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id, project_dir, run_id, payload)
        self.ranked = pd.DataFrame()
        self.triage = pd.DataFrame()
        self.evidence_status = pd.DataFrame()
        self.rank_ablation = pd.DataFrame()
        self.selected = pd.DataFrame()
        self.claim_matrix = pd.DataFrame()
        self.report_manifest: dict[str, Any] = {}

    def validate_payload(self) -> None:
        try:
            self.validated_payload = QReportPayload.model_validate(self.payload).model_dump()
        except Exception as exc:
            raise ModuleInputError(f"Invalid Q-Report payload: {exc}")

    def resolve_inputs(self) -> None:
        payload = self.validated_payload or {}
        self.ranked = _safe_read_csv(_resolve_path(self.project_dir, payload.get("ranked_candidates_artifact_id"), payload.get("ranked_candidates_upload_file"), "ranked_candidates"))
        self.triage = _safe_read_csv(_resolve_path(self.project_dir, payload.get("triage_artifact_id"), payload.get("triage_upload_file"), "triage"))
        self.evidence_status = _safe_read_csv(_resolve_path(self.project_dir, payload.get("evidence_status_artifact_id"), payload.get("evidence_status_upload_file"), "evidence_status"))
        self.rank_ablation = _safe_read_csv(_resolve_path(self.project_dir, payload.get("rank_ablation_artifact_id"), payload.get("rank_ablation_upload_file"), "rank_ablation"))
        self.add_usage_requested("candidate_count", len(payload.get("candidate_ids", [])))

    def run(self) -> None:
        ids = [str(x) for x in self.validated_payload.get("candidate_ids", [])]
        if not ids:
            raise ModuleInputError("candidate_ids must contain at least one selected candidate")

        if not self.ranked.empty:
            self.selected = _filter_candidates(self.ranked, ids)
        else:
            self.selected = pd.DataFrame({"candidate_id": ids, "selected_for_report": True})
            self.add_warning("No ranked_candidates artifact supplied; report will contain selected IDs only.")

        status = _filter_candidates(self.evidence_status, ids) if not self.evidence_status.empty else pd.DataFrame()
        triage = _filter_candidates(self.triage, ids) if not self.triage.empty else pd.DataFrame()
        ablation = _filter_candidates(self.rank_ablation, ids) if not self.rank_ablation.empty else pd.DataFrame()

        claim_rows: list[dict[str, Any]] = []
        for cid in ids:
            row_status = status[status["candidate_id"].astype(str) == cid] if not status.empty and "candidate_id" in status.columns else pd.DataFrame()
            row_ranked = self.selected[self.selected["candidate_id"].astype(str) == cid] if not self.selected.empty and "candidate_id" in self.selected.columns else pd.DataFrame()
            docking_real = None
            qm_status = "missing"
            domain_label = "missing"
            missing_evidence = "unknown"
            if not row_status.empty:
                docking_real = bool(row_status.iloc[0].get("docking_is_real", False))
                qm_status = str(row_status.iloc[0].get("qm_status", "missing"))
                domain_label = str(row_status.iloc[0].get("domain_label", "missing"))
                missing_evidence = str(row_status.iloc[0].get("missing_evidence", "unknown"))
            elif not row_ranked.empty:
                docking_real = bool(row_ranked.iloc[0].get("docking_is_real", False)) if "docking_is_real" in row_ranked.columns else None
                qm_status = str(row_ranked.iloc[0].get("qm_status", "missing")) if "qm_status" in row_ranked.columns else "missing"
                domain_label = str(row_ranked.iloc[0].get("domain_label", "missing")) if "domain_label" in row_ranked.columns else "missing"
                missing_evidence = str(row_ranked.iloc[0].get("missing_evidence", "unknown")) if "missing_evidence" in row_ranked.columns else "unknown"

            evidence_level = "computational_hypothesis"
            if docking_real is True and qm_status == "xtb_success" and domain_label in {"high", "medium"} and missing_evidence in {"none", ""}:
                evidence_level = "strong_computational_package"
            elif docking_real is False or "missing" in missing_evidence or qm_status in {"missing", "failed_xtb", "failed_eht", "failed_input"}:
                evidence_level = "incomplete_or_fallback_computational_package"

            claim_rows.append({
                "candidate_id": cid,
                "evidence_level": evidence_level,
                "docking_is_real": docking_real,
                "qm_status": qm_status,
                "domain_label": domain_label,
                "missing_evidence": missing_evidence,
                "allowed_claim": "computational prioritization hypothesis",
                "disallowed_claim": "validated drug, therapeutic effect, clinical efficacy, or wet-lab activity",
                "required_next_validation": "biochemical target assay followed by orthogonal cellular and ADMET validation",
            })

        self.claim_matrix = pd.DataFrame(claim_rows)
        self.report_manifest = {
            "candidate_ids": ids,
            "report_template": self.validated_payload.get("report_template", "standard"),
            "ranked_rows": len(self.selected),
            "triage_rows": len(triage),
            "evidence_status_rows": len(status),
            "rank_ablation_rows": len(ablation),
            "claim_boundary": "Computational candidate dossier only. Wet-lab validation is required before any therapeutic or activity claim.",
            "included_artifacts": {
                "ranked_candidates": not self.ranked.empty,
                "triage": not self.triage.empty,
                "evidence_status": not self.evidence_status.empty,
                "rank_ablation": not self.rank_ablation.empty,
            },
        }
        self._triage = triage
        self._ablation = ablation
        self.add_usage_actual("candidate_count", len(ids))

    def write_outputs(self) -> None:
        ids = self.report_manifest.get("candidate_ids", [])
        selected_rows = [{"candidate_id": cid, "selected_for_report": True} for cid in ids]
        self.register_artifact(self.write_csv(selected_rows, "selected_candidates"), "csv", "selected_candidates")
        if not self.claim_matrix.empty:
            self.register_artifact(self.write_csv(self.claim_matrix.to_dict("records"), "claim_matrix"), "csv", "claim_matrix")
        if not self.selected.empty:
            self.register_artifact(self.write_csv(self.selected.to_dict("records"), "report_ranked_candidates_subset"), "csv", "report_ranked_candidates_subset")

        markdown = [
            f"# Q-AI Drug Candidate Report ({self.report_manifest['report_template']})",
            "",
            "## Scientific Claim Boundaries",
            f"> **WARNING:** {self.report_manifest['claim_boundary']}",
            "",
            "This report separates real, fallback, mock, missing, and wet-lab-required evidence. A high rank is not a measured activity value.",
            "",
            "## Selected Candidates",
            *[f"- `{cid}`" for cid in ids],
            "",
            "## Evidence Claim Matrix",
            *_markdown_table(self.claim_matrix, ["candidate_id", "evidence_level", "docking_is_real", "qm_status", "domain_label", "missing_evidence", "allowed_claim", "required_next_validation"]),
            "",
            "## Ranking Evidence",
            *_markdown_table(self.selected, ["rank", "candidate_id", "final_score", "why_high", "why_low", "missing_evidence"]),
            "",
            "## Wet-Lab Triage",
            *_markdown_table(getattr(self, "_triage", pd.DataFrame()), ["candidate_id", "triage_class", "scientific_utility", "reasons_to_test", "reasons_not_to_test", "recommended_first_assay"]),
            "",
            "## Score Ablation",
            *_markdown_table(getattr(self, "_ablation", pd.DataFrame()), ["candidate_id", "activity_component", "docking_component", "admet_component", "domain_component", "qm_component", "evidence_quality_multiplier", "final_score"]),
            "",
            "## Limitations",
            "- Computational hypotheses only; no therapeutic claim is made.",
            "- Mock docking, fallback QM, missing evidence, and out-of-domain predictions must be treated as lower-confidence evidence.",
            "- Wet-lab validation is required before any biological activity or safety claim.",
        ]
        md_path = self.output_dir / "report.md"
        md_path.write_text("\n".join(markdown), encoding="utf-8")
        self.register_artifact(md_path, "markdown", "report_markdown")
        html_path = self.output_dir / "report.html"
        html_path.write_text("<html><body>" + "<br/>".join(markdown) + "</body></html>", encoding="utf-8")
        self.register_artifact(html_path, "html", "report_html")
        self.register_artifact(self.write_json(self.report_manifest, "report_manifest"), "json", "report_manifest")
