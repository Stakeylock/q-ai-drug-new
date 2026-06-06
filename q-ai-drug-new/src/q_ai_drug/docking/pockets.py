from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


DEFAULT_POCKET_REGISTRY = Path("configs/oncology_pockets.yaml")


def receptor_centroid(path: Path) -> tuple[float, float, float]:
    coords = []
    for line in path.read_text(errors="ignore").splitlines():
        if line.startswith(("ATOM", "HETATM")):
            try:
                coords.append((float(line[30:38]), float(line[38:46]), float(line[46:54])))
            except ValueError:
                continue
    if not coords:
        return 0.0, 0.0, 0.0
    return tuple(sum(values) / len(values) for values in zip(*coords))


def load_pocket_registry(path: str | Path = DEFAULT_POCKET_REGISTRY) -> dict[str, dict[str, Any]]:
    registry_path = Path(path)
    if not registry_path.exists():
        return {}
    payload = yaml.safe_load(registry_path.read_text(encoding="utf-8")) or {}
    pockets = payload.get("pockets", payload)
    if isinstance(pockets, list):
        return {str(item.get("target_id")): item for item in pockets if item.get("target_id")}
    if isinstance(pockets, dict):
        return {str(target_id): dict(item or {}, target_id=str(target_id)) for target_id, item in pockets.items()}
    return {}


def registered_receptor_path(
    target_id: str,
    structures_dir: str | Path,
    *,
    registry_path: str | Path = DEFAULT_POCKET_REGISTRY,
) -> Path:
    structures_dir = Path(structures_dir)
    pocket = load_pocket_registry(registry_path).get(target_id)
    if pocket:
        method_tier = str(pocket.get("method_tier", "EXPLORATORY")).upper()
        pdb_id = pocket.get("pdb_id")
        if method_tier in {"REAL", "CURATED"} and pdb_id:
            candidate = structures_dir / f"{pdb_id}.pdb"
            if candidate.exists():
                return candidate
    return structures_dir / f"{target_id}_alphafold.pdb"


def clean_receptor_pdb(input_pdb: Path, output_pdb: Path) -> Path:
    output_pdb.parent.mkdir(parents=True, exist_ok=True)
    keep_prefixes = ("ATOM", "TER", "END")
    lines = [line for line in input_pdb.read_text(errors="ignore").splitlines() if line.startswith(keep_prefixes)]
    if not lines or not lines[-1].startswith("END"):
        lines.append("END")
    output_pdb.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return output_pdb


def resolve_pocket(
    target_id: str,
    receptor_path: Path,
    *,
    default_box_size: float,
    registry_path: str | Path = DEFAULT_POCKET_REGISTRY,
) -> dict[str, Any]:
    registry = load_pocket_registry(registry_path)
    pocket = registry.get(target_id)
    if pocket:
        center = (
            float(pocket["center_x"]),
            float(pocket["center_y"]),
            float(pocket["center_z"]),
        )
        return {
            "target_id": target_id,
            "center": center,
            "size": (
                float(pocket.get("size_x", default_box_size)),
                float(pocket.get("size_y", default_box_size)),
                float(pocket.get("size_z", default_box_size)),
            ),
            "source": pocket.get("source", "pocket_registry"),
            "pdb_id": pocket.get("pdb_id"),
            "reference_ligand": pocket.get("reference_ligand"),
            "provenance_note": pocket.get("provenance_note", "Pocket coordinates loaded from registry."),
            "method_tier": str(pocket.get("method_tier", "EXPLORATORY")).upper(),
        }
    center = receptor_centroid(receptor_path)
    return {
        "target_id": target_id,
        "center": center,
        "size": (float(default_box_size), float(default_box_size), float(default_box_size)),
        "source": "receptor_centroid",
        "pdb_id": None,
        "reference_ligand": None,
        "provenance_note": "Fallback receptor-centroid search box; use only as exploratory computational triage.",
        "method_tier": "EXPLORATORY",
    }


def effective_cubic_box_size(pocket: dict[str, Any]) -> float:
    sizes = pocket.get("size") or (30.0, 30.0, 30.0)
    return float(max(float(value) for value in sizes))
