from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from q_ai_drug.config import ensure_project_dirs, load_config
from q_ai_drug.data.build_oncology_benchmark import build_oncology_benchmark
from q_ai_drug.data.retrieve_public_oncology_data import retrieve_for_config
from q_ai_drug.models.admet import train_admet_models
from q_ai_drug.models.baseline_activity import train_baseline_models


def _copy_patterns(source_dir: Path, dest_dir: Path, patterns: list[str]) -> list[str]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []
    for pattern in patterns:
        for source in source_dir.glob(pattern):
            if source.is_file():
                target = dest_dir / source.name
                shutil.copy2(source, target)
                copied.append(str(target))
    return copied


def train_research_models(
    *,
    config_path: str | Path,
    models_dir: str | Path = "models",
    output_dir: str | Path | None = None,
    max_records_per_target: int | None = 1000,
    skip_download: bool = False,
    force_refresh: bool = False,
) -> dict:
    config = load_config(config_path)
    project_dir = ensure_project_dirs(config, output_dir)
    models_dir = Path(models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, object] = {
        "config_path": str(config_path),
        "project_dir": str(project_dir),
        "models_dir": str(models_dir),
    }
    if not skip_download:
        manifest["retrieval"] = retrieve_for_config(
            config,
            max_records_per_target=max_records_per_target,
            force_refresh=force_refresh,
        )

    benchmark = build_oncology_benchmark(config)
    activity_metrics, activity_paths = train_baseline_models(benchmark, models_dir / "activity")
    manifest["activity"] = {
        "metrics_path": str(models_dir / "activity" / "baseline_activity_metrics.csv"),
        "model_paths": {key: str(value) for key, value in activity_paths.items()},
        "metrics_rows": int(len(activity_metrics)),
    }

    admet_metrics, admet_bundle = train_admet_models(
        config.paths.raw_dir,
        models_dir / "admet",
        force_download=force_refresh,
    )
    manifest["admet"] = {
        "bundle_path": str(admet_bundle),
        "metrics_path": str(models_dir / "admet" / "admet_model_metrics.csv"),
        "trained_endpoints": int(len(admet_metrics[admet_metrics["model_path"].fillna("").astype(str).str.len() > 0])),
    }

    project_model_dir = project_dir / "models"
    manifest["copied_to_project_models"] = _copy_patterns(
        models_dir / "activity",
        project_model_dir,
        ["*_baseline_activity.joblib", "baseline_activity_metrics.csv", "baseline_activity_manifest.json"],
    ) + _copy_patterns(
        models_dir / "admet",
        project_model_dir,
        ["admet_models.joblib", "admet_model_metrics.csv", "admet_model_manifest.json"],
    )

    manifest_path = models_dir / "research_model_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")
    return manifest


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Download datasets and train reusable research models into models/.")
    parser.add_argument("--config", default="configs/cancer_targets.yaml")
    parser.add_argument("--models-dir", default="models")
    parser.add_argument("--out", default=None)
    parser.add_argument("--max-records-per-target", type=int, default=1000)
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--force-refresh", action="store_true")
    args = parser.parse_args(argv)
    manifest = train_research_models(
        config_path=args.config,
        models_dir=args.models_dir,
        output_dir=args.out,
        max_records_per_target=args.max_records_per_target,
        skip_download=args.skip_download,
        force_refresh=args.force_refresh,
    )
    print(json.dumps(manifest, indent=2, default=str))


if __name__ == "__main__":
    main()
