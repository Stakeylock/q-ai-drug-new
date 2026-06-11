from __future__ import annotations

import argparse
import json
from urllib.request import Request, urlopen


def _get(base_url: str, path: str, *, accept: str = "application/json"):
    request = Request(base_url.rstrip("/") + path, headers={"Accept": accept})
    with urlopen(request, timeout=20) as response:
        body = response.read()
        content_type = response.headers.get("content-type", "")
        if "json" in content_type or accept == "application/json":
            return response.status, json.loads(body.decode("utf-8"))
        return response.status, body


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run HTTP smoke checks against the Q-AI research API and dashboard.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args(argv)
    base_url = args.base_url.rstrip("/")

    dashboard_status, _ = _get(base_url, "/dashboard", accept="text/html")
    investor_status, _ = _get(base_url, "/investor", accept="text/html")
    health_status, health = _get(base_url, "/research/artifact-health")
    candidates_status, candidates = _get(base_url, "/research/top-candidates?limit=30")
    viewer_status, viewer = _get(base_url, "/research/pose-viewer-data?limit=30")
    experiments_status, experiments = _get(base_url, "/research/experiments")
    evidence_status, evidence = _get(base_url, "/research/scientific-evidence")

    errors = []
    if dashboard_status != 200:
        errors.append(f"/dashboard returned {dashboard_status}")
    if investor_status != 200:
        errors.append(f"/investor returned {investor_status}")
    if health_status != 200:
        errors.append(f"/research/artifact-health returned {health_status}")
    if candidates_status != 200 or len(candidates) != 30:
        errors.append(f"/research/top-candidates returned {len(candidates) if isinstance(candidates, list) else 'non-list'} rows")
    if viewer_status != 200 or len(viewer.get("candidates", [])) != 30:
        errors.append("/research/pose-viewer-data did not return 30 candidates")
    if experiments_status != 200 or int(experiments.get("experiment_count", 0)) < 100:
        errors.append("/research/experiments did not report at least 100 experiments")
    if evidence_status != 200:
        errors.append(f"/research/scientific-evidence returned {evidence_status}")
    elif int(evidence.get("reference_stats", {}).get("recent_2020_2026_entries", 0)) < 50:
        errors.append("/research/scientific-evidence did not report at least 50 recent references")
    if any(not item.get("pose_sources") for item in candidates):
        errors.append("At least one top candidate is missing pose_sources")
    targets_with_gnina = {item.get("target_id") for item in candidates if item.get("gnina_pose_sdf_url")}
    if not {"EGFR", "PARP1", "PIK3CA"}.issubset(targets_with_gnina):
        errors.append(f"GNINA poses missing for targets: {sorted({'EGFR', 'PARP1', 'PIK3CA'} - targets_with_gnina)}")
    if health.get("missing_image_count") != 0 or health.get("missing_docked_pose_count") != 0:
        errors.append("Artifact health reports missing images or docked poses")

    report = {
        "base_url": base_url,
        "dashboard_status": dashboard_status,
        "investor_status": investor_status,
        "top_candidates": len(candidates) if isinstance(candidates, list) else None,
        "targets_with_gnina": sorted(targets_with_gnina),
        "experiment_count": experiments.get("experiment_count"),
        "recent_reference_count": evidence.get("reference_stats", {}).get("recent_2020_2026_entries") if isinstance(evidence, dict) else None,
        "artifact_health": health,
        "errors": errors,
        "status": "pass" if not errors else "fail",
    }
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
