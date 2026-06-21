from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


router = APIRouter(prefix="/v1/industrial", tags=["industrial-readiness"])

WORKSPACE_DIR = Path(os.getenv("QDF_WORKSPACE_DIR", "workspace"))

ASSAY_BLUEPRINTS = [
    {
        "assay": "Biochemical IC50/Ki",
        "purpose": "Estimate target biochemical inhibition or binding competition.",
        "controls": ["vehicle", "known active reference", "inactive analog when available"],
        "concentration_range": "10-point 0.3 nM to 30 uM, half-log dilution",
        "pass_fail": "Advance if curve is well fit, Hill slope is plausible, and potency clears program-specific threshold.",
    },
    {
        "assay": "Direct Kd target engagement",
        "purpose": "Orthogonal binding confirmation by SPR, MST, ITC, DSF, CETSA, or NanoBRET.",
        "controls": ["reference ligand", "no-protein blank", "denatured/irrelevant protein"],
        "concentration_range": "8-12 concentrations around predicted activity window",
        "pass_fail": "Advance if binding is reproducible and not driven by aggregation, fluorescence, or assay interference.",
    },
    {
        "assay": "Cell viability dose response",
        "purpose": "Check whether target biology translates to a disease-relevant cellular phenotype.",
        "controls": ["matched sensitive/resistant line", "vehicle", "approved/reference inhibitor"],
        "concentration_range": "9-point 1 nM to 50 uM with 72 h readout",
        "pass_fail": "Advance only with target-rational selectivity and acceptable cytotoxicity interpretation.",
    },
    {
        "assay": "Target-pathway engagement",
        "purpose": "Measure pathway modulation such as phospho-marker, PARylation, hormone-response, or apoptosis marker.",
        "controls": ["positive pathway control", "vehicle", "time-course blank"],
        "concentration_range": "3-5 concentrations around cellular IC50 estimate",
        "pass_fail": "Advance if pathway modulation aligns with target mechanism and exposure.",
    },
    {
        "assay": "Selectivity panel",
        "purpose": "Profile close family members and high-risk off-targets before lead declaration.",
        "controls": ["family reference inhibitors", "pan-assay interference counterscreen"],
        "concentration_range": "single point at 1 uM/10 uM followed by dose-response for hits",
        "pass_fail": "Advance if selectivity ratio meets program gate or risk is explainable.",
    },
    {
        "assay": "Kinetic solubility",
        "purpose": "Determine whether poor aqueous solubility can invalidate biochemical or cellular readouts.",
        "controls": ["nephelometry standard", "DMSO blank"],
        "concentration_range": "pH 2, 6.5, and 7.4 at assay-relevant DMSO",
        "pass_fail": "Flag if solubility is below top assay concentration or precipitation is observed.",
    },
    {
        "assay": "Caco-2/MDCK permeability",
        "purpose": "Estimate passive permeability and efflux liability.",
        "controls": ["high/low permeability controls", "P-gp inhibitor condition"],
        "concentration_range": "single concentration with bidirectional transport",
        "pass_fail": "Flag low permeability, high efflux ratio, or mass-balance problems.",
    },
    {
        "assay": "Microsomal stability",
        "purpose": "Estimate metabolic stability and clearance risk.",
        "controls": ["species panel", "NADPH minus control", "high/low clearance controls"],
        "concentration_range": "0, 5, 15, 30, 60 min depletion time course",
        "pass_fail": "Flag fast turnover, reactive metabolite concern, or species divergence.",
    },
    {
        "assay": "CYP inhibition/substrate panel",
        "purpose": "Screen DDI liabilities across CYP3A4, CYP2D6, CYP2C9, CYP2C19, and CYP1A2.",
        "controls": ["isoform-specific inhibitors", "substrate cocktail", "matrix blank"],
        "concentration_range": "IC50 around 0.03-50 uM plus time-dependent inhibition when needed",
        "pass_fail": "Flag potent inhibition, time-dependent inhibition, or narrow exposure margin.",
    },
    {
        "assay": "hERG electrophysiology or binding",
        "purpose": "Check early cardiac repolarization liability.",
        "controls": ["dofetilide or cisapride positive control", "vehicle"],
        "concentration_range": "patch clamp preferred; binding screen followed by functional confirmation",
        "pass_fail": "Flag if hERG margin is incompatible with projected free exposure.",
    },
    {
        "assay": "Early tox and plasma protein binding",
        "purpose": "Combine cytotoxicity, Ames/genotox triage, mitochondrial stress, and free fraction.",
        "controls": ["tox positive controls", "serum/plasma matrix blanks"],
        "concentration_range": "tox dose-response plus equilibrium dialysis or ultrafiltration",
        "pass_fail": "Flag genotoxicity, mitochondrial stress, or very low unbound fraction without mitigation.",
    },
]

BENCHMARK_TARGETS = [
    "EGFR",
    "ERBB2",
    "MET",
    "ALK",
    "ROS1",
    "KRAS",
    "BRAF",
    "PIK3CA",
    "PARP1",
    "PARP2",
    "FLT3",
    "IDH1",
    "IDH2",
    "BCL2",
    "CDK4",
    "CDK6",
    "ESR1",
    "AR",
    "BRCA1",
    "BRCA2",
]


class IndustrialCandidate(BaseModel):
    id: str = Field(..., min_length=1, max_length=160)
    target: str | None = Field(default=None, max_length=80)
    smiles: str | None = Field(default=None, max_length=4000)
    inchikey: str | None = Field(default=None, max_length=80)
    predicted_activity: float | None = Field(default=None, ge=0, le=1)
    docking_score: float | None = Field(default=None)
    admet_score: float | None = Field(default=None, ge=0, le=1)
    uncertainty: float | None = Field(default=None, ge=0, le=1)
    applicability_domain: str | None = Field(default=None, max_length=120)
    pose_url: str | None = Field(default=None, max_length=2048)
    admet_risks: list[str] = Field(default_factory=list, max_length=50)
    synthesis_flags: list[str] = Field(default_factory=list, max_length=50)
    evidence_tier: str = Field(default="computational_hypothesis", max_length=80)
    metadata: dict[str, Any] = Field(default_factory=dict)


class WetLabPlanRequest(BaseModel):
    candidates: list[IndustrialCandidate] = Field(default_factory=list, max_length=50)
    case_context: dict[str, Any] = Field(default_factory=dict)
    program_stage: str = Field(default="hit_triage", max_length=80)
    requester: str = Field(default="researcher", max_length=128)
    include_formats: list[str] = Field(default_factory=lambda: ["json", "csv", "benchling_csv", "sdf_manifest", "mol2_manifest", "pdbqt_manifest", "markdown"], max_length=20)


class AssayResultImportRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list, max_length=5000)
    csv_text: str | None = Field(default=None, max_length=2_000_000)
    source: str = Field(default="wet_lab_upload", max_length=128)
    actor: str = Field(default="researcher", max_length=128)
    reason: str = Field(default="import wet-lab assay results", max_length=500)


class DecisionGateRequest(BaseModel):
    candidate_id: str = Field(..., min_length=1, max_length=160)
    action: Literal["promote_to_wet_lab", "reject", "needs_synthesis_review", "needs_admet_review", "watchlist"]
    actor: str = Field(default="researcher", max_length=128)
    reason: str = Field(..., min_length=3, max_length=800)
    second_reviewer: str | None = Field(default=None, max_length=128)
    evidence_snapshot: dict[str, Any] = Field(default_factory=dict)


class SignatureRequest(BaseModel):
    report_id: str = Field(..., min_length=1, max_length=160)
    signer: str = Field(default="researcher", max_length=128)
    signer_role: str = Field(default="researcher", max_length=80)
    meaning: str = Field(default="I approve this research-only candidate report for controlled wet-lab planning.", max_length=500)
    reason: str = Field(default="candidate report approval", max_length=500)
    report_payload: dict[str, Any] = Field(default_factory=dict)
    lock_report: bool = True


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _industrial_root() -> Path:
    root = (WORKSPACE_DIR / "industrial").resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_slug(value: str, fallback: str = "item") -> str:
    clean = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in str(value).strip())[:120].strip("._-")
    return clean or fallback


def _canonical(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))


def _hash(payload: Any) -> str:
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()


def _read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def _append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, default=str) + "\n")


def _audit_path() -> Path:
    return _industrial_root() / "audit" / "audit_log.jsonl"


def _read_audit(limit: int = 200) -> list[dict[str, Any]]:
    path = _audit_path()
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines()[-limit:]:
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def _append_audit(
    action: str,
    actor: str,
    subject: str,
    reason: str,
    old_value: Any = None,
    new_value: Any = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    previous = _read_audit(limit=1)
    previous_hash = previous[-1].get("event_hash") if previous else "genesis"
    event = {
        "audit_id": f"audit_{uuid.uuid4().hex[:12]}",
        "timestamp": _now(),
        "actor": actor,
        "action": action,
        "subject": subject,
        "reason": reason,
        "old_value_hash": _hash(old_value) if old_value is not None else None,
        "new_value_hash": _hash(new_value) if new_value is not None else None,
        "previous_hash": previous_hash,
        "metadata": metadata or {},
        "claim_boundary": "Audit record for research workflow governance; not a regulated e-signature system unless deployed under validated SOPs.",
    }
    event["event_hash"] = _hash({key: value for key, value in event.items() if key != "event_hash"})
    _append_jsonl(_audit_path(), event)
    return event


def _risk_flags(candidate: IndustrialCandidate) -> list[str]:
    flags = list(dict.fromkeys([*(candidate.admet_risks or []), *(candidate.synthesis_flags or [])]))
    if candidate.uncertainty is not None and candidate.uncertainty >= 0.45:
        flags.append("high model uncertainty")
    if candidate.applicability_domain and "out" in candidate.applicability_domain.lower():
        flags.append("outside applicability domain")
    if candidate.pose_url is None:
        flags.append("missing docked pose artifact")
    return flags


def _decision_for_candidate(candidate: IndustrialCandidate) -> dict[str, Any]:
    flags = _risk_flags(candidate)
    activity = candidate.predicted_activity if candidate.predicted_activity is not None else 0.5
    admet = candidate.admet_score if candidate.admet_score is not None else 0.5
    if "outside applicability domain" in flags or len(flags) >= 5:
        gate = "needs_review"
        rationale = "High uncertainty or multiple liabilities; do not spend wet-lab budget before expert review."
    elif activity >= 0.72 and admet >= 0.55 and len(flags) <= 2:
        gate = "test_now"
        rationale = "Computational priority is high enough for first-pass biochemical and ADME confirmation."
    elif admet < 0.4:
        gate = "needs_admet_review"
        rationale = "ADMET risk is too high for unqualified promotion."
    elif candidate.synthesis_flags:
        gate = "needs_synthesis_review"
        rationale = "Medchem or procurement review should happen before assay spend."
    else:
        gate = "watchlist"
        rationale = "Keep as a computational hypothesis until stronger evidence or analog context exists."
    return {"gate": gate, "rationale": rationale, "risk_flags": flags}


def _candidate_plan(candidate: IndustrialCandidate) -> dict[str, Any]:
    decision = _decision_for_candidate(candidate)
    assays = []
    for blueprint in ASSAY_BLUEPRINTS:
        assay = dict(blueprint)
        assay["candidate_id"] = candidate.id
        assay["target"] = candidate.target or "target_not_specified"
        assay["evidence_tier"] = candidate.evidence_tier
        assay["required_inputs"] = ["compound identity", "purity", "stock concentration", "target construct", "assay SOP"]
        assay["output_artifacts"] = ["raw plate data", "curve fit", "QC flags", "signed result row"]
        assays.append(assay)
    return {
        "candidate_id": candidate.id,
        "target": candidate.target,
        "smiles": candidate.smiles,
        "inchikey": candidate.inchikey,
        "predicted_activity": candidate.predicted_activity,
        "docking_score": candidate.docking_score,
        "admet_score": candidate.admet_score,
        "uncertainty": candidate.uncertainty,
        "applicability_domain": candidate.applicability_domain or "not_reported",
        "pose_url": candidate.pose_url,
        "decision_gate": decision,
        "assays": assays,
        "pass_fail_summary": {
            "advance": "Biochemical/orthogonal engagement plus at least one disease-relevant cellular signal and manageable ADME flags.",
            "hold": "Inconclusive curves, low solubility/permeability, high hERG/CYP/genotox flags, or no target engagement.",
            "reject": "Irreproducible assay signal, pan-assay interference, severe tox liability, or mechanism-inconsistent cellular effect.",
        },
        "claim_boundary": "Assay plan is for research validation planning only; experimental results are required before activity or safety claims.",
    }


def _rows_to_csv(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return ""
    columns = sorted({key for row in rows for key in row.keys()})
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def _csv_to_rows(text: str) -> list[dict[str, Any]]:
    buffer = io.StringIO(text)
    return [dict(row) for row in csv.DictReader(buffer)]


def _lab_packet_for_plan(plan: dict[str, Any], formats: list[str]) -> dict[str, Any]:
    candidates = plan.get("candidates", [])
    assay_rows = []
    for candidate in candidates:
        for assay in candidate.get("assays", []):
            assay_rows.append(
                {
                    "candidate_id": candidate["candidate_id"],
                    "target": candidate.get("target"),
                    "assay": assay["assay"],
                    "purpose": assay["purpose"],
                    "controls": "; ".join(assay["controls"]),
                    "concentration_range": assay["concentration_range"],
                    "pass_fail": assay["pass_fail"],
                    "decision_gate": candidate["decision_gate"]["gate"],
                }
            )
    candidate_rows = [
        {
            "candidate_id": candidate["candidate_id"],
            "target": candidate.get("target"),
            "smiles": candidate.get("smiles"),
            "inchikey": candidate.get("inchikey"),
            "predicted_activity": candidate.get("predicted_activity"),
            "docking_score": candidate.get("docking_score"),
            "admet_score": candidate.get("admet_score"),
            "uncertainty": candidate.get("uncertainty"),
            "applicability_domain": candidate.get("applicability_domain"),
            "pose_url": candidate.get("pose_url"),
            "decision_gate": candidate["decision_gate"]["gate"],
            "risk_flags": "; ".join(candidate["decision_gate"]["risk_flags"]),
        }
        for candidate in candidates
    ]
    result_template = [
        {
            "candidate_id": candidate["candidate_id"],
            "target": candidate.get("target"),
            "assay": "Biochemical IC50/Ki",
            "endpoint": "IC50",
            "value": "",
            "unit": "nM",
            "qc_status": "",
            "lab_sample_id": "",
            "assay_date": "",
            "scientist": "",
        }
        for candidate in candidates
    ]
    markdown = ["# Wet-Lab Assay Packet", "", plan["claim_boundary"], ""]
    for candidate in candidates:
        markdown.extend(
            [
                f"## {candidate['candidate_id']} ({candidate.get('target') or 'target not specified'})",
                f"- Decision gate: {candidate['decision_gate']['gate']}",
                f"- Rationale: {candidate['decision_gate']['rationale']}",
                f"- Risks: {', '.join(candidate['decision_gate']['risk_flags']) or 'none flagged'}",
                f"- Pose: {candidate.get('pose_url') or 'not available'}",
                "- Required first assays: biochemical IC50/Ki, direct Kd target engagement, cell viability, selectivity panel, ADME/tox counterscreens.",
                "",
            ]
        )
    exports: dict[str, str] = {}
    if "json" in formats:
        exports["assay_packet.json"] = json.dumps(plan, indent=2, default=str)
    if "csv" in formats:
        exports["candidate_assay_packet.csv"] = _rows_to_csv(candidate_rows)
        exports["assay_protocol_matrix.csv"] = _rows_to_csv(assay_rows)
        exports["assay_result_import_template.csv"] = _rows_to_csv(result_template)
    if "benchling_csv" in formats:
        exports["benchling_style_registration.csv"] = _rows_to_csv(candidate_rows)
    if "markdown" in formats or "md" in formats:
        exports["assay_packet.md"] = "\n".join(markdown)
    if "sdf_manifest" in formats:
        exports["sdf_manifest.csv"] = _rows_to_csv([{"candidate_id": row["candidate_id"], "smiles": row["smiles"], "sdf_required": True} for row in candidate_rows])
    if "mol2_manifest" in formats:
        exports["mol2_manifest.csv"] = _rows_to_csv([{"candidate_id": row["candidate_id"], "mol2_required": True, "note": "Generate with OpenBabel after final protonation/tautomer selection."} for row in candidate_rows])
    if "pdbqt_manifest" in formats:
        exports["pdbqt_manifest.csv"] = _rows_to_csv([{"candidate_id": row["candidate_id"], "pdbqt_required": True, "note": "Generate from selected docked pose for Vina/Smina reproducibility."} for row in candidate_rows])
    return {
        "candidate_rows": candidate_rows,
        "assay_rows": assay_rows,
        "result_template": result_template,
        "exports": exports,
    }


def _build_plan(request: WetLabPlanRequest) -> dict[str, Any]:
    candidates = request.candidates or [
        IndustrialCandidate(id="NO-CANDIDATE", target=None, evidence_tier="missing_candidate_context", admet_risks=["No candidate set supplied"])
    ]
    plans = [_candidate_plan(candidate) for candidate in candidates]
    gates: dict[str, int] = {}
    for plan in plans:
        gate = plan["decision_gate"]["gate"]
        gates[gate] = gates.get(gate, 0) + 1
    return {
        "plan_id": f"wetlab_plan_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}",
        "created_at": _now(),
        "requester": request.requester,
        "program_stage": request.program_stage,
        "case_context": request.case_context,
        "summary": {
            "candidate_count": len(plans),
            "assay_types_per_candidate": len(ASSAY_BLUEPRINTS),
            "decision_gates": gates,
            "closed_loop_enabled": True,
        },
        "candidates": plans,
        "closed_loop": {
            "result_import_endpoint": "/v1/industrial/wet-lab/results/import",
            "active_learning_rule": "New assay rows update confidence calibration, applicability-domain warnings, and redesign priority. Model retraining remains controlled by model-governance SOP.",
            "required_result_columns": ["candidate_id", "assay", "endpoint", "value", "unit", "qc_status", "assay_date", "scientist"],
        },
        "claim_boundary": "Research-use wet-lab planning packet. This does not claim binding, efficacy, safety, clinical utility, or regulatory suitability.",
    }


@router.post("/wet-lab/assay-plan")
def wet_lab_assay_plan(request: WetLabPlanRequest) -> dict[str, Any]:
    plan = _build_plan(request)
    path = _industrial_root() / "wet_lab_plans" / f"{plan['plan_id']}.json"
    _write_json(path, plan)
    audit = _append_audit(
        "wet_lab_assay_plan_generated",
        request.requester,
        plan["plan_id"],
        "generate wet-lab assay recommendation plan",
        new_value=plan,
        metadata={"artifact_path": path.as_posix(), "candidate_count": len(request.candidates)},
    )
    return {**plan, "artifact_path": path.as_posix(), "audit_id": audit["audit_id"]}


@router.post("/wet-lab/assay-packet")
def wet_lab_assay_packet(request: WetLabPlanRequest) -> dict[str, Any]:
    plan = _build_plan(request)
    packet = _lab_packet_for_plan(plan, request.include_formats)
    packet_id = f"assay_packet_{uuid.uuid4().hex[:12]}"
    root = _industrial_root() / "assay_packets" / packet_id
    for filename, content in packet["exports"].items():
        (root / filename).parent.mkdir(parents=True, exist_ok=True)
        (root / filename).write_text(content, encoding="utf-8")
    manifest = {
        "packet_id": packet_id,
        "created_at": _now(),
        "plan": plan,
        "export_files": sorted(packet["exports"].keys()),
        "artifact_dir": root.as_posix(),
        "claim_boundary": plan["claim_boundary"],
    }
    _write_json(root / "manifest.json", manifest)
    audit = _append_audit(
        "wet_lab_assay_packet_exported",
        request.requester,
        packet_id,
        "export lab-ready assay packet",
        new_value=manifest,
        metadata={"artifact_dir": root.as_posix(), "files": manifest["export_files"]},
    )
    return {**manifest, "exports": packet["exports"], "audit_id": audit["audit_id"]}


@router.post("/wet-lab/results/import")
def import_assay_results(request: AssayResultImportRequest) -> dict[str, Any]:
    rows = list(request.rows)
    if request.csv_text:
        rows.extend(_csv_to_rows(request.csv_text))
    if not rows:
        raise HTTPException(status_code=400, detail="Provide rows or csv_text with assay results.")
    normalized = []
    for index, row in enumerate(rows, start=1):
        candidate_id = str(row.get("candidate_id") or row.get("compound_id") or row.get("molecule_id") or "").strip()
        assay = str(row.get("assay") or row.get("assay_type") or row.get("endpoint") or "").strip()
        value = row.get("value") or row.get("standard_value") or row.get("activity_value")
        qc_status = str(row.get("qc_status") or row.get("status") or "pending_review").strip().lower()
        normalized.append(
            {
                "row_number": index,
                "candidate_id": candidate_id or "unmapped_candidate",
                "target": row.get("target"),
                "assay": assay or "unmapped_assay",
                "endpoint": row.get("endpoint") or row.get("standard_type") or assay or "unmapped_endpoint",
                "value": value,
                "unit": row.get("unit") or row.get("standard_units") or "not_reported",
                "qc_status": qc_status,
                "assay_date": row.get("assay_date"),
                "scientist": row.get("scientist") or request.actor,
                "source": request.source,
                "imported_at": _now(),
            }
        )
    root = _industrial_root() / "assay_results"
    import_id = f"assay_results_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    path = root / f"{import_id}.jsonl"
    for row in normalized:
        _append_jsonl(path, row)
    per_candidate: dict[str, dict[str, Any]] = {}
    for row in normalized:
        stats = per_candidate.setdefault(row["candidate_id"], {"rows": 0, "pass": 0, "fail": 0, "pending": 0})
        stats["rows"] += 1
        status_text = row["qc_status"]
        if "pass" in status_text or "valid" in status_text:
            stats["pass"] += 1
        elif "fail" in status_text or "reject" in status_text:
            stats["fail"] += 1
        else:
            stats["pending"] += 1
    recommendations = {}
    for candidate_id, stats in per_candidate.items():
        if stats["fail"] >= 2:
            action = "redesign_or_reject"
        elif stats["pass"] >= 3 and stats["fail"] == 0:
            action = "promote_with_second_review"
        else:
            action = "collect_more_data"
        recommendations[candidate_id] = {
            **stats,
            "confidence_delta": round((stats["pass"] * 0.08) - (stats["fail"] * 0.12), 3),
            "recommended_action": action,
        }
    summary = {
        "import_id": import_id,
        "imported_rows": len(normalized),
        "artifact_path": path.as_posix(),
        "per_candidate": recommendations,
        "active_learning": {
            "status": "ready_for_recalibration" if len(normalized) >= 3 else "collect_more_results",
            "next_step": "Freeze current model version, run calibration report, then decide whether retraining is permitted by model-governance SOP.",
            "features_updated": ["experimental_endpoint", "qc_status", "confidence_delta", "applicability_domain_review"],
        },
        "claim_boundary": "Imported assay rows support research feedback and model recalibration only after QC review.",
    }
    _write_json(root / f"{import_id}_summary.json", summary)
    audit = _append_audit(
        "wet_lab_results_imported",
        request.actor,
        import_id,
        request.reason,
        new_value=summary,
        metadata={"source": request.source, "rows": len(normalized)},
    )
    return {**summary, "audit_id": audit["audit_id"]}


@router.post("/decision-gates")
def decision_gate(request: DecisionGateRequest) -> dict[str, Any]:
    if request.action == "promote_to_wet_lab" and not request.second_reviewer:
        status = "pending_second_review"
        message = "Promotion to wet-lab testing requires a second reviewer."
    elif request.action == "promote_to_wet_lab" and request.second_reviewer == request.actor:
        raise HTTPException(status_code=400, detail="Second reviewer must be different from actor for wet-lab promotion.")
    else:
        status = "approved"
        message = "Decision gate recorded."
    record = {
        "decision_id": f"decision_{uuid.uuid4().hex[:12]}",
        "timestamp": _now(),
        "candidate_id": request.candidate_id,
        "action": request.action,
        "status": status,
        "actor": request.actor,
        "second_reviewer": request.second_reviewer,
        "reason": request.reason,
        "evidence_snapshot_hash": _hash(request.evidence_snapshot),
        "message": message,
        "claim_boundary": "Decision gate controls research workflow state; it is not clinical or regulatory approval.",
    }
    path = _industrial_root() / "decision_gates" / f"{record['decision_id']}.json"
    _write_json(path, record)
    audit = _append_audit(
        "decision_gate_recorded",
        request.actor,
        request.candidate_id,
        request.reason,
        new_value=record,
        metadata={"decision_id": record["decision_id"], "status": status, "action": request.action},
    )
    return {**record, "artifact_path": path.as_posix(), "audit_id": audit["audit_id"]}


@router.post("/e-signatures")
def electronic_signature(request: SignatureRequest) -> dict[str, Any]:
    payload_hash = _hash(request.report_payload)
    signature = {
        "signature_id": f"sig_{uuid.uuid4().hex[:12]}",
        "timestamp": _now(),
        "report_id": request.report_id,
        "payload_hash": payload_hash,
        "signer": request.signer,
        "signer_role": request.signer_role,
        "meaning": request.meaning,
        "reason": request.reason,
        "locked": request.lock_report,
        "signature_hash": _hash({"report_id": request.report_id, "payload_hash": payload_hash, "signer": request.signer, "meaning": request.meaning}),
        "claim_boundary": "Electronic signature workflow supports research governance; Part 11/GxP use requires validated deployment and SOP controls.",
    }
    root = _industrial_root() / "signatures"
    _write_json(root / f"{signature['signature_id']}.json", signature)
    if request.lock_report:
        frozen = {
            "report_id": request.report_id,
            "locked_at": signature["timestamp"],
            "payload_hash": payload_hash,
            "signature_id": signature["signature_id"],
            "report_payload": request.report_payload,
        }
        _write_json(_industrial_root() / "frozen_reports" / f"{_safe_slug(request.report_id)}.json", frozen)
    audit = _append_audit(
        "electronic_signature_applied",
        request.signer,
        request.report_id,
        request.reason,
        new_value=signature,
        metadata={"signature_id": signature["signature_id"], "locked": request.lock_report},
    )
    return {**signature, "audit_id": audit["audit_id"]}


@router.get("/audit-log")
def audit_log(limit: int = 200) -> dict[str, Any]:
    limit = max(1, min(limit, 1000))
    rows = _read_audit(limit=limit)
    return {
        "count": len(rows),
        "rows": rows,
        "export_formats": ["jsonl", "json", "csv"],
        "claim_boundary": "Audit export is inspection-support evidence; regulated use requires validated storage and retention controls.",
    }


@router.get("/benchmarks/validation-plan")
def benchmark_validation_plan() -> dict[str, Any]:
    return {
        "targets": BENCHMARK_TARGETS,
        "target_count": len(BENCHMARK_TARGETS),
        "external_blinded_sets": {
            "strategy": "Hold out target-series and scaffold families not touched during development.",
            "minimum": "10-20 oncology targets with actives, decoys, references, and negative controls.",
        },
        "time_split_validation": {
            "train": "Older ChEMBL/public bioactivity releases only.",
            "test": "Later assays and newly published measurements.",
            "leakage_checks": ["duplicate compound", "stereoisomer/salt duplicate", "Bemis-Murcko scaffold", "target-family leakage", "near-reference inhibitor Tanimoto"],
        },
        "prospective_mode": {
            "rule": "Freeze model, emit timestamped predictions, lock report, then compare after wet-lab results import.",
            "required_artifacts": ["model_version", "data_cutoff", "candidate_packet", "audit_signature", "assay_result_import"],
        },
        "uncertainty_ranking": ["confidence interval", "applicability-domain label", "do-not-trust-because warnings", "evidence-tier label"],
        "qsar_governance": ["endpoint definition", "algorithm", "applicability domain", "robustness", "external predictivity", "interpretability", "model card"],
    }


@router.get("/cheminformatics/feature-matrix")
def cheminformatics_feature_matrix() -> dict[str, Any]:
    features = [
        ("retrosynthesis", "planned_connector", "Route prediction connector and reaction feasibility scoring."),
        ("purchasability", "planned_connector", "Vendor/building-block availability with quote-ready export."),
        ("synthetic_accessibility", "heuristic_ready", "SA, alerts, complexity, reactive/covalent flags."),
        ("matched_molecular_pairs", "planned_module", "Series analysis for substituent transformations."),
        ("scaffold_hopping", "planned_module", "Bioisostere and scaffold replacement workbench."),
        ("hERG", "assay_and_model_slot", "Early cardiac liability model plus wet-lab confirmation."),
        ("CYP inhibition/substrate", "assay_and_model_slot", "CYP3A4/2D6/2C9/2C19/1A2 DDI screen."),
        ("Ames/DILI/BBB/logS/Caco2/PPB/clearance", "assay_and_model_slot", "Expanded ADMET endpoints with imported experimental feedback."),
        ("kinase_panel_selectivity", "assay_and_model_slot", "Family panel and anti-target dashboard."),
        ("explicit_solvent_md_fep", "advanced_compute_plan", "Evidence-tiered MD/FEP plan; not claimed active until configured."),
    ]
    return {
        "features": [{"id": key, "status": status, "description": description} for key, status, description in features],
        "evidence_tiers": ["proxy", "exploratory_computational", "validated_computational", "experimentally_confirmed"],
        "claim_boundary": "Feature matrix records capability state; unavailable advanced physics is labelled as planned, not silently implied.",
    }


@router.get("/readiness")
def industrial_readiness() -> dict[str, Any]:
    compliance_dir = Path("docs/compliance")
    industrial_dir = Path("docs/industrial_readiness")
    compliance_expected = [
        "intended_use_statement.md",
        "validation_master_plan.md",
        "user_requirements_specification.md",
        "functional_requirements_specification.md",
        "risk_assessment.md",
        "traceability_matrix.csv",
        "test_protocols.md",
        "test_summary_report.md",
        "change_control_sop.md",
        "data_integrity_policy.md",
        "model_governance_policy.md",
        "electronic_records_policy.md",
    ]
    industrial_expected = [
        "competitive_landscape.md",
        "validation_case_study_EGFR.md",
        "validation_case_study_PARPI.md",
        "validation_case_study_PIK3CA.md",
        "roi_model.md",
        "pilot_plan_for_pharma_lab.md",
        "security_whitepaper.md",
        "data_governance_whitepaper.md",
        "scientific_limitations.md",
        "customer_onboarding_guide.md",
    ]
    compliance = {name: (compliance_dir / name).exists() for name in compliance_expected}
    industrial = {name: (industrial_dir / name).exists() for name in industrial_expected}
    return {
        "compliance_docs": compliance,
        "industrial_docs": industrial,
        "compliance_doc_completion": round(sum(compliance.values()) / len(compliance), 3),
        "industrial_doc_completion": round(sum(industrial.values()) / len(industrial), 3),
        "executable_modules": [
            "wet-lab assay recommendation engine",
            "lab-ready assay packet export",
            "assay result import",
            "closed-loop active-learning summary",
            "decision gates with two-person wet-lab promotion",
            "electronic signature and frozen report record",
            "hash-chained audit log",
            "benchmark validation plan",
            "cheminformatics feature matrix",
        ],
        "production_gaps": [
            "validated SSO/SAML/MFA deployment",
            "managed object storage with signed URLs",
            "Kubernetes GPU autoscaling",
            "malware scanning service",
            "full OpenTelemetry/Prometheus/Grafana stack",
            "validated backup/restore drills",
        ],
        "claim_boundary": "Industrial readiness support layer for research-use software. Not a GMP-validated system by itself.",
    }
