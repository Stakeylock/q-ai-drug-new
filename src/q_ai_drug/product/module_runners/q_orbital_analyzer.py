"""Q-Orbital Analyzer module runner: Quantum descriptors and orbital analysis.

Accept molecular structures and compute HOMO/LUMO/gap-style descriptors using
xTB GFN2 when available, with an explicitly controlled RDKit Extended Huckel
fallback. Every molecule receives a QM status so downstream ranking can tell
real xTB, EHT fallback, and failed rows apart.
"""

from __future__ import annotations

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
    """Quantum/QM descriptor extraction with explicit evidence-status labels."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id=module_id, project_dir=project_dir, run_id=run_id, payload=payload)
        self.input_molecules: pd.DataFrame | None = None
        self.descriptor_results: list[dict[str, Any]] = []
        self.failure_results: list[dict[str, Any]] = []
        self._xtb_work_dir: Path | None = None

    def validate_payload(self) -> None:
        try:
            validated = QOrbitalAnalyzerPayload.model_validate(self.payload)
            self.validated_payload = validated.model_dump()
        except Exception as e:
            raise ModuleInputError(f"Invalid Q-Orbital Analyzer payload: {e}")

    def resolve_inputs(self) -> None:
        payload = self.validated_payload
        input_path: Path | None = None

        if payload.get("candidate_artifact_id"):
            try:
                from q_ai_drug.service.artifact_resolver import resolve_artifact_path
                input_path = resolve_artifact_path(self.project_dir, payload["candidate_artifact_id"])
            except Exception as e:
                raise ModuleInputError(
                    f"Cannot load artifact: {e}. Please upload a SMILES CSV/SDF directly."
                )
        elif payload.get("candidate_upload_file"):
            input_path = self.project_dir / "uploads" / payload["candidate_upload_file"]
            if not input_path.exists():
                raise ModuleInputError(f"Upload file not found: {payload['candidate_upload_file']}")
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
                self.input_molecules = df.rename(columns={smiles_cols[0]: "SMILES"})
            elif input_path.suffix.lower() == ".sdf":
                rows: list[dict[str, Any]] = []
                suppl = Chem.SDMolSupplier(str(input_path))
                for i, mol in enumerate(suppl):
                    if mol:
                        rows.append({"SMILES": Chem.MolToSmiles(mol), "sdf_idx": i})
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

    def _build_result_row(self, idx: Any, smiles: str, qm: dict[str, Any]) -> dict[str, Any]:
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
        homo = round(float(homo), 4) if homo is not None else None
        lumo = round(float(lumo), 4) if lumo is not None else None
        gap = round(float(gap), 4) if gap is not None else None
        dipole = qm.get("dipole_debye")
        dipole = round(float(dipole), 4) if dipole is not None else None
        total_energy = qm.get("xtb_total_energy_eh")
        total_energy = round(float(total_energy), 8) if total_energy is not None else None

        qm_mode = str(qm.get("qm_mode", "unknown"))
        qm_status = "xtb_success" if qm_mode.startswith("xtb") else "eht_fallback" if qm_mode.startswith("rdkit") else "unknown_success"

        return {
            "idx": idx,
            "original_smiles": smiles,
            "canonical_smiles": smiles,
            "method": qm_mode,
            "qm_status": qm_status,
            "xtb_success": qm_status == "xtb_success",
            "rdkit_fallback": qm_status == "eht_fallback",
            "qm_is_real": bool(qm.get("qm_is_real", False)),
            "mw": mw,
            "logp": logp,
            "tpsa": tpsa,
            "homo": homo,
            "lumo": lumo,
            "gap": gap,
            "homo_ev": homo,
            "lumo_ev": lumo,
            "homo_lumo_gap_ev": gap,
            "dipole": dipole,
            "dipole_debye": dipole,
            "total_energy_eh": total_energy,
            "max_abs_charge": qm.get("max_abs_partial_charge"),
            "qm_note": qm.get("qm_note", ""),
            "success": True,
        }

    def run(self) -> None:
        if self.input_molecules is None:
            raise ModuleExecutionError("Input molecules not loaded")

        payload = self.validated_payload
        max_molecules = payload.get("max_molecules")
        method = payload.get("method", "auto")
        if hasattr(method, "value"):
            method = method.value
        allow_fallback = bool(payload.get("allow_fallback", True))

        molecules_to_process = self.input_molecules.head(max_molecules) if max_molecules else self.input_molecules

        work_dir = self.output_dir / "xtb_work"
        work_dir.mkdir(parents=True, exist_ok=True)
        self._xtb_work_dir = work_dir

        success_count = 0
        failed_count = 0
        xtb_count = 0
        eht_count = 0

        from q_ai_drug.qm.xtb_qm_descriptors import xtb_available, xtb_descriptors, rdkit_eht_descriptors

        xtb_is_available = xtb_available()
        if method == "xtb" and not xtb_is_available and not allow_fallback:
            self.add_warning("xTB explicitly requested and allow_fallback=false, but xTB is unavailable; rows will fail.")
        elif method == "xtb" and not xtb_is_available and allow_fallback:
            self.add_warning("xTB explicitly requested but not found; using RDKit EHT because allow_fallback=true.")

        for idx, row in molecules_to_process.iterrows():
            smiles = row.get("SMILES") or row.get("smiles")
            if not smiles:
                failed_count += 1
                self.failure_results.append({"idx": idx, "smiles": "", "reason": "Missing SMILES", "method": "none", "qm_status": "failed_input"})
                continue

            mol = Chem.MolFromSmiles(str(smiles))
            if not mol:
                failed_count += 1
                self.failure_results.append({"idx": idx, "smiles": str(smiles), "reason": "Invalid SMILES", "method": "none", "qm_status": "failed_input"})
                continue

            canonical_smiles = Chem.MolToSmiles(mol)
            qm_result: dict[str, Any] | None = None
            fail_reason = "QM computation failed"
            fail_status = "failed_compute"

            try:
                if method in ("xtb", "auto") and xtb_is_available:
                    candidate_id = f"mol_{idx}"
                    qm = xtb_descriptors(canonical_smiles, work_dir, candidate_id)
                    if qm.get("qm_is_real"):
                        qm_result = self._build_result_row(idx, canonical_smiles, qm)
                        xtb_count += 1
                    else:
                        fail_reason = qm.get("qm_mode", "xtb_failed")
                        fail_status = "failed_xtb"

                can_use_eht = method in ("auto", "rdkit_fallback") or (method == "xtb" and allow_fallback)
                if qm_result is None and can_use_eht:
                    qm = rdkit_eht_descriptors(canonical_smiles)
                    if qm.get("qm_is_real"):
                        qm_result = self._build_result_row(idx, canonical_smiles, qm)
                        eht_count += 1
                    else:
                        fail_reason = qm.get("qm_mode", "rdkit_eht_failed")
                        fail_status = "failed_eht"

                if qm_result is None and method == "xtb" and not allow_fallback:
                    fail_reason = fail_reason or "xTB failed and fallback disabled"
                    fail_status = "failed_xtb_no_fallback"

            except Exception as e:
                fail_reason = f"Exception: {str(e)[:100]}"
                fail_status = "failed_exception"

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
                    "allow_fallback": allow_fallback,
                    "qm_status": fail_status,
                })

        self.add_usage_actual("molecule_count", len(molecules_to_process))
        self.add_usage_actual("completed_qm_rows", success_count)
        self.add_usage_actual("failed_qm_rows", failed_count)
        self.add_usage_actual("xtb_rows", xtb_count)
        self.add_usage_actual("eht_rows", eht_count)
        self.add_usage_actual("allow_fallback", int(allow_fallback))

        if not xtb_is_available and method == "auto":
            self.add_warning("xTB not found; HOMO/LUMO/gap computed via RDKit Extended Huckel fallback where possible.")
        if failed_count > 0:
            pct = (failed_count / len(molecules_to_process)) * 100
            self.add_warning(f"{failed_count} molecules ({pct:.1f}%) failed QM computation")

    def write_outputs(self) -> None:
        if self.descriptor_results:
            path = self.write_csv(self.descriptor_results, "qm_descriptors")
            self.register_artifact(path, "csv", "QM descriptors")
        if self.failure_results:
            path = self.write_csv(self.failure_results, "qm_failure_report")
            self.register_artifact(path, "csv", "QM failure report")

        real_count = sum(1 for r in self.descriptor_results if r.get("qm_is_real"))
        xtb_rows = self.usage_actual.get("xtb_rows", 0)
        eht_rows = self.usage_actual.get("eht_rows", 0)
        execution_mode = (
            "xtb_gfn2" if xtb_rows > 0 and eht_rows == 0
            else "rdkit_extended_huckel" if eht_rows > 0 and xtb_rows == 0
            else "mixed_xtb_and_eht" if xtb_rows > 0
            else "fallback_failed"
        )
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
            "allow_fallback": self.validated_payload.get("allow_fallback", True),
            "warnings": self.warnings,
        }
        path = self.write_json(summary, "qm_descriptor_summary")
        self.register_artifact(path, "json", "QM summary")

    def get_result(self, status: str = "succeeded") -> dict[str, Any]:
        result = super().get_result(status)
        xtb_rows = self.usage_actual.get("xtb_rows", 0)
        eht_rows = self.usage_actual.get("eht_rows", 0)
        if xtb_rows > 0:
            result["execution_mode_detail"] = "xtb_gfn2_real"
            result["claim_boundary"] = "xTB GFN2 single-point quantum chemistry; biological conclusions still require wet-lab validation."
        elif eht_rows > 0:
            result["execution_mode_detail"] = "rdkit_extended_huckel_real"
            result["claim_boundary"] = "RDKit Extended Huckel semi-empirical descriptors; not DFT and not biological validation."
        else:
            result["execution_mode_detail"] = "qm_failed_or_not_run"
        return result


def run_q_orbital_analyzer(project_dir: Path, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    runner = QOrbitalAnalyzerRunner("q_orbital_analyzer", project_dir, run_id, payload)
    return runner.execute()
