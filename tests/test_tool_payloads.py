"""Tests for Pydantic payload validation models — all modules."""
from __future__ import annotations

import pytest

from q_ai_drug.service.tool_payloads import (
    QFilterPayload,
    QOrbitalAnalyzerPayload,
    QDockStudioPayload,
    OncoDataBuilderPayload,
    PocketBox,
    validate_payload,
)


# ============================================================================
# QFilterPayload
# ============================================================================

def test_q_filter_payload_valid_with_upload():
    p = QFilterPayload.model_validate({"candidate_upload_file": "my_mols.csv"})
    assert p.candidate_upload_file == "my_mols.csv"
    assert p.run_admet is True  # default


def test_q_filter_payload_rejects_negative_max_molecules():
    with pytest.raises(Exception):
        QFilterPayload.model_validate({"candidate_upload_file": "x.csv", "max_molecules": -5})


def test_q_filter_payload_rejects_zero_max_molecules():
    with pytest.raises(Exception):
        QFilterPayload.model_validate({"candidate_upload_file": "x.csv", "max_molecules": 0})


def test_q_filter_payload_model_dump_roundtrip():
    p = QFilterPayload.model_validate({"candidate_upload_file": "x.csv", "filter_profile": "strict"})
    d = p.model_dump()
    assert d["filter_profile"] == "strict"
    assert d["candidate_upload_file"] == "x.csv"


# ============================================================================
# QOrbitalAnalyzerPayload
# ============================================================================

def test_q_orbital_payload_valid_with_upload():
    p = QOrbitalAnalyzerPayload.model_validate({"candidate_upload_file": "mols.sdf"})
    assert p.method.value == "auto"
    assert p.conformer_count == 1


def test_q_orbital_payload_rejects_zero_conformer_count():
    with pytest.raises(Exception):
        QOrbitalAnalyzerPayload.model_validate({"candidate_upload_file": "x.csv", "conformer_count": 0})


# ============================================================================
# QDockStudioPayload
# ============================================================================

def test_q_dock_payload_valid_with_box():
    p = QDockStudioPayload.model_validate({
        "receptor_upload_file": "receptor.pdb",
        "ligand_upload_file": "ligands.csv",
        "pocket_source": "uploaded_box",
        "pocket_box": {
            "center_x": 10.0, "center_y": 20.0, "center_z": 30.0,
            "size_x": 20.0, "size_y": 20.0, "size_z": 20.0,
        },
    })
    assert p.pocket_box.center_x == 10.0


def test_q_dock_payload_requires_pocket_box_when_uploaded_box():
    with pytest.raises(Exception):
        QDockStudioPayload.model_validate({
            "receptor_upload_file": "receptor.pdb",
            "ligand_upload_file": "ligands.csv",
            "pocket_source": "uploaded_box",
            # pocket_box missing!
        })


def test_q_dock_payload_rejects_bad_exhaustiveness():
    with pytest.raises(Exception):
        QDockStudioPayload.model_validate({
            "receptor_upload_file": "x.pdb",
            "ligand_upload_file": "y.csv",
            "pocket_source": "uploaded_box",
            "pocket_box": {"center_x": 0, "center_y": 0, "center_z": 0, "size_x": 20, "size_y": 20, "size_z": 20},
            "exhaustiveness": 50,  # Max is 32
        })


def test_pocket_box_rejects_negative_size():
    with pytest.raises(Exception):
        PocketBox(center_x=0, center_y=0, center_z=0, size_x=-5, size_y=20, size_z=20)


def test_pocket_box_rejects_oversized():
    with pytest.raises(Exception):
        PocketBox(center_x=0, center_y=0, center_z=0, size_x=200, size_y=20, size_z=20)


# ============================================================================
# OncoDataBuilderPayload
# ============================================================================

def test_onco_payload_valid_single_target():
    p = OncoDataBuilderPayload.model_validate({"target_ids": ["EGFR"]})
    assert p.target_ids == ["EGFR"]
    assert p.curation_profile == "standard"


def test_onco_payload_rejects_empty_targets():
    with pytest.raises(Exception):
        OncoDataBuilderPayload.model_validate({"target_ids": []})


def test_onco_payload_rejects_too_many_targets():
    with pytest.raises(Exception):
        OncoDataBuilderPayload.model_validate({"target_ids": [f"T{i}" for i in range(25)]})


# ============================================================================
# validate_payload dispatcher
# ============================================================================

def test_validate_payload_returns_dict():
    result = validate_payload("q_filter", {"candidate_upload_file": "x.csv"})
    assert isinstance(result, dict)
    assert result["candidate_upload_file"] == "x.csv"


def test_validate_payload_raises_for_bad_module():
    with pytest.raises(ValueError, match="No payload model"):
        validate_payload("unknown_module_xyz", {})


def test_validate_payload_raises_on_invalid_data():
    with pytest.raises(ValueError, match="Invalid payload"):
        validate_payload("q_dock_studio", {"pocket_source": "uploaded_box"})  # Missing pocket_box
