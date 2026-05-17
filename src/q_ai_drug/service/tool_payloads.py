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


class OncoDataBuilderPayload(BaseModel):
    """OncoData Builder: Dataset curation and provisioning."""
    target_ids: list[str] = Field(..., description="Target identifiers to curate (e.g., ['TP53', 'EGFR'])")
    data_sources: Literal["public_only", "public_plus_uploaded", "uploaded_only"] = Field(default="public_only")
    uploaded_assay_csv: Optional[str] = None
    uploaded_assay_csv_artifact_id: Optional[str] = None
    curation_profile: Literal["standard", "strict", "permissive"] = Field(default="standard")
    dry_run: bool = False

    @field_validator('target_ids')
    @classmethod
    def validate_targets(cls, v: list[str]) -> list[str]:
        if len(v) == 0:
            raise ValueError("At least one target must be specified")
        if len(v) > 20:
            raise ValueError("Maximum 20 targets per run")
        return v


class QFilterPayload(BaseModel):
    """Q-Filter: Drug-likeness and risk filtering."""
    candidate_library_artifact_id: Optional[str] = None
    candidate_artifact_id: Optional[str] = None
    candidate_upload_file: Optional[str] = None
    target_id: Optional[str] = None
    filter_profile: FilterStrictness = FilterStrictness.STANDARD
    run_admet: bool = True
    max_molecules: Optional[int] = None
    output_format: Literal["csv", "sdf"] = "csv"
    dry_run: bool = False

    @field_validator('max_molecules')
    @classmethod
    def validate_max_molecules(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("max_molecules must be positive")
        return v


class QOrbitalAnalyzerPayload(BaseModel):
    """Q-Orbital Analyzer: Quantum descriptor extraction."""
    candidate_artifact_id: Optional[str] = None
    candidate_upload_file: Optional[str] = None
    selected_candidate_ids: Optional[list[str]] = None
    method: QMMethod = QMMethod.AUTO
    allow_fallback: bool = Field(
        default=True,
        description="If false and method=xtb, rows fail instead of falling back to RDKit EHT when xTB is unavailable or fails."
    )
    max_molecules: Optional[int] = None
    conformer_count: int = 1
    dry_run: bool = False

    @field_validator('max_molecules', 'conformer_count')
    @classmethod
    def validate_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("Value must be positive")
        return v


class QDockStudioPayload(BaseModel):
    """Q-Dock Studio: Molecular docking and scoring."""
    receptor_artifact_id: Optional[str] = None
    receptor_upload_file: Optional[str] = None
    ligand_artifact_id: Optional[str] = None
    ligand_upload_file: Optional[str] = None
    pocket_source: PocketSource = PocketSource.UPLOADED_BOX
    pocket_box: Optional[PocketBox] = None
    reference_ligand_file: Optional[str] = None
    engine: DockingEngine = DockingEngine.VINA_SMINA
    exhaustiveness: int = 8
    max_ligands: Optional[int] = None
    run_redocking_validation: bool = False
    dry_run: bool = False

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


class ActivityModelStudioPayload(BaseModel):
    """Activity Model Studio: Batch prediction or model training."""
    candidate_artifact_id: Optional[str] = None
    candidate_upload_file: Optional[str] = None
    target_id: Optional[str] = None
    model_id: Optional[str] = "best_available"
    assay_csv_artifact_id: Optional[str] = None
    mode: Literal["predict", "train"] = "predict"
    max_molecules: Optional[int] = None
    confidence_threshold: float = 0.5
    dry_run: bool = False

    @field_validator('confidence_threshold')
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        if v < 0 or v > 1:
            raise ValueError("confidence_threshold must be 0-1")
        return v


class QRankPayload(BaseModel):
    """Q-Rank: Candidate ranking and prioritization."""
    candidate_artifact_id: Optional[str] = None
    candidate_upload_file: Optional[str] = None
    docking_results_artifact_id: Optional[str] = None
    docking_results_upload_file: Optional[str] = None
    activity_predictions_artifact_id: Optional[str] = None
    activity_predictions_upload_file: Optional[str] = None
    domain_artifact_id: Optional[str] = None
    domain_upload_file: Optional[str] = None
    orbital_artifact_id: Optional[str] = None
    orbital_upload_file: Optional[str] = None
    ranking_method: Literal["ensemble", "docking_first", "activity_first", "properties_first"] = "ensemble"
    max_candidates: Optional[int] = 100
    confidence_cutoff: float = 0.0
    dry_run: bool = False


class WetLabTriagePayload(BaseModel):
    """Wet-Lab Triage Board: Decision support for wet-lab testing."""
    candidate_artifact_id: Optional[str] = None
    candidate_upload_file: Optional[str] = None
    docking_artifact_id: Optional[str] = None
    orbital_artifact_id: Optional[str] = None
    activity_artifact_id: Optional[str] = None
    include_failed_rows: bool = False
    triage_policy: Literal["conservative", "standard", "exploratory"] = "standard"
    max_to_triage: Optional[int] = None
    dry_run: bool = False


class QReportPayload(BaseModel):
    """Q-Report: Generate evidence-aware candidate reports and export packages."""
    candidate_ids: list[str] = Field(..., description="Selected candidates to report")
    ranked_candidates_artifact_id: Optional[str] = None
    ranked_candidates_upload_file: Optional[str] = None
    triage_artifact_id: Optional[str] = None
    triage_upload_file: Optional[str] = None
    evidence_status_artifact_id: Optional[str] = None
    evidence_status_upload_file: Optional[str] = None
    rank_ablation_artifact_id: Optional[str] = None
    rank_ablation_upload_file: Optional[str] = None
    report_template: Literal["standard", "investor", "wet_lab_brief", "comprehensive"] = "standard"
    include_evidence: list[str] = Field(default_factory=list)
    include_limitations: bool = True
    include_wet_lab_triage: bool = True
    export_formats: list[Literal["html", "pdf", "markdown", "csv"]] = Field(default_factory=lambda: ["html", "csv"])
    dry_run: bool = False


class ApplicabilityDomainPayload(BaseModel):
    """Applicability Domain Guard."""
    candidate_artifact_id: Optional[str] = None
    candidate_upload_file: Optional[str] = None
    training_set_artifact_id: Optional[str] = None
    training_set_upload_file: Optional[str] = None
    reference_inhibitors_artifact_id: Optional[str] = None
    descriptor_method: Literal["rdkit", "ecfp", "morgan"] = "rdkit"
    threshold_percentile: float = 95.0
    max_molecules: Optional[int] = None
    dry_run: bool = False


class PayloadValidationError(Exception):
    """Raised when a module payload fails validation."""


MODULE_PAYLOAD_MODELS: dict[str, type[BaseModel]] = {
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


def validate_payload(module_id: str, payload: dict[str, Any] | None) -> dict[str, Any]:
    """Validate payload for a module. Returns validated dict or raises PayloadValidationError."""
    if payload is None:
        payload = {}
    model_class = MODULE_PAYLOAD_MODELS.get(module_id)
    if model_class is None:
        return payload
    try:
        validated = model_class.model_validate(payload)
        return validated.model_dump()
    except Exception as e:
        raise PayloadValidationError(f"Invalid payload for {module_id}: {e}") from e
