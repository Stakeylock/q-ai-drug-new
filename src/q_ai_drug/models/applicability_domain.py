from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

try:
    from rdkit import Chem, DataStructs
    from rdkit.Chem import rdFingerprintGenerator, rdMolDescriptors
except Exception:
    Chem = None
    DataStructs = None
    rdFingerprintGenerator = None
    rdMolDescriptors = None


def _fingerprint(smiles: str):
    if Chem is None or DataStructs is None:
        return None
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return None
    if rdFingerprintGenerator is not None:
        return rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048).GetFingerprint(mol)
    return rdMolDescriptors.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048)


def _scaffold(smiles: str) -> str:
    if Chem is None:
        return ""
    from rdkit.Chem.Scaffolds import MurckoScaffold

    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return ""
    return Chem.MolToSmiles(MurckoScaffold.GetScaffoldForMol(mol), canonical=True)


def _max_similarity(fp, refs: list) -> float:
    if fp is None or not refs or DataStructs is None:
        return 0.0
    return float(max(DataStructs.TanimotoSimilarity(fp, ref) for ref in refs if ref is not None) or 0.0)


def _nearest_reference(fp, reference_rows: list[dict]) -> tuple[str, float]:
    if fp is None or not reference_rows or DataStructs is None:
        return "", 0.0
    best_name = ""
    best_score = 0.0
    for row in reference_rows:
        ref_fp = row.get("fp")
        if ref_fp is None:
            continue
        score = float(DataStructs.TanimotoSimilarity(fp, ref_fp))
        if score > best_score:
            best_score = score
            best_name = str(row.get("name") or row.get("molecule_chembl_id") or "")
    return best_name, best_score


def build_applicability_domain(
    candidates: pd.DataFrame,
    benchmark: pd.DataFrame,
    out_csv: str | Path | None = None,
    *,
    reference_drugs: pd.DataFrame | None = None,
) -> pd.DataFrame:
    rows = []
    candidates = candidates.copy()
    if "canonical_smiles" not in candidates.columns and "smiles" in candidates.columns:
        candidates["canonical_smiles"] = candidates["smiles"]

    training_by_target: dict[str, dict] = {}
    for target_id, target_df in benchmark.groupby("target_id"):
        train_df = target_df[target_df.get("split", "train").isin(["train", "validation"])].copy()
        active_df = train_df[train_df["label_active"].astype(int).eq(1)]
        training_by_target[str(target_id)] = {
            "fps": [_fingerprint(smiles) for smiles in train_df["canonical_smiles"].fillna("")],
            "active_fps": [_fingerprint(smiles) for smiles in active_df["canonical_smiles"].fillna("")],
            "scaffolds": set(train_df.get("murcko_scaffold", pd.Series(dtype=str)).fillna("").astype(str)),
        }

    refs_by_target: dict[str, list[dict]] = {}
    if reference_drugs is not None and not reference_drugs.empty:
        smiles_column = "canonical_smiles" if "canonical_smiles" in reference_drugs.columns else "smiles"
        for target_id, group in reference_drugs.groupby("target_id"):
            refs_by_target[str(target_id)] = [
                {**row, "fp": _fingerprint(str(row.get(smiles_column, "")))}
                for row in group.to_dict("records")
            ]

    for row in candidates.to_dict("records"):
        target_id = str(row.get("target_id") or "")
        smiles = str(row.get("canonical_smiles") or row.get("smiles") or "")
        fp = _fingerprint(smiles)
        target_train = training_by_target.get(target_id, {"fps": [], "active_fps": [], "scaffolds": set()})
        scaffold = _scaffold(smiles)
        nearest_training = _max_similarity(fp, target_train["fps"])
        nearest_active = _max_similarity(fp, target_train["active_fps"])
        nearest_ref_name, nearest_ref_similarity = _nearest_reference(fp, refs_by_target.get(target_id, []))
        scaffold_seen = scaffold in target_train["scaffolds"] if scaffold else False
        if nearest_training >= 0.70 or scaffold_seen:
            domain = "high"
            confidence = 0.90
        elif nearest_training >= 0.50:
            domain = "medium"
            confidence = 0.70
        elif nearest_training >= 0.35:
            domain = "low"
            confidence = 0.45
        else:
            domain = "out-of-domain"
            confidence = 0.25
        rows.append(
            {
                "target_id": target_id,
                "candidate_id": row.get("candidate_id"),
                "canonical_smiles": smiles,
                "murcko_scaffold": scaffold,
                "nearest_training_similarity": nearest_training,
                "nearest_active_similarity": nearest_active,
                "nearest_reference_drug": nearest_ref_name,
                "nearest_reference_similarity": nearest_ref_similarity,
                "scaffold_seen_in_training": bool(scaffold_seen),
                "scaffold_novelty": "seen" if scaffold_seen else "unseen",
                "applicability_domain": domain,
                "prediction_confidence": confidence,
            }
        )
    out = pd.DataFrame(rows)
    if out_csv:
        path = Path(out_csv)
        path.parent.mkdir(parents=True, exist_ok=True)
        out.to_csv(path, index=False)
    return out


def descriptor_distance_summary(candidates: pd.DataFrame, benchmark: pd.DataFrame) -> pd.DataFrame:
    numeric_cols = [col for col in ["MW", "LogP", "TPSA", "HBD", "HBA", "RotBonds", "QED"] if col in candidates.columns and col in benchmark.columns]
    rows = []
    for target_id, target_candidates in candidates.groupby("target_id"):
        target_train = benchmark[benchmark["target_id"].eq(target_id)]
        for _, row in target_candidates.iterrows():
            distances = []
            for column in numeric_cols:
                train_values = pd.to_numeric(target_train[column], errors="coerce").dropna() if column in target_train else pd.Series(dtype=float)
                if train_values.empty:
                    continue
                mean = train_values.mean()
                std = train_values.std() or 1.0
                distances.append(abs(float(row[column]) - mean) / std)
            rows.append(
                {
                    "target_id": target_id,
                    "candidate_id": row.get("candidate_id"),
                    "descriptor_z_distance_mean": float(np.mean(distances)) if distances else np.nan,
                }
            )
    return pd.DataFrame(rows)
