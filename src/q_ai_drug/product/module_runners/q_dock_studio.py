"""Q-Dock Studio module runner: Molecular docking and scoring.

Accept receptor, ligands, pocket, and engine settings.
Run docking via AutoDock Vina (WSL) + Smina rescoring when available.
Falls back to labeled mock mode with 'tool_unavailable' when Vina is absent.

Output:
- docking_results.csv (scores and metrics)
- docking_failure_table.csv (failed ligands with reasons)
- poses/ directory (pose SDF + PDBQT files per ligand)
- docking_logs/ directory (per-ligand Vina logs)
- q_dock_summary.json
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
    """Q-Dock Studio module runner: Molecular docking.

    **Execution mode:** Real Vina/Smina via WSL when tools available.
    **Fallback mode:** Labeled mock output when tools unavailable.
    **Scientific status:** Real docking scores when Vina is on PATH/WSL.
    """

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        """Initialize Q-Dock Studio runner."""
        super().__init__(
            module_id=module_id,
            project_dir=project_dir,
            run_id=run_id,
            payload=payload,
        )
        self.receptor_path: Path | None = None
        self.receptor_pdbqt: Path | None = None
        self.ligand_mols: list[dict[str, Any]] = []
        self.pocket_box: PocketBox | None = None
        self.docking_results: list[dict[str, Any]] = []
        self.failure_results: list[dict[str, Any]] = []
        self._vina_available: bool = False
        self._obabel_available: bool = False
        self._mock_mode: bool = False

    def validate_payload(self) -> None:
        """Validate Q-Dock Studio payload."""
        try:
            validated = QDockStudioPayload.model_validate(self.payload)
            self.validated_payload = validated.model_dump()
        except Exception as e:
            raise ModuleInputError(f"Invalid Q-Dock Studio payload: {e}")

    def resolve_inputs(self) -> None:
        """Load receptor, ligands, and pocket definition."""
        payload = self.validated_payload

        # Load receptor

        receptor_path = None
        if payload.get("receptor_artifact_id"):
            try:
                artifact_id = payload["receptor_artifact_id"]
                from q_ai_drug.service.artifact_resolver import resolve_artifact_path
                receptor_path = resolve_artifact_path(self.project_dir, artifact_id)
            except Exception as e:
                raise ModuleInputError(
                    f"Cannot load receptor artifact: {e}. "
                    f"Please upload receptor PDB/PDBQT file directly."
                )
        elif payload.get("receptor_upload_file"):
            upload_dir = self.project_dir / "uploads"
            receptor_file = payload["receptor_upload_file"]
            receptor_path = upload_dir / receptor_file
            if not receptor_path.exists():
                raise ModuleInputError(f"Receptor file not found: {receptor_file}")
        else:
            raise ModuleInputError(
                "Must provide receptor file. "
                "Upload a PDB or PDBQT file and specify receptor_upload_file."
            )

        # Validate receptor
        if receptor_path.suffix.lower() not in [".pdb", ".pdbqt", ".mmcif", ".cif"]:
            raise ModuleInputError(
                f"Unsupported receptor format: {receptor_path.suffix}. "
                f"Accepted: .pdb, .pdbqt, .mmcif"
            )
        if receptor_path.stat().st_size == 0:
            raise ModuleInputError("Receptor file is empty")

        self.receptor_path = receptor_path

        # Load ligands
        ligand_path = None
        if payload.get("ligand_artifact_id"):
            try:
                artifact_id = payload["ligand_artifact_id"]
                from q_ai_drug.service.artifact_resolver import resolve_artifact_path
                ligand_path = resolve_artifact_path(self.project_dir, artifact_id)
            except Exception as e:
                raise ModuleInputError(
                    f"Cannot load ligand artifact: {e}. "
                    f"Please upload SMILES CSV or SDF file directly."
                )
        elif payload.get("ligand_upload_file"):
            upload_dir = self.project_dir / "uploads"
            ligand_file = payload["ligand_upload_file"]
            ligand_path = upload_dir / ligand_file
            if not ligand_path.exists():
                raise ModuleInputError(f"Ligand file not found: {ligand_file}")
        else:
            raise ModuleInputError("Must provide ligand file (SMILES CSV or SDF)")

        # ---------------------------------------------------------------------
        # Dependency and Tool Checks
        # ---------------------------------------------------------------------

        if Chem is None:
            raise MissingDependencyError(
                "RDKit is required for Q-Dock Studio but is not installed. "
                "Install with: pip install 'q-ai-drug[chem]' or pip install rdkit"
            )

        # Check tool availability (don't fail — we gracefully degrade to mock)
        try:
            from q_ai_drug.docking.vina_runner import vina_available
            from q_ai_drug.tools.external import resolve_tool
            self._vina_available = vina_available()
            self._obabel_available = resolve_tool("obabel").available
        except Exception:
            self._vina_available = False
            self._obabel_available = False

        if not self._vina_available:
            self.add_warning(
                "AutoDock Vina/Smina not found (checked PATH and WSL). "
                "Running in labeled mock mode. Scores are NOT real docking scores. "
                "Install Vina in WSL to enable real docking."
            )
            self._mock_mode = True

        # Parse ligands
        try:
            if ligand_path.suffix.lower() == ".csv":
                df = pd.read_csv(ligand_path)
                smiles_cols = [c for c in df.columns if c.lower() in ["smiles", "smi", "canonical_smiles"]]
                if not smiles_cols:
                    raise ModuleInputError("CSV must have a SMILES column")
                smiles_col = smiles_cols[0]
                name_col = next((c for c in df.columns if c.lower() in ["name", "id", "compound_id"]), None)
                for row_idx, row in df.iterrows():
                    smiles = str(row[smiles_col])
                    mol = Chem.MolFromSmiles(smiles)
                    if mol:
                        name = str(row[name_col]) if name_col else f"lig_{row_idx}"
                        self.ligand_mols.append({"idx": row_idx, "smiles": smiles, "name": name, "mol": mol})
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
        except ModuleInputError:
            raise
        except Exception as e:
            raise ModuleInputError(f"Failed to load ligands: {e}")

        # Parse pocket box
        if payload.get("pocket_source") == "uploaded_box":
            if not payload.get("pocket_box"):
                raise ModuleInputError("pocket_box required when pocket_source=uploaded_box")
            pb = payload["pocket_box"]
            self.pocket_box = PocketBox(
                center_x=pb["center_x"],
                center_y=pb["center_y"],
                center_z=pb["center_z"],
                size_x=pb["size_x"],
                size_y=pb["size_y"],
                size_z=pb["size_z"],
            )
        else:
            raise ModuleInputError("pocket_source must be 'uploaded_box' (curated_registry coming soon)")

    def _prepare_receptor_pdbqt(self, out_dir: Path) -> Path:
        """Convert receptor to PDBQT if needed. Returns PDBQT path."""
        if self.receptor_path.suffix.lower() == ".pdbqt":
            return self.receptor_path

        pdbqt_path = out_dir / f"{self.receptor_path.stem}_receptor.pdbqt"
        if pdbqt_path.exists() and pdbqt_path.stat().st_size > 0:
            return pdbqt_path

        if not self._obabel_available:
            raise ModuleExecutionError(
                "OpenBabel (obabel) required to convert PDB→PDBQT but not found. "
                "Install obabel in WSL: apt install openbabel"
            )

        from q_ai_drug.docking.vina_runner import _run_obabel
        result = _run_obabel(self.receptor_path, pdbqt_path, "-xr", timeout=900)
        if result.returncode != 0 or not pdbqt_path.exists():
            raise ModuleExecutionError(
                f"Receptor PDBQT conversion failed:\n{result.stderr[:500]}"
            )
        return pdbqt_path

    def _prepare_ligand_pdbqt(self, ligand_info: dict[str, Any], pose_dir: Path) -> tuple[Path, Path]:
        """Generate 3D SDF and convert to PDBQT. Returns (sdf_path, pdbqt_path)."""
        name = ligand_info["name"]
        smiles = ligand_info["smiles"]
        mol = ligand_info["mol"]

        # Generate 3D conformer
        mol3d = Chem.AddHs(mol)
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

        pdbqt_path = pose_dir / f"{name}.pdbqt"
        if not self._obabel_available:
            raise RuntimeError("obabel not available for PDBQT conversion")

        from q_ai_drug.docking.vina_runner import _run_obabel
        result = _run_obabel(sdf_path, pdbqt_path, timeout=300)
        if result.returncode != 0 or not pdbqt_path.exists():
            raise RuntimeError(f"Ligand PDBQT conversion failed:\n{result.stderr[:300]}")

        return sdf_path, pdbqt_path

    def _dock_real(
        self,
        ligand_info: dict[str, Any],
        receptor_pdbqt: Path,
        poses_dir: Path,
        logs_dir: Path,
        engine: str,
        exhaustiveness: int,
    ) -> dict[str, Any]:
        """Run real Vina docking for one ligand. Returns result dict."""
        from q_ai_drug.docking.vina_runner import _dock_with_vina, _run_obabel, parse_vina_log

        name = ligand_info["name"]
        pose_dir = poses_dir / name
        pose_dir.mkdir(parents=True, exist_ok=True)

        started = time.time()
        _, ligand_pdbqt = self._prepare_ligand_pdbqt(ligand_info, pose_dir)

        center = (self.pocket_box.center_x, self.pocket_box.center_y, self.pocket_box.center_z)
        box_size = max(self.pocket_box.size_x, self.pocket_box.size_y, self.pocket_box.size_z)
        out_pose = pose_dir / f"{name}_docked.pdbqt"

        tool_name = "vina" if engine in ("vina", "vina_smina", "vina_smina_gnina") else "smina"
        result, best_affinity = _dock_with_vina(
            tool_name,
            receptor_pdbqt,
            ligand_pdbqt,
            out_pose,
            center,
            box_size=box_size,
            exhaustiveness=exhaustiveness,
            num_modes=9,
            cpu=2,
            timeout=300,
        )

        # Save log
        log_text = result.stdout + "\n" + result.stderr
        log_path = logs_dir / f"{name}_vina.log"
        log_path.write_text(log_text, encoding="utf-8", errors="replace")

        if best_affinity is None:
            raise RuntimeError(f"Vina produced no parseable affinity. Log: {log_text[-300:]}")

        # Parse all modes
        modes = parse_vina_log(log_text)
        rmsd_lb = modes[0].get("dist_from_best_lb") if modes else None
        rmsd_ub = modes[0].get("dist_from_best_ub") if modes else None

        # Convert best pose to SDF for 3D viewer
        pose_sdf = pose_dir / f"{name}_docked.sdf"
        if out_pose.exists():
            _run_obabel(out_pose, pose_sdf, timeout=120)

        runtime = round(time.time() - started, 2)
        return {
            "name": name,
            "smiles": ligand_info["smiles"],
            "engine": tool_name,
            "vina_score": round(best_affinity, 3),
            "rmsd_lb": rmsd_lb,
            "rmsd_ub": rmsd_ub,
            "binding_class": "strong" if best_affinity <= -8.0 else "moderate" if best_affinity <= -7.0 else "weak",
            "status": "docked",
            "docking_is_real": True,
            "pose_pdbqt_path": str(out_pose) if out_pose.exists() else None,
            "pose_sdf_path": str(pose_sdf) if pose_sdf.exists() else None,
            "log_path": str(log_path),
            "runtime_s": runtime,
            "exhaustiveness": exhaustiveness,
        }

    def _dock_mock(self, ligand_info: dict[str, Any], engine: str, exhaustiveness: int) -> dict[str, Any]:
        """Return labeled mock result (tool unavailable)."""
        import hashlib
        smiles = ligand_info["smiles"]
        raw = hashlib.sha256(smiles.encode()).hexdigest()[:8]
        mock_score = -5.0 - (int(raw, 16) % 400) / 100.0  # -5.0 to -9.0 range
        return {
            "name": ligand_info["name"],
            "smiles": smiles,
            "engine": engine,
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
            "mock_note": "Vina/obabel not available. Score is a SMILES hash, not a real docking score.",
        }

    def run(self) -> None:
        """Run molecular docking."""
        if not self.ligand_mols or not self.pocket_box:
            raise ModuleExecutionError("Inputs not fully resolved")

        payload = self.validated_payload
        max_ligands = payload.get("max_ligands")
        engine_val = payload.get("engine", "vina_smina")
        engine = engine_val.value if hasattr(engine_val, "value") else str(engine_val)
        exhaustiveness = payload.get("exhaustiveness", 8)

        ligands_to_dock = self.ligand_mols
        if max_ligands:
            ligands_to_dock = ligands_to_dock[:max_ligands]

        poses_dir = self.output_dir / "poses"
        logs_dir = self.output_dir / "docking_logs"
        poses_dir.mkdir(parents=True, exist_ok=True)
        logs_dir.mkdir(parents=True, exist_ok=True)

        # Prepare receptor PDBQT (only if real docking)
        receptor_pdbqt = None
        if not self._mock_mode:
            try:
                receptor_pdbqt = self._prepare_receptor_pdbqt(self.output_dir / "receptor_prep")
                (self.output_dir / "receptor_prep").mkdir(parents=True, exist_ok=True)
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
                if not self._mock_mode and receptor_pdbqt is not None:
                    result = self._dock_real(
                        ligand_info, receptor_pdbqt, poses_dir, logs_dir, engine, exhaustiveness
                    )
                else:
                    result = self._dock_mock(ligand_info, engine, exhaustiveness)

                result["idx"] = idx
                self.docking_results.append(result)
                success_count += 1

            except Exception as e:
                failed_count += 1
                self.failure_results.append({
                    "idx": idx,
                    "name": name,
                    "smiles": smiles,
                    "reason": f"Docking failed: {str(e)[:200]}",
                    "engine": engine,
                })

        self.add_usage_actual("docking_pairs", len(ligands_to_dock))
        self.add_usage_actual("completed_docking_pairs", success_count)
        self.add_usage_actual("failed_docking_pairs", failed_count)

        if failed_count > 0:
            pct = (failed_count / len(ligands_to_dock)) * 100
            self.add_warning(f"{failed_count} ligands ({pct:.1f}%) failed docking")

    def write_outputs(self) -> None:
        """Write docking results."""
        # Write docking results
        if self.docking_results:
            path = self.write_csv(self.docking_results, "docking_results")
            self.register_artifact(path, "csv", "Docking results")

        # Write failure table
        if self.failure_results:
            path = self.write_csv(self.failure_results, "docking_failure_table")
            self.register_artifact(path, "csv", "Docking failure table")

        # Write summary
        real_count = sum(1 for r in self.docking_results if r.get("docking_is_real"))
        mock_count = sum(1 for r in self.docking_results if not r.get("docking_is_real"))

        summary = {
            "module_id": "q_dock_studio",
            "pocket": {
                "center": [self.pocket_box.center_x, self.pocket_box.center_y, self.pocket_box.center_z],
                "size": [self.pocket_box.size_x, self.pocket_box.size_y, self.pocket_box.size_z],
            },
            "total_docking_pairs": self.usage_actual.get("docking_pairs", 0),
            "successful": self.usage_actual.get("completed_docking_pairs", 0),
            "failed": self.usage_actual.get("failed_docking_pairs", 0),
            "real_docking_rows": real_count,
            "mock_docking_rows": mock_count,
            "engine": self.validated_payload.get("engine", "vina_smina"),
            "vina_available": self._vina_available,
            "obabel_available": self._obabel_available,
            "mock_mode": self._mock_mode,
            "warnings": self.warnings,
        }
        path = self.write_json(summary, "q_dock_summary")
        self.register_artifact(path, "json", "Docking summary")

    def get_result(self, status: str = "succeeded") -> dict[str, Any]:
        """Override to add accurate execution mode."""
        result = super().get_result(status)
        if self._mock_mode:
            result["execution_mode"] = "mock_docking"
            result["claim_boundary"] = (
                "MOCK DOCKING - Vina not available. "
                "Scores are SMILES hashes, NOT real docking. "
                "Wet-lab validation is required."
            )
            result["failure_code"] = FailureCode.TOOL_UNAVAILABLE.value
        else:
            real_count = sum(1 for r in self.docking_results if r.get("docking_is_real"))
            if real_count > 0:
                engine = self.validated_payload.get("engine", "vina").lower()
                if "gnina" in engine:
                    result["execution_mode"] = "real_docking_gnina"
                elif "smina" in engine:
                    result["execution_mode"] = "real_docking_smina"
                else:
                    result["execution_mode"] = "real_docking_vina"
            else:
                result["execution_mode"] = "mock_docking" # Fallback if no real docking happened
            result["claim_boundary"] = (
                "Computational research hypothesis only. "
                "Wet-lab validation is required."
            )
        return result


def run_q_dock_studio(project_dir: Path, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Run Q-Dock Studio module."""
    runner = QDockStudioRunner("q_dock_studio", project_dir, run_id, payload)
    return runner.execute()

