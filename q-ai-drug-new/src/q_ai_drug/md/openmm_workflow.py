from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
except Exception:
    Chem = None
    AllChem = None

try:
    import openmm as mm
    from openmm import unit
    from openmm.app import Element, PDBFile, Simulation, Topology
except Exception:
    mm = None
    unit = None
    Element = None
    PDBFile = None
    Simulation = None
    Topology = None


def _stable_float(*parts: str, low: float = 0.0, high: float = 1.0) -> float:
    raw = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:8]
    value = (int(raw, 16) % 10000) / 10000.0
    return low + (high - low) * value


def run_proxy_md(docking_csv: str | Path, out_dir: str | Path, top: int = 10) -> pd.DataFrame:
    docking = pd.read_csv(docking_csv)
    selected = docking.sort_values(["target_id", "affinity_kcal_mol"]).groupby("target_id", group_keys=False).head(top).copy()
    rows = []
    series_rows = []
    for row in selected.to_dict("records"):
        key = str(row.get("candidate_id")) + str(row.get("target_id"))
        base = _stable_float(key, "base", low=0.8, high=2.2)
        drift = max(0.0, (float(row.get("affinity_kcal_mol", -7.0)) + 10.0) * 0.08)
        rmsd_early = base
        rmsd_mid = base + drift + _stable_float(key, "mid", low=-0.15, high=0.25)
        rmsd_final = base + drift * 1.4 + _stable_float(key, "final", low=-0.1, high=0.35)
        stable = rmsd_final <= 3.0
        rows.append(
            {
                "target_id": row.get("target_id"),
                "candidate_id": row.get("candidate_id"),
                "smiles": row.get("canonical_smiles") or row.get("smiles"),
                "affinity_kcal_mol": row.get("affinity_kcal_mol"),
                "rmsd_checkpoint_early": round(rmsd_early, 3),
                "rmsd_checkpoint_mid": round(rmsd_mid, 3),
                "rmsd_checkpoint_final": round(rmsd_final, 3),
                "stability_class": "stable" if stable else "unstable",
                "md_mode": "proxy_rmsd_triage",
                "md_is_real": False,
                "md_note": "Deterministic proxy triage. This is not nanosecond molecular dynamics.",
                "trajectory_ps": 0.0,
            }
        )
        for label, rmsd in [("early", rmsd_early), ("mid", rmsd_mid), ("final", rmsd_final)]:
            series_rows.append(
                {
                    "target_id": row.get("target_id"),
                    "candidate_id": row.get("candidate_id"),
                    "checkpoint_label": label,
                    "trajectory_ps": 0.0,
                    "rmsd": rmsd,
                    "md_mode": "proxy_rmsd_triage",
                    "md_is_real": False,
                }
            )
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = pd.DataFrame(rows)
    summary.to_csv(out_dir / "stability.csv", index=False)
    pd.DataFrame(series_rows).to_csv(out_dir / "rmsd_summary.csv", index=False)
    return summary


def _mol_from_row(row: dict[str, Any]) -> tuple[Any, Path]:
    sdf_candidates = [
        row.get("docked_sdf_path"),
        row.get("ligand_sdf_path"),
        row.get("sdf_path"),
    ]
    for raw_path in sdf_candidates:
        if raw_path is None or pd.isna(raw_path):
            continue
        path = Path(str(raw_path))
        if not path.exists() or path.stat().st_size == 0:
            continue
        supplier = Chem.SDMolSupplier(str(path), removeHs=False)
        mol = supplier[0] if supplier and len(supplier) else None
        if mol is not None and mol.GetNumConformers():
            return mol, path
    smiles = str(row.get("canonical_smiles") or row.get("smiles") or "")
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise RuntimeError(f"Could not parse ligand for OpenMM MD: {row.get('candidate_id')}")
    mol = Chem.AddHs(mol)
    status = AllChem.EmbedMolecule(mol, randomSeed=17)
    if status != 0:
        status = AllChem.EmbedMolecule(mol, randomSeed=17, useRandomCoords=True)
    if status != 0:
        raise RuntimeError(f"Could not embed ligand for OpenMM MD: {row.get('candidate_id')}")
    AllChem.UFFOptimizeMolecule(mol, maxIters=200)
    return mol, Path("")


def _topology_from_mol(mol: Any) -> Topology:
    topology = Topology()
    chain = topology.addChain("L")
    residue = topology.addResidue("LIG", chain)
    atoms = []
    for atom in mol.GetAtoms():
        atomic_num = atom.GetAtomicNum()
        element = Element.getByAtomicNumber(atomic_num) if atomic_num > 0 else Element.getBySymbol("C")
        atoms.append(topology.addAtom(atom.GetSymbol(), element, residue))
    for bond in mol.GetBonds():
        topology.addBond(atoms[bond.GetBeginAtomIdx()], atoms[bond.GetEndAtomIdx()])
    return topology


def _positions_from_mol(mol: Any) -> np.ndarray:
    conformer = mol.GetConformer()
    coords = []
    for index in range(mol.GetNumAtoms()):
        pos = conformer.GetAtomPosition(index)
        coords.append([pos.x * 0.1, pos.y * 0.1, pos.z * 0.1])
    return np.asarray(coords, dtype=float)


def _atomic_mass(atom: Any) -> float:
    mass = atom.GetMass()
    return float(mass) if mass > 0 else 12.0


def _sigma_for_atom(atom: Any) -> float:
    return {
        1: 0.25,
        6: 0.34,
        7: 0.325,
        8: 0.305,
        9: 0.295,
        15: 0.38,
        16: 0.36,
        17: 0.35,
        35: 0.39,
        53: 0.43,
    }.get(atom.GetAtomicNum(), 0.35)


def _build_openmm_system(mol: Any, initial: np.ndarray) -> mm.System:
    system = mm.System()
    for atom in mol.GetAtoms():
        system.addParticle(_atomic_mass(atom))

    bond_force = mm.CustomBondForce("0.5*k*(r-r0)^2")
    bond_force.addPerBondParameter("r0")
    bond_force.addPerBondParameter("k")
    bonded_pairs = set()
    for bond in mol.GetBonds():
        i = bond.GetBeginAtomIdx()
        j = bond.GetEndAtomIdx()
        r0 = float(np.linalg.norm(initial[i] - initial[j]))
        bond_force.addBond(i, j, [r0, 20000.0])
        bonded_pairs.add(tuple(sorted((i, j))))
    system.addForce(bond_force)

    nonbonded = mm.CustomNonbondedForce("4*sqrt(epsilon1*epsilon2)*((0.5*(sigma1+sigma2)/r)^12-(0.5*(sigma1+sigma2)/r)^6)")
    nonbonded.addPerParticleParameter("sigma")
    nonbonded.addPerParticleParameter("epsilon")
    for atom in mol.GetAtoms():
        nonbonded.addParticle([_sigma_for_atom(atom), 0.08])
    for i, j in bonded_pairs:
        nonbonded.addExclusion(i, j)
    system.addForce(nonbonded)

    restraint = mm.CustomExternalForce("0.5*k*((x-x0)^2+(y-y0)^2+(z-z0)^2)")
    restraint.addGlobalParameter("k", 50.0)
    restraint.addPerParticleParameter("x0")
    restraint.addPerParticleParameter("y0")
    restraint.addPerParticleParameter("z0")
    for index, coord in enumerate(initial):
        restraint.addParticle(index, coord.tolist())
    system.addForce(restraint)
    return system


def _rmsd(reference: np.ndarray, mobile: np.ndarray) -> float:
    ref = reference - reference.mean(axis=0)
    mob = mobile - mobile.mean(axis=0)
    covariance = mob.T @ ref
    v, _, wt = np.linalg.svd(covariance)
    if np.linalg.det(v @ wt) < 0:
        v[:, -1] *= -1
    rotated = mob @ (v @ wt)
    return float(np.sqrt(((rotated - ref) ** 2).sum() / len(reference)) * 10.0)


def _simulate_ligand_pose(row: dict[str, Any], out_dir: Path, *, steps: int, temperature: float) -> dict[str, Any]:
    if Chem is None or AllChem is None or mm is None:
        raise RuntimeError("RDKit and OpenMM are required for real MD.")
    target_id = str(row.get("target_id"))
    candidate_id = str(row.get("candidate_id"))
    pose_dir = out_dir / "trajectories" / target_id
    pose_dir.mkdir(parents=True, exist_ok=True)
    mol, ligand_source = _mol_from_row(row)
    topology = _topology_from_mol(mol)
    initial = _positions_from_mol(mol)
    system = _build_openmm_system(mol, initial)
    integrator = mm.LangevinMiddleIntegrator(temperature * unit.kelvin, 1.0 / unit.picosecond, 0.001 * unit.picoseconds)
    platform = mm.Platform.getPlatformByName("CPU")
    simulation = Simulation(topology, system, integrator, platform)
    simulation.context.setPositions(initial * unit.nanometer)
    simulation.minimizeEnergy(maxIterations=100)

    checkpoints = [max(1, steps // 10), max(2, steps // 2), max(3, steps)]
    frames = []
    rmsd_values = []
    elapsed = 0
    for checkpoint in checkpoints:
        simulation.step(checkpoint - elapsed)
        elapsed = checkpoint
        state = simulation.context.getState(getPositions=True, getEnergy=True)
        positions = state.getPositions(asNumpy=True).value_in_unit(unit.nanometer)
        frames.append(positions.copy())
        rmsd_values.append(_rmsd(initial, positions))

    trajectory_path = pose_dir / f"{candidate_id}_openmm_trajectory.pdb"
    with trajectory_path.open("w", encoding="utf-8") as handle:
        for model_index, positions in enumerate(frames, start=1):
            PDBFile.writeModel(topology, positions * unit.nanometer, handle, modelIndex=model_index)
    stable = rmsd_values[-1] <= 3.0
    return {
        "target_id": target_id,
        "candidate_id": candidate_id,
        "smiles": row.get("canonical_smiles") or row.get("smiles"),
        "affinity_kcal_mol": row.get("affinity_kcal_mol"),
        "rmsd_checkpoint_early": round(rmsd_values[0], 3),
        "rmsd_checkpoint_mid": round(rmsd_values[1], 3),
        "rmsd_checkpoint_final": round(rmsd_values[2], 3),
        "stability_class": "stable" if stable else "unstable",
        "md_mode": "openmm_ligand_pose_relaxation",
        "md_is_real": True,
        "md_note": "OpenMM CPU Langevin ligand-pose relaxation using graph-derived forces. This is not explicit-solvent protein-ligand MD.",
        "md_steps": steps,
        "md_timestep_fs": 1.0,
        "md_temperature_k": temperature,
        "trajectory_ps": round(steps * 0.001, 3),
        "trajectory_path": str(trajectory_path),
        "ligand_source_path": str(ligand_source),
        "docked_sdf_path": row.get("docked_sdf_path"),
    }


def run_openmm_md(docking_csv: str | Path, out_dir: str | Path, top: int = 10, *, steps: int = 2000, temperature: float = 300.0) -> pd.DataFrame:
    docking = pd.read_csv(docking_csv)
    selected = docking.sort_values(["target_id", "affinity_kcal_mol"]).groupby("target_id", group_keys=False).head(top).copy()
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    series_rows = []
    for row in selected.to_dict("records"):
        result = _simulate_ligand_pose(row, out_dir, steps=steps, temperature=temperature)
        rows.append(result)
        for label, rmsd in [
            ("early", result["rmsd_checkpoint_early"]),
            ("mid", result["rmsd_checkpoint_mid"]),
            ("final", result["rmsd_checkpoint_final"]),
        ]:
            series_rows.append(
                {
                    "target_id": result["target_id"],
                    "candidate_id": result["candidate_id"],
                    "checkpoint_label": label,
                    "trajectory_ps": result["trajectory_ps"],
                    "rmsd": rmsd,
                    "md_mode": result["md_mode"],
                    "md_is_real": True,
                }
            )
    summary = pd.DataFrame(rows)
    summary.to_csv(out_dir / "stability.csv", index=False)
    pd.DataFrame(series_rows).to_csv(out_dir / "rmsd_summary.csv", index=False)
    return summary


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run OpenMM MD triage or deterministic proxy MD.")
    parser.add_argument("--docking", required=True)
    parser.add_argument("--out", default="outputs/cancer_proof_v1/md")
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--real", action="store_true", help="Run OpenMM-backed trajectory generation instead of proxy MD.")
    parser.add_argument("--steps", type=int, default=2000)
    args = parser.parse_args(argv)
    if args.real:
        result = run_openmm_md(args.docking, args.out, top=args.top, steps=args.steps)
    else:
        result = run_proxy_md(args.docking, args.out, top=args.top)
    print(f"Wrote {len(result)} MD triage rows to {Path(args.out) / 'stability.csv'}")


if __name__ == "__main__":
    main()
