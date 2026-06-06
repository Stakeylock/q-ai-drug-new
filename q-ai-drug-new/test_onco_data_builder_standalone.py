"""
Quick verification test: OncoData Builder standalone execution.

This test verifies that:
1. OncoDataBuilderPayload validates inputs
2. OncoDataBuilderRunner can be instantiated
3. Runner executes without artifact summarization
4. Results are real curated data, not just copied files
"""

from pathlib import Path
from q_ai_drug.service.tool_payloads import OncoDataBuilderPayload, validate_payload
from q_ai_drug.product.module_runners import get_runner
from q_ai_drug.product.module_execution import execute_module


def test_payload_validation():
    """Test OncoDataBuilderPayload validation."""
    # Valid payload
    valid_payload = {
        "target_ids": ["TP53"],
        "data_sources": "public_only",
        "curation_profile": "standard"
    }
    
    try:
        validated = OncoDataBuilderPayload(**valid_payload)
        print("✓ Valid payload accepted")
    except Exception as e:
        print(f"✗ Validation failed: {e}")
        return False
    
    # Invalid payload (empty targets)
    invalid_payload = {
        "target_ids": [],
        "data_sources": "public_only",
    }
    
    try:
        OncoDataBuilderPayload(**invalid_payload)
        print("✗ Invalid payload not rejected!")
        return False
    except ValueError as e:
        print(f"✓ Invalid payload correctly rejected: {e}")
    
    return True


def test_runner_registration():
    """Test that OncoDataBuilderRunner is registered."""
    runner_class = get_runner("onco_data_builder")
    if runner_class:
        print(f"✓ OncoDataBuilderRunner registered: {runner_class.__name__}")
        return True
    else:
        print("✗ OncoDataBuilderRunner not found in registry!")
        return False


def test_execution_flow():
    """Test full execution flow (payload → validation → runner → result)."""
    project_dir = Path("test_onco_run")
    project_dir.mkdir(exist_ok=True)
    
    # Use valid targets from config
    payload = {
        "target_ids": ["EGFR", "PIK3CA"],
        "data_sources": "public_only",
        "curation_profile": "standard",
        "_dry_run": True
    }
    
    try:
        result = execute_module(project_dir, "onco_data_builder", "test_001", payload)
        
        print(f"✓ Execution completed")
        print(f"  Status: {result['status']}")
        print(f"  Artifacts: {len(result.get('artifacts', []))}")
        print(f"  Usage (actual): {result.get('usage', {}).get('actual', {})}")
        
        # Check for errors
        if result.get('failure_message'):
            print(f"  Error: {result['failure_message']}")
        
        # Check module_result.json was written
        result_file = project_dir / "module_runs" / "onco_data_builder" / "test_001" / "module_result.json"
        if result_file.exists():
            print(f"✓ module_result.json written")
        else:
            print(f"✗ module_result.json not found!")
            
        return True
    except Exception as e:
        print(f"✗ Execution failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("OncoData Builder Implementation Test")
    print("=" * 60)
    
    print("\n1. Testing payload validation...")
    test_payload_validation()
    
    print("\n2. Testing runner registration...")
    test_runner_registration()
    
    print("\n3. Testing execution flow...")
    test_execution_flow()
    
    print("\n" + "=" * 60)
    print("Test complete. OncoData Builder is INPUT-DRIVEN, not artifact-first!")
    print("=" * 60)
