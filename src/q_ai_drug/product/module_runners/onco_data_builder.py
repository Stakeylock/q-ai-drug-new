"""OncoData Builder - standalone dataset curation and provisioning module.

This runner accepts target IDs, public/uploaded data-source settings, and a curation
profile. It returns a project-scoped, normalized oncology activity dataset plus
manifest/provenance artifacts for downstream modules.
"""

from __future__ import annotations

import hashlib
import math
from pathlib import Path
from typing import Any

import pandas as pd

from q_ai_drug.data.curate_activity import curate_activity_benchmark
from q_ai_drug.product.module_runners.base import BaseModuleRunner, ModuleExecutionError, ModuleInputError
from q_ai_drug.service.tool_payloads import OncoDataBuilderPayload


class OncoDataBuilderRunner(BaseModuleRunner):
    """Standalone dataset curation runner for oncology activity data."""

    def __init__(self, module_id: str, project_dir: Path, run_id: str, payload: dict[str, Any]):
        super().__init__(module_id, project_dir, run_id, payload)
        self.target_ids: list[str] = []
        self.data_sources: str = "public_only"
        self.curation_profile: str = "standard"
        self.uploaded_assay_csv: str | None = None
        self.uploaded_assay_csv_artifact_id: str | None = None
        self.curated_activity: pd.DataFrame | None = None
        self.uploaded_assay_df: pd.DataFrame | None = None
        self.uploaded_rejected_rows: pd.DataFrame = pd.DataFrame()
        self.config: dict[str, Any] = {}
        self.source_mode: str = "unknown"
        self.source_files: list[str] = []
        self.fallback_reason: str | None = None
        self.dataset_hash: str | None = None
        self.duplicate_resolution: pd.DataFrame = pd.DataFrame()
        self.conflicting_measurements: pd.DataFrame = pd.DataFrame()
        self.scaffold_split_summary: pd.DataFrame = pd.DataFrame()
        self.train_df: pd.DataFrame = pd.DataFrame()
        self.valid_df: pd.DataFrame = pd.DataFrame()
        self.test_df: pd.DataFrame = pd.DataFrame()
        self.target_coverage: pd.DataFrame = pd.DataFrame()

    def validate_payload(self) -> None:
        """Validate typed payload using Pydantic V2."""
        try:
            validated = OncoDataBuilderPayload.model_validate(self.payload)
            self.validated_payload = validated.model_dump()
            self.target_ids = validated.target_ids
            self.data_sources = validated.data_sources
            self.curation_profile = validated.curation_profile
            self.uploaded_assay_csv = validated.uploaded_assay_csv
            self.uploaded_assay_csv_artifact_id = getattr(validated, "uploaded_assay_csv_artifact_id", None)
            self.add_usage_requested("targets_requested", len(self.target_ids))
        except Exception as e:
            raise ModuleInputError(f"Invalid OncoDataBuilder payload: {e}")

    def resolve_inputs(self) -> None:
        """Load target configuration, validate targets, and load uploaded assay if provided."""
        config_path = Path("configs/cancer_targets.yaml")
        if not config_path.exists():
            raise ModuleInputError(f"Target config not found: {config_path}")

        import yaml

        with config_path.open("r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f) or {}

        available_targets = set(self.config.get("primary_targets", {}).keys())
        requested = set(self.target_ids)
        missing = requested - available_targets
        if missing:
            raise ModuleInputError(
                f"Unknown targets: {', '.join(sorted(missing))}. "
                f"Available: {', '.join(sorted(available_targets))}"
            )

        self.add_usage_requested("curation_profile", self.curation_profile)
        self.add_usage_requested("data_sources", self.data_sources)

        if self.uploaded_assay_csv or self.uploaded_assay_csv_artifact_id:
            self._load_uploaded_assay()

    # ------------------------------------------------------------------
    # Uploaded assay normalization
    # ------------------------------------------------------------------

    def _resolve_uploaded_assay_path(self) -> Path:
        if self.uploaded_assay_csv_artifact_id:
            try:
                from q_ai_drug.service.artifact_resolver import resolve_artifact_path

                return resolve_artifact_path(self.project_dir, self.uploaded_assay_csv_artifact_id)
            except Exception as e:
                raise ModuleInputError(
                    f"Cannot load uploaded assay artifact: {e}. "
                    "Upload the assay CSV directly or provide a valid artifact ID."
                )

        if not self.uploaded_assay_csv:
            raise ModuleInputError("uploaded_assay_csv or uploaded_assay_csv_artifact_id is required")

        upload_path = self.project_dir / "uploads" / self.uploaded_assay_csv
        if not upload_path.exists():
            raise ModuleInputError(
                f"Uploaded assay file not found: {self.uploaded_assay_csv}. "
                "Please upload the file to the project first."
            )
        return upload_path

    def _load_uploaded_assay(self) -> None:
        """Load, normalize, and validate uploaded assay CSV/TSV."""
        upload_path = self._resolve_uploaded_assay_path()
        try:
            if upload_path.suffix.lower() == ".tsv":
                raw_df = pd.read_csv(upload_path, sep="\t")
            else:
                raw_df = pd.read_csv(upload_path)
            self.source_files.append(upload_path.as_posix())
            self.add_usage_requested("uploaded_assay_rows", len(raw_df))
            normalized = self._normalize_activity_schema(raw_df, source="uploaded")
            self.uploaded_assay_df, self.uploaded_rejected_rows = self._split_usable_activity_rows(normalized)
            self.add_usage_actual("uploaded_assay_usable_rows", len(self.uploaded_assay_df))
            self.add_usage_actual("uploaded_assay_rejected_rows", len(self.uploaded_rejected_rows))
            if not self.uploaded_rejected_rows.empty:
                self.add_warning(
                    f"Uploaded assay normalization rejected {len(self.uploaded_rejected_rows)} rows; "
                    "see uploaded_assay_rejected_rows.csv."
                )
        except ModuleInputError:
            raise
        except Exception as e:
            raise ModuleExecutionError(f"Failed to load uploaded assay CSV: {e}")

    @staticmethod
    def _unit_to_nm(value: Any, unit: Any) -> float | None:
        try:
            val = float(value)
        except (TypeError, ValueError):
            return None
        if val <= 0:
            return None
        unit_key = str(unit or "nM").strip().lower().replace("μ", "u")
        if unit_key in {"nm", "nanomolar"}:
            return val
        if unit_key in {"um", "µm", "micromolar"}:
            return val * 1_000.0
        if unit_key in {"mm", "millimolar"}:
            return val * 1_000_000.0
        if unit_key in {"m", "molar"}:
            return val * 1_000_000_000.0
        return val  # assume nM when unit is absent/unknown but numeric

    @classmethod
    def _normalize_activity_schema(cls, df: pd.DataFrame, *, source: str) -> pd.DataFrame:
        """Normalize public or uploaded activity data to the canonical OncoData schema."""
        out = df.copy()
        rename_map: dict[str, str] = {}
        lower_to_original = {str(c).lower(): c for c in out.columns}

        aliases = {
            "canonical_smiles": ["canonical_smiles", "smiles", "smi", "canonical_smi"],
            "target_id": ["target_id", "target", "gene", "gene_name", "target_gene", "gene_symbol", "target_name", "uniprot_id", "protein_name"],
            "standard_type": ["standard_type", "activity_type", "assay_type", "affinity_type", "interaction_type"],
            "standard_value": ["standard_value", "activity_value", "value", "ic50", "ki", "kd", "ec50", "ac50", "affinity_value_nm", "affinity"],
            "standard_units": ["standard_units", "activity_unit", "unit", "units", "affinity_units"],
            "p_activity": ["p_activity", "pactivity", "pic50", "pchembl_value", "binding_affinity", "pk_i", "pkd"],
            "curation_kept": ["curation_kept", "kept", "keep"],
            "assay_confidence": ["assay_confidence", "confidence", "confidence_score"],
            "compound_id": ["compound_id", "molecule_id", "molecule_chembl_id", "name", "id", "drug_id", "drug_name", "pubchem_cid"],
        }

        for canonical, candidates in aliases.items():
            if canonical in out.columns:
                continue
            for candidate in candidates:
                original = lower_to_original.get(candidate.lower())
                if original is not None:
                    rename_map[original] = canonical
                    break

        if rename_map:
            out = out.rename(columns=rename_map)

        if "pActivity" in out.columns and "p_activity" not in out.columns:
            out["p_activity"] = out["pActivity"]
        if "p_activity" in out.columns and "pActivity" not in out.columns:
            out["pActivity"] = out["p_activity"]

        if "standard_type" not in out.columns:
            out["standard_type"] = "IC50"
        if "standard_units" not in out.columns:
            out["standard_units"] = "nM"

        if "standardized_activity_nM" not in out.columns and "standard_value" in out.columns:
            out["standardized_activity_nM"] = [
                cls._unit_to_nm(value, unit)
                for value, unit in zip(out["standard_value"], out.get("standard_units", pd.Series(["nM"] * len(out))))
            ]

        if "p_activity" not in out.columns and "standardized_activity_nM" in out.columns:
            def _to_pactivity(nm: Any) -> float | None:
                try:
                    nm_float = float(nm)
                    if nm_float <= 0:
                        return None
                    return round(-math.log10(nm_float * 1e-9), 3)
                except (TypeError, ValueError):
                    return None

            out["p_activity"] = out["standardized_activity_nM"].apply(_to_pactivity)
            out["pActivity"] = out["p_activity"]

        if "standardized_activity_nM" not in out.columns and "p_activity" in out.columns:
            def _pactivity_to_nm(p_act: Any) -> float | None:
                try:
                    return round((10 ** (-float(p_act))) * 1e9, 6)
                except (TypeError, ValueError):
                    return None

            out["standardized_activity_nM"] = out["p_activity"].apply(_pactivity_to_nm)

        if "source" not in out.columns:
            out["source"] = source
        else:
            out["source"] = out["source"].fillna(source)

        if "curation_kept" not in out.columns:
            out["curation_kept"] = True
        out["curation_kept"] = out["curation_kept"].fillna(True).astype(bool)

        if "assay_confidence" not in out.columns:
            out["assay_confidence"] = 5
        out["assay_confidence"] = pd.to_numeric(out["assay_confidence"], errors="coerce").fillna(5)

        if "activity_type" not in out.columns:
            out["activity_type"] = out["standard_type"]
        if "curation_flag" not in out.columns:
            out["curation_flag"] = "normalized"

        return out

    @staticmethod
    def _split_usable_activity_rows(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
        required = ["target_id", "canonical_smiles", "p_activity"]
        missing_cols = [col for col in required if col not in df.columns]
        if missing_cols:
            rejected = df.copy()
            rejected["rejection_reason"] = f"missing required columns: {', '.join(missing_cols)}"
            return pd.DataFrame(columns=df.columns), rejected

        usable_mask = (
            df["target_id"].notna()
            & df["canonical_smiles"].notna()
            & pd.to_numeric(df["p_activity"], errors="coerce").notna()
        )
        usable = df[usable_mask].copy()
        rejected = df[~usable_mask].copy()
        if not rejected.empty:
            rejected["rejection_reason"] = "missing target_id, canonical_smiles, or p_activity"
        usable["p_activity"] = pd.to_numeric(usable["p_activity"], errors="coerce")
        usable["pActivity"] = usable["p_activity"]
        return usable, rejected

    # ------------------------------------------------------------------
    # Main run logic
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Execute dataset curation: ChEMBL live retrieval, uploaded data, and benchmark fallback."""
        try:
            curated_df = pd.DataFrame()
            if "public" in self.data_sources:
                curated_df = self._retrieve_data()
                curated_df = self._normalize_activity_schema(curated_df, source=self.source_mode)

            if self.uploaded_assay_df is not None and not self.uploaded_assay_df.empty:
                curated_df = pd.concat([curated_df, self.uploaded_assay_df], ignore_index=True, sort=False)
                self.source_mode = f"{self.source_mode}_plus_uploaded" if self.source_mode else "uploaded"
                self.add_usage_requested("merged_source", self.source_mode)

            curated_df, rejected_after_merge = self._split_usable_activity_rows(curated_df)
            if not rejected_after_merge.empty:
                self.add_warning(f"Dropped {len(rejected_after_merge)} unusable rows after schema normalization.")

            if self.target_ids and "target_id" in curated_df.columns:
                curated_df = curated_df[curated_df["target_id"].isin(self.target_ids)].copy()

            if self.curation_profile == "strict":
                if "curation_kept" in curated_df.columns:
                    curated_df = curated_df[curated_df["curation_kept"]].copy()
                if "assay_confidence" in curated_df.columns:
                    curated_df = curated_df[curated_df["assay_confidence"] >= 7].copy()

            self.curated_activity = curated_df
            self.dataset_hash = self._hash_dataframe(curated_df)

            # Scientific hardening: duplicate/conflict, scaffold split, target coverage
            if not curated_df.empty:
                self._resolve_duplicates()
                self._compute_scaffold_split()
                self._compute_target_coverage()

            record_count = len(self.curated_activity)
            unique_molecules = self.curated_activity["canonical_smiles"].nunique() if "canonical_smiles" in self.curated_activity.columns else 0
            kept_count = int(self.curated_activity["curation_kept"].sum()) if "curation_kept" in self.curated_activity.columns else record_count

            self.add_usage_actual("curated_records", record_count)
            self.add_usage_actual("unique_molecules", unique_molecules)
            self.add_usage_actual("kept_records", kept_count)
            if self.dataset_hash:
                self.add_usage_actual("dataset_hash", self.dataset_hash)

            if record_count == 0:
                self.add_warning("No records passed curation filters. Results may be empty.")
        except ModuleExecutionError:
            raise
        except Exception as e:
            raise ModuleExecutionError(f"Curation failed: {e}")

    # ------------------------------------------------------------------
    # Duplicate / conflict resolution
    # ------------------------------------------------------------------

    def _resolve_duplicates(self) -> None:
        """Detect duplicates by target_id + canonical_smiles + standard_type and resolve conflicts."""
        df = self.curated_activity
        if df is None or df.empty:
            return
        group_cols = []
        for c in ["target_id", "canonical_smiles", "standard_type"]:
            if c in df.columns:
                group_cols.append(c)
        if len(group_cols) < 2:
            return

        grouped = df.groupby(group_cols, dropna=False)
        dup_rows: list[dict[str, Any]] = []
        conflict_rows: list[dict[str, Any]] = []
        group_id = 0

        for key, group in grouped:
            if len(group) <= 1:
                continue
            group_id += 1
            p_vals = pd.to_numeric(group.get("p_activity", pd.Series(dtype=float)), errors="coerce").dropna()
            if p_vals.empty:
                continue
            std_val = float(p_vals.std()) if len(p_vals) > 1 else 0.0
            is_conflict = std_val > 1.0  # >1 log unit spread = conflict
            resolution = "median" if not is_conflict else "flagged_conflict"
            row = {
                "duplicate_group_id": group_id,
                "measurement_count": len(group),
                "min_p_activity": round(float(p_vals.min()), 3),
                "median_p_activity": round(float(p_vals.median()), 3),
                "max_p_activity": round(float(p_vals.max()), 3),
                "activity_std": round(std_val, 3),
                "conflict_flag": is_conflict,
                "resolution_rule": resolution,
            }
            for i, col in enumerate(group_cols):
                row[col] = key[i] if isinstance(key, tuple) else key
            dup_rows.append(row)
            if is_conflict:
                conflict_rows.append(row)

        self.duplicate_resolution = pd.DataFrame(dup_rows) if dup_rows else pd.DataFrame()
        self.conflicting_measurements = pd.DataFrame(conflict_rows) if conflict_rows else pd.DataFrame()

        if dup_rows:
            self.add_warning(f"Found {len(dup_rows)} duplicate groups; {len(conflict_rows)} have conflicting measurements (>1 log unit spread).")
            self.add_usage_actual("duplicate_groups", len(dup_rows))
            self.add_usage_actual("conflict_groups", len(conflict_rows))

    # ------------------------------------------------------------------
    # Scaffold split
    # ------------------------------------------------------------------

    def _compute_scaffold_split(self) -> None:
        """Generate scaffold-aware train/valid/test splits."""
        df = self.curated_activity
        if df is None or df.empty or "canonical_smiles" not in df.columns:
            return

        try:
            from rdkit import Chem
            from rdkit.Chem.Scaffolds.MurckoScaffold import MurckoScaffoldSmiles
            has_rdkit = True
        except ImportError:
            has_rdkit = False

        smiles_list = df["canonical_smiles"].dropna().unique().tolist()
        if not smiles_list:
            return

        if has_rdkit:
            scaffold_map: dict[str, str] = {}
            for smi in smiles_list:
                try:
                    scaffold = MurckoScaffoldSmiles(smi)
                    scaffold_map[smi] = scaffold or "no_scaffold"
                except Exception:
                    scaffold_map[smi] = "no_scaffold"

            # Group by scaffold, then split scaffold groups
            scaffolds = list(set(scaffold_map.values()))
            import random
            random.seed(42)
            random.shuffle(scaffolds)
            n = len(scaffolds)
            train_scaffolds = set(scaffolds[:int(n * 0.7)])
            valid_scaffolds = set(scaffolds[int(n * 0.7):int(n * 0.85)])
            test_scaffolds = set(scaffolds[int(n * 0.85):])

            df = df.copy()
            df["scaffold"] = df["canonical_smiles"].map(scaffold_map).fillna("no_scaffold")
            df["split"] = df["scaffold"].apply(
                lambda s: "train" if s in train_scaffolds else ("valid" if s in valid_scaffolds else "test")
            )
            split_method = "scaffold"
        else:
            # Random fallback
            df = df.copy()
            import random
            random.seed(42)
            splits = random.choices(["train", "valid", "test"], weights=[0.7, 0.15, 0.15], k=len(df))
            df["split"] = splits
            df["scaffold"] = "unknown_no_rdkit"
            split_method = "random_fallback"
            self.add_warning("RDKit not available; using random split instead of scaffold split.")

        self.curated_activity = df
        self.train_df = df[df["split"] == "train"].copy()
        self.valid_df = df[df["split"] == "valid"].copy()
        self.test_df = df[df["split"] == "test"].copy()

        self.scaffold_split_summary = pd.DataFrame([
            {"split": "train", "rows": len(self.train_df), "unique_smiles": self.train_df["canonical_smiles"].nunique() if not self.train_df.empty else 0},
            {"split": "valid", "rows": len(self.valid_df), "unique_smiles": self.valid_df["canonical_smiles"].nunique() if not self.valid_df.empty else 0},
            {"split": "test", "rows": len(self.test_df), "unique_smiles": self.test_df["canonical_smiles"].nunique() if not self.test_df.empty else 0},
        ])
        self.scaffold_split_summary["split_method"] = split_method
        self.add_usage_actual("split_method", split_method)

    # ------------------------------------------------------------------
    # Target coverage
    # ------------------------------------------------------------------

    def _compute_target_coverage(self) -> None:
        """Generate per-target data coverage summary."""
        df = self.curated_activity
        if df is None or df.empty or "target_id" not in df.columns:
            return
        rows: list[dict[str, Any]] = []
        for tid, grp in df.groupby("target_id"):
            p_vals = pd.to_numeric(grp.get("p_activity", pd.Series(dtype=float)), errors="coerce").dropna()
            assay_types = grp["standard_type"].unique().tolist() if "standard_type" in grp.columns else []
            sources = grp["source"].unique().tolist() if "source" in grp.columns else []
            rows.append({
                "target_id": tid,
                "total_rows": len(grp),
                "unique_smiles": grp["canonical_smiles"].nunique() if "canonical_smiles" in grp.columns else 0,
                "p_activity_min": round(float(p_vals.min()), 3) if not p_vals.empty else None,
                "p_activity_max": round(float(p_vals.max()), 3) if not p_vals.empty else None,
                "p_activity_median": round(float(p_vals.median()), 3) if not p_vals.empty else None,
                "assay_types": "; ".join(str(a) for a in assay_types),
                "sources": "; ".join(str(s) for s in sources),
            })
        self.target_coverage = pd.DataFrame(rows)

    @staticmethod
    def _hash_dataframe(df: pd.DataFrame) -> str:
        if df.empty:
            return "empty"
        raw = df.sort_index(axis=1).to_csv(index=False).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()[:16]

    # ------------------------------------------------------------------
    # ChEMBL retrieval helpers
    # ------------------------------------------------------------------

    def _retrieve_data(self) -> pd.DataFrame:
        """Retrieve activity data from ChEMBL (live) then benchmark fallback."""
        chembl_rows: list[dict[str, Any]] = []
        try:
            from chembl_webresource_client.new_client import new_client
        except ImportError:
            new_client = None
            self.fallback_reason = "chembl_webresource_client_missing"
            self.add_warning(
                "chembl_webresource_client not installed. Install with: pip install chembl-webresource-client"
            )

        if new_client is not None:
            for target_id in self.target_ids:
                try:
                    rows = self._fetch_chembl_target(new_client, target_id)
                    chembl_rows.extend(rows)
                    self.add_warning(f"ChEMBL: fetched {len(rows)} activities for {target_id}")
                except Exception as e:
                    self.fallback_reason = f"chembl_retrieval_failed: {e}"
                    self.add_warning(f"ChEMBL retrieval failed for {target_id}: {e}. Falling back to benchmark.")

        if chembl_rows:
            df = pd.DataFrame(chembl_rows)
            self.source_mode = "chembl_live"
            self.add_usage_actual("chembl_rows", len(df))
            self.add_usage_actual("data_source", self.source_mode)
            return df

        benchmark_csv = Path("data/processed/oncology_benchmark.csv")
        if not benchmark_csv.exists():
            raise ModuleExecutionError(
                f"No ChEMBL data retrieved and benchmark file not found: {benchmark_csv}. "
                "Cannot curate dataset without at least one data source."
            )

        self.source_mode = "benchmark_fallback"
        self.source_files.append(benchmark_csv.as_posix())
        self.add_warning(
            "Using static benchmark CSV (data/processed/oncology_benchmark.csv). "
            "ChEMBL live retrieval unavailable or failed for all targets."
        )
        self.add_usage_actual("data_source", self.source_mode)

        try:
            curated_df, _ = curate_activity_benchmark(
                benchmark_csv=benchmark_csv,
                out_dir=self.project_dir,
                config_path="configs/cancer_targets.yaml",
            )
            return curated_df
        except Exception as e:
            raise ModuleExecutionError(f"Benchmark curation failed: {e}")

    def _fetch_chembl_target(self, new_client: Any, target_id: str) -> list[dict[str, Any]]:
        """Fetch and normalize ChEMBL activities for a target."""
        target_api = new_client.target
        search_results = target_api.filter(target_synonym__icontains=target_id).only(
            ["target_chembl_id", "pref_name", "target_type"]
        )
        chembl_target_ids = [
            r["target_chembl_id"]
            for r in search_results
            if r.get("target_type") in ("SINGLE PROTEIN", "PROTEIN FAMILY", None)
        ][:3]
        if not chembl_target_ids:
            raise RuntimeError(f"No ChEMBL target found for: {target_id}")

        activity_api = new_client.activity
        all_rows: list[dict[str, Any]] = []
        for chembl_target_id in chembl_target_ids:
            activities = activity_api.filter(
                target_chembl_id=chembl_target_id,
                standard_type__in=["IC50", "Ki", "Kd", "EC50", "AC50"],
                standard_relation__in=["=", "<"],
            ).only([
                "molecule_chembl_id",
                "canonical_smiles",
                "standard_value",
                "standard_units",
                "standard_type",
                "pchembl_value",
                "assay_chembl_id",
                "assay_description",
                "document_year",
                "data_validity_comment",
            ])
            for act in activities:
                smiles = act.get("canonical_smiles")
                if not smiles:
                    continue
                pchembl = act.get("pchembl_value")
                standard_value = act.get("standard_value")
                standard_units = (act.get("standard_units") or "nM").strip()
                p_activity: float | None = None
                standardized_nm: float | None = None
                if pchembl:
                    try:
                        p_activity = float(pchembl)
                        standardized_nm = (10 ** (-p_activity)) * 1e9
                    except (TypeError, ValueError):
                        pass
                if p_activity is None and standard_value:
                    standardized_nm = self._unit_to_nm(standard_value, standard_units)
                    if standardized_nm and standardized_nm > 0:
                        p_activity = -math.log10(standardized_nm * 1e-9)
                if p_activity is None:
                    continue
                validity = act.get("data_validity_comment") or ""
                is_flagged = bool(validity and validity.lower() not in ("", "not flagged", "manually validated"))
                all_rows.append({
                    "target_id": target_id,
                    "chembl_target_id": chembl_target_id,
                    "molecule_chembl_id": act.get("molecule_chembl_id"),
                    "canonical_smiles": smiles,
                    "standard_type": act.get("standard_type"),
                    "activity_type": act.get("standard_type"),
                    "standard_value": standard_value,
                    "standard_units": standard_units,
                    "standardized_activity_nM": round(float(standardized_nm), 6) if standardized_nm else None,
                    "p_activity": round(float(p_activity), 3),
                    "pActivity": round(float(p_activity), 3),
                    "assay_chembl_id": act.get("assay_chembl_id"),
                    "assay_description": (act.get("assay_description") or "")[:200],
                    "year": act.get("document_year"),
                    "data_validity_comment": validity,
                    "curation_kept": not is_flagged,
                    "assay_confidence": 7 if not is_flagged else 4,
                    "curation_flag": "chembl_flagged" if is_flagged else "chembl_normalized",
                    "source": "chembl",
                })

        if all_rows:
            df = pd.DataFrame(all_rows)
            df = df.sort_values("p_activity", ascending=False)
            df = df.drop_duplicates(subset=["target_id", "canonical_smiles", "standard_type"])
            return df.to_dict("records")
        return all_rows

    def write_outputs(self) -> None:
        """Write curated dataset and metadata to disk."""
        if self.curated_activity is None or self.curated_activity.empty:
            self.add_warning("No curated activity data to write.")
            self.write_json({"status": "empty", "reason": "No records passed curation"}, "dataset_manifest")
            return

        self.curated_activity = self._normalize_activity_schema(self.curated_activity, source=self.source_mode)

        curated_path = self.output_dir / "curated_activity.csv"
        self.curated_activity.to_csv(curated_path, index=False)
        self.register_artifact(curated_path, "csv", "curated_activity")

        if self.uploaded_assay_df is not None and not self.uploaded_assay_df.empty:
            uploaded_norm_path = self.output_dir / "uploaded_assay_normalized.csv"
            self.uploaded_assay_df.to_csv(uploaded_norm_path, index=False)
            self.register_artifact(uploaded_norm_path, "csv", "uploaded_assay_normalized")
        if not self.uploaded_rejected_rows.empty:
            rejected_path = self.output_dir / "uploaded_assay_rejected_rows.csv"
            self.uploaded_rejected_rows.to_csv(rejected_path, index=False)
            self.register_artifact(rejected_path, "csv", "uploaded_assay_rejected_rows")

        # --- Duplicate resolution ---
        if not self.duplicate_resolution.empty:
            dup_path = self.output_dir / "duplicate_resolution.csv"
            self.duplicate_resolution.to_csv(dup_path, index=False)
            self.register_artifact(dup_path, "csv", "duplicate_resolution")
        if not self.conflicting_measurements.empty:
            conf_path = self.output_dir / "conflicting_measurements.csv"
            self.conflicting_measurements.to_csv(conf_path, index=False)
            self.register_artifact(conf_path, "csv", "conflicting_measurements")

        # --- Target coverage ---
        if not self.target_coverage.empty:
            cov_path = self.output_dir / "target_coverage_summary.csv"
            self.target_coverage.to_csv(cov_path, index=False)
            self.register_artifact(cov_path, "csv", "target_coverage_summary")

        # --- Scaffold split outputs ---
        if not self.scaffold_split_summary.empty:
            split_path = self.output_dir / "scaffold_split_summary.csv"
            self.scaffold_split_summary.to_csv(split_path, index=False)
            self.register_artifact(split_path, "csv", "scaffold_split_summary")

            curated_with_split = self.output_dir / "curated_activity_with_split.csv"
            self.curated_activity.to_csv(curated_with_split, index=False)
            self.register_artifact(curated_with_split, "csv", "curated_activity_with_split")

            for name, split_df in [("train", self.train_df), ("valid", self.valid_df), ("test", self.test_df)]:
                if not split_df.empty:
                    p = self.output_dir / f"{name}.csv"
                    split_df.to_csv(p, index=False)
                    self.register_artifact(p, "csv", name)

        if "target_id" in self.curated_activity.columns:
            agg_spec: dict[str, Any] = {"canonical_smiles": "nunique", "p_activity": ["min", "max", "mean"]}
            if "curation_kept" in self.curated_activity.columns:
                agg_spec["curation_kept"] = "sum"
            distribution = self.curated_activity.groupby("target_id").agg(agg_spec)
            dist_path = self.output_dir / "activity_distribution_by_target.csv"
            distribution.to_csv(dist_path)
            self.register_artifact(dist_path, "csv", "activity_distribution_by_target")

        manifest = {
            "dataset_version": "2.0",
            "created_from": "onco_data_builder",
            "targets": self.target_ids,
            "curation_profile": self.curation_profile,
            "data_sources_requested": self.data_sources,
            "source_mode": self.source_mode,
            "record_count": len(self.curated_activity),
            "unique_molecules": int(self.curated_activity["canonical_smiles"].nunique()),
            "dataset_hash": self.dataset_hash or self._hash_dataframe(self.curated_activity),
            "schema_columns": list(self.curated_activity.columns),
            "duplicate_groups": len(self.duplicate_resolution),
            "conflict_groups": len(self.conflicting_measurements),
            "split_method": self.usage_actual.get("split_method", "none"),
            "limitations": [
                "Computational public/uploaded data curation only",
                "SMILES canonicalization and activity normalization may vary by dependency versions",
                "Activity values are source-reported or user-uploaded; no independent wet-lab validation",
            ],
        }
        self.write_json(manifest, "dataset_manifest")

        provenance = {
            "schema_version": "2.0",
            "source_mode": self.source_mode,
            "source_files": self.source_files,
            "source_api": "chembl_webresource_client" if self.source_mode == "chembl_live" else None,
            "fallback_reason": self.fallback_reason,
            "retrieved_at": self._now_iso(),
            "target_query": self.target_ids,
            "targets_selected": self.target_ids,
            "curation_profile": self.curation_profile,
            "curation_steps": [
                "Resolve target IDs from configs/cancer_targets.yaml",
                "Attempt ChEMBL live retrieval when dependency and network are available",
                "Fallback to benchmark CSV when live retrieval is unavailable",
                "Normalize pActivity/p_activity, units, target, SMILES, source, and curation fields",
                "Merge uploaded assay rows after schema normalization when provided",
                f"Filter by selected targets and curation profile: {self.curation_profile}",
                "Detect duplicate measurements by target_id + canonical_smiles + standard_type",
                "Flag conflicting measurements with >1 log unit spread",
                "Generate scaffold-aware train/valid/test splits",
                "Generate target coverage summary",
            ],
            "config_path": "configs/cancer_targets.yaml",
            "output_location": self.output_dir.as_posix(),
            "dataset_hash": self.dataset_hash or self._hash_dataframe(self.curated_activity),
            "next_steps": [
                "Review curated_activity.csv and rejected upload rows if present",
                "Review duplicate_resolution.csv and conflicting_measurements.csv",
                "Use train.csv / valid.csv / test.csv in Activity Model Studio",
                "Use reference inhibitors and candidate modules for downstream screening",
            ],
        }
        self.write_json(provenance, "dataset_provenance")

    @staticmethod
    def _now_iso() -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()


def run_onco_data_builder(project_dir: str | Path, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Entry point for OncoData Builder."""
    runner = OncoDataBuilderRunner("onco_data_builder", Path(project_dir), run_id, payload)
    return runner.execute()
