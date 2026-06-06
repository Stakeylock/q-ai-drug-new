from q_ai_drug.service.input_validation import validate_upload_bytes


def test_smiles_csv_quality_card_flags_invalid_rows():
    data = b"smiles,activity_value\nCCO,10\nnot a smiles,20\nCCO,30\n"
    card = validate_upload_bytes(data, filename="library.csv", artifact_type="smiles_csv")
    assert card["status"] == "warning"
    assert card["rows_total"] == 3
    assert card["invalid_rows"] >= 1
    assert card["duplicate_rows"] >= 1
    assert any("invalid" in warning.lower() for warning in card["warnings"])


def test_pdb_quality_card_fails_without_atoms():
    card = validate_upload_bytes(b"HEADER empty\nEND\n", filename="receptor.pdb", artifact_type="receptor_structure")
    assert card["status"] == "failed"
    assert card["errors"]

