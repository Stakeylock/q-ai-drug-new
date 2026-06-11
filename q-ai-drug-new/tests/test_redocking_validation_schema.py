from __future__ import annotations

import pandas as pd

from q_ai_drug.docking.redocking_validation import build_redocking_validation


def test_redocking_validation_schema_with_no_docking(tmp_path):
    pockets = tmp_path / "pockets.yaml"
    pockets.write_text(
        """
pockets:
  EGFR:
    target_id: EGFR
    pdb_id: 1M17
    source: unit
    center_x: 1.0
    center_y: 2.0
    center_z: 3.0
    size_x: 20.0
    size_y: 20.0
    size_z: 20.0
    reference_ligand: erlotinib
    reference_ligand_code: AQ4
    method_tier: CURATED
    provenance_note: unit test pocket
""",
        encoding="utf-8",
    )
    result = build_redocking_validation(project_dir=tmp_path / "project", pockets_config=pockets, structures_dir=tmp_path, run_docking=False)
    required = {
        "target_id",
        "pdb_id",
        "reference_ligand",
        "reference_ligand_code",
        "pocket_source",
        "pocket_method_tier",
        "redocking_status",
        "redocking_rmsd_angstrom",
        "redocking_best_engine",
        "vina_redocking_rmsd_angstrom",
        "gnina_redocking_rmsd_angstrom",
        "redocking_reference_sdf",
        "redocking_pose_sdf",
        "redocking_log",
        "provenance_note",
    }
    assert required.issubset(result.columns)
    written = pd.read_csv(tmp_path / "project" / "docking" / "redocking_validation.csv")
    assert required.issubset(written.columns)
