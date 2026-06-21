from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import shutil
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "research_resources" / "moleculenet"

SMALL_BENCHMARKS = [
    {
        "id": "esol",
        "name": "ESOL / Delaney solubility",
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/delaney-processed.csv",
        "filename": "delaney-processed.csv",
        "task": "aqueous solubility regression",
    },
    {
        "id": "freesolv",
        "name": "FreeSolv",
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/SAMPL.csv",
        "filename": "SAMPL.csv",
        "task": "hydration free energy regression",
    },
    {
        "id": "lipophilicity",
        "name": "Lipophilicity",
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/Lipophilicity.csv",
        "filename": "Lipophilicity.csv",
        "task": "octanol-water distribution regression",
    },
    {
        "id": "bbbp",
        "name": "BBBP",
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/BBBP.csv",
        "filename": "BBBP.csv",
        "task": "blood-brain barrier penetration classification",
    },
    {
        "id": "bace",
        "name": "BACE",
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/bace.csv",
        "filename": "bace.csv",
        "task": "BACE inhibitor classification/regression benchmark",
    },
    {
        "id": "hiv",
        "name": "HIV",
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/HIV.csv",
        "filename": "HIV.csv",
        "task": "HIV replication inhibition classification",
    },
    {
        "id": "clintox",
        "name": "ClinTox",
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/clintox.csv.gz",
        "filename": "clintox.csv",
        "compressed_filename": "clintox.csv.gz",
        "task": "clinical toxicity and FDA approval classification",
    },
    {
        "id": "tox21",
        "name": "Tox21",
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/tox21.csv.gz",
        "filename": "tox21.csv",
        "compressed_filename": "tox21.csv.gz",
        "task": "12 nuclear receptor and stress response toxicity endpoints",
    },
    {
        "id": "sider",
        "name": "SIDER",
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/sider.csv.gz",
        "filename": "sider.csv",
        "compressed_filename": "sider.csv.gz",
        "task": "marketed drug side-effect classification",
    },
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, path: Path, *, force: bool = False) -> None:
    if path.exists() and path.stat().st_size > 0 and not force:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "q-ai-drug-resource-bootstrap/0.1"})
    with urllib.request.urlopen(request, timeout=120) as response, path.open("wb") as handle:
        shutil.copyfileobj(response, handle)


def decompress_gzip(source: Path, dest: Path, *, force: bool = False) -> None:
    if dest.exists() and dest.stat().st_size > 0 and not force:
        return
    with gzip.open(source, "rb") as src, dest.open("wb") as out:
        shutil.copyfileobj(src, out)


def bootstrap(force: bool = False) -> dict[str, Any]:
    DEST.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    for dataset in SMALL_BENCHMARKS:
        compressed_name = dataset.get("compressed_filename")
        target = DEST / str(dataset["filename"])
        source_path = DEST / str(compressed_name) if compressed_name else target
        row = {**dataset, "path": target.relative_to(ROOT).as_posix()}
        try:
            download(str(dataset["url"]), source_path, force=force)
            if compressed_name:
                decompress_gzip(source_path, target, force=force)
            row.update(
                {
                    "status": "present",
                    "bytes": target.stat().st_size,
                    "sha256": sha256(target),
                }
            )
        except Exception as exc:
            row.update({"status": "failed", "error": str(exc)})
        rows.append(row)

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "DeepChem/MoleculeNet public benchmark mirrors",
        "license_note": "Dataset-specific licenses and citations must be reviewed before production redistribution.",
        "datasets": rows,
    }
    manifest_path = DEST / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap small public research benchmark datasets.")
    parser.add_argument("--force", action="store_true", help="Redownload existing files.")
    args = parser.parse_args()
    manifest = bootstrap(force=args.force)
    present = sum(1 for row in manifest["datasets"] if row["status"] == "present")
    failed = len(manifest["datasets"]) - present
    print(f"Wrote {present} datasets to {DEST}; failed={failed}")


if __name__ == "__main__":
    main()

