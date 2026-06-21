# Risk Assessment

| Risk | Impact | Control | Residual Risk |
| --- | --- | --- | --- |
| Computational score mistaken for activity | Misleading scientific decision | Claim boundaries, assay plans, evidence tiers | Medium |
| Wet-lab promotion without review | Wasted assay spend or unsafe prioritization | Two-person decision gate | Low |
| Assay CSV mis-mapping | Bad active-learning signal | Required columns, normalized import summary, QC status | Medium |
| Dev secret in production | Security exposure | Startup production configuration validation | Low |
| Missing audit trail | Poor inspection readiness | Hash-chained JSONL audit events | Medium until validated storage is used |
| Model drift after feedback | Poor ranking quality | Frozen model versions, recalibration summary, governance policy | Medium |
| Advanced physics overclaiming | False confidence | Evidence-tier labels and explicit planned status | Medium |
