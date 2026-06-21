from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote, unquote

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from q_ai_drug.docking.gnina_runner import _center_ligand_sdf, _parse_gnina_output, _parse_gnina_warnings
from q_ai_drug.docking.pockets import clean_receptor_pdb, effective_cubic_box_size, registered_receptor_path, resolve_pocket
from q_ai_drug.docking.vina_runner import _run_obabel, parse_affinity_text
from q_ai_drug.tools.external import resolve_tool, run_external, windows_to_wsl_path

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
FRONTEND_PUBLIC_DIR = Path(os.getenv("QAI_FRONTEND_PUBLIC_DIR", "user-front/public"))
POCKETS_CONFIG = Path(os.getenv("QAI_POCKETS_CONFIG", "configs/oncology_pockets.yaml"))
TARGET_ALPHAFOLD_IDS = {
    "EGFR": "AF-P00533-F1",
    "ROS1": "AF-P08922-F1",
    "KRAS": "AF-P01116-F1",
    "BRAF": "AF-P15056-F1",
    "MET": "AF-P08581-F1",
    "ERBB2": "AF-P04626-F1",
    "PIK3CA": "AF-P42336-F1",
    "PARP1": "AF-P09874-F1",
    "FLT3": "AF-P36888-F1",
    "IDH1": "AF-O75874-F1",
    "AR": "AF-P10275-F1",
    "BCL2": "AF-P10415-F1",
    "ALK": "AF-Q9UM73-F1",
    "TP53": "AF-P04637-F1",
    "ESR1": "AF-P03372-F1",
}


class DockPreviewRequest(BaseModel):
    smiles: str = Field(..., min_length=1, max_length=4096)
    target: str = Field(default="CUSTOM", min_length=1, max_length=64)
    candidate_id: str | None = Field(default=None, max_length=128)
    objective: str | None = Field(default=None, max_length=1000)
    selected_elements: list[str] = Field(default_factory=list)
    starters: list[str] = Field(default_factory=list)
    tier: str | None = None
    patient_context: dict[str, Any] = Field(default_factory=dict)


class DockingBox(BaseModel):
    x: float
    y: float
    z: float


class RealtimeDockRequest(BaseModel):
    smiles: str | None = Field(default=None, min_length=1, max_length=4096)
    target: str = Field(default="CUSTOM", min_length=1, max_length=64)
    candidate_id: str | None = Field(default=None, max_length=128)
    engine: Literal["auto", "gnina", "vina", "smina"] = "gnina"
    ligand_sdf_path: str | None = Field(default=None, max_length=2048)
    ligand_sdf_url: str | None = Field(default=None, max_length=2048)
    receptor_path: str | None = Field(default=None, max_length=2048)
    receptor_url: str | None = Field(default=None, max_length=2048)
    box_center: DockingBox | None = None
    box_size: DockingBox | None = None
    exhaustiveness: int = Field(default=4, ge=1, le=32)
    num_modes: int = Field(default=5, ge=1, le=20)
    cpu: int = Field(default=4, ge=1, le=16)


class ChemicalDbRegisterRequest(BaseModel):
    candidate_id: str = Field(..., min_length=1, max_length=160)
    target: str = Field(default="CUSTOM", min_length=1, max_length=80)
    smiles: str | None = Field(default=None, max_length=4096)
    objective: str | None = Field(default=None, max_length=1200)
    synthesis_status: Literal["designed", "ordered", "synthesized", "analytical_passed"] = "designed"
    analytical_status: Literal["not_started", "pending", "passed", "failed"] = "not_started"
    docking_status: str | None = Field(default=None, max_length=80)
    evidence: dict[str, Any] = Field(default_factory=dict)
    wet_lab_assays: list[str] = Field(default_factory=list, max_length=40)
    notes: str | None = Field(default=None, max_length=4000)


def _safe_slug(value: str, fallback: str) -> str:
    text = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())[:80].strip("_")
    return text or fallback


def _artifact_url(path: Path) -> str:
    rel = path.resolve().relative_to(OUTPUT_DIR.resolve()).as_posix()
    return "/artifacts/" + "/".join(quote(part) for part in rel.split("/"))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def _chemical_db_root() -> Path:
    root = OUTPUT_DIR / "chemical_db"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True


def _allowed_local_asset_roots() -> list[Path]:
    return [
        OUTPUT_DIR.resolve(),
        STRUCTURES_DIR.resolve(),
        FRONTEND_PUBLIC_DIR.resolve(),
        Path(os.getenv("QAI_LEGACY_STRUCTURES_DIR", "data/structures_havetosee")).resolve(),
    ]


def _guard_local_asset_path(path: Path) -> Path:
    resolved = path.resolve()
    if any(_is_relative_to(resolved, root) for root in _allowed_local_asset_roots()):
        return resolved
    raise HTTPException(status_code=403, detail="Local chemistry paths must stay inside artifacts, structures, or pharma-library assets.")


def _path_from_url_or_path(raw: str | None) -> Path | None:
    if not raw:
        return None
    text = unquote(str(raw)).strip()
    if not text:
        return None
    if text.startswith("/artifacts/"):
        path = (OUTPUT_DIR / text.removeprefix("/artifacts/")).resolve()
        try:
            path.relative_to(OUTPUT_DIR.resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Artifact path escapes output directory.") from None
        return path
    if text.startswith("/structures/"):
        return _guard_local_asset_path(STRUCTURES_DIR / Path(text.removeprefix("/structures/")).name)
    if text.startswith("/structures-havetosee/"):
        legacy_dir = Path(os.getenv("QAI_LEGACY_STRUCTURES_DIR", "data/structures_havetosee"))
        return _guard_local_asset_path(legacy_dir / Path(text.removeprefix("/structures-havetosee/")).name)
    if text.startswith("/pharma-library/"):
        path = (FRONTEND_PUBLIC_DIR / text.removeprefix("/")).resolve()
        try:
            path.relative_to(FRONTEND_PUBLIC_DIR.resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Pharma library path escapes public asset directory.") from None
        return path
    if text.startswith("http://") or text.startswith("https://"):
        return None
    return _guard_local_asset_path(Path(text))


def _structure_url(path: Path | None) -> str | None:
    if not path or not path.exists():
        return None
    try:
        rel = path.resolve().relative_to(STRUCTURES_DIR.resolve()).as_posix()
    except ValueError:
        return None
    return "/structures/" + "/".join(quote(part) for part in rel.split("/"))


def _receptor_url(path: Path | None) -> str | None:
    structure = _structure_url(path)
    if structure:
        return structure
    if path and path.exists():
        try:
            path.resolve().relative_to(OUTPUT_DIR.resolve())
            return _artifact_url(path)
        except ValueError:
            return None
    return None


def _public_alphafold_cif(target: str) -> Path | None:
    alphafold_id = TARGET_ALPHAFOLD_IDS.get(target.upper())
    if not alphafold_id:
        return None
    path = FRONTEND_PUBLIC_DIR / "pharma-library" / "receptors" / "alphafold" / f"{alphafold_id}-model_v6.cif"
    return path if path.exists() else None


def _format_pdb_atom_name(name: str, element: str) -> str:
    atom = (name or element or "X")[:4]
    if len(atom) < 4 and len((element or "").strip()) == 1:
        return f" {atom:<3}"
    return f"{atom:<4}"


def _convert_alphafold_cif_to_pdb(cif_path: Path, pdb_path: Path) -> Path:
    pdb_path.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    in_atom_loop = False
    headers: list[str] = []
    for raw_line in cif_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line == "loop_":
            in_atom_loop = False
            headers = []
            continue
        if line.startswith("_atom_site."):
            in_atom_loop = True
            headers.append(line)
            continue
        if in_atom_loop and line.startswith("#"):
            break
        if not in_atom_loop or not headers or not line.startswith(("ATOM", "HETATM")):
            continue
        parts = shlex.split(line)
        if len(parts) < len(headers):
            continue
        row = {headers[index].removeprefix("_atom_site."): parts[index] for index in range(len(headers))}
        try:
            record = row.get("group_PDB", "ATOM")[:6]
            serial = int(float(row.get("id", len(lines) + 1)))
            element = (row.get("type_symbol") or "").strip()
            atom_name = row.get("auth_atom_id") or row.get("label_atom_id") or element or "X"
            alt_id = row.get("label_alt_id") if row.get("label_alt_id") not in {".", "?"} else ""
            res_name = (row.get("auth_comp_id") or row.get("label_comp_id") or "UNK")[:3]
            chain = (row.get("auth_asym_id") or row.get("label_asym_id") or "A")[:1]
            resseq = int(float(row.get("auth_seq_id") or row.get("label_seq_id") or 1))
            icode = row.get("pdbx_PDB_ins_code") if row.get("pdbx_PDB_ins_code") not in {".", "?"} else ""
            x = float(row["Cartn_x"])
            y = float(row["Cartn_y"])
            z = float(row["Cartn_z"])
            occupancy = float(row.get("occupancy") or 1.0)
            b_factor = float(row.get("B_iso_or_equiv") or 0.0)
        except (KeyError, ValueError):
            continue
        lines.append(
            f"{record:<6}{serial:5d} {_format_pdb_atom_name(atom_name, element)}{alt_id[:1]:1}"
            f"{res_name:>3} {chain:1}{resseq:4d}{icode[:1]:1}   "
            f"{x:8.3f}{y:8.3f}{z:8.3f}{occupancy:6.2f}{b_factor:6.2f}          {element[:2]:>2}"
        )
    if not lines:
        raise HTTPException(status_code=422, detail=f"Could not convert AlphaFold mmCIF to PDB: {cif_path}")
    pdb_path.write_text("\n".join(lines) + "\nEND\n", encoding="utf-8")
    return pdb_path


def _resolve_receptor_for_target(target: str, out_dir: Path, requested: Path | None = None) -> Path | None:
    if requested and requested.exists():
        return requested
    registered = registered_receptor_path(target, STRUCTURES_DIR, registry_path=POCKETS_CONFIG)
    if registered.exists():
        return registered
    cif_path = _public_alphafold_cif(target)
    if not cif_path:
        return registered
    converted = out_dir / "prepared_receptors" / f"{target.upper()}_alphafold_from_public.pdb"
    if not converted.exists():
        _convert_alphafold_cif_to_pdb(cif_path, converted)
    return converted


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


def _generate_ligand_sdf(smiles: str, path: Path, *, center: tuple[float, float, float] | None = None) -> str:
    if Chem is None or AllChem is None:
        raise HTTPException(status_code=503, detail="RDKit is required to generate ligand SDF files from SMILES.")
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(status_code=422, detail="Could not parse molecule input as SMILES.")
    working = Chem.AddHs(mol)
    status = AllChem.EmbedMolecule(working, randomSeed=23)
    if status != 0:
        status = AllChem.EmbedMolecule(working, randomSeed=23, useRandomCoords=True)
    if status != 0:
        raise HTTPException(status_code=422, detail="RDKit could not generate a 3D conformer for this molecule.")
    props = AllChem.MMFFGetMoleculeProperties(working)
    if props is not None:
        AllChem.MMFFOptimizeMolecule(working, maxIters=250)
    else:
        AllChem.UFFOptimizeMolecule(working, maxIters=250)
    if center:
        _translate_to_center(working, center)
    _write_sdf(working, path)
    return Chem.MolToSmiles(mol, canonical=True)


def _tool_manifest() -> dict[str, dict[str, Any]]:
    manifest = {}
    for name in ["gnina", "vina", "smina", "obabel"]:
        tool = resolve_tool(name)
        manifest[name] = {"available": tool.available, "path": tool.path, "via_wsl": tool.via_wsl}
    return manifest


def _tool_path_for(tool_name: str, path: Path) -> str:
    tool = resolve_tool(tool_name)
    return windows_to_wsl_path(path) if tool.via_wsl else str(path.resolve())


def _upsert_csv_row(path: Path, row: dict[str, Any], key: str = "candidate_id") -> None:
    import pandas as pd

    path.parent.mkdir(parents=True, exist_ok=True)
    clean_row = {field: value for field, value in row.items() if not isinstance(value, (dict, list))}
    frame = pd.DataFrame([clean_row])
    if path.exists():
        existing = pd.read_csv(path)
        if key in existing.columns:
            existing = existing[existing[key].astype(str) != str(clean_row.get(key))]
        frame = pd.concat([existing, frame], ignore_index=True, sort=False)
    frame.to_csv(path, index=False)


def _convert_pose_to_sdf(input_path: Path, output_path: Path) -> None:
    if not resolve_tool("obabel").available:
        return
    result = _run_obabel(input_path, output_path, timeout=600)
    if result.returncode != 0 or not output_path.exists():
        raise HTTPException(status_code=502, detail=f"OpenBabel pose conversion failed: {(result.stderr or result.stdout)[:700]}")


def _pose_sources_from_docking(raw: dict[str, Any]) -> list[dict[str, Any]]:
    sources = []
    if raw.get("gnina_pose_sdf_url"):
        sources.append(
            {
                "id": "gnina",
                "label": "GNINA CNN docked pose",
                "url": raw["gnina_pose_sdf_url"],
                "receptor_url": raw.get("gnina_receptor_url") or raw.get("receptor_url"),
                "format": "sdf",
                "method_tier": "REAL" if raw.get("gnina_status") == "completed" else "FAILED",
                "download_url": raw["gnina_pose_sdf_url"],
            }
        )
    if raw.get("vina_docked_sdf_url"):
        sources.append(
            {
                "id": "vina",
                "label": "AutoDock Vina docked pose",
                "url": raw["vina_docked_sdf_url"],
                "receptor_url": raw.get("vina_receptor_url") or raw.get("receptor_url"),
                "format": "sdf",
                "method_tier": "REAL" if raw.get("vina_status") == "completed" else "FAILED",
                "download_url": raw["vina_docked_sdf_url"],
            }
        )
    if raw.get("smina_docked_sdf_url"):
        sources.append(
            {
                "id": "smina",
                "label": "Smina minimized/rescored pose",
                "url": raw["smina_docked_sdf_url"],
                "receptor_url": raw.get("smina_receptor_url") or raw.get("receptor_url"),
                "format": "sdf",
                "method_tier": "REAL" if raw.get("smina_status") == "completed" else "FAILED",
                "download_url": raw["smina_docked_sdf_url"],
            }
        )
    if raw.get("docked_sdf_url") and not any(source["url"] == raw.get("docked_sdf_url") for source in sources):
        sources.append(
            {
                "id": "docked",
                "label": "Docked pose",
                "url": raw["docked_sdf_url"],
                "receptor_url": raw.get("receptor_url"),
                "format": "sdf",
                "method_tier": "REAL" if raw.get("docking_status") == "completed" else "FAILED",
                "download_url": raw["docked_sdf_url"],
            }
        )
    if not sources and raw.get("sdf_url"):
        sources.append(
            {
                "id": "conformer",
                "label": "Generated RDKit conformer",
                "url": raw["sdf_url"],
                "format": "sdf",
                "method_tier": "PROXY",
                "download_url": raw["sdf_url"],
            }
        )
    return sources


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


def _safe_descriptor_payload_from_smiles(smiles: str | None) -> dict[str, Any]:
    if not smiles or Chem is None:
        return {}
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return {}
    try:
        return _descriptor_payload(mol)
    except Exception:
        return {}


def _chemical_identity(candidate_id: str, target: str, smiles: str | None) -> str:
    digest = hashlib.sha1(f"{target}|{candidate_id}|{smiles or ''}".encode("utf-8")).hexdigest()[:12]
    return _safe_slug(f"QDF-{target.upper()}-{digest}", f"QDF-{digest}")


def _docking_gate(evidence: dict[str, Any]) -> dict[str, Any]:
    engines = {
        "gnina": evidence.get("gnina_status"),
        "vina": evidence.get("vina_status"),
        "smina": evidence.get("smina_status"),
        "generic": evidence.get("docking_status"),
    }
    completed = [engine for engine, status in engines.items() if str(status or "").lower() == "completed"]
    real_pose = bool(
        evidence.get("gnina_pose_sdf_url")
        or evidence.get("vina_docked_sdf_url")
        or evidence.get("smina_docked_sdf_url")
        or evidence.get("docked_sdf_url")
    )
    if "gnina" in completed and real_pose:
        gate = "passed_primary_docking"
    elif completed and real_pose:
        gate = "passed_docking_review"
    elif evidence.get("sdf_url"):
        gate = "preview_only"
    else:
        gate = "needs_docking"
    return {
        "gate": gate,
        "completed_engines": completed,
        "real_pose_available": real_pose,
        "default_pose_source": evidence.get("default_pose_source") or ("gnina" if "gnina" in completed else completed[0] if completed else "none"),
    }


def _synthesis_route_card(record: dict[str, Any]) -> dict[str, Any]:
    smiles = str(record.get("smiles") or "")
    descriptors = record.get("descriptors") or {}
    route_flags: list[str] = []
    if "C(=O)N" in smiles or "NC(=O)" in smiles:
        route_flags.append("amide-coupling disconnection candidate")
    if "n" in smiles.lower() or "N" in smiles:
        route_flags.append("heteroaryl/amine salt-form and basicity review")
    if any(token in smiles for token in ["Cl", "Br", "I", "F"]):
        route_flags.append("halogenated aryl building-block or cross-coupling review")
    if "B" in smiles:
        route_flags.append("boron-containing motif requires reactivity and stability review")
    if not route_flags:
        route_flags.append("medicinal chemist retrosynthesis review required")
    release_specs = [
        "identity confirmed by LC-MS and 1H NMR",
        "purity target >= 95% by HPLC/UPLC unless program SOP defines otherwise",
        "salt, solvate, stereochemistry, and counterion state recorded",
        "residual solvent and inorganic impurity review before cellular assays",
        "stock solution concentration, DMSO percentage, storage condition, and freeze-thaw count recorded",
    ]
    if float(descriptors.get("MW") or 0) > 500:
        release_specs.append("high molecular weight: confirm solubility and permeability before expensive assays")
    if float(descriptors.get("LogP") or 0) > 4:
        release_specs.append("high lipophilicity: add kinetic solubility and nonspecific-binding checks")
    route_steps = [
        {
            "stage": "route scouting",
            "purpose": "Select purchasable building blocks or vendor route; document IP/procurement risk.",
            "output": "approved route proposal with hazards, protecting groups, and expected intermediates",
        },
        {
            "stage": "small-scale synthesis or procurement",
            "purpose": "Create or acquire a research sample under approved lab SOPs and chemist supervision.",
            "output": "batch ID, mass, lot/source, route summary, and deviations",
        },
        {
            "stage": "purification and analytical release",
            "purpose": "Purify and verify identity/purity before biological interpretation.",
            "output": "LC-MS, NMR, purity chromatogram, and release decision",
        },
        {
            "stage": "assay-ready formulation",
            "purpose": "Prepare stock, solubility check, plate map, and stability notes for wet-lab handoff.",
            "output": "assay-ready vial/plate record with concentration and storage metadata",
        },
    ]
    return {
        "route_strategy": route_flags,
        "route_steps": route_steps,
        "analytical_release_specs": release_specs,
        "safety_review": [
            "Review SDS for all reagents, intermediates, solvents, and final material before handling.",
            "Route card is planning guidance only; exact conditions must come from approved ELN/SOP or expert chemist design.",
            "Covalent, reactive, metal-containing, or highly lipophilic designs require additional hazard review.",
        ],
        "claim_boundary": "Synthesis route card is non-executable planning support. It does not provide validated lab instructions or replace a qualified chemist.",
    }


def _wet_lab_handoff(record: dict[str, Any]) -> dict[str, Any]:
    assays = record.get("wet_lab_assays") or [
        "biochemical IC50/Ki",
        "orthogonal Kd target engagement",
        "cell viability dose response",
        "selectivity/off-target panel",
        "kinetic solubility",
        "Caco-2/MDCK permeability",
        "microsomal stability",
        "CYP inhibition",
        "hERG risk screen",
        "early tox panel",
    ]
    return {
        "handoff_id": f"handoff_{record['chemical_id']}",
        "target": record.get("target") or "CUSTOM",
        "candidate_id": record.get("candidate_id"),
        "chemical_id": record.get("chemical_id"),
        "required_package": [
            "SMILES/InChIKey or structural identifier",
            "SDF/PDBQT/docked pose artifacts where available",
            "route card and batch/lot record",
            "analytical release certificate",
            "assay plate map and concentration range",
            "safety and handling notes",
        ],
        "recommended_assays": assays,
        "first_pass_acceptance": [
            "identity/purity release passed",
            "primary biochemical and orthogonal engagement assays are reproducible",
            "solubility supports tested concentration range",
            "no severe early hERG/CYP/tox red flag without mitigation",
        ],
        "claim_boundary": "Wet-lab handoff supports research testing only and does not imply activity, safety, or clinical utility.",
    }


def _record_markdown(record: dict[str, Any]) -> str:
    route = record["synthesis_route_card"]
    handoff = record["wet_lab_handoff"]
    lines = [
        f"# Chemical DB Record: {record['chemical_id']}",
        "",
        f"- Candidate: {record['candidate_id']}",
        f"- Target: {record['target']}",
        f"- Synthesis status: {record['synthesis_status']}",
        f"- Analytical status: {record['analytical_status']}",
        f"- Docking gate: {record['docking_gate']['gate']}",
        "",
        "## Route Strategy",
        *[f"- {item}" for item in route["route_strategy"]],
        "",
        "## Planning Stages",
        *[f"- {step['stage']}: {step['purpose']} Output: {step['output']}" for step in route["route_steps"]],
        "",
        "## Analytical Release",
        *[f"- {item}" for item in route["analytical_release_specs"]],
        "",
        "## Wet-Lab Handoff",
        *[f"- {item}" for item in handoff["recommended_assays"]],
        "",
        route["claim_boundary"],
    ]
    return "\n".join(lines)


def _load_chemical_records(limit: int = 100) -> list[dict[str, Any]]:
    records_dir = _chemical_db_root() / "records"
    if not records_dir.exists():
        return []
    rows = []
    for path in sorted(records_dir.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)[:limit]:
        rows.append(_read_json(path, {}))
    return [row for row in rows if row]


def _first_mol_from_sdf(path: Path) -> Any | None:
    if Chem is None or not path.exists():
        return None
    for sanitize in (True, False):
        try:
            supplier = Chem.SDMolSupplier(str(path), removeHs=False, sanitize=sanitize)
            mol = next((item for item in supplier if item is not None), None)
            if mol is None:
                continue
            if not sanitize:
                try:
                    Chem.SanitizeMol(mol)
                except Exception:
                    pass
            return mol
        except Exception:
            continue
    return None


def _ligand_metadata_from_sdf(path: Path) -> dict[str, Any]:
    mol = _first_mol_from_sdf(path)
    if mol is None:
        return {"ligand_metadata_status": "unavailable"}
    try:
        descriptor_mol = Chem.RemoveHs(mol)
    except Exception:
        descriptor_mol = mol
    try:
        Chem.SanitizeMol(descriptor_mol)
    except Exception:
        pass
    try:
        smiles = Chem.MolToSmiles(descriptor_mol, canonical=True)
    except Exception:
        smiles = ""
    payload = {
        "ligand_metadata_status": "parsed_from_sdf",
        "ligand_atom_count": int(mol.GetNumAtoms()),
        "canonical_smiles": smiles,
        "smiles": smiles,
    }
    try:
        payload.update(_descriptor_payload(descriptor_mol))
    except Exception as exc:
        payload["descriptor_error"] = str(exc)[:300]
    return payload


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


@router.post("/chemical-db/register")
def register_chemical(payload: ChemicalDbRegisterRequest) -> dict[str, Any]:
    target = _safe_slug(payload.target.upper(), "CUSTOM")
    smiles = payload.smiles or payload.evidence.get("canonical_smiles") or payload.evidence.get("smiles")
    descriptors = _safe_descriptor_payload_from_smiles(smiles)
    chemical_id = _chemical_identity(payload.candidate_id, target, smiles)
    root = _chemical_db_root()
    existing_path = root / "records" / f"{chemical_id}.json"
    existing = _read_json(existing_path, {})
    docking_gate = _docking_gate(payload.evidence)
    wet_lab_ready = (
        payload.synthesis_status in {"synthesized", "analytical_passed"}
        and payload.analytical_status == "passed"
        and docking_gate["gate"] in {"passed_primary_docking", "passed_docking_review"}
    )
    record = {
        **existing,
        "chemical_id": chemical_id,
        "candidate_id": payload.candidate_id,
        "target": target,
        "smiles": smiles,
        "objective": payload.objective,
        "synthesis_status": payload.synthesis_status,
        "analytical_status": payload.analytical_status,
        "docking_status": payload.docking_status or payload.evidence.get("docking_status") or payload.evidence.get("gnina_status"),
        "docking_gate": docking_gate,
        "wet_lab_ready": wet_lab_ready,
        "wet_lab_assays": payload.wet_lab_assays,
        "descriptors": descriptors,
        "evidence": payload.evidence,
        "notes": payload.notes,
        "created_at": existing.get("created_at") or _now_iso(),
        "updated_at": _now_iso(),
        "claim_boundary": "Chemical DB records are research inventory and handoff planning artifacts, not validated manufacturing or clinical records.",
    }
    record["synthesis_route_card"] = _synthesis_route_card(record)
    record["wet_lab_handoff"] = _wet_lab_handoff(record)

    markdown_path = root / "route_cards" / f"{chemical_id}.md"
    handoff_path = root / "handoffs" / f"{chemical_id}_wet_lab_handoff.json"
    _write_json(existing_path, record)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(_record_markdown(record), encoding="utf-8")
    _write_json(handoff_path, record["wet_lab_handoff"])
    _upsert_csv_row(
        root / "chemical_db_index.csv",
        {
            "chemical_id": chemical_id,
            "candidate_id": record.get("candidate_id"),
            "target": record.get("target"),
            "synthesis_status": record.get("synthesis_status"),
            "analytical_status": record.get("analytical_status"),
            "docking_gate": docking_gate["gate"],
            "wet_lab_ready": wet_lab_ready,
            "updated_at": record["updated_at"],
        },
        key="chemical_id",
    )
    record["route_card_url"] = _artifact_url(markdown_path)
    record["handoff_url"] = _artifact_url(handoff_path)
    return record


@router.get("/chemical-db")
def list_chemical_db(limit: int = 100) -> dict[str, Any]:
    rows = _load_chemical_records(limit=max(1, min(limit, 500)))
    return {
        "count": len(rows),
        "records": rows,
        "ready_for_wet_lab": sum(1 for row in rows if row.get("wet_lab_ready")),
        "claim_boundary": "Chemical DB is a research-use design, synthesis-planning, and wet-lab handoff registry.",
    }


@router.get("/chemical-db/{chemical_id}")
def get_chemical_record(chemical_id: str) -> dict[str, Any]:
    safe_id = _safe_slug(chemical_id, "chemical")
    path = _chemical_db_root() / "records" / f"{safe_id}.json"
    record = _read_json(path, {})
    if not record:
        raise HTTPException(status_code=404, detail="Chemical record not found.")
    markdown_path = _chemical_db_root() / "route_cards" / f"{safe_id}.md"
    handoff_path = _chemical_db_root() / "handoffs" / f"{safe_id}_wet_lab_handoff.json"
    record["route_card_url"] = _artifact_url(markdown_path) if markdown_path.exists() else None
    record["handoff_url"] = _artifact_url(handoff_path) if handoff_path.exists() else None
    return record


@router.post("/chemical-db/{chemical_id}/handoff")
def create_chemical_handoff(chemical_id: str) -> dict[str, Any]:
    record = get_chemical_record(chemical_id)
    handoff = _wet_lab_handoff(record)
    path = _chemical_db_root() / "handoffs" / f"{record['chemical_id']}_wet_lab_handoff.json"
    _write_json(path, handoff)
    return {
        **handoff,
        "handoff_url": _artifact_url(path),
        "wet_lab_ready": record.get("wet_lab_ready"),
    }


@router.get("/docking-tools")
def docking_tools() -> dict[str, Any]:
    manifest = _tool_manifest()
    return {
        "tools": manifest,
        "default_engine": "gnina" if manifest["gnina"]["available"] else "smina" if manifest["smina"]["available"] else "vina",
        "real_time_docking": any(manifest[name]["available"] for name in ["gnina", "vina", "smina"]),
        "requires_obabel_for_vina_smina": True,
        "claim_boundary": "Tool availability only. Docking outputs remain computational hypotheses until redocking, orthogonal scoring, and wet-lab validation.",
    }


@router.post("/realtime-dock")
@router.post("/gnina-dock")
def realtime_dock(payload: RealtimeDockRequest) -> dict[str, Any]:
    target = _safe_slug(payload.target.upper(), "CUSTOM")
    candidate_id = _safe_slug(payload.candidate_id or f"DESIGN_{target}_{hashlib.sha1(str(time.time_ns()).encode()).hexdigest()[:8]}", "DESIGN")
    tool_manifest = _tool_manifest()
    requested_engine = payload.engine
    engine = requested_engine
    if engine == "auto":
        engine = "gnina" if tool_manifest["gnina"]["available"] else "smina" if tool_manifest["smina"]["available"] else "vina"
    if not tool_manifest.get(engine, {}).get("available"):
        raise HTTPException(status_code=503, detail=f"{engine} is not available on Windows PATH or WSL PATH. Install the tool or choose another engine.")
    if engine in {"vina", "smina"} and not tool_manifest["obabel"]["available"]:
        raise HTTPException(status_code=503, detail="OpenBabel is required for Vina/Smina receptor and ligand PDBQT conversion.")

    out_dir = OUTPUT_DIR / "realtime_docking" / target / candidate_id
    out_dir.mkdir(parents=True, exist_ok=True)
    requested_receptor = (
        _path_from_url_or_path(payload.receptor_path)
        or _path_from_url_or_path(payload.receptor_url)
    )
    raw_receptor = _resolve_receptor_for_target(target, out_dir, requested_receptor)
    if not raw_receptor or not raw_receptor.exists():
        raise HTTPException(status_code=422, detail=f"Receptor structure was not found for target {target}.")
    receptor = clean_receptor_pdb(raw_receptor, out_dir / "prepared_receptors" / f"{raw_receptor.stem}_clean.pdb")
    pocket = resolve_pocket(target, receptor, default_box_size=30.0, registry_path=POCKETS_CONFIG)
    center = (
        (payload.box_center.x, payload.box_center.y, payload.box_center.z)
        if payload.box_center
        else tuple(float(value) for value in pocket["center"])
    )
    size_tuple = (
        (payload.box_size.x, payload.box_size.y, payload.box_size.z)
        if payload.box_size
        else tuple(float(value) for value in pocket["size"])
    )
    cubic_size = max(float(value) for value in size_tuple) if payload.box_size else effective_cubic_box_size(pocket)

    ligand = _path_from_url_or_path(payload.ligand_sdf_path) or _path_from_url_or_path(payload.ligand_sdf_url)
    canonical_smiles = payload.smiles or ""
    if not ligand or not ligand.exists():
        if not payload.smiles:
            raise HTTPException(status_code=422, detail="Provide either a ligand SDF artifact or a SMILES string for docking.")
        ligand = out_dir / f"{candidate_id}_generated.sdf"
        canonical_smiles = _generate_ligand_sdf(payload.smiles, ligand, center=center)
    elif Chem is not None and ligand.suffix.lower() == ".sdf":
        centered = out_dir / f"{candidate_id}_centered_input.sdf"
        ligand = _center_ligand_sdf(ligand, centered, center)
    ligand_metadata = _ligand_metadata_from_sdf(ligand) if ligand and ligand.exists() else {}
    if not canonical_smiles and ligand_metadata.get("canonical_smiles"):
        canonical_smiles = str(ligand_metadata["canonical_smiles"])

    log_path = out_dir / f"{candidate_id}_{engine}.log"
    started = time.time()
    raw: dict[str, Any] = {
        "target_id": target,
        "candidate_id": candidate_id,
        "canonical_smiles": canonical_smiles,
        "smiles": canonical_smiles,
        "requested_engine": requested_engine,
        "actual_engine_used": engine,
        "receptor_path": str(receptor),
        "receptor_url": _artifact_url(receptor),
        "ligand_sdf_path": str(ligand),
        "sdf_url": _artifact_url(ligand) if ligand.resolve().is_relative_to(OUTPUT_DIR.resolve()) else None,
        "pocket_source": pocket.get("source"),
        "pocket_pdb_id": pocket.get("pdb_id"),
        "reference_ligand": pocket.get("reference_ligand"),
        "pocket_method_tier": pocket.get("method_tier"),
        "pocket_provenance_note": pocket.get("provenance_note"),
        "box_center": {"x": center[0], "y": center[1], "z": center[2]},
        "box_size": {"x": size_tuple[0], "y": size_tuple[1], "z": size_tuple[2]},
        "docking_runtime_s": None,
        "claim_boundary": "Real docking engine output is computational evidence only; not measured binding, efficacy, safety, or clinical evidence.",
        **ligand_metadata,
    }

    if engine == "gnina":
        pose_path = out_dir / f"{candidate_id}_gnina.sdf"
        args = [
            "--no_gpu",
            "--cpu",
            str(payload.cpu),
            "--seed",
            "17",
            "--exhaustiveness",
            str(payload.exhaustiveness),
            "--num_modes",
            str(payload.num_modes),
            "-r",
            _tool_path_for("gnina", receptor),
            "-l",
            _tool_path_for("gnina", ligand),
            "--center_x",
            f"{center[0]:.3f}",
            "--center_y",
            f"{center[1]:.3f}",
            "--center_z",
            f"{center[2]:.3f}",
            "--size_x",
            str(cubic_size),
            "--size_y",
            str(cubic_size),
            "--size_z",
            str(cubic_size),
            "-o",
            _tool_path_for("gnina", pose_path),
        ]
        run = run_external("gnina", args, cwd=out_dir, timeout=1800, check=False)
        text = run.stdout + "\n" + run.stderr
        log_path.write_text(text, encoding="utf-8", errors="replace")
        raw.update(_parse_gnina_output(text))
        raw.update(
            {
                "gnina_status": "completed" if run.returncode == 0 and pose_path.exists() else "failed",
                "gnina_returncode": run.returncode,
                "gnina_pose_sdf_path": str(pose_path),
                "gnina_pose_sdf_url": _artifact_url(pose_path) if pose_path.exists() else None,
                "gnina_log_path": str(log_path),
                "gnina_log_url": _artifact_url(log_path),
                "gnina_receptor_url": _artifact_url(receptor),
                "gnina_mode": "gnina_cpu_curated_pocket" if str(pocket.get("method_tier")).upper() in {"REAL", "CURATED"} else "gnina_cpu_exploratory_blind_box",
                "gnina_center_x": center[0],
                "gnina_center_y": center[1],
                "gnina_center_z": center[2],
                "gnina_box_size": cubic_size,
                "gnina_box_size_x": size_tuple[0],
                "gnina_box_size_y": size_tuple[1],
                "gnina_box_size_z": size_tuple[2],
                "gnina_warnings": _parse_gnina_warnings(text),
                "gnina_output_excerpt": "\n".join(text.splitlines()[-30:]),
            }
        )
        if raw["gnina_status"] == "completed":
            _upsert_csv_row(OUTPUT_DIR / "gnina" / "results.csv", raw)
    else:
        receptor_pdbqt = out_dir / "prepared_receptors" / f"{receptor.stem}.pdbqt"
        if not receptor_pdbqt.exists():
            receptor_conversion = _run_obabel(receptor, receptor_pdbqt, "-xr", timeout=900)
            if receptor_conversion.returncode != 0 or not receptor_pdbqt.exists():
                raise HTTPException(status_code=502, detail=f"OpenBabel receptor conversion failed: {(receptor_conversion.stderr or receptor_conversion.stdout)[:700]}")
        ligand_pdbqt = out_dir / f"{candidate_id}.pdbqt"
        if not ligand_pdbqt.exists():
            ligand_conversion = _run_obabel(ligand, ligand_pdbqt, timeout=600)
            if ligand_conversion.returncode != 0 or not ligand_pdbqt.exists():
                raise HTTPException(status_code=502, detail=f"OpenBabel ligand conversion failed: {(ligand_conversion.stderr or ligand_conversion.stdout)[:700]}")
        out_pose = out_dir / f"{candidate_id}_{engine}.pdbqt"
        if engine == "vina":
            args = [
                "--receptor",
                _tool_path_for(engine, receptor_pdbqt),
                "--ligand",
                _tool_path_for(engine, ligand_pdbqt),
                "--center_x",
                f"{center[0]:.3f}",
                "--center_y",
                f"{center[1]:.3f}",
                "--center_z",
                f"{center[2]:.3f}",
                "--size_x",
                str(size_tuple[0]),
                "--size_y",
                str(size_tuple[1]),
                "--size_z",
                str(size_tuple[2]),
                "--exhaustiveness",
                str(payload.exhaustiveness),
                "--num_modes",
                str(payload.num_modes),
                "--cpu",
                str(payload.cpu),
                "--out",
                _tool_path_for(engine, out_pose),
            ]
        else:
            args = [
                "-r",
                _tool_path_for(engine, receptor_pdbqt),
                "-l",
                _tool_path_for(engine, ligand_pdbqt),
                "--center_x",
                f"{center[0]:.3f}",
                "--center_y",
                f"{center[1]:.3f}",
                "--center_z",
                f"{center[2]:.3f}",
                "--size_x",
                str(size_tuple[0]),
                "--size_y",
                str(size_tuple[1]),
                "--size_z",
                str(size_tuple[2]),
                "--exhaustiveness",
                str(payload.exhaustiveness),
                "--num_modes",
                str(payload.num_modes),
                "--cpu",
                str(payload.cpu),
                "-o",
                _tool_path_for(engine, out_pose),
            ]
        run = run_external(engine, args, cwd=out_dir, timeout=1800, check=False)
        text = run.stdout + "\n" + run.stderr
        log_path.write_text(text, encoding="utf-8", errors="replace")
        docked_sdf = out_dir / f"{candidate_id}_{engine}.sdf"
        if out_pose.exists():
            _convert_pose_to_sdf(out_pose, docked_sdf)
        affinity = parse_affinity_text(text)
        engine_fields = {
            f"{engine}_status": "completed" if run.returncode == 0 and out_pose.exists() else "failed",
            f"{engine}_returncode": run.returncode,
            f"{engine}_affinity_kcal_mol": affinity,
            f"{engine}_docked_sdf_path": str(docked_sdf) if docked_sdf.exists() else None,
            f"{engine}_docked_sdf_url": _artifact_url(docked_sdf) if docked_sdf.exists() else None,
            f"{engine}_log_path": str(log_path),
            f"{engine}_log_url": _artifact_url(log_path),
            f"{engine}_receptor_url": _artifact_url(receptor),
            f"{engine}_output_excerpt": "\n".join(text.splitlines()[-30:]),
        }
        raw.update(
            {
                "docking_status": "completed" if run.returncode == 0 and out_pose.exists() else "failed",
                "docking_mode": f"{engine}_real_curated_pocket" if str(pocket.get("method_tier")).upper() in {"REAL", "CURATED"} else f"{engine}_real_exploratory",
                "docking_is_real": run.returncode == 0 and out_pose.exists(),
                "affinity_kcal_mol": affinity,
                "vina_affinity_kcal_mol": affinity if engine == "vina" else None,
                "smina_affinity_kcal_mol": affinity if engine == "smina" else None,
                "docked_sdf_path": str(docked_sdf) if docked_sdf.exists() else None,
                "docked_sdf_url": _artifact_url(docked_sdf) if docked_sdf.exists() else None,
                "vina_pose_pdbqt_path": str(out_pose) if engine == "vina" else None,
                "smina_pose_pdbqt_path": str(out_pose) if engine == "smina" else None,
                "vina_pose_pdbqt_url": _artifact_url(out_pose) if engine == "vina" and out_pose.exists() else None,
                "smina_pose_pdbqt_url": _artifact_url(out_pose) if engine == "smina" and out_pose.exists() else None,
                "docking_log_path": str(log_path),
                "docking_log_url": _artifact_url(log_path),
                "docking_output_excerpt": "\n".join(text.splitlines()[-30:]),
                **engine_fields,
            }
        )
        if raw["docking_status"] == "completed":
            _upsert_csv_row(OUTPUT_DIR / "docking" / "results.csv", raw)

    raw["docking_runtime_s"] = round(time.time() - started, 2)
    raw["pose_sources"] = _pose_sources_from_docking(raw)
    raw["default_pose_source"] = "gnina" if any(source["id"] == "gnina" for source in raw["pose_sources"]) else raw["pose_sources"][0]["id"] if raw["pose_sources"] else None
    return {
        "status": raw.get("gnina_status") or raw.get("docking_status") or "completed",
        "candidate_id": candidate_id,
        "target": target,
        "engine": engine,
        "tool_manifest": tool_manifest,
        "raw": raw,
    }


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
    receptor = _resolve_receptor_for_target(target, out_dir)
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
        "receptor_url": _receptor_url(receptor),
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
                "receptor_url": _receptor_url(receptor),
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
