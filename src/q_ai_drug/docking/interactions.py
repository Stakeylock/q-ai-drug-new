"""Conservative receptor-ligand interaction fingerprints.

This module intentionally implements a lightweight geometric proxy, not a full
PLIP/ProLIF-style biochemical interaction classifier. It is useful for auditable
standalone module evidence while keeping claim boundaries conservative.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import dist
from pathlib import Path

try:  # pragma: no cover - optional dependency guard
    from rdkit import Chem
except Exception:  # pragma: no cover
    Chem = None


@dataclass
class AtomRecord:
    atom_name: str
    residue_name: str
    chain_id: str
    residue_id: str
    element: str
    xyz: tuple[float, float, float]


@dataclass
class InteractionFingerprint:
    candidate_id: str
    pose_file: str | None
    contact_residues: str
    contact_count: int
    hbond_like_contacts: int | None
    hydrophobic_contacts: int | None
    salt_bridge_like_contacts: int | None
    interaction_quality: str
    failure_reason: str | None = None
    claim_boundary: str = "Geometric proxy only; not a validated biochemical interaction fingerprint."
    interaction_backend: str = "geometric_proxy"
    interaction_status: str = "completed"
    interaction_classes: str = ""
    residue_interaction_count: int = 0
    prolif_failure_reason: str | None = None

    def to_row(self) -> dict:
        return {
            "candidate_id": self.candidate_id,
            "pose_file": self.pose_file,
            "interaction_backend": self.interaction_backend,
            "interaction_status": self.interaction_status,
            "contact_residues": self.contact_residues,
            "contact_count": self.contact_count,
            "hbond_like_contacts": self.hbond_like_contacts,
            "hydrophobic_contacts": self.hydrophobic_contacts,
            "salt_bridge_like_contacts": self.salt_bridge_like_contacts,
            "interaction_classes": self.interaction_classes,
            "residue_interaction_count": self.residue_interaction_count,
            "interaction_quality": self.interaction_quality,
            "failure_reason": self.failure_reason,
            "prolif_failure_reason": self.prolif_failure_reason,
            "claim_boundary": self.claim_boundary,
        }


def _parse_pdb_atoms(path: Path) -> list[AtomRecord]:
    atoms: list[AtomRecord] = []
    if not path.exists():
        return atoms
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not (line.startswith("ATOM") or line.startswith("HETATM")):
            continue
        try:
            atom_name = line[12:16].strip()
            residue_name = line[17:20].strip()
            chain_id = line[21:22].strip() or "_"
            residue_id = line[22:26].strip()
            x = float(line[30:38])
            y = float(line[38:46])
            z = float(line[46:54])
            element = (line[76:78].strip() or atom_name[0]).upper()
            if element == "H":
                continue
            atoms.append(AtomRecord(atom_name, residue_name, chain_id, residue_id, element, (x, y, z)))
        except Exception:
            continue
    return atoms


def _ligand_atoms_from_sdf(path: Path) -> list[tuple[str, tuple[float, float, float]]]:
    if Chem is None or not path.exists():
        return []
    supplier = Chem.SDMolSupplier(str(path), removeHs=False)
    mol = next((m for m in supplier if m is not None), None)
    if mol is None or mol.GetNumConformers() == 0:
        return []
    conf = mol.GetConformer()
    atoms: list[tuple[str, tuple[float, float, float]]] = []
    for atom in mol.GetAtoms():
        element = atom.GetSymbol().upper()
        if element == "H":
            continue
        pos = conf.GetAtomPosition(atom.GetIdx())
        atoms.append((element, (float(pos.x), float(pos.y), float(pos.z))))
    return atoms


def _is_hbond_like(e1: str, e2: str) -> bool:
    polar = {"N", "O", "S"}
    return e1 in polar and e2 in polar


def _is_hydrophobic_like(e1: str, e2: str) -> bool:
    hydrophobic = {"C", "S", "CL", "BR", "F", "I"}
    return e1 in hydrophobic and e2 in hydrophobic


def _is_salt_bridge_like(lig_el: str, rec_el: str, ligand_xyz: tuple[float, float, float], receptor_atom: AtomRecord) -> bool:
    # Conservative geometric proxy: N/O pairs near common charged residue names.
    charged_residues = {"ASP", "GLU", "LYS", "ARG", "HIS"}
    if receptor_atom.residue_name.upper() not in charged_residues:
        return False
    return {lig_el, rec_el}.issubset({"N", "O"})


def compute_interaction_fingerprint(
    receptor_pdb: Path,
    ligand_sdf: Path,
    candidate_id: str,
    distance_cutoff: float = 4.5,
    prefer_prolif: bool = True,
) -> InteractionFingerprint:
    """Compute a conservative geometric interaction fingerprint.

    Any heavy-atom receptor residue within distance_cutoff is treated as a contact.
    Contact classes are rough geometric proxies and must not be overinterpreted.
    """
    prolif_status = None
    prolif_failure = None
    if prefer_prolif:
        try:
            from q_ai_drug.docking.prolif_adapter import compute_prolif_summary

            prolif = compute_prolif_summary(receptor_pdb, ligand_sdf, candidate_id)
            prolif_status = str(prolif.get("interaction_status") or "")
            prolif_failure = prolif.get("failure_reason")
            if prolif.get("interaction_backend") == "prolif":
                return InteractionFingerprint(
                    candidate_id=candidate_id,
                    pose_file=str(ligand_sdf),
                    contact_residues=str(prolif.get("contact_residues") or ""),
                    contact_count=int(prolif.get("contact_count") or 0),
                    hbond_like_contacts=int(prolif.get("hbond_like_contacts") or 0),
                    hydrophobic_contacts=int(prolif.get("hydrophobic_contacts") or 0),
                    salt_bridge_like_contacts=int(prolif.get("salt_bridge_like_contacts") or 0),
                    interaction_quality=str(prolif.get("interaction_quality") or "prolif_fingerprint"),
                    failure_reason=None,
                    claim_boundary=str(prolif.get("claim_boundary") or "ProLIF interaction fingerprints are computational pose annotations; not experimental binding evidence."),
                    interaction_backend="prolif",
                    interaction_status="completed",
                    interaction_classes=str(prolif.get("interaction_classes") or ""),
                    residue_interaction_count=int(prolif.get("residue_interaction_count") or 0),
                )
        except Exception as exc:
            prolif_status = "prolif_failed"
            prolif_failure = f"ProLIF adapter failed: {exc}"

    receptor_atoms = _parse_pdb_atoms(receptor_pdb)
    ligand_atoms = _ligand_atoms_from_sdf(ligand_sdf)
    if not receptor_atoms:
        return InteractionFingerprint(
            candidate_id, str(ligand_sdf) if ligand_sdf else None, "", 0, None, None, None, "failed",
            "no receptor atoms parsed",
            interaction_backend="geometric_fallback",
            interaction_status=prolif_status or "failed",
            prolif_failure_reason=str(prolif_failure) if prolif_failure else None,
        )
    if not ligand_atoms:
        return InteractionFingerprint(
            candidate_id, str(ligand_sdf) if ligand_sdf else None, "", 0, None, None, None, "failed",
            "no ligand atoms parsed",
            interaction_backend="geometric_fallback",
            interaction_status=prolif_status or "failed",
            prolif_failure_reason=str(prolif_failure) if prolif_failure else None,
        )

    residues: set[str] = set()
    hbond = 0
    hydrophobic = 0
    salt = 0
    for lig_el, lig_xyz in ligand_atoms:
        for rec in receptor_atoms:
            d = dist(lig_xyz, rec.xyz)
            if d <= distance_cutoff:
                residues.add(f"{rec.residue_name}:{rec.chain_id}:{rec.residue_id}")
                if d <= 3.5 and _is_hbond_like(lig_el, rec.element):
                    hbond += 1
                if _is_hydrophobic_like(lig_el, rec.element):
                    hydrophobic += 1
                if d <= 4.0 and _is_salt_bridge_like(lig_el, rec.element, lig_xyz, rec):
                    salt += 1

    contact_residues = ";".join(sorted(residues))
    return InteractionFingerprint(
        candidate_id=candidate_id,
        pose_file=str(ligand_sdf),
        contact_residues=contact_residues,
        contact_count=len(residues),
        hbond_like_contacts=hbond,
        hydrophobic_contacts=hydrophobic,
        salt_bridge_like_contacts=salt,
        interaction_quality="geometric_proxy",
        failure_reason=None,
        interaction_backend="geometric_fallback" if prolif_status else "geometric_proxy",
        interaction_status=prolif_status or "completed",
        prolif_failure_reason=str(prolif_failure) if prolif_failure else None,
    )
