from __future__ import annotations

import argparse
import json
from html import escape
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.backends.backend_pdf import PdfPages

from q_ai_drug.reporting.report_manifest import write_run_manifest


DISCLAIMER = (
    "Research use only: generated and ranked molecules are computational candidates. "
    "Synthesis, biological assays, toxicity studies, and regulatory review are required "
    "before any therapeutic claim."
)


def _read_optional(path: Path) -> pd.DataFrame:
    return pd.read_csv(path) if path.exists() else pd.DataFrame()


def _table_html(df: pd.DataFrame, max_rows: int = 20) -> str:
    if df.empty:
        return "<p>No rows available.</p>"
    return df.head(max_rows).to_html(index=False, escape=True)


def build_research_figures(project_dir: str | Path) -> list[Path]:
    project_dir = Path(project_dir)
    figures_dir = project_dir / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)
    figures: list[Path] = []

    summary_path = project_dir / "run_summary.json"
    if summary_path.exists():
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
        except Exception:
            summary = {}
        funnel = [
            ("Generated", summary.get("generated_candidates", 0)),
            ("Filtered", summary.get("filtered_candidates", 0)),
            ("Docked", summary.get("docking_rows", 0)),
            ("OpenMM", summary.get("md_rows", 0)),
            ("xTB", summary.get("qm_rows", 0)),
            ("QML", summary.get("qml_rows", 0)),
            ("GNINA", summary.get("gnina_rows", 0)),
            ("Ranked", summary.get("ranked_rows", 0)),
        ]
        funnel_df = pd.DataFrame(funnel, columns=["stage", "count"])
        if funnel_df["count"].astype(float).sum() > 0:
            fig, ax = plt.subplots(figsize=(8.5, 4.5))
            ax.bar(funnel_df["stage"], funnel_df["count"].astype(float), color=["#11736f", "#3d55a6", "#4f7cac", "#795548", "#b46c1b", "#6a4c93", "#2d7a46", "#17202a"])
            ax.set_yscale("symlog")
            ax.set_ylabel("Rows, symlog scale")
            ax.set_title("Research Pipeline Funnel")
            ax.tick_params(axis="x", rotation=35)
            fig.tight_layout()
            out = figures_dir / "research_pipeline_funnel.png"
            fig.savefig(out, dpi=160)
            plt.close(fig)
            figures.append(out)

    metrics = _read_optional(project_dir / "models" / "baseline_activity_metrics.csv")
    if not metrics.empty and "roc_auc" in metrics.columns:
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.bar(metrics["target_id"], metrics["roc_auc"], color="#2f6f73")
        ax.set_ylim(0, 1)
        ax.set_ylabel("ROC-AUC")
        ax.set_title("Scaffold-Split Activity Model Performance")
        fig.tight_layout()
        out = figures_dir / "activity_model_auc.png"
        fig.savefig(out, dpi=160)
        plt.close(fig)
        figures.append(out)

    admet_metrics = _read_optional(project_dir / "models" / "admet_model_metrics.csv")
    if not admet_metrics.empty and "average_precision" in admet_metrics.columns:
        plot_df = admet_metrics.dropna(subset=["average_precision"]).copy()
        if not plot_df.empty:
            fig, ax = plt.subplots(figsize=(8, 4.5))
            plot_df["label"] = plot_df["dataset"].astype(str) + ":" + plot_df["endpoint"].astype(str)
            plot_df = plot_df.sort_values("average_precision", ascending=False).head(16)
            ax.barh(plot_df["label"], plot_df["average_precision"].astype(float), color="#4f7cac")
            ax.set_xlim(0, 1)
            ax.set_xlabel("Average precision")
            ax.set_title("ADMET/Toxicity Model Performance")
            ax.invert_yaxis()
            fig.tight_layout()
            out = figures_dir / "admet_model_average_precision.png"
            fig.savefig(out, dpi=160)
            plt.close(fig)
            figures.append(out)

    rediscovery = _read_optional(project_dir / "models" / "rediscovery_metrics.csv")
    if not rediscovery.empty and "roc_auc" in rediscovery.columns:
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.bar(rediscovery["target_id"], rediscovery["roc_auc"].fillna(0), color="#795548")
        ax.set_ylim(0, 1)
        ax.set_ylabel("ROC-AUC")
        ax.set_title("Reference Inhibitor Rediscovery")
        fig.tight_layout()
        out = figures_dir / "rediscovery_auc.png"
        fig.savefig(out, dpi=160)
        plt.close(fig)
        figures.append(out)

    ranking = _read_optional(project_dir / "final_ranked_candidates.csv")
    if not ranking.empty and "final_score" in ranking.columns:
        fig, ax = plt.subplots(figsize=(7, 4))
        for target_id, target_df in ranking.groupby("target_id"):
            ax.hist(target_df["final_score"].astype(float), alpha=0.45, bins=20, label=target_id)
        ax.set_xlabel("Final score")
        ax.set_ylabel("Candidate count")
        ax.set_title("Final Score Distribution")
        ax.legend()
        fig.tight_layout()
        out = figures_dir / "final_score_distribution.png"
        fig.savefig(out, dpi=160)
        plt.close(fig)
        figures.append(out)

        top = ranking.sort_values("final_score", ascending=False).groupby("target_id").head(8).copy()
        if {"candidate_id", "target_id", "final_score"}.issubset(top.columns):
            top["label"] = top["target_id"].astype(str) + ":" + top["candidate_id"].astype(str)
            fig, ax = plt.subplots(figsize=(8.5, 5))
            ax.barh(top["label"], top["final_score"].astype(float), color="#11736f")
            ax.set_xlim(0, 1)
            ax.set_xlabel("Final score")
            ax.set_title("Top Ranked Candidates by Target")
            ax.invert_yaxis()
            fig.tight_layout()
            out = figures_dir / "top_ranked_candidates.png"
            fig.savefig(out, dpi=160)
            plt.close(fig)
            figures.append(out)

        if "quantum_ablation_delta" in ranking.columns:
            delta_df = ranking.dropna(subset=["quantum_ablation_delta"]).copy()
            if not delta_df.empty:
                fig, ax = plt.subplots(figsize=(7, 4))
                for target_id, target_df in delta_df.groupby("target_id"):
                    ax.hist(target_df["quantum_ablation_delta"].astype(float), alpha=0.45, bins=20, label=target_id)
                ax.axvline(0, color="#17202a", linewidth=1)
                ax.set_xlabel("Final score minus score without quantum")
                ax.set_ylabel("Candidate count")
                ax.set_title("Quantum Ablation Delta Distribution")
                ax.legend()
                fig.tight_layout()
                out = figures_dir / "quantum_ablation_delta.png"
                fig.savefig(out, dpi=160)
                plt.close(fig)
                figures.append(out)

    prefilter = _read_optional(project_dir / "qml" / "quantum_prefilter_scores.csv")
    if not prefilter.empty and "quantum_prefilter_score" in prefilter.columns:
        fig, ax = plt.subplots(figsize=(7, 4))
        for target_id, target_df in prefilter.groupby("target_id"):
            ax.hist(target_df["quantum_prefilter_score"].astype(float), alpha=0.45, bins=20, label=target_id)
        ax.set_xlabel("Quantum prefilter score")
        ax.set_ylabel("Candidate count")
        ax.set_title("Early Quantum-Kernel Portfolio Prefilter")
        ax.legend()
        fig.tight_layout()
        out = figures_dir / "quantum_prefilter_distribution.png"
        fig.savefig(out, dpi=160)
        plt.close(fig)
        figures.append(out)

    docking = _read_optional(project_dir / "docking" / "results.csv")
    if not docking.empty and "affinity_kcal_mol" in docking.columns:
        fig, ax = plt.subplots(figsize=(7, 4))
        docking.boxplot(column="affinity_kcal_mol", by="target_id", ax=ax)
        ax.set_title("Docking/Triage Affinity Distribution")
        ax.set_ylabel("kcal/mol")
        fig.suptitle("")
        fig.tight_layout()
        out = figures_dir / "docking_distribution.png"
        fig.savefig(out, dpi=160)
        plt.close(fig)
        figures.append(out)

    gnina = _read_optional(project_dir / "gnina" / "results.csv")
    if not gnina.empty and "gnina_cnn_pose_score" in gnina.columns:
        plot_df = gnina.dropna(subset=["gnina_cnn_pose_score"]).copy()
        if not plot_df.empty:
            plot_df["label"] = plot_df["target_id"].astype(str) + ":" + plot_df["candidate_id"].astype(str)
            fig, ax = plt.subplots(figsize=(8, 4.5))
            ax.barh(plot_df["label"], plot_df["gnina_cnn_pose_score"].astype(float), color="#2d7a46")
            ax.set_xlim(0, 1)
            ax.set_xlabel("CNN pose score")
            ax.set_title("GNINA CNN Docked Pose Scores")
            ax.invert_yaxis()
            fig.tight_layout()
            out = figures_dir / "gnina_cnn_pose_scores.png"
            fig.savefig(out, dpi=160)
            plt.close(fig)
            figures.append(out)
    for extra_name in [
        "activity_distribution_by_target.png",
        "model_comparison_auc.png",
        "calibration_curves.png",
        "enrichment_curves.png",
        "generation_diversity.png",
        "admet_risk_heatmap.png",
        "qm_descriptor_distribution.png",
        "quantum_ablation.png",
        "control_score_distributions.png",
    ]:
        extra_path = figures_dir / extra_name
        if extra_path.exists() and extra_path not in figures:
            figures.append(extra_path)
    return figures


def _figure_html(project_dir: Path, figures: list[Path]) -> str:
    html = []
    for figure in figures:
        rel = figure.relative_to(project_dir).as_posix()
        html.append(f'<figure><img src="{escape(rel)}" alt="{escape(figure.stem)}"><figcaption>{escape(figure.stem.replace("_", " ").title())}</figcaption></figure>')
    return "\n".join(html)


def _molecule_image_html(project_dir: Path, max_images: int = 12) -> str:
    manifest = _read_optional(project_dir / "assets" / "ligand_asset_manifest.csv")
    if manifest.empty or "png_path" not in manifest.columns:
        return "<p>No molecule images available.</p>"
    cards = []
    for row in manifest.dropna(subset=["png_path"]).head(max_images).to_dict("records"):
        path = Path(row["png_path"])
        try:
            rel = path.relative_to(project_dir).as_posix()
        except ValueError:
            rel = path.as_posix()
        cards.append(
            f'<div class="mol"><img src="{escape(rel)}" alt="{escape(str(row.get("candidate_id", "")))}">'
            f'<div><strong>{escape(str(row.get("candidate_id", "")))}</strong><br>{escape(str(row.get("target_id", "")))}</div></div>'
        )
    return '<div class="molgrid">' + "\n".join(cards) + "</div>"


def _validation_summary(project_dir: Path) -> pd.DataFrame:
    rows = []
    for name in ("validation_report.json", "production_validation_report.json"):
        path = project_dir / name
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        rows.append(
            {
                "report": name,
                "tier": payload.get("tier"),
                "status": payload.get("status"),
                "errors": len(payload.get("errors") or []),
                "warnings": len(payload.get("warnings") or []),
                "key_findings": "; ".join((payload.get("errors") or payload.get("warnings") or [])[:4]),
            }
        )
    return pd.DataFrame(rows)


def build_html_report(project_dir: str | Path, out_html: str | Path) -> Path:
    project_dir = Path(project_dir)
    figures = build_research_figures(project_dir)
    ranking = _read_optional(project_dir / "top_candidates.csv")
    docking = _read_optional(project_dir / "docking" / "results.csv")
    gnina = _read_optional(project_dir / "gnina" / "results.csv")
    md = _read_optional(project_dir / "md" / "stability.csv")
    qm = _read_optional(project_dir / "qm" / "qm_descriptors.csv")
    qml = _read_optional(project_dir / "qml" / "quantum_kernel_scores.csv")
    qprefilter = _read_optional(project_dir / "qml" / "quantum_prefilter_scores.csv")
    metrics = _read_optional(project_dir / "models" / "baseline_activity_metrics.csv")
    admet_metrics = _read_optional(project_dir / "models" / "admet_model_metrics.csv")
    curation = _read_optional(project_dir / "curation" / "dataset_curation_summary.csv")
    model_comparison = _read_optional(project_dir / "models" / "model_comparison.csv")
    enrichment = _read_optional(project_dir / "benchmarks" / "enrichment_summary.csv")
    generation = _read_optional(project_dir / "generation" / "generation_metrics.csv")
    applicability = _read_optional(project_dir / "models" / "applicability_domain.csv")
    medchem = _read_optional(project_dir / "medchem" / "medchem_risk_table.csv")
    admet_candidate = _read_optional(project_dir / "admet" / "candidate_admet_risk_table.csv")
    interactions = _read_optional(project_dir / "docking" / "interaction_fingerprints.csv")
    quantum_ablation = _read_optional(project_dir / "qml" / "quantum_ablation_benchmark.csv")
    negative_controls = _read_optional(project_dir / "controls" / "negative_control_results.csv")
    claims = _read_optional(project_dir / "scientific_claim_matrix.csv")
    rediscovery = _read_optional(project_dir / "models" / "rediscovery_metrics.csv")
    model_cards = _read_optional(project_dir / "models" / "model_cards.csv")
    literature_summary = _read_optional(project_dir / "literature" / "target_literature_summary.csv")
    literature = _read_optional(project_dir / "literature" / "target_literature_evidence.csv")
    validation = _validation_summary(project_dir)

    sections = [
        ("Dataset Curation", curation),
        ("Model Registry", model_cards),
        ("Model Metrics", metrics),
        ("Baseline Model Comparison", model_comparison),
        ("Known Actives vs Decoys Enrichment", enrichment),
        ("ADMET Model Metrics", admet_metrics),
        ("Candidate ADMET Risk", admet_candidate),
        ("Rediscovery Benchmark", rediscovery),
        ("Generation Validity And Novelty", generation),
        ("Applicability Domain", applicability),
        ("Medicinal Chemistry Risk", medchem),
        ("Validation and Critique", validation),
        ("Literature Evidence Summary", literature_summary),
        ("Literature Evidence Records", literature[["target_id", "query_role", "pmid", "title", "publication_year", "evidence_tags", "evidence_tier"]] if not literature.empty and {"target_id", "query_role", "pmid", "title", "publication_year", "evidence_tags", "evidence_tier"}.issubset(literature.columns) else literature),
        ("Docking Summary", docking.groupby("target_id").head(5) if not docking.empty else docking),
        ("Pose Interaction Fingerprints", interactions),
        ("GNINA CNN Docking", gnina),
        ("MD Triage", md),
        ("QM Descriptors", qm),
        ("Quantum Prefilter", qprefilter),
        ("Quantum Kernel Reranking", qml),
        ("Quantum Ablation Benchmark", quantum_ablation),
        ("Negative Controls", negative_controls),
        ("Scientific Claim Matrix", claims),
        ("Top Candidates", ranking),
    ]
    body = "\n".join(f"<h2>{escape(title)}</h2>{_table_html(df)}" for title, df in sections)
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Q-AI Cancer Proof Report</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 28px; color: #1f2933; line-height: 1.45; }}
    h1, h2 {{ color: #102a43; }}
    table {{ border-collapse: collapse; width: 100%; margin: 12px 0 28px; font-size: 12px; }}
    th, td {{ border: 1px solid #d9e2ec; padding: 6px; vertical-align: top; }}
    th {{ background: #eef3f8; }}
    .notice {{ border-left: 4px solid #b7791f; padding: 10px 14px; background: #fffaf0; }}
    img {{ max-width: 100%; height: auto; }}
    figure {{ margin: 18px 0 28px; }}
    figcaption {{ color: #52606d; font-size: 12px; }}
    .molgrid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }}
    .mol {{ border: 1px solid #d9e2ec; padding: 8px; }}
  </style>
</head>
<body>
  <h1>Q-AI Cancer Drug Discovery Proof Report</h1>
  <p class="notice">{escape(DISCLAIMER)}</p>
  <h2>Research Visual Evidence</h2>
  {_figure_html(project_dir, figures)}
  <h2>Candidate Structures</h2>
  {_molecule_image_html(project_dir)}
  {body}
</body>
</html>
"""
    out_path = Path(out_html)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    return out_path


def build_pdf_report(project_dir: str | Path, out_pdf: str | Path) -> Path:
    project_dir = Path(project_dir)
    figures = build_research_figures(project_dir)
    ranking = _read_optional(project_dir / "top_candidates.csv")
    metrics = _read_optional(project_dir / "models" / "baseline_activity_metrics.csv")
    admet_metrics = _read_optional(project_dir / "models" / "admet_model_metrics.csv")
    rediscovery = _read_optional(project_dir / "models" / "rediscovery_metrics.csv")
    gnina = _read_optional(project_dir / "gnina" / "results.csv")
    curation = _read_optional(project_dir / "curation" / "dataset_curation_summary.csv")
    interactions = _read_optional(project_dir / "docking" / "interaction_fingerprints.csv")
    q_ablation = _read_optional(project_dir / "qml" / "quantum_ablation_benchmark.csv")
    literature = _read_optional(project_dir / "literature" / "target_literature_evidence.csv")
    out_path = Path(out_pdf)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(out_path) as pdf:
        fig = plt.figure(figsize=(11, 8.5))
        fig.text(0.08, 0.88, "Q-AI Cancer Drug Discovery Proof Report", fontsize=18, weight="bold")
        fig.text(0.08, 0.78, DISCLAIMER, fontsize=10, wrap=True)
        fig.text(0.08, 0.68, f"Top candidates: {len(ranking)}", fontsize=12)
        fig.text(0.08, 0.63, f"Model metrics rows: {len(metrics)}", fontsize=12)
        fig.text(0.08, 0.58, f"ADMET metrics rows: {len(admet_metrics)}", fontsize=12)
        fig.text(0.08, 0.53, f"Rediscovery metrics rows: {len(rediscovery)}", fontsize=12)
        fig.text(0.08, 0.48, f"GNINA CNN pose rows: {len(gnina)}", fontsize=12)
        fig.text(0.08, 0.43, f"Curated target summaries: {len(curation)}", fontsize=12)
        fig.text(0.08, 0.38, f"Interaction fingerprints: {len(interactions)}", fontsize=12)
        fig.text(0.08, 0.33, f"Literature context records: {len(literature)}", fontsize=12)
        fig.text(0.08, 0.28, f"Quantum/ranking ablations: {len(q_ablation)}", fontsize=12)
        plt.axis("off")
        pdf.savefig(fig)
        plt.close(fig)
        if not ranking.empty:
            for target_id, target_df in ranking.groupby("target_id"):
                fig, ax = plt.subplots(figsize=(11, 8.5))
                top = target_df.head(10).copy()
                ax.barh(top["candidate_id"].astype(str), top["final_score"].astype(float))
                ax.set_title(f"Top {target_id} Candidates")
                ax.set_xlabel("Final score")
                ax.invert_yaxis()
                fig.tight_layout()
                pdf.savefig(fig)
                plt.close(fig)
        for figure_path in figures:
            image = plt.imread(figure_path)
            fig, ax = plt.subplots(figsize=(11, 8.5))
            ax.imshow(image)
            ax.axis("off")
            ax.set_title(figure_path.stem.replace("_", " ").title())
            pdf.savefig(fig)
            plt.close(fig)
    return out_path


def build_reports(project_dir: str | Path, config_path: str | Path, out_dir: str | Path | None = None) -> dict[str, Path]:
    project_dir = Path(project_dir)
    out_dir = Path(out_dir or project_dir)
    assets = [
        project_dir / "final_ranked_candidates.csv",
        project_dir / "top_candidates.csv",
        project_dir / "docking" / "results.csv",
        project_dir / "gnina" / "results.csv",
        project_dir / "md" / "stability.csv",
        project_dir / "qm" / "qm_descriptors.csv",
        project_dir / "qml" / "quantum_prefilter_scores.csv",
        project_dir / "qml" / "quantum_kernel_scores.csv",
        project_dir / "models" / "model_cards.csv",
        project_dir / "models" / "admet_model_metrics.csv",
        project_dir / "literature" / "target_literature_summary.csv",
        project_dir / "literature" / "target_literature_evidence.csv",
    ]
    manifest = write_run_manifest(out_dir, Path(config_path), assets)
    html = build_html_report(project_dir, out_dir / "report.html")
    pdf = build_pdf_report(project_dir, out_dir / "report.pdf")
    return {"manifest": manifest, "html": html, "pdf": pdf}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Build HTML/PDF report.")
    parser.add_argument("--project", default="outputs/cancer_proof_v1")
    parser.add_argument("--config", default="configs/cancer_targets.yaml")
    parser.add_argument("--out", default=None)
    args = parser.parse_args(argv)
    paths = build_reports(args.project, args.config, args.out)
    print("\n".join(f"{key}: {value}" for key, value in paths.items()))


if __name__ == "__main__":
    main()
