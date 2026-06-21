# Functional Requirements Specification

FRS-001: `/v1/industrial/wet-lab/assay-plan` returns per-candidate assay recommendations, controls, concentration ranges, pass/fail criteria, and decision gates.

FRS-002: `/v1/industrial/wet-lab/assay-packet` creates exportable assay packet artifacts and a packet manifest.

FRS-003: `/v1/industrial/wet-lab/results/import` accepts mapped rows or CSV text and returns active-learning/recalibration guidance.

FRS-004: `/v1/industrial/decision-gates` records promote/reject/review states and requires second review for wet-lab promotion.

FRS-005: `/v1/industrial/e-signatures` records signer, meaning, reason, payload hash, and frozen report state.

FRS-006: `/v1/industrial/audit-log` exports hash-chained audit records.

FRS-007: `/v1/industrial/benchmarks/validation-plan` exposes blinded, time-split, leakage-aware benchmark strategy.

FRS-008: `/v1/industrial/cheminformatics/feature-matrix` labels cheminformatics, ADMET, selectivity, and physics features by capability state.

FRS-009: `/v1/industrial/readiness` reports compliance document completion and production gaps.
