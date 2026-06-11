from q_ai_drug.data.build_oncology_benchmark import canonicalize_smiles, strip_to_largest_fragment


def test_strip_largest_fragment() -> None:
    assert strip_to_largest_fragment("CCO.Cl") == "CCO"


def test_canonicalize_fallback_or_rdkit() -> None:
    assert canonicalize_smiles("CCO") is not None
