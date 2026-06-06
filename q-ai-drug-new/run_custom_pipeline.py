import os
import shutil
from pathlib import Path
from q_ai_drug.product.module_execution import execute_module

def main():
    project_dir = Path("execution_test_dir")
    project_dir.mkdir(exist_ok=True)
    uploads_dir = project_dir / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    
    # 1. Provide the master file as upload
    src_file = Path("data/raw/master_drug_discovery_final.csv")
    dest_file = uploads_dir / src_file.name
    if src_file.exists():
        shutil.copy(src_file, dest_file)
        print(f"Copied {src_file.name} to {dest_file}")
    else:
        print(f"Source file {src_file} NOT FOUND!")
        return

    # OncoData Builder payload
    payload_onco = {
        "target_ids": ["EGFR", "PIK3CA"], 
        "data_sources": "uploaded_only",
        "curation_profile": "standard",
        "uploaded_assay_csv": src_file.name
    }
    
    print("\n--- Running OncoData Builder ---")
    res_onco = execute_module(project_dir, "onco_data_builder", "run_01", payload_onco)
    print(res_onco.get("status", "FAILED"), res_onco.get('failure_message', ''))
    
    if res_onco.get("status") != "succeeded":
        return

    # Find curated artifact ID to pass to downstream modules
    curated_artifact_id = None
    for art in res_onco.get("artifacts", []):
        if art.get("name") == "curated_activity":
            curated_artifact_id = art["artifact_id"]
            break
            
    print(f"Curated Artifact ID: {curated_artifact_id}")

    # Q-Filter Payload
    payload_q_filter = {
        "candidate_artifact_id": curated_artifact_id,
        "run_admet": False
    }

    print("\n--- Running Q-Filter ---")
    res_filter = execute_module(project_dir, "q_filter", "run_01", payload_q_filter)
    print(res_filter.get("status", "FAILED"), res_filter.get('failure_message', ''))
    
    filtered_artifact_id = None
    for art in res_filter.get("artifacts", []):
        if art.get("name") == "Filtered candidates SDF" or art.get("uri", "").endswith("filtered_candidates.csv"):
            filtered_artifact_id = art["artifact_id"]
            break

    # We will run wet-lab triage using Q-Filter output since we don't have Q-Rank config ready
    payload_wet_lab = {
        "candidate_artifact_id": filtered_artifact_id,
        "max_to_triage": 50
    }
    print("\n--- Running Wet-Lab Triage ---")
    res_wet = execute_module(project_dir, "wet_lab_triage_board", "run_01", payload_wet_lab)
    print(res_wet.get("status", "FAILED"), res_wet.get('failure_message', ''))

if __name__ == '__main__':
    main()
