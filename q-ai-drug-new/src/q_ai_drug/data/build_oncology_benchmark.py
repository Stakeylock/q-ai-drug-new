from __future__ import annotations

import hashlib
from pathlib import Path

import pandas as pd

from q_ai_drug.config import AppConfig

try:
    from rdkit import Chem
    from rdkit import RDLogger
    from rdkit.Chem.Scaffolds import MurckoScaffold
    RDLogger.DisableLog("rdApp.error")
    RDLogger.DisableLog("rdApp.warning")
except Exception:
    Chem = None
    MurckoScaffold = None


def strip_to_largest_fragment(smiles: str) -> str | None:
    text = str(smiles).strip()
    if not text or text.lower() == "nan":
        return None
    parts = [part for part in text.split(".") if part]
    if not parts:
        return None
    return max(parts, key=len)


def canonicalize_smiles(smiles: str) -> str | None:
    largest = strip_to_largest_fragment(smiles)
    if largest is None:
        return None
    if Chem is None:
        return largest
    mol = Chem.MolFromSmiles(largest)
    if mol is None:
        return None
    return Chem.MolToSmiles(mol, canonical=True)


def murcko_scaffold(smiles: str) -> str:
    if Chem is None or MurckoScaffold is None:
        value = canonicalize_smiles(smiles) or str(smiles)
        return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return hashlib.sha1(str(smiles).encode("utf-8")).hexdigest()[:12]
    scaffold = MurckoScaffold.MurckoScaffoldSmiles(mol=mol)
    return scaffold or Chem.MolToSmiles(mol, canonical=True)


def _hash_split(value: str) -> str:
    bucket = int(hashlib.sha1(value.encode("utf-8")).hexdigest(), 16) % 10
    if bucket < 7:
        return "train"
    if bucket < 8:
        return "validation"
    return "test"


def build_oncology_benchmark(config: AppConfig, out_path: str | Path | None = None) -> pd.DataFrame:
    frames = []
    for target_id in config.primary_targets:
        path = config.paths.raw_dir / f"{target_id}_chembl_activities.csv"
        if not path.exists():
            continue
        df = pd.read_csv(path)
        if "target_id" not in df.columns:
            df["target_id"] = target_id
        frames.append(df)
    if not frames:
        raise FileNotFoundError("No ChEMBL activity CSVs found. Run download-data first.")

    benchmark = pd.concat(frames, ignore_index=True)
    benchmark["canonical_smiles"] = benchmark["canonical_smiles"].map(canonicalize_smiles)
    benchmark = benchmark.dropna(subset=["canonical_smiles", "p_activity"]).copy()
    benchmark["p_activity"] = pd.to_numeric(benchmark["p_activity"], errors="coerce")
    benchmark = benchmark.dropna(subset=["p_activity"])
    benchmark["label_active"] = (
        benchmark["p_activity"] >= config.proof_run.active_threshold_pic50
    ).astype(int)
    benchmark = (
        benchmark.sort_values("p_activity", ascending=False)
        .drop_duplicates(["target_id", "canonical_smiles"], keep="first")
        .reset_index(drop=True)
    )
    benchmark["murcko_scaffold"] = benchmark["canonical_smiles"].map(murcko_scaffold)
    benchmark["split"] = benchmark["murcko_scaffold"].map(_hash_split)
    benchmark["source"] = "chembl"

    out_path = Path(out_path or config.paths.processed_dir / "oncology_benchmark.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    benchmark.to_csv(out_path, index=False)
    try:
        benchmark.to_parquet(out_path.with_suffix(".parquet"), index=False)
    except Exception:
        pass

    summary = (
        benchmark.groupby(["target_id", "split", "label_active"])
        .size()
        .rename("records")
        .reset_index()
    )
    summary.to_csv(config.paths.processed_dir / "oncology_benchmark_summary.csv", index=False)
    return benchmark


def load_benchmark(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    return pd.read_csv(path)
