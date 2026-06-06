from __future__ import annotations

import math
import re
import zipfile
from pathlib import Path
from typing import Any

import pandas as pd

from q_ai_drug.data.build_oncology_benchmark import canonicalize_smiles


BINDINGDB_ENDPOINT_COLUMNS: dict[str, list[str]] = {
    "Ki": ["Ki (nM)", "Ki", "ki_nm"],
    "IC50": ["IC50 (nM)", "IC50", "ic50_nm"],
    "Kd": ["Kd (nM)", "Kd", "kd_nm"],
    "EC50": ["EC50 (nM)", "EC50", "ec50_nm"],
}


def _read_bindingdb_table(path: str | Path, *, max_rows: int | None = None) -> pd.DataFrame:
    source = Path(path)
    if source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as archive:
            member = next((name for name in archive.namelist() if name.lower().endswith((".tsv", ".txt"))), None)
            if member is None:
                raise ValueError(f"No TSV/TXT member found in {source}")
            with archive.open(member) as handle:
                return pd.read_csv(handle, sep="\t", dtype=str, nrows=max_rows, low_memory=False)
    return pd.read_csv(source, sep="\t" if source.suffix.lower() == ".tsv" else None, dtype=str, nrows=max_rows, engine="python")


def _first_present(row: pd.Series, columns: list[str]) -> Any:
    for column in columns:
        if column in row.index and pd.notna(row[column]) and str(row[column]).strip():
            return row[column]
    return None


def _column_lookup(frame: pd.DataFrame, candidates: list[str]) -> str | None:
    normalized = {re.sub(r"[^a-z0-9]+", "", str(col).lower()): col for col in frame.columns}
    for candidate in candidates:
        key = re.sub(r"[^a-z0-9]+", "", candidate.lower())
        if key in normalized:
            return normalized[key]
    return None


def _parse_relation_value(value: Any) -> tuple[str, float | None]:
    if value is None or pd.isna(value):
        return "=", None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "nd", "n/a", "na"}:
        return "=", None
    relation = "="
    if text.startswith(("<=", ">=", "<", ">")):
        relation = text[:2] if text[:2] in {"<=", ">="} else text[0]
    cleaned = text.replace(",", "")
    match = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", cleaned)
    if not match:
        return relation, None
    value_float = float(match.group(0))
    if not math.isfinite(value_float) or value_float <= 0:
        return relation, None
    return relation, value_float


def _p_activity_from_nm(value_nm: float) -> float:
    return round(-math.log10(float(value_nm) * 1e-9), 3)


def _resolve_target_id(row: pd.Series, target_ids: list[str] | None, target_column: str | None, target_name_column: str | None) -> str | None:
    explicit = _first_present(row, ["target_id", "target", "gene", "gene_symbol", "target_gene"])
    if explicit:
        return str(explicit).strip()
    target_text = " ".join(
        str(value)
        for value in [row.get(target_column) if target_column else None, row.get(target_name_column) if target_name_column else None]
        if value is not None and pd.notna(value)
    ).upper()
    for target_id in target_ids or []:
        if str(target_id).upper() in target_text:
            return str(target_id)
    return str(row.get(target_name_column)).strip() if target_name_column and pd.notna(row.get(target_name_column)) else None


def normalize_bindingdb_activities(
    source: str | Path | pd.DataFrame,
    *,
    target_ids: list[str] | None = None,
    max_rows: int | None = None,
) -> pd.DataFrame:
    """Normalize BindingDB Ki/Kd/IC50/EC50 columns into one auditable activity row per endpoint."""
    raw = source.copy() if isinstance(source, pd.DataFrame) else _read_bindingdb_table(source, max_rows=max_rows)
    if raw.empty:
        return pd.DataFrame()

    smiles_col = _column_lookup(raw, ["Ligand SMILES", "SMILES", "canonical_smiles"])
    record_col = _column_lookup(raw, ["BindingDB Reactant_set_id", "BindingDB MonomerID", "record_id", "compound_id"])
    target_col = _column_lookup(raw, ["UniProt (SwissProt) Primary ID of Target Chain", "UniProt ID", "target_id"])
    target_name_col = _column_lookup(raw, ["Target Name", "target_name", "target"])
    doi_col = _column_lookup(raw, ["Article DOI", "DOI"])
    pmid_col = _column_lookup(raw, ["PubMed ID", "PMID"])
    if smiles_col is None:
        raise ValueError("BindingDB table is missing a Ligand SMILES/SMILES column")

    endpoint_columns = {
        endpoint: _column_lookup(raw, candidates)
        for endpoint, candidates in BINDINGDB_ENDPOINT_COLUMNS.items()
    }
    rows: list[dict[str, Any]] = []
    for _, raw_row in raw.iterrows():
        canonical = canonicalize_smiles(str(raw_row.get(smiles_col, "")))
        if not canonical:
            continue
        target_id = _resolve_target_id(raw_row, target_ids, target_col, target_name_col)
        if target_ids and target_id not in set(target_ids):
            continue
        for endpoint, column in endpoint_columns.items():
            if column is None:
                continue
            relation, value_nm = _parse_relation_value(raw_row.get(column))
            if value_nm is None:
                continue
            rows.append(
                {
                    "target_id": target_id,
                    "target_name": raw_row.get(target_name_col) if target_name_col else None,
                    "canonical_smiles": canonical,
                    "compound_id": raw_row.get(record_col) if record_col else None,
                    "standard_type": endpoint,
                    "activity_type": endpoint,
                    "standard_relation": relation,
                    "standard_value": value_nm,
                    "standard_units": "nM",
                    "standardized_activity_nM": round(value_nm, 6),
                    "p_activity": _p_activity_from_nm(value_nm),
                    "pActivity": _p_activity_from_nm(value_nm),
                    "source": "bindingdb",
                    "source_database": "BindingDB",
                    "source_record_id": raw_row.get(record_col) if record_col else None,
                    "source_doi": raw_row.get(doi_col) if doi_col else None,
                    "source_pmid": raw_row.get(pmid_col) if pmid_col else None,
                    "curation_kept": True,
                    "curation_flag": "bindingdb_normalized",
                    "assay_confidence": 6,
                    "activity_endpoint_source_column": column,
                }
            )
    return pd.DataFrame(rows)
