"""Q-Orbital Analyzer module runner: Quantum descriptors and orbital analysis.

Accept molecular structures, compute HOMO/LUMO/gap and orbital descriptors
using xTB (when available via WSL) with RDKit Extended Hückel fallback.

Mode priority:
  1. xTB GFN2 via WSL subprocess (real quantum chemistry)
  2. RDKit Extended Hückel Theory (real semi-empirical)
  3. Failed row (reported in qm_failure_report.csv)

Output:
- qm_descriptors.csv (HOMO, LUMO, gap, dipole, energy)
- qm_failure_report.csv (failed molecules with reasons)
- qm_descriptor_summary.json
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

import pandas as pd

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, Descriptors
except ImportError:  # pragma: no cover - optional dependency
    Chem = None
    AllChem = None
    Descriptors = None

from q_ai_drug.product.module_runners.base import (
    BaseModuleRunner,
    MissingDependencyError,
    ModuleExecutionError,
    ModuleInputError,
)
from q_ai_drug.service.tool_payloads import QOrbitalAnalyzerPayload


class QOrbitalAnalyzerRunner(BaseModuleRunner):
    """Q-Orbital Analyzer module runner: Quantum descriptor extraction.

    **Execution priority:**
      1. xTB GFN2 via WSL (real QM) when xTB available
      2. RDKit Extended Hückel Theory (real semi-empirical, HOMO/LUMO populated)
      3. Failure row with reason

    **Scientific status:** HOMO/LUMO/gap are real values (not None) from EHT or xTB.
    """

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        """Initialize Q-Orbital Analyzer runner."""
        super().__init__(
            module_id=module_id,
            project_dir=project_dir,
            run_id=run_id,
            payload=payload,
        )
        self.input_molecules: pd.DataFrame | None = None
        self.descriptor_results: list[dict[str, Any]] = []
        self.failure_results: list[dict[str, Any]] = []
        self._xtb_work_dir: Path | None = None

    def validate_payload(self) -> None:
        """Validate Q-Orbital Analyzer payload."""
        try:
            validated = QOrbitalAnalyzerPayload.model_validate(self.payload)
            self.validated_payload = validated.model_dump()
        except Exception as e:
            raise ModuleInputError(f"Invalid Q-Orbital Analyzer payload: {e}")

    def resolve_inputs(self) -> None:
        """Load molecules from artifact or upload file."""
        payload = self.validated_payload

        input_path = None

        if payload.get("candidate_artifact_id"):
            try:
                artifact_id = payload["candidate_artifact_id"]
                from q_ai_drug.service.artifact_resolver import resolve_artifact_path
                input_path = resolve_artifact_path(self.project_dir, artifact_id)
            except Exception as e:
                raise ModuleInputError(
                    f"Cannot load artifact: {e}. "
                    f"Please use file upload instead: Save your SMILES CSV/SDF and upload directly."
                )
        elif payload.get("candidate_upload_file"):
            upload_dir = self.project_dir / "uploads"
            upload_file = payload["candidate_upload_file"]
            input_path = upload_dir / upload_file
            if not input_path.exists():
                raise ModuleInputError(f"Upload file not found: {upload_file}")
        else:
            raise ModuleInputError("Must provide either candidate_artifact_id or candidate_upload_file")

        if Chem is None or AllChem is None:
            raise MissingDependencyError(
                "RDKit is required for Q-Orbital Analyzer but is not installed. "
                "Install with: pip install 'q-ai-drug[chem]' or pip install rdkit"
            )

        try:
            if input_path.suffix.lower() == ".csv":
                df = pd.read_csv(input_path)
                smiles_cols = [c for c in df.columns if c.lower() in ["smiles", "smi", "canonical_smiles"]]
                if not smiles_cols:
                    raise ModuleInputError("CSV must have a SMILES column")
                smiles_col = smiles_cols[0]
                self.input_molecules = df.rename(columns={smiles_col: "SMILES"})
            elif input_path.suffix.lower() == ".sdf":
                suppl = Chem.SDMolSupplier(str(input_path))
                rows = []
                for i, mol in enumerate(suppl):
                    if mol:
                        smiles = Chem.MolToSmiles(mol)
                        rows.append({"SMILES": smiles, "sdf_idx": i})
                self.input_molecules = pd.DataFrame(rows)
            else:
                raise ModuleInputError(f"Unsupported file format: {input_path.suffix}")

            if self.input_molecules.empty:
                raise ModuleInputError("No molecules found in input file")

            self.add_usage_requested("molecule_count", len(self.input_molecules))
        except ModuleInputError:
            raise
        except Exception as e:
            raise ModuleInputError(f"Failed to load molecules: {e}")

    def _compute_qm_for_molecule(
        self,
        smiles: str,
        idx: Any,
        method: str,
        work_dir: Path,
    ) -> dict[str, Any] | None:
        """Compute QM descriptors for a single molecule.

        Returns result dict, or None if failed (caller appends failure row).
        """
        from q_ai_drug.qm.xtb_qm_descriptors import (
            xtb_available,
            xtb_descriptors,
            rdkit_eht_descriptors,
        )

        candidate_id = f"mol_{idx}"

        # Try xTB first (if available and method allows)
        if method in ("xtb", "auto") and xtb_available():
            qm = xtb_descriptors(smiles, work_dir, candidate_id)
            if qm.get("qm_is_real"):
                return self._build_result_row(idx, smiles, qm)

        # Fall back to RDKit Extended Hückel Theory (real HOMO/LUMO)
        if method != "xtb":  # Don't use fallback if xtb was explicitly required
            qm = rdkit_eht_descriptors(smiles)
            if qm.get("qm_is_real"):
                return self._build_result_row(idx, smiles, qm)

        # If xTB was explicit and failed, report failure mode
        if method == "xtb":
            qm = xtb_descriptors(smiles, work_dir, candidate_id)
            return None  # Will be turned into failure row

        return None  # rdkit_eht also failed

    def _build_result_row(self, idx: Any, smiles: str, qm: dict[str, Any]) -> dict[str, Any]:
        """Build standardized result row from QM descriptor dict."""
        # Compute basic RDKit descriptors as well
        mw, logp, tpsa = None, None, None
        if Chem is not None and Descriptors is not None:
            try:
                mol = Chem.MolFromSmiles(str(smiles))
                if mol:
                    mw = round(Descriptors.MolWt(mol), 2)
                    logp = round(Descriptors.MolLogP(mol), 2)
                    tpsa = round(Descriptors.TPSA(mol), 2)
            except Exception:
                pass

        homo = qm.get("homo_ev")
        lumo = qm.get("lumo_ev")
        gap = qm.get("homo_lumo_gap_ev")
        if homo is not None:
            homo = round(float(homo), 4)
        if lumo is not None:
            lumo = round(float(lumo), 4)
        if gap is not None:
            gap = round(float(gap), 4)

        dipole = qm.get("dipole_debye")
        if dipole is not None:
            dipole = round(float(dipole), 4)

        total_energy = qm.get("xtb_total_energy_eh")
        if total_energy is not None:
            total_energy = round(float(total_energy), 8)

        return {
            "idx": idx,
            "original_smiles": smiles,
            "canonical_smiles": smiles,
            "method": qm.get("qm_mode", "unknown"),
            "xtb_success": qm.get("qm_mode", "").startswith("xtb"),
            "rdkit_fallback": qm.get("qm_mode", "").startswith("rdkit"),
            "qm_is_real": bool(qm.get("qm_is_real", False)),
            "mw": mw,
            "logp": logp,
            "tpsa": tpsa,
            "homo": homo,
            "lumo": lumo,
            "gap": gap,
            "dipole": dipole,
            "total_energy_eh": total_energy,
            "max_abs_charge": qm.get("max_abs_partial_charge"),
            "qm_note": qm.get("qm_note", ""),
            "success": True,
        }

    def run(self) -> None:
        """Compute quantum descriptors using xTB (WSL) or RDKit EHT fallback."""
        if self.input_molecules is None:
            raise ModuleExecutionError("Input molecules not loaded")

        payload = self.validated_payload
        max_molecules = payload.get("max_molecules")
        method = payload.get("method", "auto")
        if hasattr(method, "value"):
            method = method.value

        molecules_to_process = self.input_molecules
        if max_molecules:
            molecules_to_process = molecules_to_process.head(max_molecules)

        # Create a stable work dir for xTB temp files
        work_dir = self.output_dir / "xtb_work"
        work_dir.mkdir(parents=True, exist_ok=True)
        self._xtb_work_dir = work_dir

        success_count = 0
        failed_count = 0
        xtb_count = 0
        eht_count = 0

        from q_ai_drug.qm.xtb_qm_descriptors import (
            xtb_available,
            xtb_descriptors,
            rdkit_eht_descriptors,
        )

        xtb_is_available = xtb_available()
        
        if method == "xtb" and not xtb_is_available:
            self.add_warning("xTB explicitly requested but not found (WSL xtb unavailable). Falling back to RDKit EHT.")
            method = "auto"

        for idx, row in molecules_to_process.iterrows():
            smiles = row.get("SMILES") or row.get("smiles")
            if not smiles:
                failed_count += 1
                self.failure_results.append({
                    "idx": idx,
                    "smiles": "",
                    "reason": "Missing SMILES",
                    "method": "none",
                })
                continue

            mol = Chem.MolFromSmiles(str(smiles))
            if not mol:
                failed_count += 1
                self.failure_results.append({
                    "idx": idx,
                    "smiles": str(smiles),
                    "reason": "Invalid SMILES",
                    "method": "none",
                })
                continue

            canonical_smiles = Chem.MolToSmiles(mol)
            qm_result: dict[str, Any] | None = None
            fail_reason = "QM computation failed"

            try:
                # Attempt 1: xTB via WSL if available and method allows
                if method in ("xtb", "auto") and xtb_is_available:
                    candidate_id = f"mol_{idx}"
                    qm = xtb_descriptors(canonical_smiles, work_dir, candidate_id)
                    if qm.get("qm_is_real"):
                        qm_result = self._build_result_row(idx, canonical_smiles, qm)
                        xtb_count += 1

                # Attempt 2: RDKit EHT fallback (gives real HOMO/LUMO/gap)
                if qm_result is None and method != "xtb":
                    qm = rdkit_eht_descriptors(canonical_smiles)
                    if qm.get("qm_is_real"):
                        qm_result = self._build_result_row(idx, canonical_smiles, qm)
                        eht_count += 1
                    else:
                        fail_reason = qm.get("qm_mode", "rdkit_eht_failed")

                # Attempt 3: xTB explicitly requested but failed
                if qm_result is None and method == "xtb":
                    candidate_id = f"mol_{idx}"
                    qm = xtb_descriptors(canonical_smiles, work_dir, candidate_id)
                    fail_reason = qm.get("qm_mode", "xtb_failed")

            except Exception as e:
                fail_reason = f"Exception: {str(e)[:100]}"

            if qm_result is not None:
                self.descriptor_results.append(qm_result)
                success_count += 1
            else:
                failed_count += 1
                self.failure_results.append({
                    "idx": idx,
                    "smiles": canonical_smiles,
                    "reason": fail_reason,
                    "method": method,
                })

        self.add_usage_actual("molecule_count", len(molecules_to_process))
        self.add_usage_actual("completed_qm_rows", success_count)
        self.add_usage_actual("failed_qm_rows", failed_count)
        self.add_usage_actual("xtb_rows", xtb_count)
        self.add_usage_actual("eht_rows", eht_count)

        if not xtb_is_available and method == "auto":
            self.add_warning(
                "xTB not found (WSL xtb not available). "
                "HOMO/LUMO/gap computed via RDKit Extended Hückel Theory (real semi-empirical). "
                "Install xTB in WSL for higher-fidelity GFN2 results."
            )

        if failed_count > 0:
            pct = (failed_count / len(molecules_to_process)) * 100
            self.add_warning(f"{failed_count} molecules ({pct:.1f}%) failed QM computation")

    def write_outputs(self) -> None:
        """Write QM descriptor results."""
        # Write descriptor table
        if self.descriptor_results:
            path = self.write_csv(self.descriptor_results, "qm_descriptors")
            self.register_artifact(path, "csv", "QM descriptors")

        # Write failure report
        if self.failure_results:
            path = self.write_csv(self.failure_results, "qm_failure_report")
            self.register_artifact(path, "csv", "QM failure report")

        # Check if we got real values
        real_count = sum(1 for r in self.descriptor_results if r.get("qm_is_real"))
        xtb_rows = self.usage_actual.get("xtb_rows", 0)
        eht_rows = self.usage_actual.get("eht_rows", 0)

        execution_mode = (
            "xtb_gfn2" if xtb_rows > 0 and eht_rows == 0
            else "rdkit_extended_huckel" if eht_rows > 0 and xtb_rows == 0
            else "mixed_xtb_and_eht" if xtb_rows > 0
            else "fallback_failed"
        )

        # Write summary
        summary = {
            "module_id": "q_orbital_analyzer",
            "input_molecules": self.usage_requested.get("molecule_count", 0),
            "completed": self.usage_actual.get("completed_qm_rows", 0),
            "failed": self.usage_actual.get("failed_qm_rows", 0),
            "xtb_rows": xtb_rows,
            "eht_rows": eht_rows,
            "real_qm_rows": real_count,
            "execution_mode": execution_mode,
            "homo_lumo_populated": real_count > 0,
            "method": self.validated_payload.get("method", "auto"),
            "warnings": self.warnings,
        }
        path = self.write_json(summary, "qm_descriptor_summary")
        self.register_artifact(path, "json", "QM summary")

    def get_result(self, status: str = "succeeded") -> dict[str, Any]:
        """Override to add accurate execution mode based on actual compute."""
        result = super().get_result(status)
        xtb_rows = self.usage_actual.get("xtb_rows", 0)
        eht_rows = self.usage_actual.get("eht_rows", 0)
        if xtb_rows > 0:
            result["execution_mode_detail"] = "xtb_gfn2_real"
            result["claim_boundary"] = (
                "xTB GFN2 single-point quantum chemistry. HOMO/LUMO/gap are real computed values. "
                "Wet-lab validation required for biological conclusions."
            )
        elif eht_rows > 0:
            result["execution_mode_detail"] = "rdkit_extended_huckel_real"
            result["claim_boundary"] = (
                "RDKit Extended Hückel Theory semi-empirical descriptors. "
                "HOMO/LUMO/gap are real computed values (semi-empirical, not DFT). "
                "Install xTB for higher-fidelity GFN2 results."
            )
        return result


def run_q_orbital_analyzer(project_dir: Path, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Run Q-Orbital Analyzer module."""
    runner = QOrbitalAnalyzerRunner("q_orbital_analyzer", project_dir, run_id, payload)
    return runner.execute()
