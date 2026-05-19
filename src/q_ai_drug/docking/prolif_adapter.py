from __future__ import annotations

import importlib.util
import re
import warnings
from pathlib import Path
from typing import Any


PROLIF_CLAIM_BOUNDARY = (
    "ProLIF interaction fingerprints are computational pose annotations; "
    "they are not experimental binding evidence or biochemical validation."
)


def prolif_available() -> bool:
    return importlib.util.find_spec("prolif") is not None


def _empty_summary(
    *,
    candidate_id: str,
    receptor_path: Path,
    pose_sdf_path: Path,
    backend: str,
    status: str,
    failure_reason: str | None,
) -> dict[str, Any]:
    return {
        "candidate_id": candidate_id,
        "interaction_backend": backend,
        "interaction_status": status,
        "receptor_path": str(receptor_path),
        "pose_sdf_path": str(pose_sdf_path),
        "contact_residues": "",
        "contact_count": 0,
        "contact_residue_count": 0,
        "hbond_like_contacts": 0,
        "hydrophobic_contacts": 0,
        "salt_bridge_like_contacts": 0,
        "halogen_contacts": 0,
        "interaction_classes": "",
        "interaction_class_count": 0,
        "residue_interaction_count": 0,
        "interaction_quality": "missing_pose_or_receptor" if failure_reason else "no_detected_contacts",
        "failure_reason": failure_reason,
        "claim_boundary": PROLIF_CLAIM_BOUNDARY if backend == "prolif" else "Geometric fallback required; ProLIF evidence was not available.",
    }


def _residue_label(parts: tuple[Any, ...]) -> str:
    text_parts = [str(part) for part in parts]
    for item in reversed(text_parts[:-1]):
        if re.search(r"\d", item):
            return item.replace(" ", "")
    return text_parts[-2].replace(" ", "") if len(text_parts) >= 2 else ""


def _interaction_label(parts: tuple[Any, ...]) -> str:
    return str(parts[-1]).replace(" ", "") if parts else "unknown"


def _is_truthy(value: Any) -> bool:
    try:
        if hasattr(value, "any"):
            return bool(value.any())
        return bool(value)
    except Exception:
        return False


def _summarize_prolif_dataframe(frame: Any, *, candidate_id: str, receptor_path: Path, pose_sdf_path: Path) -> dict[str, Any]:
    if frame is None or getattr(frame, "empty", True):
        return _empty_summary(
            candidate_id=candidate_id,
            receptor_path=receptor_path,
            pose_sdf_path=pose_sdf_path,
            backend="prolif",
            status="completed",
            failure_reason=None,
        )

    first_row = frame.iloc[0]
    residues: set[str] = set()
    classes: set[str] = set()
    hbond = hydrophobic = salt = halogen = 0
    residue_interactions = 0
    for column in frame.columns:
        value = first_row[column]
        if not _is_truthy(value):
            continue
        parts = column if isinstance(column, tuple) else (column,)
        residue = _residue_label(parts)
        label = _interaction_label(parts)
        if residue:
            residues.add(residue)
        classes.add(label)
        residue_interactions += 1
        lowered = label.lower()
        if "hbond" in lowered or "acceptor" in lowered or "donor" in lowered:
            hbond += 1
        if "hydrophobic" in lowered:
            hydrophobic += 1
        if "ionic" in lowered or "cation" in lowered or "anion" in lowered or "salt" in lowered:
            salt += 1
        if "halogen" in lowered or "xbond" in lowered:
            halogen += 1

    quality = "prolif_fingerprint" if residue_interactions else "prolif_no_detected_contacts"
    return {
        "candidate_id": candidate_id,
        "interaction_backend": "prolif",
        "interaction_status": "completed",
        "receptor_path": str(receptor_path),
        "pose_sdf_path": str(pose_sdf_path),
        "contact_residues": ";".join(sorted(residues)),
        "contact_count": len(residues),
        "contact_residue_count": len(residues),
        "hbond_like_contacts": hbond,
        "hydrophobic_contacts": hydrophobic,
        "salt_bridge_like_contacts": salt,
        "halogen_contacts": halogen,
        "interaction_classes": ";".join(sorted(classes)),
        "interaction_class_count": len(classes),
        "residue_interaction_count": residue_interactions,
        "interaction_quality": quality,
        "failure_reason": None,
        "claim_boundary": PROLIF_CLAIM_BOUNDARY,
    }


def compute_prolif_summary(
    receptor_pdb: str | Path,
    ligand_sdf: str | Path,
    candidate_id: str,
) -> dict[str, Any]:
    receptor_path = Path(receptor_pdb)
    pose_sdf_path = Path(ligand_sdf)
    if not receptor_path.exists() or not pose_sdf_path.exists():
        return _empty_summary(
            candidate_id=candidate_id,
            receptor_path=receptor_path,
            pose_sdf_path=pose_sdf_path,
            backend="geometric_fallback",
            status="missing_input",
            failure_reason="receptor or ligand pose file is missing",
        )
    if not prolif_available():
        return _empty_summary(
            candidate_id=candidate_id,
            receptor_path=receptor_path,
            pose_sdf_path=pose_sdf_path,
            backend="geometric_fallback",
            status="prolif_unavailable",
            failure_reason="ProLIF is not installed",
        )
    try:
        import prolif as plf
        from rdkit import Chem

        protein = Chem.MolFromPDBFile(str(receptor_path), removeHs=False, sanitize=False)
        supplier = Chem.SDMolSupplier(str(pose_sdf_path), removeHs=False, sanitize=False)
        ligand = next((mol for mol in supplier if mol is not None and mol.GetNumConformers() > 0), None)
        if protein is None or ligand is None:
            return _empty_summary(
                candidate_id=candidate_id,
                receptor_path=receptor_path,
                pose_sdf_path=pose_sdf_path,
                backend="geometric_fallback",
                status="prolif_failed",
                failure_reason="ProLIF input conversion failed",
            )
        protein_mol = plf.Molecule.from_rdkit(protein)
        ligand_mol = plf.Molecule.from_rdkit(ligand)
        fingerprint = plf.Fingerprint()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fingerprint.run_from_iterable([ligand_mol], protein_mol, progress=False, n_jobs=1)
        return _summarize_prolif_dataframe(
            fingerprint.to_dataframe(),
            candidate_id=candidate_id,
            receptor_path=receptor_path,
            pose_sdf_path=pose_sdf_path,
        )
    except Exception as exc:
        return _empty_summary(
            candidate_id=candidate_id,
            receptor_path=receptor_path,
            pose_sdf_path=pose_sdf_path,
            backend="geometric_fallback",
            status="prolif_failed",
            failure_reason=f"ProLIF failed: {str(exc)[:200]}",
        )
