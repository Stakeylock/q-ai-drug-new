from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import pandas as pd

from q_ai_drug.config import ensure_project_dirs, load_config
from q_ai_drug.data.build_oncology_benchmark import build_oncology_benchmark
from q_ai_drug.data.literature import collect_target_literature_evidence
from q_ai_drug.data.retrieve_public_oncology_data import retrieve_for_config
from q_ai_drug.docking.vina_runner import run_real_docking
from q_ai_drug.filters.medchem_filters import filter_candidates
from q_ai_drug.generation.generate import generate_candidates
from q_ai_drug.md.openmm_workflow import run_openmm_md
from q_ai_drug.models.admet import train_admet_models, score_admet_candidates
from q_ai_drug.models.baseline_activity import rediscovery_benchmark, score_candidates, train_baseline_models
from q_ai_drug.models.checkpoint_registry import write_model_cards
from q_ai_drug.qm.xtb_qm_descriptors import run_proxy_qm
from q_ai_drug.qml.quantum_prefilter import run_quantum_prefilter
from q_ai_drug.qml.qsvm_rerank import run_qml_rerank
from q_ai_drug.ranking.final_score import build_final_ranking
from q_ai_drug.research.scientific_study import harden_scientific_study
from q_ai_drug.reporting.report_builder import build_reports
from q_ai_drug.structures.prepare_structures import prepare_ligand_assets
from q_ai_drug.tools.external import write_external_tool_manifest
from q_ai_drug.visualization.view_3d import build_candidate_gallery


def _sync_model_artifacts(source_dir: Path, dest_dir: Path, patterns: list[str]) -> list[str]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []
    for pattern in patterns:
        for source in source_dir.glob(pattern):
            if source.is_file():
                target = dest_dir / source.name
                shutil.copy2(source, target)
                copied.append(str(target))
    return copied


def run_cancer_proof(
    *,
    config_path: str | Path = "configs/cancer_targets.yaml",
    output_dir: str | Path | None = None,
    max_records_per_target: int | None = 1000,
    n_generate: int | None = None,
    skip_download: bool = False,
    force_refresh: bool = False,
    include_literature: bool = False,
    max_literature_records_per_query: int = 20,
) -> dict:
    config = load_config(config_path)
    project_dir = ensure_project_dirs(config, output_dir)
    summary: dict[str, object] = {"project_dir": str(project_dir)}
    summary["external_tools"] = write_external_tool_manifest(project_dir / "external_tools_manifest.json")

    if not skip_download:
        summary["retrieval"] = retrieve_for_config(config, max_records_per_target=max_records_per_target, force_refresh=force_refresh)

    benchmark = build_oncology_benchmark(config)
    summary["benchmark_records"] = int(len(benchmark))

    model_dir = project_dir / "models"
    root_models_dir = Path("models")
    metrics, _ = train_baseline_models(benchmark, model_dir)
    summary["model_metrics"] = str(model_dir / "baseline_activity_metrics.csv")
    summary["activity_models_root"] = _sync_model_artifacts(
        model_dir,
        root_models_dir / "activity",
        ["*_baseline_activity.joblib", "baseline_activity_metrics.csv", "baseline_activity_manifest.json"],
    )

    reference_path = config.paths.processed_dir / "reference_inhibitors.csv"
    if reference_path.exists():
        rediscovery = rediscovery_benchmark(benchmark, pd.read_csv(reference_path), model_dir, model_dir)
        summary["rediscovery_records"] = int(len(rediscovery))

    admet_root_dir = root_models_dir / "admet"
    admet_metrics, admet_bundle = train_admet_models(config.paths.raw_dir, admet_root_dir)
    _sync_model_artifacts(
        admet_root_dir,
        model_dir,
        ["admet_models.joblib", "admet_model_metrics.csv", "admet_model_manifest.json"],
    )
    summary["admet_model_metrics"] = str(model_dir / "admet_model_metrics.csv")
    summary["admet_model_bundle_root"] = str(admet_bundle)
    summary["admet_model_endpoints"] = int(len(admet_metrics[admet_metrics["model_path"].astype(str).str.len() > 0]))

    generated_path = project_dir / "generated.csv"
    generated = generate_candidates(
        target_ids=list(config.primary_targets),
        reference_csv=reference_path,
        benchmark_csv=config.paths.processed_dir / "oncology_benchmark.csv",
        out_csv=generated_path,
        n_per_target=n_generate or config.proof_run.n_generate,
    )
    scored = score_candidates(generated.rename(columns={"smiles": "canonical_smiles"}), model_dir)
    scored = score_admet_candidates(scored, admet_root_dir)
    scored_path = project_dir / "generated_scored.csv"
    scored.to_csv(scored_path, index=False)
    summary["generated_candidates"] = int(len(scored))

    filtered_path = project_dir / "filtered.csv"
    filtered = filter_candidates(scored_path, filtered_path, config.filters, top_per_target=config.proof_run.n_filter)
    summary["filtered_candidates"] = int(len(filtered))

    quantum_filtered_path = project_dir / "filtered_quantum.csv"
    quantum_filtered = run_quantum_prefilter(filtered_path, project_dir / "qml", out_csv=quantum_filtered_path)
    summary["quantum_prefilter_rows"] = int(len(quantum_filtered))
    summary["quantum_prefilter_real"] = bool(quantum_filtered.get("quantum_prefilter_is_real", pd.Series([False])).astype(bool).all())

    assets_dir = project_dir / "assets"
    prepare_ligand_assets(quantum_filtered_path, assets_dir, limit=config.proof_run.n_dock * len(config.primary_targets))
    build_candidate_gallery(quantum_filtered_path, assets_dir / "candidate_gallery.html")
    summary["assets_dir"] = str(assets_dir)

    docking = run_real_docking(
        quantum_filtered_path,
        project_dir / "docking",
        assets_csv=assets_dir / "ligand_asset_manifest.csv",
        structures_dir=config.paths.structure_dir,
        top_per_target=config.proof_run.n_dock,
        box_size=30.0,
        exhaustiveness=1,
        num_modes=3,
        cpu=4,
        smina_strategy="minimize",
    )
    summary["docking_rows"] = int(len(docking))
    summary["docking_real"] = bool(docking.get("docking_is_real", pd.Series([False])).astype(bool).all())

    md = run_openmm_md(project_dir / "docking" / "results.csv", project_dir / "md", top=config.proof_run.n_md, steps=2000)
    summary["md_rows"] = int(len(md))
    summary["md_real"] = bool(md.get("md_is_real", pd.Series([False])).astype(bool).all())

    qm = run_proxy_qm(project_dir / "docking" / "top10.csv", project_dir / "qm", top=config.proof_run.n_qm)
    summary["qm_rows"] = int(len(qm))

    qml = run_qml_rerank(project_dir / "docking" / "top10.csv", project_dir / "qm" / "qm_descriptors.csv", project_dir / "qml")
    summary["qml_rows"] = int(len(qml))

    model_cards = write_model_cards(model_dir)
    summary["model_cards"] = int(len(model_cards))

    ranking = build_final_ranking(project_dir)
    summary["ranked_rows"] = int(len(ranking))
    prepare_ligand_assets(project_dir / "top_candidates.csv", assets_dir, limit=50 * len(config.primary_targets))
    build_candidate_gallery(project_dir / "top_candidates.csv", assets_dir / "candidate_gallery.html")

    if include_literature:
        summary["literature_evidence"] = collect_target_literature_evidence(
            config,
            out_dir=project_dir / "literature",
            max_records_per_query=max_literature_records_per_query,
        )

    reports = build_reports(project_dir, config_path)
    summary["reports"] = {key: str(value) for key, value in reports.items()}

    summary_path = project_dir / "run_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, default=str))
    return summary


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Q-AI cancer drug discovery proof platform.")
    sub = parser.add_subparsers(dest="command", required=True)

    run_parser = sub.add_parser("run-cancer-proof", help="Run the full EGFR/PARP1/PIK3CA proof workflow.")
    run_parser.add_argument("--config", default="configs/cancer_targets.yaml")
    run_parser.add_argument("--out", default=None)
    run_parser.add_argument("--max-records-per-target", type=int, default=1000)
    run_parser.add_argument("--n-generate", type=int, default=None)
    run_parser.add_argument("--skip-download", action="store_true")
    run_parser.add_argument("--force-refresh", action="store_true")
    run_parser.add_argument("--include-literature", action="store_true")
    run_parser.add_argument("--max-literature-records-per-query", type=int, default=20)

    download_parser = sub.add_parser("download-data", help="Download public oncology datasets and structures.")
    download_parser.add_argument("--config", default="configs/cancer_targets.yaml")
    download_parser.add_argument("--max-records-per-target", type=int, default=1000)
    download_parser.add_argument("--include-bindingdb", action="store_true")
    download_parser.add_argument("--force-refresh", action="store_true")

    benchmark_parser = sub.add_parser("build-benchmark", help="Build canonicalized oncology benchmark.")
    benchmark_parser.add_argument("--config", default="configs/cancer_targets.yaml")

    literature_parser = sub.add_parser("build-literature-evidence", help="Fetch PubMed target-context literature artifacts.")
    literature_parser.add_argument("--config", default="configs/cancer_targets.yaml")
    literature_parser.add_argument("--out", default=None)
    literature_parser.add_argument("--targets", nargs="*", default=None)
    literature_parser.add_argument("--max-records-per-query", type=int, default=20)
    literature_parser.add_argument("--skip-reference-drugs", action="store_true")
    literature_parser.add_argument("--max-reference-drugs-per-target", type=int, default=3)

    harden_parser = sub.add_parser("harden-scientific-study", help="Build strict scientific validation artifacts over an existing proof run.")
    harden_parser.add_argument("--project", default="outputs/cancer_proof_v1")
    harden_parser.add_argument("--config", default="configs/cancer_targets.yaml")
    harden_parser.add_argument("--benchmark", default="data/processed/oncology_benchmark.csv")
    harden_parser.add_argument("--references", default="data/processed/reference_inhibitors.csv")

    args = parser.parse_args(argv)
    if args.command == "run-cancer-proof":
        summary = run_cancer_proof(
            config_path=args.config,
            output_dir=args.out,
            max_records_per_target=args.max_records_per_target,
            n_generate=args.n_generate,
            skip_download=args.skip_download,
            force_refresh=args.force_refresh,
            include_literature=args.include_literature,
            max_literature_records_per_query=args.max_literature_records_per_query,
        )
        print(json.dumps(summary, indent=2, default=str))
    elif args.command == "download-data":
        config = load_config(args.config)
        ensure_project_dirs(config)
        manifest = retrieve_for_config(
            config,
            max_records_per_target=args.max_records_per_target,
            include_bindingdb=args.include_bindingdb,
            force_refresh=args.force_refresh,
        )
        print(json.dumps(manifest, indent=2, default=str))
    elif args.command == "build-benchmark":
        config = load_config(args.config)
        df = build_oncology_benchmark(config)
        print(f"Wrote {len(df)} benchmark rows to {config.paths.processed_dir / 'oncology_benchmark.csv'}")
    elif args.command == "build-literature-evidence":
        config = load_config(args.config)
        project_dir = ensure_project_dirs(config)
        out_dir = Path(args.out) if args.out else project_dir / "literature"
        summary = collect_target_literature_evidence(
            config,
            target_ids=args.targets,
            out_dir=out_dir,
            max_records_per_query=args.max_records_per_query,
            include_reference_drugs=not args.skip_reference_drugs,
            max_reference_drugs_per_target=args.max_reference_drugs_per_target,
        )
        print(json.dumps(summary, indent=2, default=str))
    elif args.command == "harden-scientific-study":
        summary = harden_scientific_study(args.project, config_path=args.config, benchmark_csv=args.benchmark, reference_csv=args.references)
        print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
