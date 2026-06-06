

docs/MODEL_INTEGRATION_REGISTRY.md
This tracks:
-which AI/scientific models are integrated
-their status
-their limitations
-their scientific role
## Structure
## Model Integration Registry
Model 1: GNINA
Category: Deep-learning docking rescoring
## Inputs
-protein structure
-ligand structure
-docking poses
## Outputs
CNN affinity
CNN pose score
rescored docking poses
Current Integration Status - implemented
## Backend
Local binary execution
GPU Requirement - recommended
## Output Usage
-pose rescoring
-candidate ranking
-binding affinity estimation
## Scientific Risks
CNN scores are predictive only.
Sensitive to training distribution.
Can overfit benchmark datasets.
## Claim Boundary
Computational affinity estimation only.
Does not prove experimental binding.

Model 2: DiffDock
Category: Diffusion-based molecular docking

## Inputs
-protein structure
-ligand structure
-binding pocket coordinates

## Outputs
-predicted binding poses
-pose confidence scores

Current Integration Status - planned

## Backend
PyTorch inference pipeline

GPU Requirement
recommended

## Output Usage
pose generation
ensemble docking
pose diversity analysis

## Scientific Risks
Predicted poses may deviate from biologically active conformations.
Performance varies across unseen targets.

## Claim Boundary
Predicted binding poses are computational hypotheses only.


Model 3: Uni-Mol
Category: 3D molecular representation learning

## Inputs
-molecular structures
-3D conformers
-protein-ligand structures

## Outputs
-molecular embeddings
-property predictions
-interaction representations

Current Integration Status - planned

## Backend
PyTorch transformer inference

GPU Requirement
recommended

## Output Usage
molecular featurization
ranking features
property prediction

## Scientific Risks
Embedding quality depends on training distribution.
Generalization to novel chemistry may be limited.

## Claim Boundary
Representation-learning outputs are predictive approximations only.

Model 4: REINVENT4
Category: Generative molecular design

## Inputs
-seed molecules
-reward functions
-optimization objectives

## Outputs
-generated molecular structures
-optimization trajectories
-reward scores

Current Integration Status - planned

## Backend
Python generative workflow

GPU Requirement
optional

## Output Usage
-de novo molecule generation
-lead optimization
-scaffold exploration

## Scientific Risks
Generated molecules may be synthetically unrealistic.
Reward hacking can produce misleading outputs.

## Claim Boundary
Generated compounds are exploratory computational designs only.

Model 5: ADMET-AI
Category: ADMET property prediction

## Inputs
-molecular structures
-SMILES strings
-molecular descriptors

## Outputs
-toxicity predictions
-ADMET predictions
-risk classifications

Current Integration Status - planned

## Backend
ML inference pipeline

GPU Requirement
not required

## Output Usage
-compound filtering
-risk estimation
-candidate prioritization

## Scientific Risks
Predictions depend on training-domain coverage.
Rare toxicities may not be captured.

## Claim Boundary
Predicted ADMET properties are computational estimates only.

Model 6: ADMETlab
Category: ADMET prediction platform

## Inputs
-molecular structures
-SMILES strings
-descriptor vectors

## Outputs
-toxicity scores
-pharmacokinetic predictions
-drug-likeness estimates

Current Integration Status - planned

## Backend
external prediction integration

GPU Requirement
not required

## Output Usage
ADMET enrichment
compound triage
safety filtering

## Scientific Risks
Predictions may vary across chemical domains.
External platform updates may change outputs.

## Claim Boundary
ADMET predictions are supportive computational evidence only.

Model 7: OpenMM
Category: Molecular dynamics simulation

## Inputs
-protein structures
-ligand structures
-force-field parameters

## Outputs
-trajectory files
-RMSD metrics
-stability measurements
-interaction persistence

Current Integration Status - partial

## Backend
Python/OpenMM simulation engine

GPU Requirement
recommended
## Output Usage
-complex stability analysis
-interaction persistence validation
-post-docking refinement

## Scientific Risks
Simulation outcomes depend heavily on force fields and sampling duration.
Short simulations may not reflect biological equilibrium.

## Claim Boundary
MD simulations provide computational stability estimates only.

Model 8: xTB
Category: Semi-empirical quantum chemistry

## Inputs
-molecular structures
-3D conformers
-charge states

## Outputs
-orbital descriptors
-electronic properties
-approximate QM energies

Current Integration Status – implemented

## Backend
local xTB binary execution

GPU Requirement
not required

## Output Usage
QM refinement
electronic descriptor generation
quantum ranking features

## Scientific Risks
Semi-empirical approximations may diverge from higher-level quantum calculations.
Sensitive to conformer quality.

## Claim Boundary
Quantum descriptors are approximate computational estimates only.

Model 9: Qiskit QML
Category: Quantum machine learning

## Inputs
-molecular feature vectors
-quantum kernels
-descriptor embeddings

## Outputs
-quantum kernel scores
-QML classification outputs
-ranking features

Current Integration Status - experimental

## Backend
Qiskit simulator execution

GPU Requirement
not required

## Output Usage
-experimental ranking
-quantum feature exploration
-research benchmarking

## Scientific Risks
Current QML approaches are highly experimental.
No proven advantage over classical ML in this workflow.

## Claim Boundary
QML outputs are exploratory research artifacts only.

Model 10: AlphaFold
Category: AI protein structure prediction

## Inputs
-protein sequences
-target identifiers

## Outputs
-predicted protein structures
-confidence metrics
-residue confidence maps

## Current Integration Status
## Implemented

## Backend
AlphaFold DB integration

GPU Requirement
not required for DB retrieval

## Output Usage
-target structure retrieval
-exploratory docking
-structure completion

## Scientific Risks
Predicted structures may not represent biologically active conformations.
Flexible regions may be inaccurate.

## Claim Boundary
Predicted structures are approximations and not guaranteed experimental conformations.

## Model 11: Chai-1
Category: Next-generation biomolecular structure prediction

## Inputs
-protein sequences
-complex definitions
-molecular interaction context

## Outputs
-predicted biomolecular complexes
-confidence estimates
-interaction structures

Current Integration Status - planned

## Backend
AI structure-prediction workflow

GPU Requirement
required

## Output Usage
-complex prediction
-interaction modeling
-future docking support

## Scientific Risks
Predicted complexes remain computational approximations.
Generalization to novel systems is still under evaluation.

## Claim Boundary
Predicted complexes are research-only computational models.

## Model 12: Boltz
Category: AI biomolecular structure and interaction modeling

## Inputs
-protein sequences
-ligand information
-interaction constraints

## Outputs
-predicted structures
-interaction models
-confidence estimates

Current Integration Status - planned

## Backend
deep-learning inference pipeline

GPU Requirement
required

## Output Usage
-structure prediction
-interaction exploration
-future multimodal modeling

## Scientific Risks
Predicted interaction structures remain approximate computational outputs.
Performance on unseen systems remains uncertain.

## Claim Boundary
Structure predictions are exploratory computational evidence only.