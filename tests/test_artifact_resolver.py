"""Tests for the local artifact resolver registry."""
from __future__ import annotations

import json
from pathlib import Path
import pytest

from q_ai_drug.service.artifact_resolver import (
    register_artifact,
    resolve_artifact_path,
    list_project_artifacts,
    _registry_path
)

def test_artifact_registration_and_resolution(tmp_path, monkeypatch):
    """Test that an artifact can be registered and resolved."""
    # Monkeypatch the registry path to avoid polluting real environment
    monkeypatch.setattr("q_ai_drug.service.artifact_resolver._registry_path", lambda x: tmp_path / "artifacts_registry.json")
    
    project_id = tmp_path
    dummy_file = tmp_path / "dummy.csv"
    dummy_file.write_text("a,b\n1,2")
    
    # 1. Register artifact
    record = register_artifact(
        project_id=project_id,
        module_id="test_module",
        run_id="run_1",
        file_path=dummy_file,
        artifact_type="csv"
    )
    
    assert record.artifact_id is not None
    assert record.project_id == str(project_id)
    assert record.file_path == dummy_file.name
    
    # 2. Resolve artifact
    resolved_path = resolve_artifact_path(project_id, record.artifact_id)
    assert resolved_path == dummy_file
    
    # 3. List artifacts
    artifacts = list_project_artifacts(project_id)
    assert len(artifacts) == 1
    assert artifacts[0].artifact_id == record.artifact_id

def test_resolve_missing_artifact(tmp_path, monkeypatch):
    """Resolving a non-existent artifact should raise ValueError."""
    monkeypatch.setattr("q_ai_drug.service.artifact_resolver._registry_path", lambda x: tmp_path / "artifacts_registry.json")
    with pytest.raises(Exception):
        resolve_artifact_path("project_123", "invalid_id")
