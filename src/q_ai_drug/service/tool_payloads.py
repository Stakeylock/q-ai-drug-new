"""Typed payload models for all scientist-facing modules.

Each payload validates and documents the input contract for a module.
Payloads are used to:
1. Validate user input before queueing
2. Document what configuration a module accepts
3. Track actual requested vs completed work for billing/quotas
4. Support type hints in module runners
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Enums for common options
# ============================================================================


class FilterStrictness(str, Enum):
    """Drug-likeness filter profile."""
    STRICT = "strict"
    STANDARD = "standard"
    ONCOLOGY_PERMISSIVE = "oncology_permissive"


class DockingEngine(str, Enum):
    """Docking/scoring engine options."""
    VINA = "vina"
    SMINA = "smina"
    GNINA = "gnina"
    VINA_SMINA = "vina_smina"
    VINA_SMINA_GNINA = "vina_smina_gnina"


class QMMethod(str, Enum):
    """Quantum mechanics method."""
    XTB = "xtb"
    RDKIT_FALLBACK = "rdkit_fallback"
    AUTO = "auto"


class PocketSource(str, Enum):
    """Source of pocket definition."""
    UPLOADED_BOX = "uploaded_box"
    CURATED_REGISTRY = "curated_registry"
    REFERENCE_LIGAND = "reference_ligand"


class UploadType(str, Enum):
    """Detected upload file type."""
    SMILES_CSV = "smiles_csv"
    SDF_LIBRARY = "sdf_library"
    PROTEIN_STRUCTURE_PDB = "protein_structure_pdb"
    PROTEIN_STRUCTURE_MMCIF = "protein_structure_mmcif"
    POCKET_YAML = "pocket_yaml"
    ASSAY_CSV = "assay_csv"
    ADMET_CSV = "admet_csv"
    KNOWN_INHIBITORS_CSV = "known_inhibitors_csv"
    CANDIDATE_SCORES_CSV = "candidate_scores_csv"
    UNKNOWN = "unknown"


# ============================================================================
# Pocket Box Definition
# ============================================================================


class PocketBox(BaseModel):
    """3D box definition for docking pocket."""
    center_x: float = Field(..., description="Box center X coordinate (Angstroms)")
    center_y: float = Field(..., description="Box center Y coordinate (Angstroms)")
    center_z: float = Field(..., description="Box center Z coordinate (Angstroms)")
    size_x: float = Field(..., description="Box size in X direction (Angstroms)")
    size_y: float = Field(..., description="Box size in Y direction (Angstroms)")
    size_z: float = Field(..., description="Box size in Z direction (Angstroms)")

    @field_validator('size_x', 'size_y', 'size_z')
    @classmethod
    def validate_size(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Box size must be positive")
        if v > 100:
            raise ValueError("Box size cannot exceed 100 Angstroms")
        return v


# ============================================================================
# OncoData Builder Payload
# ============================================================================


class OncoDataBuilderPayload(BaseModel):
    """OncoData Builder: Dataset curation and provisioning.

    Accept target IDs and data source configuration.
    Output curated activity benchmark with metadata and provenance.
    """
    target_ids: list[str] = Field(
        ...,
        description="Target identifiers to curate (e.g., ['TP53', 'EGFR'])"
    )
    data_sources: Literal["public_only", "public_plus_uploaded", "uploaded_only"] = Field(
        default="public_only",
        description="Data source configuration"
    )
    uploaded_assay_csv: Optional[str] = Field(
        None,
        description="Path to user-uploaded assay CSV if using public_plus_uploaded"
    )
    uploaded_assay_csv_artifact_id: Optional[str] = Field(
        None,
        description="Artifact ID for uploaded assay CSV"
    )
    curation_profile: Literal["standard", "strict", "permissive"] = Field(
        default="standard",
        description="Curation stringency: strict (high-confidence only), standard (balanced), permissive (exploratory)"
    )
    dry_run: bool = Field(
        default=False,
        description="Dry-run mode"
    )

    @field_validator('target_ids')
    @classmethod
    def validate_targets(cls, v: list[str]) -> list[str]:
        if len(v) == 0:
            raise ValueError("At least one target must be specified")
        if len(v) > 20:
            raise ValueError("Maximum 20 targets per run")
        return v


# ============================================================================
# Q-Filter Payload
# ============================================================================


class QFilterPayload(BaseModel):
    """Q-Filter: Drug-likeness and risk filtering.

    Accept molecule library, run filtering with customizable strictness,
    output filtered/rejected molecules with reasons and risk tables.
    """
    candidate_library_artifact_id: Optional[str] = Field(
        None,
        description="Artifact ID from previous upload/run, or null to use upload"
    )
    # Also accept 'candidate_artifact_id' as alias for consistency
    candidate_artifact_id: Optional[str] = Field(
        None,
        description="Alias for candidate_library_artifact_id"
    )
    candidate_upload_file: Optional[str] = Field(
        None,
        description="Upload file name (SMILES CSV or SDF) if not using artifact_id"
    )
    target_id: Optional[str] = Field(
        None,
        description="Target context (EGFR, PARP1, PIK3CA) for risk profiling; optional"
    )
    filter_profile: FilterStrictness = Field(
        default=FilterStrictness.STANDARD,
        description="Drug-likeness filter strictness"
    )
    run_admet: bool = Field(
        default=True,
        description="Include ADMET prediction in filter"
    )
    max_molecules: Optional[int] = Field(
        default=None,
        description="Process max N molecules; None = all"
    )
    output_format: Literal["csv", "sdf"] = Field(
        default="csv",
        description="Output molecule format"
    )
    dry_run: bool = Field(
        default=False,
        description="Dry-run mode: estimate only, don't save results"
    )

    @field_validator('max_molecules')
    @classmethod
    def validate_max_molecules(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("max_molecules must be positive")
        return v


# ============================================================================
# Q-Orbital Analyzer Payload
# ============================================================================


class QOrbitalAnalyzerPayload(BaseModel):
    """Q-Orbital Analyzer: Quantum descriptor extraction.

    Accept molecular structures, compute HOMO/LUMO/gap and other
    orbital descriptors using xTB with RDKit EHT fallback.
    """
    candidate_artifact_id: Optional[str] = Field(
        None,
        description="Artifact ID from filter/selection, or null to use upload"
    )
    candidate_upload_file: Optional[str] = Field(
        None,
        description="Upload file name (SMILES CSV or SDF) if not using artifact_id"
    )
    selected_candidate_ids: Optional[list[str]] = Field(
        default=None,
        description="Run only these candidates; None = all"
    )
    method: QMMethod = Field(
        default=QMMethod.AUTO,
        description="QM method: xTB, RDKit EHT fallback, or auto-select"
    )
    max_molecules: Optional[int] = Field(
        default=None,
        description="Process max N molecules; None = all"
    )
    conformer_count: int = Field(
        default=1,
        description="Number of 3D conformers to generate per molecule"
    )
    dry_run: bool = Field(
        default=False,
        description="Dry-run mode: estimate only, don't compute"
    )

    @field_validator('max_molecules', 'conformer_count')
    @classmethod
    def validate_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("Value must be positive")
        return v


# ============================================================================
# Q-Dock Studio Payload
# ============================================================================


class QDockStudioPayload(BaseModel):
    """Q-Dock Studio: Molecular docking and scoring.

    Accept receptor, ligands, pocket, and engine settings.
    Output docking poses, scores, and validation metrics.
    """
    receptor_artifact_id: Optional[str] = Field(
        None,
        description="Receptor artifact ID or null to use upload"
    )
    receptor_upload_file: Optional[str] = Field(
        None,
        description="Upload file name (PDB/PDBQT/mmCIF) if not using artifact_id"
    )
    ligand_artifact_id: Optional[str] = Field(
        None,
        description="Ligand artifact ID or null to use upload"
    )
    ligand_upload_file: Optional[str] = Field(
        None,
        description="Upload file name (SDF/SMILES CSV) if not using artifact_id"
    )
    pocket_source: PocketSource = Field(
        default=PocketSource.UPLOADED_BOX,
        description="Where pocket definition comes from"
    )
    pocket_box: Optional[PocketBox] = Field(
        None,
        description="Pocket box definition if source=uploaded_box"
    )
    reference_ligand_file: Optional[str] = Field(
        None,
        description="Reference ligand PDB file if source=reference_ligand"
    )
    engine: DockingEngine = Field(
        default=DockingEngine.VINA_SMINA,
        description="Docking engine: Vina, Smina, GNINA, or combined"
    )
    exhaustiveness: int = Field(
        default=8,
        description="Vina exhaustiveness (1-32); higher=more thorough"
    )
    max_ligands: Optional[int] = Field(
        default=None,
        description="Dock max N ligands; None = all"
    )
    run_redocking_validation: bool = Field(
        default=False,
        description="Include reference ligand redocking validation"
    )
    dry_run: bool = Field(
        default=False,
        description="Dry-run mode: estimate only, don't dock"
    )

    @field_validator('exhaustiveness')
    @classmethod
    def validate_exhaustiveness(cls, v: int) -> int:
        if v < 1 or v > 32:
            raise ValueError("exhaustiveness must be 1-32")
        return v

    @field_validator('max_ligands')
    @classmethod
    def validate_max_ligands(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("max_ligands must be positive")
        return v

    @model_validator(mode='after')
    def validate_pocket_box_required(self) -> 'QDockStudioPayload':
        if self.pocket_source == PocketSource.UPLOADED_BOX and self.pocket_box is None:
            raise ValueError("pocket_box required when pocket_source=uploaded_box")
        return self


# ============================================================================
# Activity Model Studio Payload
# ============================================================================


class ActivityModelStudioPayload(BaseModel):
    """Activity Model Studio: Batch prediction or model training.

    Accept molecules and optional assay data.
    Output predictions with confidence intervals.
    """
    candidate_artifact_id: Optional[str] = Field(
        None,
        description="Molecules to predict"
    )
    candidate_upload_file: Optional[str] = Field(
        None,
        description="Upload file name if not using artifact_id"
    )
    target_id: Optional[str] = Field(
        None,
        description="Specific target for prediction; None = use default model"
    )
    model_id: Optional[str] = Field(
        default="best_available",
        description="Which activity model to use for prediction"
    )
    assay_csv_artifact_id: Optional[str] = Field(
        None,
        description="Assay IC50 data if training custom model"
    )
    mode: Literal["predict", "train"] = Field(
        default="predict",
        description="Predict with existing model or train new model"
    )
    max_molecules: Optional[int] = Field(
        default=None,
        description="Process max N molecules"
    )
    confidence_threshold: float = Field(
        default=0.5,
        description="Report predictions with confidence >= threshold"
    )
    dry_run: bool = Field(
        default=False,
        description="Dry-run mode"
    )

    @field_validator('confidence_threshold')
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        if v < 0 or v > 1:
            raise ValueError("confidence_threshold must be 0-1")
        return v


# ============================================================================
# Q-Rank Payload
# ============================================================================


class QRankPayload(BaseModel):
    """Q-Rank: Candidate ranking and prioritization.

    Accept docking results, activity predictions, and molecular properties.
    Output ranked candidates with reasons.
    """
    candidate_artifact_id: Optional[str] = Field(
        None,
        description="Candidate set with properties/scores"
    )
    candidate_upload_file: Optional[str] = Field(
        None,
        description="Upload file name if not using artifact_id"
    )
    docking_results_artifact_id: Optional[str] = Field(
        None,
        description="Docking scores if available"
    )
    docking_results_upload_file: Optional[str] = Field(
        None,
        description="Upload file name for docking scores"
    )
    activity_predictions_artifact_id: Optional[str] = Field(
        None,
        description="Activity predictions if available"
    )
    activity_predictions_upload_file: Optional[str] = Field(
        None,
        description="Upload file name for activity predictions"
    )
    ranking_method: Literal["ensemble", "docking_first", "activity_first", "properties_first"] = Field(
        default="ensemble",
        description="How to weight different scores"
    )
    max_candidates: Optional[int] = Field(
        default=100,
        description="Return top N ranked candidates"
    )
    confidence_cutoff: float = Field(
        default=0.0,
        description="Minimum confidence to include"
    )
    dry_run: bool = Field(
        default=False,
        description="Dry-run mode"
    )


# ============================================================================
# Wet-Lab Triage Board Payload
# ============================================================================


class WetLabTriagePayload(BaseModel):
    """Wet-Lab Triage Board: Decision support for wet-lab testing.

    Accept ranked candidates and evidence artifacts.
    Output triage board with reasons to test/not test.
    """
    candidate_artifact_id: Optional[str] = Field(
        None,
        description="Ranked candidates"
    )
    candidate_upload_file: Optional[str] = Field(
        None,
        description="Upload file name if not using artifact_id"
    )
    docking_artifact_id: Optional[str] = Field(
        None,
        description="3D docking evidence"
    )
    orbital_artifact_id: Optional[str] = Field(
        None,
        description="QM/orbital evidence"
    )
    activity_artifact_id: Optional[str] = Field(
        None,
        description="Activity prediction evidence"
    )
    include_failed_rows: bool = Field(
        default=False,
        description="Include rows with failed computations"
    )
    triage_policy: Literal["conservative", "standard", "exploratory"] = Field(
        default="standard",
        description="Decision thresholds"
    )
    max_to_triage: Optional[int] = Field(
        default=None,
        description="Triage max N candidates"
    )
    dry_run: bool = Field(
        default=False,
        description="Dry-run mode"
    )


# ============================================================================
# Q-Report Payload
# ============================================================================


class QReportPayload(BaseModel):
    """Q-Report: Generate reports and export packages.

    Accept selected candidates and optional evidence artifacts.
    Output HTML/PDF report, candidate dossiers, and assay pack.
    """
    candidate_ids: list[str] = Field(
        ...,
        description="Selected candidates to report"
    )
    report_template: Literal["standard", "investor", "wet_lab_brief", "comprehensive"] = Field(
        default="standard",
        description="Report style"
    )
    include_evidence: list[str] = Field(
        default_factory=list,
        description="Evidence types to include: docking, orbital, activity, etc."
    )
    include_limitations: bool = Field(
        default=True,
        description="Include computational limitations and claim boundaries"
    )
    include_wet_lab_triage: bool = Field(
        default=True,
        description="Include wet-lab triage decisions"
    )
    export_formats: list[Literal["html", "pdf", "markdown", "csv"]] = Field(
        default_factory=lambda: ["html", "csv"],
        description="Export file formats"
    )
    dry_run: bool = Field(
        default=False,
        description="Dry-run mode"
    )

    @field_validator('candidate_ids')
    @classmethod
    def validate_candidates(cls, v: list[str]) -> list[str]:
        if len(v) == 0:
            raise ValueError("At least one candidate must be selected")
        return v


# ============================================================================
# Applicability Domain Guard Payload
# ============================================================================


class ApplicabilityDomainPayload(BaseModel):
    """Applicability Domain Guard: Check if molecules are in training domain.

    Accept candidate set and reference training set.
    Output domain membership and distance metrics.
    """
    candidate_artifact_id: Optional[str] = Field(
        None,
        description="Candidates to evaluate"
    )
    candidate_upload_file: Optional[str] = Field(
        None,
        description="Upload file name if not using artifact_id"
    )
    training_set_artifact_id: Optional[str] = Field(
        None,
        description="Reference training set; None = use default"
    )
    training_set_upload_file: Optional[str] = Field(
        None,
        description="Upload file name for training set"
    )
    descriptor_method: Literal["rdkit", "ecfp", "atom_pair"] = Field(
        default="rdkit",
        description="Molecular descriptor method"
    )
    threshold_percentile: float = Field(
        default=95.0,
        description="Percentile for domain boundary"
    )
    max_molecules: Optional[int] = Field(
        default=None,
        description="Evaluate max N molecules"
    )
    dry_run: bool = Field(
        default=False,
        description="Dry-run mode"
    )

    @field_validator('threshold_percentile')
    @classmethod
    def validate_percentile(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("threshold_percentile must be 0-100")
        return v


# ============================================================================
# Module Payload Registry
# ============================================================================


MODULE_PAYLOAD_MODELS = {
    "onco_data_builder": OncoDataBuilderPayload,
    "q_filter": QFilterPayload,
    "q_orbital_analyzer": QOrbitalAnalyzerPayload,
    "q_dock_studio": QDockStudioPayload,
    "activity_model_studio": ActivityModelStudioPayload,
    "q_rank": QRankPayload,
    "wet_lab_triage_board": WetLabTriagePayload,
    "q_report": QReportPayload,
    "applicability_domain_guard": ApplicabilityDomainPayload,
}


def get_payload_model(module_id: str) -> type | None:
    """Get the Pydantic payload model for a module."""
    return MODULE_PAYLOAD_MODELS.get(module_id)


def validate_payload(module_id: str, payload_dict: dict[str, Any]) -> dict[str, Any]:
    """Validate and parse module payload.

    Args:
        module_id: Module identifier
        payload_dict: Raw payload dictionary from API

    Returns:
        Validated payload dictionary

    Raises:
        ValueError: If payload is invalid
    """
    model_class = get_payload_model(module_id)
    if not model_class:
        raise ValueError(f"No payload model registered for module: {module_id}")

    try:
        validated = model_class.model_validate(payload_dict)
        return validated.model_dump()
    except Exception as e:
        raise ValueError(f"Invalid payload for {module_id}: {str(e)}")
