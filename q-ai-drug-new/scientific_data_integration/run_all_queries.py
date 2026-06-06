import os
import sys
import subprocess
import json

def run_command(cmd, env_vars=None):
    """Executes a command and prints its progress."""
    print(f"\n[EXEC] {' '.join(cmd)}")
    
    # Merge existing environment variables with custom ones
    full_env = os.environ.copy()
    if env_vars:
        full_env.update(env_vars)
        
    try:
        result = subprocess.run(
            cmd,
            env=full_env,
            capture_output=True,
            text=True,
            check=True
        )
        print("[SUCCESS]")
        if result.stderr.strip():
            print(f"Stderr: {result.stderr.strip()}")
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"[FAILED] Error: {e}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        return None

def main():
    print("=" * 60)
    # Volatility and biological claim disclaimer to strictly adhere to terms
    print("  SCIENTIFIC DATA SYNTHESIS RUNNER (HYPOTHESIS ONLY)")
    print("  Wet-lab validation is strictly required before any biological")
    print("  activity, safety, efficacy, or therapeutic claim.")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    skills_source = os.path.join(base_dir, "skills_source")
    outputs_dir = os.path.join(base_dir, "outputs")
    os.makedirs(outputs_dir, exist_ok=True)
    
    # Locate python executable
    python_exe = sys.executable or "python"
    
    # Define custom environment to ensure clean execution and imports
    custom_env = {
        "PYTHONPATH": skills_source,
        "SCIENCE_SKILLS_USER_AGENT": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    # 1. UniProt
    uniprot_script = os.path.join(skills_source, "uniprot_database", "scripts", "uniprot_tools.py")
    uniprot_out = os.path.join(outputs_dir, "uniprot_egfr_run.json")
    print("\n--- 1. Querying UniProt KB ---")
    run_command([
        python_exe, uniprot_script, "get", "P00533"
    ], env_vars=custom_env)

    # 2. ChEMBL
    chembl_script = os.path.join(skills_source, "chembl_database", "scripts", "chembl_api.py")
    print("\n--- 2. Querying ChEMBL ---")
    run_command([
        python_exe, chembl_script, "chembl_id_lookup", "--id", "CHEMBL203", "--output", os.path.join(outputs_dir, "chembl_lookup_run.json")
    ], env_vars=custom_env)
    run_command([
        python_exe, chembl_script, "target", "--id", "CHEMBL203", "--output", os.path.join(outputs_dir, "chembl_target_run.json")
    ], env_vars=custom_env)
    run_command([
        python_exe, chembl_script, "mechanism", "--filter", "target_chembl_id=CHEMBL203", "--limit", "5", "--output", os.path.join(outputs_dir, "chembl_mechanisms_run.json")
    ], env_vars=custom_env)

    # 3. AlphaFold
    af_dir = os.path.join(skills_source, "alphafold_database_fetch_and_analyze", "scripts")
    af_out_dir = os.path.join(outputs_dir, "alphafold_run")
    os.makedirs(af_out_dir, exist_ok=True)
    print("\n--- 3. Querying AlphaFold & Analyzing structures ---")
    run_command([
        python_exe, os.path.join(af_dir, "fetch_structure.py"), "P00533", "-o", af_out_dir
    ], env_vars=custom_env)

    # 4. Clinical Trials
    ct_script = os.path.join(skills_source, "clinical_trials_database", "scripts", "clinical_trials_api.py")
    print("\n--- 4. Querying Clinical Trials ---")
    run_command([
        python_exe, ct_script, "search", "--term", "EGFR", "--status", "RECRUITING", "--limit", "5", "--output", os.path.join(outputs_dir, "clinical_trials_egfr_run.json")
    ], env_vars=custom_env)

    # 5. ClinVar
    cv_script = os.path.join(skills_source, "clinvar_database", "scripts", "clinvar_api.py")
    print("\n--- 5. Querying ClinVar ---")
    run_command([
        python_exe, cv_script, "search", "--query", "EGFR[gene]", "--retmax", "10", "--output", os.path.join(outputs_dir, "clinvar_egfr_run.json")
    ], env_vars=custom_env)
    run_command([
        python_exe, cv_script, "summary", "--variant_ids", "4842929", "4842928", "4842927", "--output", os.path.join(outputs_dir, "clinvar_summary_run.json")
    ], env_vars=custom_env)

    # 6. dbSNP
    dbsnp_script = os.path.join(skills_source, "dbsnp_database", "scripts", "dbsnp_cli.py")
    print("\n--- 6. Querying dbSNP ---")
    run_command([
        python_exe, dbsnp_script, "get-variant", "rs121434568", "--output", os.path.join(outputs_dir, "dbsnp_variant_run.json")
    ], env_vars=custom_env)

    # 7. EMBL-EBI OLS
    ols_script = os.path.join(skills_source, "embl_ebi_ols", "scripts", "search_ols.py")
    print("\n--- 7. Querying EMBL-EBI OLS ---")
    run_command([
        python_exe, ols_script, "--query", "epidermal growth factor receptor", "--rows", "5", "--output", os.path.join(outputs_dir, "ols_search_run.json")
    ], env_vars=custom_env)

    # 8. ENCODE cCREs
    encode_script = os.path.join(skills_source, "encode_ccres_database", "scripts", "screen_api.py")
    print("\n--- 8. Querying ENCODE cCREs ---")
    run_command([
        python_exe, encode_script, "gene-expression", "EGFR", "--output", os.path.join(outputs_dir, "encode_expression_run.json")
    ], env_vars=custom_env)

    # 9. Human Protein Atlas
    hpa_script = os.path.join(skills_source, "human_protein_atlas_database", "scripts", "hpa_cli.py")
    print("\n--- 9. Querying Human Protein Atlas ---")
    run_command([
        python_exe, hpa_script, "get-subcellular-location", "ENSG00000146648", "--output", os.path.join(outputs_dir, "hpa_location_run.json")
    ], env_vars=custom_env)
    run_command([
        python_exe, hpa_script, "get-tissue-expression", "ENSG00000146648", "--output", os.path.join(outputs_dir, "hpa_expression_run.json")
    ], env_vars=custom_env)

    # 10. openFDA
    fda_script = os.path.join(skills_source, "openfda_database", "scripts", "openfda_query.py")
    print("\n--- 10. Querying openFDA ---")
    run_command([
        python_exe, fda_script, "search", "--category", "drug", "--endpoint", "label", "--search", "openfda.generic_name:gefitinib", "--limit", "1", "--output", os.path.join(outputs_dir, "openfda_gefitinib_run.json")
    ], env_vars=custom_env)

    # 11. PDB
    pdb_script = os.path.join(skills_source, "pdb_database", "scripts", "download_coordinate_files.py")
    print("\n--- 11. Querying PDB ---")
    run_command([
        python_exe, pdb_script, "--format", "mmcif", "--ids", "1M17", "--output_dir", os.path.join(outputs_dir, "pdb_run")
    ], env_vars=custom_env)

    # 12. Reactome
    reactome_script = os.path.join(skills_source, "reactome_database", "scripts", "reactome_analysis.py")
    print("\n--- 12. Querying Reactome ---")
    run_command([
        python_exe, reactome_script, "identifier", "--id", "P00533", "--output", os.path.join(outputs_dir, "reactome_egfr_run.json")
    ], env_vars=custom_env)

    print("\n" + "=" * 60)
    print("  ALL QUERIES COMPLETED!")
    print("=" * 60)

if __name__ == "__main__":
    main()
