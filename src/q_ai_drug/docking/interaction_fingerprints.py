from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    from rdkit import Chem, RDLogger
    RDLogger.DisableLog("rdApp.warning")
    RDLogger.DisableLog("rdApp.error")
except Exception:
    Chem = None


KEY_RESIDUES = {
    "EGFR": {
        "LEU718",
        "VAL726",
        "ALA743",
        "LYS745",
        "THR790",
        "MET793",
        "ASP855",
        "PHE856",
        # Legacy kinase-domain numbering used by common EGFR PDB files such as 1M17.
        "LEU694",
        "VAL702",
        "ALA719",
        "LYS721",
        "THR766",
        "MET769",
        "ASP831",
        "PHE832",
    },
    "PARP1": {"GLY863", "HIS862", "TYR896", "TYR907", "SER904", "GLY888"},
    "PIK3CA": {"LYS802", "SER774", "VAL851", "MET922", "ILE932", "ASP933"},
}


@dataclass(frozen=True)
class ProteinAtom:
    residue: str
    residue_name: str
    residue_number: str
    atom_name: str
    element: str
    coord: np.ndarray


def _element_from_atom_name(atom_name: str) -> str:
    text = atom_name.strip().upper()
    if not text:
        return "C"
    if text.startswith("CL"):
        return "CL"
    if text.startswith("BR"):
        return "BR"
    return text[0]


def _parse_pdb_atoms(path: Path) -> list[ProteinAtom]:
    atoms: list[ProteinAtom] = []
    if not path.exists():
        return atoms
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not (line.startswith("ATOM") or line.startswith("HETATM")):
            continue
        try:
            x = float(line[30:38])
            y = float(line[38:46])
            z = float(line[46:54])
        except Exception:
            continue
        atom_name = line[12:16].strip()
        residue_name = line[17:20].strip().upper()
        residue_number = line[22:26].strip()
        element = line[76:78].strip().upper() if len(line) >= 78 else ""
        if not element:
            element = _element_from_atom_name(atom_name)
        atoms.append(
            ProteinAtom(
                residue=f"{residue_name}{residue_number}",
                residue_name=residue_name,
                residue_number=residue_number,
                atom_name=atom_name,
                element=element,
                coord=np.asarray([x, y, z], dtype=float),
            )
        )
    return atoms


def _ligand_atoms_from_sdf(path: Path) -> list[dict[str, Any]]:
    atoms: list[dict[str, Any]] = []
    if not path.exists() or path.stat().st_size == 0:
        return atoms
    if Chem is not None:
        try:
            supplier = Chem.SDMolSupplier(str(path), removeHs=False, sanitize=False)
            mol = supplier[0] if supplier and len(supplier) else None
            if mol is not None and mol.GetNumConformers():
                conf = mol.GetConformer()
                for atom in mol.GetAtoms():
                    if atom.GetAtomicNum() <= 1:
                        continue
                    pos = conf.GetAtomPosition(atom.GetIdx())
                    symbol = atom.GetSymbol().upper()
                    try:
                        formal_charge = atom.GetFormalCharge()
                        total_h = atom.GetTotalNumHs()
                    except Exception:
                        formal_charge = 0
                        total_h = 0
                    atoms.append(
                        {
                            "index": atom.GetIdx(),
                            "symbol": symbol,
                            "coord": np.asarray([pos.x, pos.y, pos.z], dtype=float),
                            "is_donor": symbol in {"N", "O", "S"} and total_h > 0,
                            "is_acceptor": symbol in {"N", "O", "S"},
                            "formal_charge": formal_charge,
                            "is_hydrophobic": symbol in {"C", "CL", "BR", "F", "I"},
                            "is_halogen": symbol in {"CL", "BR", "I"},
                        }
                    )
                if atoms:
                    return atoms
        except Exception:
            atoms = []
    return _ligand_atoms_from_sdf_text(path)


def _ligand_atoms_from_sdf_text(path: Path) -> list[dict[str, Any]]:
    atoms: list[dict[str, Any]] = []
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    if len(lines) < 4:
        return atoms
    try:
        atom_count = int(lines[3][:3])
    except Exception:
        parts = lines[3].split()
        atom_count = int(parts[0]) if parts else 0
    for index, line in enumerate(lines[4 : 4 + atom_count]):
        parts = line.split()
        if len(parts) < 4:
            continue
        try:
            coord = np.asarray([float(parts[0]), float(parts[1]), float(parts[2])], dtype=float)
        except Exception:
            continue
        symbol = parts[3].upper()
        if symbol == "H":
            continue
        atoms.append(
            {
                "index": index,
                "symbol": symbol,
                "coord": coord,
                "is_donor": symbol in {"N", "O", "S"},
                "is_acceptor": symbol in {"N", "O", "S"},
                "formal_charge": 0,
                "is_hydrophobic": symbol in {"C", "CL", "BR", "F", "I"},
                "is_halogen": symbol in {"CL", "BR", "I"},
            }
        )
    return atoms


def _classify_contacts(protein_atoms: list[ProteinAtom], ligand_atoms: list[dict[str, Any]], target_id: str) -> dict[str, Any]:
    if not protein_atoms or not ligand_atoms:
        return {
            "contact_residue_count": 0,
            "contact_residues": "",
            "hbond_like_contacts": 0,
            "salt_bridge_like_contacts": 0,
            "hydrophobic_contacts": 0,
            "halogen_contacts": 0,
            "key_residue_contact_count": 0,
            "key_residue_contacts": "",
            "interaction_quality": "missing_pose_or_receptor",
        }

    contact_residues: set[str] = set()
    hbond_like = 0
    salt_like = 0
    hydrophobic = 0
    halogen = 0
    for patom in protein_atoms:
        pelem = patom.element.upper()
        p_is_polar = pelem in {"N", "O", "S"}
        p_is_charged = patom.residue_name in {"ASP", "GLU", "LYS", "ARG", "HIS"}
        p_is_hydrophobic = patom.residue_name in {"ALA", "VAL", "LEU", "ILE", "MET", "PHE", "TRP", "TYR", "PRO"} or pelem == "C"
        for latom in ligand_atoms:
            distance = float(np.linalg.norm(patom.coord - latom["coord"]))
            if distance > 4.0:
                continue
            contact_residues.add(patom.residue)
            if distance <= 3.5 and p_is_polar and (latom["is_donor"] or latom["is_acceptor"]):
                hbond_like += 1
            if distance <= 4.0 and p_is_charged and abs(int(latom["formal_charge"])) > 0:
                salt_like += 1
            if distance <= 4.0 and p_is_hydrophobic and latom["is_hydrophobic"]:
                hydrophobic += 1
            if distance <= 3.8 and latom["is_halogen"] and pelem in {"O", "N", "S"}:
                halogen += 1

    key_set = KEY_RESIDUES.get(str(target_id).upper(), set())
    key_contacts = sorted(contact_residues.intersection(key_set))
    if not contact_residues:
        quality = "implausible_no_close_contacts"
    elif key_contacts and (hbond_like > 0 or hydrophobic > 5):
        quality = "plausible_key_pocket_contacts"
    elif key_contacts:
        quality = "key_residue_contact_limited_interactions"
    else:
        quality = "contacts_without_configured_key_residues"
    return {
        "contact_residue_count": len(contact_residues),
        "contact_residues": ";".join(sorted(contact_residues)[:60]),
        "hbond_like_contacts": int(hbond_like),
        "salt_bridge_like_contacts": int(salt_like),
        "hydrophobic_contacts": int(hydrophobic),
        "halogen_contacts": int(halogen),
        "key_residue_contact_count": len(key_contacts),
        "key_residue_contacts": ";".join(key_contacts),
        "interaction_quality": quality,
    }


def build_interaction_fingerprints(
    candidates_csv: str | Path = "outputs/cancer_proof_v1/top_candidates.csv",
    out_dir: str | Path = "outputs/cancer_proof_v1/docking",
    *,
    limit: int = 30,
) -> pd.DataFrame:
    candidates_path = Path(candidates_csv)
    if not candidates_path.exists():
        raise FileNotFoundError(f"Candidate CSV not found: {candidates_path}")
    output_dir = Path(out_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    receptor_cache: dict[str, list[ProteinAtom]] = {}

    candidates = pd.read_csv(candidates_path).head(limit)
    project_dir = candidates_path.parent
    gnina_path = project_dir / "gnina" / "results.csv"
    if gnina_path.exists():
        gnina = pd.read_csv(gnina_path)
        keep = [column for column in ["candidate_id", "gnina_pose_sdf_path", "receptor_path", "gnina_cnn_pose_score", "gnina_affinity_kcal_mol"] if column in gnina.columns]
        if "candidate_id" in keep:
            candidates = candidates.merge(
                gnina[keep].rename(columns={"receptor_path": "gnina_receptor_path"}),
                on="candidate_id",
                how="left",
            )
    for row in candidates.to_dict("records"):
        target_id = str(row.get("target_id", ""))
        candidate_id = str(row.get("candidate_id", ""))
        gnina_pose = str(row.get("gnina_pose_sdf_path") or "")
        if gnina_pose and Path(gnina_pose).exists():
            receptor_path = Path(str(row.get("gnina_receptor_path") or row.get("receptor_path") or ""))
            pose_path = Path(gnina_pose)
            pose_source = "gnina_curated_pose"
        else:
            receptor_path = Path(str(row.get("receptor_path") or ""))
            pose_path = Path(str(row.get("docked_sdf_path") or row.get("sdf_path") or ""))
            pose_source = "vina_smina_docked_sdf" if str(row.get("docked_sdf_path", "")).strip() else "fallback_pose"
        receptor_key = str(receptor_path)
        if receptor_key not in receptor_cache:
            receptor_cache[receptor_key] = _parse_pdb_atoms(receptor_path)
        ligand_atoms = _ligand_atoms_from_sdf(pose_path)
        evidence = _classify_contacts(receptor_cache[receptor_key], ligand_atoms, target_id)
        rows.append(
            {
                "target_id": target_id,
                "candidate_id": candidate_id,
                "pose_source": pose_source,
                "receptor_path": str(receptor_path),
                "pose_sdf_path": str(pose_path),
                "gnina_cnn_pose_score": row.get("gnina_cnn_pose_score"),
                "gnina_affinity_kcal_mol": row.get("gnina_affinity_kcal_mol"),
                **evidence,
            }
        )

    result = pd.DataFrame(rows)
    result.to_csv(output_dir / "interaction_fingerprints.csv", index=False)
    _write_pose_notes(output_dir / "top_candidate_pose_notes.md", result)
    return result


def _write_pose_notes(path: Path, interactions: pd.DataFrame) -> None:
    lines = [
        "# Top Candidate Pose Notes",
        "",
        "These interaction fingerprints are geometric triage from the docked pose and receptor coordinates. They support prioritization but do not prove binding.",
        "",
    ]
    for row in interactions.head(30).itertuples(index=False):
        lines.append(f"## {row.target_id} {row.candidate_id}")
        lines.append(f"- Quality: {row.interaction_quality}")
        lines.append(f"- Contact residues: {row.contact_residue_count}")
        lines.append(f"- Key residues: {getattr(row, 'key_residue_contacts', '') or 'none configured/contacted'}")
        lines.append(f"- H-bond-like contacts: {row.hbond_like_contacts}; hydrophobic contacts: {row.hydrophobic_contacts}; halogen contacts: {row.halogen_contacts}")
        lines.append("- Failure risk: geometric contacts can be artifacts if receptor protonation, pocket state, or docking pose is wrong.")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Build protein-ligand interaction fingerprints from docked poses.")
    parser.add_argument("--candidates", default="outputs/cancer_proof_v1/top_candidates.csv")
    parser.add_argument("--out", default="outputs/cancer_proof_v1/docking")
    parser.add_argument("--limit", type=int, default=30)
    args = parser.parse_args()
    result = build_interaction_fingerprints(args.candidates, args.out, limit=args.limit)
    print(f"Wrote {len(result)} interaction fingerprints.")


if __name__ == "__main__":
    main()
