from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class TargetConfig:
    target_id: str
    gene: str
    uniprot_id: str
    cancer_types: list[str] = field(default_factory=list)
    reference_drugs: list[str] = field(default_factory=list)
    activity_types: list[str] = field(default_factory=lambda: ["IC50", "Ki", "Kd"])
    preferred_pdb_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class PathsConfig:
    raw_dir: Path = Path("data/raw")
    processed_dir: Path = Path("data/processed")
    structure_dir: Path = Path("data/structures")
    cache_dir: Path = Path("data/cache")


@dataclass(frozen=True)
class FiltersConfig:
    max_mw: float = 650.0
    max_logp: float = 6.0
    max_tpsa: float = 180.0
    max_rotatable_bonds: int = 14
    min_qed: float = 0.25
    remove_pains: bool = True
    remove_brenk: bool = True


@dataclass(frozen=True)
class ProofRunConfig:
    n_generate: int = 5000
    n_filter: int = 500
    n_dock: int = 100
    n_md: int = 10
    n_qm: int = 10
    active_threshold_pic50: float = 6.0


@dataclass(frozen=True)
class AppConfig:
    project_name: str
    primary_targets: dict[str, TargetConfig]
    paths: PathsConfig = field(default_factory=PathsConfig)
    filters: FiltersConfig = field(default_factory=FiltersConfig)
    proof_run: ProofRunConfig = field(default_factory=ProofRunConfig)


def _path_dict(raw: dict[str, Any]) -> dict[str, Path]:
    return {key: Path(value) for key, value in raw.items()}


def load_config(path: str | Path) -> AppConfig:
    config_path = Path(path)
    data = yaml.safe_load(config_path.read_text()) or {}
    targets = {}
    for target_id, target_data in (data.get("primary_targets") or {}).items():
        targets[target_id] = TargetConfig(
            target_id=target_id,
            gene=target_data["gene"],
            uniprot_id=target_data["uniprot_id"],
            cancer_types=list(target_data.get("cancer_types") or []),
            reference_drugs=list(target_data.get("reference_drugs") or []),
            activity_types=list(target_data.get("activity_types") or ["IC50", "Ki", "Kd"]),
            preferred_pdb_ids=list(target_data.get("preferred_pdb_ids") or []),
        )
    return AppConfig(
        project_name=data.get("project_name", config_path.stem),
        primary_targets=targets,
        paths=PathsConfig(**_path_dict(data.get("paths") or {})),
        filters=FiltersConfig(**(data.get("filters") or {})),
        proof_run=ProofRunConfig(**(data.get("proof_run") or {})),
    )


def ensure_project_dirs(config: AppConfig, output_dir: str | Path | None = None) -> Path:
    for path in (
        config.paths.raw_dir,
        config.paths.processed_dir,
        config.paths.structure_dir,
        config.paths.cache_dir,
    ):
        path.mkdir(parents=True, exist_ok=True)
    out_dir = Path(output_dir or Path("outputs") / config.project_name)
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def config_to_dict(config: AppConfig) -> dict[str, Any]:
    return {
        "project_name": config.project_name,
        "primary_targets": {
            tid: {
                "gene": target.gene,
                "uniprot_id": target.uniprot_id,
                "cancer_types": target.cancer_types,
                "reference_drugs": target.reference_drugs,
                "activity_types": target.activity_types,
                "preferred_pdb_ids": target.preferred_pdb_ids,
            }
            for tid, target in config.primary_targets.items()
        },
        "paths": {
            "raw_dir": str(config.paths.raw_dir),
            "processed_dir": str(config.paths.processed_dir),
            "structure_dir": str(config.paths.structure_dir),
            "cache_dir": str(config.paths.cache_dir),
        },
        "filters": config.filters.__dict__,
        "proof_run": config.proof_run.__dict__,
    }
