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

    def to_row(self) -> dict:
        return {
            "candidate_id": self.candidate_id,
            "pose_file": self.pose_file,
            "contact_residues": self.contact_residues,
            "contact_count": self.contact_count,
            "hbond_like_contacts": self.hbond_like_contacts,
            "hydrophobic_contacts": self.hydrophobic_contacts,
            "salt_bridge_like_contacts": self.salt_bridge_like_contacts,
            "interaction_quality": self.interaction_quality,
            "failure_reason": self.failure_reason,
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
) -> InteractionFingerprint:
    """Compute a conservative geometric interaction fingerprint.

    Any heavy-atom receptor residue within distance_cutoff is treated as a contact.
    Contact classes are rough geometric proxies and must not be overinterpreted.
    """
    receptor_atoms = _parse_pdb_atoms(receptor_pdb)
    ligand_atoms = _ligand_atoms_from_sdf(ligand_sdf)
    if not receptor_atoms:
        return InteractionFingerprint(candidate_id, str(ligand_sdf) if ligand_sdf else None, "", 0, None, None, None, "failed", "no receptor atoms parsed")
    if not ligand_atoms:
        return InteractionFingerprint(candidate_id, str(ligand_sdf) if ligand_sdf else None, "", 0, None, None, None, "failed", "no ligand atoms parsed")

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
    )
