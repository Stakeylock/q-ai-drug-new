# Q-AI Data Sources

This project uses public datasets and public structural resources for computational research. The outputs are candidate hypotheses only; experimental validation is required before any therapeutic claim.

| Source | Purpose in Pipeline | Cache Path | Usage Notes |
| --- | --- | --- | --- |
| ChEMBL | Target-specific bioactivity records for EGFR, PARP1, and PIK3CA activity modeling | `data/raw/*_chembl_activities.csv`, `data/processed/oncology_benchmark.csv` | Public bioactivity database. Assays are heterogeneous, so scaffold splits and target-level model cards are required. |
| PubChem | Reference inhibitor lookup and seed chemistry metadata | `data/processed/reference_inhibitors.csv` | Used for generation seeding and rediscovery checks. Not a validation source by itself. |
| MoleculeNet Tox21 | Toxicity endpoint model training | `data/raw/tox21.csv` | Public toxicity benchmark used for local ADMET triage classifiers. Endpoint quality varies and must be reported. |
| MoleculeNet ClinTox | Clinical toxicity and approval-likeness model training | `data/raw/clintox.csv` | Public benchmark used for triage only; does not replace experimental toxicity studies. |
| RCSB PDB | Experimental receptor structures and co-crystal references where available | `data/structures/*.pdb` | Co-crystal structures should be used to curate pocket centers before production docking campaigns. |
| AlphaFold DB | Predicted receptor structures for EGFR, PARP1, and PIK3CA when experimental structures are incomplete | `data/structures/*_alphafold.pdb` | Suitable for exploratory visualization and docking hypotheses, not definitive binding evidence. |
| BindingDB | Planned expansion source for binding affinities | Not enabled by default | Requires target/assay curation before mixing with the current benchmark. |
| PubMed | Automated target and reference-drug literature context for evidence dossiers | `outputs/*/literature/target_literature_*.csv` | Context evidence only. Records are not treated as candidate validation without manual review. |

## Provenance Rules

- Keep raw downloaded files under `data/raw/` and processed tables under `data/processed/`.
- Every run writes `run_manifest.json`, `run_summary.json`, tool manifests, model cards, validation reports, and report outputs.
- Every product screen must show method-tier labels such as `REAL`, `EXPLORATORY`, `PROXY`, `FAILED`, or `PLANNED`.
- Automated literature records must be labeled as target-context evidence only and must not be used as measured candidate activity or therapeutic proof.
- Vina/Smina/GNINA docking against receptor-centroid boxes must be labeled exploratory until curated pocket coordinates and provenance are added.
- OpenMM rows are ligand-pose relaxation or trajectory triage unless explicit-solvent protein-ligand MD has been configured and validated.
