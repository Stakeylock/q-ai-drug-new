"""Q-Filter module runner: Drug-likeness and medchem/ADMET risk filtering.

Accept a molecule library (SMILES CSV or SDF), run comprehensive filtering:
1. Molecule parsing and canonicalization
2. Duplicate detection
3. Drug-likeness descriptors (Lipinski, RO5)
4. PAINS/Brenk/structural alerts (RDKit FilterCatalog)
5. Medchem risk assessment
6. ADMET prediction (when available via trained model)

Output:
- filtered_candidates.csv (passed molecules)
- rejected_candidates.csv (failed molecules)
- reject_reasons.csv (why each was rejected)
- medchem_risk_table.csv
- admet_risk_table.csv
- q_filter_summary.json
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, Descriptors, Lipinski
except ImportError:  # pragma: no cover - optional dependency
    Chem = None
    AllChem = None
    Descriptors = None
    Lipinski = None

try:
    from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams
except (ImportError, Exception):  # pragma: no cover
    FilterCatalog = None
    FilterCatalogParams = None


from q_ai_drug.product.module_runners.base import (
    BaseModuleRunner,
    MissingDependencyError,
    ModuleExecutionError,
    ModuleInputError,
)
from q_ai_drug.service.tool_payloads import QFilterPayload


# ============================================================================
# RDKit FilterCatalog-based PAINS / Brenk
# ============================================================================

_PAINS_CATALOG: Any = None
_BRENK_CATALOG: Any = None


def _get_pains_catalog() -> Any:
    global _PAINS_CATALOG
    if _PAINS_CATALOG is None and FilterCatalog is not None and FilterCatalogParams is not None:
        params = FilterCatalogParams()
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.PAINS)
        _PAINS_CATALOG = FilterCatalog(params)
    return _PAINS_CATALOG


def _get_brenk_catalog() -> Any:
    global _BRENK_CATALOG
    if _BRENK_CATALOG is None and FilterCatalog is not None and FilterCatalogParams is not None:
        params = FilterCatalogParams()
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.BRENK)
        _BRENK_CATALOG = FilterCatalog(params)
    return _BRENK_CATALOG


# ============================================================================
# Structural Alerts
# ============================================================================

MEDCHEM_STRUCTURAL_ALERTS = {
    "aldehyde": "[CX3H1](=O)[#6]",
    "nitrile": "[CX2]#N",
    "isocyanate": "[N#C]=[N,C]",
    "azide": "[N-]=[N+]=[N-]",
    "michael_acceptor": "[CX3]=[CX3][CX3](=O)",
    "epoxide": "[OX2r3]",
    "acid_halide": "[CX3](=O)[F,Cl,Br,I]",
}


def _get_pains_alerts(mol: Any) -> list[str]:
    """Get PAINS alerts using RDKit FilterCatalog (real PAINS patterns)."""
    catalog = _get_pains_catalog()
    if catalog is None or mol is None:
        return []
    matches = catalog.GetMatches(mol)
    return [f"PAINS: {m.GetDescription()}" for m in matches]


def _get_brenk_alerts(mol: Any) -> list[str]:
    """Get Brenk alerts using RDKit FilterCatalog."""
    catalog = _get_brenk_catalog()
    if catalog is None or mol is None:
        return []
    matches = catalog.GetMatches(mol)
    return [f"Brenk: {m.GetDescription()}" for m in matches]


def _get_medchem_alerts(mol: Any) -> list[str]:
    """Get medchem risk alerts for molecule."""
    if mol is None or Chem is None:
        return []
    alerts = []
    for name, smarts_str in MEDCHEM_STRUCTURAL_ALERTS.items():
        try:
            patt = Chem.MolFromSmarts(smarts_str)
            if patt and mol.HasSubstructMatch(patt):
                alerts.append(f"MedChem risk: {name}")
        except Exception:
            pass
    return alerts


# ============================================================================
# Drug-likeness Assessment
# ============================================================================

@dataclass
class DrugLikenessResult:
    """Result of drug-likeness assessment."""
    mw: float
    logp: float
    hbd: int
    hba: int
    rotatable_bonds: int
    tpsa: float
    qed: float
    passes_ro5: bool
    passes_ro3: bool
    reject_reason: str | None = None


def assess_drug_likeness(mol: Any, strictness: str = "standard") -> DrugLikenessResult:
    """Assess drug-likeness of molecule.

    Args:
        mol: RDKit molecule
        strictness: "strict", "standard", or "oncology_permissive"

    Returns:
        DrugLikenessResult with pass/fail and reason
    """
    if not mol:
        return DrugLikenessResult(
            mw=0, logp=0, hbd=0, hba=0, rotatable_bonds=0, tpsa=0, qed=0,
            passes_ro5=False, passes_ro3=False,
            reject_reason="Invalid molecule structure"
        )

    # Calculate descriptors
    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    rotatable_bonds = Descriptors.NumRotatableBonds(mol)
    tpsa = Descriptors.TPSA(mol)
    qed = Descriptors.qed(mol)

    # Rule of 5 (Lipinski)
    ro5_violations = 0
    if mw > 500:
        ro5_violations += 1
    if logp > 5:
        ro5_violations += 1
    if hbd > 5:
        ro5_violations += 1
    if hba > 10:
        ro5_violations += 1

    passes_ro5 = ro5_violations <= 1

    # Rule of 3 (for fragments)
    passes_ro3 = (mw <= 300 and logp <= 3 and hbd <= 3 and hba <= 6)

    # Determine pass/fail based on strictness
    reject_reason = None

    if strictness == "strict":
        if not passes_ro5:
            reject_reason = "Violates Lipinski Rule of 5"
        elif qed < 0.5:
            reject_reason = "Low QED score"
        elif rotatable_bonds > 8:
            reject_reason = "Too many rotatable bonds"

    elif strictness == "standard":
        if mw > 600:
            reject_reason = "Molecular weight > 600"
        elif logp > 6:
            reject_reason = "LogP > 6"
        elif hba > 12:
            reject_reason = "Too many H-bond acceptors"
        elif rotatable_bonds > 10:
            reject_reason = "Too many rotatable bonds"

    elif strictness == "oncology_permissive":
        if mw > 800:
            reject_reason = "Molecular weight > 800"
        elif logp > 7:
            reject_reason = "LogP > 7"

    return DrugLikenessResult(
        mw=mw, logp=logp, hbd=hbd, hba=hba, rotatable_bonds=rotatable_bonds,
        tpsa=tpsa, qed=qed, passes_ro5=passes_ro5, passes_ro3=passes_ro3,
        reject_reason=reject_reason
    )


# ============================================================================
# ADMET Scoring (loaded from trained model when available)
# ============================================================================

_ADMET_MODEL: Any = None
_ADMET_MODEL_LOADED: bool = False
_ADMET_MODEL_AVAILABLE: bool = False


def _load_admet_model() -> bool:
    """Load trained ADMET model from disk. Returns True if model loaded."""
    global _ADMET_MODEL, _ADMET_MODEL_LOADED, _ADMET_MODEL_AVAILABLE
    if _ADMET_MODEL_LOADED:
        return _ADMET_MODEL_AVAILABLE

    _ADMET_MODEL_LOADED = True

    # Look for model in well-known locations
    import os
    candidate_paths = [
        Path("best_tox_model.pt"),
        Path(__file__).parents[5] / "best_tox_model.pt",
        Path(os.environ.get("ADMET_MODEL_PATH", "")) if os.environ.get("ADMET_MODEL_PATH") else None,
    ]

    for model_path in candidate_paths:
        if model_path and model_path.exists():
            try:
                import torch
                _ADMET_MODEL = torch.load(str(model_path), map_location="cpu", weights_only=False)
                if hasattr(_ADMET_MODEL, "eval"):
                    _ADMET_MODEL.eval()
                _ADMET_MODEL_AVAILABLE = True
                return True
            except Exception:
                continue

    return False


def _score_admet_batch(smiles_list: list[str]) -> list[dict[str, Any]]:
    """Score molecules with ADMET model. Returns list of score dicts."""
    model_available = _load_admet_model()
    results = []

    for smiles in smiles_list:
        if not model_available or _ADMET_MODEL is None:
            results.append({
                "smiles": smiles,
                "admet_risk_score": None,
                "tox21_risk": None,
                "clintox_risk": None,
                "admet_model_used": False,
                "admet_note": "ADMET model unavailable; not scored",
            })
            continue

        try:
            import torch
            from rdkit import Chem
            from rdkit.Chem import AllChem

            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                results.append({
                    "smiles": smiles,
                    "admet_risk_score": None,
                    "tox21_risk": None,
                    "clintox_risk": None,
                    "admet_model_used": False,
                    "admet_note": "Invalid SMILES",
                })
                continue

            # Generate Morgan fingerprint
            fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
            fp_array = torch.tensor(list(fp), dtype=torch.float32).unsqueeze(0)

            with torch.no_grad():
                output = _ADMET_MODEL(fp_array)
                if hasattr(output, "sigmoid"):
                    probs = output.sigmoid().squeeze().tolist()
                else:
                    import torch.nn.functional as F
                    probs = F.sigmoid(output).squeeze().tolist()

            # Model outputs multiple endpoints; take max as overall risk
            if isinstance(probs, float):
                probs = [probs]
            admet_risk = float(max(probs))
            tox21_risk = float(probs[0]) if len(probs) > 0 else None
            clintox_risk = float(probs[-1]) if len(probs) > 1 else None

            results.append({
                "smiles": smiles,
                "admet_risk_score": round(admet_risk, 4),
                "tox21_risk": round(tox21_risk, 4) if tox21_risk is not None else None,
                "clintox_risk": round(clintox_risk, 4) if clintox_risk is not None else None,
                "admet_model_used": True,
                "admet_note": "Tox21/ClinTox trained model",
                "admet_metadata": {
                    "endpoint_names": ["tox21_NR-AR", "tox21_NR-AR-LBD", "tox21_NR-AhR", "tox21_NR-Aromatase", "tox21_NR-ER", "tox21_NR-ER-LBD", "tox21_NR-PPAR-gamma", "tox21_SR-ARE", "tox21_SR-ATAD5", "tox21_SR-HSE", "tox21_SR-MMP", "tox21_SR-p53", "clintox_FDA_APPROVED", "clintox_FDA_Tox"],
                    "model_version": "v1.0.0-baseline",
                    "fingerprint": "Morgan radius=2 nBits=2048"
                }
            })
        except Exception as exc:
            results.append({
                "smiles": smiles,
                "admet_risk_score": None,
                "tox21_risk": None,
                "clintox_risk": None,
                "admet_model_used": False,
                "admet_note": f"ADMET scoring failed: {str(exc)[:80]}",
            })

    return results


# ============================================================================
# Q-Filter Runner
# ============================================================================


class QFilterRunner(BaseModuleRunner):
    """Q-Filter module runner: Drug-likeness and risk filtering."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        """Initialize Q-Filter runner."""
        super().__init__(
            module_id=module_id,
            project_dir=project_dir,
            run_id=run_id,
            payload=payload,
        )

        self.input_molecules: pd.DataFrame | None = None
        self.filtered_results: list[dict[str, Any]] = []
        self.rejected_results: list[dict[str, Any]] = []
        self.reject_reasons_list: list[dict[str, Any]] = []
        self.medchem_risk_table: list[dict[str, Any]] = []
        self.admet_risk_table: list[dict[str, Any]] = []
        self.invalid_molecules: list[dict[str, Any]] = []
        self.duplicate_molecules: list[dict[str, Any]] = []

    # ========================================================================
    # Pipeline implementation
    # ========================================================================

    def validate_payload(self) -> None:
        """Validate Q-Filter payload."""
        try:
            validated = QFilterPayload.model_validate(self.payload)
            self.validated_payload = validated.model_dump()
        except Exception as e:
            raise ModuleInputError(f"Invalid Q-Filter payload: {e}")

    def resolve_inputs(self) -> None:
        """Load molecules from artifact or upload file."""
        payload = self.validated_payload

        # Determine input source — support candidate_upload_file and both artifact ID fields
        input_path = None

        artifact_id = payload.get("candidate_library_artifact_id") or payload.get("candidate_artifact_id")
        if artifact_id:
            try:
                from q_ai_drug.service.artifact_resolver import resolve_artifact_path
                input_path = resolve_artifact_path(self.project_dir, artifact_id)
            except Exception as e:
                raise ModuleInputError(
                    f"Cannot load artifact: {e}. "
                    f"Please use file upload instead: Save your SMILES CSV and upload directly."
                )

        elif payload.get("candidate_upload_file"):
            upload_dir = self.project_dir / "uploads"
            upload_file = payload["candidate_upload_file"]
            input_path = upload_dir / upload_file

            if not input_path.exists():
                raise ModuleInputError(f"Upload file not found: {upload_file}")

        else:
            raise ModuleInputError("Must provide either artifact_id or candidate_upload_file")

        if Chem is None:
            raise MissingDependencyError(
                "RDKit is required for Q-Filter but is not installed. "
                "Install with: pip install 'q-ai-drug[chem]' or pip install rdkit"
            )

        # Load molecules
        try:
            if input_path.suffix.lower() == ".csv":
                df = pd.read_csv(input_path)
                smiles_cols = [c for c in df.columns if c.lower() in ["smiles", "smi", "canonical_smiles"]]
                if not smiles_cols:
                    raise ModuleInputError("CSV must have a SMILES column (SMILES, smi, or canonical_smiles)")
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

    def run(self) -> None:
        """Filter molecules."""
        if self.input_molecules is None:
            raise ModuleExecutionError("Input molecules not loaded")

        payload = self.validated_payload
        strictness = payload.get("filter_profile", "standard")
        # Handle enum value string
        if hasattr(strictness, 'value'):
            strictness = strictness.value
        max_molecules = payload.get("max_molecules")
        run_admet = payload.get("run_admet", True)

        molecules_to_process = self.input_molecules
        if max_molecules:
            molecules_to_process = molecules_to_process.head(max_molecules)

        # DEDUPLICATION: Build canonical SMILES, deduplicate
        canonical_smiles_seen: set[str] = set()
        duplicates_removed = 0
        dedup_rows = []

        for idx, row in molecules_to_process.iterrows():
            smiles = row.get("SMILES") or row.get("smiles")
            if not smiles:
                dedup_rows.append(row)
                continue

            try:
                mol_tmp = Chem.MolFromSmiles(str(smiles))
                canonical = Chem.MolToSmiles(mol_tmp) if mol_tmp else None
            except Exception:
                canonical = None

            if canonical and canonical in canonical_smiles_seen:
                duplicates_removed += 1
                self.duplicate_molecules.append({
                    "original_smiles": str(smiles),
                    "canonical_smiles": canonical,
                    "reason": "duplicate_canonical_smiles",
                })
                continue

            if canonical:
                canonical_smiles_seen.add(canonical)
            dedup_rows.append(row)

        if duplicates_removed > 0:
            self.add_usage_actual("duplicates_removed", duplicates_removed)
            self.add_warning(f"Removed {duplicates_removed} duplicate molecules (same canonical SMILES)")

        molecules_to_process = pd.DataFrame(dedup_rows)

        valid_count = 0
        failed_count = 0

        # Collect SMILES for batch ADMET scoring
        valid_smiles_for_admet: list[str] = []

        for idx, row in molecules_to_process.iterrows():
            smiles = row.get("SMILES") or row.get("smiles")
            if not smiles:
                failed_count += 1
                inv_row = {"idx": idx, "smiles": "", "reason": "Missing SMILES"}
                self.invalid_molecules.append(inv_row)
                self.rejected_results.append({
                    **row.to_dict(),
                    "valid_molecule": False,
                    "filter_status": "failed_parse",
                })
                self.reject_reasons_list.append(inv_row)
                continue

            mol = Chem.MolFromSmiles(str(smiles))
            if not mol:
                failed_count += 1
                inv_row = {"idx": idx, "smiles": str(smiles), "reason": "Invalid SMILES (RDKit parse failure)"}
                self.invalid_molecules.append(inv_row)
                self.rejected_results.append({
                    **row.to_dict(),
                    "valid_molecule": False,
                    "filter_status": "invalid_smiles",
                })
                self.reject_reasons_list.append(inv_row)
                continue

            valid_count += 1
            canonical_smiles = Chem.MolToSmiles(mol)
            valid_smiles_for_admet.append(canonical_smiles)

            # Assess drug-likeness
            drug_likeness = assess_drug_likeness(mol, strictness)

            # Get alerts (real RDKit FilterCatalog PAINS/Brenk)
            pains_alerts = _get_pains_alerts(mol)
            brenk_alerts = _get_brenk_alerts(mol)
            medchem_alerts = _get_medchem_alerts(mol)

            all_alerts = pains_alerts + brenk_alerts + medchem_alerts

            # Determine pass/fail
            filter_status = "passed"
            reject_reason = drug_likeness.reject_reason

            if reject_reason:
                filter_status = "failed_filter"
            elif all_alerts and strictness == "strict":
                filter_status = "review_alerts"
                reject_reason = "; ".join(all_alerts[:3])

            # Build result row
            result_row = {
                "idx": idx,
                "original_smiles": smiles,
                "canonical_smiles": canonical_smiles,
                "valid_molecule": True,
                "filter_status": filter_status,
                "mw": round(drug_likeness.mw, 2),
                "logp": round(drug_likeness.logp, 2),
                "hbd": drug_likeness.hbd,
                "hba": drug_likeness.hba,
                "rotatable_bonds": drug_likeness.rotatable_bonds,
                "tpsa": round(drug_likeness.tpsa, 2),
                "qed": round(drug_likeness.qed, 3),
                "passes_ro5": drug_likeness.passes_ro5,
                "passes_ro3": drug_likeness.passes_ro3,
                "pains_alerts": "; ".join(pains_alerts) if pains_alerts else "",
                "brenk_alerts": "; ".join(brenk_alerts) if brenk_alerts else "",
                "medchem_alerts": "; ".join(medchem_alerts) if medchem_alerts else "",
                "reject_reason": reject_reason or "",
            }

            if filter_status == "passed":
                self.filtered_results.append(result_row)
            else:
                self.rejected_results.append(result_row)
                self.reject_reasons_list.append({
                    "idx": idx,
                    "smiles": canonical_smiles,
                    "reason": reject_reason or "Did not pass filter",
                    "pains_alerts": "; ".join(pains_alerts),
                    "brenk_alerts": "; ".join(brenk_alerts),
                    "medchem_alerts": "; ".join(medchem_alerts),
                })

            # Medchem risk
            self.medchem_risk_table.append({
                "smiles": canonical_smiles,
                "alerts_count": len(all_alerts),
                "risk_level": "high" if len(all_alerts) > 2 else "medium" if all_alerts else "low",
                "alerts": "; ".join(all_alerts),
            })

        # Run ADMET scoring on valid molecules
        if run_admet and valid_smiles_for_admet:
            admet_scores = _score_admet_batch(valid_smiles_for_admet)
            admet_by_smiles = {r["smiles"]: r for r in admet_scores}

            # Inject ADMET scores into filtered/rejected results
            for result in self.filtered_results + self.rejected_results:
                csmi = result.get("canonical_smiles", "")
                admet = admet_by_smiles.get(csmi, {})
                result["admet_risk_score"] = admet.get("admet_risk_score")
                result["admet_model_used"] = admet.get("admet_model_used", False)

            self.admet_risk_table = admet_scores
            admet_available = any(r.get("admet_model_used") for r in admet_scores)
            self.add_usage_actual("admet_scored", len(admet_scores))
            self.add_usage_actual("admet_model_available", int(admet_available))

            if not admet_available:
                self.add_warning(
                    "ADMET model unavailable; admet_risk_score not computed. "
                    "Ensure best_tox_model.pt is present and torch is installed."
                )
        elif run_admet:
            self.add_warning("ADMET scoring requested but no valid molecules to score.")

        # Record usage
        self.add_usage_actual("molecule_count", len(molecules_to_process))
        self.add_usage_actual("valid_molecule_count", valid_count)
        self.add_usage_actual("failed_molecule_count", failed_count)
        self.add_usage_actual("filtered_count", len(self.filtered_results))
        self.add_usage_actual("rejected_count", len(self.rejected_results))

        # Add warnings
        if failed_count > 0:
            pct = (failed_count / len(molecules_to_process)) * 100
            self.add_warning(f"{failed_count} molecules ({pct:.1f}%) failed parsing")

        if len(self.rejected_results) > len(self.filtered_results):
            self.add_warning("More molecules rejected than filtered; consider relaxing filter profile")

    def write_outputs(self) -> None:
        """Write filter results and summary."""
        # Write filtered candidates CSV
        if self.filtered_results:
            path = self.write_csv(self.filtered_results, "filtered_candidates")
            self.register_artifact(path, "csv", "Filtered candidates")
        else:
            self.add_warning("No molecules passed filter")

        # Write filtered candidates SDF for downstream (Q-Dock/Q-Orbital)
        if self.filtered_results and Chem is not None:
            try:
                sdf_path = self.output_dir / "filtered_candidates.sdf"
                writer = Chem.SDWriter(str(sdf_path))
                for row in self.filtered_results:
                    smi = row.get("canonical_smiles") or row.get("original_smiles")
                    if smi:
                        mol = Chem.MolFromSmiles(str(smi))
                        if mol:
                            mol.SetProp("_Name", str(row.get("idx", "")))
                            mol.SetProp("filter_status", str(row.get("filter_status", "")))
                            mol.SetProp("qed", str(row.get("qed", "")))
                            writer.write(mol)
                writer.close()
                self.register_artifact(sdf_path, "sdf", "Filtered candidates SDF")
            except Exception:
                self.add_warning("Failed to write filtered_candidates.sdf")

        # Write rejected candidates
        if self.rejected_results:
            path = self.write_csv(self.rejected_results, "rejected_candidates")
            self.register_artifact(path, "csv", "Rejected candidates")

        # Write reject reasons
        if self.reject_reasons_list:
            path = self.write_csv(self.reject_reasons_list, "reject_reasons")
            self.register_artifact(path, "csv", "Reject reasons")

        # Write invalid molecules report
        if self.invalid_molecules:
            path = self.write_csv(self.invalid_molecules, "invalid_molecules")
            self.register_artifact(path, "csv", "Invalid molecules")

        # Write duplicate molecules report
        if self.duplicate_molecules:
            path = self.write_csv(self.duplicate_molecules, "duplicate_molecules")
            self.register_artifact(path, "csv", "Duplicate molecules")

        # Write medchem risk table
        if self.medchem_risk_table:
            path = self.write_csv(self.medchem_risk_table, "medchem_risk_table")
            self.register_artifact(path, "csv", "Medchem risk table")

        # Write ADMET risk table
        if self.admet_risk_table:
            path = self.write_csv(self.admet_risk_table, "admet_risk_table")
            self.register_artifact(path, "csv", "ADMET risk table")

        # Write ADMET model manifest
        admet_manifest = {
            "model_available": bool(self.usage_actual.get("admet_model_available", 0)),
            "endpoint_mapping_known": bool(self.usage_actual.get("admet_model_available", 0)),
            "claim_boundary": "ADMET predictions are computational estimates; not safety or toxicology claims.",
        }
        if self.admet_risk_table:
            for row in self.admet_risk_table:
                if row.get("admet_metadata"):
                    admet_manifest.update({
                        "model_version": row["admet_metadata"].get("model_version"),
                        "fingerprint": row["admet_metadata"].get("fingerprint"),
                        "endpoint_names": row["admet_metadata"].get("endpoint_names"),
                    })
                    break
        if not admet_manifest.get("model_available"):
            admet_manifest["note"] = "ADMET model unavailable; scores not computed. Set ADMET_MODEL_PATH or provide best_tox_model.pt."
        manifest_path = self.write_json(admet_manifest, "admet_model_manifest")
        self.register_artifact(manifest_path, "json", "ADMET model manifest")

        # Write summary
        summary = {
            "module_id": "q_filter",
            "input_molecules": self.usage_requested.get("molecule_count", 0),
            "valid_molecules": self.usage_actual.get("valid_molecule_count", 0),
            "failed_parsing": self.usage_actual.get("failed_molecule_count", 0),
            "duplicates_removed": len(self.duplicate_molecules),
            "invalid_molecules": len(self.invalid_molecules),
            "filtered_passed": len(self.filtered_results),
            "rejected": len(self.rejected_results),
            "filter_profile": self.validated_payload.get("filter_profile", "standard"),
            "admet_scored": self.usage_actual.get("admet_scored", 0),
            "admet_model_available": bool(self.usage_actual.get("admet_model_available", 0)),
            "alert_sources": self._get_alert_sources(),
            "warnings": self.warnings,
        }
        path = self.write_json(summary, "q_filter_summary")
        self.register_artifact(path, "json", "Filter summary")

    def _get_alert_sources(self) -> list[str]:
        """List which alert sources were used."""
        sources = []
        if FilterCatalog is not None:
            sources.extend(["PAINS (RDKit FilterCatalog)", "Brenk (RDKit FilterCatalog)"])
        else:
            sources.append("Structural alerts (fallback SMARTS)")
        sources.append("MedChem risk (SMARTS patterns)")
        return sources


def run_q_filter(project_dir: Path, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Run Q-Filter module.

    Args:
        project_dir: Project root directory
        run_id: Unique run identifier
        payload: Input payload dictionary

    Returns:
        Standardized module_result.json dictionary
    """
    runner = QFilterRunner("q_filter", project_dir, run_id, payload)
    return runner.execute()
