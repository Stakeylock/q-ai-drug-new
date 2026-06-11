from __future__ import annotations

import argparse
import hashlib
import itertools
import random
from pathlib import Path

import pandas as pd

from q_ai_drug.config import load_config
from q_ai_drug.data.build_oncology_benchmark import canonicalize_smiles

AMINES = [
    "NC1CCCCC1",
    "N1CCCCC1",
    "NCCN(C)C",
    "NCc1ccccc1",
    "NCCO",
    "N(C)C",
    "NC(C)C",
    "NC1CCNCC1",
    "NCC(F)(F)F",
    "NCC#N",
    "NC1CCCC1",
    "NC1CCOC1",
    "NCCc1ccccc1",
    "NC(C)(C)C",
    "NC(C)CO",
    "NCCS(=O)(=O)C",
    "NCC1CC1",
    "NC2CCN(C)CC2",
]
SUBSTITUENTS = ["F", "Cl", "Br", "C", "CC", "OC", "OCC", "C(F)(F)F", "N", "C#N", "S(=O)(=O)N", "C(=O)N", "C(=O)O"]
TERMINAL_SUBSTITUENTS = ["F", "Cl", "C", "CC", "OC", "C#N", "C(F)(F)F", "N"]
ARYL_CORES = [
    "c1ccc({sub})cc1",
    "c1cc({sub})ccc1",
    "c1ccncc1",
    "c1ncccc1",
    "c1ccc2ncccc2c1",
    "c1ccc2ccccc2c1",
]
TEMPLATES = [
    "O=C({amine}){aryl}",
    "CO{aryl}C(=O){amine}",
    "{aryl}S(=O)(=O){amine}",
    "CC(=O){amine}",
    "N#CC{aryl}C(=O){amine}",
    "COc1ccc(C(=O){amine})cc1",
    "O=C({amine})c1cc({sub})ccc1",
    "O=C({amine})c1c({sub})cccc1",
]


def _stable_id(*values: str, length: int = 12) -> str:
    text = "|".join(values)
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:length]


def _template_candidates() -> list[str]:
    smiles = []
    for template, amine, sub, aryl_core in itertools.product(TEMPLATES, AMINES, SUBSTITUENTS, ARYL_CORES):
        aryl = aryl_core.format(sub=sub)
        smiles.append(template.format(amine=amine, sub=sub, aryl=aryl))
    for amine, sub1, sub2, sub3 in itertools.product(AMINES, SUBSTITUENTS, SUBSTITUENTS, TERMINAL_SUBSTITUENTS):
        smiles.append(f"O=C({amine})c1cc({sub1})c({sub2})cc1{sub3}")
        smiles.append(f"COc1cc({sub1})c(C(=O){amine})cc1{sub2}")
        smiles.append(f"N#Cc1cc({sub1})c(C(=O){amine})cc1{sub3}")
        smiles.append(f"{sub3}c1cc({sub1})c(S(=O)(=O){amine})cc1{sub2}")
    return smiles


def _load_existing_generated(paths: list[Path]) -> pd.DataFrame:
    frames = []
    for path in paths:
        if path.exists():
            df = pd.read_csv(path)
            if "smiles" in df.columns:
                frames.append(df[["smiles"]].assign(source_file=str(path)))
    if not frames:
        return pd.DataFrame(columns=["smiles", "source_file"])
    return pd.concat(frames, ignore_index=True).dropna(subset=["smiles"])


def generate_candidates(
    *,
    target_ids: list[str],
    reference_csv: str | Path | None,
    benchmark_csv: str | Path | None,
    out_csv: str | Path,
    n_per_target: int = 5000,
    random_seed: int = 13,
    existing_generated_paths: list[str | Path] | None = None,
) -> pd.DataFrame:
    rng = random.Random(random_seed)
    seed_rows = []
    if reference_csv and Path(reference_csv).exists():
        ref = pd.read_csv(reference_csv)
        for row in ref.dropna(subset=["canonical_smiles"]).to_dict("records"):
            seed_rows.append(
                {
                    "target_id": row.get("target_id"),
                    "smiles": row.get("canonical_smiles"),
                    "source": "reference_inhibitor",
                    "parent_name": row.get("query_name"),
                }
            )
    if benchmark_csv and Path(benchmark_csv).exists():
        bench = pd.read_csv(benchmark_csv)
        top = bench.sort_values("p_activity", ascending=False).groupby("target_id", group_keys=False).head(80)
        for row in top.to_dict("records"):
            seed_rows.append(
                {
                    "target_id": row.get("target_id"),
                    "smiles": row.get("canonical_smiles"),
                    "source": "chembl_active_seed",
                    "parent_name": row.get("molecule_chembl_id"),
                }
            )
    existing_paths = [Path(path) for path in (existing_generated_paths or ["generated_candidates.csv", "updated_dl/final_candidates_filtered.csv"])]
    existing = _load_existing_generated(existing_paths)
    for smiles in existing["smiles"].dropna().head(1500):
        seed_rows.append({"target_id": None, "smiles": smiles, "source": "existing_repo_candidate", "parent_name": ""})

    template_pool = _template_candidates()
    rng.shuffle(template_pool)
    rows = []
    for target_id in target_ids:
        seen: set[str] = set()
        target_seeds = [row for row in seed_rows if row["target_id"] in (target_id, None)]
        rng.shuffle(target_seeds)
        for row in target_seeds:
            canonical = canonicalize_smiles(str(row["smiles"]))
            if not canonical or canonical in seen:
                continue
            seen.add(canonical)
            rows.append(
                {
                    "target_id": target_id,
                    "candidate_id": f"{target_id}_CAND_{len(seen):05d}",
                    "smiles": canonical,
                    "source": row["source"],
                    "generation_method": "seed_reuse",
                    "parent_name": row.get("parent_name", ""),
                }
            )
            if len(seen) >= n_per_target:
                break
        pool_index = 0
        while len(seen) < n_per_target and pool_index < len(template_pool):
            smiles = canonicalize_smiles(template_pool[pool_index])
            pool_index += 1
            if not smiles or smiles in seen:
                continue
            seen.add(smiles)
            rows.append(
                {
                    "target_id": target_id,
                    "candidate_id": f"{target_id}_CAND_{len(seen):05d}",
                    "smiles": smiles,
                    "source": "template_generator",
                    "generation_method": "medchem_template_enumeration",
                    "parent_name": "",
                }
            )
        dynamic_index = 0
        while len(seen) < n_per_target:
            amine = AMINES[dynamic_index % len(AMINES)]
            sub1 = SUBSTITUENTS[(dynamic_index // len(AMINES)) % len(SUBSTITUENTS)]
            sub2 = SUBSTITUENTS[(dynamic_index // (len(AMINES) * len(SUBSTITUENTS))) % len(SUBSTITUENTS)]
            sub3 = TERMINAL_SUBSTITUENTS[
                (dynamic_index // (len(AMINES) * len(SUBSTITUENTS) * len(SUBSTITUENTS))) % len(TERMINAL_SUBSTITUENTS)
            ]
            smiles = canonicalize_smiles(f"O=C({amine})c1c({sub1})c({sub2})c({sub3})cc1C")
            dynamic_index += 1
            if not smiles or smiles in seen:
                if dynamic_index > n_per_target * 20:
                    break
                continue
            seen.add(smiles)
            rows.append(
                {
                    "target_id": target_id,
                    "candidate_id": f"{target_id}_CAND_{len(seen):05d}",
                    "smiles": smiles,
                    "source": "template_generator",
                    "generation_method": "expanded_medchem_template_enumeration",
                    "parent_name": "",
                }
            )
    out = pd.DataFrame(rows)
    out["generation_hash"] = out.apply(lambda row: _stable_id(row["target_id"], row["smiles"]), axis=1)
    out_path = Path(out_csv)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(out_path, index=False)
    return out


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Generate target-conditioned oncology candidates.")
    parser.add_argument("--config", default="configs/cancer_targets.yaml")
    parser.add_argument("--out", default="outputs/cancer_proof_v1/generated.csv")
    parser.add_argument("--n-per-target", type=int, default=None)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    n_per_target = args.n_per_target or config.proof_run.n_generate
    out = generate_candidates(
        target_ids=list(config.primary_targets),
        reference_csv=config.paths.processed_dir / "reference_inhibitors.csv",
        benchmark_csv=config.paths.processed_dir / "oncology_benchmark.csv",
        out_csv=args.out,
        n_per_target=n_per_target,
    )
    print(f"Wrote {len(out)} generated candidates to {args.out}")


if __name__ == "__main__":
    main()
