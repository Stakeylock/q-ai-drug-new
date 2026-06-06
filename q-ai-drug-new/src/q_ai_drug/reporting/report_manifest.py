from __future__ import annotations

import hashlib
import json
import platform
import subprocess
from pathlib import Path


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        return None


def write_run_manifest(out_dir: Path, config_path: Path, assets: list[Path]) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "git_commit": git_commit(),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "config_path": str(config_path),
        "config_sha256": file_sha256(config_path) if config_path.exists() else None,
        "assets": [{"path": str(path), "sha256": file_sha256(path)} for path in assets if path.exists()],
    }
    out_path = out_dir / "run_manifest.json"
    out_path.write_text(json.dumps(manifest, indent=2))
    return out_path
