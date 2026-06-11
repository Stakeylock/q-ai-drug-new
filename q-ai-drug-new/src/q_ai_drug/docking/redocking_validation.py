from __future__ import annotations

import argparse
import math
import subprocess
import time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from q_ai_drug.docking.pockets import clean_receptor_pdb, effective_cubic_box_size, load_pocket_registry
from q_ai_drug.tools.external import resolve_tool, run_external, windows_to_wsl_path

try:
    from rdkit import Chem
    from rdkit.Chem import rdMolAlign
except Exception:
    Chem = None
    rdMolAlign = None


def _tool_path(tool_name: str, path: Path) -> str:
    tool = resolve_tool(tool_name)
    return windows_to_wsl_path(path) if tool.via_wsl else str(path.resolve())


def _run_obabel(input_path: Path, output_path: Path, *extra: str, timeout: int = 600) -> subprocess.CompletedProcess[str]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return run_external(
        "obabel",
        [_tool_path("obabel", input_path), f"-o{output_path.suffix.lstrip('.')}", "-O", _tool_path("obabel", output_path), *extra],
        cwd=output_path.parent,
        timeout=timeout,
        check=False,
    )


def _extract_ligand(pdb_path: Path, out_path: Path, pocket: dict[str, Any]) -> bool:
    code = str(pocket.get("reference_ligand_code") or "").strip()
    chain = str(pocket.get("reference_ligand_chain") or "").strip()
    resseq = str(pocket.get("reference_ligand_resseq") or "").strip()
    if not code:
        return False
    lines = []
    for line in pdb_path.read_text(errors="ignore").splitlines():
        if not line.startswith("HETATM"):
            continue
        if line[17:20].strip() != code:
            continue
        if chain and line[21].strip() != chain:
            continue
        if resseq and line[22:26].strip() != resseq:
            continue
        lines.append(line)
    if not lines:
        return False
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines + ["END"]) + "\n", encoding="utf-8")
    return True


def _first_mol(path: Path):
    if Chem is None or not path.exists():
        return None
    supplier = Chem.SDMolSupplier(str(path), removeHs=False, sanitize=False)
    return next((mol for mol in supplier if mol is not None and mol.GetNumConformers() > 0), None)


def _mols(path: Path) -> list[Any]:
    if Chem is None or not path.exists():
        return []
    supplier = Chem.SDMolSupplier(str(path), removeHs=False, sanitize=False)
    return [mol for mol in supplier if mol is not None and mol.GetNumConformers() > 0]


def _coordinate_rmsd(ref: Any, docked: Any) -> float | None:
    if ref is None or docked is None:
        return None
    ref_conf = ref.GetConformer()
    docked_conf = docked.GetConformer()
    ref_indices = [idx for idx, atom in enumerate(ref.GetAtoms()) if atom.GetSymbol() != "H"]
    docked_indices = [idx for idx, atom in enumerate(docked.GetAtoms()) if atom.GetSymbol() != "H"]
    if len(ref_indices) == len(docked_indices):
        pairs = zip(ref_indices, docked_indices)
    elif ref.GetNumAtoms() == docked.GetNumAtoms():
        pairs = zip(range(ref.GetNumAtoms()), range(docked.GetNumAtoms()))
    else:
        return None
    diffs = []
    for ref_idx, docked_idx in pairs:
        a = ref_conf.GetAtomPosition(ref_idx)
        b = docked_conf.GetAtomPosition(docked_idx)
        diffs.append((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
    return math.sqrt(float(np.mean(diffs))) if diffs else None


def _rdkit_best_rmsd(reference_sdf: Path, docked_sdf: Path) -> float | None:
    if Chem is None or rdMolAlign is None:
        return None
    refs = _mols(reference_sdf)
    docked_mols = _mols(docked_sdf)
    if not refs or not docked_mols:
        return None
    ref = Chem.RemoveHs(refs[0], sanitize=False)
    values: list[float] = []
    for docked in docked_mols:
        try:
            value = rdMolAlign.GetBestRMS(ref, Chem.RemoveHs(docked, sanitize=False))
            if math.isfinite(value):
                values.append(float(value))
        except Exception:
            continue
    return min(values) if values else None


def _obrms_rmsd(reference_sdf: Path, docked_sdf: Path) -> float | None:
    obrms = resolve_tool("obrms")
    if obrms.available:
        result = run_external(
            "obrms",
            [_tool_path("obrms", reference_sdf), _tool_path("obrms", docked_sdf)],
            cwd=docked_sdf.parent,
            timeout=120,
            check=False,
        )
        if result.returncode == 0:
            tokens = (result.stdout + " " + result.stderr).replace("\n", " ").split()
            for token in reversed(tokens):
                try:
                    return float(token)
                except ValueError:
                    continue
    return None


def _rmsd(reference_sdf: Path, docked_sdf: Path) -> float | None:
    rdkit_rmsd = _rdkit_best_rmsd(reference_sdf, docked_sdf)
    if rdkit_rmsd is not None:
        return rdkit_rmsd
    obrms_rmsd = _obrms_rmsd(reference_sdf, docked_sdf)
    if obrms_rmsd is not None:
        return obrms_rmsd
    ref = _first_mol(reference_sdf)
    docked = _first_mol(docked_sdf)
    if ref is None or docked is None:
        return None
    return _coordinate_rmsd(ref, docked)


def _parse_gnina_table(text: str) -> dict[str, float | None]:
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0] == "1":
            try:
                return {
                    "gnina_redocking_affinity_kcal_mol": float(parts[1]),
                    "gnina_redocking_intramol_kcal_mol": float(parts[2]),
                    "gnina_redocking_cnn_pose_score": float(parts[3]),
                    "gnina_redocking_cnn_affinity": float(parts[4]),
                }
            except ValueError:
                return {}
    return {}


def _run_gnina_redocking(
    *,
    target_id: str,
    receptor_pdb: Path,
    ligand_sdf: Path,
    out_dir: Path,
    center: tuple[float, float, float],
    size: float,
    exhaustiveness: int,
    cpu: int,
) -> dict[str, Any]:
    if not resolve_tool("gnina").available:
        return {"gnina_redocking_status": "gnina_unavailable"}
    docked_sdf = out_dir / f"{target_id}_redocked_gnina.sdf"
    log_path = out_dir / f"{target_id}_redocking_gnina.log"
    args = [
        "--no_gpu",
        "--cpu",
        str(cpu),
        "--seed",
        "17",
        "--exhaustiveness",
        str(exhaustiveness),
        "--num_modes",
        "5",
        "-r",
        _tool_path("gnina", receptor_pdb),
        "-l",
        _tool_path("gnina", ligand_sdf),
        "--center_x",
        f"{center[0]:.3f}",
        "--center_y",
        f"{center[1]:.3f}",
        "--center_z",
        f"{center[2]:.3f}",
        "--size_x",
        str(size),
        "--size_y",
        str(size),
        "--size_z",
        str(size),
        "-o",
        _tool_path("gnina", docked_sdf),
    ]
    run = run_external("gnina", args, cwd=out_dir, timeout=1200, check=False)
    text = run.stdout + "\n" + run.stderr
    log_path.write_text(text, encoding="utf-8", errors="replace")
    if run.returncode != 0 or not docked_sdf.exists():
        return {
            "gnina_redocking_status": "failed_gnina",
            "gnina_redocking_error": run.stderr or run.stdout,
            "gnina_redocking_returncode": run.returncode,
            "gnina_redocking_log": str(log_path),
        }
    rmsd = _rmsd(ligand_sdf, docked_sdf)
    metrics = _parse_gnina_table(text)
    return {
        "gnina_redocking_status": "completed" if rmsd is not None else "completed_without_rmsd",
        "gnina_redocking_rmsd_angstrom": round(rmsd, 3) if rmsd is not None else None,
        "gnina_redocking_pose_sdf": str(docked_sdf),
        "gnina_redocking_log": str(log_path),
        "gnina_redocking_returncode": run.returncode,
        **metrics,
    }


def _run_redocking(target_id: str, pocket: dict[str, Any], project_dir: Path, structures_dir: Path, *, exhaustiveness: int, cpu: int) -> dict[str, Any]:
    pdb_id = pocket.get("pdb_id")
    if not pdb_id:
        return {"redocking_status": "missing_pdb_id"}
    source_pdb = structures_dir / f"{pdb_id}.pdb"
    if not source_pdb.exists():
        return {"redocking_status": "missing_source_pdb", "redocking_error": str(source_pdb)}
    out_dir = project_dir / "docking" / "redocking" / target_id
    ligand_pdb = out_dir / f"{target_id}_{pocket.get('reference_ligand_code', 'ligand')}.pdb"
    if not _extract_ligand(source_pdb, ligand_pdb, pocket):
        return {"redocking_status": "missing_reference_ligand_coordinates", "redocking_error": "Could not extract requested HETATM ligand."}
    receptor_pdb = clean_receptor_pdb(source_pdb, out_dir / f"{pdb_id}_clean.pdb")
    receptor_pdbqt = out_dir / f"{pdb_id}_clean.pdbqt"
    ligand_sdf = out_dir / f"{target_id}_reference.sdf"
    ligand_pdbqt = out_dir / f"{target_id}_reference.pdbqt"
    docked_pdbqt = out_dir / f"{target_id}_redocked.pdbqt"
    docked_sdf = out_dir / f"{target_id}_redocked.sdf"
    started = time.time()
    for result, name in [
        (_run_obabel(receptor_pdb, receptor_pdbqt, "-xr", timeout=600), "receptor_pdbqt"),
        (_run_obabel(ligand_pdb, ligand_sdf, "-h", timeout=600), "ligand_sdf"),
    ]:
        if result.returncode != 0:
            return {"redocking_status": "failed_prepare", "redocking_error": f"{name}: {result.stderr or result.stdout}"}
    result = _run_obabel(ligand_sdf, ligand_pdbqt, timeout=600)
    if result.returncode != 0:
        return {"redocking_status": "failed_prepare", "redocking_error": result.stderr or result.stdout}
    center = (float(pocket["center_x"]), float(pocket["center_y"]), float(pocket["center_z"]))
    size = effective_cubic_box_size(
        {
            "size": (
                float(pocket.get("size_x", 24.0)),
                float(pocket.get("size_y", 24.0)),
                float(pocket.get("size_z", 24.0)),
            )
        }
    )
    args = [
        "--receptor",
        _tool_path("vina", receptor_pdbqt),
        "--ligand",
        _tool_path("vina", ligand_pdbqt),
        "--center_x",
        f"{center[0]:.3f}",
        "--center_y",
        f"{center[1]:.3f}",
        "--center_z",
        f"{center[2]:.3f}",
        "--size_x",
        str(size),
        "--size_y",
        str(size),
        "--size_z",
        str(size),
        "--exhaustiveness",
        str(exhaustiveness),
        "--num_modes",
        "5",
        "--cpu",
        str(cpu),
        "--out",
        _tool_path("vina", docked_pdbqt),
    ]
    run = run_external("vina", args, cwd=out_dir, timeout=1200, check=False)
    (out_dir / f"{target_id}_redocking_vina.log").write_text(run.stdout + "\n" + run.stderr, encoding="utf-8", errors="replace")
    if run.returncode != 0 or not docked_pdbqt.exists():
        return {"redocking_status": "failed_vina", "redocking_error": run.stderr or run.stdout}
    _run_obabel(docked_pdbqt, docked_sdf, timeout=300)
    vina_rmsd = _rmsd(ligand_sdf, docked_sdf)
    gnina = _run_gnina_redocking(
        target_id=target_id,
        receptor_pdb=receptor_pdb,
        ligand_sdf=ligand_sdf,
        out_dir=out_dir,
        center=center,
        size=size,
        exhaustiveness=max(1, min(exhaustiveness, 4)),
        cpu=cpu,
    )
    engine_rmsds = {
        "vina": vina_rmsd,
        "gnina": gnina.get("gnina_redocking_rmsd_angstrom"),
    }
    finite_rmsds = {engine: float(value) for engine, value in engine_rmsds.items() if value is not None and math.isfinite(float(value))}
    best_engine = min(finite_rmsds, key=finite_rmsds.get) if finite_rmsds else None
    rmsd = finite_rmsds[best_engine] if best_engine else None
    return {
        "redocking_status": "completed" if rmsd is not None else "completed_without_rmsd",
        "redocking_rmsd_angstrom": round(rmsd, 3) if rmsd is not None else None,
        "redocking_best_engine": best_engine,
        "vina_redocking_rmsd_angstrom": round(vina_rmsd, 3) if vina_rmsd is not None else None,
        "vina_redocking_pose_sdf": str(docked_sdf),
        "vina_redocking_log": str(out_dir / f"{target_id}_redocking_vina.log"),
        "redocking_runtime_s": round(time.time() - started, 2),
        "redocking_reference_sdf": str(ligand_sdf),
        "redocking_pose_sdf": str(gnina.get("gnina_redocking_pose_sdf") or docked_sdf),
        "redocking_log": str(gnina.get("gnina_redocking_log") or out_dir / f"{target_id}_redocking_vina.log"),
        **gnina,
    }


def build_redocking_validation(
    *,
    project_dir: str | Path = "outputs/cancer_proof_v1",
    pockets_config: str | Path = "configs/oncology_pockets.yaml",
    structures_dir: str | Path = "data/structures",
    run_docking: bool = True,
    exhaustiveness: int = 4,
    cpu: int = 4,
) -> pd.DataFrame:
    project_dir = Path(project_dir)
    out_path = project_dir / "docking" / "redocking_validation.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    registry = load_pocket_registry(pockets_config)
    rows: list[dict[str, Any]] = []
    default_result_fields: dict[str, Any] = {
        "redocking_best_engine": None,
        "vina_redocking_rmsd_angstrom": None,
        "gnina_redocking_rmsd_angstrom": None,
        "redocking_reference_sdf": None,
        "redocking_pose_sdf": None,
        "redocking_log": None,
        "vina_redocking_pose_sdf": None,
        "vina_redocking_log": None,
        "gnina_redocking_status": None,
        "gnina_redocking_pose_sdf": None,
        "gnina_redocking_log": None,
    }
    for target_id, pocket in sorted(registry.items()):
        method_tier = str(pocket.get("method_tier", "EXPLORATORY")).upper()
        has_reference = bool(pocket.get("pdb_id") and pocket.get("reference_ligand_code"))
        status = "reference_ligand_coordinates_available" if has_reference else "missing_reference_structure"
        result = {}
        if method_tier == "EXPLORATORY":
            status = "blocked_exploratory_pocket"
        elif run_docking and has_reference:
            result = _run_redocking(target_id, pocket, project_dir, Path(structures_dir), exhaustiveness=exhaustiveness, cpu=cpu)
            status = result.get("redocking_status", status)
        row = {
                "target_id": target_id,
                "pdb_id": pocket.get("pdb_id"),
                "reference_ligand": pocket.get("reference_ligand"),
                "reference_ligand_code": pocket.get("reference_ligand_code"),
                "pocket_source": pocket.get("source"),
                "pocket_method_tier": method_tier,
                "center_x": pocket.get("center_x"),
                "center_y": pocket.get("center_y"),
                "center_z": pocket.get("center_z"),
                "size_x": pocket.get("size_x"),
                "size_y": pocket.get("size_y"),
                "size_z": pocket.get("size_z"),
                "redocking_status": status,
                "redocking_rmsd_angstrom": result.get("redocking_rmsd_angstrom"),
                "provenance_note": pocket.get("provenance_note"),
            }
        row.update(default_result_fields)
        row.update(result)
        rows.append(row)
    result = pd.DataFrame(rows)
    result.to_csv(out_path, index=False)
    return result


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Write redocking validation registry from oncology pocket metadata.")
    parser.add_argument("--project", default="outputs/cancer_proof_v1")
    parser.add_argument("--pockets", default="configs/oncology_pockets.yaml")
    parser.add_argument("--structures", default="data/structures")
    parser.add_argument("--no-docking", action="store_true")
    parser.add_argument("--exhaustiveness", type=int, default=4)
    parser.add_argument("--cpu", type=int, default=4)
    args = parser.parse_args(argv)
    result = build_redocking_validation(
        project_dir=args.project,
        pockets_config=args.pockets,
        structures_dir=args.structures,
        run_docking=not args.no_docking,
        exhaustiveness=args.exhaustiveness,
        cpu=args.cpu,
    )
    print(f"Wrote {len(result)} redocking validation rows to {Path(args.project) / 'docking' / 'redocking_validation.csv'}")


if __name__ == "__main__":
    main()
