from __future__ import annotations

import json
from pathlib import Path
import pandas as pd
import pytest

from q_ai_drug.product.module_runners.downstream import ActivityModelStudioRunner
from q_ai_drug.service.artifact_resolver import register_artifact

try:
    from rdkit import Chem
    HAS_RDKIT = True
except ImportError:
    HAS_RDKIT = False


@pytest.fixture
def project_dir(tmp_path):
    """Setup project directory structure."""
    proj = tmp_path / "project"
    proj.mkdir()
    (proj / "uploads").mkdir()
    (proj / "configs").mkdir()
    (proj / "data" / "processed").mkdir(parents=True)
    return proj


def test_activity_model_train_mode(project_dir, monkeypatch):
    """Test that ActivityModelStudioRunner train mode runs successfully and outputs correct artifacts."""
    # Monkeypatch the registry path to avoid polluting the real registry
    monkeypatch.setattr(
        "q_ai_drug.service.artifact_resolver._registry_path",
        lambda x: project_dir / "artifacts_registry.json"
    )

    # 1. Create a synthetic oncology/assay dataset with >15 valid SMILES and p_activity
    # Make some molecules with diverse scaffolds to test scaffold split
    compounds = [
        {"canonical_smiles": "c1ccccc1", "p_activity": 7.0},
        {"canonical_smiles": "CCO", "p_activity": 6.5},
        {"canonical_smiles": "CCN", "p_activity": 5.0},
        {"canonical_smiles": "CC(C)C", "p_activity": 5.5},
        {"canonical_smiles": "CCCC", "p_activity": 6.0},
        {"canonical_smiles": "c1ccccc1CCO", "p_activity": 7.2},
        {"canonical_smiles": "c1ccccc1CCN", "p_activity": 6.8},
        {"canonical_smiles": "c1ccccc1CCC", "p_activity": 5.9},
        {"canonical_smiles": "c1ccccc1C(C)C", "p_activity": 6.1},
        {"canonical_smiles": "c1ccc(cc1)CN", "p_activity": 7.5},
        {"canonical_smiles": "c1ccc(cc1)CO", "p_activity": 6.9},
        {"canonical_smiles": "CC(=O)O", "p_activity": 4.5},
        {"canonical_smiles": "CC(=O)N", "p_activity": 4.8},
        {"canonical_smiles": "CCCCO", "p_activity": 5.2},
        {"canonical_smiles": "CCCCN", "p_activity": 5.1},
        {"canonical_smiles": "c1ccccc1C(=O)O", "p_activity": 8.0},
    ]
    
    assay_file = project_dir / "uploads" / "assay_dataset.csv"
    pd.DataFrame(compounds).to_csv(assay_file, index=False)

    # Register the artifact
    record = register_artifact(
        project_id=project_dir,
        module_id="onco_data_builder",
        run_id="run_1",
        file_path=assay_file,
        artifact_type="csv"
    )

    # 2. Setup ActivityModelStudioRunner for training
    payload = {
        "mode": "train",
        "assay_csv_artifact_id": record.artifact_id,
        "target_id": "EGFR",
        "model_id": "test_model_123"
    }

    runner = ActivityModelStudioRunner(
        module_id="activity_model_studio",
        project_dir=project_dir,
        run_id="train_run_1",
        payload=payload
    )

    runner.validate_payload()
    runner.resolve_inputs()
    runner.run()
    runner.write_outputs()

    # 3. Asserts
    assert runner.is_heuristic is False
    assert runner.model_hash is not None
    assert runner.trained_model is not None
    assert len(runner.model_comparison) > 0

    # Verify that registered artifacts exist
    run_dir = project_dir / "module_runs" / "activity_model_studio" / "train_run_1"
    
    model_path = run_dir / "trained_model.joblib"
    assert model_path.exists()
    
    metrics_path = run_dir / "model_metrics.json"
    assert metrics_path.exists()
    
    comparison_path = run_dir / "model_comparison.csv"
    assert comparison_path.exists()

    # Verify scaffold_split_metrics artifact is registered/exists
    scaffold_metrics_path = run_dir / "scaffold_split_metrics.json"
    if HAS_RDKIT:
        assert scaffold_metrics_path.exists()
        with open(scaffold_metrics_path) as f:
            scaf_data = json.load(f)
        assert scaf_data["total_unique_scaffolds"] > 0
        assert scaf_data["split_method"] == "scaffold"
    else:
        assert not scaffold_metrics_path.exists()
