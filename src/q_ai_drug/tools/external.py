from __future__ import annotations

import json
import re
import shlex
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ExternalTool:
    name: str
    path: str | None
    via_wsl: bool

    @property
    def available(self) -> bool:
        return bool(self.path)


def wsl_available() -> bool:
    try:
        result = subprocess.run(["wsl.exe", "bash", "-lc", "true"], capture_output=True, text=True, timeout=15)
        return result.returncode == 0
    except Exception:
        return False


def wsl_which(name: str) -> str | None:
    if not wsl_available():
        return None
    result = subprocess.run(
        ["wsl.exe", "bash", "-lc", f"command -v {shlex.quote(name)} || true"],
        capture_output=True,
        text=True,
        timeout=20,
    )
    path = result.stdout.strip().splitlines()
    return path[-1] if path else None


def resolve_tool(name: str) -> ExternalTool:
    local = shutil.which(name)
    if local:
        return ExternalTool(name=name, path=local, via_wsl=False)
    wsl_path = wsl_which(name)
    if wsl_path:
        return ExternalTool(name=name, path=wsl_path, via_wsl=True)
    return ExternalTool(name=name, path=None, via_wsl=False)


def windows_to_wsl_path(path: str | Path) -> str:
    path = str(Path(path).resolve())
    match = re.match(r"^([A-Za-z]):\\(.*)$", path)
    if match:
        drive = match.group(1).lower()
        rest = match.group(2).replace("\\", "/")
        return f"/mnt/{drive}/{rest}"
    result = subprocess.run(["wsl.exe", "wslpath", "-a", path], capture_output=True, text=True, timeout=20)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"wslpath failed for {path}")
    return result.stdout.strip()


def run_external(
    name: str,
    args: list[str],
    *,
    cwd: str | Path | None = None,
    timeout: int = 600,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    tool = resolve_tool(name)
    if not tool.available:
        raise FileNotFoundError(f"External tool not found on Windows PATH or WSL PATH: {name}")
    if tool.via_wsl:
        quoted = " ".join(shlex.quote(str(arg)) for arg in [tool.path, *args])
        if cwd:
            wsl_cwd = windows_to_wsl_path(cwd)
            quoted = f"cd {shlex.quote(wsl_cwd)} && {quoted}"
        command = ["wsl.exe", "bash", "-lc", quoted]
    else:
        command = [tool.path, *args]
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        cwd=None if tool.via_wsl else cwd,
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"{name} failed with code {result.returncode}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return result


def tool_version(name: str, args: list[str]) -> str:
    tool = resolve_tool(name)
    if not tool.available:
        return "not_available"
    result = run_external(name, args, check=False, timeout=60)
    text = (result.stdout + "\n" + result.stderr).strip()
    return "\n".join(text.splitlines()[:8]) if text else f"returncode={result.returncode}"


def write_external_tool_manifest(out_path: str | Path) -> dict[str, dict]:
    specs = {
        "vina": ["--version"],
        "smina": ["--help"],
        "gnina": ["--version"],
        "obabel": ["-V"],
        "xtb": ["--version"],
    }
    manifest = {}
    for name, version_args in specs.items():
        tool = resolve_tool(name)
        manifest[name] = {
            "available": tool.available,
            "path": tool.path,
            "via_wsl": tool.via_wsl,
            "version": tool_version(name, version_args) if tool.available else "not_available",
        }
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(manifest, indent=2))
    return manifest
