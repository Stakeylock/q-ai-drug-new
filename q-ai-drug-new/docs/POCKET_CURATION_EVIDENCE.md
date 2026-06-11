

docs/POCKET_CURATION_EVIDENCE.md
This is SUPER important scientifically.
Docking is weak if pockets are not justified.
This file explains:
-why a docking pocket exists
-where coordinates came from
-what paper/PDB supports it

## Structure
## Pocket Curation Evidence
Target: EGFR

## Receptor
## 1M17
## Target Description
Epidermal Growth Factor Receptor (EGFR) kinase domain.
Frequently mutated and overactivated in multiple cancers,
including non-small cell lung cancer.

## Binding Site Source
-co-crystal ligand
-ATP binding pocket
-literature-supported kinase active site

## Pocket Coordinates
center_x center_y center_z
## 23.1 14.5 -9.2

## Box Dimensions
size_x size_y size_z
## 22 22 22


## Supporting Evidence
PDB co-crystal structure
ATP-site kinase inhibitor literature
validated kinase inhibitor binding region

## Reference Ligand
erlotinib-like ATP-pocket inhibitor

## Validation
redocking RMSD < 2 Å
interaction overlap with co-crystal ligand
ATP-pocket residue recovery observed

## Key Residues
## MET793
## LYS745
## THR790
## ASP855
## LEU718

## Scientific Risks
Kinase flexibility may alter accessible conformations.
Single static receptor structures may not capture all biologically relevant states.
Resistance mutations can alter pocket geometry.

## Claim Boundary
Pocket selection influences docking scores.
Docking does not prove binding or inhibition.
Predicted poses remain computational hypotheses only.





Target: PARP1
## Receptor
## 7KK3

## Target Description
Poly(ADP-ribose) polymerase 1 (PARP1),
a DNA repair enzyme targeted in oncology therapeutics.

## Binding Site Source
co-crystal inhibitor complex
NAD+ catalytic binding site
literature-supported inhibitor pocket

## Pocket Coordinates
center_x center_y center_z
## -18.4 27.2 11.8

## Box Dimensions
size_x size_y size_z
## 24 24 24

## Supporting Evidence
FDA-approved PARP inhibitor structural studies
co-crystal inhibitor complexes
validated catalytic-domain inhibition literature

## Reference Ligand
olaparib-like catalytic inhibitor



## Validation
redocking RMSD < 2 Å
conserved catalytic interactions recovered
known inhibitor orientation preserved

## Key Residues
## SER904
## GLY863
## TYR907
## HIS862
## TYR896

## Scientific Risks
Catalytic-site flexibility may affect docking orientation.
Water-mediated interactions may not be fully modeled.

## Claim Boundary
Docking scores are computational approximations only.
Predicted binding does not establish therapeutic efficacy.
















Target: PIK3CA
## Receptor
## 4JPS

## Target Description
Phosphatidylinositol-4,5-bisphosphate 3-kinase catalytic subunit alpha (PIK3CA),
a major oncogenic kinase frequently altered in solid tumors.

## Binding Site Source
ATP binding site
co-crystal kinase inhibitor structure
oncology kinase literature

## Pocket Coordinates
center_x center_y center_z
## -2.7 14.1 28.5

## Box Dimensions
size_x size_y size_z
## 24 24 24

## Supporting Evidence
validated PI3K inhibitor structures
kinase-domain co-crystal studies
oncology-target structural literature

## Reference Ligand
alpelisib-like kinase inhibitor


## Validation
redocking RMSD < 2 Å
ATP-pocket interaction recovery
kinase hinge-region interactions preserved

## Key Residues
## VAL851
## LYS802
## ASP933
## TYR836
## ILE848

## Scientific Risks
Kinase conformational dynamics may alter binding-site accessibility.
Mutation-dependent structural shifts may influence docking outcomes.

## Claim Boundary
Docking predictions are computational estimates only.
Predicted interactions do not prove biological inhibition.

## Future Oncology Targets
## Receptor Selection Policy
Prefer experimentally solved structures from RCSB PDB.
Use AlphaFold-derived structures only when experimental structures are unavailable.
Prioritize ligand-bound co-crystal conformations when possible.

## Binding Site Selection Policy
Prefer literature-supported active sites.
Prefer co-crystal ligand-defined pockets.
Document all manually curated pockets.

## Pocket Validation Requirements

redocking RMSD target < 2.5 Å
interaction recovery with known ligands
visual inspection of steric compatibility
pose plausibility verification

## Required Evidence Fields
pdb_id
target_name
binding_site_source
reference_ligand
literature_reference
pocket_coordinates
box_dimensions
validation_status

## Scientific Risks
Pocket definition strongly influences docking outcomes.
Incorrect pocket placement can invalidate docking results.
Predicted pockets may not represent biologically active conformations.

## Claim Boundary
Pocket curation supports computational hypothesis generation only.
Docking and pocket analysis do not establish experimental binding or clinical efficacy.

