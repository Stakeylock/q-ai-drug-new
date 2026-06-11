from __future__ import annotations

import argparse
import hashlib
import io
import re
import shutil
import contextlib
from pathlib import Path

import numpy as np
import pandas as pd

from q_ai_drug.features.descriptors import append_descriptors
from q_ai_drug.tools.external import resolve_tool, run_external, windows_to_wsl_path

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
    from rdkit.Chem import rdEHTTools
except Exception:
    Chem = None
    AllChem = None
    rdEHTTools = None


def xtb_available() -> bool:
    return resolve_tool("xtb").available or shutil.which("xtb") is not None


def _stable_float(*parts: str, low: float, high: float) -> float:
    raw = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:8]
    value = (int(raw, 16) % 10000) / 10000.0
    return low + (high - low) * value


def rdkit_eht_descriptors(smiles: str) -> dict[str, float | bool | str]:
    if Chem is None or AllChem is None or rdEHTTools is None:
        return {"qm_is_real": False, "qm_mode": "proxy_xtb_like_descriptors"}
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return {"qm_is_real": False, "qm_mode": "invalid_smiles"}
    mol = Chem.AddHs(mol)
    if AllChem.EmbedMolecule(mol, randomSeed=19) != 0:
        return {"qm_is_real": False, "qm_mode": "rdkit_embedding_failed"}
    props = AllChem.MMFFGetMoleculeProperties(mol)
    if props is not None:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=250)
    else:
        AllChem.UFFOptimizeMolecule(mol, maxIters=250)
    with contextlib.redirect_stderr(io.StringIO()):
        ok, result = rdEHTTools.RunMol(mol)
    if not ok:
        return {"qm_is_real": False, "qm_mode": "rdkit_eht_failed"}
    energies = sorted(float(value) for value in result.GetOrbitalEnergies())
    electron_count = int(sum(atom.GetAtomicNum() for atom in mol.GetAtoms()))
    homo_idx = max(0, min(len(energies) - 2, electron_count // 2 - 1))
    homo = energies[homo_idx]
    lumo = energies[homo_idx + 1]
    charges = list(result.GetAtomicCharges())
    conf = mol.GetConformer()
    dipole = np.zeros(3)
    for atom_idx, charge in enumerate(charges):
        pos = conf.GetAtomPosition(atom_idx)
        dipole += float(charge) * np.array([pos.x, pos.y, pos.z])
    dipole_debye = float(np.linalg.norm(dipole) * 4.80320427)
    return {
        "homo_ev": homo,
        "lumo_ev": lumo,
        "homo_lumo_gap_ev": abs(lumo - homo),
        "dipole_debye": dipole_debye,
        "max_abs_partial_charge": float(max(abs(value) for value in charges)) if charges else 0.0,
        "qm_mode": "rdkit_extended_huckel",
        "qm_is_real": True,
        "qm_note": "RDKit Extended Huckel semi-empirical descriptors from MMFF/UFF conformer.",
    }


def _write_xyz(smiles: str, out_path: Path) -> bool:
    if Chem is None or AllChem is None:
        return False
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return False
    mol = Chem.AddHs(mol)
    if AllChem.EmbedMolecule(mol, randomSeed=23) != 0:
        return False
    props = AllChem.MMFFGetMoleculeProperties(mol)
    if props is not None:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=250)
    else:
        AllChem.UFFOptimizeMolecule(mol, maxIters=250)
    conf = mol.GetConformer()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        handle.write(f"{mol.GetNumAtoms()}\n{out_path.stem}\n")
        for atom in mol.GetAtoms():
            pos = conf.GetAtomPosition(atom.GetIdx())
            handle.write(f"{atom.GetSymbol()} {pos.x:.8f} {pos.y:.8f} {pos.z:.8f}\n")
    return True


def _parse_xtb_output(text: str) -> dict[str, float]:
    values: dict[str, float] = {}
    for line in text.splitlines():
        if "TOTAL ENERGY" in line and "Eh" in line:
            match = re.search(r"TOTAL ENERGY\s+(-?\d+\.\d+)", line)
            if match:
                values["xtb_total_energy_eh"] = float(match.group(1))
        if "HOMO-LUMO GAP" in line and "eV" in line:
            match = re.search(r"HOMO-LUMO GAP\s+(-?\d+\.\d+)", line)
            if match:
                values["homo_lumo_gap_ev"] = float(match.group(1))
        if "(HOMO)" in line:
            floats = re.findall(r"-?\d+\.\d+", line)
            if floats:
                values["homo_ev"] = float(floats[-1])
        if "(LUMO)" in line:
            floats = re.findall(r"-?\d+\.\d+", line)
            if floats:
                values["lumo_ev"] = float(floats[-1])
    return values


def xtb_descriptors(smiles: str, work_dir: Path, candidate_id: str) -> dict[str, float | bool | str]:
    if not xtb_available():
        return {"qm_is_real": False, "qm_mode": "xtb_not_available"}
    safe_id = re.sub(r"[^A-Za-z0-9_.-]+", "_", candidate_id)[:80]
    mol_dir = work_dir / "xtb_runs" / safe_id
    xyz_path = mol_dir / f"{safe_id}.xyz"
    if not _write_xyz(smiles, xyz_path):
        return {"qm_is_real": False, "qm_mode": "xtb_xyz_generation_failed"}
    result = run_external(
        "xtb",
        [windows_to_wsl_path(xyz_path), "--gfn", "2", "--sp", "--parallel", "1"],
        cwd=mol_dir,
        timeout=900,
        check=False,
    )
    text = (result.stdout or "") + "\n" + (result.stderr or "")
    if result.returncode != 0:
        return {
            "qm_is_real": False,
            "qm_mode": "xtb_failed",
            "qm_note": "\n".join(text.splitlines()[-8:]),
        }
    parsed = _parse_xtb_output(text)
    if "homo_lumo_gap_ev" not in parsed:
        return {"qm_is_real": False, "qm_mode": "xtb_parse_failed", "qm_note": "\n".join(text.splitlines()[-8:])}
    parsed.update(
        {
            "qm_mode": "xtb_gfn2_single_point",
            "qm_is_real": True,
            "qm_note": "xTB GFN2 single-point calculation on RDKit MMFF/UFF conformer via WSL.",
        }
    )
    return parsed


def run_proxy_qm(candidates_csv: str | Path, out_dir: str | Path, top: int = 10) -> pd.DataFrame:
    candidates = pd.read_csv(candidates_csv)
    candidates = candidates.sort_values(["target_id", "affinity_kcal_mol"]).groupby("target_id", group_keys=False).head(top).copy()
    if "canonical_smiles" not in candidates.columns:
        candidates["canonical_smiles"] = candidates["smiles"]
    candidates = append_descriptors(candidates, "canonical_smiles")
    rows = []
    out_dir = Path(out_dir)
    for row in candidates.to_dict("records"):
        key = str(row.get("candidate_id")) + str(row.get("target_id")) + str(row.get("canonical_smiles"))
        candidate_id = str(row.get("candidate_id") or key[:12])
        qm = xtb_descriptors(str(row.get("canonical_smiles")), out_dir, candidate_id)
        if not qm.get("qm_is_real"):
            qm = rdkit_eht_descriptors(str(row.get("canonical_smiles")))
        if qm.get("qm_is_real"):
            gap = float(qm["homo_lumo_gap_ev"])
            homo = float(qm["homo_ev"])
            lumo = float(qm["lumo_ev"])
            dipole = float(qm.get("dipole_debye", row.get("TPSA", 0.0)) or 0.0)
            qm_mode = str(qm["qm_mode"])
            qm_is_real = True
            qm_note = str(qm["qm_note"])
            max_abs_charge = float(qm.get("max_abs_partial_charge", 0.0))
            xtb_total_energy = qm.get("xtb_total_energy_eh", np.nan)
        else:
            gap = _stable_float(key, "gap", low=3.2, high=6.5)
            homo = -_stable_float(key, "homo", low=5.0, high=8.2)
            lumo = homo + gap
            dipole = _stable_float(key, "dipole", low=1.0, high=8.0)
            qm_mode = str(qm.get("qm_mode", "proxy_xtb_like_descriptors"))
            qm_is_real = False
            qm_note = "Install xTB or Psi4 and pass prepared 3D structures for higher-fidelity QM descriptors."
            max_abs_charge = np.nan
            xtb_total_energy = np.nan
        quantum_score = np.clip(1.0 - abs(gap - 4.8) / 4.8 + float(row.get("QED", 0.5)) * 0.15, 0, 1)
        rows.append(
            {
                "target_id": row.get("target_id"),
                "candidate_id": row.get("candidate_id"),
                "smiles": row.get("canonical_smiles"),
                "homo_ev": round(homo, 3),
                "lumo_ev": round(lumo, 3),
                "homo_lumo_gap_ev": round(gap, 3),
                "dipole_debye": round(dipole, 3),
                "max_abs_partial_charge": round(max_abs_charge, 3) if np.isfinite(max_abs_charge) else np.nan,
                "xtb_total_energy_eh": round(float(xtb_total_energy), 8) if np.isfinite(xtb_total_energy) else np.nan,
                "quantum_score": round(float(quantum_score), 4),
                "qm_mode": qm_mode,
                "qm_is_real": qm_is_real,
                "qm_note": qm_note,
            }
        )
    out_dir.mkdir(parents=True, exist_ok=True)
    result = pd.DataFrame(rows)
    result.to_csv(out_dir / "qm_descriptors.csv", index=False)
    return result


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run xTB descriptors or deterministic proxy QM descriptors.")
    parser.add_argument("--candidates", required=True)
    parser.add_argument("--out", default="outputs/cancer_proof_v1/qm")
    parser.add_argument("--top", type=int, default=10)
    args = parser.parse_args(argv)
    result = run_proxy_qm(args.candidates, args.out, top=args.top)
    print(f"Wrote {len(result)} QM descriptor rows to {Path(args.out) / 'qm_descriptors.csv'}")


if __name__ == "__main__":
    main()
