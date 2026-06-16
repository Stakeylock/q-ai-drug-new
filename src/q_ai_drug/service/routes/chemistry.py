from __future__ import annotations

import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from q_ai_drug.docking.pockets import registered_receptor_path, resolve_pocket

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, Crippen, Descriptors, Draw, Lipinski, QED, rdMolDescriptors
except Exception:
    Chem = None
    AllChem = None
    Crippen = None
    Descriptors = None
    Draw = None
    Lipinski = None
    QED = None
    rdMolDescriptors = None


router = APIRouter(prefix="/v1/chemistry", tags=["chemistry"])

OUTPUT_DIR = Path(os.getenv("QAI_OUTPUT_DIR", "outputs/cancer_proof_v1"))
STRUCTURES_DIR = Path(os.getenv("QAI_STRUCTURES_DIR", "data/structures"))
POCKETS_CONFIG = Path(os.getenv("QAI_POCKETS_CONFIG", "configs/oncology_pockets.yaml"))


class DockPreviewRequest(BaseModel):
    smiles: str = Field(..., min_length=1)
    target: str = Field(default="CUSTOM", min_length=1)
    candidate_id: str | None = None
    objective: str | None = None
    selected_elements: list[str] = Field(default_factory=list)
    starters: list[str] = Field(default_factory=list)
    tier: str | None = None
    patient_context: dict[str, Any] = Field(default_factory=dict)


def _safe_slug(value: str, fallback: str) -> str:
    text = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())[:80].strip("_")
    return text or fallback


def _artifact_url(path: Path) -> str:
    rel = path.resolve().relative_to(OUTPUT_DIR.resolve()).as_posix()
    return "/artifacts/" + "/".join(quote(part) for part in rel.split("/"))


def _structure_url(path: Path | None) -> str | None:
    if not path or not path.exists():
        return None
    try:
        rel = path.resolve().relative_to(STRUCTURES_DIR.resolve()).as_posix()
    except ValueError:
        return None
    return "/structures/" + "/".join(quote(part) for part in rel.split("/"))


def _translate_to_center(mol: Any, center: tuple[float, float, float]) -> None:
    conf = mol.GetConformer()
    coords = []
    for index in range(mol.GetNumAtoms()):
        pos = conf.GetAtomPosition(index)
        coords.append((pos.x, pos.y, pos.z))
    if not coords:
        return
    centroid = tuple(sum(axis) / len(axis) for axis in zip(*coords))
    offset = tuple(center[index] - centroid[index] for index in range(3))
    for index in range(mol.GetNumAtoms()):
        pos = conf.GetAtomPosition(index)
        conf.SetAtomPosition(index, (pos.x + offset[0], pos.y + offset[1], pos.z + offset[2]))


def _write_sdf(mol: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    writer = Chem.SDWriter(str(path))
    writer.write(mol)
    writer.close()


def _descriptor_payload(mol: Any) -> dict[str, Any]:
    mw = float(Descriptors.MolWt(mol))
    logp = float(Crippen.MolLogP(mol))
    tpsa = float(rdMolDescriptors.CalcTPSA(mol))
    hbd = int(Lipinski.NumHDonors(mol))
    hba = int(Lipinski.NumHAcceptors(mol))
    rot = int(Lipinski.NumRotatableBonds(mol))
    aromatic = int(rdMolDescriptors.CalcNumAromaticRings(mol))
    qed = float(QED.qed(mol))
    violations = sum(
        [
            mw > 500,
            logp > 5,
            hbd > 5,
            hba > 10,
        ]
    )
    return {
        "MW": round(mw, 3),
        "LogP": round(logp, 3),
        "TPSA": round(tpsa, 3),
        "HBD": hbd,
        "HBA": hba,
        "RotBonds": rot,
        "AromaticRings": aromatic,
        "QED": round(qed, 4),
        "lipinski_violations": int(violations),
    }


def _jitter(*parts: str) -> float:
    raw = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:8]
    return (int(raw, 16) % 1000) / 1000.0 - 0.5


def _preview_affinity(target: str, smiles: str, descriptors: dict[str, Any]) -> float:
    qed = float(descriptors.get("QED", 0.5))
    logp = float(descriptors.get("LogP", 2.5))
    mw = float(descriptors.get("MW", 350))
    tpsa = float(descriptors.get("TPSA", 80))
    rot = float(descriptors.get("RotBonds", 4))
    penalty = max(0.0, abs(logp - 3.0) - 1.6) * 0.42 + max(0.0, mw - 520) / 260 + max(0.0, tpsa - 120) / 200
    motif_bonus = 0.0
    lower = smiles.lower()
    if target.upper() == "EGFR" and ("ncn" in lower or "quinaz" in lower):
        motif_bonus += 0.45
    if target.upper() == "KRAS" and ("c(=o)" in lower or "n1" in lower):
        motif_bonus += 0.22
    if target.upper() == "MET" and ("ncn" in lower or "piperazine" in lower):
        motif_bonus += 0.28
    affinity = -5.3 - 2.35 * qed - 0.06 * max(0, 8 - rot) - motif_bonus + penalty + _jitter(target, smiles)
    return round(affinity, 2)


def _binding_class(affinity: float) -> str:
    if affinity <= -8:
        return "strong preview"
    if affinity <= -7:
        return "moderate preview"
    return "weak preview"


@router.post("/dock-preview")
def dock_preview(payload: DockPreviewRequest) -> dict[str, Any]:
    if Chem is None or AllChem is None:
        raise HTTPException(status_code=503, detail="RDKit is required for Chemistry Bench docking previews.")

    mol = Chem.MolFromSmiles(payload.smiles)
    if mol is None:
        raise HTTPException(status_code=422, detail="Could not parse the molecule design input as SMILES.")
    canonical_smiles = Chem.MolToSmiles(mol, canonical=True)
    target = _safe_slug(payload.target.upper(), "CUSTOM")
    digest = hashlib.sha1(f"{target}|{canonical_smiles}|{time.time_ns()}".encode("utf-8")).hexdigest()[:10]
    candidate_id = _safe_slug(payload.candidate_id or f"DESIGN_{target}_{digest}", f"DESIGN_{digest}")
    out_dir = OUTPUT_DIR / "user_designs" / target / candidate_id
    out_dir.mkdir(parents=True, exist_ok=True)

    working = Chem.AddHs(mol)
    status = AllChem.EmbedMolecule(working, randomSeed=17)
    if status != 0:
        status = AllChem.EmbedMolecule(working, randomSeed=17, useRandomCoords=True)
    if status != 0:
        raise HTTPException(status_code=422, detail="RDKit could not generate a 3D conformer for this molecule.")
    props = AllChem.MMFFGetMoleculeProperties(working)
    if props is not None:
        AllChem.MMFFOptimizeMolecule(working, maxIters=250)
        force_field = AllChem.MMFFGetMoleculeForceField(working, props)
        conformer_energy = float(force_field.CalcEnergy()) if force_field is not None else None
        force_field_name = "MMFF94"
    else:
        AllChem.UFFOptimizeMolecule(working, maxIters=250)
        force_field = AllChem.UFFGetMoleculeForceField(working)
        conformer_energy = float(force_field.CalcEnergy()) if force_field is not None else None
        force_field_name = "UFF"

    descriptors = _descriptor_payload(mol)
    receptor = registered_receptor_path(target, STRUCTURES_DIR, registry_path=POCKETS_CONFIG)
    pocket = resolve_pocket(target, receptor, default_box_size=24.0, registry_path=POCKETS_CONFIG) if receptor.exists() else None
    if pocket:
        _translate_to_center(working, tuple(float(value) for value in pocket["center"]))

    sdf_path = out_dir / f"{candidate_id}_pocket_preview.sdf"
    smi_path = out_dir / f"{candidate_id}.smi"
    png_path = out_dir / f"{candidate_id}.png"
    dossier_path = out_dir / f"{candidate_id}_preview_dossier.json"
    _write_sdf(working, sdf_path)
    smi_path.write_text(f"{canonical_smiles}\t{candidate_id}\n", encoding="utf-8")
    if Draw is not None:
        Draw.MolToFile(mol, str(png_path), size=(640, 420))

    affinity = _preview_affinity(target, canonical_smiles, descriptors)
    docking_component = max(0.05, min(0.95, (abs(affinity) - 4.0) / 8.5))
    raw = {
        "target_id": target,
        "candidate_id": candidate_id,
        "canonical_smiles": canonical_smiles,
        "smiles": canonical_smiles,
        "sdf_path": str(sdf_path),
        "sdf_url": _artifact_url(sdf_path),
        "docked_sdf_path": str(sdf_path),
        "docked_sdf_url": _artifact_url(sdf_path),
        "smi_path": str(smi_path),
        "smi_url": _artifact_url(smi_path),
        "png_path": str(png_path) if png_path.exists() else None,
        "png_url": _artifact_url(png_path) if png_path.exists() else None,
        "receptor_path": str(receptor) if receptor.exists() else None,
        "receptor_url": _structure_url(receptor),
        "structure_mode": f"rdkit_{force_field_name.lower()}_pocket_aligned_conformer",
        "conformer_energy_kcal_mol": round(conformer_energy, 4) if conformer_energy is not None else None,
        "docking_status": "preview_completed",
        "docking_is_real": False,
        "docking_mode": "rdkit_conformer_pocket_preview",
        "pose_method_tier": "PREVIEW",
        "pocket_method_tier": pocket["method_tier"] if pocket else "NONE",
        "pocket_source": pocket["source"] if pocket else "no_receptor",
        "pocket_pdb_id": pocket.get("pdb_id") if pocket else None,
        "reference_ligand": pocket.get("reference_ligand") if pocket else None,
        "pocket_provenance_note": pocket["provenance_note"] if pocket else "No receptor structure was found for this target.",
        "box_center": {"x": pocket["center"][0], "y": pocket["center"][1], "z": pocket["center"][2]} if pocket else None,
        "box_size": {"x": pocket["size"][0], "y": pocket["size"][1], "z": pocket["size"][2]} if pocket else None,
        "vina_affinity_kcal_mol": affinity,
        "affinity_kcal_mol": affinity,
        "binding_class": _binding_class(affinity),
        "docking_component": round(docking_component, 4),
        "docking_runtime_s": 0.0,
        "docking_note": (
            "Chemistry Bench generated a real RDKit 3D ligand artifact and aligned it to the selected pocket center. "
            "This is a docking preview, not a Vina/GNINA binding result. Run Q-Dock Studio or full pipeline for production docking."
        ),
        "gnina_status": "not_run",
        "gnina_output_excerpt": None,
        "default_pose_source": "preview",
        "pose_sources": [
            {
                "id": "preview",
                "label": "RDKit pocket-aligned preview pose",
                "url": _artifact_url(sdf_path),
                "download_url": _artifact_url(sdf_path),
                "receptor_url": _structure_url(receptor),
                "format": "sdf",
                "method_tier": "PREVIEW",
            }
        ],
        "generation_method": "Chemistry Bench RDKit 3D conformer + pocket preview",
        "claim_boundary": "Research planning only. Preview poses require real docking, redocking validation, assay confirmation, and expert review.",
        **descriptors,
    }
    dossier = {
        "request": payload.model_dump(),
        "raw": raw,
        "artifacts": {
            "sdf": raw["sdf_url"],
            "smiles": raw["smi_url"],
            "png": raw["png_url"],
            "receptor": raw["receptor_url"],
        },
        "limitations": [
            "RDKit conformer generation is not a substitute for Vina, Smina, GNINA, FEP, or MD.",
            "Preview affinity is a descriptor heuristic for prioritization only.",
            "Use wet-lab and orthogonal computational validation before making any activity or safety claim.",
        ],
    }
    dossier_path.write_text(json.dumps(dossier, indent=2, default=str), encoding="utf-8")
    raw["preview_dossier_url"] = _artifact_url(dossier_path)
    return {
        "status": "preview_completed",
        "candidate_id": candidate_id,
        "target": target,
        "smiles": canonical_smiles,
        "affinity_kcal_mol": affinity,
        "docking_component": docking_component,
        "raw": raw,
    }
