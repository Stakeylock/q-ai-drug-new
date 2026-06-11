

docs/BENCHMARK_INTEGRATION_PLAN.md
This explains:
-how models are scientifically validated
-what benchmarks are used
-what leakage risks exist
VERY important for credibility.

## Benchmark Integration Plan
## Purpose:
Defines benchmark datasets used for validating:
- docking
- scoring
- virtual screening
- ADMET prediction
- ranking
- applicability domain

List of Benchmarks:

## • CASF
- PDBbind
## • DUD-E
## • LIT-PCBA
- MoleculeNet
## • Tox21
- ClinTox
- PoseBusters
- DockGen
## • SAMPL







Benchmark 1: CASF
## Task
protein-ligand scoring
docking power
ranking power
binding affinity estimation
## Input Data
PDBbind protein-ligand complexes
experimental binding affinity measurements
reference binding poses

## Metrics
Pearson correlation
Spearman correlation
Top-1 pose RMSD
docking success rate
ranking enrichment

## Output Usage
docking validation
scoring-function benchmarking
ranking evaluation
pose prediction assessment
## Risks
protein overlap
chemical redundancy
benchmark memorization
training-test leakage
pose similarity bias

## Claim Boundary
High benchmark performance does not guarantee prospective virtual-screening success

Benchmark 2: PDBbind
## Task
binding affinity prediction
structure-based scoring
protein-ligand interaction modeling

## Input Data
experimentally solved protein-ligand complexes
binding affinity measurements
3D structural coordinates

## Metrics
## RMSE
Pearson correlation
Spearman correlation
## MAE

## Output Usage
affinity prediction benchmarking
scoring-function calibration
ML model training

## Risks
chemical scaffold overlap
target overlap
experimental noise
curation inconsistencies

## Claim Boundary
Affinity prediction on curated datasets may not generalize to unseen biological systems.



Benchmark 3: DUD-E
## Task
virtual screening
active-vs-decoy classification
enrichment evaluation

## Input Data
active ligands
property-matched decoys
target structures

## Metrics
## ROC-AUC
## PR-AUC
enrichment factor
## BEDROC
top-k enrichment

## Output Usage
virtual-screening evaluation
screening enrichment analysis
ranking validation

## Risks
artificial decoy bias
chemical property leakage
memorization of benchmark patterns
inflated enrichment metrics

## Claim Boundary
Performance on DUD-E may overestimate real-world virtual-screening capability.


Benchmark 4: LIT-PCBA
## Task
realistic virtual screening
active compound prioritization
large-scale screening evaluation

## Input Data
experimentally validated screening assays
PubChem assay-derived actives
inactive compounds

## Metrics
## ROC-AUC
## EF1%
## BEDROC
hit-retrieval rate

## Output Usage
realistic virtual-screening benchmarking
ranking robustness analysis
model generalization evaluation

## Risks
known leakage concerns
assay overlap
target memorization
dataset contamination
split leakage

## Claim Boundary
Must not be treated as a perfect benchmark.
Requires careful split auditing and leakage analysis.

Benchmark 5: MoleculeNet
## Task
molecular property prediction
QSAR benchmarking
representation-learning evaluation

## Input Data
molecular property datasets
toxicity datasets
solubility datasets
bioactivity datasets

## Metrics
## ROC-AUC
## RMSE
## MAE
accuracy
## F1-score

## Output Usage
ML benchmarking
QSAR validation
representation-learning evaluation

## Risks
scaffold leakage
dataset imbalance
small dataset bias
benchmark overfitting

## Claim Boundary
Benchmark success may not translate directly to prospective medicinal chemistry performance.

## Benchmark 6: Tox21
## Task
toxicity classification
safety prediction
toxicity benchmarking

## Input Data
compound toxicity labels
nuclear receptor assays
stress response assays

## Metrics
## ROC-AUC
precision
recall
## F1-score

## Output Usage
toxicity model validation
ADMET benchmarking
safety-risk estimation

## Risks
class imbalance
assay variability
limited biological coverage
experimental noise

## Claim Boundary
Benchmark toxicity predictions do not guarantee human safety outcomes.



Benchmark 7: ClinTox
## Task
clinical toxicity prediction
approval-risk estimation

## Input Data
FDA approval labels
clinical toxicity annotations
compound structures

## Metrics
## ROC-AUC
accuracy
precision
recall
## F1-score

## Output Usage
clinical toxicity benchmarking
risk classification
model validation

## Risks
small dataset size
historical approval bias
dataset imbalance
limited mechanistic coverage

## Claim Boundary
Historical toxicity labels do not guarantee predictive clinical safety performance.



Benchmark 8: PoseBusters
## Task
pose-quality validation
structure plausibility assessment
docking artifact detection

## Input Data
predicted docking poses
protein-ligand complexes
geometric validation rules

## Metrics
clash detection
geometry validity
pose plausibility
interaction consistency

## Output Usage
pose validation
artifact detection
docking-quality assessment

## Risks
rule-based bias
limited biological interpretation
false-positive geometry rejection

## Claim Boundary
Pose plausibility checks do not prove true biological binding modes.




Benchmark 9: DockGen
## Task
generalized docking evaluation
pose-generation benchmarking
cross-target docking assessment

## Input Data
protein targets
ligand structures
reference docking poses

## Metrics
pose RMSD
top-k docking success
pose recovery rate

## Output Usage
docking robustness evaluation
cross-target generalization analysis
pose-generation benchmarking

## Risks
target overlap
training contamination
pose redundancy
benchmark overfitting

## Claim Boundary
Benchmark docking performance does not guarantee prospective experimental binding success.




Benchmark 10: SAMPL
## Task
physical chemistry prediction
free-energy estimation
solvation prediction
binding thermodynamics

## Input Data
blind challenge datasets
experimental thermodynamic measurements
molecular structures

## Metrics
## RMSE
## MAE
correlation coefficient
free-energy error

## Output Usage
free-energy benchmarking
physics-based model validation
thermodynamic calibration

## Risks
small benchmark size
sampling instability
method sensitivity
force-field bias

## Claim Boundary
Physics-based benchmark success does not ensure accurate prospective medicinal chemistry outcomes.
