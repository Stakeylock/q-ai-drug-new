## **final_ranked_candidates.csv** 

## **Artifact Purpose** 

Standardized execution-tracking artifact for every Q-AI Drug pipeline module. Used for backend orchestration, frontend execution dashboards, auditability, and evidence validation. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|module_runs|
|Document Path|artifacts/module_runs.csv|
|Backend Collection|module_runs|
|Frontend Target|Admin Dashboard → Pipeline Runs Page|
|Primary Key|run_id|
|Row Granularity|One row per module execution|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Partial|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|run_id|string|Unique execution identifier|
|candidate_id|string|Candidate linked to module execution|
|module_name|string|Executed module name|
|module_stage|string|Pipeline stage|
|execution_status|string|Final execution state|
|execution_start_ts|datetime|Start timestamp|
|execution_end_ts|datetime|Completion timestamp|
|runtime_seconds|float|Total runtime|
|output_artifact_path|string|Generated artifact path|
|filter_pass|boolean|Whether candidate passed module filters|
|evidence_level|string|Evidence confidence tier|
|docking_is_real|boolean|Whether docking used real backend|



**Column Type Description** gnina_executed boolean Whether GNINA execution occurred qm_status string QM execution status interaction_backend string Interaction engine/backend interaction_status string Interaction computation result domain_label string Scientific applicability label missing_evidence string Missing evidence summary claim_boundary string Allowed scientific claim boundary failure_reason string Failure explanation if execution failed 

## **Optional Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|compound_id|string|Optional compound identifier|
|report_id|string|Linked report identifier|
|receptor_id|string|Receptor/protein identifier|
|docking_score|float|Docking affinity|
|md_stability|string|MD stability result|
|qm_score|float|Quantum score|
|qml_score|float|QML ranking score|
|notes|string|Developer/system notes|
|warning_flags|string|Serialized warning flags|
|provenance_note|string|Provenance explanation|
|execution_backend|string|Actual backend engine|
|fallback_used|boolean|Whether fallback logic executed|



## **Evidence Status Fields** 

**Field Description** docking_is_real Indicates real docking execution vs placeholder gnina_executed Indicates GNINA backend execution qm_status Quantum execution result interaction_backend Backend used for interaction generation 

**Description** 

## **Field** 

interaction_status Interaction computation state domain_label Scientific domain applicability missing_evidence Missing scientific evidence summary claim_boundary Restriction boundary for scientific claims failure_reason Failure explanation 

## **Allowed Values — Status Columns** 

## **execution_status** 

- pending 

- running 

- completed 

- failed 

- skipped 

- partial_success 

- fallback_completed 

## **qm_status** 

- not_started 

- running 

- completed 

- failed 

- mock 

- unavailable 

## **interaction_status** 

- completed 

- failed 

- unavailable 

- skipped 

- mock 

## **domain_label** 

- oncology 

- kinase 

- admet 

- docking 

- quantum 

- multimodal 

- exploratory 

- unsupported 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

## **Mock/Fallback Policy** 

**Condition Allowed** Mock rows permitted Yes 

Fallback execution permitted Yes Investor-visible mock rows No Developer-visible mock rows Yes 

Scientist-visible mock rows Clearly labeled only 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically exploratory_research_only Research-only evidence 

## **Example Row** 

|**Column**|**Example**|
|---|---|
|run_id|RUN_EGFR_0001|
|candidate_id|EGFR_CAND_00111|
|module_name|q_dock|
|module_stage|docking|
|execution_status|completed|
|runtime_seconds|2.68|
|docking_is_real|True|
|gnina_executed|False|
|qm_status|completed|
|interaction_backend|vina_smina|
|interaction_status|completed|
|domain_label|oncology|
|missing_evidence|no_wet_lab_validation|
|claim_boundary|hypothesis_only|
|failure_reason||



## **top_candidates.csv** 

## **Artifact Purpose** 

Shortlisted candidate table used for frontend candidate views, ranking dashboards, downloadable reports, and scientific review workflows. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|top_candidates.csv|
|Document Path|artifacts/top_candidates.csv|
|Backend Collection|candidates|
|Frontend Target|Candidate Dashboard → Top Candidates Table|
|Primary Key|candidate_id|
|Row Granularity|One row per shortlisted candidate|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Yes (validated rows only)|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|candidate_id|string|Unique candidate identifier|
|target_id|string|Biological target identifier|
|canonical_smiles|string|Canonical SMILES representation|
|source|string|Candidate origin source|
|activity_score|float|Activity prediction score|
|predicted_pactivity|float|Predicted pActivity|
|mw|float|Molecular weight|
|logp|float|LogP value|
|tpsa|float|Topological polar surface area|
|qed|float|QED drug-likeness score|
|admet_score|float|ADMET prediction score|
|filter_pass|boolean|Whether medicinal chemistry filters passed|
|docking_status|string|Docking execution state|



**Column Type Description** binding_class string Binding strength category affinity_kcal_mol float Binding affinity quantum_score float Quantum evaluation score qml_score float Quantum ML ranking score final_score float Final aggregate ranking score target_rank integer Rank within target 

## **Optional Columns** 

**Column Type Description** parent_name string Parent/reference molecule md_stability_class string MD stability classification docking_is_real boolean Real docking execution indicator gnina_executed boolean GNINA execution indicator qm_status string Quantum execution status interaction_backend string Backend used for interactions interaction_status string Interaction computation state domain_label string Scientific applicability label missing_evidence string Missing evidence summary claim_boundary string Scientific claim restriction failure_reason string Failure explanation report_id string Linked report identifier execution_backend string Actual scoring backend fallback_used boolean Whether fallback logic executed 

## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real docking execution gnina_executed Indicates GNINA backend execution qm_status Quantum execution state interaction_backend Interaction engine/backend 

**Description** 

## **Field** 

interaction_status Interaction computation result domain_label Scientific applicability category missing_evidence Missing scientific validation claim_boundary Restriction boundary for claims failure_reason Failure explanation 

## **Allowed Values — Status Columns** 

## **docking_status** 

- pending 

- running 

- completed 

- failed 

- skipped 

- mock 

## **binding_class** 

- strong 

- moderate 

- weak 

- inactive 

- unknown 

## **qm_status** 

- not_started 

- running 

- completed 

- failed 

- mock 

- unavailable 

## **interaction_status** 

- completed 

- failed 

- unavailable 

- skipped 

- mock 

## **domain_label** 

- oncology 

- kinase 

- docking 

- admet 

- quantum 

- exploratory 

- unsupported 

## **Mock/Fallback Policy** 

## **Condition** 

## **Allowed** 

Mock rows permitted Yes Fallback rows permitted Yes Investor-visible mock rows No Scientist-visible mock rows Clearly labeled only Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically exploratory_research_only Research-only evidence 

## **Example Row** 

**Column Example** candidate_id EGFR_CAND_00111 target_id EGFR canonical_smiles Nc1cc2c(Nc3cccc(Br)c3)ncnc2cn1 source chembl_active_seed activity_score 1.0 predicted_pactivity 10.21 

|**Column**|**Example**|
|---|---|
|mw|316.16|
|logp|3.11|
|tpsa|76.72|
|qed|0.759|
|admet_score|0.818|
|docking_status|completed|
|binding_class|strong|
|affinity_kcal_mol|-8.353|
|quantum_score|0.4696|
|qml_score|0.5783|
|final_score|0.7251|
|target_rank|1|



## **docking/results.csv** 

## **Artifact Purpose** 

Stores molecular docking outputs generated from Vina, Smina, GNINA, or explicitly labeled mock/fallback docking executions. Used for docking analysis, candidate ranking, interaction review, and frontend visualization. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|docking/results.csv|
|Document Path|artifacts/docking/results.csv|
|Backend Collection|docking_results|
|Frontend Target|Candidate Viewer → Docking Results Panel|
|Primary Key|candidate_id|
|Row Granularity|One row per candidate docking result|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Yes (validated rows only)|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|candidate_id|string|Unique candidate identifier|
|target_id|string|Biological target identifier|
|receptor_id|string|Docking receptor/protein identifier|
|docking_backend|string|Docking engine/backend|
|docking_status|string|Docking execution status|
|affinity_kcal_mol|float|Predicted binding affinity|
|binding_class|string|Binding strength classification|
|pose_rank|integer|Ranked docking pose|
|output_pose_path|string|Generated pose/output file|
|docking_is_real|boolean|Real backend execution indicator|
|gnina_executed|boolean|Whether GNINA executed|
|interaction_backend|string|Interaction computation backend|
|interaction_status|string|Interaction generation status|



**Column Type Description** runtime_seconds float Docking runtime claim_boundary string Scientific claim restriction missing_evidence string Missing scientific evidence failure_reason string Failure explanation if docking failed 

## **Optional Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|compound_id|string|Optional compound identifier|
|canonical_smiles|string|Canonical SMILES|
|docking_score|float|Raw backend docking score|
|cnn_score|float|GNINA CNN score|
|cnn_affinity|float|GNINA predicted affinity|
|exhaustiveness|integer|Docking exhaustiveness parameter|
|seed|integer|Random seed|
|center_x|float|Docking box center X|
|center_y|float|Docking box center Y|
|center_z|float|Docking box center Z|
|size_x|float|Docking box size X|
|size_y|float|Docking box size Y|
|size_z|float|Docking box size Z|
|interaction_count|integer|Total detected interactions|
|hbonds|integer|Hydrogen bond count|
|hydrophobic_contacts|integer|Hydrophobic interaction count|
|salt_bridges|integer|Salt bridge count|
|pi_stacking|integer|Pi-stacking interaction count|
|warning_flags|string|Serialized warning flags|
|fallback_used|boolean|Whether fallback logic executed|
|report_id|string|Linked report identifier|



**Evidence Status Fields** 

**Field** 

## **Description** 

docking_is_real Indicates real docking backend execution gnina_executed Indicates GNINA execution 

interaction_backend Backend used for interaction generation interaction_status Interaction computation result missing_evidence Missing scientific validation claim_boundary Restriction boundary for claims failure_reason Failure explanation 

## **Allowed Values — Status Columns** 

## **docking_backend** 

- vina 

- smina 

- gnina 

- mock 

- fallback 

## **docking_status** 

- pending 

- running 

- completed 

- failed 

- skipped 

- mock 

- fallback_completed 

## **binding_class** 

- strong 

- moderate 

- weak 

- inactive 

- unknown 

## **interaction_status** 

- completed 

- failed 

- • unavailable 

- skipped 

- mock 

## **Mock/Fallback Policy** 

**Condition Allowed** Mock rows permitted Yes Fallback docking permitted Yes Investor-visible mock rows No 

Scientist-visible mock rows Clearly labeled only 

Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically exploratory_research_only Research-only evidence 

## **Example Row** 

**Column Example** candidate_id EGFR_CAND_00111 target_id EGFR receptor_id EGFR_4HJO docking_backend vina docking_status completed affinity_kcal_mol -8.353 binding_class strong pose_rank 1 output_pose_path outputs/docking/EGFR_CAND_00111.pdbqt docking_is_real True gnina_executed False 

interaction_backend plip 

**Column** 

**Example** 

interaction_status completed runtime_seconds 2.68 claim_boundary hypothesis_only missing_evidence no_wet_lab_validation failure_reason 

## **docking/interaction_fingerprints.csv** 

## **Artifact Purpose** 

Stores protein–ligand interaction fingerprints generated using ProLIF or geometric interaction analysis backends. Used for interaction evidence validation, residue-level analysis, explainability, and docking evidence visualization. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|docking/interaction_fingerprints.csv|
|Document Path|artifacts/docking/interaction_fingerprints.csv|
|Backend Collection|interaction_fingerprints|
|Frontend Target|Candidate Viewer → Interaction Evidence Panel|
|Primary Key|candidate_id|
|Row Granularity|One row per candidate interaction profile|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Partial|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|candidate_id|string|Unique candidate identifier|
|target_id|string|Biological target identifier|
|receptor_id|string|Protein/receptor identifier|
|interaction_backend|string|Interaction computation backend|
|interaction_status|string|Interaction generation status|
|fingerprint_source|string|Source interaction engine|
|total_interactions|integer|Total detected interactions|
|hydrogen_bonds|integer|Hydrogen bond count|
|hydrophobic_contacts|integer|Hydrophobic interaction count|
|pi_stacking|integer|Pi-stacking interaction count|
|salt_bridges|integer|Salt bridge interaction count|
|interacting_residues|string|Serialized interacting residue list|
|interaction_score|float|Aggregate interaction evidence score|



**Column Type Description** 

docking_is_real boolean Indicates real docking execution claim_boundary string Scientific claim restriction missing_evidence string Missing evidence summary failure_reason string Failure explanation 

## **Optional Columns** 

**Column Type Description** compound_id string Optional compound identifier pose_rank integer Docking pose rank canonical_smiles string Canonical SMILES interaction_distance_avg float Average interaction distance aromatic_contacts integer Aromatic interaction count metal_contacts integer Metal coordination interactions water_bridges integer Water bridge count residue_contact_map string Serialized residue interaction map fingerprint_vector string Serialized interaction fingerprint interaction_density float Interaction density metric gnina_executed boolean GNINA execution indicator qm_status string Quantum execution status domain_label string Scientific applicability label warning_flags string Serialized warning flags fallback_used boolean Whether fallback logic executed report_id string Linked report identifier 

## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real docking execution 

interaction_backend Backend used for interaction generation interaction_status Interaction computation result gnina_executed Indicates GNINA execution 

## **Field** 

## **Description** 

qm_status Quantum execution state missing_evidence Missing scientific validation claim_boundary Restriction boundary for claims failure_reason Failure explanation 

## **Allowed Values — Status Columns** 

## **interaction_backend** 

- prolif 

- plip 

- geometric 

- mock 

- fallback 

## **interaction_status** 

- pending 

- running 

- completed 

- failed 

- skipped 

- mock 

- unavailable 

## **fingerprint_source** 

- prolif 

- geometric_rules 

- • plip 

- mock 

- fallback 

## **qm_status** 

- not_started 

- running 

- completed 

- failed 

- mock 

- unavailable 

**domain_label** 

- oncology 

- kinase 

- docking 

- interaction_analysis 

- quantum 

- exploratory 

- unsupported 

## **Mock/Fallback Policy** 

## **Condition** 

**Allowed** 

Mock rows permitted Yes Fallback interaction generation permitted Yes Investor-visible mock rows No Scientist-visible mock rows Clearly labeled only Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically exploratory_research_only Research-only evidence 

## **Example Row** 

**Column Example** candidate_id EGFR_CAND_00111 target_id EGFR receptor_id EGFR_4HJO interaction_backend prolif interaction_status completed fingerprint_source prolif total_interactions 14 

**Column** 

**Example** 

hydrogen_bonds 

hydrophobic_contacts 7 

pi_stacking 2 salt_bridges 0 

interacting_residues MET793;LEU718;ALA743 interaction_score 0.84 

docking_is_real True claim_boundary hypothesis_only 

missing_evidence no_wet_lab_validation 

failure_reason 

## **gnina/results.csv** 

## **Artifact Purpose** 

Main GNINA CNN docking and rescoring results used for AI-assisted docking validation, affinity prediction, and candidate reranking. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|gnina/results.csv|
|Document Path|artifacts/gnina/results.csv|
|Backend Collection|gnina_results|
|Frontend Target|Candidate Viewer → GNINA Analysis Panel|
|Primary Key|candidate_id|
|Row Granularity|One row per GNINA-scored candidate|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Yes (validated rows only)|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

**Column Type Description** candidate_id string Unique candidate identifier target_id string Biological target identifier receptor_id string Protein/receptor identifier gnina_status string GNINA execution state cnn_score float CNN classification score cnn_affinity float GNINA predicted affinity affinity_kcal_mol float Docking affinity pose_rank integer Ranked docking pose docking_is_real boolean Real execution indicator gnina_executed boolean Indicates GNINA execution runtime_seconds float Execution runtime claim_boundary string Scientific claim restriction 

**Column Type Description** 

missing_evidence string Missing scientific validation failure_reason string Failure explanation 

## **Optional Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|canonical_smiles|string|Canonical SMILES|
|docking_backend|string|Upstream docking backend|
|interaction_backend|string|Interaction engine|
|interaction_status|string|Interaction computation state|
|output_pose_path|string|Pose file path|
|warning_flags|string|Serialized warning flags|
|fallback_used|boolean|Whether fallback logic executed|
|report_id|string|Linked report identifier|
|evidence_level|string|Evidence confidence tier|
|domain_label|string|Scientific applicability label|



## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real GNINA execution gnina_executed Confirms GNINA backend execution interaction_backend Interaction evidence backend interaction_status Interaction generation status missing_evidence Missing validation/evidence claim_boundary Restriction boundary for claims failure_reason Failure explanation domain_label Scientific applicability category 

## **Allowed Values — Status Columns** 

## **gnina_status** 

- pending 

- running 

- completed 

- failed 

- skipped 

- mock 

- fallback_completed 

## **interaction_status** 

- completed 

- failed 

- unavailable 

- skipped 

- mock 

## **domain_label** 

- oncology 

- kinase 

- docking 

- cnn_rescoring 

- • exploratory 

- unsupported 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- • benchmarked 

- experimental_reference 

## **Mock/Fallback Policy** 

**Condition Allowed** Mock rows permitted Yes Fallback execution permitted Yes Investor-visible mock rows No Scientist-visible mock rows Clearly labeled only Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically exploratory_research_only Research-only evidence 

## **Example Row** 

**Column Example** candidate_id EGFR_CAND_00111 target_id EGFR receptor_id EGFR_4HJO gnina_status completed cnn_score 0.82 cnn_affinity -8.91 affinity_kcal_mol -8.35 pose_rank 1 docking_is_real True gnina_executed True runtime_seconds 14.8 claim_boundary hypothesis_only missing_evidence no_wet_lab_validation failure_reason 

## **qm/qm_descriptors.csv** 

## **Artifact Purpose** 

Quantum descriptor artifact generated from xTB, EHT, or failure-labelled QM executions. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|qm/qm_descriptors.csv|
|Document Path|artifacts/qm/qm_descriptors.csv|
|Backend Collection|qm_descriptors|
|Frontend Target|Candidate Viewer → Quantum Descriptor Panel|
|Primary Key|candidate_id|
|Row Granularity|One row per candidate QM evaluation|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Partial|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

**Column Type Description** candidate_id string Unique candidate identifier qm_backend string QM engine/backend qm_status string QM execution state homo_energy float HOMO energy lumo_energy float LUMO energy homo_lumo_gap float HOMO-LUMO gap dipole_moment float Dipole moment quantum_score float Aggregate QM score docking_is_real boolean Real execution indicator claim_boundary string Scientific claim restriction missing_evidence string Missing validation failure_reason string Failure explanation 

## **Optional Columns** 

**Column Type Description** polarizability float Molecular polarizability partial_charge_mean float Average partial charge qm_runtime_seconds float QM execution runtime fallback_used boolean Whether fallback logic executed warning_flags string Serialized warning flags report_id string Linked report identifier evidence_level string Evidence confidence tier domain_label string Scientific applicability label 

## **Evidence Status Fields** 

**Field Description** qm_status Quantum execution status docking_is_real Indicates real backend execution missing_evidence Missing scientific validation claim_boundary Restriction boundary for claims failure_reason Failure explanation domain_label Scientific applicability category 

## **Allowed Values — Status Columns** 

## **qm_backend** 

- xtb 

- eht 

- mock 

- fallback 

## **qm_status** 

- pending 

- running 

- completed 

- failed 

- mock 

- unavailable 

## **domain_label** 

- oncology 

- quantum 

- docking 

- exploratory 

- unsupported 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

## **Mock/Fallback Policy** 

## **Condition Allowed** 

Mock rows permitted Yes Fallback QM execution permitted Yes Investor-visible mock rows No Scientist-visible mock rows Clearly labeled only Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only 

computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically exploratory_research_only Research-only evidence 

**Example Row** 

**Column Example** 

candidate_id EGFR_CAND_00111 qm_backend xtb qm_status completed homo_energy -5.81 lumo_energy -1.92 

homo_lumo_gap 3.89 dipole_moment 2.11 quantum_score 0.47 docking_is_real True 

claim_boundary hypothesis_only 

## **qml/quantum_kernel_scores.csv** 

## **Artifact Purpose** 

Stores quantum-kernel reranking evidence and hybrid quantum machine learning scoring outputs used for candidate prioritization and ranking refinement. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|qml/quantum_kernel_scores.csv|
|Document Path|artifacts/qml/quantum_kernel_scores.csv|
|Backend Collection|qml_scores|
|Frontend Target|Candidate Viewer → Quantum ML Ranking Panel|
|Primary Key|candidate_id|
|Row Granularity|One row per QML-scored candidate|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Partial|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

**Column Type Description** candidate_id string Unique candidate identifier target_id string Biological target identifier qml_backend string Quantum ML backend engine qml_status string QML execution state qml_score float Final QML ranking score kernel_similarity float Quantum kernel similarity rerank_position integer Candidate rank after reranking feature_dimension integer Feature-vector dimension docking_is_real boolean Real execution indicator claim_boundary string Scientific claim restriction missing_evidence string Missing validation/evidence failure_reason string Failure explanation 

## **Optional Columns** 

**Column Type Description** canonical_smiles string Canonical SMILES quantum_score float Upstream quantum score affinity_kcal_mol float Docking affinity classical_baseline_score float Classical baseline score confidence_interval float Confidence interval backend_runtime_seconds float QML runtime feature_backend string Feature generation backend warning_flags string Serialized warning flags fallback_used boolean Whether fallback logic executed report_id string Linked report identifier evidence_level string Evidence confidence tier domain_label string Scientific applicability label 

## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real upstream docking execution qml_status Quantum ML execution status missing_evidence Missing scientific validation 

claim_boundary Restriction boundary for claims 

failure_reason Failure explanation domain_label Scientific applicability category evidence_level Evidence confidence tier 

## **Allowed Values — Status Columns** 

## **qml_backend** 

- qiskit_kernel 

- pennylane_kernel 

- quantum_svm 

- hybrid_kernel 

- mock 

- fallback 

## **qml_status** 

- pending 

- running 

- completed 

- • failed 

- skipped 

- mock 

- fallback_completed 

## **domain_label** 

- oncology 

- qml 

- docking 

- quantum 

- exploratory 

- unsupported 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

## **Mock/Fallback Policy** 

**Condition Allowed** Mock rows permitted Yes Fallback QML execution permitted Yes Investor-visible mock rows No Scientist-visible mock rows Clearly labeled only Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only 

computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically 

exploratory_research_only Research-only evidence 

## **Example Row** 

**Column Example** 

candidate_id EGFR_CAND_00111 target_id EGFR qml_backend qiskit_kernel qml_status completed qml_score 0.5783 kernel_similarity 0.812 rerank_position 1 feature_dimension 256 docking_is_real True claim_boundary hypothesis_only missing_evidence no_wet_lab_validation failure_reason 

## **qml/quantum_ablation_benchmark.csv** 

## **Artifact Purpose** 

Stores quantum-vs-classical benchmarking and ablation evidence used to evaluate the performance impact of quantum machine learning components against classical baselines. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|qml/quantum_ablation_benchmark.csv|
|Document Path|artifacts/qml/quantum_ablation_benchmark.csv|
|Backend Collection|qml_ablation|
|Frontend Target|Research Dashboard → Quantum Benchmarking Panel|
|Primary Key|benchmark_id|
|Row Granularity|One row per benchmark experiment|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Partial|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|benchmark_id|string|Unique benchmark identifier|
|benchmark_name|string|Benchmark experiment name|
|dataset_name|string|Benchmark dataset|
|target_id|string|Biological target identifier|
|classical_model|string|Classical baseline model|
|quantum_model|string|Quantum/QML model|
|benchmark_status|string|Benchmark execution state|
|classical_score|float|Classical model performance|
|quantum_score|float|Quantum model performance|
|improvement_percent|float|Relative improvement percentage|
|metric_name|string|Evaluation metric|
|sample_count|integer|Number of evaluated samples|



**Column Type Description** 

docking_is_real boolean Real upstream execution indicator claim_boundary string Scientific claim restriction missing_evidence string Missing validation/evidence failure_reason string Failure explanation 

## **Optional Columns** 

**Column Type Description** statistical_significance float Statistical significance value p_value float P-value confidence_interval float Confidence interval runtime_classical_seconds float Classical runtime runtime_quantum_seconds float Quantum runtime hardware_backend string Quantum hardware/simulator feature_dimension integer Feature vector dimension benchmark_notes string Additional benchmark notes warning_flags string Serialized warning flags fallback_used boolean Whether fallback logic executed report_id string Linked report identifier evidence_level string Evidence confidence tier domain_label string Scientific applicability label 

## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real upstream docking execution benchmark_status Benchmark execution status missing_evidence Missing scientific validation 

claim_boundary Restriction boundary for claims 

failure_reason Failure explanation domain_label Scientific applicability category evidence_level Evidence confidence tier 

**Allowed Values — Status Columns** 

## **benchmark_status** 

- pending 

- running 

- completed 

- failed 

- partial_success 

- mock 

- fallback_completed 

## **classical_model** 

- random_forest 

- xgboost 

- svm 

- logistic_regression 

- mlp 

- graph_nn 

- mock 

## **quantum_model** 

- qiskit_kernel 

- pennylane_kernel 

- quantum_svm 

- hybrid_kernel 

- vqc 

- mock 

## **domain_label** 

- oncology 

- qml 

- benchmarking 

- quantum 

- exploratory 

- unsupported 

**evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

## **Mock/Fallback Policy** 

## **Condition** 

## **Allowed** 

Mock benchmark rows permitted Yes Fallback benchmark execution permitted Yes Investor-visible mock rows No Scientist-visible mock rows Clearly labeled only Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically exploratory_research_only Research-only evidence 

## **Example Row** 

**Column Example** benchmark_id QML_BENCH_001 benchmark_name EGFR_RERANK_ABLATION dataset_name EGFR_TOP_CANDIDATES target_id EGFR classical_model xgboost quantum_model qiskit_kernel benchmark_status completed 

**Column Example** classical_score 0.71 quantum_score 0.78 improvement_percent 9.8 metric_name roc_auc sample_count 240 docking_is_real True claim_boundary benchmark_reference missing_evidence no_wet_lab_validation failure_reason 

## **admet/candidate_admet_risk_table.csv** 

## **Artifact Purpose** 

Stores ADMET and toxicity endpoint risk predictions for shortlisted candidates. Used for medicinal chemistry filtering, toxicity prioritization, safety review, and downstream wet-lab triage decisions. 

## **Artifact Definition** 

**Field Value** Artifact Name admet/candidate_admet_risk_table.csv Document Path artifacts/admet/candidate_admet_risk_table.csv Backend Collection admet_results Frontend Target Candidate Viewer → ADMET Risk Panel Primary Key candidate_id Row Granularity One row per candidate ADMET evaluation Mock/Fallback Rows Allowed Yes Investor Visible Partial Scientist Visible Yes Developer Visible Yes 

## **Required Columns** 

**Column Type Description** candidate_id string Unique candidate identifier target_id string Biological target identifier admet_backend string ADMET prediction backend admet_status string ADMET execution state admet_score float Aggregate ADMET score hepatotoxicity_risk string Liver toxicity risk cardiotoxicity_risk string Cardiac toxicity risk mutagenicity_risk string Mutagenicity risk nephrotoxicity_risk string Kidney toxicity risk cyp_inhibition string CYP inhibition prediction bbb_permeability string Blood-brain barrier permeability hERG_risk string hERG toxicity prediction 

**Column Type Description** 

oral_bioavailability string Oral bioavailability classification filter_pass boolean Overall ADMET filter result docking_is_real boolean Real upstream execution indicator claim_boundary string Scientific claim restriction missing_evidence string Missing validation/evidence failure_reason string Failure explanation 

## **Optional Columns** 

**Column Type Description** canonical_smiles string Canonical SMILES logs_solubility float Predicted solubility clearance_rate float Predicted clearance plasma_protein_binding string Protein binding classification half_life_prediction string Predicted half-life absorption_score float Predicted absorption score toxicity_probability float Aggregate toxicity probability warning_flags string Serialized warning flags fallback_used boolean Whether fallback logic executed report_id string Linked report identifier evidence_level string Evidence confidence tier domain_label string Scientific applicability label 

## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real upstream docking execution admet_status ADMET execution status missing_evidence Missing scientific validation claim_boundary Restriction boundary for claims failure_reason Failure explanation domain_label Scientific applicability category 

**Field** 

**Description** 

evidence_level Evidence confidence tier 

## **Allowed Values — Status Columns** 

## **admet_backend** 

- deepchem 

- chemprop 

- rdkit_rules 

- admetlab 

- mock 

- fallback 

## **admet_status** 

- pending 

- running 

- completed 

- failed 

- skipped 

- mock 

- fallback_completed 

## **Risk Columns** 

Applicable to: 

- hepatotoxicity_risk 

- cardiotoxicity_risk 

- mutagenicity_risk 

- nephrotoxicity_risk 

- hERG_risk 

Allowed values: 

- low 

- moderate 

- high 

- unknown 

## **cyp_inhibition** 

- none 

- weak 

- moderate 

- strong 

- unknown 

## **bbb_permeability** 

- permeable 

- low_permeability 

- • impermeable 

- unknown 

## **oral_bioavailability** 

- high 

- moderate 

- low 

- unknown 

## **domain_label** 

- oncology 

- admet 

- toxicity 

- medicinal_chemistry 

- exploratory 

- unsupported 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

## **Mock/Fallback Policy** 

## **Condition** 

## **Allowed** 

Mock ADMET rows permitted Yes Fallback ADMET execution permitted Yes Investor-visible mock rows No Scientist-visible mock rows Clearly labeled only Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically exploratory_research_only Research-only evidence 

## **Example Row** 

**Column Example** candidate_id EGFR_CAND_00111 target_id EGFR admet_backend deepchem admet_status completed admet_score 0.818 hepatotoxicity_risk low cardiotoxicity_risk low mutagenicity_risk low nephrotoxicity_risk moderate cyp_inhibition moderate bbb_permeability low_permeability hERG_risk low oral_bioavailability moderate 

**Column Example** filter_pass True docking_is_real True claim_boundary computational_prediction missing_evidence no_in_vivo_validation failure_reason 

## **models/applicability_domain.csv** 

## **Artifact Purpose** 

Stores training-set similarity, applicability-domain membership, and outlier evidence used to determine whether predictions are scientifically reliable for a candidate molecule. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|models/applicability_domain.csv|
|Document Path|artifacts/models/applicability_domain.csv|
|Backend Collection|applicability_domain_results|
|Frontend Target|Candidate Viewer → Applicability Domain Panel|
|Primary Key|candidate_id|
|Row Granularity|One row per candidate domain evaluation|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Partial|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|candidate_id|string|Unique candidate identifier|
|target_id|string|Biological target identifier|
|applicability_backend|string|Domain-analysis backend|
|applicability_status|string|Applicability-domain classification|
|similarity_score|float|Similarity to training distribution|
|outlier_score|float|Statistical outlier metric|
|nearest_neighbor|string|Closest reference compound|
|distance_metric|string|Distance/similarity metric used|
|domain_label|string|Scientific applicability label|
|docking_is_real|boolean|Real upstream execution indicator|
|claim_boundary|string|Scientific claim restriction|
|missing_evidence|string|Missing scientific validation|



**Column Type Description** 

failure_reason string Failure explanation 

## **Optional Columns** 

**Column Type Description** canonical_smiles string Canonical SMILES embedding_backend string Embedding/model backend latent_distance float Latent-space distance training_cluster string Closest training cluster cluster_confidence float Cluster confidence score neighbor_similarity_percentile float Similarity percentile feature_dimension integer Feature vector dimension applicability_notes string Additional applicability notes warning_flags string Serialized warning flags fallback_used boolean Whether fallback logic executed report_id string Linked report identifier evidence_level string Evidence confidence tier 

## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real upstream docking execution applicability_status Applicability-domain classification 

missing_evidence Missing scientific validation 

claim_boundary Restriction boundary for claims 

failure_reason Failure explanation domain_label Scientific applicability category evidence_level Evidence confidence tier 

## **Allowed Values — Status Columns** 

## **applicability_backend** 

- tanimoto_similarity 

- embedding_knn 

- isolation_forest 

- mahalanobis 

- latent_space 

- mock 

- fallback 

## **applicability_status** 

- in_domain 

- borderline 

- out_of_domain 

- uncertain 

- mock 

## **distance_metric** 

- tanimoto 

- cosine 

- euclidean 

- mahalanobis 

- latent_distance 

- unknown 

## **domain_label** 

- oncology 

- applicability_domain 

- medicinal_chemistry 

- docking 

- exploratory 

- unsupported 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

## **Mock/Fallback Policy** 

## **Condition** 

**Condition Allowed** Mock applicability rows permitted Yes Fallback applicability evaluation permitted Yes Investor-visible mock rows No Scientist-visible mock rows Clearly labeled only Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically exploratory_research_only Research-only evidence 

## **Example Row** 

**Column Example** candidate_id EGFR_CAND_00111 target_id EGFR applicability_backend tanimoto_similarity applicability_status in_domain similarity_score 0.87 outlier_score 0.11 nearest_neighbor CHEMBL51853 distance_metric tanimoto domain_label oncology docking_is_real True claim_boundary computational_prediction missing_evidence no_wet_lab_validation failure_reason 

## **triage/wet_lab_triage_board.csv** 

## **Artifact Purpose** 

Stores wet-lab prioritization recommendations, experimental readiness assessments, and assay triage decisions for shortlisted candidates. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|triage/wet_lab_triage_board.csv|
|Document Path|artifacts/triage/wet_lab_triage_board.csv|
|Backend Collection|wet_lab_triage|
|Frontend Target|Wet-Lab Dashboard → Experimental Triage Board|
|Primary Key|candidate_id|
|Row Granularity|One row per candidate wet-lab recommendation|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|Partial|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|candidate_id|string|Unique candidate identifier|
|target_id|string|Biological target identifier|
|triage_backend|string|Triage/ranking backend|
|triage_status|string|Triage execution state|
|triage_priority|string|Experimental priority level|
|wet_lab_status|string|Wet-lab readiness state|
|recommended_assay|string|Suggested experimental assay|
|assay_rationale|string|Scientific rationale|
|evidence_level|string|Evidence confidence tier|
|docking_is_real|boolean|Real upstream execution indicator|
|gnina_executed|boolean|GNINA execution indicator|
|qm_status|string|QM execution status|



**Column Type Description** domain_label string Scientific applicability label missing_evidence string Missing scientific validation claim_boundary string Scientific claim restriction failure_reason string Failure explanation 

## **Optional Columns** 

**Column Type Description** canonical_smiles string Canonical SMILES affinity_kcal_mol float Docking affinity admet_score float Aggregate ADMET score qml_score float QML reranking score assay_type string Experimental assay category estimated_cost_usd float Estimated assay cost estimated_duration_days integer Estimated assay duration vendor_recommendation string Suggested CRO/vendor assay_complexity string Assay difficulty classification triage_notes string Additional triage notes warning_flags string Serialized warning flags fallback_used boolean Whether fallback logic executed report_id string Linked report identifier 

## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real upstream docking execution gnina_executed Indicates GNINA backend execution qm_status Quantum execution status triage_status Wet-lab triage execution status missing_evidence Missing scientific validation claim_boundary Restriction boundary for claims failure_reason Failure explanation 

**Field** 

**Description** 

domain_label 

Scientific applicability category 

evidence_level Evidence confidence tier 

## **Allowed Values — Status Columns** 

## **triage_backend** 

- rule_based 

- weighted_ranking 

- ai_triage 

- expert_curated 

- mock 

- fallback 

## **triage_status** 

- pending 

- running 

- completed 

- failed 

- skipped 

- mock 

- fallback_completed 

## **triage_priority** 

- critical 

- high 

- medium 

- low 

## **wet_lab_status** 

- ready 

- requires_validation 

- blocked 

- exploratory 

- insufficient_evidence 

## **qm_status** 

- not_started 

- running 

- completed 

- failed 

- mock 

- unavailable 

## **assay_complexity** 

- simple 

- moderate 

- complex 

- high_throughput 

- unknown 

## **domain_label** 

- oncology 

- wet_lab 

- docking 

- medicinal_chemistry 

- exploratory 

- unsupported 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

## **Mock/Fallback Policy** 

**Condition Allowed** Mock triage rows permitted Yes Fallback triage execution permitted Yes 

**Condition** 

**Allowed** 

Investor-visible mock rows No Scientist-visible mock rows Clearly labeled only Developer-visible mock rows Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without wet-lab validation benchmark_reference Benchmark-comparable evidence not_for_clinical_use Cannot be used clinically 

exploratory_research_only Research-only evidence 

## **Example Row** 

**Column Example** candidate_id EGFR_CAND_00111 target_id EGFR triage_backend weighted_ranking triage_status completed triage_priority high wet_lab_status ready recommended_assay EGFR kinase inhibition assay assay_rationale Strong docking affinity with acceptable ADMET profile evidence_level computational docking_is_real True gnina_executed True qm_status completed domain_label oncology missing_evidence no_in_vivo_validation claim_boundary computational_prediction failure_reason 

## **scientific_claim_matrix.csv** 

## **Artifact Purpose** 

Defines allowed scientific claim boundaries, evidence visibility rules, regulatory restrictions, and communication limits for all generated artifacts and outputs across the Q-AI Drug platform. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|scientific_claim_matrix.csv|
|Document Path|artifacts/scientific_claim_matrix.csv|
|Backend Collection|claim_matrix|
|Frontend Target|Admin Dashboard → Claim Governance Panel|
|Primary Key|claim_id|
|Row Granularity|One row per claim-policy definition|
|Mock/Fallback Rows Allowed No||
|Investor Visible|Partial|
|Scientist Visible|Yes|
|Developer Visible|Yes|



## **Required Columns** 

|**Column**|**Type**|**Description**|
|---|---|---|
|claim_id|string|Unique claim-policy identifier|
|artifact_name|string|Linked artifact/document|
|module_name|string|Related module|
|claim_boundary|string|Allowed scientific claim level|
|evidence_level|string|Required evidence confidence tier|
|investor_visible|boolean|Visibility to investors|
|scientist_visible|boolean|Visibility to scientists|
|developer_visible|boolean|Visibility to developers|
|wet_lab_required|boolean|Whether wet-lab validation required|
|clinical_restriction|string|Clinical-use restriction|
|regulatory_status|string|Regulatory evidence state|
|missing_evidence|string|Missing scientific evidence|



**Column Type Description** 

communication_policy string Communication limitation policy 

enforcement_status string Claim enforcement status failure_reason string Failure explanation 

## **Optional Columns** 

**Column Type Description** report_id string Linked report identifier target_id string Biological target identifier approval_required boolean Whether approval required approved_by string Reviewer/approver approval_timestamp datetime Approval timestamp internal_only boolean Internal visibility restriction investor_disclaimer string Investor disclaimer text scientific_disclaimer string Scientific disclaimer text warning_flags string Serialized warning flags policy_version string Policy schema version fallback_used boolean Whether fallback policy applied 

## **Evidence Status Fields** 

**Field Description** claim_boundary Restriction boundary for scientific claims evidence_level Evidence confidence tier regulatory_status Regulatory evidence classification missing_evidence Missing scientific validation communication_policy Communication restriction policy enforcement_status Claim governance enforcement state failure_reason Failure explanation 

## **Allowed Values — Status Columns** 

**claim_boundary** 

- hypothesis_only 

- computational_prediction 

- benchmark_reference 

- exploratory_research_only 

- not_for_clinical_use 

- preclinical_candidate 

- validated_experimental_evidence 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

- wet_lab_validated 

## **clinical_restriction** 

- prohibited 

- restricted 

- research_only 

- preclinical_only 

- allowed_with_validation 

= 

## **regulatory_status** 

- non_regulated_research 

- preclinical 

- investigational 

- unsupported_claim 

- validation_required 

## **communication_policy** 

- internal_only 

- scientist_only 

- investor_safe 

- public_restricted 

- compliance_review_required 

**enforcement_status** 

- active 

- pending_review 

- restricted 

- blocked 

- deprecated 

## **Mock/Fallback Policy** 

## **Condition Allowed** 

Mock claim-policy rows permitted No Fallback policy execution permitted Limited Investor-visible fallback rules Yes Scientist-visible fallback rules Yes Developer-visible fallback rules Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without experimental validation benchmark_reference Benchmark-comparable evidence only exploratory_research_only Restricted to exploratory research not_for_clinical_use Cannot be used clinically preclinical_candidate Suitable only for preclinical consideration validated_experimental_evidence Supported by experimental evidence 

## **Example Row** 

## **Column Example** 

claim_id CLAIM_001 

artifact_name top_candidates.csv 

module_name qml_reranking 

claim_boundary computational_prediction evidence_level computational 

## **Column Example** 

investor_visible True scientist_visible True developer_visible True wet_lab_required True clinical_restriction research_only regulatory_status validation_required missing_evidence no_in_vivo_validation communication_policy investor_safe 

enforcement_status active failure_reason 

## **report.html / report.pdf** 

## **Artifact Purpose** 

Human-readable final scientific, technical, and investor-facing reports generated from pipeline outputs. Used for candidate review, executive summaries, scientific communication, auditability, and export/sharing workflows. 

## **Artifact Definition** 

**Field Value** Artifact Name report.html / report.pdf Document Path artifacts/reports/report.html / artifacts/reports/report.pdf Backend Collection reports Frontend Target Reports Dashboard → Final Report Viewer Primary Key report_id Row Granularity One report document per pipeline execution Mock/Fallback Rows Allowed Yes Investor Visible Yes (restricted by claim policy) Scientist Visible Yes Developer Visible Yes 

## **Required Metadata Fields** 

|**Column**|**Type**|**Description**|
|---|---|---|
|report_id|string|Unique report identifier|
|report_type|string|Report classification|
|generated_ts|datetime|Report generation timestamp|
|pipeline_run_id|string|Linked pipeline execution|
|target_id|string|Biological target identifier|
|candidate_count|integer|Number of included candidates|
|evidence_level|string|Overall evidence confidence tier|
|claim_boundary|string|Scientific claim restriction|
|report_status|string|Report generation status|
|visibility_scope|string|Allowed audience visibility|
|docking_is_real|boolean|Indicates real docking evidence|
|gnina_executed|boolean|Indicates GNINA execution|



**Column Type Description** 

qm_status string Quantum execution status missing_evidence string Missing scientific validation disclaimer_text string Compliance disclaimer failure_reason string Failure explanation 

## **Optional Metadata Fields** 

|**Column**|**Type**|**Description**|
|---|---|---|
|author|string|Report author/system|
|reviewer|string|Scientific reviewer|
|approval_status|string|Review/approval status|
|approved_by|string|Approver identifier|
|approval_timestamp|datetime|Approval timestamp|
|report_version|string|Report schema version|
|included_artifacts|string|Serialized included artifact list|
|executive_summary|string|Executive summary|
|scientific_summary|string|Scientific summary|
|investor_summary|string|Investor-safe summary|
|report_language|string|Report language|
|generation_backend|string|Rendering backend|
|rendering_runtime_seconds|float|Rendering runtime|
|warning_flags|string|Serialized warning flags|
|fallback_used|boolean|Whether fallback rendering executed|



## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real docking execution 

gnina_executed Indicates GNINA backend execution qm_status Quantum execution status evidence_level Evidence confidence tier claim_boundary Restriction boundary for claims 

**Field** 

**Description** 

missing_evidence Missing scientific validation 

disclaimer_text Compliance disclaimer failure_reason Failure explanation 

## **Allowed Values — Status Columns** 

## **report_type** 

- scientific_report 

- investor_report 

- technical_report 

- compliance_report 

- benchmarking_report 

- exploratory_report 

## **report_status** 

- pending 

- generating 

- completed 

- failed 

- partial_success 

- mock 

- fallback_completed 

## **visibility_scope** 

- developer_only 

- • scientist_only 

- investor_safe 

- internal_only 

- restricted 

## **qm_status** 

- not_started 

- running 

- completed 

- failed 

- mock 

- unavailable 

## **approval_status** 

- pending_review 

- approved 

- rejected 

- restricted 

- auto_generated 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

- wet_lab_validated 

## **Mock/Fallback Policy** 

## **Condition Allowed** 

Mock reports permitted Yes 

Fallback report rendering permitted Yes Investor-visible mock reports No Scientist-visible mock reports Clearly labeled only Developer-visible mock reports Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value** 

## **Meaning** 

hypothesis_only 

computational_prediction benchmark_reference exploratory_research_only not_for_clinical_use 

Computational hypothesis only Prediction without experimental validation Benchmark-comparable evidence Restricted to exploratory research Cannot be used clinically 

**claim_boundary Value** 

**Meaning** 

preclinical_candidate 

Suitable only for preclinical consideration 

validated_experimental_evidence Supported by experimental evidence 

## **Example Metadata Row** 

**Column Example** report_id REPORT_EGFR_001 report_type scientific_report generated_ts 2026-05-22T10:42:00Z pipeline_run_id RUN_EGFR_0001 target_id EGFR candidate_count 25 evidence_level computational claim_boundary computational_prediction report_status completed visibility_scope investor_safe docking_is_real True gnina_executed True qm_status completed 

missing_evidence no_in_vivo_validation disclaimer_text Computational research only. Not for clinical use. failure_reason 

## **module_result.json** 

## **Artifact Purpose** 

Per-module standardized execution result artifact used for orchestration, auditability, debugging, frontend execution tracking, and pipeline reproducibility. 

## **Artifact Definition** 

|**Field**|**Value**|
|---|---|
|Artifact Name|module_result.json|
|Document Path|artifacts/module_result.json|
|Backend Collection|module_runs|
|Frontend Target|Admin Dashboard → Module Execution Viewer|
|Primary Key|run_id|
|Row Granularity|One JSON object per module execution|
|Mock/Fallback Rows Allowed Yes||
|Investor Visible|No|
|Scientist Visible|Partial|
|Developer Visible|Yes|



## **Required Fields** 

|**Field**|**Type**|**Description**|
|---|---|---|
|run_id|string|Unique execution identifier|
|pipeline_run_id|string|Parent pipeline execution identifier|
|module_name|string|Module identifier|
|module_stage|string|Pipeline stage|
|execution_status|string|Final execution state|
|execution_start_ts|datetime|Execution start timestamp|
|execution_end_ts|datetime|Execution completion timestamp|
|runtime_seconds|float|Total runtime|
|outputs_generated|array|Generated artifact list|
|evidence_level|string|Evidence confidence tier|
|docking_is_real|boolean|Real docking execution indicator|
|gnina_executed|boolean|GNINA execution indicator|



**Field Type Description** qm_status string Quantum execution status interaction_backend string Interaction engine/backend interaction_status string Interaction computation status domain_label string Scientific applicability label missing_evidence string Missing scientific validation claim_boundary string Scientific claim restriction failure_reason string Failure explanation 

## **Optional Fields** 

- **Field Type Description** candidate_id string Linked candidate identifier target_id string Biological target identifier report_id string Linked report identifier execution_backend string Actual backend engine backend_version string Backend version input_artifacts array Input artifact paths warning_flags array Warning messages fallback_used boolean Whether fallback logic executed mock_execution boolean Whether execution was simulated retry_count integer Retry attempts memory_usage_mb float Peak memory usage cpu_time_seconds float CPU time consumed gpu_used boolean Whether GPU execution occurred container_id string Execution container identifier provenance_note string Provenance explanation developer_notes string Internal debugging notes 

## **Evidence Status Fields** 

## **Field Description** 

docking_is_real Indicates real docking execution 

## **Field** 

## **Description** 

gnina_executed Indicates GNINA backend execution qm_status Quantum execution status 

interaction_backend Backend used for interaction generation 

interaction_status Interaction computation result evidence_level Evidence confidence tier domain_label Scientific applicability category missing_evidence Missing scientific validation claim_boundary Restriction boundary for claims failure_reason Failure explanation 

## **Allowed Values — Status Columns** 

## **execution_status** 

- pending 

- queued 

- running 

- completed 

- failed 

- skipped 

- partial_success 

- mock 

- fallback_completed 

## **module_stage** 

- ingestion 

- preprocessing 

- docking 

- interaction_analysis 

- gnina_rescoring 

- quantum 

- qml 

- admet 

- applicability_domain 

- • triage 

- reporting 

- compliance 

## **qm_status** 

- not_started 

- running 

- completed 

- failed 

- mock 

- unavailable 

## **interaction_status** 

- pending 

- running 

- completed 

- failed 

- skipped 

- unavailable 

- mock 

## **domain_label** 

- oncology 

- docking 

- quantum 

- qml 

- admet 

- medicinal_chemistry 

- • benchmarking 

- exploratory 

- unsupported 

## **evidence_level** 

- simulated 

- hybrid 

- computational 

- benchmarked 

- experimental_reference 

- wet_lab_validated 

## **Mock/Fallback Policy** 

## **Condition** 

## **Allowed** 

Mock execution rows permitted Yes Fallback execution permitted Yes Investor-visible module results No 

Scientist-visible mock executions Clearly labeled only Developer-visible mock executions Yes 

## **Claim Boundary Rules** 

## **claim_boundary Value** 

## **Meaning** 

hypothesis_only Computational hypothesis only computational_prediction Prediction without experimental validation benchmark_reference Benchmark-comparable evidence exploratory_research_only Restricted to exploratory research not_for_clinical_use Cannot be used clinically preclinical_candidate Suitable only for preclinical consideration 

validated_experimental_evidence Supported by experimental evidence 

## **Example JSON Object** 

{ 

"run_id": "RUN_QDOCK_0001", 

"pipeline_run_id": "PIPELINE_EGFR_001", 

"module_name": "q_dock", 

"module_stage": "docking", 

"execution_status": "completed", 

"execution_start_ts": "2026-05-22T10:12:00Z", 

"execution_end_ts": "2026-05-22T10:12:14Z", 

"runtime_seconds": 14.2, 

"outputs_generated": [ 

"artifacts/docking/results.csv", 

"artifacts/docking/interaction_fingerprints.csv" 

], 

"evidence_level": "computational", 

"docking_is_real": true, 

"gnina_executed": false, 

"qm_status": "not_started", 

"interaction_backend": "prolif", 

"interaction_status": "completed", 

"domain_label": "oncology", 

"missing_evidence": "no_wet_lab_validation", 

"claim_boundary": "computational_prediction", 

"failure_reason": "" 

} 

