from __future__ import annotations

import math
import re
import hashlib
from collections.abc import Iterable

import numpy as np
import pandas as pd

try:
    from rdkit import Chem
    from rdkit import DataStructs, RDLogger
    from rdkit.Chem import Crippen, Descriptors, Lipinski, QED, rdFingerprintGenerator, rdMolDescriptors
    RDLogger.DisableLog("rdApp.error")
    RDLogger.DisableLog("rdApp.warning")
except Exception:
    Chem = None
    Crippen = None
    Descriptors = None
    Lipinski = None
    QED = None
    rdFingerprintGenerator = None
    rdMolDescriptors = None
    DataStructs = None


DESCRIPTOR_COLUMNS = [
    "MW",
    "LogP",
    "TPSA",
    "HBD",
    "HBA",
    "RotBonds",
    "AromaticRings",
    "HeavyAtoms",
    "FractionCSP3",
    "QED",
]
HASHED_FINGERPRINT_COLUMNS = [f"smiles_fp_{idx:03d}" for idx in range(128)]
MORGAN_FINGERPRINT_COLUMNS = [f"morgan_fp_{idx:03d}" for idx in range(256)]
MODEL_FEATURE_COLUMNS = DESCRIPTOR_COLUMNS + HASHED_FINGERPRINT_COLUMNS + MORGAN_FINGERPRINT_COLUMNS


ATOM_WEIGHTS = {
    "C": 12.011,
    "N": 14.007,
    "O": 15.999,
    "S": 32.06,
    "P": 30.974,
    "F": 18.998,
    "Cl": 35.45,
    "Br": 79.904,
    "I": 126.904,
}


def rdkit_available() -> bool:
    return Chem is not None


def _fallback_atom_counts(smiles: str) -> dict[str, int]:
    tokens = re.findall(r"Cl|Br|[CNOSPFIcnosp]", str(smiles))
    counts: dict[str, int] = {}
    for token in tokens:
        atom = token.capitalize()
        counts[atom] = counts.get(atom, 0) + 1
    return counts


def fallback_descriptors(smiles: str) -> dict[str, float]:
    text = str(smiles)
    counts = _fallback_atom_counts(text)
    mw = sum(ATOM_WEIGHTS.get(atom, 12.0) * count for atom, count in counts.items())
    aromatic = len(re.findall(r"[cnosp]", text))
    hetero = sum(counts.get(atom, 0) for atom in ("N", "O", "S", "P"))
    heavy = sum(counts.values())
    halogens = counts.get("F", 0) + counts.get("Cl", 0) + counts.get("Br", 0) + counts.get("I", 0)
    logp = 0.045 * counts.get("C", 0) + 0.22 * halogens + 0.08 * aromatic - 0.35 * hetero
    tpsa = 12.0 * counts.get("N", 0) + 17.0 * counts.get("O", 0) + 25.0 * counts.get("S", 0)
    hbd = len(re.findall(r"N|O", text)) // 3
    hba = counts.get("N", 0) + counts.get("O", 0) + counts.get("S", 0)
    rot = max(0, text.count("C") + text.count("N") - aromatic // 2 - 4)
    qed_proxy = 1.0 / (1.0 + math.exp((abs(mw - 350.0) - 250.0) / 60.0))
    return {
        "MW": float(mw),
        "LogP": float(logp),
        "TPSA": float(tpsa),
        "HBD": float(hbd),
        "HBA": float(hba),
        "RotBonds": float(rot),
        "AromaticRings": float(max(0, aromatic // 6)),
        "HeavyAtoms": float(heavy),
        "FractionCSP3": float(max(0.0, min(1.0, 1.0 - aromatic / max(heavy, 1)))),
        "QED": float(qed_proxy),
    }


def smiles_descriptors(smiles: str) -> dict[str, float]:
    if Chem is None:
        return fallback_descriptors(smiles)
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        values = fallback_descriptors(smiles)
        values["invalid_smiles"] = 1.0
        return values
    return {
        "MW": float(Descriptors.MolWt(mol)),
        "LogP": float(Crippen.MolLogP(mol)),
        "TPSA": float(rdMolDescriptors.CalcTPSA(mol)),
        "HBD": float(Lipinski.NumHDonors(mol)),
        "HBA": float(Lipinski.NumHAcceptors(mol)),
        "RotBonds": float(Lipinski.NumRotatableBonds(mol)),
        "AromaticRings": float(rdMolDescriptors.CalcNumAromaticRings(mol)),
        "HeavyAtoms": float(mol.GetNumHeavyAtoms()),
        "FractionCSP3": float(rdMolDescriptors.CalcFractionCSP3(mol)),
        "QED": float(QED.qed(mol)),
    }


def hashed_smiles_fingerprint(smiles: str, bits: int = 128) -> dict[str, float]:
    text = str(smiles)
    vector = np.zeros(bits, dtype=float)
    for ngram_size in (2, 3, 4, 5):
        if len(text) < ngram_size:
            continue
        for idx in range(0, len(text) - ngram_size + 1):
            token = text[idx : idx + ngram_size]
            bucket = int(hashlib.sha1(token.encode("utf-8")).hexdigest()[:8], 16) % bits
            vector[bucket] += 1.0
    total = vector.sum()
    if total > 0:
        vector /= total
    return {f"smiles_fp_{idx:03d}": float(value) for idx, value in enumerate(vector)}


def morgan_fingerprint(smiles: str, bits: int = 256, radius: int = 2) -> dict[str, float]:
    vector = np.zeros(bits, dtype=float)
    if Chem is None or DataStructs is None:
        return {f"morgan_fp_{idx:03d}": 0.0 for idx in range(bits)}
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return {f"morgan_fp_{idx:03d}": 0.0 for idx in range(bits)}
    if rdFingerprintGenerator is not None:
        generator = rdFingerprintGenerator.GetMorganGenerator(radius=radius, fpSize=bits)
        fp = generator.GetFingerprint(mol)
    else:
        fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(mol, radius, nBits=bits)
    DataStructs.ConvertToNumpyArray(fp, vector)
    return {f"morgan_fp_{idx:03d}": float(value) for idx, value in enumerate(vector)}


def featurize_smiles(smiles_values: Iterable[str]) -> pd.DataFrame:
    rows = []
    for smiles in smiles_values:
        row = smiles_descriptors(smiles)
        row.update(hashed_smiles_fingerprint(smiles))
        row.update(morgan_fingerprint(smiles))
        rows.append(row)
    df = pd.DataFrame(rows)
    for column in MODEL_FEATURE_COLUMNS:
        if column not in df.columns:
            df[column] = 0.0
    return df[MODEL_FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan).fillna(0.0)


def append_descriptors(df: pd.DataFrame, smiles_column: str = "canonical_smiles") -> pd.DataFrame:
    features = featurize_smiles(df[smiles_column].fillna(""))
    out = df.reset_index(drop=True).copy()
    for column in DESCRIPTOR_COLUMNS:
        out[column] = features[column]
    out["rdkit_available"] = rdkit_available()
    return out
