from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path) if path.exists() and path.stat().st_size > 0 else pd.DataFrame()


def _merge_optional(base: pd.DataFrame, other: pd.DataFrame, columns: list[str] | None = None) -> pd.DataFrame:
    if other.empty or "candidate_id" not in base.columns or "candidate_id" not in other.columns:
        return base
    keep = [column for column in ["target_id", "candidate_id", *(columns or list(other.columns))] if column in other.columns]
    keep = list(dict.fromkeys(keep))
    return base.merge(other[keep].drop_duplicates(["target_id", "candidate_id"]), on=["target_id", "candidate_id"], how="left", suffixes=("", "_triage"))


def _value(row: pd.Series, key: str, default: Any = None) -> Any:
    value = row.get(key, default)
    try:
        if pd.isna(value):
            return default
    except Exception:
        pass
    return value


def _float(row: pd.Series, key: str, default: float = 0.0) -> float:
    try:
        value = _value(row, key, default)
        return float(value)
    except Exception:
        return default


def _redocking_context(project_dir: Path) -> dict[str, dict[str, Any]]:
    redocking = _read_csv(project_dir / "docking" / "redocking_validation.csv")
    if redocking.empty:
        return {}
    return {str(row.get("target_id")): row.to_dict() for _, row in redocking.iterrows()}


def _classify(row: pd.Series, redocking_by_target: dict[str, dict[str, Any]]) -> dict[str, Any]:
    reasons_to_test: list[str] = []
    reasons_not_to_test: list[str] = []
    assay_recommendations = [
        "Primary biochemical target assay with dose-response IC50.",
        "Orthogonal assay or biophysical confirmation.",
        "Matched cellular viability/pathway assay plus cytotoxicity counterscreen.",
        "Reference inhibitor and inactive controls in the same plate.",
    ]

    confidence = _float(row, "prediction_confidence", _float(row, "activity_score", 0.0))
    final_score = _float(row, "final_score", 0.0)
    if confidence >= 0.70:
        reasons_to_test.append("Activity prediction is inside or near the trained applicability domain.")
    else:
        reasons_not_to_test.append("Activity prediction confidence is weak or outside the applicability domain.")

    admet_class = str(_value(row, "admet_risk_class", "unknown"))
    if admet_class in {"low", "medium"}:
        reasons_to_test.append(f"Early ADMET/Tox21/ClinTox triage is {admet_class}.")
    elif admet_class == "unknown":
        reasons_not_to_test.append("Endpoint-level ADMET risk is missing.")
    else:
        reasons_not_to_test.append(f"ADMET/toxicity risk is {admet_class}.")

    medchem_class = str(_value(row, "medchem_risk_class", "unknown"))
    if medchem_class in {"clean", "acceptable_oncology_like"}:
        reasons_to_test.append(f"Medicinal chemistry risk class is {medchem_class}.")
    elif medchem_class == "unknown":
        reasons_not_to_test.append("Medicinal chemistry risk classification is missing.")
    else:
        reasons_not_to_test.append(f"Medicinal chemistry risk class is {medchem_class}: {_value(row, 'medchem_risk_reasons', 'review required')}.")

    interaction_quality = str(_value(row, "interaction_quality", "missing"))
    if interaction_quality == "plausible_key_pocket_contacts":
        reasons_to_test.append("Docked/GNINA pose has plausible configured key-pocket contacts.")
    elif "contact" in interaction_quality:
        reasons_not_to_test.append("Pose has contacts but misses configured key-residue evidence.")
    else:
        reasons_not_to_test.append("Pose interaction evidence is missing or implausible.")

    target_id = str(_value(row, "target_id", ""))
    redocking = redocking_by_target.get(target_id, {})
    rmsd = pd.to_numeric(pd.Series([redocking.get("redocking_rmsd_angstrom")]), errors="coerce").iloc[0] if redocking else None
    if redocking and pd.notna(rmsd) and float(rmsd) <= 2.0:
        reasons_to_test.append(f"Reference redocking for {target_id} is acceptable (RMSD {float(rmsd):.2f} A).")
    elif redocking and pd.notna(rmsd):
        reasons_not_to_test.append(f"Reference redocking RMSD is high ({float(rmsd):.2f} A); docking evidence should be downgraded.")
    else:
        reasons_not_to_test.append("Reference redocking context is incomplete.")

    nearest_ref_sim = _float(row, "nearest_inhibitor_similarity", _float(row, "nearest_reference_similarity", -1.0))
    if nearest_ref_sim > 0.90:
        reasons_not_to_test.append("Too close to a configured reference inhibitor to justify a novelty claim.")
    elif nearest_ref_sim >= 0:
        reasons_to_test.append("Candidate is differentiated from configured reference inhibitors by fingerprint similarity.")

    qm_is_real = str(_value(row, "qm_is_real", "")).lower() in {"true", "1", "yes"}
    qm_score = _float(row, "quantum_score", 0.0)
    if qm_is_real:
        reasons_to_test.append("xTB/RDKit quantum descriptor row is available for late-stage electronic plausibility review.")
    elif qm_score:
        reasons_not_to_test.append("QM descriptor row is fallback or incomplete; electronic interpretation is weak.")

    if final_score >= 0.70:
        reasons_to_test.append("Overall prioritization index is high relative to the current computational portfolio.")
    elif final_score < 0.45:
        reasons_not_to_test.append("Overall prioritization index is low relative to the current computational portfolio.")

    severe_reasons = [
        reason
        for reason in reasons_not_to_test
        if any(token in reason.lower() for token in ["toxicity risk is high", "reject", "too close", "implausible", "high ("])
    ]
    evidence_count = len(reasons_to_test)
    if severe_reasons and final_score < 0.75:
        decision = "reject_hold"
    elif final_score >= 0.68 and evidence_count >= 5 and len(reasons_not_to_test) <= 1:
        decision = "test_now"
    elif final_score >= 0.58 and evidence_count >= 3:
        decision = "test_after_review"
    elif final_score >= 0.45 or evidence_count >= 2:
        decision = "watchlist"
    else:
        decision = "reject_hold"

    confidence_class = "high" if evidence_count >= 6 and len(reasons_not_to_test) <= 1 else "medium" if evidence_count >= 3 else "low"
    return {
        "triage_class": decision,
        "triage_confidence": confidence_class,
        "evidence_completeness": round(evidence_count / 7.0, 3),
        "reasons_to_test": " | ".join(reasons_to_test),
        "reasons_not_to_test": " | ".join(reasons_not_to_test) if reasons_not_to_test else "No major computational blocker identified; wet-lab validation still required.",
        "recommended_assay_plan": " | ".join(assay_recommendations),
        "claim_boundary": "Computational hypothesis only. Requires biochemical/cellular validation.",
    }


def build_wet_lab_triage_board(project_dir: str | Path, *, budget: int | None = None) -> pd.DataFrame:
    project_dir = Path(project_dir)
    out_dir = project_dir / "triage"
    out_dir.mkdir(parents=True, exist_ok=True)
    ranked = _read_csv(project_dir / "final_ranked_candidates.csv")
    if ranked.empty:
        ranked = _read_csv(project_dir / "top_candidates.csv")
    if ranked.empty:
        empty = pd.DataFrame()
        empty.to_csv(out_dir / "wet_lab_triage_board.csv", index=False)
        return empty

    evidence = ranked.copy()
    evidence = _merge_optional(evidence, _read_csv(project_dir / "models" / "applicability_domain.csv"))
    evidence = _merge_optional(evidence, _read_csv(project_dir / "medchem" / "medchem_risk_table.csv"))
    evidence = _merge_optional(evidence, _read_csv(project_dir / "admet" / "candidate_admet_risk_table.csv"))
    evidence = _merge_optional(evidence, _read_csv(project_dir / "docking" / "interaction_fingerprints.csv"))
    evidence = _merge_optional(evidence, _read_csv(project_dir / "inhibitors" / "candidate_inhibitor_proximity.csv"))
    boundary_renames = {
        column: f"upstream_{column}"
        for column in evidence.columns
        if column == "claim_boundary" or column.startswith("claim_boundary")
    }
    if boundary_renames:
        evidence = evidence.rename(columns=boundary_renames)
    redocking = _redocking_context(project_dir)
    triage_rows = []
    for _, row in evidence.iterrows():
        triage_rows.append(_classify(row, redocking))
    triage = pd.concat([evidence.reset_index(drop=True), pd.DataFrame(triage_rows)], axis=1)
    if budget is not None and budget > 0:
        triage["within_budget_rank"] = triage.groupby("triage_class").cumcount() + 1
        triage["budget_selected"] = False
        candidates = triage.sort_values(["triage_class", "final_score"], ascending=[True, False]).head(budget).index
        triage.loc[candidates, "budget_selected"] = True
    triage.to_csv(out_dir / "wet_lab_triage_board.csv", index=False)
    summary = {
        "candidate_count": int(len(triage)),
        "no_hard_top_n": True,
        "budget": budget,
        "triage_class_counts": triage["triage_class"].value_counts().to_dict(),
        "claim_boundary": "Computational research hypothesis only. Not a therapeutic, diagnostic, clinical, or regulatory claim. Wet-lab validation is required.",
    }
    (out_dir / "wet_lab_triage_summary.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    _write_assay_pack(triage, out_dir / "wet_lab_assay_pack.md")
    _write_triage_html(triage, out_dir / "wet_lab_triage_board.html")
    return triage


def _write_assay_pack(triage: pd.DataFrame, path: Path) -> None:
    lines = [
        "# Wet-Lab Triage Assay Pack",
        "",
        "Computational research hypothesis only. Not a therapeutic, diagnostic, clinical, or regulatory claim. Wet-lab validation is required.",
        "",
        "## Portfolio Counts",
    ]
    counts = triage["triage_class"].value_counts().to_dict() if not triage.empty else {}
    for key in ["test_now", "test_after_review", "watchlist", "reject_hold"]:
        lines.append(f"- {key}: {int(counts.get(key, 0))}")
    lines.extend(["", "## Recommended Assay Sequence", "- Biochemical target assay with dose-response IC50.", "- Orthogonal assay or binding confirmation.", "- Cell-line pathway/viability assay where target biology is relevant.", "- Cytotoxicity and selectivity counterscreens.", "- ADMET follow-up for confirmed biochemical/cellular hits.", "", "## Representative Candidates"])
    for _, row in triage.head(30).iterrows():
        lines.extend(
            [
                f"### {row.get('target_id')} - {row.get('candidate_id')} ({row.get('triage_class')})",
                f"- Reasons to test: {row.get('reasons_to_test')}",
                f"- Reasons not to test: {row.get('reasons_not_to_test')}",
                "",
            ]
        )
    path.write_text("\n".join(lines), encoding="utf-8")


def _write_triage_html(triage: pd.DataFrame, path: Path) -> None:
    table = triage[["target_id", "candidate_id", "final_score", "triage_class", "triage_confidence", "reasons_to_test", "reasons_not_to_test"]].head(200)
    html = [
        "<!doctype html><html><head><meta charset='utf-8'><title>Wet-Lab Triage Board</title>",
        "<style>body{font-family:Arial,sans-serif;margin:32px;color:#17201d}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d5ddd9;padding:8px;vertical-align:top}th{background:#edf4f1}.small{color:#51615b}</style></head><body>",
        "<h1>Wet-Lab Triage Board</h1>",
        "<p class='small'>Computational research hypothesis only. Wet-lab validation is required. The board classifies all available candidates; it does not impose a hard top-N.</p>",
        table.to_html(index=False, escape=True),
        "</body></html>",
    ]
    path.write_text("\n".join(html), encoding="utf-8")

