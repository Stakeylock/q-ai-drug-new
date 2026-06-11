"""Q-Dock Studio module runner: molecular docking and scoring.

This standalone runner accepts receptor, ligand, pocket, and engine settings.
It runs real AutoDock Vina/Smina-compatible docking when binaries are available,
runs GNINA only through an explicit GNINA branch when the binary is available,
and otherwise emits clearly labeled mock rows.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import pandas as pd

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
except ImportError:  # pragma: no cover - optional dependency
    Chem = None
    AllChem = None

from q_ai_drug.product.module_runners.base import (
    BaseModuleRunner,
    FailureCode,
    MissingDependencyError,
    ModuleExecutionError,
    ModuleInputError,
)
from q_ai_drug.service.tool_payloads import QDockStudioPayload, PocketBox


class QDockStudioRunner(BaseModuleRunner):
    """Q-Dock Studio module runner with explicit real/mock evidence labels."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id=module_id, project_dir=project_dir, run_id=run_id, payload=payload)
        self.receptor_path: Path | None = None
        self.receptor_pdbqt: Path | None = None
        self.ligand_mols: list[dict[str, Any]] = []
        self.pocket_box: PocketBox | None = None
        self.docking_results: list[dict[str, Any]] = []
        self.failure_results: list[dict[str, Any]] = []
        self.interaction_fingerprints: list[dict[str, Any]] = []
        self.redocking_rows: list[dict[str, Any]] = []
        self._vina_available: bool = False
        self._gnina_available: bool = False
        self._obabel_available: bool = False
        self._mock_mode: bool = False
        self._actual_engine_used: str = "mock"
        self._requested_engine: str = "vina_smina"
        self._gnina_executed_count: int = 0

    def validate_payload(self) -> None:
        try:
            validated = QDockStudioPayload.model_validate(self.payload)
            self.validated_payload = validated.model_dump()
        except Exception as e:
            raise ModuleInputError(f"Invalid Q-Dock Studio payload: {e}")

    def resolve_inputs(self) -> None:
        payload = self.validated_payload

        receptor_path = None
        if payload.get("receptor_artifact_id"):
            try:
                from q_ai_drug.service.artifact_resolver import resolve_artifact_path
                receptor_path = resolve_artifact_path(self.project_dir, payload["receptor_artifact_id"])
            except Exception as e:
                raise ModuleInputError(f"Cannot load receptor artifact: {e}. Upload PDB/PDBQT directly.")
        elif payload.get("receptor_upload_file"):
            receptor_path = self.project_dir / "uploads" / payload["receptor_upload_file"]
            if not receptor_path.exists():
                raise ModuleInputError(f"Receptor file not found: {payload['receptor_upload_file']}")
        else:
            raise ModuleInputError("Must provide receptor_upload_file or receptor_artifact_id.")

        if receptor_path.suffix.lower() not in [".pdb", ".pdbqt", ".mmcif", ".cif"]:
            raise ModuleInputError(f"Unsupported receptor format: {receptor_path.suffix}. Accepted: .pdb, .pdbqt, .mmcif, .cif")
        if receptor_path.stat().st_size == 0:
            raise ModuleInputError("Receptor file is empty")
        self.receptor_path = receptor_path

        ligand_path = None
        if payload.get("ligand_artifact_id"):
            try:
                from q_ai_drug.service.artifact_resolver import resolve_artifact_path
                ligand_path = resolve_artifact_path(self.project_dir, payload["ligand_artifact_id"])
            except Exception as e:
                raise ModuleInputError(f"Cannot load ligand artifact: {e}. Upload SMILES CSV/SDF directly.")
        elif payload.get("ligand_upload_file"):
            ligand_path = self.project_dir / "uploads" / payload["ligand_upload_file"]
            if not ligand_path.exists():
                raise ModuleInputError(f"Ligand file not found: {payload['ligand_upload_file']}")
        else:
            raise ModuleInputError("Must provide ligand_upload_file or ligand_artifact_id.")

        if Chem is None:
            raise MissingDependencyError("RDKit is required for Q-Dock Studio. Install q-ai-drug[chem] or rdkit.")

        engine_val = payload.get("engine", "vina_smina")
        engine_str = engine_val.value if hasattr(engine_val, "value") else str(engine_val)
        try:
            from q_ai_drug.docking.vina_runner import vina_available
            from q_ai_drug.tools.external import resolve_tool
            self._vina_available = bool(vina_available())
            self._gnina_available = bool(resolve_tool("gnina").available)
            self._obabel_available = bool(resolve_tool("obabel").available)
        except Exception:
            self._vina_available = False
            self._gnina_available = False
            self._obabel_available = False

        gnina_requested = "gnina" in str(engine_str)
        can_execute_requested_engine = self._vina_available or (gnina_requested and self._gnina_available)
        if not can_execute_requested_engine:
            self._mock_mode = True
            self.add_warning("AutoDock Vina/Smina not found. Running in labeled mock mode; scores are not real docking evidence.")
        if gnina_requested and not self._gnina_available:
            self.add_warning("GNINA requested but GNINA binary was not found. Standalone Q-Dock will not claim GNINA evidence.")
        if self._vina_available and not self._obabel_available and receptor_path.suffix.lower() != ".pdbqt":
            self.add_warning("OpenBabel not found; receptor conversion may fail and force mock mode.")

        try:
            if ligand_path.suffix.lower() == ".csv":
                df = pd.read_csv(ligand_path)
                smiles_cols = [c for c in df.columns if c.lower() in ["smiles", "smi", "canonical_smiles"]]
                if not smiles_cols:
                    raise ModuleInputError("CSV must have a SMILES column")
                smiles_col = smiles_cols[0]
                name_col = next((c for c in df.columns if c.lower() in ["name", "id", "compound_id", "candidate_id"]), None)
                for row_idx, row in df.iterrows():
                    smiles = str(row[smiles_col])
                    mol = Chem.MolFromSmiles(smiles)
                    if mol:
                        name = str(row[name_col]) if name_col else f"lig_{row_idx}"
                        self.ligand_mols.append({"idx": row_idx, "smiles": Chem.MolToSmiles(mol), "name": name, "mol": mol})
            elif ligand_path.suffix.lower() == ".sdf":
                suppl = Chem.SDMolSupplier(str(ligand_path))
                for i, mol in enumerate(suppl):
                    if mol:
                        smiles = Chem.MolToSmiles(mol)
                        name = mol.GetProp("_Name") if mol.HasProp("_Name") else f"lig_{i}"
                        self.ligand_mols.append({"idx": i, "smiles": smiles, "name": name, "mol": mol})
            else:
                raise ModuleInputError(f"Unsupported ligand format: {ligand_path.suffix}")
            if not self.ligand_mols:
                raise ModuleInputError("No valid ligands found in input file")
            self.add_usage_requested("docking_pairs", len(self.ligand_mols))
            if gnina_requested:
                self.add_usage_requested("gnina_pairs", len(self.ligand_mols))
        except ModuleInputError:
            raise
        except Exception as e:
            raise ModuleInputError(f"Failed to load ligands: {e}")

        if payload.get("pocket_source") == "uploaded_box":
            if not payload.get("pocket_box"):
                raise ModuleInputError("pocket_box required when pocket_source=uploaded_box")
            pb = payload["pocket_box"]
            self.pocket_box = PocketBox(
                center_x=pb["center_x"], center_y=pb["center_y"], center_z=pb["center_z"],
                size_x=pb["size_x"], size_y=pb["size_y"], size_z=pb["size_z"],
            )
        else:
            raise ModuleInputError("Only pocket_source='uploaded_box' is currently supported by this standalone runner.")

    def _prepare_receptor_pdbqt(self, out_dir: Path) -> Path:
        out_dir.mkdir(parents=True, exist_ok=True)
        if self.receptor_path is None:
            raise ModuleExecutionError("Receptor path not resolved")
        if self.receptor_path.suffix.lower() == ".pdbqt":
            return self.receptor_path
        pdbqt_path = out_dir / f"{self.receptor_path.stem}_receptor.pdbqt"
        if pdbqt_path.exists() and pdbqt_path.stat().st_size > 0:
            return pdbqt_path
        if not self._obabel_available:
            raise ModuleExecutionError("OpenBabel required to convert receptor to PDBQT but not found.")
        from q_ai_drug.docking.vina_runner import _run_obabel
        result = _run_obabel(self.receptor_path, pdbqt_path, "-xr", timeout=900)
        if result.returncode != 0 or not pdbqt_path.exists():
            raise ModuleExecutionError(f"Receptor PDBQT conversion failed: {result.stderr[:500]}")
        return pdbqt_path

    def _prepare_ligand_sdf(self, ligand_info: dict[str, Any], pose_dir: Path) -> Path:
        name = ligand_info["name"]
        pose_dir.mkdir(parents=True, exist_ok=True)
        mol3d = Chem.AddHs(ligand_info["mol"])
        status = AllChem.EmbedMolecule(mol3d, randomSeed=42)
        if status != 0:
            status = AllChem.EmbedMolecule(mol3d, randomSeed=42, useRandomCoords=True)
        if status != 0:
            raise RuntimeError(f"Could not embed 3D conformer for {name}")
        props = AllChem.MMFFGetMoleculeProperties(mol3d)
        if props is not None:
            AllChem.MMFFOptimizeMolecule(mol3d, maxIters=200)
        else:
            AllChem.UFFOptimizeMolecule(mol3d, maxIters=200)
        sdf_path = pose_dir / f"{name}.sdf"
        writer = Chem.SDWriter(str(sdf_path))
        writer.write(mol3d)
        writer.close()
        return sdf_path

    def _prepare_ligand_pdbqt(self, ligand_info: dict[str, Any], pose_dir: Path) -> tuple[Path, Path]:
        name = ligand_info["name"]
        sdf_path = self._prepare_ligand_sdf(ligand_info, pose_dir)
        pdbqt_path = pose_dir / f"{name}.pdbqt"
        if not self._obabel_available:
            raise RuntimeError("obabel not available for PDBQT conversion")
        from q_ai_drug.docking.vina_runner import _run_obabel
        result = _run_obabel(sdf_path, pdbqt_path, timeout=300)
        if result.returncode != 0 or not pdbqt_path.exists():
            raise RuntimeError(f"Ligand PDBQT conversion failed: {result.stderr[:300]}")
        return sdf_path, pdbqt_path

    def _resolve_engine(self, requested_engine: str) -> tuple[str, str]:
        """Return (tool_name, evidence_label) for actual execution."""
        if "gnina" in requested_engine and self._gnina_available:
            return "gnina", "real_docking_gnina"
        if "gnina" in requested_engine and not self._gnina_available:
            self.add_warning("GNINA requested, but GNINA is unavailable. Using Vina/Smina-compatible docking evidence only when available.")
        if requested_engine in ("smina",) and self._vina_available:
            return "smina", "real_docking_smina_compatible"
        if requested_engine in ("vina_smina", "vina_smina_gnina", "gnina", "vina"):
            return "vina", "real_docking_vina"
        return "vina", "real_docking_vina"

    def _dock_real(self, ligand_info: dict[str, Any], receptor_pdbqt: Path, poses_dir: Path, logs_dir: Path, engine: str, exhaustiveness: int) -> dict[str, Any]:
        from q_ai_drug.docking.vina_runner import _dock_with_vina, _run_obabel, parse_vina_log
        name = ligand_info["name"]
        pose_dir = poses_dir / name
        pose_dir.mkdir(parents=True, exist_ok=True)
        started = time.time()
        _, ligand_pdbqt = self._prepare_ligand_pdbqt(ligand_info, pose_dir)
        center = (self.pocket_box.center_x, self.pocket_box.center_y, self.pocket_box.center_z)
        box_size = max(self.pocket_box.size_x, self.pocket_box.size_y, self.pocket_box.size_z)
        out_pose = pose_dir / f"{name}_docked.pdbqt"
        tool_name, evidence_label = self._resolve_engine(engine)
        self._actual_engine_used = tool_name
        result, best_affinity = _dock_with_vina(
            tool_name, receptor_pdbqt, ligand_pdbqt, out_pose, center,
            box_size=box_size, exhaustiveness=exhaustiveness, num_modes=9, cpu=2, timeout=300,
        )
        log_text = result.stdout + "\n" + result.stderr
        log_path = logs_dir / f"{name}_{tool_name}.log"
        log_path.write_text(log_text, encoding="utf-8", errors="replace")
        if best_affinity is None:
            raise RuntimeError(f"Docking produced no parseable affinity. Log: {log_text[-300:]}")
        modes = parse_vina_log(log_text)
        rmsd_lb = modes[0].get("dist_from_best_lb") if modes else None
        rmsd_ub = modes[0].get("dist_from_best_ub") if modes else None
        pose_sdf = pose_dir / f"{name}_docked.sdf"
        if out_pose.exists():
            _run_obabel(out_pose, pose_sdf, timeout=120)
        self._add_interaction_fingerprint(name, ligand_info["smiles"], pose_sdf, True)
        return {
            "name": name,
            "candidate_id": name,
            "canonical_smiles": ligand_info["smiles"],
            "smiles": ligand_info["smiles"],
            "requested_engine": engine,
            "engine": tool_name,
            "execution_mode": evidence_label,
            "vina_score": round(best_affinity, 3),
            "rmsd_lb": rmsd_lb,
            "rmsd_ub": rmsd_ub,
            "binding_class": "strong" if best_affinity <= -8.0 else "moderate" if best_affinity <= -7.0 else "weak",
            "status": "docked",
            "docking_is_real": True,
            "pose_pdbqt_path": str(out_pose) if out_pose.exists() else None,
            "pose_sdf_path": str(pose_sdf) if pose_sdf.exists() else None,
            "log_path": str(log_path),
            "runtime_s": round(time.time() - started, 2),
            "exhaustiveness": exhaustiveness,
        }

    def _dock_gnina(self, ligand_info: dict[str, Any], poses_dir: Path, logs_dir: Path, engine: str, exhaustiveness: int) -> dict[str, Any]:
        from q_ai_drug.docking.gnina_runner import _parse_gnina_output, _parse_gnina_warnings
        from q_ai_drug.tools.external import resolve_tool, run_external, windows_to_wsl_path

        if self.receptor_path is None or self.pocket_box is None:
            raise ModuleExecutionError("GNINA inputs not resolved")
        tool = resolve_tool("gnina")
        if not tool.available:
            raise RuntimeError("GNINA requested but binary is not available")

        name = ligand_info["name"]
        pose_dir = poses_dir / name
        pose_dir.mkdir(parents=True, exist_ok=True)
        started = time.time()
        ligand_sdf = self._prepare_ligand_sdf(ligand_info, pose_dir)
        out_pose = pose_dir / f"{name}_gnina.sdf"
        log_path = logs_dir / f"{name}_gnina.log"
        center = (self.pocket_box.center_x, self.pocket_box.center_y, self.pocket_box.center_z)

        def external_path(path: Path) -> str:
            return windows_to_wsl_path(path) if tool.via_wsl else str(path)

        args = [
            "--no_gpu",
            "--cpu",
            "2",
            "--seed",
            "17",
            "--exhaustiveness",
            str(exhaustiveness),
            "--num_modes",
            "9",
            "-r",
            external_path(self.receptor_path),
            "-l",
            external_path(ligand_sdf),
            "--center_x",
            f"{center[0]:.3f}",
            "--center_y",
            f"{center[1]:.3f}",
            "--center_z",
            f"{center[2]:.3f}",
            "--size_x",
            f"{self.pocket_box.size_x:.3f}",
            "--size_y",
            f"{self.pocket_box.size_y:.3f}",
            "--size_z",
            f"{self.pocket_box.size_z:.3f}",
            "-o",
            external_path(out_pose),
        ]
        run = run_external("gnina", args, cwd=pose_dir, timeout=900, check=False)
        log_text = run.stdout + "\n" + run.stderr
        log_path.write_text(log_text, encoding="utf-8", errors="replace")
        metrics = _parse_gnina_output(log_text)
        completed = run.returncode == 0 and out_pose.exists()
        if not completed:
            raise RuntimeError(f"GNINA failed with return code {run.returncode}. Log: {log_text[-500:]}")
        if metrics.get("gnina_cnn_pose_score") is None:
            self.add_warning(f"GNINA completed for {name}, but CNN metrics were not parseable from the log.")

        self._actual_engine_used = "gnina"
        self._gnina_executed_count += 1
        self.add_usage_actual("gnina_pairs", 1)
        self._add_interaction_fingerprint(name, ligand_info["smiles"], out_pose, True)
        affinity = metrics.get("gnina_affinity_kcal_mol")
        return {
            "name": name,
            "candidate_id": name,
            "canonical_smiles": ligand_info["smiles"],
            "smiles": ligand_info["smiles"],
            "requested_engine": engine,
            "engine": "gnina",
            "actual_engine_used": "gnina",
            "execution_mode": "real_docking_gnina",
            "vina_score": round(float(affinity), 3) if affinity is not None else None,
            "gnina_status": "completed",
            "gnina_returncode": run.returncode,
            "gnina_affinity_kcal_mol": metrics.get("gnina_affinity_kcal_mol"),
            "gnina_intramol_kcal_mol": metrics.get("gnina_intramol_kcal_mol"),
            "gnina_cnn_pose_score": metrics.get("gnina_cnn_pose_score"),
            "gnina_cnn_affinity": metrics.get("gnina_cnn_affinity"),
            "gnina_pose_sdf_path": str(out_pose),
            "gnina_log_path": str(log_path),
            "gnina_mode": "standalone_gnina_cpu_uploaded_box",
            "gnina_warnings": _parse_gnina_warnings(log_text),
            "gnina_output_excerpt": "\n".join(log_text.splitlines()[-20:]),
            "rmsd_lb": None,
            "rmsd_ub": None,
            "binding_class": "strong" if affinity is not None and affinity <= -8.0 else "moderate" if affinity is not None and affinity <= -7.0 else "weak",
            "status": "docked",
            "docking_is_real": True,
            "pose_pdbqt_path": None,
            "pose_sdf_path": str(out_pose),
            "log_path": str(log_path),
            "runtime_s": round(time.time() - started, 2),
            "exhaustiveness": exhaustiveness,
            "claim_boundary": "GNINA CNN docking/rescoring is computational evidence only; not measured binding or therapeutic validation.",
        }

    def _dock_mock(self, ligand_info: dict[str, Any], engine: str, exhaustiveness: int) -> dict[str, Any]:
        import hashlib
        smiles = ligand_info["smiles"]
        raw = hashlib.sha256(smiles.encode()).hexdigest()[:8]
        mock_score = -5.0 - (int(raw, 16) % 400) / 100.0
        self._add_interaction_fingerprint(ligand_info["name"], smiles, None, False)
        return {
            "name": ligand_info["name"],
            "candidate_id": ligand_info["name"],
            "canonical_smiles": smiles,
            "smiles": smiles,
            "requested_engine": engine,
            "engine": "mock",
            "execution_mode": "mock_docking",
            "vina_score": round(mock_score, 3),
            "rmsd_lb": None,
            "rmsd_ub": None,
            "binding_class": "mock",
            "status": "mock_docked",
            "docking_is_real": False,
            "pose_pdbqt_path": None,
            "pose_sdf_path": None,
            "log_path": None,
            "runtime_s": 0.0,
            "exhaustiveness": exhaustiveness,
            "mock_note": "Vina/obabel unavailable. Score is a SMILES hash, not docking evidence.",
        }

    def _add_interaction_fingerprint(self, candidate_id: str, smiles: str, pose_sdf: Path | None, is_real: bool) -> None:
        if is_real and pose_sdf and pose_sdf.exists() and self.receptor_path and self.receptor_path.suffix.lower() == ".pdb":
            try:
                from q_ai_drug.docking.interactions import compute_interaction_fingerprint
                row = compute_interaction_fingerprint(self.receptor_path, pose_sdf, candidate_id).to_row()
                row["canonical_smiles"] = smiles
                row["docking_is_real"] = True
                self.interaction_fingerprints.append(row)
                return
            except Exception as exc:
                self.add_warning(f"Geometric interaction parsing failed for {candidate_id}: {exc}")
        self.interaction_fingerprints.append({
            "candidate_id": candidate_id,
            "canonical_smiles": smiles,
            "pose_file": str(pose_sdf) if pose_sdf and pose_sdf.exists() else None,
            "docking_is_real": is_real,
            "contact_residues": "not_computed",
            "contact_count": 0,
            "hbond_like_contacts": None,
            "hydrophobic_contacts": None,
            "salt_bridge_like_contacts": None,
            "interaction_quality": "mock_no_contacts" if not is_real else "geometric_proxy_failed_or_unavailable",
            "failure_reason": None if not is_real else "requires readable PDB receptor and SDF pose",
            "claim_boundary": "Geometric proxy only; not a validated biochemical interaction fingerprint.",
        })

    def _resolve_reference_ligand(self) -> Path | None:
        ref = self.validated_payload.get("reference_ligand_file")
        if not ref:
            return None
        path = Path(ref)
        if path.exists():
            return path
        upload_path = self.project_dir / "uploads" / ref
        if upload_path.exists():
            return upload_path
        return None

    def _write_redocking_validation_stub(self) -> None:
        if not self.validated_payload.get("run_redocking_validation"):
            return
        ref_path = self._resolve_reference_ligand()
        first_pose = next((Path(r["pose_sdf_path"]) for r in self.docking_results if r.get("docking_is_real") and r.get("pose_sdf_path") and Path(r["pose_sdf_path"]).exists()), None)
        if ref_path is None:
            status = "not_run_missing_reference_ligand"
            row = {
                "requested": True,
                "reference_ligand_file": self.validated_payload.get("reference_ligand_file"),
                "docked_pose_file": str(first_pose) if first_pose else None,
                "validation_status": status,
                "rmsd_angstrom": None,
                "validation_pass": None,
                "reason": "reference_ligand_file not provided or not found",
                "rmsd_threshold_angstrom": 2.0,
                "claim_boundary": "Redocking validation requires a readable reference ligand pose.",
            }
            self.redocking_rows.append(row)
            self.add_warning(f"Redocking validation requested but {status}.")
            return
        if first_pose is None:
            status = "not_run_missing_docked_pose"
            self.redocking_rows.append({
                "requested": True,
                "reference_ligand_file": str(ref_path),
                "docked_pose_file": None,
                "validation_status": status,
                "rmsd_angstrom": None,
                "validation_pass": None,
                "reason": "no real docked SDF pose available",
                "rmsd_threshold_angstrom": 2.0,
                "claim_boundary": "Redocking validation requires a real docked SDF pose.",
            })
            self.add_warning(f"Redocking validation requested but {status}.")
            return
        try:
            from q_ai_drug.docking.redocking import compute_pose_rmsd
            validation = compute_pose_rmsd(ref_path, first_pose)
            row = validation.to_row(ref_path, first_pose)
            row["requested"] = True
            row["claim_boundary"] = "Redocking RMSD is a docking-setup validation proxy, not biological validation."
            self.redocking_rows.append(row)
            if validation.validation_pass is False:
                self.add_warning(f"Redocking validation did not pass: {validation.reason or validation.rmsd_angstrom}")
        except Exception as exc:
            self.redocking_rows.append({
                "requested": True,
                "reference_ligand_file": str(ref_path),
                "docked_pose_file": str(first_pose),
                "validation_status": "validation_failed",
                "rmsd_angstrom": None,
                "validation_pass": False,
                "reason": f"RMSD helper failed: {exc}",
                "rmsd_threshold_angstrom": 2.0,
                "claim_boundary": "Redocking RMSD could not be computed.",
            })

    def run(self) -> None:
        if not self.ligand_mols or not self.pocket_box:
            raise ModuleExecutionError("Inputs not fully resolved")
        payload = self.validated_payload
        max_ligands = payload.get("max_ligands")
        engine_val = payload.get("engine", "vina_smina")
        engine = engine_val.value if hasattr(engine_val, "value") else str(engine_val)
        self._requested_engine = engine
        exhaustiveness = payload.get("exhaustiveness", 8)
        ligands_to_dock = self.ligand_mols[:max_ligands] if max_ligands else self.ligand_mols
        poses_dir = self.output_dir / "poses"
        logs_dir = self.output_dir / "docking_logs"
        poses_dir.mkdir(parents=True, exist_ok=True)
        logs_dir.mkdir(parents=True, exist_ok=True)

        gnina_requested_and_available = "gnina" in engine and self._gnina_available
        receptor_pdbqt = None
        if not self._mock_mode and not gnina_requested_and_available:
            try:
                receptor_prep_dir = self.output_dir / "receptor_prep"
                receptor_prep_dir.mkdir(parents=True, exist_ok=True)
                receptor_pdbqt = self._prepare_receptor_pdbqt(receptor_prep_dir)
            except ModuleExecutionError as e:
                self.add_warning(f"Receptor preparation failed: {e}. Switching to mock mode.")
                self._mock_mode = True

        success_count = 0
        failed_count = 0
        for ligand_info in ligands_to_dock:
            idx = ligand_info["idx"]
            smiles = ligand_info["smiles"]
            name = ligand_info["name"]
            try:
                if not self._mock_mode and gnina_requested_and_available:
                    result = self._dock_gnina(ligand_info, poses_dir, logs_dir, engine, exhaustiveness)
                elif not self._mock_mode and receptor_pdbqt is not None:
                    result = self._dock_real(ligand_info, receptor_pdbqt, poses_dir, logs_dir, engine, exhaustiveness)
                else:
                    result = self._dock_mock(ligand_info, engine, exhaustiveness)
                result["idx"] = idx
                self.docking_results.append(result)
                success_count += 1
            except Exception as e:
                failed_count += 1
                self.failure_results.append({"idx": idx, "name": name, "smiles": smiles, "reason": f"Docking failed: {str(e)[:200]}", "engine": engine})
        self._write_redocking_validation_stub()
        self.add_usage_actual("docking_pairs", len(ligands_to_dock))
        self.add_usage_actual("completed_docking_pairs", success_count)
        self.add_usage_actual("failed_docking_pairs", failed_count)
        if failed_count > 0:
            self.add_warning(f"{failed_count} ligands ({(failed_count / len(ligands_to_dock)) * 100:.1f}%) failed docking")

    def write_outputs(self) -> None:
        if self.docking_results:
            self.register_artifact(self.write_csv(self.docking_results, "docking_results"), "csv", "Docking results")
        if self.failure_results:
            self.register_artifact(self.write_csv(self.failure_results, "docking_failure_table"), "csv", "Docking failure table")
        if self.interaction_fingerprints:
            self.register_artifact(self.write_csv(self.interaction_fingerprints, "interaction_fingerprints"), "csv", "Interaction fingerprints")
        if self.redocking_rows:
            self.register_artifact(self.write_csv(self.redocking_rows, "redocking_validation"), "csv", "Redocking validation")
        real_count = sum(1 for r in self.docking_results if r.get("docking_is_real"))
        mock_count = sum(1 for r in self.docking_results if not r.get("docking_is_real"))
        redocking_status = self.redocking_rows[0].get("validation_status") if self.redocking_rows else "not_requested"
        redocking_rmsd = self.redocking_rows[0].get("rmsd_angstrom") if self.redocking_rows else None
        redocking_pass = self.redocking_rows[0].get("validation_pass") if self.redocking_rows else None
        summary = {
            "module_id": "q_dock_studio",
            "pocket": {"center": [self.pocket_box.center_x, self.pocket_box.center_y, self.pocket_box.center_z], "size": [self.pocket_box.size_x, self.pocket_box.size_y, self.pocket_box.size_z]},
            "total_docking_pairs": self.usage_actual.get("docking_pairs", 0),
            "successful": self.usage_actual.get("completed_docking_pairs", 0),
            "failed": self.usage_actual.get("failed_docking_pairs", 0),
            "real_docking_rows": real_count,
            "mock_docking_rows": mock_count,
            "requested_engine": self._requested_engine,
            "actual_engine_used": self._actual_engine_used,
            "vina_available": self._vina_available,
            "gnina_available": self._gnina_available,
            "obabel_available": self._obabel_available,
            "mock_mode": self._mock_mode,
            "gnina_executed": self._gnina_executed_count > 0,
            "gnina_rows": self._gnina_executed_count,
            "redocking_requested": bool(self.validated_payload.get("run_redocking_validation")),
            "redocking_status": redocking_status,
            "redocking_rmsd_angstrom": redocking_rmsd,
            "redocking_validation_pass": redocking_pass,
            "interaction_fingerprint_method": "geometric_proxy_or_mock_placeholder",
            "warnings": self.warnings,
        }
        self.register_artifact(self.write_json(summary, "q_dock_summary"), "json", "Docking summary")

    def get_result(self, status: str = "succeeded") -> dict[str, Any]:
        result = super().get_result(status)
        real_count = sum(1 for r in self.docking_results if r.get("docking_is_real"))
        if status == "failed":
            pass
        elif self._mock_mode or real_count == 0:
            result["execution_mode"] = "mock_docking"
            result["claim_boundary"] = "MOCK DOCKING - scores are not physical docking evidence. Wet-lab validation required."
            result["failure_code"] = FailureCode.TOOL_UNAVAILABLE.value
        else:
            if self._actual_engine_used == "gnina":
                result["execution_mode"] = "real_docking_gnina"
            elif self._actual_engine_used == "vina":
                result["execution_mode"] = "real_docking_vina"
            else:
                result["execution_mode"] = "real_docking_smina_compatible"
            result["claim_boundary"] = "Computational docking hypothesis only. Not a measured binding or therapeutic claim."
        result["gnina_executed"] = self._gnina_executed_count > 0
        result["requested_engine"] = self._requested_engine
        result["actual_engine_used"] = self._actual_engine_used
        return result


def run_q_dock_studio(project_dir: Path, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    runner = QDockStudioRunner("q_dock_studio", project_dir, run_id, payload)
    return runner.execute()
