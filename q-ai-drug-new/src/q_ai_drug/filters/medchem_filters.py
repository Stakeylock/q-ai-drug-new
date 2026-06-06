from __future__ import annotations

import argparse
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

from q_ai_drug.config import FiltersConfig, load_config
from q_ai_drug.data.build_oncology_benchmark import canonicalize_smiles
from q_ai_drug.features.descriptors import append_descriptors

try:
    from rdkit import Chem
    from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams
except Exception:
    Chem = None
    FilterCatalog = None
    FilterCatalogParams = None


@lru_cache(maxsize=4)
def _get_filter_catalog(catalog_name: str):
    if Chem is None or FilterCatalog is None or FilterCatalogParams is None:
        return None
    params = FilterCatalogParams()
    if catalog_name == "pains":
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.PAINS)
    elif catalog_name == "brenk":
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.BRENK)
    return FilterCatalog(params)


def _catalog_alerts(smiles: str, catalog_name: str) -> tuple[bool, str]:
    catalog = _get_filter_catalog(catalog_name)
    if catalog is None:
        return False, "not_available"
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return True, "invalid_smiles"
    matches = catalog.GetMatches(mol)
    if not matches:
        return False, "clean"
    return True, ";".join(match.GetDescription() for match in matches[:5])


def apply_medchem_filters(candidates: pd.DataFrame, filters: FiltersConfig) -> pd.DataFrame:
    out = candidates.copy()
    if "canonical_smiles" not in out.columns:
        out["canonical_smiles"] = out["smiles"].map(canonicalize_smiles)
    out = out.dropna(subset=["canonical_smiles"]).drop_duplicates(["target_id", "canonical_smiles"]).copy()
    out = append_descriptors(out, "canonical_smiles")
    out["lipinski_violations"] = (
        (out["MW"] > 500).astype(int)
        + (out["LogP"] > 5).astype(int)
        + (out["HBD"] > 5).astype(int)
        + (out["HBA"] > 10).astype(int)
    )
    out["veber_pass"] = (out["TPSA"] <= 140) & (out["RotBonds"] <= 10)
    out["descriptor_pass"] = (
        (out["MW"] <= filters.max_mw)
        & (out["LogP"] <= filters.max_logp)
        & (out["TPSA"] <= filters.max_tpsa)
        & (out["RotBonds"] <= filters.max_rotatable_bonds)
        & (out["QED"] >= filters.min_qed)
    )
    pains = out["canonical_smiles"].map(lambda smiles: _catalog_alerts(smiles, "pains"))
    out["pains_alert"] = [item[0] for item in pains]
    out["pains_description"] = [item[1] for item in pains]
    brenk = out["canonical_smiles"].map(lambda smiles: _catalog_alerts(smiles, "brenk"))
    out["brenk_alert"] = [item[0] for item in brenk]
    out["brenk_description"] = [item[1] for item in brenk]
    heuristic_toxicity = np.clip(
        0.15 + (out["LogP"] - 2.5).clip(lower=0) * 0.06 + (out["pains_alert"].astype(int) * 0.2),
        0,
        1,
    )
    model_toxicity_parts = []
    for column in ("tox21_toxicity_probability", "clintox_toxicity_probability"):
        if column in out.columns:
            model_toxicity_parts.append(pd.to_numeric(out[column], errors="coerce"))
    if model_toxicity_parts:
        model_toxicity = pd.concat(model_toxicity_parts, axis=1).mean(axis=1)
        out["toxicity_risk_proxy"] = model_toxicity.fillna(heuristic_toxicity)
        out["toxicity_risk_source"] = np.where(model_toxicity.notna(), "trained_admet_model", "descriptor_proxy")
    else:
        out["toxicity_risk_proxy"] = heuristic_toxicity
        out["toxicity_risk_source"] = "descriptor_proxy"

    base_admet_score = np.clip(
        0.35 * out["QED"]
        + 0.25 * out["veber_pass"].astype(float)
        + 0.20 * (1 - out["toxicity_risk_proxy"])
        + 0.20 * (1 - out["lipinski_violations"].clip(upper=4) / 4),
        0,
        1,
    )
    if "admet_model_score" in out.columns:
        model_score = pd.to_numeric(out["admet_model_score"], errors="coerce")
        out["admet_score"] = np.clip((0.65 * model_score + 0.35 * base_admet_score).fillna(base_admet_score), 0, 1)
        out["admet_score_source"] = np.where(model_score.notna(), "trained_admet_model_blend", "descriptor_proxy")
    else:
        out["admet_score"] = base_admet_score
        out["admet_score_source"] = "descriptor_proxy"
    out["filter_pass"] = out["descriptor_pass"]
    if filters.remove_pains:
        out["filter_pass"] &= ~out["pains_alert"]
    if filters.remove_brenk:
        out["filter_pass"] &= ~out["brenk_alert"]
    return out


def filter_candidates(
    in_csv: str | Path,
    out_csv: str | Path,
    filters: FiltersConfig,
    *,
    top_per_target: int | None = None,
) -> pd.DataFrame:
    candidates = pd.read_csv(in_csv)
    filtered = apply_medchem_filters(candidates, filters)
    passed = filtered[filtered["filter_pass"]].copy()
    if "activity_score" in passed.columns:
        score_col = "activity_score"
    else:
        score_col = "admet_score"
    passed = passed.sort_values(["target_id", score_col, "admet_score"], ascending=[True, False, False])
    if top_per_target:
        passed = passed.groupby("target_id", group_keys=False).head(top_per_target)
    out_path = Path(out_csv)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    passed.to_csv(out_path, index=False)
    filtered.to_csv(out_path.with_name(out_path.stem + "_all.csv"), index=False)
    return passed


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Apply medicinal chemistry filters.")
    parser.add_argument("--config", default="configs/cancer_targets.yaml")
    parser.add_argument("--in", dest="in_csv", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--top-per-target", type=int, default=None)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    out = filter_candidates(args.in_csv, args.out, config.filters, top_per_target=args.top_per_target)
    print(f"Wrote {len(out)} filtered candidates to {args.out}")


if __name__ == "__main__":
    main()
