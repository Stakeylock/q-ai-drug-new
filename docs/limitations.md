# Scientific Limitations

- Public activity records can mix assay formats, constructs, variants, and measurement uncertainty.
- The curation layer is transparent computational curation, not expert manual assay review.
- Proxy decoys are not rigorous DUD-E-style matched decoys.
- ADMET coverage currently emphasizes Tox21 and ClinTox early toxicity triage; hERG, CYP, AMES, DILI, solubility, permeability, and metabolic stability remain future additions unless explicitly trained.
- Docking and GNINA scores are prioritization signals and must be interpreted with redocking and interaction fingerprints.
- OpenMM output is ligand-pose relaxation for local pose triage. It is not explicit-solvent protein-ligand MD and does not prove binding stability.
- xTB/QM descriptors are electronic plausibility features, not binding validation.
- Qiskit/QML signals are exploratory unless ablations show improvement over classical baselines and random quantum controls.
- Candidate dossiers are computational dossiers only; synthesis feasibility, biochemical activity, cellular response, selectivity, and safety remain unvalidated.
