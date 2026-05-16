from __future__ import annotations

import argparse
import json
from html import escape
from pathlib import Path
from typing import Any

from q_ai_drug.reporting.product_metrics import build_investor_metrics


def _status_label(status: str) -> str:
    if status == "pass":
        return "Pass"
    if status == "pass_with_warnings":
        return "Pass with warnings"
    if status == "fail":
        return "Fail"
    return status.replace("_", " ").title()


def _markdown_table(headers: list[str], rows: list[list[Any]]) -> str:
    clean_rows = [["" if value is None else str(value) for value in row] for row in rows]
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for row in clean_rows:
        lines.append("| " + " | ".join(value.replace("|", "\\|").replace("\n", " ") for value in row) + " |")
    return "\n".join(lines)


def _summary_metrics(metrics: dict[str, Any]) -> list[list[Any]]:
    headline = metrics["headline"]
    return [
        ["Cancer proof targets", headline["targets"]],
        ["Generated candidates", headline["generated_candidates"]],
        ["Filtered candidates", headline["filtered_candidates"]],
        ["Vina/Smina docking rows", headline["docking_rows"]],
        ["GNINA CNN rows", headline["gnina_rows"]],
        ["OpenMM ligand-pose relaxation rows", next((row["count"] for row in metrics["pipeline_funnel"] if row["stage"] == "OpenMM relaxation rows"), 0)],
        ["xTB QM rows", headline["qm_rows"]],
        ["Qiskit QML rows", headline["qml_rows"]],
        ["Final ranked rows", headline["ranked_candidates"]],
        ["Trained ADMET endpoints", headline["trained_admet_endpoints"]],
        ["Proof gate", _status_label(headline["proof_gate"])],
        ["Research evidence gate", _status_label(headline["production_gate"])],
    ]


def build_markdown(metrics: dict[str, Any]) -> str:
    production = metrics["validation"]["production"]
    warnings = production["warnings"] or ["None"]
    sections = [
        "# Q-AI Drug Discovery Project Completion Report",
        "",
        "This report maps the investor product plan to the current runnable research platform. It is written as research evidence, not as a therapeutic claim.",
        "",
        f"**Research-use statement:** {metrics['research_use_statement']}",
        "",
        "## Executive Status",
        "",
        _markdown_table(["Metric", "Value"], _summary_metrics(metrics)),
        "",
        "## Target Coverage",
        "",
        _markdown_table(
            ["Target", "Benchmark rows", "Top candidates", "Best candidate", "Best score", "Quantum delta", "Docking", "GNINA", "QM", "QML"],
            [
                [
                    row["target_id"],
                    row["benchmark_records"],
                    row["top_candidates"],
                    row["best_candidate"],
                    row["best_final_score"],
                    row["best_quantum_delta"],
                    row["docking_rows"],
                    row["gnina_rows"],
                    row["qm_rows"],
                    row["qml_rows"],
                ]
                for row in metrics["targets"]
            ],
        ),
        "",
        "## Product Tool Completion",
        "",
        _markdown_table(
            ["Tool", "Status", "Evidence", "User Output"],
            [[row["name"], row["status"], row["evidence"], row["output"]] for row in metrics["tool_suite"]],
        ),
        "",
        "## Research Pipeline Funnel",
        "",
        _markdown_table(
            ["Stage", "Rows", "Method Tier", "Evidence"],
            [[row["stage"], row["count"], row["method_tier"], row["evidence"]] for row in metrics["pipeline_funnel"]],
        ),
        "",
        "## Model and Quantum Evidence",
        "",
        _markdown_table(
            ["Evidence", "Value"],
            [
                ["Activity models", metrics["model_quality"]["activity_models"]],
                ["Mean activity ROC-AUC", metrics["model_quality"]["activity_mean_roc_auc"]],
                ["Mean activity AP", metrics["model_quality"]["activity_mean_average_precision"]],
                ["Trained ADMET endpoints", metrics["model_quality"]["admet_trained_endpoints"]],
                ["Mean ADMET ROC-AUC", metrics["model_quality"]["admet_mean_roc_auc"]],
                ["Mean ADMET AP", metrics["model_quality"]["admet_mean_average_precision"]],
                ["Quantum prefilter rows", metrics["quantum"]["prefilter_rows"]],
                ["Qiskit rerank rows", metrics["quantum"]["qml_rows"]],
                ["xTB rows", metrics["quantum"]["qm_rows"]],
                ["Mean quantum ablation delta", metrics["quantum"]["mean_quantum_delta"]],
                ["Quantum claim", metrics["quantum"]["current_claim"]],
            ],
        ),
        "",
        "## Validation Gate",
        "",
        f"- Proof gate: {_status_label(metrics['validation']['proof']['status'])}",
        f"- Research evidence gate: {_status_label(production['status'])}",
        "- Research evidence warnings: " + "; ".join(str(item) for item in warnings),
        "",
        "## Investor Demo Flow",
        "",
        _markdown_table(
            ["Minute", "Screen", "Proof Shown"],
            [[row["minute"], row["screen"], row["proof"]] for row in metrics["demo_flow"]],
        ),
        "",
        "## Current Limitations",
        "",
        "\n".join(f"- {item}" for item in metrics["limitations"]),
        "",
        "## Next Scientific Upgrades",
        "",
        "\n".join(f"- {item}" for item in metrics["next_scientific_upgrades"]),
        "",
        "## Shareable Artifacts",
        "",
        _markdown_table(
            ["Artifact", "Path", "Available"],
            [[row["label"], row["path"], row["available"]] for row in metrics["artifacts"]],
        ),
        "",
    ]
    return "\n".join(sections)


def _html_table(headers: list[str], rows: list[list[Any]]) -> str:
    head = "".join(f"<th>{escape(header)}</th>" for header in headers)
    body = []
    for row in rows:
        body.append("<tr>" + "".join(f"<td>{escape('' if value is None else str(value))}</td>" for value in row) + "</tr>")
    return f"<div class=\"table-wrap\"><table><thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table></div>"


def build_html(metrics: dict[str, Any]) -> str:
    headline = metrics["headline"]
    cards = "".join(
        f"<article><span>{escape(label)}</span><strong>{escape(str(value))}</strong></article>"
        for label, value in [
            ("Generated", headline["generated_candidates"]),
            ("Filtered", headline["filtered_candidates"]),
            ("Docked", headline["docking_rows"]),
            ("GNINA", headline["gnina_rows"]),
            ("xTB", headline["qm_rows"]),
            ("QML", headline["qml_rows"]),
            ("Research Evidence Gate", _status_label(headline["production_gate"])),
            ("Figures", headline["figures"]),
        ]
    )
    funnel_rows = [[row["stage"], row["count"], row["method_tier"], row["evidence"]] for row in metrics["pipeline_funnel"]]
    tool_rows = [[row["name"], row["status"], row["evidence"], row["output"]] for row in metrics["tool_suite"]]
    target_rows = [
        [
            row["target_id"],
            row["benchmark_records"],
            row["top_candidates"],
            row["best_candidate"],
            row["best_final_score"],
            row["best_quantum_delta"],
            row["docking_rows"],
            row["gnina_rows"],
            row["qm_rows"],
            row["qml_rows"],
        ]
        for row in metrics["targets"]
    ]
    limitations = "".join(f"<li>{escape(item)}</li>" for item in metrics["limitations"])
    upgrades = "".join(f"<li>{escape(item)}</li>" for item in metrics["next_scientific_upgrades"])
    warnings = metrics["validation"]["production"]["warnings"] or ["None"]
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Q-AI Project Completion Report</title>
  <style>
    body {{ margin: 0; font-family: Arial, sans-serif; background: #f6f7fb; color: #17202a; line-height: 1.5; }}
    main {{ max-width: 1180px; margin: 0 auto; padding: 32px 20px 56px; }}
    header {{ background: #111827; color: #f9fafb; padding: 34px; border-radius: 8px; }}
    h1 {{ margin: 0 0 10px; font-size: 32px; }}
    h2 {{ margin: 30px 0 12px; font-size: 22px; }}
    .notice {{ margin-top: 18px; padding: 12px 14px; border-left: 4px solid #b46c1b; background: #fff4e6; color: #17202a; }}
    .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 20px 0; }}
    article {{ background: #fff; border: 1px solid #d9dee8; border-radius: 8px; padding: 15px; }}
    article span {{ display: block; color: #667085; font-size: 12px; text-transform: uppercase; font-weight: 700; }}
    article strong {{ display: block; margin-top: 8px; font-size: 22px; }}
    table {{ width: 100%; border-collapse: collapse; background: #fff; font-size: 13px; }}
    th, td {{ border: 1px solid #d9dee8; padding: 8px; text-align: left; vertical-align: top; }}
    th {{ background: #eef3f8; }}
    .table-wrap {{ overflow-x: auto; }}
    li {{ margin: 7px 0; }}
  </style>
</head>
<body>
  <main>
    <header>
      <p>Investor-ready research evidence package</p>
      <h1>Q-AI Drug Discovery Project Completion Report</h1>
      <p>{escape(metrics['research_use_statement'])}</p>
    </header>
    <section class="cards">{cards}</section>
    <section>
      <h2>Target Coverage</h2>
      {_html_table(["Target", "Benchmark rows", "Top candidates", "Best candidate", "Best score", "Quantum delta", "Docking", "GNINA", "QM", "QML"], target_rows)}
    </section>
    <section>
      <h2>Product Tool Completion</h2>
      {_html_table(["Tool", "Status", "Evidence", "User Output"], tool_rows)}
    </section>
    <section>
      <h2>Research Pipeline Funnel</h2>
      {_html_table(["Stage", "Rows", "Method Tier", "Evidence"], funnel_rows)}
    </section>
    <section class="notice">
      <strong>Research evidence gate:</strong> {escape(_status_label(metrics['validation']['production']['status']))}<br>
      <strong>Warnings:</strong> {escape('; '.join(str(item) for item in warnings))}
    </section>
    <section>
      <h2>Limitations</h2>
      <ul>{limitations}</ul>
      <h2>Next Scientific Upgrades</h2>
      <ul>{upgrades}</ul>
    </section>
  </main>
</body>
</html>
"""


def build_completion_report(
    project_dir: str | Path = "outputs/cancer_proof_v1",
    markdown_out: str | Path = "docs/project_completion_report.md",
    html_out: str | Path | None = None,
    json_out: str | Path | None = None,
) -> dict[str, Path]:
    project_dir = Path(project_dir)
    html_out = Path(html_out) if html_out else project_dir / "project_completion_report.html"
    json_out = Path(json_out) if json_out else project_dir / "product_readiness_report.json"
    markdown_out = Path(markdown_out)
    metrics = build_investor_metrics(project_dir)

    markdown_out.parent.mkdir(parents=True, exist_ok=True)
    html_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.parent.mkdir(parents=True, exist_ok=True)

    markdown_out.write_text(build_markdown(metrics), encoding="utf-8")
    html_out.write_text(build_html(metrics), encoding="utf-8")
    json_out.write_text(json.dumps(metrics, indent=2, default=str), encoding="utf-8")
    return {"markdown": markdown_out, "html": html_out, "json": json_out}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Build investor/product completion reports from research artifacts.")
    parser.add_argument("--project", default="outputs/cancer_proof_v1")
    parser.add_argument("--markdown-out", default="docs/project_completion_report.md")
    parser.add_argument("--html-out", default=None)
    parser.add_argument("--json-out", default=None)
    args = parser.parse_args(argv)
    paths = build_completion_report(args.project, args.markdown_out, args.html_out, args.json_out)
    print(json.dumps({key: str(value) for key, value in paths.items()}, indent=2))


if __name__ == "__main__":
    main()
