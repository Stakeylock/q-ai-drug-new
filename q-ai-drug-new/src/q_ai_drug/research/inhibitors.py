from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pandas as pd
import yaml

try:
    from rdkit import Chem, DataStructs
    from rdkit.Chem import rdFingerprintGenerator
except Exception:
    Chem = None
    DataStructs = None
    rdFingerprintGenerator = None


TARGET_FAMILY = {
    "EGFR": "receptor_tyrosine_kinase",
    "PARP1": "dna_damage_response_enzyme",
    "PIK3CA": "lipid_kinase",
}


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size <= 0:
        return pd.DataFrame()
    try:
        return pd.read_csv(path)
    except pd.errors.EmptyDataError:
        return pd.DataFrame()


def _load_pockets(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return {str(row.get("target_id")): row for row in payload.get("pockets", []) if row.get("target_id")}


def _fp(smiles: str):
    if Chem is None or DataStructs is None:
        return None
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return None
    if rdFingerprintGenerator is not None:
        return rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048).GetFingerprint(mol)
    from rdkit.Chem import rdMolDescriptors

    return rdMolDescriptors.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048)


def _similarity(smiles_a: str, smiles_b: str) -> float:
    fp_a = _fp(smiles_a)
    fp_b = _fp(smiles_b)
    if fp_a is None or fp_b is None:
        return float("nan")
    return float(DataStructs.TanimotoSimilarity(fp_a, fp_b))


def _novelty_label(similarity: float) -> str:
    if math.isnan(similarity):
        return "unknown_similarity_requires_review"
    if similarity > 0.90:
        return "reference_reuse_or_too_close_for_novelty"
    if similarity >= 0.70:
        return "close_known_inhibitor_analogue"
    if similarity >= 0.45:
        return "moderate_inhibitor_similarity"
    return "distant_or_novel_relative_to_reference_inhibitors"


def build_inhibitor_registry(
    project_dir: str | Path,
    references_csv: str | Path = "data/processed/reference_inhibitors.csv",
    pockets_yaml: str | Path = "configs/oncology_pockets.yaml",
) -> dict[str, Any]:
    project_dir = Path(project_dir)
    out_dir = project_dir / "inhibitors"
    out_dir.mkdir(parents=True, exist_ok=True)
    references = _read_csv(Path(references_csv))
    pockets = _load_pockets(Path(pockets_yaml))
    rows: list[dict[str, Any]] = []
    for _, row in references.iterrows():
        target_id = str(row.get("target_id") or "")
        pocket = pockets.get(target_id, {})
        name = str(row.get("query_name") or "")
        rows.append(
            {
                "target_id": target_id,
                "target_family": TARGET_FAMILY.get(target_id, "oncology_target"),
                "inhibitor_name": name,
                "synonyms": name,
                "canonical_smiles": row.get("canonical_smiles"),
                "isomeric_smiles": row.get("isomeric_smiles"),
                "pubchem_cid": row.get("cid"),
                "activity_type": "reference_control",
                "activity_value": None,
                "activity_unit": None,
                "assay_source": "PubChem/reference panel configured for retrospective computational controls",
                "assay_confidence": "reference_control_not_manual_assay_review",
                "status": "approved_or_reference_inhibitor" if row.get("retrieval_status") == "ok" else "reference_lookup_failed",
                "nearest_target": target_id,
                "off_targets": "not_curated",
                "selectivity_notes": "Use as a target reference/control; selectivity counterscreens remain future work unless supplied by user.",
                "co_crystal_pdb": pocket.get("pdb_id") if str(pocket.get("reference_ligand", "")).lower() == name.lower() else None,
                "reference_ligand_code": pocket.get("reference_ligand_code") if str(pocket.get("reference_ligand", "")).lower() == name.lower() else None,
                "ip_warning": "Similarity to this inhibitor must not be presented as novel chemistry without IP/procurement review.",
                "retrieval_status": row.get("retrieval_status"),
            }
        )
    registry = pd.DataFrame(rows)
    registry.to_csv(out_dir / "inhibitor_registry.csv", index=False)
    (out_dir / "inhibitor_registry.json").write_text(json.dumps(rows, indent=2, default=str), encoding="utf-8")
    return {"registry_rows": int(len(registry)), "targets": sorted(registry["target_id"].dropna().astype(str).unique().tolist()) if not registry.empty else []}


def build_candidate_inhibitor_proximity(
    project_dir: str | Path,
    references_csv: str | Path = "data/processed/reference_inhibitors.csv",
) -> pd.DataFrame:
    project_dir = Path(project_dir)
    out_dir = project_dir / "inhibitors"
    out_dir.mkdir(parents=True, exist_ok=True)
    candidates = _read_csv(project_dir / "final_ranked_candidates.csv")
    if candidates.empty:
        candidates = _read_csv(project_dir / "top_candidates.csv")
    references = _read_csv(Path(references_csv))
    rows: list[dict[str, Any]] = []
    refs_by_target = {
        target_id: group.dropna(subset=["canonical_smiles"]).to_dict("records")
        for target_id, group in references.groupby("target_id")
    } if not references.empty and "target_id" in references.columns else {}
    for _, candidate in candidates.iterrows():
        target_id = str(candidate.get("target_id") or "")
        smiles = str(candidate.get("canonical_smiles") or candidate.get("smiles") or "")
        refs = refs_by_target.get(target_id, [])
        best: dict[str, Any] | None = None
        best_similarity = float("nan")
        for ref in refs:
            sim = _similarity(smiles, str(ref.get("canonical_smiles") or ""))
            if math.isnan(sim):
                continue
            if best is None or sim > best_similarity:
                best = ref
                best_similarity = sim
        rows.append(
            {
                "target_id": target_id,
                "candidate_id": candidate.get("candidate_id"),
                "canonical_smiles": smiles,
                "nearest_inhibitor_name": best.get("query_name") if best else None,
                "nearest_inhibitor_cid": best.get("cid") if best else None,
                "nearest_inhibitor_similarity": best_similarity,
                "novelty_label": _novelty_label(best_similarity),
                "too_close_for_novelty_claim": bool(not math.isnan(best_similarity) and best_similarity > 0.90),
                "comparison_note": (
                    "Candidate is very close to a configured reference inhibitor; treat as analogue/reference-proximity chemistry."
                    if not math.isnan(best_similarity) and best_similarity > 0.90
                    else "Candidate is differentiated from configured reference inhibitors by fingerprint similarity."
                ),
            }
        )
    proximity = pd.DataFrame(rows)
    proximity.to_csv(out_dir / "candidate_inhibitor_proximity.csv", index=False)
    return proximity


def write_inhibitor_comparison_dossier(project_dir: str | Path) -> Path:
    project_dir = Path(project_dir)
    out_dir = project_dir / "inhibitors"
    out_dir.mkdir(parents=True, exist_ok=True)
    proximity = _read_csv(out_dir / "candidate_inhibitor_proximity.csv")
    registry = _read_csv(out_dir / "inhibitor_registry.csv")
    lines = [
        "# Inhibitor Comparison Dossier",
        "",
        "Known inhibitors are used as controls, seed/proximity anchors, and novelty guards. This dossier does not claim that reference-proximal candidates are new drugs.",
        "",
        f"- Registry rows: {len(registry)}",
        f"- Candidate proximity rows: {len(proximity)}",
        "",
        "## Reference-Proximity Rules",
        "- Similarity > 0.90 to a configured reference inhibitor is not called novel.",
        "- Close analogues may still be useful as computational hypotheses, but require IP, synthesis, and assay review.",
        "- Reference inhibitors must remain controls in retrospective benchmarks and redocking validation.",
        "",
        "## Target Summary",
    ]
    if not proximity.empty:
        for target_id, group in proximity.groupby("target_id"):
            high = int(group.get("too_close_for_novelty_claim", pd.Series(False, index=group.index)).astype(bool).sum())
            mean_sim = pd.to_numeric(group.get("nearest_inhibitor_similarity"), errors="coerce").mean()
            lines.append(f"- {target_id}: {len(group)} candidates, {high} too close for novelty claim, mean nearest-inhibitor similarity {mean_sim:.3f}.")
    lines.extend(
        [
            "",
            "## Claim Boundary",
            "Computational research hypothesis only. Inhibitor similarity supports explainability and control selection, not therapeutic validation.",
            "",
        ]
    )
    path = out_dir / "inhibitor_comparison_dossier.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def build_inhibitor_artifacts(
    project_dir: str | Path,
    references_csv: str | Path = "data/processed/reference_inhibitors.csv",
    pockets_yaml: str | Path = "configs/oncology_pockets.yaml",
) -> dict[str, Any]:
    registry_summary = build_inhibitor_registry(project_dir, references_csv, pockets_yaml)
    proximity = build_candidate_inhibitor_proximity(project_dir, references_csv)
    dossier = write_inhibitor_comparison_dossier(project_dir)
    return {
        **registry_summary,
        "candidate_proximity_rows": int(len(proximity)),
        "inhibitor_comparison_dossier": str(dossier),
    }
