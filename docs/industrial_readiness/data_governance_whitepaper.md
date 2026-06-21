# Data Governance Whitepaper

Data classes:
- Public reference data: AlphaFold, ChEMBL, PubChem, UniProt, Open Targets.
- Research inputs: de-identified case context, target selections, ligand libraries.
- Generated artifacts: docking poses, ADMET/QM tables, reports, assay packets.
- Experimental feedback: imported assay results and QC status.

Governance controls:
- Data source provenance and local/connector status.
- Audit trail for controlled decisions.
- Frozen signed reports.
- Model governance for retraining after wet-lab feedback.
