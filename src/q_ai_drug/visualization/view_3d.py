from __future__ import annotations

from html import escape
from pathlib import Path

import pandas as pd


def build_candidate_gallery(candidates_csv: str | Path, out_html: str | Path, title: str = "Candidate Gallery") -> Path:
    df = pd.read_csv(candidates_csv).head(200)
    rows = []
    for row in df.to_dict("records"):
        rows.append(
            "<tr>"
            f"<td>{escape(str(row.get('target_id', '')))}</td>"
            f"<td>{escape(str(row.get('candidate_id', '')))}</td>"
            f"<td><code>{escape(str(row.get('canonical_smiles') or row.get('smiles') or ''))}</code></td>"
            f"<td>{escape(str(round(float(row.get('final_score', row.get('admet_score', 0))), 4)))}</td>"
            "</tr>"
        )
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{escape(title)}</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; color: #17202a; }}
    table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
    th, td {{ border: 1px solid #d5dde5; padding: 8px; vertical-align: top; }}
    th {{ background: #eef3f8; text-align: left; }}
    code {{ word-break: break-all; }}
  </style>
</head>
<body>
  <h1>{escape(title)}</h1>
  <p>Research-use-only candidate visualization index. Use RDKit/py3Dmol-enabled assets for inspected 3D poses.</p>
  <table>
    <thead><tr><th>Target</th><th>Candidate</th><th>SMILES</th><th>Score</th></tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table>
</body>
</html>
"""
    out_path = Path(out_html)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    return out_path
