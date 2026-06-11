"""Redocking validation helpers.

The helper computes pose-recovery RMSD for a reference ligand and a docked pose.
It returns structured statuses instead of raising so module runners can preserve
validation failures in artifacts.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

try:  # pragma: no cover - optional dependency import guard
    from rdkit import Chem
    from rdkit.Chem import rdMolAlign
except Exception:  # pragma: no cover
    Chem = None
    rdMolAlign = None


@dataclass
class RedockingValidation:
    status: str
    rmsd_angstrom: float | None
    validation_pass: bool | None
    reason: str | None
    rmsd_threshold_angstrom: float = 2.0

    def to_row(self, reference_ligand_file: Path | str | None, docked_pose_file: Path | str | None) -> dict:
        return {
            "reference_ligand_file": str(reference_ligand_file) if reference_ligand_file else None,
            "docked_pose_file": str(docked_pose_file) if docked_pose_file else None,
            "rmsd_angstrom": self.rmsd_angstrom,
            "validation_status": self.status,
            "validation_pass": self.validation_pass,
            "reason": self.reason,
            "rmsd_threshold_angstrom": self.rmsd_threshold_angstrom,
        }


def _load_first_mol(path: Path):
    if Chem is None:
        return None, "RDKit is not available"
    if path is None or not path.exists():
        return None, "file not found"
    if path.suffix.lower() == ".sdf":
        supplier = Chem.SDMolSupplier(str(path), removeHs=False)
        for mol in supplier:
            if mol is not None:
                return mol, None
        return None, "no valid molecule in SDF"
    mol = Chem.MolFromMolFile(str(path), removeHs=False)
    if mol is None:
        return None, "unsupported or unreadable molecule file"
    return mol, None


def compute_pose_rmsd(
    reference_sdf: Path,
    docked_sdf: Path,
    rmsd_threshold_angstrom: float = 2.0,
    remove_hydrogens: bool = True,
) -> RedockingValidation:
    """Compute best-alignment RMSD between reference and docked ligand poses.

    Returns validation_failed/not_run statuses for bad input instead of raising.
    """
    if Chem is None or rdMolAlign is None:
        return RedockingValidation("validation_not_run", None, None, "RDKit rdMolAlign is unavailable", rmsd_threshold_angstrom)
    ref, ref_reason = _load_first_mol(reference_sdf)
    docked, dock_reason = _load_first_mol(docked_sdf)
    if ref is None:
        return RedockingValidation("validation_not_run", None, None, f"reference ligand unreadable: {ref_reason}", rmsd_threshold_angstrom)
    if docked is None:
        return RedockingValidation("validation_failed", None, False, f"docked pose unreadable: {dock_reason}", rmsd_threshold_angstrom)
    try:
        if remove_hydrogens:
            ref = Chem.RemoveHs(ref)
            docked = Chem.RemoveHs(docked)
        if ref.GetNumAtoms() != docked.GetNumAtoms():
            return RedockingValidation(
                "validation_failed",
                None,
                False,
                f"atom count mismatch: reference={ref.GetNumAtoms()} docked={docked.GetNumAtoms()}",
                rmsd_threshold_angstrom,
            )
        if ref.GetNumConformers() == 0 or docked.GetNumConformers() == 0:
            return RedockingValidation("validation_failed", None, False, "missing conformer coordinates", rmsd_threshold_angstrom)
        rmsd = float(rdMolAlign.GetBestRMS(ref, docked))
        passed = rmsd <= rmsd_threshold_angstrom
        return RedockingValidation(
            "redocking_pass" if passed else "redocking_fail",
            round(rmsd, 4),
            passed,
            None,
            rmsd_threshold_angstrom,
        )
    except Exception as exc:
        return RedockingValidation("validation_failed", None, False, f"RMSD computation failed: {exc}", rmsd_threshold_angstrom)
