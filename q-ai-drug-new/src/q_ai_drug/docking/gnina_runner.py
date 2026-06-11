from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any

import pandas as pd

from q_ai_drug.docking.pockets import clean_receptor_pdb, effective_cubic_box_size, registered_receptor_path, resolve_pocket
from q_ai_drug.tools.external import resolve_tool, run_external, windows_to_wsl_path

try:
    from rdkit import Chem
except Exception:
    Chem = None


GNINA_DEPTH_MODES = {"quick": 1, "investor": 3, "scientific": 10}


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def _write_status(out_dir: Path, status: str, **extra: Any) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {"status": status, "updated_at": _now(), **extra}
    (out_dir / "status.json").write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def _append_log(out_dir: Path, event: str, **extra: Any) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {"time": _now(), "event": event, **extra}
    with (out_dir / "run_log.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, default=str) + "\n")


def _update_run_summary(out_dir: Path, results: pd.DataFrame) -> None:
    project_dir = out_dir.parent
    summary_path = project_dir / "run_summary.json"
    if summary_path.exists():
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            summary = {}
    else:
        summary = {}
    summary.update(
        {
            "gnina_rows": int(len(results)),
            "gnina_completed": int((results.get("gnina_status") == "completed").sum()) if not results.empty else 0,
            "gnina_results": str(out_dir / "results.csv"),
            "gnina_mode": ", ".join(sorted(results["gnina_mode"].dropna().astype(str).unique())) if "gnina_mode" in results else None,
        }
    )
    manifest_path = project_dir / "external_tools_manifest.json"
    if manifest_path.exists():
        try:
            summary["external_tools"] = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    summary_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")


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


def _parse_gnina_output(text: str) -> dict[str, float | None]:
    best: dict[str, float | None] = {
        "gnina_affinity_kcal_mol": None,
        "gnina_intramol_kcal_mol": None,
        "gnina_cnn_pose_score": None,
        "gnina_cnn_affinity": None,
    }
    rows = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0].isdigit():
            try:
                rows.append((float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])))
            except ValueError:
                continue
    if rows:
        affinity, intramol, pose_score, cnn_affinity = max(rows, key=lambda item: item[2])
        best["gnina_affinity_kcal_mol"] = affinity
        best["gnina_intramol_kcal_mol"] = intramol
        best["gnina_cnn_pose_score"] = pose_score
        best["gnina_cnn_affinity"] = cnn_affinity
    return best


def _parse_gnina_warnings(text: str) -> str:
    warnings = []
    patterns = [
        r"ligand\s+outside\s+box",
        r"outside\s+the\s+box",
        r"initial\s+pose\s+.*box",
        r"warning[:\s].*box",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            warnings.append(match.group(0).strip())
    return "; ".join(sorted(set(warnings)))


def _asset_lookup(assets_csv: Path) -> pd.DataFrame:
    if not assets_csv.exists():
        return pd.DataFrame(columns=["candidate_id", "sdf_path", "png_path"])
    assets = pd.read_csv(assets_csv)
    keep = [column for column in ["candidate_id", "sdf_path", "png_path", "smi_path"] if column in assets.columns]
    return assets[keep].drop_duplicates("candidate_id")


def _docking_pose_lookup(project_dir: Path) -> pd.DataFrame:
    path = project_dir / "docking" / "results.csv"
    if not path.exists():
        return pd.DataFrame(columns=["candidate_id", "docked_sdf_path"])
    docking = pd.read_csv(path)
    keep = [column for column in ["candidate_id", "docked_sdf_path", "docking_status"] if column in docking.columns]
    if len(keep) <= 1:
        return pd.DataFrame(columns=["candidate_id", "docked_sdf_path"])
    return docking[keep].drop_duplicates("candidate_id")


def _center_ligand_sdf(input_sdf: Path, output_sdf: Path, center: tuple[float, float, float]) -> Path:
    if Chem is None or not input_sdf.exists():
        return input_sdf
    supplier = Chem.SDMolSupplier(str(input_sdf), removeHs=False, sanitize=False)
    mol = next((item for item in supplier if item is not None and item.GetNumConformers() > 0), None)
    if mol is None:
        return input_sdf
    conf = mol.GetConformer()
    xs, ys, zs = [], [], []
    for index in range(mol.GetNumAtoms()):
        pos = conf.GetAtomPosition(index)
        xs.append(pos.x)
        ys.append(pos.y)
        zs.append(pos.z)
    offset = (center[0] - sum(xs) / len(xs), center[1] - sum(ys) / len(ys), center[2] - sum(zs) / len(zs))
    for index in range(mol.GetNumAtoms()):
        pos = conf.GetAtomPosition(index)
        conf.SetAtomPosition(index, (pos.x + offset[0], pos.y + offset[1], pos.z + offset[2]))
    output_sdf.parent.mkdir(parents=True, exist_ok=True)
    writer = Chem.SDWriter(str(output_sdf))
    writer.write(mol)
    writer.close()
    return output_sdf if output_sdf.exists() else input_sdf


def _ligand_max_span(path: Path) -> float | None:
    if Chem is None or not path.exists():
        return None
    supplier = Chem.SDMolSupplier(str(path), removeHs=False, sanitize=False)
    mol = next((item for item in supplier if item is not None and item.GetNumConformers() > 0), None)
    if mol is None:
        return None
    conf = mol.GetConformer()
    coords = []
    for index in range(mol.GetNumAtoms()):
        pos = conf.GetAtomPosition(index)
        coords.append((pos.x, pos.y, pos.z))
    if not coords:
        return None
    spans = [max(axis) - min(axis) for axis in zip(*coords)]
    return float(max(spans))


def run_gnina_screen(
    *,
    candidates_csv: str | Path = "outputs/cancer_proof_v1/top_candidates.csv",
    assets_csv: str | Path = "outputs/cancer_proof_v1/assets/ligand_asset_manifest.csv",
    structures_dir: str | Path = "data/structures",
    out_dir: str | Path = "outputs/cancer_proof_v1/gnina",
    top_per_target: int = 1,
    depth_mode: str | None = None,
    box_size: float = 30.0,
    pockets_config: str | Path = "configs/oncology_pockets.yaml",
    exhaustiveness: int = 1,
    num_modes: int = 3,
    cpu: int = 4,
) -> pd.DataFrame:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / "run_log.jsonl"
    if log_path.exists():
        log_path.unlink()

    tool = resolve_tool("gnina")
    if not tool.available:
        _write_status(out_dir, "skipped", error="GNINA executable not found.")
        return pd.DataFrame()
    if depth_mode:
        top_per_target = GNINA_DEPTH_MODES.get(str(depth_mode).lower(), top_per_target)

    candidates = pd.read_csv(candidates_csv)
    assets = _asset_lookup(Path(assets_csv))
    candidates = candidates.merge(assets, on="candidate_id", how="left", suffixes=("", "_asset"))
    docking_poses = _docking_pose_lookup(out_dir.parent)
    if not docking_poses.empty:
        candidates = candidates.merge(docking_poses, on="candidate_id", how="left", suffixes=("", "_docking"))
    selected = candidates.sort_values(["target_id", "final_score"], ascending=[True, False]).groupby("target_id", group_keys=False).head(top_per_target)

    _write_status(out_dir, "running", total=int(len(selected)), completed=0, failed=0, depth_mode=depth_mode or "custom")
    rows: list[dict[str, Any]] = []
    for index, row in enumerate(selected.to_dict("records"), start=1):
        target_id = str(row["target_id"])
        candidate_id = str(row["candidate_id"])
        raw_receptor = registered_receptor_path(target_id, structures_dir, registry_path=pockets_config)
        receptor = clean_receptor_pdb(raw_receptor, out_dir / "prepared_receptors" / f"{raw_receptor.stem}_clean.pdb") if raw_receptor.exists() else raw_receptor
        raw_ligand = row.get("docked_sdf_path")
        ligand_source = "vina_smina_docked_sdf"
        if raw_ligand is None or pd.isna(raw_ligand) or not Path(str(raw_ligand)).exists():
            raw_ligand = row.get("sdf_path")
            ligand_source = "rdkit_conformer_sdf"
        if raw_ligand is None or pd.isna(raw_ligand):
            raw_ligand = row.get("sdf_path_asset")
            ligand_source = "asset_conformer_sdf"
        ligand = Path(str(raw_ligand or ""))
        pose_dir = out_dir / "poses" / target_id
        pose_dir.mkdir(parents=True, exist_ok=True)
        pose_path = pose_dir / f"{candidate_id}_gnina.sdf"
        log_file = pose_dir / f"{candidate_id}_gnina.log"
        result_row = {
            "target_id": target_id,
            "candidate_id": candidate_id,
            "input_final_score": row.get("final_score"),
            "receptor_path": str(receptor),
            "ligand_sdf_path": str(ligand),
            "gnina_input_pose_source": ligand_source,
            "gnina_pose_sdf_path": str(pose_path),
            "gnina_log_path": str(log_file),
            "gnina_mode": "gnina_cpu_pending_pocket_resolution",
            "gnina_is_real": True,
            "gnina_depth_mode": depth_mode or "custom",
        }
        if not receptor.exists() or not ligand.exists():
            result_row.update({"gnina_status": "missing_input", "gnina_error": "Missing receptor or ligand SDF."})
            rows.append(result_row)
            _append_log(out_dir, "missing_input", target_id=target_id, candidate_id=candidate_id)
            continue

        pocket = resolve_pocket(target_id, receptor, default_box_size=box_size, registry_path=pockets_config)
        center = pocket["center"]
        effective_box_size = effective_cubic_box_size(pocket)
        pocket_tier = str(pocket["method_tier"]).upper()
        if pocket_tier in {"REAL", "CURATED"}:
            centered_ligand = _center_ligand_sdf(ligand, pose_dir / f"{candidate_id}_gnina_input_centered.sdf", center)
            if centered_ligand != ligand:
                ligand = centered_ligand
                result_row["ligand_sdf_path"] = str(ligand)
                result_row["gnina_input_pose_source"] = f"{ligand_source}_centered_to_curated_pocket"
        ligand_span = _ligand_max_span(ligand)
        box_expansion_note = ""
        if ligand_span is not None:
            curated_floor = 36.0 if pocket_tier in {"REAL", "CURATED"} else effective_box_size
            minimum_box = max(effective_box_size, curated_floor, ligand_span + 16.0)
            if minimum_box > effective_box_size:
                box_expansion_note = (
                    f"GNINA box expanded from {effective_box_size:.1f} A to {minimum_box:.1f} A "
                    "to contain the centered ligand while preserving the curated pocket center."
                )
                effective_box_size = round(minimum_box, 3)
        result_row.update(
            {
                "gnina_mode": "gnina_cpu_curated_pocket" if pocket_tier in {"REAL", "CURATED"} else "gnina_cpu_exploratory_blind_box",
                "pocket_source": pocket.get("source"),
                "pocket_pdb_id": pocket.get("pdb_id"),
                "reference_ligand": pocket.get("reference_ligand"),
                "pocket_method_tier": pocket_tier,
                "pocket_provenance_note": pocket.get("provenance_note"),
                "gnina_box_expansion_note": box_expansion_note,
            }
        )
        args = [
            "--no_gpu",
            "--cpu",
            str(cpu),
            "--seed",
            "17",
            "--exhaustiveness",
            str(exhaustiveness),
            "--num_modes",
            str(num_modes),
            "-r",
            windows_to_wsl_path(receptor),
            "-l",
            windows_to_wsl_path(ligand),
            "--center_x",
            f"{center[0]:.3f}",
            "--center_y",
            f"{center[1]:.3f}",
            "--center_z",
            f"{center[2]:.3f}",
            "--size_x",
            str(effective_box_size),
            "--size_y",
            str(effective_box_size),
            "--size_z",
            str(effective_box_size),
            "-o",
            windows_to_wsl_path(pose_path),
        ]
        _append_log(out_dir, "started_candidate", target_id=target_id, candidate_id=candidate_id, index=index, total=int(len(selected)))
        started = time.time()
        run = run_external("gnina", args, cwd=pose_dir, timeout=1800, check=False)
        text = run.stdout + "\n" + run.stderr
        log_file.write_text(text, encoding="utf-8", errors="replace")
        result_row.update(_parse_gnina_output(text))
        result_row.update(
            {
                "gnina_status": "completed" if run.returncode == 0 and pose_path.exists() else "failed",
                "gnina_returncode": run.returncode,
                "gnina_runtime_s": round(time.time() - started, 2),
                "gnina_center_x": center[0],
                "gnina_center_y": center[1],
                "gnina_center_z": center[2],
                "gnina_box_size": effective_box_size,
                "gnina_box_size_x": pocket["size"][0],
                "gnina_box_size_y": pocket["size"][1],
                "gnina_box_size_z": pocket["size"][2],
                "gnina_warnings": _parse_gnina_warnings(text),
                "gnina_output_excerpt": "\n".join(text.splitlines()[-20:]),
            }
        )
        rows.append(result_row)
        completed = sum(1 for item in rows if item.get("gnina_status") == "completed")
        failed = sum(1 for item in rows if item.get("gnina_status") == "failed")
        _write_status(out_dir, "running", total=int(len(selected)), completed=completed, failed=failed, current=candidate_id, depth_mode=depth_mode or "custom")
        _append_log(out_dir, result_row["gnina_status"], target_id=target_id, candidate_id=candidate_id, runtime_s=result_row["gnina_runtime_s"])

    result = pd.DataFrame(rows)
    result.to_csv(out_dir / "results.csv", index=False)
    _update_run_summary(out_dir, result)
    _write_status(
        out_dir,
        "completed",
        total=int(len(selected)),
        completed=int((result.get("gnina_status") == "completed").sum()) if not result.empty else 0,
        failed=int((result.get("gnina_status") == "failed").sum()) if not result.empty else 0,
        depth_mode=depth_mode or "custom",
        results_csv=str(out_dir / "results.csv"),
    )
    return result


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run GNINA CPU exploratory docking/rescoring for top candidates.")
    parser.add_argument("--candidates", default="outputs/cancer_proof_v1/top_candidates.csv")
    parser.add_argument("--assets", default="outputs/cancer_proof_v1/assets/ligand_asset_manifest.csv")
    parser.add_argument("--structures", default="data/structures")
    parser.add_argument("--out", default="outputs/cancer_proof_v1/gnina")
    parser.add_argument("--top-per-target", type=int, default=1)
    parser.add_argument("--depth-mode", choices=[*sorted(GNINA_DEPTH_MODES), "custom"], default=None)
    parser.add_argument("--box-size", type=float, default=30.0)
    parser.add_argument("--pockets", default="configs/oncology_pockets.yaml")
    parser.add_argument("--exhaustiveness", type=int, default=1)
    parser.add_argument("--num-modes", type=int, default=3)
    parser.add_argument("--cpu", type=int, default=4)
    args = parser.parse_args(argv)
    result = run_gnina_screen(
        candidates_csv=args.candidates,
        assets_csv=args.assets,
        structures_dir=args.structures,
        out_dir=args.out,
        top_per_target=args.top_per_target,
        depth_mode=args.depth_mode,
        box_size=args.box_size,
        pockets_config=args.pockets,
        exhaustiveness=args.exhaustiveness,
        num_modes=args.num_modes,
        cpu=args.cpu,
    )
    print(f"Wrote {len(result)} GNINA rows to {Path(args.out) / 'results.csv'}")


if __name__ == "__main__":
    main()
