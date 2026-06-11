# Dataset Curation Protocol

This protocol defines the retrospective curation layer used before model training and scientific reporting.

Scope:
- Primary human oncology targets configured for EGFR, PARP1, and PIK3CA.
- Activity types IC50, EC50, Ki, Kd, and AC50 are accepted as public bioactivity evidence.
- Units are standardized to nM where source data provide standard values.
- Active labels use pActivity >= 6.0; weaker activity is treated as inactive or lower confidence depending on benchmark context.
- Duplicate and scaffold handling is inherited from the processed benchmark builder and reported explicitly.

Required row-level fields:
- canonical_smiles
- activity_relation
- activity_value_raw
- activity_unit_raw
- standardized_activity_nM
- p_activity
- assay_confidence
- assay_type
- organism
- target_variant
- curation_flag

Scientific limitation:
This is an auditable computational curation layer over public activity records. It is not a substitute for expert manual assay review, isoform-specific biochemical validation, or wet-lab confirmation.
