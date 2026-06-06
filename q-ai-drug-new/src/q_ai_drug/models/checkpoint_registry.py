from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

try:
    import torch
except Exception:
    torch = None


def _state_dict_parameter_count(state_dict: dict) -> int:
    total = 0
    for value in state_dict.values():
        if hasattr(value, "numel"):
            total += int(value.numel())
    return total


def inspect_checkpoint(path: str | Path) -> list[dict]:
    checkpoint_path = Path(path)
    if torch is None or not checkpoint_path.exists():
        return []
    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    rows = []
    if isinstance(checkpoint, dict) and all(isinstance(value, dict) for value in checkpoint.values()):
        items = checkpoint.items()
    else:
        items = [(checkpoint_path.stem, checkpoint)]
    for module_name, state_dict in items:
        if not isinstance(state_dict, dict):
            continue
        tensor_items = [(key, value) for key, value in state_dict.items() if hasattr(value, "shape")]
        rows.append(
            {
                "checkpoint_path": str(checkpoint_path),
                "module_name": module_name,
                "parameter_count": _state_dict_parameter_count(dict(tensor_items)),
                "tensor_count": len(tensor_items),
                "first_tensors": json.dumps(
                    [{"name": key, "shape": list(value.shape)} for key, value in tensor_items[:8]]
                ),
                "integration_status": "registered_checkpoint_requires_original_architecture",
                "research_use": "architecture/model-card evidence; not used for inference in packaged pipeline",
            }
        )
    return rows


def write_model_cards(out_dir: str | Path, checkpoint_paths: list[str | Path] | None = None) -> pd.DataFrame:
    checkpoint_paths = checkpoint_paths or ["drug_discovery_models.pt", "best_tox_model.pt"]
    out_dir = Path(out_dir)
    rows = [
        {
            "checkpoint_path": str(out_dir / "*_baseline_activity.joblib"),
            "module_name": "target_specific_activity_models",
            "parameter_count": None,
            "tensor_count": None,
            "first_tensors": "[]",
            "integration_status": "active_inference",
            "research_use": "scaffold-split EGFR/PARP1/PIK3CA activity scoring and rediscovery benchmark",
        },
        {
            "checkpoint_path": str(out_dir / "admet_models.joblib"),
            "module_name": "tox21_clintox_admet_models",
            "parameter_count": None,
            "tensor_count": None,
            "first_tensors": "[]",
            "integration_status": "active_inference",
            "research_use": "trained Tox21 toxicity and ClinTox approval/toxicity probabilities used in filtering and ranking",
        },
        {
            "checkpoint_path": "outputs/cancer_proof_v1/qml/quantum_kernel_scores.csv",
            "module_name": "qiskit_statevector_kernel_reranker",
            "parameter_count": 0,
            "tensor_count": 0,
            "first_tensors": "[]",
            "integration_status": "active_inference",
            "research_use": "late-stage quantum-kernel reranking on QM descriptors",
        },
    ]
    for path in checkpoint_paths:
        rows.extend(inspect_checkpoint(path))
    out = pd.DataFrame(rows)
    out_dir.mkdir(parents=True, exist_ok=True)
    out.to_csv(out_dir / "model_cards.csv", index=False)
    (out_dir / "model_cards.json").write_text(json.dumps(out.to_dict("records"), indent=2))
    return out
