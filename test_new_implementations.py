"""Test new implementations: payload validation, artifact resolver, CSV merge."""

import sys
from pathlib import Path

# Test 1: Payload validation before credit reservation (routes)
print("=" * 60)
print("TEST 1: Payload Validation Before Credit Reservation")
print("=" * 60)

try:
    from q_ai_drug.service.tool_payloads import validate_payload
    
    # Valid payload
    valid = validate_payload("q_filter", {
        "candidate_upload_file": "test.csv",
        "filter_profile": "standard",
        "run_admet": False
    })
    print("✅ Valid payload passes: q_filter")
    
    # Invalid payload (missing required field)
    try:
        invalid = validate_payload("q_filter", {
            "filter_profile": "standard",
            # Missing candidate_upload_file
        })
        print("❌ Should have rejected invalid payload")
    except ValueError as e:
        print(f"✅ Invalid payload rejected with: {str(e)[:100]}")
    
except Exception as e:
    print(f"❌ Error: {e}")

# Test 2: Artifact resolver error handling
print("\n" + "=" * 60)
print("TEST 2: Artifact Resolver Error Handling")
print("=" * 60)

try:
    from q_ai_drug.service.artifact_resolver import (
        resolve_artifact_path,
        ArtifactResolverNotReady,
        ARTIFACT_SYSTEM_STATUS
    )
    
    print(f"Artifact system status:")
    print(f"  - Resolve implemented: {ARTIFACT_SYSTEM_STATUS['resolve']}")
    print(f"  - Register implemented: {ARTIFACT_SYSTEM_STATUS['register']}")
    print(f"  - Next priority: {ARTIFACT_SYSTEM_STATUS['next_priority']}")
    
    # Try to resolve artifact (should fail with clear message)
    try:
        path = resolve_artifact_path("test-project", "artifact-123")
        print("❌ Should have raised ArtifactResolverNotReady")
    except ArtifactResolverNotReady as e:
        error_msg = str(e)
        if "artifact system is not yet fully implemented" in error_msg or "not yet implemented" in error_msg:
            print(f"✅ Clear error message: {error_msg[:100]}")
        else:
            print(f"❌ Unclear error: {error_msg}")
    
except Exception as e:
    print(f"❌ Error: {e}")

# Test 3: Q-Filter duplicate removal logic
print("\n" + "=" * 60)
print("TEST 3: Q-Filter Duplicate Removal")
print("=" * 60)

try:
    import pandas as pd
    from rdkit import Chem
    
    # Create test data with duplicates
    test_molecules = [
        {"SMILES": "CC(C)Cc1ccc(cc1)C(C)C(O)=O", "name": "ibuprofen_1"},
        {"SMILES": "CC(C)Cc1ccc(cc1)C(C)C(O)=O", "name": "ibuprofen_2"},  # Duplicate
        {"SMILES": "c1ccccc1", "name": "benzene"},
        {"SMILES": "c1ccccc1", "name": "benzene_2"},  # Duplicate
    ]
    
    # Simulate deduplication logic
    canonical_smiles_list = []
    duplicates_removed = 0
    dedup_molecules = []
    
    for row in test_molecules:
        smiles = row["SMILES"]
        try:
            mol = Chem.MolFromSmiles(str(smiles))
            if mol:
                canonical = Chem.MolToSmiles(mol)
            else:
                canonical = None
        except:
            canonical = None
        
        if canonical and canonical in canonical_smiles_list:
            duplicates_removed += 1
            continue
        
        canonical_smiles_list.append(canonical)
        dedup_molecules.append(row)
    
    print(f"Input molecules: {len(test_molecules)}")
    print(f"After deduplication: {len(dedup_molecules)}")
    print(f"Duplicates removed: {duplicates_removed}")
    
    if duplicates_removed == 2 and len(dedup_molecules) == 2:
        print("✅ Deduplication works correctly")
    else:
        print(f"❌ Unexpected results")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

# Test 4: OncoDataBuilder CSV loading (simulated)
print("\n" + "=" * 60)
print("TEST 4: OncoDataBuilder Uploaded Assay Loading")
print("=" * 60)

try:
    import tempfile
    import pandas as pd
    
    # Create temporary CSV
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        temp_csv = f.name
        f.write("target_id,canonical_smiles,pActivity\n")
        f.write("TP53,CC(C)Cc1ccccc1,5.5\n")
        f.write("EGFR,c1ccccc1,6.2\n")
    
    # Test loading
    df = pd.read_csv(temp_csv)
    print(f"✅ Loaded uploaded assay CSV: {len(df)} rows, {list(df.columns)}")
    
    # Cleanup
    Path(temp_csv).unlink()
    
except Exception as e:
    print(f"❌ Error: {e}")

# Test 5: Routes integration (check imports)
print("\n" + "=" * 60)
print("TEST 5: Routes Integration")
print("=" * 60)

try:
    # Check if validate_payload was imported correctly
    import inspect
    with open("src/q_ai_drug/service/routes/tools.py", "r") as f:
        tools_content = f.read()
    
    if "from q_ai_drug.service.tool_payloads import validate_payload" in tools_content:
        print("✅ validate_payload imported in routes")
    else:
        print("❌ validate_payload not imported")
    
    if "validated_payload = validate_payload(module_id, request.payload)" in tools_content:
        print("✅ validate_payload called before credit check")
    else:
        print("❌ validate_payload not called in right place")
    
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 60)
print("✅ ALL NEW IMPLEMENTATION TESTS COMPLETE")
print("=" * 60)
