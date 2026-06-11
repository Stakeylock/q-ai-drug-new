"""Input classifier: Detect upload types and recommend modules.

This service examines uploaded files and detects their types, then
recommends relevant modules the scientist can run.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import pandas as pd
from rdkit import Chem


UploadClassification = Literal[
    "smiles_csv",
    "sdf_library", 
    "protein_structure_pdb",
    "protein_structure_mmcif",
    "pocket_yaml",
    "assay_csv",
    "admet_csv",
    "known_inhibitors_csv",
    "candidate_scores_csv",
    "unknown",
]


@dataclass
class UploadInfo:
    """Information about an uploaded file."""
    file_name: str
    file_path: Path
    classification: UploadClassification
    row_count: int | None = None
    column_count: int | None = None
    size_bytes: int | None = None
    sample_content: str | None = None
    recommended_modules: list[str] | None = None
    error: str | None = None


def classify_upload(file_path: Path) -> UploadInfo:
    """Classify an uploaded file and recommend modules.
    
    Args:
        file_path: Path to uploaded file
        
    Returns:
        UploadInfo with classification and recommendations
    """
    if not file_path.exists():
        return UploadInfo(
            file_name=file_path.name,
            file_path=file_path,
            classification="unknown",
            error=f"File not found: {file_path}",
        )
    
    file_size = file_path.stat().st_size
    suffix = file_path.suffix.lower()
    name = file_path.name.lower()
    
    # Try to classify by extension and content
    try:
        # ====== CSV Files ======
        if suffix == ".csv":
            df = pd.read_csv(file_path, nrows=10)
            columns_lower = [c.lower() for c in df.columns]
            row_count = len(pd.read_csv(file_path))
            
            # SMILES CSV
            if any(c in columns_lower for c in ["smiles", "smi", "canonical_smiles", "mol_smiles"]):
                has_smiles = True
                has_activity = any(c in columns_lower for c in ["activity", "ic50", "pki", "pkd", "pec50"])
                
                if has_activity:
                    return UploadInfo(
                        file_name=file_path.name,
                        file_path=file_path,
                        classification="assay_csv",
                        row_count=row_count,
                        column_count=len(df.columns),
                        size_bytes=file_size,
                        sample_content=f"{row_count} rows, columns: {', '.join(df.columns[:5].tolist())}",
                        recommended_modules=["activity_model_studio", "q_filter"],
                    )
                else:
                    return UploadInfo(
                        file_name=file_path.name,
                        file_path=file_path,
                        classification="smiles_csv",
                        row_count=row_count,
                        column_count=len(df.columns),
                        size_bytes=file_size,
                        sample_content=f"{row_count} rows, columns: {', '.join(df.columns[:5].tolist())}",
                        recommended_modules=["q_filter", "applicability_domain_guard", "activity_model_studio"],
                    )
            
            # ADMET CSV
            elif any(c in columns_lower for c in ["admet", "ames", "logp", "hba", "hbd", "tpsa"]):
                return UploadInfo(
                    file_name=file_path.name,
                    file_path=file_path,
                    classification="admet_csv",
                    row_count=row_count,
                    column_count=len(df.columns),
                    size_bytes=file_size,
                    recommended_modules=["q_filter", "q_rank"],
                )
            
            # Known inhibitors / scores
            elif "inhibitor" in name or "active" in name:
                return UploadInfo(
                    file_name=file_path.name,
                    file_path=file_path,
                    classification="known_inhibitors_csv",
                    row_count=row_count,
                    column_count=len(df.columns),
                    size_bytes=file_size,
                    recommended_modules=["inhibitor_library_studio", "applicability_domain_guard"],
                )
            
            elif "score" in name or "rank" in name:
                return UploadInfo(
                    file_name=file_path.name,
                    file_path=file_path,
                    classification="candidate_scores_csv",
                    row_count=row_count,
                    column_count=len(df.columns),
                    size_bytes=file_size,
                    recommended_modules=["q_rank", "wet_lab_triage_board"],
                )
        
        # ====== SDF Files ======
        elif suffix == ".sdf":
            # Count molecules in SDF
            suppl = Chem.SDMolSupplier(str(file_path))
            mol_count = len([m for m in suppl if m])
            
            return UploadInfo(
                file_name=file_path.name,
                file_path=file_path,
                classification="sdf_library",
                row_count=mol_count,
                size_bytes=file_size,
                sample_content=f"{mol_count} molecules",
                recommended_modules=["q_filter", "q_orbital_analyzer", "applicability_domain_guard"],
            )
        
        # ====== PDB Files (Protein Structures) ======
        elif suffix in [".pdb", ".pdbqt"]:
            return UploadInfo(
                file_name=file_path.name,
                file_path=file_path,
                classification="protein_structure_pdb",
                size_bytes=file_size,
                sample_content="Protein structure file",
                recommended_modules=["protein_workbench", "q_dock_studio"],
            )
        
        # ====== mmCIF Files ======
        elif suffix in [".cif", ".mmcif"]:
            return UploadInfo(
                file_name=file_path.name,
                file_path=file_path,
                classification="protein_structure_mmcif",
                size_bytes=file_size,
                sample_content="Protein structure file (mmCIF format)",
                recommended_modules=["protein_workbench", "q_dock_studio"],
            )
        
        # ====== YAML (Pocket Definition) ======
        elif suffix == ".yaml" or suffix == ".yml":
            if "pocket" in name:
                return UploadInfo(
                    file_name=file_path.name,
                    file_path=file_path,
                    classification="pocket_yaml",
                    size_bytes=file_size,
                    sample_content="Pocket definition file",
                    recommended_modules=["q_dock_studio"],
                )
    
    except Exception as e:
        # If parsing fails, return unknown
        pass
    
    # Default to unknown
    return UploadInfo(
        file_name=file_path.name,
        file_path=file_path,
        classification="unknown",
        size_bytes=file_size,
        error=f"Could not classify file: {suffix}",
    )


def get_recommended_workflow(
    classifications: list[UploadClassification],
) -> list[dict[str, str]]:
    """Get recommended workflow based on uploaded file types.
    
    Args:
        classifications: List of detected file classifications
        
    Returns:
        List of workflow steps with descriptions
    """
    workflow = []
    
    # Recommend workflow based on what was uploaded
    if "smiles_csv" in classifications or "sdf_library" in classifications:
        workflow.append({
            "step": 1,
            "module": "q_filter",
            "description": "Screen molecules by drug-likeness and medchem risk",
            "inputs": ["molecules"],
            "outputs": ["filtered_candidates", "rejection_reasons"],
        })
        workflow.append({
            "step": 2,
            "module": "applicability_domain_guard",
            "description": "Check if filtered molecules are in training domain",
            "inputs": ["filtered_candidates"],
            "outputs": ["domain_membership"],
        })
        workflow.append({
            "step": 3,
            "module": "q_orbital_analyzer",
            "description": "Compute quantum descriptors for selected molecules",
            "inputs": ["filtered_candidates"],
            "outputs": ["qm_descriptors"],
        })
    
    if "protein_structure_pdb" in classifications or "protein_structure_mmcif" in classifications:
        workflow.append({
            "step": 1,
            "module": "protein_workbench",
            "description": "Prepare protein structure and define docking pocket",
            "inputs": ["protein_structure"],
            "outputs": ["prepared_receptor", "pocket_definition"],
        })
        
        if "smiles_csv" in classifications or "sdf_library" in classifications:
            workflow.append({
                "step": 2,
                "module": "q_dock_studio",
                "description": "Dock molecules into prepared receptor",
                "inputs": ["prepared_receptor", "pocket_definition", "molecules"],
                "outputs": ["docking_scores", "poses"],
            })
    
    if "assay_csv" in classifications:
        workflow.append({
            "step": 1,
            "module": "activity_model_studio",
            "description": "Train or compare activity prediction models",
            "inputs": ["assay_data"],
            "outputs": ["model_comparison", "activity_predictions"],
        })
    
    if workflow:
        workflow.append({
            "step": len(workflow) + 1,
            "module": "q_rank",
            "description": "Rank candidates based on all evidence",
            "inputs": ["docking_scores", "qm_descriptors", "activity_predictions"],
            "outputs": ["ranked_candidates"],
        })
        workflow.append({
            "step": len(workflow) + 1,
            "module": "wet_lab_triage_board",
            "description": "Make decisions about which candidates to test",
            "inputs": ["ranked_candidates"],
            "outputs": ["triage_board", "wet_lab_pack"],
        })
    
    return workflow
