from __future__ import annotations

import gzip
import json
import math
import shutil
import time
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests

from q_ai_drug.config import AppConfig, TargetConfig

CHEMBL_BASE = "https://www.ebi.ac.uk/chembl/api/data"
PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
RCSB_SEARCH = "https://search.rcsb.org/rcsbsearch/v2/query"
RCSB_DOWNLOAD = "https://files.rcsb.org/download/{pdb_id}.pdb"
ALPHAFOLD_PDB = "https://alphafold.ebi.ac.uk/files/AF-{uniprot_id}-F1-model_v{version}.pdb"
DEEPCHEM_TOX21 = "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/tox21.csv.gz"
DEEPCHEM_CLINTOX = "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/clintox.csv.gz"
BINDINGDB_ALL = "https://www.bindingdb.org/bind/downloads/BindingDB_All.tsv.zip"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "q-ai-drug/0.1 research pipeline"})


def safe_get_json(url: str, params: dict | None = None, retries: int = 3, sleep_s: float = 1.0) -> dict:
    last_error: Exception | None = None
    for _ in range(retries):
        try:
            response = SESSION.get(url, params=params, timeout=60)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            last_error = exc
            time.sleep(sleep_s)
    raise RuntimeError(f"Failed GET JSON: {url} params={params}: {last_error}")


def download_file(url: str, out_path: Path, retries: int = 3, timeout: int = 180) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists() and out_path.stat().st_size > 0:
        return out_path
    last_error: Exception | None = None
    tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")
    for _ in range(retries):
        try:
            with SESSION.get(url, stream=True, timeout=timeout) as response:
                response.raise_for_status()
                with tmp_path.open("wb") as handle:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            handle.write(chunk)
            tmp_path.replace(out_path)
            return out_path
        except Exception as exc:
            last_error = exc
            if tmp_path.exists():
                tmp_path.unlink()
            time.sleep(2)
    raise RuntimeError(f"Failed download: {url}: {last_error}")


def maybe_decompress_gzip(gz_path: Path, out_path: Path | None = None) -> Path:
    if gz_path.suffix != ".gz":
        return gz_path
    out_path = out_path or gz_path.with_suffix("")
    if out_path.exists() and out_path.stat().st_size > 0:
        return out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(gz_path, "rb") as src, out_path.open("wb") as dst:
        shutil.copyfileobj(src, dst)
    return out_path


def find_chembl_targets(gene: str, organism: str = "Homo sapiens") -> pd.DataFrame:
    payload = safe_get_json(f"{CHEMBL_BASE}/target/search.json", params={"q": gene, "limit": 50})
    rows = []
    for item in payload.get("targets", []):
        rows.append(
            {
                "gene_query": gene,
                "target_chembl_id": item.get("target_chembl_id"),
                "pref_name": item.get("pref_name"),
                "organism": item.get("organism"),
                "target_type": item.get("target_type"),
                "score": item.get("score") or 0,
            }
        )
    df = pd.DataFrame(rows)
    if not df.empty:
        df = df[df["organism"].fillna("").str.contains(organism, case=False, regex=False)]
        df = df.sort_values(["score", "target_type"], ascending=[False, True])
    return df


def select_chembl_target(targets: pd.DataFrame) -> str | None:
    if targets.empty:
        return None
    preferred = targets[targets["target_type"].fillna("").str.contains("SINGLE PROTEIN", case=False, regex=False)]
    if not preferred.empty:
        return str(preferred.iloc[0]["target_chembl_id"])
    return str(targets.iloc[0]["target_chembl_id"])


def fetch_chembl_activities(
    target_chembl_id: str,
    standard_types: Iterable[str] = ("IC50", "Ki", "Kd"),
    limit: int = 1000,
    max_records: int | None = None,
) -> pd.DataFrame:
    rows = []
    offset = 0
    standard_type_filter = ",".join(standard_types)
    while True:
        params = {
            "target_chembl_id": target_chembl_id,
            "standard_type__in": standard_type_filter,
            "standard_units": "nM",
            "limit": limit,
            "offset": offset,
        }
        payload = safe_get_json(f"{CHEMBL_BASE}/activity.json", params=params)
        acts = payload.get("activities", [])
        for activity in acts:
            rows.append(
                {
                    "target_chembl_id": target_chembl_id,
                    "molecule_chembl_id": activity.get("molecule_chembl_id"),
                    "canonical_smiles": activity.get("canonical_smiles"),
                    "standard_type": activity.get("standard_type"),
                    "standard_relation": activity.get("standard_relation"),
                    "standard_value_nm": activity.get("standard_value"),
                    "standard_units": activity.get("standard_units"),
                    "assay_chembl_id": activity.get("assay_chembl_id"),
                    "document_chembl_id": activity.get("document_chembl_id"),
                }
            )
            if max_records and len(rows) >= max_records:
                break
        if max_records and len(rows) >= max_records:
            break
        page_meta = payload.get("page_meta", {})
        total_count = page_meta.get("total_count", len(rows))
        offset += limit
        if offset >= total_count or not acts:
            break
        time.sleep(0.2)
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["standard_value_nm"] = pd.to_numeric(df["standard_value_nm"], errors="coerce")
    df = df.dropna(subset=["canonical_smiles", "standard_value_nm"])
    df = df[df["standard_value_nm"] > 0].copy()
    df["p_activity"] = -df["standard_value_nm"].mul(1e-9).apply(math.log10)
    df["label_active"] = (df["p_activity"] >= 6.0).astype(int)
    return df


def fetch_pubchem_smiles_by_name(name: str) -> dict:
    url = f"{PUBCHEM_BASE}/compound/name/{name}/property/CanonicalSMILES,IsomericSMILES,IUPACName/JSON"
    payload = safe_get_json(url)
    props = payload["PropertyTable"]["Properties"][0]
    canonical = props.get("CanonicalSMILES") or props.get("ConnectivitySMILES") or props.get("SMILES")
    isomeric = props.get("IsomericSMILES") or props.get("SMILES") or canonical
    return {
        "query_name": name,
        "cid": props.get("CID"),
        "canonical_smiles": canonical,
        "isomeric_smiles": isomeric,
        "iupac_name": props.get("IUPACName"),
    }


def download_moleculenet_admet(raw_dir: Path) -> dict[str, Path]:
    tox21_gz = download_file(DEEPCHEM_TOX21, raw_dir / "tox21.csv.gz")
    clintox_gz = download_file(DEEPCHEM_CLINTOX, raw_dir / "clintox.csv.gz")
    return {
        "tox21_gz": tox21_gz,
        "tox21_csv": maybe_decompress_gzip(tox21_gz),
        "clintox_gz": clintox_gz,
        "clintox_csv": maybe_decompress_gzip(clintox_gz),
    }


def download_bindingdb(raw_dir: Path) -> Path:
    return download_file(BINDINGDB_ALL, raw_dir / "BindingDB_All.tsv.zip", timeout=600)


def search_rcsb_by_uniprot(uniprot_id: str, rows: int = 20) -> list[str]:
    query = {
        "query": {
            "type": "terminal",
            "service": "text",
            "parameters": {
                "attribute": "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession",
                "operator": "exact_match",
                "value": uniprot_id,
            },
        },
        "request_options": {"paginate": {"start": 0, "rows": rows}},
        "return_type": "entry",
    }
    response = SESSION.post(RCSB_SEARCH, json=query, timeout=60)
    response.raise_for_status()
    payload = response.json()
    return [item["identifier"] for item in payload.get("result_set", [])]


def download_rcsb_pdb(pdb_id: str, structure_dir: Path) -> Path:
    return download_file(RCSB_DOWNLOAD.format(pdb_id=pdb_id.upper()), structure_dir / f"{pdb_id.upper()}.pdb")


def download_alphafold_model(uniprot_id: str, structure_dir: Path, target_id: str | None = None) -> Path:
    name = f"{target_id}_alphafold.pdb" if target_id else f"AF-{uniprot_id}-F1-model_v4.pdb"
    errors = []
    for version in range(6, 0, -1):
        url = ALPHAFOLD_PDB.format(uniprot_id=uniprot_id, version=version)
        try:
            return download_file(url, structure_dir / name)
        except Exception as exc:
            errors.append(f"v{version}: {exc}")
    raise RuntimeError("; ".join(errors))


def build_reference_drug_panel(targets: dict[str, TargetConfig], out_csv: Path, *, force_refresh: bool = False) -> pd.DataFrame:
    if out_csv.exists() and not force_refresh:
        existing = pd.read_csv(out_csv)
        if "canonical_smiles" in existing.columns and existing["canonical_smiles"].notna().all() and (existing["canonical_smiles"].astype(str).str.len() > 0).all():
            return existing
    rows = []
    for target_id, target in targets.items():
        for drug in target.reference_drugs:
            try:
                rec = fetch_pubchem_smiles_by_name(drug)
                rec["target_id"] = target_id
                rec["retrieval_status"] = "ok"
                rows.append(rec)
            except Exception as exc:
                rows.append({"target_id": target_id, "query_name": drug, "retrieval_status": "failed", "error": str(exc)})
            time.sleep(0.2)
    df = pd.DataFrame(rows)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_csv, index=False)
    return df


def retrieve_for_config(
    config: AppConfig,
    *,
    max_records_per_target: int | None = None,
    include_bindingdb: bool = False,
    include_rcsb_search: bool = True,
    force_refresh: bool = False,
) -> dict[str, object]:
    raw_dir = config.paths.raw_dir
    processed_dir = config.paths.processed_dir
    structure_dir = config.paths.structure_dir
    raw_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)
    structure_dir.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, object] = {"targets": {}, "admet": {}, "bindingdb": None}
    previous_manifest_path = processed_dir / "retrieval_manifest.json"
    if previous_manifest_path.exists() and not force_refresh:
        try:
            previous_manifest = json.loads(previous_manifest_path.read_text())
        except Exception:
            previous_manifest = {}
    else:
        previous_manifest = {}
    for target_id, target in config.primary_targets.items():
        target_manifest: dict[str, object] = {}
        previous_target = (previous_manifest.get("targets") or {}).get(target_id, {})
        target_search_path = raw_dir / f"{target_id}_chembl_targets.csv"
        if target_search_path.exists() and not force_refresh:
            target_search = pd.read_csv(target_search_path)
        else:
            target_search = find_chembl_targets(target.gene)
            target_search.to_csv(target_search_path, index=False)
        chembl_id = select_chembl_target(target_search)
        target_manifest["chembl_target_search"] = str(target_search_path)
        target_manifest["chembl_target_id"] = chembl_id
        if chembl_id:
            activities_path = raw_dir / f"{target_id}_chembl_activities.csv"
            if activities_path.exists() and not force_refresh:
                activities = pd.read_csv(activities_path)
            else:
                activities = fetch_chembl_activities(
                    chembl_id,
                    standard_types=target.activity_types,
                    max_records=max_records_per_target,
                )
                activities["target_id"] = target_id
                activities.to_csv(activities_path, index=False)
            target_manifest["chembl_activities"] = str(activities_path)
            target_manifest["activity_records"] = int(len(activities))

        structures = []
        for pdb_id in target.preferred_pdb_ids:
            try:
                structures.append(str(download_rcsb_pdb(pdb_id, structure_dir)))
            except Exception as exc:
                structures.append(f"failed:{pdb_id}:{exc}")
        if include_rcsb_search:
            previous_rcsb = previous_target.get("rcsb_candidates") or []
            previous_structures = [
                path for path in (previous_target.get("structures") or []) if path and "alphafold" not in str(path).lower()
            ]
            if previous_rcsb and previous_structures and all(Path(path).exists() for path in previous_structures):
                target_manifest["rcsb_candidates"] = previous_rcsb
                structures.extend(previous_structures)
            else:
                try:
                    rcsb_ids = search_rcsb_by_uniprot(target.uniprot_id, rows=5)
                    target_manifest["rcsb_candidates"] = rcsb_ids
                    for pdb_id in rcsb_ids[:1]:
                        structures.append(str(download_rcsb_pdb(pdb_id, structure_dir)))
                except Exception as exc:
                    target_manifest["rcsb_error"] = str(exc)
        try:
            structures.append(str(download_alphafold_model(target.uniprot_id, structure_dir, target_id=target_id)))
        except Exception as exc:
            target_manifest["alphafold_error"] = str(exc)
        target_manifest["structures"] = structures
        manifest["targets"][target_id] = target_manifest

    references = build_reference_drug_panel(config.primary_targets, processed_dir / "reference_inhibitors.csv", force_refresh=force_refresh)
    manifest["reference_inhibitors"] = str(processed_dir / "reference_inhibitors.csv")
    manifest["reference_inhibitor_records"] = int(len(references))
    try:
        admet = download_moleculenet_admet(raw_dir)
        manifest["admet"] = {key: str(value) for key, value in admet.items()}
    except Exception as exc:
        manifest["admet"] = {"error": str(exc)}
    if include_bindingdb:
        manifest["bindingdb"] = str(download_bindingdb(raw_dir))

    manifest_path = processed_dir / "retrieval_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    return manifest
