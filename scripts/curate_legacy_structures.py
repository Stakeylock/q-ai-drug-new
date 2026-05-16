from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import pandas as pd


LEGACY_TARGETS = {
    "ada": "legacy ADA target from phase2 docking",
    "aldr": "legacy ALDR target from phase2 docking",
    "cah2": "legacy CAH2 target from phase2 docking",
    "try1": "legacy TRY1 target from phase2 docking",
    "tryb1": "legacy TRYB1 target from phase2 docking",
}


def curate_legacy_structures(
    *,
    source_dir: str | Path = "phase2_docking/receptors",
    out_dir: str | Path = "data/structures_havetosee",
) -> pd.DataFrame:
    source_dir = Path(source_dir)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for target_id, note in LEGACY_TARGETS.items():
        source = source_dir / f"{target_id}_alphafold.pdb"
        destination = out_dir / source.name
        if source.exists():
            shutil.copy2(source, destination)
            status = "copied_review_only"
        else:
            status = "missing_from_phase2_receptors"
        rows.append(
            {
                "target_id": target_id.upper(),
                "source_path": str(source),
                "review_path": str(destination) if destination.exists() else "",
                "status": status,
                "active_pipeline_required": False,
                "reason": "Current cancer proof targets are EGFR, PARP1, and PIK3CA; keep this receptor for historical review unless config is expanded.",
                "note": note,
            }
        )
    manifest = pd.DataFrame(rows)
    manifest.to_csv(out_dir / "legacy_structure_manifest.csv", index=False)
    (out_dir / "legacy_structure_manifest.json").write_text(json.dumps(manifest.to_dict("records"), indent=2), encoding="utf-8")
    return manifest


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Move legacy AlphaFold receptors into review-only structures_havetosee.")
    parser.add_argument("--source-dir", default="phase2_docking/receptors")
    parser.add_argument("--out-dir", default="data/structures_havetosee")
    args = parser.parse_args(argv)
    manifest = curate_legacy_structures(source_dir=args.source_dir, out_dir=args.out_dir)
    print(manifest.to_string(index=False))


if __name__ == "__main__":
    main()
