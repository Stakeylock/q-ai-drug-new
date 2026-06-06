

docs/SCIENTIFIC_SOURCE_REGISTRY.md
This explains:
-what scientific sources are used
-why they are used
-how trustworthy they are
-what evidence they provide
## Purpose
This registry documents all scientific data sources,
literature sources, benchmarks, and computational evidence
used.
Source 1: ChEMBL
## Type:
Bioactivity database
## Purpose
Used for:
- target activity prediction
- QSAR model training
- activity normalization
- potency estimation
## Accepted Measurements:
## Ki
## Kd
## IC50
## EC50
## Output Usage
-activity prediction
-ranking features
-training datasets
## Provenance Fields Required
source_record_id
source_doi
source_assay_id
source_target_id
## Claim Boundary
Public heterogeneous assay data.
Assay conditions vary.
Does not guarantee clinical efficacy.


Source 2: BindingDB
## Type:
Protein-ligand binding affinity database
## Purpose
Used for:
- experimentally measured binding affinity integration
- target-specific inhibitor retrieval
- potency normalization
- activity-model training
- benchmarking docking and ranking systems
## Accepted Measurements
## Ki
## Kd
## IC50
## EC50
## Output Usage
-activity prediction
-binding affinity estimation
-training datasets
-candidate ranking
-benchmark evidence
## Provenance Fields Required
source_record_id
source_doi
source_pmid
target_name
assay_description
measurement_type
measurement_unit
## Claim Boundary
Public assay measurements from heterogeneous experimental setups.
Assay conditions vary across studies.
Does not prove clinical efficacy or therapeutic effectiveness.




Source 3: PubChem
## Type:
Public chemical and bioassay database
## Purpose
Used for:
- compound retrieval
- molecular descriptors
- bioassay integration
- toxicity evidence
- structure standardization
- similarity search
## Accepted Measurements
bioassay activity
compound properties
toxicity annotations
screening assay results
## Output Usage
-molecular featurization
-compound enrichment
-toxicity annotation
-candidate lookup
-chemical similarity analysis
## Provenance Fields Required
pubchem_cid
bioassay_id
compound_name
source_link
canonical_smiles
## Claim Boundary
Contains heterogeneous public assay data.
Screening activity does not imply validated inhibition or therapeutic activity.





## Source 4: Tox21
## Type:
Toxicity prediction benchmark dataset
## Purpose
Used for:
- toxicity model training
- toxicity benchmarking
- adverse-effect prediction
- compound filtering

## Accepted Measurements
toxicity class labels
nuclear receptor activity
stress response pathway activity

## Output Usage
-ADMET prediction
-toxicity filtering
-risk scoring
-benchmark evaluation

## Provenance Fields Required
dataset_record_id
toxicity_endpoint
assay_name
compound_identifier

## Claim Boundary
Provides toxicity screening evidence only.
Does not guarantee human safety outcomes.






Source 5: ClinTox
## Type:
Clinical toxicity benchmark dataset
## Purpose
Used for:
- toxicity classification benchmarking
- clinical toxicity modeling
- safety-risk estimation

## Accepted Measurements
-clinical toxicity labels
-FDA approval labels
-toxicity classification

## Output Usage
-ADMET benchmarking
-clinical toxicity estimation
-model validation

## Provenance Fields Required
dataset_record_id
toxicity_label
approval_status
compound_identifier

## Claim Boundary
Historical clinical toxicity labels only.
Cannot predict real-world patient outcomes with certainty.








Source 6: MoleculeNet
## Type:
Molecular machine-learning benchmark collection
## Purpose
Used for:
- ML benchmarking
- molecular property prediction
- representation-learning evaluation
- QSAR benchmarking

## Accepted Measurements
## -solubility
## -toxicity
-binding activity
-molecular properties
-classification labels

## Output Usage
-model benchmarking
-representation learning
-QSAR evaluation
-feature engineering

## Provenance Fields Required
dataset_name
task_name
sample_id
benchmark_split

## Claim Boundary
Benchmark datasets are simplified ML tasks and may not represent real-world biological complexity.





Source 7: RCSB PDB
## Type:
Protein structure database
## Purpose
Used for:
- receptor structure retrieval
- docking preparation
- structural biology analysis
- binding-pocket extraction
- co-crystal ligand analysis

## Accepted Measurements
-3D protein structures
-ligand-bound complexes
-experimental structural metadata

## Output Usage
-molecular docking
-interaction analysis
-pocket definition
-structural visualization

## Provenance Fields Required
pdb_id
chain_id
experimental_method
resolution
ligand_identifier

## Claim Boundary
Protein structures represent experimentally determined or curated conformations only.
Docking predictions remain computational estimates.




Source 8: AlphaFold DB
## Type:
AI-predicted protein structure database
## Purpose
Used for:
- predicted protein structure retrieval
- target structure completion
- exploratory docking workflows
- structure comparison

## Accepted Measurements
-predicted protein structures
-confidence metrics
-residue confidence scores

## Output Usage
-exploratory docking
-structure approximation
-target visualization

## Provenance Fields Required
alphafold_id
prediction_version
confidence_score
target_identifier

## Claim Boundary
AI-predicted structures may not represent biologically active conformations.
Predictions should not replace experimentally validated structures when available.







Source 9: DepMap
## Type:
Cancer dependency and vulnerability dataset
## Purpose
Used for:
- cancer target prioritization
- dependency analysis
- synthetic lethality exploration
- oncology evidence integration

## Accepted Measurements
-gene dependency scores
-CRISPR knockout sensitivity
-RNAi dependency data

## Output Usage
-target prioritization
-oncology evidence
-vulnerability ranking

## Provenance Fields Required
cell_line_id
gene_identifier
dependency_score
screen_type

## Claim Boundary
Cell-line dependency signals may not generalize to all tumor contexts or patients.







Source 10: GDSC
## Type:
Cancer drug sensitivity dataset
## Purpose
Used for:
- drug-response modeling
- oncology benchmarking
- sensitivity prediction
- resistance analysis

## Accepted Measurements
## IC50
## AUC
drug sensitivity metrics
cell-line response

## Output Usage
-oncology prediction
-drug sensitivity modeling
-resistance profiling

## Provenance Fields Required
cell_line_id
drug_identifier
response_metric
dataset_version

## Claim Boundary
Cell-line response does not guarantee patient response or therapeutic efficacy.







Source 11: CCLE
## Type:
Cancer cell-line characterization dataset
## Purpose
Used for:
- mutation profiling
- expression analysis
- cancer subtype analysis
- target-context integration

## Accepted Measurements
-gene expression
-mutation profiles
-copy number variation
## -proteomics

## Output Usage
-oncology context integration
-target analysis
-resistance analysis

## Provenance Fields Required
cell_line_id
mutation_id
expression_profile_id
sample_identifier

## Claim Boundary
Cell-line biology may not fully represent in vivo tumor biology.







Source 12: TCGA
## Type:
Cancer genomics dataset
## Purpose
Used for:
- mutation landscape analysis
- tumor expression analysis
- survival-context integration
- oncology target validation

## Accepted Measurements
-mutation data
-RNA expression
-clinical annotations
-survival metadata

## Output Usage
-target validation
-oncology prioritization
-biological context analysis

## Provenance Fields Required
patient_identifier
tumor_type
mutation_record
expression_record

## Claim Boundary
Population-level genomics evidence does not directly predict therapeutic success.







Source 13: CPTAC
## Type:
Cancer proteomics dataset
## Purpose
Used for:
- proteomics integration
- phosphoproteomics analysis
- pathway activity estimation
- cancer signaling analysis

## Accepted Measurements
-protein abundance
## -phosphoproteomics
-mass spectrometry profiles

## Output Usage
-pathway analysis
-target activity estimation
-oncology evidence integration

## Provenance Fields Required
sample_identifier
protein_identifier
experiment_id
quantification_method

## Claim Boundary
Proteomics measurements provide molecular context but do not establish therapeutic causality.







Source 14: ClinicalTrials.gov
## Type:
Clinical trial registry
## Purpose
Used for:
- clinical landscape analysis
- target relevance analysis
- therapy comparison
- translational evidence tracking

## Accepted Measurements
-trial metadata
-drug names
-trial phases
-outcome summaries

## Output Usage
-clinical context analysis
-translational prioritization
-therapy landscape mapping

## Provenance Fields Required
nct_id
trial_phase
intervention_name
trial_status

## Claim Boundary
Clinical trial registration does not imply efficacy, approval, or successful outcomes.







Source 15: COSMIC
## Type:
Cancer mutation database
## Purpose
Used for:
- cancer mutation integration
- resistance mutation analysis
- oncology target mapping

## Accepted Measurements
-somatic mutations
-cancer mutation frequencies
-resistance-associated variants

## Output Usage
-mutation-aware ranking
-resistance analysis
-oncology evidence integration

## Provenance Fields Required
mutation_identifier
gene_name
tumor_type
sample_identifier

## Claim Boundary
Mutation prevalence does not prove target druggability or therapeutic response.








Source 16: PubMed
## Type:
Biomedical literature database
## Purpose
Used for:
- scientific literature retrieval
- evidence mining
- target research
- oncology context extraction

## Accepted Measurements
-peer-reviewed publications
## -abstracts
-biomedical metadata

## Output Usage
-literature evidence
-claim validation
-scientific context generation

## Provenance Fields Required
pmid
publication_year
journal_name
author_list

## Claim Boundary
Published literature may contain conflicting evidence and varying experimental quality.







## Source 17: Semantic Scholar
## Type:
Scientific literature indexing platform
## Purpose
Used for:
- scientific paper discovery
- citation analysis
- topic exploration
- evidence linkage

## Accepted Measurements
-paper metadata
-citation networks
-author metadata
-research topics

## Output Usage
-literature retrieval
-research mapping
-evidence graph generation

## Provenance Fields Required
paper_id
doi
citation_count
publication_year

## Claim Boundary
Citation metrics and indexed metadata do not guarantee scientific correctness or reproducibility.







Source 18: Europe PMC
## Type:
Biomedical literature repository
## Purpose
Used for:
- open-access literature retrieval
- biomedical evidence integration
- publication mining
- full-text evidence extraction

## Accepted Measurements
-full-text publications
## -abstracts
-publication metadata

## Output Usage
-literature evidence extraction
-scientific summarization
-evidence provenance

## Provenance Fields Required
pmcid
pmid
doi
publication_year

## Claim Boundary
Literature-derived evidence remains interpretive and requires scientific validation.


