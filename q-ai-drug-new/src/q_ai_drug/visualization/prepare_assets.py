from __future__ import annotations

import argparse
from pathlib import Path

from q_ai_drug.structures.prepare_structures import prepare_ligand_assets
from q_ai_drug.visualization.view_3d import build_candidate_gallery


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Prepare ligand assets and HTML gallery.")
    parser.add_argument("--in", dest="in_csv", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args(argv)
    out_dir = Path(args.out)
    manifest = prepare_ligand_assets(args.in_csv, out_dir, limit=args.limit)
    build_candidate_gallery(args.in_csv, out_dir / "candidate_gallery.html")
    print(f"Wrote {len(manifest)} ligand assets to {out_dir}")


if __name__ == "__main__":
    main()
