from __future__ import annotations

from pathlib import Path

from q_ai_drug.cli import run_cancer_proof


def run_cancer_proof_job(config_path: str, output_dir: str, *, max_records_per_target: int | None, n_generate: int | None, skip_download: bool) -> dict:
    return run_cancer_proof(
        config_path=Path(config_path),
        output_dir=Path(output_dir),
        max_records_per_target=max_records_per_target,
        n_generate=n_generate,
        skip_download=skip_download,
    )
