from pathlib import Path

from q_ai_drug.reporting.report_manifest import write_run_manifest


def test_write_run_manifest(tmp_path: Path) -> None:
    config = tmp_path / "config.yaml"
    asset = tmp_path / "asset.csv"
    config.write_text("project_name: test\n")
    asset.write_text("x\n")
    manifest = write_run_manifest(tmp_path / "out", config, [asset])
    assert manifest.exists()
    assert "asset.csv" in manifest.read_text()
