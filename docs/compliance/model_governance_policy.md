# Model Governance Policy

Every production model should have:
- Endpoint definition and intended-use boundary.
- Training data cutoff, version, and exclusions.
- Applicability-domain definition.
- Internal validation, external validation, and leakage checks.
- Uncertainty reporting and "do not trust because" warnings.
- Change-control record for retraining or recalibration.

Wet-lab feedback can update confidence calibration immediately, but model retraining should require a frozen dataset, model card update, benchmark rerun, review, and signed release.
