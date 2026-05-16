from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from q_ai_drug.tools.external import resolve_tool, run_external, windows_to_wsl_path


WATER_XYZ = """3
water
O 0.000000 0.000000 0.000000
H 0.758602 0.000000 0.504284
H -0.758602 0.000000 0.504284
"""

RECEPTOR_PDB = """ATOM      1  N   ALA A   1      -1.458   0.000   0.000  1.00 10.00           N
ATOM      2  CA  ALA A   1      -0.002   0.000   0.000  1.00 10.00           C
ATOM      3  C   ALA A   1       0.520   1.420   0.000  1.00 10.00           C
ATOM      4  O   ALA A   1      -0.200   2.360   0.000  1.00 10.00           O
ATOM      5  CB  ALA A   1       0.520  -0.760  -1.210  1.00 10.00           C
TER
END
"""


def _tool_path_arg(tool_name: str, path: Path) -> str:
    tool = resolve_tool(tool_name)
    if tool.via_wsl:
        return windows_to_wsl_path(path)
    return str(path.resolve())


def _compact_output(text: str, max_lines: int = 10) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    return "\n".join(lines[-max_lines:])


def _record(results: dict[str, dict[str, Any]], name: str, ok: bool, **details: Any) -> None:
    results[name] = {"ok": ok, **details}


def smoke_openbabel(work_dir: Path, results: dict[str, dict[str, Any]]) -> tuple[Path | None, Path | None]:
    smi = work_dir / "ethanol.smi"
    sdf = work_dir / "ethanol.sdf"
    ligand_pdbqt = work_dir / "ethanol.pdbqt"
    receptor_pdb = work_dir / "alanine_receptor.pdb"
    receptor_pdbqt = work_dir / "alanine_receptor.pdbqt"

    smi.write_text("CCO ethanol\n", encoding="utf-8")
    receptor_pdb.write_text(RECEPTOR_PDB, encoding="utf-8")

    try:
        sdf_result = run_external(
            "obabel",
            [_tool_path_arg("obabel", smi), "-osdf", "-O", _tool_path_arg("obabel", sdf), "--gen3d"],
            cwd=work_dir,
            timeout=180,
        )
        ligand_result = run_external(
            "obabel",
            [_tool_path_arg("obabel", smi), "-opdbqt", "-O", _tool_path_arg("obabel", ligand_pdbqt), "--gen3d"],
            cwd=work_dir,
            timeout=180,
        )
        receptor_result = run_external(
            "obabel",
            [_tool_path_arg("obabel", receptor_pdb), "-opdbqt", "-O", _tool_path_arg("obabel", receptor_pdbqt), "-xr"],
            cwd=work_dir,
            timeout=180,
        )
        ok = sdf.exists() and ligand_pdbqt.exists() and receptor_pdbqt.exists()
        _record(
            results,
            "openbabel_conversion",
            ok,
            sdf=str(sdf),
            ligand_pdbqt=str(ligand_pdbqt),
            receptor_pdbqt=str(receptor_pdbqt),
            stdout=_compact_output(sdf_result.stdout + ligand_result.stdout + receptor_result.stdout),
            stderr=_compact_output(sdf_result.stderr + ligand_result.stderr + receptor_result.stderr),
        )
        return (receptor_pdbqt, ligand_pdbqt) if ok else (None, None)
    except Exception as exc:
        _record(results, "openbabel_conversion", False, error=str(exc))
        return None, None


def smoke_xtb(work_dir: Path, results: dict[str, dict[str, Any]]) -> None:
    xtb_dir = work_dir / "xtb"
    xtb_dir.mkdir(parents=True, exist_ok=True)
    xyz = xtb_dir / "water.xyz"
    xyz.write_text(WATER_XYZ, encoding="utf-8")
    try:
        result = run_external(
            "xtb",
            [_tool_path_arg("xtb", xyz), "--gfn", "2", "--sp", "--parallel", "1"],
            cwd=xtb_dir,
            timeout=300,
            check=False,
        )
        text = result.stdout + "\n" + result.stderr
        ok = result.returncode == 0 and "TOTAL ENERGY" in text
        _record(
            results,
            "xtb_single_point",
            ok,
            returncode=result.returncode,
            xyz=str(xyz),
            output_excerpt=_compact_output(text),
        )
    except Exception as exc:
        _record(results, "xtb_single_point", False, error=str(exc))


def smoke_docking_tool(
    name: str,
    receptor_pdbqt: Path | None,
    ligand_pdbqt: Path | None,
    work_dir: Path,
    results: dict[str, dict[str, Any]],
) -> None:
    version_args = ["--version"] if name == "vina" else ["--help"]
    try:
        version = run_external(name, version_args, cwd=work_dir, timeout=120, check=False)
    except Exception as exc:
        _record(results, f"{name}_executable", False, error=str(exc))
        return

    executable_ok = version.returncode == 0 or (name == "smina" and "smina" in (version.stdout + version.stderr).lower())
    _record(
        results,
        f"{name}_executable",
        executable_ok,
        returncode=version.returncode,
        output_excerpt=_compact_output(version.stdout + "\n" + version.stderr),
    )
    if not executable_ok or receptor_pdbqt is None or ligand_pdbqt is None:
        return

    out_path = work_dir / f"{name}_docked.pdbqt"
    args = [
        "--receptor" if name == "vina" else "-r",
        _tool_path_arg(name, receptor_pdbqt),
        "--ligand" if name == "vina" else "-l",
        _tool_path_arg(name, ligand_pdbqt),
        "--center_x",
        "0",
        "--center_y",
        "0",
        "--center_z",
        "0",
        "--size_x",
        "16",
        "--size_y",
        "16",
        "--size_z",
        "16",
        "--exhaustiveness",
        "1",
        "--num_modes",
        "1",
        "--out" if name == "vina" else "-o",
        _tool_path_arg(name, out_path),
    ]
    try:
        docking = run_external(name, args, cwd=work_dir, timeout=300, check=False)
        text = docking.stdout + "\n" + docking.stderr
        ok = docking.returncode == 0 and out_path.exists()
        _record(
            results,
            f"{name}_mini_docking",
            ok,
            returncode=docking.returncode,
            output=str(out_path),
            output_excerpt=_compact_output(text),
        )
    except Exception as exc:
        _record(results, f"{name}_mini_docking", False, error=str(exc))


def smoke_gnina(work_dir: Path, results: dict[str, dict[str, Any]]) -> None:
    receptor_pdb = work_dir / "alanine_receptor.pdb"
    ligand_sdf = work_dir / "ethanol.sdf"
    try:
        version = run_external("gnina", ["--version"], cwd=work_dir, timeout=120, check=False)
    except Exception as exc:
        _record(results, "gnina_executable", False, error=str(exc))
        return
    executable_ok = version.returncode == 0 and "gnina" in (version.stdout + version.stderr).lower()
    _record(
        results,
        "gnina_executable",
        executable_ok,
        returncode=version.returncode,
        output_excerpt=_compact_output(version.stdout + "\n" + version.stderr),
    )
    if not executable_ok or not receptor_pdb.exists() or not ligand_sdf.exists():
        return

    args = [
        "--no_gpu",
        "--score_only",
        "-r",
        _tool_path_arg("gnina", receptor_pdb),
        "-l",
        _tool_path_arg("gnina", ligand_sdf),
    ]
    try:
        scoring = run_external("gnina", args, cwd=work_dir, timeout=300, check=False)
        text = scoring.stdout + "\n" + scoring.stderr
        ok = scoring.returncode == 0 and "CNNscore" in text and "CNNaffinity" in text
        _record(
            results,
            "gnina_score_only",
            ok,
            returncode=scoring.returncode,
            receptor=str(receptor_pdb),
            ligand=str(ligand_sdf),
            output_excerpt=_compact_output(text),
        )
    except Exception as exc:
        _record(results, "gnina_score_only", False, error=str(exc))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run executable smoke tests for the external drug discovery tools.")
    parser.add_argument("--output", default=str(Path("outputs") / "tool_smoke" / "external_tool_smoke.json"))
    parser.add_argument("--work-dir", default=str(Path("outputs") / "tool_smoke"))
    args = parser.parse_args(argv)

    out_path = Path(args.output)
    work_dir = Path(args.work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, dict[str, Any]] = {}

    receptor_pdbqt, ligand_pdbqt = smoke_openbabel(work_dir, results)
    smoke_xtb(work_dir, results)
    smoke_docking_tool("vina", receptor_pdbqt, ligand_pdbqt, work_dir, results)
    smoke_docking_tool("smina", receptor_pdbqt, ligand_pdbqt, work_dir, results)
    smoke_gnina(work_dir, results)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))

    failed = [name for name, payload in results.items() if not payload.get("ok")]
    if failed:
        print(f"External tool smoke failures: {', '.join(failed)}", file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
