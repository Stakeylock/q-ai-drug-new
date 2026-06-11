from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from q_ai_drug.models.baseline_activity import train_baseline_models


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Train target-specific baseline activity models.")
    parser.add_argument("--benchmark", required=True)
    parser.add_argument("--out", default="outputs/cancer_proof_v1/models")
    parser.add_argument("--targets", nargs="*", default=None)
    args = parser.parse_args(argv)
    benchmark = pd.read_csv(args.benchmark)
    if args.targets:
        benchmark = benchmark[benchmark["target_id"].isin(args.targets)]
    metrics, _ = train_baseline_models(benchmark, Path(args.out))
    print(metrics.to_string(index=False))


if __name__ == "__main__":
    main()
