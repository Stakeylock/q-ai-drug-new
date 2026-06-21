# Data Integrity Policy

QuDrugForge data records should be attributable, legible, contemporaneous, original or true-copy, accurate, complete, consistent, enduring, and available.

Controls implemented in this repository:
- Hash-chained audit trail for controlled industrial workflow actions.
- Payload hashes for electronic signatures and frozen reports.
- Assay-result import summaries with QC status and source metadata.
- Exportable manifests for wet-lab packets and generated reports.

Production controls still required: validated database retention, backup/restore testing, access review, tenant isolation, encryption key management, and disaster recovery drills.
