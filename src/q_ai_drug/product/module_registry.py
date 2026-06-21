from __future__ import annotations

import ast
from dataclasses import asdict, dataclass, replace
from typing import Any


TIER_ORDER = [
    "student_free",
    "student_pro",
    "academic_researcher",
    "professional_individual",
    "startup_team",
    "cro_service_lab",
    "industry_biotech",
    "enterprise_pharma",
    "private_deployment",
]

TIER_LABELS = {
    "student_free": "Student Free",
    "student_pro": "Student Pro",
    "academic_researcher": "Academic Researcher",
    "professional_individual": "Professional Individual",
    "startup_team": "Startup Team",
    "cro_service_lab": "CRO / Service Lab",
    "industry_biotech": "Industry / Biotech",
    "enterprise_pharma": "Enterprise Pharma",
    "private_deployment": "Private Deployment",
}

TIER_QUOTAS = {
    "student_free": {"molecules_per_run": 100, "docking_pairs_month": 0, "qm_rows_month": 0, "collaboration": "single_user"},
    "student_pro": {"molecules_per_run": 1000, "docking_pairs_month": 500, "qm_rows_month": 50, "collaboration": "single_user"},
    "academic_researcher": {"molecules_per_run": 10000, "docking_pairs_month": 5000, "qm_rows_month": 500, "collaboration": "small_team"},
    "professional_individual": {"molecules_per_run": 25000, "docking_pairs_month": 10000, "qm_rows_month": 1000, "collaboration": "single_or_pro"},
    "startup_team": {"molecules_per_run": 100000, "docking_pairs_month": 50000, "qm_rows_month": 5000, "collaboration": "team_workspace"},
    "cro_service_lab": {"molecules_per_run": 250000, "docking_pairs_month": "usage_based", "qm_rows_month": "usage_based", "collaboration": "client_workspaces"},
    "industry_biotech": {"molecules_per_run": 1000000, "docking_pairs_month": "contract", "qm_rows_month": "contract", "collaboration": "org_workspace"},
    "enterprise_pharma": {"molecules_per_run": "custom", "docking_pairs_month": "dedicated", "qm_rows_month": "dedicated", "collaboration": "sso_rbac_audit"},
    "private_deployment": {"molecules_per_run": "customer_controlled", "docking_pairs_month": "customer_controlled", "qm_rows_month": "customer_controlled", "collaboration": "customer_vpc"},
}

COMPUTE_DEPTH_PRESETS = {
    "quick_preview": {
        "label": "Quick Preview",
        "modules": ["onco_data_builder", "activity_model_studio", "q_filter", "applicability_domain_guard"],
        "intent": "minutes, cheap library quality and early score preview",
    },
    "standard_screen": {
        "label": "Standard Screen",
        "modules": ["q_filter", "q_portfolio_prefilter", "q_dock_studio", "q_rank"],
        "intent": "hours, moderate target-screening review",
    },
    "deep_screen": {
        "label": "Deep Screen",
        "modules": ["q_dock_studio", "interaction_fingerprint_analyzer", "q_orbital_analyzer", "q_rank"],
        "intent": "hours to day, high-evidence internal review",
    },
    "wet_lab_pack": {
        "label": "Wet-Lab Pack",
        "modules": ["wet_lab_triage_board", "q_report_and_candidate_dossiers", "collaboration_and_eln_bridge"],
        "intent": "controlled high-depth assay discussion export",
    },
}


@dataclass(frozen=True)
class ModuleContract:
    module_id: str
    name: str
    purpose: str
    queue: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    artifact_types: list[str]
    tier_minimum: str
    credit_estimator: str
    claim_boundary: str
    quality_gate: str
    failure_policy: str
    ui_screen: str
    export_formats: list[str]
    dependencies: list[str]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["tier_minimum_label"] = TIER_LABELS.get(self.tier_minimum, self.tier_minimum)
        payload["api_contract"] = {
            "run": f"POST /projects/{{project_id}}/tools/{self.module_id}/run",
            "versioned_run": f"POST /v1/tools/{self.module_id}/run",
            "job": "GET /jobs/{job_id}",
            "artifacts": "GET /projects/{project_id}/artifacts",
        }
        return payload


def _schema(required: list[str], optional: list[str] | None = None) -> dict[str, Any]:
    return {"type": "object", "required": required, "optional": optional or []}


MODULES: tuple[ModuleContract, ...] = (
    ModuleContract(
        "onco_data_builder",
        "OncoData Builder",
        "Retrieve, curate, split, and version public or private oncology activity datasets.",
        "data",
        _schema(["target_ids"], ["disease", "chembl_filters", "bindingdb_filters", "assay_csv_artifact_id"]),
        _schema(["curated_benchmark", "curation_report", "dataset_manifest", "provenance_card"]),
        ["csv", "html", "json"],
        "student_free",
        "5 + records_requested / 1000",
        "Public/private data curation evidence only; not expert manual assay review.",
        "Fail if no usable records; flag duplicates, sparse labels, and excluded assay rows.",
        "fail_closed",
        "Dataset curation workspace",
        ["CSV", "JSON", "HTML", "PDF"],
        ["retrieve_public_oncology_data", "curate_activity_benchmark", "scaffold_split"],
    ),
    ModuleContract(
        "target_intelligence_workspace",
        "Target Intelligence Workspace",
        "Turn disease biology into ranked target hypotheses with constraints and dossiers.",
        "data",
        _schema(["disease_or_target"], ["gene_list", "mutation_list", "omics_artifact_id", "target_family"]),
        _schema(["ranked_targets", "target_dossier", "risk_notes", "structure_availability"]),
        ["json", "md", "html"],
        "academic_researcher",
        "10 + target_count * 2",
        "Target rationale for research planning only; not treatment advice.",
        "Require mapped target identifiers and explicit disease/context limitations.",
        "degrade_to_public_evidence",
        "Target dossier screen",
        ["JSON", "HTML", "PDF"],
        ["target_dossiers", "literature_evidence", "structure_manifest"],
    ),
    ModuleContract(
        "protein_workbench",
        "Protein Workbench",
        "Prepare receptor structures and binding pockets for docking and downstream design.",
        "structure",
        _schema(["target_id"], ["pdb_artifact_id", "mmcif_artifact_id", "alphafold_artifact_id", "pocket_box", "reference_ligand"]),
        _schema(["clean_receptor", "prepared_receptor", "pocket_yaml", "structure_report"]),
        ["pdb", "pdbqt", "yaml", "html"],
        "academic_researcher",
        "20 + receptor_count * 10",
        "Structure preparation supports docking setup only; it does not validate binding.",
        "Fail if no receptor atoms, impossible pocket, or unsupported structure format.",
        "fail_closed",
        "Protein workbench and pocket editor",
        ["PDB", "PDBQT", "YAML", "HTML"],
        ["prepare_structures", "pocket_registry", "redocking_validation"],
    ),
    ModuleContract(
        "inhibitor_library_studio",
        "Inhibitor Library Studio",
        "Manage known inhibitors, actives, inactives, decoys, and user libraries as controls and seeds.",
        "data",
        _schema(["target_id"], ["inhibitor_csv_artifact_id", "sdf_artifact_id", "activity_units", "decoy_source"]),
        _schema(["inhibitor_registry", "active_inactive_table", "similarity_index", "proximity_report"]),
        ["csv", "sdf", "json", "html"],
        "student_pro",
        "5 + molecule_count / 2000",
        "Known inhibitors are controls and explainability anchors, not novelty claims.",
        "Reject invalid rows but retain valid inhibitors with activity/unit flags.",
        "partial_success",
        "Inhibitor registry and similarity search",
        ["CSV", "SDF", "JSON", "HTML"],
        ["reference_inhibitors", "tanimoto_search", "benchmark_builder"],
    ),
    ModuleContract(
        "q_generate",
        "Q-Generate",
        "Generate or enumerate target-conditioned candidate libraries under constraints.",
        "generation",
        _schema(["target_id"], ["known_inhibitors", "fragments", "forbidden_substructures", "library_size", "novelty_mode"]),
        _schema(["generated_smiles", "generation_metrics", "novelty_labels", "seed_provenance"]),
        ["csv", "smi", "sdf", "png"],
        "student_pro",
        "10 + generated_molecules / 1000",
        "Target-conditioned seed expansion and template enumeration, not unqualified de novo drug discovery.",
        "Stop if invalidity exceeds threshold; label seed reuse and close analogues.",
        "stop_on_high_invalidity",
        "Generation studio",
        ["CSV", "SMI", "SDF", "HTML"],
        ["generate_candidates", "generation_metrics", "novelty_analysis"],
    ),
    ModuleContract(
        "activity_model_studio",
        "Activity Model Studio",
        "Train, compare, calibrate, and apply target-specific activity models.",
        "training",
        _schema(["curated_benchmark"], ["model_family", "feature_set", "split_policy", "target_id"]),
        _schema(["model_comparison", "activity_scores", "calibration_report", "model_card"]),
        ["csv", "joblib", "json", "png"],
        "academic_researcher",
        "20 + training_rows / 1000",
        "Activity predictions are retrospective model estimates, not biological truth.",
        "Block if no train/eval split, no positives, or no explicit split strategy.",
        "fail_closed",
        "Activity model studio",
        ["CSV", "JSON", "HTML", "PNG"],
        ["train_activity", "baseline_comparison", "model_cards"],
    ),
    ModuleContract(
        "q_filter",
        "Q-Filter",
        "Filter molecules by medchem, drug-likeness, and endpoint-level ADMET risk.",
        "scoring",
        _schema(["candidate_library"], ["filter_rules", "risk_tolerance", "oncology_like_permissiveness"]),
        _schema(["filtered_candidates", "reject_reasons", "medchem_risk_table", "admet_endpoint_table"]),
        ["csv", "json", "png"],
        "student_free",
        "3 + molecule_count / 5000",
        "Early medchem/ADMET triage only; not a safety or toxicology claim.",
        "Continue with warnings for descriptor fallback; never hide reject reasons.",
        "partial_success",
        "Molecule library validation and filtering",
        ["CSV", "JSON", "HTML"],
        ["medchem_filters", "admet_models", "risk_explainer"],
    ),
    ModuleContract(
        "applicability_domain_guard",
        "Applicability Domain Guard",
        "Downgrade overconfident predictions outside training chemistry.",
        "scoring",
        _schema(["candidate_set", "training_molecules"], ["reference_inhibitors", "scaffold_table"]),
        _schema(["domain_csv", "nearest_active_table", "confidence_labels"]),
        ["csv", "json"],
        "student_free",
        "2 + molecule_count / 10000",
        "Applicability labels qualify model confidence; they do not prove activity or inactivity.",
        "Every candidate must receive a high, medium, low, or out-of-domain label.",
        "downgrade_confidence",
        "Applicability-domain panel",
        ["CSV", "JSON"],
        ["morgan_fingerprints", "murcko_scaffolds", "nearest_neighbor"],
    ),
    ModuleContract(
        "q_portfolio_prefilter",
        "Q-Portfolio Prefilter",
        "Use quantum-kernel style portfolio scoring before expensive physics stages.",
        "qml",
        _schema(["filtered_molecules", "budget"], ["activity_scores", "admet_scores", "target_id"]),
        _schema(["prefilter_scores", "rank_before_after", "ablation_metadata"]),
        ["csv", "json", "png"],
        "academic_researcher",
        "15 + molecule_count / 2000",
        "Exploratory quantum prioritization signal with classical ablations; no hardware superiority claim.",
        "Fall back to classical ranking if the quantum kernel fails and record the fallback.",
        "fallback_to_classical",
        "Quantum portfolio panel",
        ["CSV", "JSON", "PNG"],
        ["qiskit_statevector_kernel", "portfolio_optimizer", "ablation_tracking"],
    ),
    ModuleContract(
        "q_dock_studio",
        "Q-Dock Studio",
        "Run curated-pocket docking and GNINA/Vina/Smina rescoring with traceable evidence.",
        "docking",
        _schema(["prepared_receptor", "ligand_set", "pocket"], ["engine", "exhaustiveness", "reference_controls"]),
        _schema(["docking_csv", "poses", "logs", "failure_table", "redocking_validation"]),
        ["csv", "sdf", "pdbqt", "log", "json"],
        "academic_researcher",
        "30 + docking_pairs * 0.2 + gnina_pairs * 1.0",
        "Computational docking evidence only; wet-lab binding validation is required.",
        "Partial success allowed; every failed molecule must have an actionable log.",
        "partial_success",
        "Docking studio and pose review",
        ["CSV", "SDF", "PDBQT", "LOG", "HTML"],
        ["vina", "smina", "gnina", "openbabel", "redocking_validation"],
    ),
    ModuleContract(
        "q_view_3d",
        "Q-View 3D",
        "Inspect receptors, pockets, ligands, poses, surfaces, and interaction overlays.",
        "visual",
        _schema(["candidate_id"], ["pose_source", "surface_mode", "interaction_overlay"]),
        _schema(["viewer_payload", "artifact_urls", "snapshot"]),
        ["json", "png", "pdb", "sdf"],
        "student_pro",
        "1",
        "Visualization supports expert review; it is not an experimental binding observation.",
        "Hide broken assets and show the precise missing receptor/pose reason.",
        "actionable_missing_asset",
        "3D pose viewer",
        ["JSON", "PNG"],
        ["pose_viewer_data", "py3dmol_or_ngl", "artifact_server"],
    ),
    ModuleContract(
        "interaction_fingerprint_analyzer",
        "Interaction Fingerprint Analyzer",
        "Quantify pose contacts and key-residue plausibility.",
        "docking",
        _schema(["receptor_pdb", "pose_sdf", "target_id"], ["key_residues", "pose_source"]),
        _schema(["interaction_csv", "pose_notes", "quality_labels"]),
        ["csv", "md", "json"],
        "academic_researcher",
        "5 + pose_count * 0.05",
        "Geometric interaction fingerprints support prioritization but do not prove binding.",
        "Mark missing/implausible interactions rather than crashing or hiding failures.",
        "label_implausible",
        "Interaction fingerprint panel",
        ["CSV", "JSON", "MD"],
        ["interaction_fingerprints", "key_residue_registry", "pose_notes"],
    ),
    ModuleContract(
        "ligand_pose_relaxation",
        "Ligand-Pose Relaxation",
        "Run honest OpenMM ligand-pose relaxation triage without claiming complex MD.",
        "md",
        _schema(["docked_pose"], ["step_count", "temperature", "relaxation_mode"]),
        _schema(["rmsd_checkpoints", "trajectory_ps", "stability_table", "non_md_warning"]),
        ["csv", "pdb", "json"],
        "academic_researcher",
        "20 + pose_count * 0.5",
        "Ligand-pose relaxation only; not explicit-solvent protein-ligand MD or binding stability proof.",
        "Always label mode and forbid nanosecond/production-MD wording unless complex MD is implemented.",
        "label_as_triage",
        "Ligand-pose relaxation panel",
        ["CSV", "PDB", "JSON"],
        ["openmm_workflow", "rmsd_summary", "stability_table"],
    ),
    ModuleContract(
        "q_orbital_analyzer",
        "Q-Orbital Analyzer",
        "Compute late-stage electronic descriptors for shortlisted molecules.",
        "qm",
        _schema(["candidate_sdf_or_smiles"], ["qm_method", "charge", "spin", "target_context"]),
        _schema(["qm_descriptors", "failure_report", "electronic_risk_flags"]),
        ["csv", "json", "log", "png"],
        "academic_researcher",
        "25 + qm_rows * 1.0",
        "Quantum chemistry descriptors are electronic plausibility signals, not binding validation.",
        "Explicitly label xTB success or RDKit/EHT fallback for every row.",
        "label_fallback",
        "QM/QML analysis panel",
        ["CSV", "JSON", "LOG", "PNG"],
        ["xtb", "rdkit_eht_fallback", "qm_descriptor_summary"],
    ),
    ModuleContract(
        "q_rank",
        "Q-Rank",
        "Combine classical, docking, ADMET, QM, and QML evidence into transparent prioritization.",
        "ranking",
        _schema(["score_tables"], ["weights", "ablation_config", "budget_constraints", "wet_lab_criteria"]),
        _schema(["final_ranking", "rank_shifts", "calibrated_weights", "triage_recommendations"]),
        ["csv", "yaml", "json", "png"],
        "student_pro",
        "5 + candidate_count / 1000",
        "Final score is a prioritization index, not a biological probability.",
        "Block final recommendation if core evidence is missing; show ablation deltas.",
        "block_if_evidence_incomplete",
        "Ranking and evidence dashboard",
        ["CSV", "YAML", "JSON", "PNG"],
        ["final_score", "weight_ablation", "wet_lab_triage"],
    ),
    ModuleContract(
        "wet_lab_triage_board",
        "Wet-Lab Triage Board",
        "Classify candidates without a hard top-N limit using evidence, risk, novelty, and budget.",
        "decision",
        _schema(["ranked_candidates"], ["budget", "assay_type", "risk_tolerance", "novelty_preference"]),
        _schema(["triage_classes", "reasons_to_test", "reasons_not_to_test", "assay_recommendations"]),
        ["csv", "json", "md", "html"],
        "student_pro",
        "3 + candidate_count / 1000",
        "Wet-lab triage is a research planning aid, not an instruction to treat or dose patients.",
        "No hard top-N; every candidate must receive reasons to test and reasons not to test.",
        "classify_all_candidates",
        "Wet-lab triage board",
        ["CSV", "JSON", "HTML", "PDF"],
        ["triage_rules", "candidate_dossiers", "assay_plan_generator"],
    ),
    ModuleContract(
        "q_report_and_candidate_dossiers",
        "Q-Report and Candidate Dossiers",
        "Generate scientist-grade exports with limitations, claim matrix, and dossier packs.",
        "reporting",
        _schema(["project_outputs"], ["report_template", "candidate_selection", "export_formats"]),
        _schema(["report_html", "report_pdf", "candidate_dossiers", "claim_matrix", "artifact_pack"]),
        ["html", "pdf", "csv", "sdf", "md", "json"],
        "student_free",
        "5",
        "Reports must preserve research-use and wet-lab-validation claim boundaries.",
        "Report fails if claim gate fails or required limitations are missing.",
        "fail_claim_gate",
        "Report and export center",
        ["CSV", "SDF", "HTML", "PDF", "MD", "JSON"],
        ["report_builder", "candidate_dossiers", "claim_matrix"],
    ),
    ModuleContract(
        "collaboration_and_eln_bridge",
        "Collaboration and ELN Bridge",
        "Capture annotations, decisions, assay feedback, and ELN/LIMS-ready exports.",
        "collaboration",
        _schema(["project_id"], ["team_members", "annotations", "assay_results", "external_ids"]),
        _schema(["decision_log", "assay_feedback", "audit_trail", "next_round_design_suggestions"]),
        ["json", "csv", "md"],
        "startup_team",
        "2 + annotation_count / 100",
        "Assay feedback is user-supplied research data and must be isolated by tenant/project.",
        "Never expose unauthorized project state; every write must be audit logged.",
        "enforce_rbac",
        "Team annotations and decision log",
        ["CSV", "JSON", "MD"],
        ["rbac", "audit_logs", "assay_feedback_loop"],
    ),
)

MODULE_BY_ID = {module.module_id: module for module in MODULES}
MODULE_BY_ID["q_report"] = replace(MODULE_BY_ID["q_report_and_candidate_dossiers"], module_id="q_report")


def list_modules() -> list[dict[str, Any]]:
    return [module.to_dict() for module in MODULES]


def get_module(module_id: str) -> ModuleContract:
    try:
        return MODULE_BY_ID[module_id]
    except KeyError as exc:
        raise KeyError(f"Unknown module_id: {module_id}") from exc


def tier_allows(tier: str, module_id: str) -> bool:
    module = get_module(module_id)
    tier_key = tier.lower().replace(" ", "_").replace("/", "").replace("-", "_")
    if tier_key not in TIER_ORDER:
        tier_key = "student_free"
    return TIER_ORDER.index(tier_key) >= TIER_ORDER.index(module.tier_minimum)


def _payload_float(payload: dict[str, Any], *keys: str, default: float = 0.0) -> float:
    for key in keys:
        value = payload.get(key)
        if value is None or value == "":
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return default


def _safe_formula_eval(expression: str, variables: dict[str, float]) -> float:
    parsed = ast.parse(expression, mode="eval")

    def visit(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return visit(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.Name):
            if node.id not in variables:
                raise ValueError(f"Unknown estimator variable: {node.id}")
            return variables[node.id]
        if isinstance(node, ast.UnaryOp):
            operand = visit(node.operand)
            if isinstance(node.op, ast.UAdd):
                return operand
            if isinstance(node.op, ast.USub):
                return -operand
        if isinstance(node, ast.BinOp):
            left = visit(node.left)
            right = visit(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                if right == 0:
                    raise ValueError("Division by zero in credit estimator")
                return left / right
        raise ValueError("Unsupported credit estimator expression")

    return visit(parsed)


def estimate_credits(module_id: str, payload: dict[str, Any] | None = None) -> float:
    payload = payload or {}
    module = get_module(module_id)
    target_ids = payload.get("target_ids")
    target_count_default = float(len(target_ids)) if isinstance(target_ids, list) and target_ids else 1.0
    molecule_count = _payload_float(payload, "molecule_count", "candidate_count", "max_molecules", "max_ligands")
    variables = {
        "molecule_count": molecule_count,
        "candidate_count": molecule_count,
        "docking_pairs": _payload_float(payload, "docking_pairs"),
        "gnina_pairs": _payload_float(payload, "gnina_pairs"),
        "qm_rows": _payload_float(payload, "qm_rows"),
        "records_requested": _payload_float(payload, "records_requested", "max_records_per_target"),
        "generated_molecules": _payload_float(payload, "generated_molecules", "n_generate"),
        "training_rows": _payload_float(payload, "training_rows", "row_count", "records_requested"),
        "pose_count": _payload_float(payload, "pose_count", "candidate_count"),
        "target_count": _payload_float(payload, "target_count", default=target_count_default),
        "receptor_count": _payload_float(payload, "receptor_count", default=1.0),
        "annotation_count": _payload_float(payload, "annotation_count"),
    }
    try:
        value = _safe_formula_eval(module.credit_estimator, variables)
    except Exception:
        value = 1.0
    return round(max(float(value), 1.0), 2)


def module_registry_document() -> dict[str, Any]:
    return {
        "module_count": len(MODULES),
        "modules": list_modules(),
        "tiers": [{"tier_id": key, "label": TIER_LABELS[key], "quotas": TIER_QUOTAS[key]} for key in TIER_ORDER],
        "compute_depth_presets": COMPUTE_DEPTH_PRESETS,
        "claim_boundary": "Computational research hypothesis only. Not a therapeutic, diagnostic, clinical, or regulatory claim. Wet-lab validation is required.",
    }

