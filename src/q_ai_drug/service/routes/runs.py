from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


router = APIRouter(prefix="/v1/runs", tags=["runs"])

WORKSPACE_DIR = Path(os.getenv("QDF_WORKSPACE_DIR", "workspace"))
MODULE_DIRS = [
    "00_inputs",
    "01_target_prep",
    "02_ligand_library",
    "03_docking",
    "04_interaction_fingerprints",
    "05_physics_refinement",
    "06_admet_tox",
    "07_quantum_qm",
    "08_sar_decision",
    "09_assay_handoff",
    "logs",
]


class CreateRunRequest(BaseModel):
    user_id: str = Field(default="demo-user", min_length=1)
    profile: dict[str, Any] = Field(default_factory=dict)
    inputs: dict[str, Any] = Field(default_factory=dict)
    reference_mode: str = "benchmark_comparator_only"


class RunEventRequest(BaseModel):
    module: str
    event: str
    status: str = "info"
    message: str
    progress: int | None = Field(default=None, ge=0, le=100)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_slug(value: str, fallback: str) -> str:
    text = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())[:96].strip("_")
    return text or fallback


def _run_root(user_id: str, run_id: str) -> Path:
    safe_user = _safe_slug(user_id, "demo-user")
    safe_run = _safe_slug(run_id, "run")
    root = (WORKSPACE_DIR / "users" / safe_user / "runs" / safe_run).resolve()
    allowed = (WORKSPACE_DIR / "users" / safe_user / "runs").resolve()
    try:
        root.relative_to(allowed)
    except ValueError:
        raise HTTPException(status_code=403, detail="Run path escapes workspace.") from None
    return root


def _sha256_text(payload: Any) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def _append_event(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    event = {"timestamp": _now(), **payload}
    events_path = root / "events.jsonl"
    with events_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, default=str) + "\n")
    return event


def _read_events(root: Path, limit: int) -> list[dict[str, Any]]:
    path = root / "events.jsonl"
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines()[-limit:]:
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


@router.post("")
def create_run(request: CreateRunRequest) -> dict[str, Any]:
    run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    root = _run_root(request.user_id, run_id)
    root.mkdir(parents=True, exist_ok=True)
    for dirname in MODULE_DIRS:
        (root / dirname).mkdir(parents=True, exist_ok=True)
    user_profile = WORKSPACE_DIR / "users" / _safe_slug(request.user_id, "demo-user") / "profile.json"
    if request.profile:
        _write_json(user_profile, {"updated_at": _now(), **request.profile})
    manifest = {
        "run_id": run_id,
        "user_id": request.user_id,
        "created_at": _now(),
        "workspace_root": root.as_posix(),
        "module_dirs": MODULE_DIRS,
        "inputs": request.inputs,
        "input_checksum": _sha256_text(request.inputs),
        "reference_mode": request.reference_mode,
        "source_reads": [],
        "jobs": [],
        "claim_boundary": "In-silico research run. No clinical, regulatory, safety, or efficacy claims.",
    }
    _write_json(root / "manifest.json", manifest)
    event = _append_event(
        root,
        {
            "module": "orchestration",
            "event": "run_created",
            "status": "started",
            "message": "Isolated run workspace created.",
            "progress": 0,
            "artifacts": [{"label": "manifest", "path": (root / "manifest.json").as_posix()}],
        },
    )
    return {"run_id": run_id, "workspace_root": root.as_posix(), "manifest": manifest, "event": event}


@router.post("/{run_id}/events")
def append_run_event(run_id: str, request: RunEventRequest, user_id: str = "demo-user") -> dict[str, Any]:
    root = _run_root(user_id, run_id)
    if not root.exists():
        raise HTTPException(status_code=404, detail="Run workspace not found.")
    event = _append_event(root, request.model_dump())
    manifest_path = root / "manifest.json"
    manifest = _read_json(manifest_path)
    if manifest:
        manifest.setdefault("jobs", []).append(
            {
                "module": request.module,
                "event": request.event,
                "status": request.status,
                "timestamp": event["timestamp"],
                "progress": request.progress,
                "artifacts": request.artifacts,
                "data_checksum": _sha256_text(request.data),
            }
        )
        if request.event in {"source_read", "cache_read"}:
            manifest.setdefault("source_reads", []).append({"timestamp": event["timestamp"], **request.data})
        manifest["updated_at"] = event["timestamp"]
        _write_json(manifest_path, manifest)
    return {"event": event}


@router.get("/{run_id}/events")
def get_run_events(run_id: str, user_id: str = "demo-user", limit: int = 300) -> dict[str, Any]:
    root = _run_root(user_id, run_id)
    if not root.exists():
        raise HTTPException(status_code=404, detail="Run workspace not found.")
    return {"run_id": run_id, "events": _read_events(root, max(1, min(limit, 1000)))}


@router.get("/{run_id}/manifest")
def get_run_manifest(run_id: str, user_id: str = "demo-user") -> dict[str, Any]:
    root = _run_root(user_id, run_id)
    manifest = _read_json(root / "manifest.json")
    if not manifest:
        raise HTTPException(status_code=404, detail="Run manifest not found.")
    return manifest
