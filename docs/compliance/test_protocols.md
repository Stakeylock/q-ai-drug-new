# Test Protocols

TP-001 Wet-lab plan: submit a candidate with target, SMILES, predicted activity, ADMET score, uncertainty, and pose URL. Verify all required assay types, controls, concentration ranges, and pass/fail criteria are present.

TP-002 Packet export: request lab packet export. Verify JSON, CSV, Benchling-style CSV, SDF manifest, MOL2 manifest, PDBQT manifest, and result-import template are produced.

TP-003 Result import: submit assay-result CSV. Verify rows are normalized, per-candidate summaries are calculated, and active-learning status is returned.

TP-004 Decision gate: attempt wet-lab promotion with one reviewer. Verify pending second review. Submit a second reviewer and verify approval.

TP-005 Electronic signature: sign a candidate report. Verify payload hash, signature hash, lock state, and frozen report record.

TP-006 Audit log: verify each controlled action appends a hash-chained audit event.

TP-007 Production settings: start with production environment and placeholder secrets. Verify startup fails.
