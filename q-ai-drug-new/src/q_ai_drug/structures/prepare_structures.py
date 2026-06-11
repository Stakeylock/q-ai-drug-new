from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, Draw
except Exception:
    Chem = None
    AllChem = None
    Draw = None


def prepare_ligand_assets(candidates_csv: str | Path, out_dir: str | Path, limit: int | None = None) -> pd.DataFrame:
    candidates = pd.read_csv(candidates_csv)
    if limit:
        candidates = candidates.head(limit)
    out_dir = Path(out_dir)
    sdf_dir = out_dir / "ligands_sdf"
    smi_dir = out_dir / "ligands_smi"
    png_dir = out_dir / "ligand_png"
    sdf_dir.mkdir(parents=True, exist_ok=True)
    smi_dir.mkdir(parents=True, exist_ok=True)
    png_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for row in candidates.to_dict("records"):
        candidate_id = str(row.get("candidate_id") or row.get("generation_hash") or len(rows) + 1)
        smiles = str(row.get("canonical_smiles") or row.get("smiles"))
        smi_path = smi_dir / f"{candidate_id}.smi"
        smi_path.write_text(f"{smiles}\t{candidate_id}\n")
        rec = {
            "candidate_id": candidate_id,
            "target_id": row.get("target_id"),
            "smiles": smiles,
            "smi_path": str(smi_path),
            "sdf_path": None,
            "png_path": None,
            "conformer_energy_kcal_mol": None,
            "structure_mode": "smiles_only",
        }
        if Chem is not None and AllChem is not None:
            mol = Chem.MolFromSmiles(smiles)
            if mol is not None:
                if Draw is not None:
                    png_path = png_dir / f"{candidate_id}.png"
                    Draw.MolToFile(mol, str(png_path), size=(420, 320))
                    rec["png_path"] = str(png_path)
                mol = Chem.AddHs(mol)
                status = AllChem.EmbedMolecule(mol, randomSeed=17)
                if status == 0:
                    props = AllChem.MMFFGetMoleculeProperties(mol)
                    if props is not None:
                        AllChem.MMFFOptimizeMolecule(mol, maxIters=200)
                        ff = AllChem.MMFFGetMoleculeForceField(mol, props)
                        rec["conformer_energy_kcal_mol"] = float(ff.CalcEnergy()) if ff is not None else None
                    else:
                        AllChem.UFFOptimizeMolecule(mol, maxIters=200)
                        ff = AllChem.UFFGetMoleculeForceField(mol)
                        rec["conformer_energy_kcal_mol"] = float(ff.CalcEnergy()) if ff is not None else None
                    sdf_path = sdf_dir / f"{candidate_id}.sdf"
                    writer = Chem.SDWriter(str(sdf_path))
                    writer.write(mol)
                    writer.close()
                    rec["sdf_path"] = str(sdf_path)
                    rec["structure_mode"] = "rdkit_mmff94"
        rows.append(rec)
    manifest = pd.DataFrame(rows)
    manifest.to_csv(out_dir / "ligand_asset_manifest.csv", index=False)
    (out_dir / "structure_manifest.json").write_text(
        json.dumps({"rdkit_available": Chem is not None, "candidate_count": len(manifest)}, indent=2)
    )
    return manifest
