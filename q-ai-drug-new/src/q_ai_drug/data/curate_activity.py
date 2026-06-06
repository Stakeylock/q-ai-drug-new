from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import yaml


ACCEPTED_ACTIVITY_TYPES = {"IC50", "EC50", "KI", "KD", "AC50"}


def _load_config(config_path: str | Path) -> dict[str, Any]:
    path = Path(config_path)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def _assay_confidence(row: pd.Series) -> int:
    relation = str(row.get("standard_relation", "")).strip()
    assay_type = str(row.get("standard_type", "")).upper()
    score = 5
    if assay_type in ACCEPTED_ACTIVITY_TYPES:
        score += 2
    if relation in {"=", "'='"}:
        score += 2
    elif relation in {"<", "<=", ">", ">="}:
        score += 1
    return min(score, 9)


def _curation_flag(row: pd.Series) -> str:
    if pd.isna(row.get("canonical_smiles")) or str(row.get("canonical_smiles", "")).strip() == "":
        return "excluded_missing_smiles"
    if pd.isna(row.get("standard_value_nm")):
        return "excluded_missing_activity_value"
    if pd.isna(row.get("p_activity")):
        return "excluded_missing_p_activity"
    relation = str(row.get("standard_relation", "")).strip()
    if relation not in {"=", "'='", "<", "<=", ">", ">=", ""}:
        return "flagged_nonstandard_relation"
    return "kept"


def curate_activity_benchmark(
    benchmark_csv: str | Path = "data/processed/oncology_benchmark.csv",
    out_dir: str | Path = "outputs/cancer_proof_v1",
    *,
    config_path: str | Path = "configs/cancer_targets.yaml",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Write a transparent curation layer over the processed oncology benchmark.

    This does not pretend to replace expert manual ChEMBL assay review. It
    records what was standardized by the current pipeline, adds explicit flags,
    and creates the tables needed before model claims are made.
    """

    benchmark_path = Path(benchmark_csv)
    if not benchmark_path.exists():
        raise FileNotFoundError(f"Benchmark CSV not found: {benchmark_path}")
    project_dir = Path(out_dir)
    curation_dir = project_dir / "curation"
    curation_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "figures").mkdir(parents=True, exist_ok=True)

    config = _load_config(config_path)
    active_threshold = float(config.get("proof_run", {}).get("active_threshold_pic50", 6.0))
    targets = config.get("primary_targets", {})

    raw = pd.read_csv(benchmark_path)
    curated = raw.copy()
    curated["assay_confidence"] = curated.apply(_assay_confidence, axis=1)
    curated["assay_type"] = curated.get("standard_type", pd.Series("", index=curated.index)).map(
        lambda value: "biochemical_or_binding_public_assay" if str(value).upper() in ACCEPTED_ACTIVITY_TYPES else "other_public_assay"
    )
    curated["organism"] = "Homo sapiens inferred from configured human oncology target"
    curated["target_variant"] = "wild_type_or_unspecified"
    curated["activity_relation"] = curated.get("standard_relation", "")
    curated["activity_value_raw"] = curated.get("standard_value_nm", pd.NA)
    curated["activity_unit_raw"] = curated.get("standard_units", "nM")
    curated["standardized_activity_nM"] = curated.get("standard_value_nm", pd.NA)
    curated["curation_flag"] = curated.apply(_curation_flag, axis=1)
    curated["curation_kept"] = curated["curation_flag"].eq("kept")
    curated["active_threshold_p_activity"] = active_threshold
    curated["inactive_threshold_p_activity"] = active_threshold - 1.0

    summary_rows: list[dict[str, Any]] = []
    for target_id, group in curated.groupby("target_id"):
        kept = group[group["curation_kept"]].copy()
        target_cfg = targets.get(target_id, {}) if isinstance(targets, dict) else {}
        summary_rows.append(
            {
                "target_id": target_id,
                "gene": target_cfg.get("gene", target_id),
                "uniprot_id": target_cfg.get("uniprot_id", ""),
                "raw_records": int(len(group)),
                "kept_records": int(len(kept)),
                "unique_molecules": int(kept["canonical_smiles"].nunique()) if "canonical_smiles" in kept else 0,
                "active_records": int(pd.to_numeric(kept.get("p_activity", pd.Series([], dtype=float)), errors="coerce").ge(active_threshold).sum()),
                "inactive_records": int(pd.to_numeric(kept.get("p_activity", pd.Series([], dtype=float)), errors="coerce").lt(active_threshold).sum()),
                "ambiguous_or_excluded_records": int((~group["curation_kept"]).sum()),
                "train_records": int(group.get("split", pd.Series("", index=group.index)).astype(str).eq("train").sum()),
                "validation_records": int(group.get("split", pd.Series("", index=group.index)).astype(str).eq("valid").sum()),
                "test_records": int(group.get("split", pd.Series("", index=group.index)).astype(str).eq("test").sum()),
                "unique_scaffolds": int(group.get("murcko_scaffold", pd.Series("", index=group.index)).nunique()),
                "reference_drugs_configured": ";".join(target_cfg.get("reference_drugs", [])),
            }
        )

    summary = pd.DataFrame(summary_rows)
    curated_path = curation_dir / "curated_activity.csv"
    summary_path = curation_dir / "dataset_curation_summary.csv"
    curated.to_csv(curated_path, index=False)
    summary.to_csv(summary_path, index=False)

    _write_protocol(Path("docs") / "dataset_curation_protocol.md", active_threshold)
    _write_report(project_dir / "dataset_curation_report.html", summary, active_threshold)
    _write_activity_distribution(project_dir / "figures" / "activity_distribution_by_target.png", curated)
    return curated, summary


def _write_protocol(path: Path, active_threshold: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(
            [
                "# Dataset Curation Protocol",
                "",
                "This protocol defines the retrospective curation layer used before model training and scientific reporting.",
                "",
                "Scope:",
                "- Primary human oncology targets configured for EGFR, PARP1, and PIK3CA.",
                "- Activity types IC50, EC50, Ki, Kd, and AC50 are accepted as public bioactivity evidence.",
                "- Units are standardized to nM where source data provide standard values.",
                f"- Active labels use pActivity >= {active_threshold:.1f}; weaker activity is treated as inactive or lower confidence depending on benchmark context.",
                "- Duplicate and scaffold handling is inherited from the processed benchmark builder and reported explicitly.",
                "",
                "Required row-level fields:",
                "- canonical_smiles",
                "- activity_relation",
                "- activity_value_raw",
                "- activity_unit_raw",
                "- standardized_activity_nM",
                "- p_activity",
                "- assay_confidence",
                "- assay_type",
                "- organism",
                "- target_variant",
                "- curation_flag",
                "",
                "Scientific limitation:",
                "This is an auditable computational curation layer over public activity records. It is not a substitute for expert manual assay review, isoform-specific biochemical validation, or wet-lab confirmation.",
                "",
            ]
        ),
        encoding="utf-8",
    )


def _write_report(path: Path, summary: pd.DataFrame, active_threshold: float) -> None:
    rows = summary.to_html(index=False, classes="table")
    path.write_text(
        f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Dataset Curation Report</title>
<style>
body{{font-family:Arial,sans-serif;margin:32px;color:#12202f}} table{{border-collapse:collapse;width:100%}}
td,th{{border:1px solid #d8dee8;padding:6px;font-size:12px;text-align:left}} th{{background:#eef3f8}}
.note{{background:#fff8df;border:1px solid #eadca5;padding:12px;margin:16px 0}}
</style></head><body>
<h1>Dataset Curation Report</h1>
<p>Active threshold: pActivity >= {active_threshold:.1f}. Splits are scaffold-based where provided by the benchmark builder.</p>
<div class="note">Computational research hypothesis only. Not a therapeutic, diagnostic, clinical, or regulatory claim. Wet-lab validation is required.</div>
{rows}
</body></html>""",
        encoding="utf-8",
    )


def _write_activity_distribution(path: Path, curated: pd.DataFrame) -> None:
    try:
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(8, 4.5))
        for target_id, group in curated.groupby("target_id"):
            values = pd.to_numeric(group["p_activity"], errors="coerce").dropna()
            if len(values):
                ax.hist(values, bins=24, alpha=0.45, label=target_id)
        ax.set_xlabel("pActivity")
        ax.set_ylabel("Record count")
        ax.set_title("Curated public activity distribution")
        ax.legend()
        fig.tight_layout()
        fig.savefig(path, dpi=180)
        plt.close(fig)
    except Exception:
        path.write_bytes(b"")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Curate and report the processed oncology activity benchmark.")
    parser.add_argument("--benchmark", default="data/processed/oncology_benchmark.csv")
    parser.add_argument("--project", default="outputs/cancer_proof_v1")
    parser.add_argument("--config", default="configs/cancer_targets.yaml")
    args = parser.parse_args()
    curated, summary = curate_activity_benchmark(args.benchmark, args.project, config_path=args.config)
    print(f"Wrote {len(curated)} curated rows and {len(summary)} target summaries.")


if __name__ == "__main__":
    main()
