export const TIER_ORDER = [
  "student_free",
  "student_pro",
  "academic_researcher",
  "professional_individual",
  "startup_team",
  "cro_service_lab",
  "industry_biotech",
  "enterprise_pharma",
  "private_deployment",
];

export const TIERS = {
  student_free: {
    label: "Student Free",
    audience: "Guided learning and low-cost hypothesis review",
    maxProteins: 3,
    maxCandidates: 6,
    depth: "quick_preview",
    tone: "sky",
    needs: ["Guided forms", "Small target set", "Cached public candidate review", "Dry-run modules"],
  },
  student_pro: {
    label: "Student Pro",
    audience: "Thesis projects and supervised student discovery",
    maxProteins: 6,
    maxCandidates: 12,
    depth: "standard_screen",
    tone: "aqua",
    needs: ["Variant-aware intake", "Docking preview", "Basic report export", "Single-user workspace"],
  },
  academic_researcher: {
    label: "Academic Researcher",
    audience: "PI labs, research students, and translational teams",
    maxProteins: 10,
    maxCandidates: 20,
    depth: "standard_screen",
    tone: "forest",
    needs: ["Cohort context", "AlphaFold target boards", "Reproducible evidence", "Small-team collaboration"],
  },
  professional_individual: {
    label: "Professional Individual",
    audience: "Consultants, clinicians in research mode, and domain experts",
    maxProteins: 12,
    maxCandidates: 24,
    depth: "deep_screen",
    tone: "gold",
    needs: ["Case dossier", "Priority queues", "Safety and ADMET guardrails", "Exportable evidence pack"],
  },
  startup_team: {
    label: "Startup Team",
    audience: "Lean biotech teams validating a discovery thesis",
    maxProteins: 16,
    maxCandidates: 32,
    depth: "deep_screen",
    tone: "coral",
    needs: ["Team workspace", "Higher throughput", "Quantum rerank", "Portfolio triage"],
  },
  cro_service_lab: {
    label: "CRO / Service Lab",
    audience: "Service labs preparing client-ready candidate packs",
    maxProteins: 20,
    maxCandidates: 40,
    depth: "wet_lab_pack",
    tone: "lab",
    needs: ["Client workspaces", "Wet-lab handoff", "Assay triage", "Audit-friendly reporting"],
  },
  industry_biotech: {
    label: "Industry / Biotech",
    audience: "Biotech and pharma discovery programs",
    maxProteins: 28,
    maxCandidates: 60,
    depth: "wet_lab_pack",
    tone: "bio",
    needs: ["Org workspace", "Contract compute", "GNINA/QM depth", "Pipeline operations"],
  },
  enterprise_pharma: {
    label: "Enterprise Pharma",
    audience: "Large-scale discovery organizations",
    maxProteins: 40,
    maxCandidates: 100,
    depth: "enterprise_screen",
    tone: "platinum",
    needs: ["SSO/RBAC", "Dedicated queues", "Governed reports", "Portfolio-scale review"],
  },
  private_deployment: {
    label: "Private Deployment",
    audience: "Customer-controlled VPC and private data environments",
    maxProteins: 80,
    maxCandidates: 160,
    depth: "private_screen",
    tone: "private",
    needs: ["Private deployment", "Customer-controlled data", "Dedicated audit", "Custom AlphaFold mirror"],
  },
};

export const DEFAULT_PATIENT = {
  caseId: "DEID-CASE-001",
  diagnosis: "non_small_cell_lung_cancer",
  stage: "Stage IV research context",
  specimen: "Tumor biopsy, de-identified",
  variants: "EGFR L858R, TP53 R273H",
  expression: "EGFR high, ERBB3 moderate, MET low",
  proteomics: "EGFR phospho-signal elevated; MAPK pathway active",
  priorTherapies: "No identifiable treatment history stored in this demo",
  constraints: "Avoid strong CYP3A4 liabilities; prioritize brain-penetrance review",
  notes: "Research-only computational hypothesis generation. No therapeutic claim.",
};

export const DIAGNOSES = [
  {
    id: "non_small_cell_lung_cancer",
    label: "Non-small cell lung cancer",
    short: "NSCLC",
    biology: "EGFR, ALK, ROS1, MET, KRAS, and MAPK pathway-driven target review.",
  },
  {
    id: "breast_cancer",
    label: "Breast cancer",
    short: "Breast",
    biology: "HER2, estrogen receptor, PI3K, AKT, and homologous recombination context.",
  },
  {
    id: "ovarian_cancer",
    label: "Ovarian cancer",
    short: "Ovarian",
    biology: "PARP, BRCA, TP53, cell-cycle stress, and DNA repair vulnerability review.",
  },
  {
    id: "colorectal_cancer",
    label: "Colorectal cancer",
    short: "CRC",
    biology: "KRAS, NRAS, BRAF, EGFR, APC, WNT, and MAPK pathway stratification.",
  },
  {
    id: "melanoma",
    label: "Melanoma",
    short: "Melanoma",
    biology: "BRAF, NRAS, KIT, PTEN, and cell-cycle pathway target review.",
  },
  {
    id: "acute_myeloid_leukemia",
    label: "Acute myeloid leukemia",
    short: "AML",
    biology: "FLT3, IDH1/2, NPM1, BCL2, and hematologic dependency mapping.",
  },
  {
    id: "glioblastoma",
    label: "Glioblastoma",
    short: "GBM",
    biology: "EGFR, IDH1, PDGFRA, PTEN, MGMT, TERT, and CNS delivery constraints.",
  },
  {
    id: "pancreatic_cancer",
    label: "Pancreatic cancer",
    short: "PDAC",
    biology: "KRAS, SMAD4, CDKN2A, TP53, DNA repair, and stromal biology context.",
  },
  {
    id: "prostate_cancer",
    label: "Prostate cancer",
    short: "Prostate",
    biology: "AR signaling, PTEN/PI3K, DNA repair, PARP, and fusion context.",
  },
];

const roles = {
  driver: "Driver mutation or primary oncogenic dependency",
  repair: "DNA repair and replication stress dependency",
  pathway: "Pathway signaling and resistance biology",
  suppressor: "Tumor suppressor or risk-context marker",
  immune: "Immune or microenvironment-adjacent target context",
};

export const ALPHAFOLD_REPOSITORY = [
  protein("non_small_cell_lung_cancer", "EGFR", "P00533", "AF-P00533-F1", 92, roles.driver, "Kinase receptor", ["L858R", "exon 19 del", "T790M"]),
  protein("non_small_cell_lung_cancer", "ALK", "Q9UM73", "AF-Q9UM73-F1", 88, roles.driver, "Kinase fusion", ["EML4-ALK"]),
  protein("non_small_cell_lung_cancer", "ROS1", "P08922", "AF-P08922-F1", 85, roles.driver, "Kinase fusion", ["CD74-ROS1"]),
  protein("non_small_cell_lung_cancer", "MET", "P08581", "AF-P08581-F1", 91, roles.pathway, "RTK bypass", ["MET exon 14"]),
  protein("non_small_cell_lung_cancer", "BRAF", "P15056", "AF-P15056-F1", 94, roles.pathway, "MAPK pathway", ["V600E"]),
  protein("non_small_cell_lung_cancer", "KRAS", "P01116", "AF-P01116-F1", 86, roles.driver, "RAS GTPase", ["G12C", "G12D"]),
  protein("breast_cancer", "ERBB2", "P04626", "AF-P04626-F1", 90, roles.driver, "HER2 receptor", ["amplification", "S310F"]),
  protein("breast_cancer", "PIK3CA", "P42336", "AF-P42336-F1", 89, roles.pathway, "PI3K catalytic subunit", ["H1047R", "E545K"]),
  protein("breast_cancer", "ESR1", "P03372", "AF-P03372-F1", 93, roles.driver, "Nuclear hormone receptor", ["Y537S", "D538G"]),
  protein("breast_cancer", "BRCA1", "P38398", "AF-P38398-F1", 76, roles.repair, "Homologous recombination", ["loss of function"]),
  protein("breast_cancer", "BRCA2", "P51587", "AF-P51587-F1", 74, roles.repair, "Homologous recombination", ["loss of function"]),
  protein("breast_cancer", "AKT1", "P31749", "AF-P31749-F1", 95, roles.pathway, "PI3K/AKT signaling", ["E17K"]),
  protein("ovarian_cancer", "PARP1", "P09874", "AF-P09874-F1", 93, roles.repair, "Single-strand break repair", ["BRCA-context"]),
  protein("ovarian_cancer", "BRCA1", "P38398", "AF-P38398-F1", 76, roles.repair, "Homologous recombination", ["loss of function"]),
  protein("ovarian_cancer", "BRCA2", "P51587", "AF-P51587-F1", 74, roles.repair, "Homologous recombination", ["loss of function"]),
  protein("ovarian_cancer", "CCNE1", "P24864", "AF-P24864-F1", 87, roles.pathway, "Cell-cycle amplification", ["amplification"]),
  protein("ovarian_cancer", "TP53", "P04637", "AF-P04637-F1", 79, roles.suppressor, "Genome integrity marker", ["missense", "truncation"]),
  protein("ovarian_cancer", "RAD51", "Q06609", "AF-Q06609-F1", 88, roles.repair, "DNA strand exchange", ["HRD context"]),
  protein("colorectal_cancer", "KRAS", "P01116", "AF-P01116-F1", 86, roles.driver, "RAS GTPase", ["G12D", "G13D"]),
  protein("colorectal_cancer", "NRAS", "P01111", "AF-P01111-F1", 86, roles.driver, "RAS GTPase", ["Q61K"]),
  protein("colorectal_cancer", "BRAF", "P15056", "AF-P15056-F1", 94, roles.driver, "MAPK pathway", ["V600E"]),
  protein("colorectal_cancer", "EGFR", "P00533", "AF-P00533-F1", 92, roles.pathway, "RTK signaling", ["wild-type RAS context"]),
  protein("colorectal_cancer", "APC", "P25054", "AF-P25054-F1", 71, roles.suppressor, "WNT pathway marker", ["truncation"]),
  protein("colorectal_cancer", "TP53", "P04637", "AF-P04637-F1", 79, roles.suppressor, "Genome integrity marker", ["missense"]),
  protein("melanoma", "BRAF", "P15056", "AF-P15056-F1", 94, roles.driver, "MAPK pathway", ["V600E", "V600K"]),
  protein("melanoma", "NRAS", "P01111", "AF-P01111-F1", 86, roles.driver, "RAS GTPase", ["Q61R"]),
  protein("melanoma", "KIT", "P10721", "AF-P10721-F1", 90, roles.driver, "Kinase receptor", ["L576P"]),
  protein("melanoma", "PTEN", "P60484", "AF-P60484-F1", 91, roles.suppressor, "PI3K brake", ["loss"]),
  protein("melanoma", "CDKN2A", "P42771", "AF-P42771-F1", 83, roles.suppressor, "Cell-cycle checkpoint", ["loss"]),
  protein("acute_myeloid_leukemia", "FLT3", "P36888", "AF-P36888-F1", 89, roles.driver, "Kinase receptor", ["ITD", "TKD"]),
  protein("acute_myeloid_leukemia", "IDH1", "O75874", "AF-O75874-F1", 94, roles.driver, "Metabolic enzyme", ["R132H"]),
  protein("acute_myeloid_leukemia", "IDH2", "P48735", "AF-P48735-F1", 94, roles.driver, "Metabolic enzyme", ["R140Q", "R172K"]),
  protein("acute_myeloid_leukemia", "NPM1", "P06748", "AF-P06748-F1", 82, roles.pathway, "Nucleolar protein", ["frameshift"]),
  protein("acute_myeloid_leukemia", "BCL2", "P10415", "AF-P10415-F1", 88, roles.pathway, "Apoptosis dependency", ["expression high"]),
  protein("acute_myeloid_leukemia", "KIT", "P10721", "AF-P10721-F1", 90, roles.driver, "Kinase receptor", ["D816V"]),
  protein("glioblastoma", "EGFR", "P00533", "AF-P00533-F1", 92, roles.driver, "RTK signaling", ["EGFRvIII"]),
  protein("glioblastoma", "IDH1", "O75874", "AF-O75874-F1", 94, roles.driver, "Metabolic enzyme", ["R132H"]),
  protein("glioblastoma", "PDGFRA", "P16234", "AF-P16234-F1", 89, roles.driver, "Kinase receptor", ["amplification"]),
  protein("glioblastoma", "PTEN", "P60484", "AF-P60484-F1", 91, roles.suppressor, "PI3K brake", ["loss"]),
  protein("glioblastoma", "MGMT", "P16455", "AF-P16455-F1", 87, roles.repair, "DNA repair marker", ["promoter methylation"]),
  protein("glioblastoma", "TERT", "O14746", "AF-O14746-F1", 78, roles.pathway, "Telomerase", ["promoter mutation"]),
  protein("pancreatic_cancer", "KRAS", "P01116", "AF-P01116-F1", 86, roles.driver, "RAS GTPase", ["G12D", "G12V"]),
  protein("pancreatic_cancer", "SMAD4", "Q13485", "AF-Q13485-F1", 82, roles.suppressor, "TGF-beta pathway", ["loss"]),
  protein("pancreatic_cancer", "CDKN2A", "P42771", "AF-P42771-F1", 83, roles.suppressor, "Cell-cycle checkpoint", ["loss"]),
  protein("pancreatic_cancer", "TP53", "P04637", "AF-P04637-F1", 79, roles.suppressor, "Genome integrity marker", ["missense"]),
  protein("pancreatic_cancer", "BRCA2", "P51587", "AF-P51587-F1", 74, roles.repair, "Homologous recombination", ["loss of function"]),
  protein("pancreatic_cancer", "ERBB2", "P04626", "AF-P04626-F1", 90, roles.pathway, "HER2 receptor", ["amplification"]),
  protein("prostate_cancer", "AR", "P10275", "AF-P10275-F1", 91, roles.driver, "Androgen receptor", ["amplification", "T878A"]),
  protein("prostate_cancer", "PTEN", "P60484", "AF-P60484-F1", 91, roles.suppressor, "PI3K brake", ["loss"]),
  protein("prostate_cancer", "BRCA2", "P51587", "AF-P51587-F1", 74, roles.repair, "Homologous recombination", ["loss of function"]),
  protein("prostate_cancer", "PARP1", "P09874", "AF-P09874-F1", 93, roles.repair, "Single-strand break repair", ["HRD context"]),
  protein("prostate_cancer", "AKT1", "P31749", "AF-P31749-F1", 95, roles.pathway, "PI3K/AKT signaling", ["E17K"]),
  protein("prostate_cancer", "TMPRSS2", "O15393", "AF-O15393-F1", 86, roles.pathway, "Fusion partner context", ["ERG fusion"]),
];

export const PIPELINE_STAGES = [
  stage(
    "intake",
    "De-identify and validate intake",
    "Checks diagnosis, variants, expression, proteins, constraints, and research consent.",
    "A drug-discovery model is only as trustworthy as the biological context it receives.",
    ["Diagnosis", "Genomic variants", "Protein expression", "Proteomics", "Research constraints"],
    ["Validated case context", "Missing-data warnings", "De-identification note"],
    ["No direct identifiers", "Diagnosis selected", "At least one molecular signal"],
    "No clinical recommendation is produced; uncertain or missing context is carried forward as a limitation.",
  ),
  stage(
    "map",
    "Map diagnosis to target biology",
    "Matches diagnosis and molecular features to disease-specific target hypotheses.",
    "Researchers need to know why a protein is being investigated before trusting a candidate rank.",
    ["Cancer diagnosis", "Variants", "Expression/proteomics", "Pathway rules"],
    ["Target hypotheses", "Driver/resistance annotations", "Pathway rationale"],
    ["Variant-to-target consistency", "Contradictory signal flags", "Diagnosis-specific target set"],
    "Targets are hypotheses, not proof of disease causality for an individual patient.",
  ),
  stage(
    "alphafold",
    "Prepare AlphaFold receptor set",
    "Builds a receptor panel from selected AlphaFold entries and confidence metadata.",
    "Structure quality determines whether docking geometry is meaningful or only exploratory.",
    ["Selected AlphaFold IDs", "UniProt IDs", "pLDDT confidence", "Known pocket or co-crystal context"],
    ["Prepared receptor list", "Structure confidence labels", "Pocket-source decision"],
    ["Confidence threshold", "Pocket provenance", "Fallback disclosure"],
    "AlphaFold structures can be unsuitable for some pockets; curated co-crystal anchors are preferred when available.",
  ),
  stage(
    "target",
    "Target intelligence",
    "Ranks proteins by role, variants, pathway fit, and structure readiness.",
    "Target prioritization prevents expensive screening against proteins with weak biological rationale.",
    ["Target role", "Patient molecular fit", "Structure readiness", "Disease literature context"],
    ["Ranked target board", "Target risk notes", "Assay planning cues"],
    ["Biology score", "Structure score", "Mutation/expression alignment"],
    "A high target score only means a better computational hypothesis, not clinical actionability.",
  ),
  stage(
    "generate",
    "Generate or retrieve candidates",
    "Pulls existing candidates and plans molecule generation for selected targets.",
    "Candidate pools must be traceable so researchers can see whether molecules came from seeds, analogues, or generation.",
    ["Target set", "Known actives", "Generation constraints", "Chemistry filters"],
    ["Candidate library", "Parent/source labels", "Structure files"],
    ["Duplicate filtering", "Chemistry validity", "PAINS/Brenk preliminary screen"],
    "Generated molecules require synthesis feasibility and expert medicinal chemistry review.",
  ),
  stage(
    "screen",
    "Docking, GNINA, and ADMET screen",
    "Scores poses, CNN affinity, liabilities, and development constraints.",
    "Docking explains possible binding geometry, while ADMET helps avoid attractive but unsafe molecules.",
    ["Receptor/pocket", "Ligand conformers", "Docking grid", "ADMET models"],
    ["Pose scores", "CNN pose scores", "Toxicity and property flags"],
    ["Pocket provenance", "Pose availability", "Descriptor limits", "Toxicity proxy caveats"],
    "Docking and ADMET are computational filters; experimental binding and safety data are required.",
  ),
  stage(
    "quantum",
    "Quantum rerank",
    "Uses Qiskit/xTB-style evidence layers where the selected tier allows it.",
    "Quantum/QM descriptors provide an independent lens on electronic properties and ranking robustness.",
    ["Candidate descriptors", "xTB/QM rows", "Kernel scores", "Ablation baseline"],
    ["Quantum prefilter score", "Orbital descriptors", "QML rerank", "Ablation delta"],
    ["Quantum contribution visible", "Fallback disclosed", "Score without quantum"],
    "Quantum contribution can be negative; the UI must show when it helps or hurts the rank.",
  ),
  stage(
    "safety",
    "Human protein safety simulation",
    "Counter-screens top molecules against human protein liability panels and pathway effect hypotheses.",
    "Researchers need early off-target and side-effect hypotheses before choosing wet-lab experiments.",
    ["Top candidates", "Human safety proteins", "ADMET/toxicity proxies", "Physicochemical descriptors"],
    ["Off-target risk panel", "Potential side-effect hypotheses", "Assay recommendations"],
    ["hERG/CYP/neuroendocrine flags", "Toxicity proxy source", "Assay handoff list"],
    "This is a computational liability simulation, not human efficacy or clinical safety prediction.",
  ),
  stage(
    "dossier",
    "Candidate dossier and export",
    "Creates top-candidate evidence cards with limitations and wet-lab handoff notes.",
    "The output must be portable into lab notebooks, review meetings, and downstream analysis tools.",
    ["Ranked candidates", "Process trace", "Safety panel", "Artifacts", "Export preferences"],
    ["JSON/CSV/Markdown", "Assay handoff", "Evidence limitations", "Downloadable artifacts"],
    ["Every score has provenance", "Research-use disclaimer", "Missing evidence listed"],
    "No dossier should hide uncertainty; missing evidence is part of the result.",
  ),
];

export const HUMAN_SAFETY_PANEL = [
  safetyProtein("KCNH2", "hERG potassium channel", "Cardiac repolarization", "QT prolongation / arrhythmia liability", ["high LogP", "basic aromatic", "toxicity proxy"]),
  safetyProtein("SCN5A", "Cardiac sodium channel Nav1.5", "Cardiac conduction", "Conduction disturbance liability", ["high molecular weight", "lipophilicity"]),
  safetyProtein("CYP3A4", "Cytochrome P450 3A4", "Drug metabolism", "Drug-drug interaction and clearance risk", ["LogP", "aromatic rings", "MW"]),
  safetyProtein("CYP2D6", "Cytochrome P450 2D6", "Drug metabolism", "Drug-drug interaction risk", ["basic amines", "aromatic rings"]),
  safetyProtein("CYP2C9", "Cytochrome P450 2C9", "Drug metabolism", "Clearance and interaction risk", ["acidic groups", "LogP"]),
  safetyProtein("ABCB1", "P-glycoprotein transporter", "Efflux / blood-brain barrier", "Poor exposure or CNS penetration uncertainty", ["TPSA", "MW", "RotBonds"]),
  safetyProtein("ACHE", "Acetylcholinesterase", "Cholinergic signaling", "Neurologic/cholinergic off-target concern", ["aromatic cation", "toxicity proxy"]),
  safetyProtein("DRD2", "Dopamine receptor D2", "Neuropsychiatric signaling", "CNS side-effect hypothesis", ["LogP", "basic aromatic"]),
  safetyProtein("HTR2A", "Serotonin receptor 2A", "Neurovascular signaling", "CNS/vascular side-effect hypothesis", ["aromatic rings", "LogP"]),
  safetyProtein("ESR1", "Estrogen receptor alpha", "Endocrine signaling", "Endocrine disruption hypothesis", ["tox21 ER probability", "aromatic rings"]),
  safetyProtein("AR", "Androgen receptor", "Endocrine signaling", "Androgenic/antiandrogenic liability hypothesis", ["tox21 AR probability"]),
  safetyProtein("PPARG", "PPAR-gamma", "Metabolic nuclear receptor", "Metabolic side-effect hypothesis", ["tox21 PPAR probability", "LogP"]),
  safetyProtein("TP53_PATHWAY", "p53 stress pathway", "Genotoxic stress response", "DNA damage/stress signal hypothesis", ["tox21 p53", "ATAD5"]),
  safetyProtein("MMP_PANEL", "Mitochondrial membrane potential panel", "Mitochondrial toxicity", "Mitochondrial liability hypothesis", ["tox21 MMP", "LogP"]),
];

export const EXPORT_PRESETS = [
  {
    id: "json",
    label: "Full JSON dossier",
    extension: "json",
    description: "Best for programmatic analysis, downstream notebooks, and audit storage.",
  },
  {
    id: "csv",
    label: "Candidate CSV",
    extension: "csv",
    description: "Best for spreadsheet review, ranking comparison, and quick lab meeting tables.",
  },
  {
    id: "markdown",
    label: "Scientific memo",
    extension: "md",
    description: "Best for PI review, collaboration notes, and narrative limitations.",
  },
  {
    id: "assay",
    label: "Assay handoff plan",
    extension: "md",
    description: "Best for wet-lab validation planning and CRO communication.",
  },
  {
    id: "safety",
    label: "Safety simulation matrix",
    extension: "csv",
    description: "Best for side-effect/off-target triage and counter-screen planning.",
  },
];

export const ELEMENTS = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og"
  .split(" ");

export const ORGANIC_STARTERS = [
  starter("benzene", "c1ccccc1", "Aromatic core", "Useful for kinase hinge binders and SAR exploration."),
  starter("pyridine", "c1ccncc1", "Heteroaromatic core", "Adds H-bond acceptor and polarity to aromatic designs."),
  starter("indole", "c1ccc2[nH]ccc2c1", "Privileged scaffold", "Common in bioactive molecules and fragment expansion."),
  starter("quinazoline", "c1ccc2ncncc2c1", "Kinase-like hinge scaffold", "Common EGFR-like inhibitor motif."),
  starter("morpholine", "O1CCNCC1", "Solubilizing ring", "Improves polarity and can tune PK liabilities."),
  starter("piperazine", "N1CCNCC1", "Basic linker", "Useful linker but can raise off-target/CYP concerns."),
  starter("amide linker", "C(=O)N", "Linker motif", "Adds directional H-bonding and synthetic tractability."),
  starter("sulfonamide", "S(=O)(=O)N", "Polar linker", "Can improve potency and alter solubility."),
  starter("urea", "NC(=O)N", "H-bonding linker", "Often used to bridge aromatic pharmacophores."),
  starter("triazole", "c1nncn1", "Bioisostere", "Useful for click-like linker exploration and polarity."),
  starter("cyclopropyl", "C1CC1", "Compact lipophile", "Can tune conformation and metabolic stability."),
  starter("tert-butyl", "C(C)(C)C", "Hydrophobic cap", "Potency cap but may increase LogP."),
];

export const INORGANIC_STARTERS = [
  starter("boronic acid", "B(O)O", "Boron warhead", "Protease/covalent chemistry hypothesis; requires safety review."),
  starter("phosphate", "OP(=O)(O)O", "Phosphate prodrug motif", "Solubility/prodrug concept with formulation constraints."),
  starter("zinc-binding hydroxamate", "C(=O)NO", "Metal-binding motif", "Useful for metalloproteins but broad off-target risk."),
  starter("silane isostere", "[SiH3]", "Silicon bioisostere", "Exploratory replacement to tune lipophilicity."),
  starter("ferrocene handle", "[Fe]", "Organometallic motif", "Research-only organometallic exploration."),
  starter("magnesium salt", "[Mg+2]", "Salt/counterion", "Formulation and coordination context."),
  starter("platinum center", "[Pt]", "Coordination complex", "Cytotoxic complex exploration; high safety concern."),
  starter("fluorinated cap", "F", "Halogen tuning", "Blocks metabolism and changes binding/polarity."),
  starter("chlorinated cap", "Cl", "Halogen tuning", "Hydrophobic pocket and metabolic tuning."),
  starter("iodinated probe", "I", "Heavy halogen probe", "Imaging/probe concept; high MW and liability review."),
];

export const RESEARCH_TOOLKIT = [
  tool("target-dossier", "Target Dossier Builder", "Summarize biology, AlphaFold structure, variants, pathway role, and assay ideas."),
  tool("asset-library", "Pharma Asset Library", "Browse downloaded AlphaFold receptors, PAE metadata, ChEMBL ligands, SDF files, and structure images."),
  tool("resource-registry", "Research Source Registry", "Track core databases, ML/QM models, local availability, licenses, and pharma-readiness gaps."),
  tool("data-fabric", "Realtime Data Fabric", "Pull ChEMBL, PubChem, UniProt, Open Targets, RDKit, and model-hook evidence for current proteins and ligands."),
  tool("docking-stack", "Docking Stack Runner", "Prepare GNINA CNN, AutoDock Vina, Smina, OpenBabel, receptor, box, and pose-source checks."),
  tool("literature", "Literature Query Planner", "Prepare PubMed/ChEMBL/PubChem/AlphaFold lookups with reproducible search strings."),
  tool("sar", "SAR Matrix", "Compare ranked molecules by substituent, score deltas, ADMET, and quantum contribution."),
  tool("counter-screen", "Counter-Screen Planner", "Suggest off-target panels and safety assays from the simulation bench."),
  tool("assay", "Wet-Lab Assay Planner", "Create biochemical, cellular, selectivity, ADME, and toxicity validation plans."),
  tool("formulation", "Developability Review", "Flag solubility, permeability, molecular weight, TPSA, lipophilicity, and alerts."),
  tool("eln", "ELN Notes", "Capture assumptions, decisions, evidence gaps, and next experiments."),
  tool("compare", "Candidate Comparator", "Compare two or more molecules across evidence layers and export the matrix."),
  tool("regulatory", "Claim Boundary Checker", "Keep language research-only and prevent therapeutic or clinical claims."),
];

export const INSILICO_MODULES = [
  workflowModule("target-prep", "Target preparation", "AlphaFold/PDB receptor review, isoform checks, mutation mapping, pocket provenance, cofactors, waters, protonation assumptions.", "Structure preparation and pocket registry"),
  workflowModule("library-curation", "Ligand library curation", "SMILES normalization, salts/tautomers, PAINS/Brenk alerts, stereochemistry, duplicate removal, scaffold grouping.", "RDKit + public chemistry data"),
  workflowModule("conformer-docking", "Conformer and docking", "3D conformers, pocket-aligned previews, Vina/Smina/GNINA-ready artifacts, redocking validation when co-crystal anchors exist.", "Chemistry Bench + Q-Dock Studio"),
  workflowModule("interaction-fingerprints", "Interaction fingerprints", "Hydrogen bonds, hydrophobic contacts, salt bridges, pi-stacking, conserved residue interactions, pose clustering.", "Pose analysis module"),
  workflowModule("physics-refinement", "Physics refinement", "MD stability, MM/GBSA-style summaries, FEP planning, solvent exposure, strain checks, uncertainty flags.", "MD/FEP planning layer"),
  workflowModule("admet-tox", "ADMET and toxicity", "QED, LogP, TPSA, CYP/hERG/endocrine liabilities, transporters, solubility, permeability, reactive alerts.", "ADMET + safety bench"),
  workflowModule("quantum-qm", "Quantum/QM review", "HOMO/LUMO, dipole, charge distribution, electrophile/nucleophile pressure, orbital contribution to rerank.", "Q-orbital analyzer"),
  workflowModule("sar-decision", "SAR and decision science", "Scaffold series, substituent deltas, ablations, uncertainty, evidence-quality multiplier, assay prioritization.", "SAR matrix + Q-rank"),
  workflowModule("assay-handoff", "Assay handoff", "Biochemical, cellular, selectivity, ADME, tox counter-screens, controls, acceptance criteria, exportable dossiers.", "Research Tools exports"),
];

export const PHARMA_ASSET_LIBRARY = {
  generatedAt: "2026-06-21",
  sources: [
    "AlphaFold Database receptor mmCIF, metadata, and PAE JSON",
    "ChEMBL molecule SDF and SVG structure assets",
    "Local QuDrugForge oncology benchmark, ADMET, docking, QM, and safety modules",
  ],
  sourceNotices: [
    "Review AlphaFold Database terms before production or client redistribution.",
    "Review ChEMBL licensing terms before production or client redistribution.",
    "Computational assets are research planning inputs, not clinical evidence.",
  ],
  receptors: [
    receptorAsset("EGFR", "P00533", "AF-P00533-F1", "NSCLC, CRC, GBM", "Kinase receptor"),
    receptorAsset("ROS1", "P08922", "AF-P08922-F1", "NSCLC", "Kinase fusion"),
    receptorAsset("KRAS", "P01116", "AF-P01116-F1", "NSCLC, CRC, PDAC", "RAS GTPase"),
    receptorAsset("BRAF", "P15056", "AF-P15056-F1", "Melanoma, CRC, NSCLC", "MAPK kinase pathway"),
    receptorAsset("MET", "P08581", "AF-P08581-F1", "NSCLC", "RTK bypass resistance"),
    receptorAsset("ERBB2", "P04626", "AF-P04626-F1", "Breast, PDAC", "HER2 receptor"),
    receptorAsset("PIK3CA", "P42336", "AF-P42336-F1", "Breast, prostate", "PI3K catalytic subunit"),
    receptorAsset("PARP1", "P09874", "AF-P09874-F1", "Ovarian, prostate", "DNA repair enzyme"),
    receptorAsset("FLT3", "P36888", "AF-P36888-F1", "AML", "Kinase receptor"),
    receptorAsset("IDH1", "O75874", "AF-O75874-F1", "AML, GBM", "Metabolic enzyme"),
    receptorAsset("AR", "P10275", "AF-P10275-F1", "Prostate", "Nuclear hormone receptor"),
    receptorAsset("BCL2", "P10415", "AF-P10415-F1", "AML", "Apoptosis dependency"),
    receptorAsset("ALK", "Q9UM73", "AF-Q9UM73-F1", "NSCLC", "Kinase fusion"),
    receptorAsset("TP53", "P04637", "AF-P04637-F1", "Pan-cancer", "Genome integrity marker"),
  ],
  ligands: [
    ligandAsset("Osimertinib", "CHEMBL3545063", "EGFR", "NSCLC mutant EGFR reference"),
    ligandAsset("Erlotinib", "CHEMBL1079742", "EGFR", "EGFR kinase inhibitor comparator"),
    ligandAsset("Gefitinib", "CHEMBL939", "EGFR", "EGFR kinase inhibitor comparator"),
    ligandAsset("Crizotinib", "CHEMBL601719", "ALK/MET/ROS1", "Kinase fusion reference ligand"),
    ligandAsset("Alectinib", "CHEMBL1738797", "ALK", "ALK inhibitor reference ligand"),
    ligandAsset("Lapatinib", "CHEMBL554", "ERBB2/EGFR", "HER2/EGFR kinase comparator for breast programs"),
    ligandAsset("Neratinib", "CHEMBL3989921", "ERBB2", "HER2 covalent inhibitor reference ligand"),
    ligandAsset("Tucatinib", "CHEMBL3989868", "ERBB2", "HER2-selective inhibitor reference ligand"),
    ligandAsset("Olaparib", "CHEMBL521686", "PARP1", "PARP inhibitor reference ligand"),
    ligandAsset("Rucaparib", "CHEMBL1173055", "PARP1", "PARP inhibitor comparator"),
    ligandAsset("Niraparib", "CHEMBL1094636", "PARP1", "PARP inhibitor comparator"),
    ligandAsset("Trametinib", "CHEMBL2103875", "MEK/MAPK", "MAPK pathway comparator"),
    ligandAsset("Vemurafenib", "CHEMBL1229517", "BRAF", "BRAF V600E reference ligand"),
    ligandAsset("Imatinib", "CHEMBL941", "ABL/KIT/PDGFRA", "Kinase inhibitor benchmark"),
    ligandAsset("Venetoclax", "CHEMBL3137309", "BCL2", "BCL2 inhibitor reference ligand"),
    ligandAsset("Palbociclib", "CHEMBL2364621", "CDK4/6", "Cell-cycle inhibitor comparator"),
    ligandAsset("Alpelisib", "CHEMBL2396661", "PIK3CA", "PI3K alpha inhibitor reference"),
    ligandAsset("Tamoxifen", "CHEMBL83", "ESR1", "Estrogen receptor modulator comparator"),
    ligandAsset("Fulvestrant", "CHEMBL4760678", "ESR1", "Estrogen receptor degrader comparator"),
    ligandAsset("Elacestrant", "CHEMBL4594273", "ESR1", "Oral SERD comparator for ESR1 programs"),
    ligandAsset("Enzalutamide", "CHEMBL1082407", "AR", "Androgen receptor antagonist comparator"),
  ],
};

function protein(diagnosisId, gene, uniprot, alphafoldId, confidence, role, family, variants) {
  return {
    id: `${diagnosisId}_${gene}`,
    diagnosisId,
    gene,
    uniprot,
    alphafoldId,
    confidence,
    role,
    family,
    variants,
    url: `https://alphafold.ebi.ac.uk/entry/${uniprot}`,
  };
}

function stage(id, label, detail, why, inputs, outputs, trustChecks, limitation) {
  return { id, label, detail, why, inputs, outputs, trustChecks, limitation };
}

function safetyProtein(gene, name, system, concern, drivers) {
  return { gene, name, system, concern, drivers };
}

function starter(name, smiles, type, note) {
  return { name, smiles, type, note };
}

function tool(id, name, purpose) {
  return { id, name, purpose };
}

function workflowModule(id, name, purpose, evidence) {
  return { id, name, purpose, evidence };
}

function receptorAsset(gene, uniprot, alphafoldId, program, role) {
  const base = `/pharma-library/receptors/alphafold/${alphafoldId}`;
  return {
    gene,
    uniprot,
    alphafoldId,
    program,
    role,
    cif: `${base}-model_v6.cif`,
    pae: `${base}-predicted_aligned_error_v6.json`,
    metadata: `${base}-metadata.json`,
  };
}

function ligandAsset(name, chemblId, target, purpose) {
  const slug = name.toLowerCase().replaceAll(" ", "-");
  return {
    name,
    chemblId,
    target,
    purpose,
    sdf: `/pharma-library/ligands/chembl/sdf/${chemblId}-${slug}.sdf`,
    image: `/pharma-library/ligands/chembl/svg/${chemblId}-${slug}.svg`,
    search: `/pharma-library/ligands/chembl/search/${slug}.json`,
  };
}
