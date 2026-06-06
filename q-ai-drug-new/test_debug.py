import pandas as pd
from q_ai_drug.product.module_runners.downstream import ActivityModelStudioRunner
from q_ai_drug.service.artifact_resolver import register_artifact
from pathlib import Path

project_dir = Path("E:/q-ai-drug-new/execution_test_dir")
project_dir.mkdir(exist_ok=True)
(project_dir / "uploads").mkdir(exist_ok=True)
(project_dir / "configs").mkdir(exist_ok=True)
(project_dir / "data" / "processed").mkdir(parents=True, exist_ok=True)

import sys
sys.path.append("src")

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

import q_ai_drug.service.artifact_resolver as ar
ar._registry_path = lambda x: project_dir / "artifacts_registry.json"

record = register_artifact(
    project_id=project_dir,
    module_id="onco_data_builder",
    run_id="run_1",
    file_path=assay_file,
    artifact_type="csv"
)

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
print("Length of train_data:", len(runner.train_data))
runner.run()
print("Runner Warnings:", runner.warnings)
print("Runner model_comparison:", runner.model_comparison)
print("Runner is_heuristic:", runner.is_heuristic)
