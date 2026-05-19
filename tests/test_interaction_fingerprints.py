from __future__ import annotations

from pathlib import Path

import pandas as pd

from q_ai_drug.docking.interaction_fingerprints import build_interaction_fingerprints


def _write_minimal_sdf(path: Path) -> None:
    path.write_text(
        """lig
  unit

  1  0  0  0  0  0            999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
M  END
$$$$
""",
        encoding="utf-8",
    )


def test_interaction_fingerprint_schema(tmp_path):
    receptor = tmp_path / "receptor.pdb"
    receptor.write_text(
        "ATOM      1  CA  ALA A   1       0.500   0.000   0.000  1.00 20.00           C\nEND\n",
        encoding="utf-8",
    )
    ligand = tmp_path / "ligand.sdf"
    _write_minimal_sdf(ligand)
    candidates = tmp_path / "top_candidates.csv"
    pd.DataFrame(
        [
            {
                "target_id": "EGFR",
                "candidate_id": "EGFR_TEST",
                "receptor_path": str(receptor),
                "docked_sdf_path": str(ligand),
            }
        ]
    ).to_csv(candidates, index=False)

    result = build_interaction_fingerprints(candidates, tmp_path / "docking", limit=1)

    required = {
        "target_id",
        "candidate_id",
        "pose_source",
        "receptor_path",
        "pose_sdf_path",
        "contact_residue_count",
        "contact_residues",
        "hbond_like_contacts",
        "salt_bridge_like_contacts",
        "hydrophobic_contacts",
        "halogen_contacts",
        "key_residue_contact_count",
        "key_residue_contacts",
        "interaction_quality",
        "interaction_backend",
        "interaction_status",
        "interaction_classes",
        "residue_interaction_count",
        "claim_boundary",
    }
    assert required.issubset(result.columns)
    assert result.loc[0, "contact_residue_count"] >= 1
    assert result.loc[0, "interaction_backend"] in {"prolif", "geometric_fallback"}
