# Scientific Data Integration Package (Multi-Database Synthesis)

> [!IMPORTANT]
> **COMPUTATIONAL HYPOTHESES ONLY:**
> This repository contains programmatic scripts, raw query inputs, output datasets, and synthesized annotations derived from 13 primary scientific databases. These outputs represent computational predictions and hypotheses only. **Wet-lab validation is strictly required** before drawing any biological activity, safety, efficacy, or therapeutic claims.

---

## 📂 Directory Structure

This centralized package contains all source code scripts, query configurations, retrieved outputs, and synthesized reports produced during the scientific annotation of **Epidermal Growth Factor Receptor (EGFR)**.

```
scientific_data_integration/
├── README.md                  # This documentation file
├── fetch_all_data.ps1         # Windows PowerShell master orchestrator
├── run_all_queries.py         # Cross-platform master execution script
├── reports/                   # Synthesized report artifacts
│   ├── implementation_plan.md
│   └── scientific_annotations_report.md
├── outputs/                   # Raw programmatic JSON & structural database outputs
│   ├── alphafold/             # Retrieved AlphaFold 3D structures & confidence metrics
│   ├── pdb/                   # Crystal structure coordinate files (1M17)
│   ├── chembl_lookup.json
│   ├── chembl_mechanisms.json
│   ├── chembl_target.json
│   ├── clinical_trials_egfr.json
│   ├── clinvar_egfr.json
│   ├── clinvar_summary.json
│   ├── dbsnp_variant.json
│   ├── encode_expression.json
│   ├── hpa_expression.json
│   ├── hpa_location.json
│   ├── ols_search.json
│   ├── openfda_gefitinib.json
│   ├── reactome_egfr.json
│   └── uniprot_egfr.json
└── skills_source/             # Complete original source code of the database integrations
    ├── alphafold_database_fetch_and_analyze/
    ├── alphagenome_single_variant_analysis/
    ├── chembl_database/
    ├── clinical_trials_database/
    ├── clinvar_database/
    ├── dbsnp_database/
    ├── embl_ebi_ols/
    ├── encode_ccres_database/
    ├── human_protein_atlas_database/
    ├── openfda_database/
    ├── pdb_database/
    ├── reactome_database/
    ├── uniprot_database/
    └── science_skills/        # Reorganized package structure to support clean PYTHONPATH resolving
        └── science_skills_common/
```

---

## 🚀 Execution Instructions

To execute all programmatic queries and refresh the database annotations, run the following commands:

### Using PowerShell (Windows Preferred)
Double-click `fetch_all_data.ps1` or run:
```powershell
powershell -ExecutionPolicy Bypass -File .\fetch_all_data.ps1
```

### Using Python CLI (Cross-Platform)
Set your `PYTHONPATH` to include the `skills_source` directory, and run the master script:
```bash
# Windows CMD
set PYTHONPATH=.\skills_source
python .\run_all_queries.py

# Windows PowerShell
$env:PYTHONPATH=".\skills_source"
python .\run_all_queries.py

# Linux / macOS
export PYTHONPATH=./skills_source
python ./run_all_queries.py
```

---

## 📊 Database Directory & Attributions

| Database | Target Accession / Query | Retrieved Dataset / Outputs | Licensing & Terms |
| :--- | :--- | :--- | :--- |
| **UniProtKB** | `P00533` | Sequence features, domain coordinates | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| **AlphaFold** | `AF-P00533-F1` | 3D structural folding & PAE matrix | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| **RCSB PDB** | `1M17` | Crystal structure with bound Erlotinib | Public Domain |
| **ChEMBL** | `CHEMBL203` | Bioactivity, mechanism, small-molecules | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| **ClinVar** | `"EGFR[gene]"` | Clinical annotations and variant counts | Public Domain / NCBI Policies |
| **dbSNP** | `rs121434568` | Oncogenic L858R mutation coordinates | Public Domain / NCBI Policies |
| **EMBL-EBI OLS**| `EFO_0000458` | Ontology mapping terms (EFO & GO) | EMBL-EBI Terms of Use |
| **Reactome** | `R-HSA-177929` | Intracellular EGFR pathways & cascades | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| **HPA** | `ENSG00000146648` | Subcellular localization & tissue IHC | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **ENCODE** | `ENSG00000146648.18`| Proximal promoter/enhancer activity | ENCODE Data Use Policy |
| **openFDA** | `gefitinib` | Boxed warnings, safety labeling | Public Domain |
| **ClinicalTrials**| `EGFR` | Active recruiting trial protocols | Public Domain |
| **AlphaGenome** | *Mocked* | Mutagenesis / regulatory predictions | API Key Required |

---

## 🔬 Scientific Summary & Findings
All findings are meticulously synthesized in the report:
👉 [scientific_annotations_report.md](file:///E:/q-ai-drug-new/scientific_data_integration/reports/scientific_annotations_report.md)
