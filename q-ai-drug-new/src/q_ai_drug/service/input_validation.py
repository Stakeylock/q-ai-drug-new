from __future__ import annotations

import io
import re
from dataclasses import dataclass, asdict
from typing import Any

import pandas as pd

try:
    from rdkit import Chem
except Exception:
    Chem = None


PHI_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bpatient[_ -]?name\b",
        r"\bdate[_ -]?of[_ -]?birth\b",
        r"\bmrn\b",
        r"\bmedical[_ -]?record\b",
        r"\bssn\b",
    ]
]


@dataclass
class InputQualityCard:
    artifact_type: str
    filename: str
    status: str
    rows_total: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    duplicate_rows: int = 0
    warnings: list[str] | None = None
    errors: list[str] | None = None
    preview: list[dict[str, Any]] | None = None
    recommended_action: str = "Proceed with reviewed limitations."

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["warnings"] = payload["warnings"] or []
        payload["errors"] = payload["errors"] or []
        payload["preview"] = payload["preview"] or []
        return payload


def _rdkit_valid_smiles(smiles: str) -> bool:
    if not smiles:
        return False
    if Chem is None:
        return bool(re.match(r"^[A-Za-z0-9@+\-\[\]\(\)=#$\\/%.:]+$", smiles))
    return Chem.MolFromSmiles(smiles) is not None


def _detect_phi_like_columns(columns: list[str]) -> list[str]:
    flagged: list[str] = []
    for column in columns:
        if any(pattern.search(column) for pattern in PHI_PATTERNS):
            flagged.append(column)
    return flagged


def _csv_quality_card(data: bytes, filename: str, artifact_type: str) -> InputQualityCard:
    warnings: list[str] = []
    errors: list[str] = []
    try:
        frame = pd.read_csv(io.BytesIO(data))
    except Exception as exc:
        return InputQualityCard(
            artifact_type=artifact_type,
            filename=filename,
            status="failed",
            errors=[f"CSV parse failed: {exc}"],
            recommended_action="Fix CSV formatting and upload again.",
        )
    rows_total = int(len(frame))
    phi_columns = _detect_phi_like_columns([str(column) for column in frame.columns])
    if phi_columns:
        warnings.append(f"PHI-like columns detected and should be removed before upload: {', '.join(phi_columns[:5])}")
    smiles_column = next((column for column in frame.columns if str(column).lower() in {"smiles", "canonical_smiles"}), None)
    valid_rows = rows_total
    invalid_rows = 0
    duplicate_rows = int(frame.duplicated().sum())
    if smiles_column is not None:
        smiles = frame[smiles_column].fillna("").astype(str).str.strip()
        valid_mask = smiles.map(_rdkit_valid_smiles)
        valid_rows = int(valid_mask.sum())
        invalid_rows = int((~valid_mask).sum())
        duplicate_rows = int(smiles[smiles != ""].duplicated().sum())
        if invalid_rows:
            warnings.append(f"{invalid_rows} rows have invalid or empty SMILES.")
        if duplicate_rows:
            warnings.append(f"{duplicate_rows} duplicate molecule rows detected after SMILES normalization.")
    elif artifact_type in {"smiles_csv", "assay_csv", "user_upload"}:
        warnings.append("No SMILES/canonical_smiles column found; molecule ingestion will be skipped.")
    assay_columns = {str(column).lower() for column in frame.columns}
    if artifact_type == "assay_csv" or {"ic50", "ki", "kd", "ec50", "activity_value"}.intersection(assay_columns):
        if not {"unit", "activity_unit", "standard_units"}.intersection(assay_columns):
            warnings.append("Activity unit column is missing; values must be harmonized before model training.")
        if not {"target_id", "target", "gene"}.intersection(assay_columns):
            warnings.append("Target mapping column is missing; assay rows cannot be safely assigned to a target.")
    status = "failed" if rows_total == 0 or (smiles_column is not None and valid_rows == 0) else "warning" if warnings else "passed"
    action = "Fix invalid rows or continue with valid rows only." if warnings else "Proceed."
    return InputQualityCard(
        artifact_type=artifact_type,
        filename=filename,
        status=status,
        rows_total=rows_total,
        valid_rows=valid_rows,
        invalid_rows=invalid_rows,
        duplicate_rows=duplicate_rows,
        warnings=warnings,
        errors=errors,
        preview=frame.head(5).astype(object).where(pd.notna(frame.head(5)), None).to_dict("records"),
        recommended_action=action,
    )


def _sdf_quality_card(data: bytes, filename: str, artifact_type: str) -> InputQualityCard:
    text = data.decode("utf-8", errors="replace")
    records = [chunk for chunk in text.split("$$$$") if chunk.strip()]
    warnings: list[str] = []
    atom_block_count = sum(1 for record in records if re.search(r"\n\s*\d+\s+\d+\s+", record))
    if records and atom_block_count < len(records):
        warnings.append(f"{len(records) - atom_block_count} SDF records lack an obvious atom/bond block.")
    status = "failed" if not records else "warning" if warnings else "passed"
    return InputQualityCard(
        artifact_type=artifact_type,
        filename=filename,
        status=status,
        rows_total=len(records),
        valid_rows=atom_block_count,
        invalid_rows=max(len(records) - atom_block_count, 0),
        warnings=warnings,
        errors=[] if records else ["No SDF molecule records found."],
        recommended_action="Regenerate 3D conformers for invalid SDF records." if warnings else "Proceed.",
    )


def _pdb_quality_card(data: bytes, filename: str, artifact_type: str) -> InputQualityCard:
    text = data.decode("utf-8", errors="replace")
    atom_lines = [line for line in text.splitlines() if line.startswith(("ATOM", "HETATM"))]
    chains = {line[21].strip() for line in atom_lines if len(line) > 21 and line[21].strip()}
    hetero_count = sum(1 for line in atom_lines if line.startswith("HETATM"))
    warnings: list[str] = []
    if not chains:
        warnings.append("No chain identifiers detected; review receptor preparation.")
    if hetero_count == 0:
        warnings.append("No HETATM records detected; reference ligand/cofactor may be absent.")
    status = "failed" if not atom_lines else "warning" if warnings else "passed"
    return InputQualityCard(
        artifact_type=artifact_type,
        filename=filename,
        status=status,
        rows_total=len(atom_lines),
        valid_rows=len(atom_lines),
        invalid_rows=0,
        warnings=warnings,
        errors=[] if atom_lines else ["No ATOM/HETATM records found in receptor file."],
        preview=[{"atom_lines": len(atom_lines), "chains": sorted(chains), "hetero_atoms": hetero_count}],
        recommended_action="Review receptor structure, chain policy, and reference ligand/pocket setup." if warnings else "Proceed.",
    )


def _yaml_quality_card(data: bytes, filename: str, artifact_type: str) -> InputQualityCard:
    warnings: list[str] = []
    errors: list[str] = []
    try:
        import yaml

        payload = yaml.safe_load(data.decode("utf-8", errors="replace")) or {}
    except Exception as exc:
        return InputQualityCard(
            artifact_type=artifact_type,
            filename=filename,
            status="failed",
            errors=[f"YAML parse failed: {exc}"],
            recommended_action="Fix YAML syntax and upload again.",
        )
    if not isinstance(payload, dict):
        errors.append("YAML root must be an object.")
    if artifact_type == "target_config_yaml" and not any(key in payload for key in ["primary_targets", "target_id", "targets"]):
        warnings.append("Target YAML does not include primary_targets, target_id, or targets.")
    status = "failed" if errors else "warning" if warnings else "passed"
    return InputQualityCard(
        artifact_type=artifact_type,
        filename=filename,
        status=status,
        rows_total=1,
        valid_rows=0 if errors else 1,
        invalid_rows=1 if errors else 0,
        warnings=warnings,
        errors=errors,
        preview=[payload if isinstance(payload, dict) else {"root_type": type(payload).__name__}],
        recommended_action="Review schema before running project modules." if warnings else "Proceed.",
    )


def validate_upload_bytes(data: bytes, *, filename: str, artifact_type: str) -> dict[str, Any]:
    suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix in {".csv", ".smi"} or artifact_type in {"smiles_csv", "assay_csv", "smiles_file"}:
        return _csv_quality_card(data, filename, artifact_type).to_dict()
    if suffix == ".sdf" or artifact_type == "ligand_sdf":
        return _sdf_quality_card(data, filename, artifact_type).to_dict()
    if suffix in {".pdb", ".pdbqt"} or artifact_type in {"receptor_pdb", "receptor_structure", "pdbqt"}:
        return _pdb_quality_card(data, filename, artifact_type).to_dict()
    if suffix in {".yaml", ".yml"} or artifact_type == "target_config_yaml":
        return _yaml_quality_card(data, filename, artifact_type).to_dict()
    return InputQualityCard(
        artifact_type=artifact_type,
        filename=filename,
        status="warning",
        warnings=["No specialized validator for this artifact type; stored as a generic project artifact."],
        recommended_action="Confirm file type before launching scientific modules.",
    ).to_dict()

