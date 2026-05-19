from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from q_ai_drug.config import load_config
from q_ai_drug.docking.pockets import clean_receptor_pdb, effective_cubic_box_size, registered_receptor_path, resolve_pocket
from q_ai_drug.features.descriptors import append_descriptors
from q_ai_drug.tools.external import resolve_tool, run_external, windows_to_wsl_path

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
except Exception:
    Chem = None
    AllChem = None


def vina_available() -> bool:
    return resolve_tool("vina").available or resolve_tool("smina").available


def parse_vina_log(text: str) -> list[dict[str, float]]:
    rows = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 4 and parts[0].isdigit():
            try:
                rows.append(
                    {
                        "mode": int(parts[0]),
                        "affinity_kcal_mol": float(parts[1]),
                        "dist_from_best_lb": float(parts[2]),
                        "dist_from_best_ub": float(parts[3]),
                    }
                )
            except ValueError:
                continue
    return rows


def parse_affinity_text(text: str) -> float | None:
    rows = parse_vina_log(text)
    if rows:
        return rows[0]["affinity_kcal_mol"]
    for line in text.splitlines():
        if line.strip().startswith("Affinity:"):
            parts = line.replace(":", " ").split()
            for part in parts[1:]:
                try:
                    return float(part)
                except ValueError:
                    continue
    return None


def _noise(*parts: str) -> float:
    raw = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:8]
    return (int(raw, 16) % 1000) / 1000.0


def proxy_docking_score(row: pd.Series) -> float:
    qed = float(row.get("QED", 0.5))
    logp = float(row.get("LogP", 2.5))
    mw = float(row.get("MW", 350.0))
    activity = float(row.get("activity_score", 0.5))
    penalty = max(0.0, abs(logp - 3.0) - 1.75) * 0.25 + max(0.0, mw - 550.0) / 250.0
    jitter = _noise(str(row.get("target_id")), str(row.get("canonical_smiles") or row.get("smiles"))) - 0.5
    return round(-5.5 - 2.2 * qed - 2.0 * activity - penalty + jitter, 2)


def _receptor_centroid(path: Path) -> tuple[float, float, float]:
    coords = []
    for line in path.read_text(errors="ignore").splitlines():
        if line.startswith(("ATOM", "HETATM")):
            try:
                coords.append((float(line[30:38]), float(line[38:46]), float(line[46:54])))
            except ValueError:
                continue
    if not coords:
        return 0.0, 0.0, 0.0
    return tuple(sum(values) / len(values) for values in zip(*coords))


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


def _append_status(out_dir: Path, event: str, **payload: Any) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "run_log.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"time": time.strftime("%Y-%m-%dT%H:%M:%S"), "event": event, **payload}, default=str) + "\n")


def run_proxy_docking(candidates_csv: str | Path, out_dir: str | Path, top_per_target: int = 100) -> pd.DataFrame:
    candidates = pd.read_csv(candidates_csv)
    if "canonical_smiles" not in candidates.columns:
        candidates["canonical_smiles"] = candidates["smiles"]
    candidates = append_descriptors(candidates, "canonical_smiles")
    score_columns = ["target_id"]
    if "activity_score" in candidates.columns:
        score_columns.append("activity_score")
    score_columns.append("admet_score" if "admet_score" in candidates.columns else "QED")
    if "quantum_prefilter_score" in candidates.columns:
        score_columns.append("quantum_prefilter_score")
    candidates = candidates.sort_values(score_columns, ascending=[True] + [False] * (len(score_columns) - 1))
    selected = candidates.groupby("target_id", group_keys=False).head(top_per_target).copy()
    selected["affinity_kcal_mol"] = selected.apply(proxy_docking_score, axis=1)
    selected["binding_class"] = np.where(
        selected["affinity_kcal_mol"] <= -8.0,
        "strong",
        np.where(selected["affinity_kcal_mol"] <= -7.0, "moderate", "weak"),
    )
    selected["docking_mode"] = "proxy_descriptor_score"
    selected["docking_is_real"] = False
    selected["docking_note"] = "Install AutoDock Vina/Smina and prepared PDBQT files for real docking."
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    selected.to_csv(out_dir / "results.csv", index=False)
    selected.sort_values(["target_id", "affinity_kcal_mol"]).groupby("target_id", group_keys=False).head(10).to_csv(
        out_dir / "top10.csv", index=False
    )
    return selected


def _asset_lookup(assets_csv: str | Path | None) -> pd.DataFrame:
    if not assets_csv:
        return pd.DataFrame(columns=["candidate_id", "sdf_path", "png_path", "smi_path"])
    path = Path(assets_csv)
    if not path.exists():
        return pd.DataFrame(columns=["candidate_id", "sdf_path", "png_path", "smi_path"])
    assets = pd.read_csv(path)
    keep = [column for column in ["candidate_id", "sdf_path", "png_path", "smi_path"] if column in assets.columns]
    return assets[keep].drop_duplicates("candidate_id")


def _select_candidates(candidates_csv: str | Path, top_per_target: int, assets_csv: str | Path | None = None) -> pd.DataFrame:
    candidates = pd.read_csv(candidates_csv)
    if "canonical_smiles" not in candidates.columns:
        candidates["canonical_smiles"] = candidates["smiles"]
    candidates = append_descriptors(candidates, "canonical_smiles")
    score_columns = ["target_id"]
    if "activity_score" in candidates.columns:
        score_columns.append("activity_score")
    score_columns.append("admet_score" if "admet_score" in candidates.columns else "QED")
    if "quantum_prefilter_score" in candidates.columns:
        score_columns.append("quantum_prefilter_score")
    selected = candidates.sort_values(score_columns, ascending=[True] + [False] * (len(score_columns) - 1))
    selected = selected.groupby("target_id", group_keys=False).head(top_per_target).copy()
    assets = _asset_lookup(assets_csv)
    if not assets.empty:
        selected = selected.merge(assets, on="candidate_id", how="left", suffixes=("", "_asset"))
    return selected


def _prepare_receptor(
    target_id: str,
    structures_dir: Path,
    out_dir: Path,
    *,
    pockets_config: str | Path = "configs/oncology_pockets.yaml",
) -> tuple[Path, Path, tuple[float, float, float], str]:
    raw_receptor = registered_receptor_path(target_id, structures_dir, registry_path=pockets_config)
    receptor = clean_receptor_pdb(raw_receptor, out_dir / "prepared_receptors" / f"{raw_receptor.stem}_clean.pdb")
    receptor_pdbqt = out_dir / "prepared_receptors" / f"{raw_receptor.stem}_clean.pdbqt"
    if not raw_receptor.exists():
        raise FileNotFoundError(f"Missing receptor PDB: {raw_receptor}")
    if not receptor_pdbqt.exists():
        result = _run_obabel(receptor, receptor_pdbqt, "-xr", timeout=900)
        if result.returncode != 0 or not receptor_pdbqt.exists():
            raise RuntimeError(f"OpenBabel receptor conversion failed for {target_id}:\n{result.stdout}\n{result.stderr}")
    return receptor, receptor_pdbqt, _receptor_centroid(receptor), str(receptor_pdbqt)


def _write_ligand_sdf_from_smiles(row: dict[str, Any], pose_dir: Path) -> Path:
    if Chem is None or AllChem is None:
        raise RuntimeError("RDKit is required to generate missing ligand SDF assets on demand.")
    candidate_id = str(row["candidate_id"])
    smiles = str(row.get("canonical_smiles") or row.get("smiles") or "")
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise RuntimeError(f"Could not parse SMILES for {candidate_id}: {smiles}")
    mol = Chem.AddHs(mol)
    status = AllChem.EmbedMolecule(mol, randomSeed=17)
    if status != 0:
        status = AllChem.EmbedMolecule(mol, randomSeed=17, useRandomCoords=True)
    if status != 0:
        raise RuntimeError(f"Could not embed 3D conformer for {candidate_id}.")
    props = AllChem.MMFFGetMoleculeProperties(mol)
    if props is not None:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=200)
    else:
        AllChem.UFFOptimizeMolecule(mol, maxIters=200)
    sdf_path = pose_dir / f"{candidate_id}_generated.sdf"
    writer = Chem.SDWriter(str(sdf_path))
    writer.write(mol)
    writer.close()
    return sdf_path


def _prepare_ligand(row: dict[str, Any], pose_dir: Path) -> tuple[Path, Path]:
    candidate_id = str(row["candidate_id"])
    raw_sdf = row.get("sdf_path")
    if raw_sdf is None or pd.isna(raw_sdf):
        raw_sdf = row.get("sdf_path_asset")
    sdf_path = Path(str(raw_sdf)) if raw_sdf is not None and not pd.isna(raw_sdf) else pose_dir / f"{candidate_id}_generated.sdf"
    if not sdf_path.exists():
        sdf_path = _write_ligand_sdf_from_smiles(row, pose_dir)
    ligand_pdbqt = pose_dir / f"{candidate_id}.pdbqt"
    if not ligand_pdbqt.exists():
        result = _run_obabel(sdf_path, ligand_pdbqt, timeout=600)
        if result.returncode != 0 or not ligand_pdbqt.exists():
            raise RuntimeError(f"OpenBabel ligand conversion failed for {candidate_id}:\n{result.stdout}\n{result.stderr}")
    return sdf_path, ligand_pdbqt


def _dock_with_vina(
    tool_name: str,
    receptor_pdbqt: Path,
    ligand_pdbqt: Path,
    out_pose: Path,
    center: tuple[float, float, float],
    *,
    box_size: float,
    exhaustiveness: int,
    num_modes: int,
    cpu: int,
    timeout: int,
) -> tuple[subprocess.CompletedProcess[str], float | None]:
    if tool_name == "vina":
        args = [
            "--receptor",
            _tool_path(tool_name, receptor_pdbqt),
            "--ligand",
            _tool_path(tool_name, ligand_pdbqt),
        ]
        out_flag = "--out"
    else:
        args = [
            "-r",
            _tool_path(tool_name, receptor_pdbqt),
            "-l",
            _tool_path(tool_name, ligand_pdbqt),
        ]
        out_flag = "-o"
    args += [
        "--center_x",
        f"{center[0]:.3f}",
        "--center_y",
        f"{center[1]:.3f}",
        "--center_z",
        f"{center[2]:.3f}",
        "--size_x",
        str(box_size),
        "--size_y",
        str(box_size),
        "--size_z",
        str(box_size),
        "--exhaustiveness",
        str(exhaustiveness),
        "--num_modes",
        str(num_modes),
        "--cpu",
        str(cpu),
        out_flag,
        _tool_path(tool_name, out_pose),
    ]
    result = run_external(tool_name, args, cwd=out_pose.parent, timeout=timeout, check=False)
    text = result.stdout + "\n" + result.stderr
    best = parse_affinity_text(text)
    return result, best


def _smina_minimize(
    receptor_pdbqt: Path,
    ligand_pdbqt: Path,
    out_pose: Path,
    center: tuple[float, float, float],
    *,
    box_size: float,
    timeout: int,
) -> tuple[subprocess.CompletedProcess[str], float | None]:
    args = [
        "-r",
        _tool_path("smina", receptor_pdbqt),
        "-l",
        _tool_path("smina", ligand_pdbqt),
        "--minimize",
        "--center_x",
        f"{center[0]:.3f}",
        "--center_y",
        f"{center[1]:.3f}",
        "--center_z",
        f"{center[2]:.3f}",
        "--size_x",
        str(box_size),
        "--size_y",
        str(box_size),
        "--size_z",
        str(box_size),
        "-o",
        _tool_path("smina", out_pose),
    ]
    result = run_external("smina", args, cwd=out_pose.parent, timeout=timeout, check=False)
    return result, parse_affinity_text(result.stdout + "\n" + result.stderr)


def run_real_docking(
    candidates_csv: str | Path,
    out_dir: str | Path,
    *,
    assets_csv: str | Path | None = None,
    structures_dir: str | Path = "data/structures",
    top_per_target: int = 100,
    box_size: float = 30.0,
    pockets_config: str | Path = "configs/oncology_pockets.yaml",
    exhaustiveness: int = 1,
    num_modes: int = 3,
    cpu: int = 4,
    timeout: int = 60,
    smina_strategy: str = "minimize",
) -> pd.DataFrame:
    required = ["obabel", "vina", "smina"]
    missing = [name for name in required if not resolve_tool(name).available]
    if missing:
        raise FileNotFoundError(f"Missing required production docking tools: {missing}")

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / "run_log.jsonl"
    if log_path.exists():
        log_path.unlink()

    selected = _select_candidates(candidates_csv, top_per_target, assets_csv=assets_csv)
    structures_dir = Path(structures_dir)
    receptors: dict[str, tuple[Path, Path, tuple[float, float, float], str]] = {}
    rows: list[dict[str, Any]] = []
    status_path = out_dir / "status.json"
    status_path.write_text(json.dumps({"status": "running", "total": int(len(selected)), "completed": 0, "failed": 0}, indent=2), encoding="utf-8")

    for index, row in enumerate(selected.to_dict("records"), start=1):
        target_id = str(row["target_id"])
        candidate_id = str(row["candidate_id"])
        pose_dir = out_dir / "poses" / target_id / candidate_id
        pose_dir.mkdir(parents=True, exist_ok=True)
        started = time.time()
        result_row = dict(row)
        result_row.update(
            {
                "docking_mode": "vina_smina_real_pending_pocket_resolution",
                "docking_is_real": True,
                "docking_note": "Real AutoDock Vina global docking plus Smina local minimization/rescoring.",
                "docking_box_size": box_size,
                "docking_exhaustiveness": exhaustiveness,
                "docking_num_modes": num_modes,
            }
        )
        _append_status(out_dir, "started_candidate", target_id=target_id, candidate_id=candidate_id, index=index, total=int(len(selected)))
        try:
            if target_id not in receptors:
                receptors[target_id] = _prepare_receptor(target_id, structures_dir, out_dir, pockets_config=pockets_config)
            receptor, receptor_pdbqt, _centroid, receptor_pdbqt_path = receptors[target_id]
            pocket = resolve_pocket(target_id, receptor, default_box_size=box_size, registry_path=pockets_config)
            center = pocket["center"]
            effective_box_size = effective_cubic_box_size(pocket)
            pocket_tier = str(pocket["method_tier"]).upper()
            result_row.update(
                {
                    "docking_mode": (
                        "vina_smina_real_curated_pocket"
                        if pocket_tier in {"REAL", "CURATED"}
                        else "vina_smina_real_exploratory_blind_box"
                    ),
                    "docking_note": (
                        "Real AutoDock Vina global docking plus Smina local minimization/rescoring. "
                        + str(pocket.get("provenance_note") or "")
                    ).strip(),
                    "docking_box_size": effective_box_size,
                    "pocket_source": pocket.get("source"),
                    "pocket_pdb_id": pocket.get("pdb_id"),
                    "reference_ligand": pocket.get("reference_ligand"),
                    "pocket_method_tier": pocket_tier,
                    "pocket_provenance_note": pocket.get("provenance_note"),
                }
            )
            ligand_sdf, ligand_pdbqt = _prepare_ligand(row, pose_dir)
            vina_pose = pose_dir / f"{candidate_id}_vina.pdbqt"
            smina_pose = pose_dir / f"{candidate_id}_smina.pdbqt"
            vina_run, vina_affinity = _dock_with_vina(
                "vina",
                receptor_pdbqt,
                ligand_pdbqt,
                vina_pose,
                center,
                box_size=effective_box_size,
                exhaustiveness=exhaustiveness,
                num_modes=num_modes,
                cpu=cpu,
                timeout=timeout,
            )
            smina_mode = "dock"
            if smina_strategy == "dock":
                smina_run, smina_affinity = _dock_with_vina(
                    "smina",
                    receptor_pdbqt,
                    ligand_pdbqt,
                    smina_pose,
                    center,
                    box_size=effective_box_size,
                    exhaustiveness=exhaustiveness,
                    num_modes=num_modes,
                    cpu=cpu,
                    timeout=timeout,
                )
                needs_minimize = smina_run.returncode != 0 or smina_affinity is None or not smina_pose.exists() or smina_pose.stat().st_size == 0
            else:
                needs_minimize = True
                smina_run = subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="Smina global docking skipped by strategy.")
                smina_affinity = None
            if needs_minimize:
                smina_mode = "minimize" if smina_strategy != "dock" else "minimize_fallback"
                smina_pose = pose_dir / f"{candidate_id}_smina_minimized.pdbqt"
                smina_run, smina_affinity = _smina_minimize(
                    receptor_pdbqt,
                    ligand_pdbqt,
                    smina_pose,
                    center,
                    box_size=effective_box_size,
                    timeout=timeout,
                )
            (pose_dir / f"{candidate_id}_vina.log").write_text(vina_run.stdout + "\n" + vina_run.stderr, encoding="utf-8", errors="replace")
            (pose_dir / f"{candidate_id}_smina.log").write_text(smina_run.stdout + "\n" + smina_run.stderr, encoding="utf-8", errors="replace")
            best_pose = vina_pose if vina_affinity is not None and (smina_affinity is None or vina_affinity <= smina_affinity) else smina_pose
            pose_sdf = pose_dir / f"{candidate_id}_docked.sdf"
            sdf_result = _run_obabel(best_pose, pose_sdf, timeout=300)
            affinities = [value for value in [vina_affinity, smina_affinity] if value is not None]
            if vina_run.returncode != 0 or smina_run.returncode != 0 or not vina_pose.exists() or not smina_pose.exists() or not affinities:
                raise RuntimeError("Vina/Smina did not both complete with parseable affinities.")
            result_row.update(
                {
                    "affinity_kcal_mol": round(float(min(affinities)), 3),
                    "vina_affinity_kcal_mol": vina_affinity,
                    "smina_affinity_kcal_mol": smina_affinity,
                    "smina_mode": smina_mode,
                    "binding_class": "strong" if min(affinities) <= -8.0 else "moderate" if min(affinities) <= -7.0 else "weak",
                    "docking_status": "completed",
                    "docking_runtime_s": round(time.time() - started, 2),
                    "receptor_path": str(receptor),
                    "receptor_pdbqt_path": receptor_pdbqt_path,
                    "ligand_sdf_path": str(ligand_sdf),
                    "ligand_pdbqt_path": str(ligand_pdbqt),
                    "vina_pose_pdbqt_path": str(vina_pose),
                    "smina_pose_pdbqt_path": str(smina_pose),
                    "docked_sdf_path": str(pose_sdf) if pose_sdf.exists() and sdf_result.returncode == 0 else str(best_pose),
                    "docking_center_x": center[0],
                    "docking_center_y": center[1],
                    "docking_center_z": center[2],
                    "docking_box_size_x": pocket["size"][0],
                    "docking_box_size_y": pocket["size"][1],
                    "docking_box_size_z": pocket["size"][2],
                }
            )
            _append_status(out_dir, "completed", target_id=target_id, candidate_id=candidate_id, affinity_kcal_mol=result_row["affinity_kcal_mol"])
        except Exception as exc:
            result_row.update(
                {
                    "affinity_kcal_mol": np.nan,
                    "binding_class": "failed",
                    "docking_status": "failed",
                    "docking_is_real": False,
                    "docking_error": str(exc),
                    "docking_runtime_s": round(time.time() - started, 2),
                }
            )
            _append_status(out_dir, "failed", target_id=target_id, candidate_id=candidate_id, error=str(exc))
        rows.append(result_row)
        completed = sum(1 for item in rows if item.get("docking_status") == "completed")
        failed = sum(1 for item in rows if item.get("docking_status") == "failed")
        status_path.write_text(
            json.dumps({"status": "running", "total": int(len(selected)), "completed": completed, "failed": failed, "current": candidate_id}, indent=2),
            encoding="utf-8",
        )

    result = pd.DataFrame(rows)
    failed = result[result.get("docking_status") != "completed"].copy()
    if not failed.empty:
        failed.to_csv(out_dir / "failed.csv", index=False)
        _append_status(out_dir, "completed_with_failures", failed=int(len(failed)), completed=int(len(result) - len(failed)))
    completed_result = result[result.get("docking_status") == "completed"].copy()
    if completed_result.empty:
        raise RuntimeError(f"Real docking produced no completed candidates. See {out_dir / 'failed.csv'}")
    completed_result.to_csv(out_dir / "results.csv", index=False)
    completed_result.sort_values(["target_id", "affinity_kcal_mol"]).groupby("target_id", group_keys=False).head(10).to_csv(
        out_dir / "top10.csv", index=False
    )
    status_path.write_text(
        json.dumps(
            {
                "status": "completed_with_failures" if not failed.empty else "completed",
                "total": int(len(result)),
                "completed": int(len(completed_result)),
                "failed": int(len(failed)),
                "failed_csv": str(out_dir / "failed.csv") if not failed.empty else None,
                "results_csv": str(out_dir / "results.csv"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return completed_result


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Dock candidates or run deterministic proxy docking.")
    parser.add_argument("--config", default="configs/cancer_targets.yaml")
    parser.add_argument("--candidates", required=True)
    parser.add_argument("--out", default="outputs/cancer_proof_v1/docking")
    parser.add_argument("--assets", default=None)
    parser.add_argument("--structures", default="data/structures")
    parser.add_argument("--top-per-target", type=int, default=None)
    parser.add_argument("--real", action="store_true", help="Run real Vina/Smina docking instead of descriptor proxy docking.")
    parser.add_argument("--box-size", type=float, default=30.0)
    parser.add_argument("--pockets", default="configs/oncology_pockets.yaml")
    parser.add_argument("--exhaustiveness", type=int, default=1)
    parser.add_argument("--num-modes", type=int, default=3)
    parser.add_argument("--cpu", type=int, default=4)
    parser.add_argument("--smina-strategy", choices=["minimize", "dock"], default="minimize")
    args = parser.parse_args(argv)
    config = load_config(args.config)
    top = args.top_per_target or config.proof_run.n_dock
    if args.real:
        result = run_real_docking(
            args.candidates,
            args.out,
            assets_csv=args.assets,
            structures_dir=args.structures,
            top_per_target=top,
            box_size=args.box_size,
            pockets_config=args.pockets,
            exhaustiveness=args.exhaustiveness,
            num_modes=args.num_modes,
            cpu=args.cpu,
            smina_strategy=args.smina_strategy,
        )
    else:
        result = run_proxy_docking(args.candidates, args.out, top_per_target=top)
    print(f"Wrote {len(result)} docking rows to {Path(args.out) / 'results.csv'}")


if __name__ == "__main__":
    main()
