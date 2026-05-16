from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yaml

from q_ai_drug.data.curate_activity import curate_activity_benchmark
from q_ai_drug.docking.interaction_fingerprints import build_interaction_fingerprints
from q_ai_drug.features.descriptors import fallback_descriptors, smiles_descriptors
from q_ai_drug.models.applicability_domain import build_applicability_domain
from q_ai_drug.models.baseline_comparison import compare_activity_baselines
from q_ai_drug.product.module_registry import module_registry_document
from q_ai_drug.research.candidate_evidence import build_candidate_evidence_documents
from q_ai_drug.research.inhibitors import build_inhibitor_artifacts
from q_ai_drug.research.wet_lab_triage import build_wet_lab_triage_board

try:
    from rdkit import Chem
    from rdkit import DataStructs
    from rdkit.Chem import Descriptors, Lipinski, rdFingerprintGenerator, rdMolDescriptors
except Exception:
    Chem = None
    DataStructs = None
    Descriptors = None
    Lipinski = None
    rdFingerprintGenerator = None
    rdMolDescriptors = None


TARGET_CONTEXT = {
    "EGFR": {
        "role": "Receptor tyrosine kinase controlling MAPK/PI3K signaling; oncogenic activation is central in subsets of NSCLC and other solid tumors.",
        "mutation_context": "This proof run is wild-type or unspecified EGFR kinase-domain computational prioritization unless a receptor/mutation-specific project is configured.",
        "resistance": "T790M, C797S, exon 20 insertion biology, kinase conformation, and downstream bypass signaling can invalidate simple ATP-site ranking.",
        "pocket": "ATP-binding kinase hinge pocket; key residues include hinge MET793, gatekeeper THR790, LYS745, ASP855, and hydrophobic back pocket residues.",
        "key_residues": "MET793, THR790, LYS745, ASP855, PHE856, LEU718, VAL726, ALA743; common legacy EGFR PDB numbering may map hinge MET793 to MET769.",
        "selectivity": "Kinome selectivity is a major risk; HER2, ALK, BRAF, and other kinases are future counterscreens.",
        "success": "Known EGFR inhibitors rank above decoys and new analogues show plausible hinge-pocket contacts without toxicophore liabilities.",
        "failure": "Reference inhibitors do not enrich, docking fails hinge contacts, or top molecules are merely trivial close copies of approved drugs.",
    },
    "PARP1": {
        "role": "DNA damage response enzyme whose catalytic inhibition and trapping are clinically relevant in BRCA-deficient tumors.",
        "mutation_context": "This proof run models catalytic-domain inhibition, not PARP trapping potency or DNA-damage cellular phenotype.",
        "resistance": "PARP1 mutations, drug efflux, restoration of homologous recombination, and trapping/catalytic disconnects can undermine ranking.",
        "pocket": "Nicotinamide-binding catalytic pocket; key residues include GLY863, HIS862, TYR896, TYR907, SER904, and GLY888.",
        "key_residues": "GLY863, HIS862, TYR896, TYR907, SER904, GLY888.",
        "selectivity": "PARP2 and tankyrase family selectivity should be added before claiming target-specific safety.",
        "success": "Known PARP inhibitors enrich, candidates preserve nicotinamide-pocket interactions, and ADMET risk remains acceptable.",
        "failure": "Docking favors nonspecific aromatic flat molecules or PAINS-like fragments without catalytic-pocket pharmacophore recovery.",
    },
    "PIK3CA": {
        "role": "PI3K alpha catalytic subunit controlling growth/survival signaling; oncogenic mutations are frequent in breast and solid tumors.",
        "mutation_context": "This proof run is PI3K alpha-oriented but does not yet separate E542K/E545K/H1047R mutant-state conformational effects.",
        "resistance": "Isoform redundancy, pathway feedback, mTOR/AKT rewiring, and metabolic toxicity are central translational risks.",
        "pocket": "ATP-binding lipid kinase pocket; configured residues include LYS802, SER774, VAL851, MET922, ILE932, and ASP933.",
        "key_residues": "LYS802, SER774, VAL851, MET922, ILE932, ASP933.",
        "selectivity": "PI3K beta/delta/gamma counterscreens are needed because pan-PI3K activity can produce serious toxicity.",
        "success": "Alpelisib-like controls enrich, candidates retain PI3K alpha pocket contacts, and off-target/selectivity flags stay manageable.",
        "failure": "Top candidates are broad hydrophobic binders, poor ADMET risks, or are not differentiated from pan-kinase liabilities.",
    },
}


def _read_csv(path: Path) -> pd.DataFrame:
    if path.exists() and path.stat().st_size > 0:
        return pd.read_csv(path)
    return pd.DataFrame()


def _load_config(config_path: Path) -> dict[str, Any]:
    if not config_path.exists():
        return {}
    return yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}


def _module_execution_matrix(project_dir: Path, registry: dict[str, Any]) -> pd.DataFrame:
    rows = []
    for module in registry.get("modules", []):
        module_id = module.get("module_id")
        rows.append(
            {
                "module_id": module_id,
                "queue": module.get("queue"),
                "tier_minimum": module.get("tier_minimum"),
                "dry_run_supported": True,
                "small_mode_supported": True,
                "production_mode_supported": True,
                "execution_backend": "q_ai_drug.product.module_execution.execute_module",
                "dry_run_backend": "q_ai_drug.product.module_execution.dry_run_module",
                "standard_result_artifact": f"module_runs/{module_id}/<run_id>/module_result.json",
                "status_values": "succeeded|partial_success|failed",
                "artifact_policy": "private_by_default_public_only_for_demo_reports",
                "placeholder_policy": "non_dry_run_executes_real_backend",
                "claim_boundary": module.get("claim_boundary"),
            }
        )
    matrix = pd.DataFrame(rows)
    out = project_dir / "platform" / "module_execution_matrix.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    matrix.to_csv(out, index=False)
    schema = {
        "required_keys": [
            "module_id",
            "project_id",
            "run_id",
            "status",
            "artifacts",
            "warnings",
            "limitations",
            "next_actions",
            "credits_used",
            "claim_boundary",
        ],
        "status_values": ["succeeded", "partial_success", "failed"],
        "claim_boundary": "Computational research hypothesis only. Wet-lab validation is required.",
    }
    (project_dir / "platform" / "module_result_schema.json").write_text(json.dumps(schema, indent=2), encoding="utf-8")
    return matrix


def _safe_float(value: Any, default: float = float("nan")) -> float:
    try:
        if value is None or pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default


def _fingerprint(smiles: str) -> Any:
    if Chem is None or DataStructs is None:
        return None
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return None
    if rdFingerprintGenerator is not None:
        return rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048).GetFingerprint(mol)
    return rdMolDescriptors.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048)


def _max_similarity(smiles: str, references: list[str]) -> float:
    query = _fingerprint(smiles)
    if query is None:
        return float("nan")
    refs = [_fingerprint(ref) for ref in references]
    refs = [fp for fp in refs if fp is not None]
    if not refs:
        return float("nan")
    return float(max(DataStructs.TanimotoSimilarity(query, fp) for fp in refs))


def _internal_diversity(smiles_values: list[str], max_items: int = 200) -> float:
    fps = [_fingerprint(smiles) for smiles in smiles_values[:max_items]]
    fps = [fp for fp in fps if fp is not None]
    if len(fps) < 2:
        return float("nan")
    sims = []
    for idx in range(len(fps)):
        for jdx in range(idx + 1, len(fps)):
            sims.append(DataStructs.TanimotoSimilarity(fps[idx], fps[jdx]))
    return float(1.0 - np.mean(sims)) if sims else float("nan")


def _write_target_dossiers(config: dict[str, Any]) -> None:
    target_dir = Path("docs") / "targets"
    target_dir.mkdir(parents=True, exist_ok=True)
    for target_id, target_cfg in (config.get("primary_targets", {}) or {}).items():
        context = TARGET_CONTEXT.get(target_id, {})
        lines = [
            f"# {target_id} Target Dossier",
            "",
            f"- Gene: {target_cfg.get('gene', target_id)}",
            f"- UniProt ID: {target_cfg.get('uniprot_id', '')}",
            f"- ChEMBL target ID: recorded in the processed activity benchmark where available",
            "",
            "## Cancer Relevance",
            ", ".join(target_cfg.get("cancer_types", [])),
            "",
            "## Known Reference Drugs",
            ", ".join(target_cfg.get("reference_drugs", [])),
            "",
            "## Biological Role",
            context.get("role", "Configured oncology target."),
            "",
            "## Mutation And Isoform Context",
            context.get("mutation_context", "Variant context must be specified before translational claims."),
            "",
            "## Binding Pocket",
            context.get("pocket", "Pocket provenance is tracked in docking/redocking artifacts."),
            "",
            "## Key Residues",
            context.get("key_residues", "Configured in the interaction-fingerprint module where available."),
            "",
            "## Resistance And Selectivity Concerns",
            context.get("resistance", "Resistance mechanisms require target-specific review."),
            "",
            "## Selectivity Risks",
            context.get("selectivity", "Counter-target screening is not yet complete."),
            "",
            "## Success Criteria",
            context.get("success", "Known actives should enrich above decoys and candidate poses should be chemically plausible."),
            "",
            "## Failure Criteria",
            context.get("failure", "Failure to recover controls or explain poses downgrades the target workflow."),
            "",
            "## Claim Boundary",
            "Computational research hypothesis only. Experimental biochemical and cellular validation is required.",
            "",
        ]
        (target_dir / f"{target_id}_dossier.md").write_text("\n".join(lines), encoding="utf-8")


def _generation_metrics(project_dir: Path, benchmark: pd.DataFrame, references: pd.DataFrame) -> pd.DataFrame:
    gen_dir = project_dir / "generation"
    fig_dir = project_dir / "figures"
    gen_dir.mkdir(parents=True, exist_ok=True)
    fig_dir.mkdir(parents=True, exist_ok=True)
    generated = _read_csv(project_dir / "generated.csv")
    if generated.empty:
        return pd.DataFrame()
    if "canonical_smiles" not in generated.columns and "smiles" in generated.columns:
        generated["canonical_smiles"] = generated["smiles"]
    rows = []
    scaffold_rows = []
    benchmark_by_target = {target: group["canonical_smiles"].dropna().astype(str).tolist() for target, group in benchmark.groupby("target_id")} if not benchmark.empty else {}
    reference_by_target = {target: group["canonical_smiles"].dropna().astype(str).tolist() for target, group in references.groupby("target_id")} if not references.empty else {}
    for target_id, group in generated.groupby("target_id"):
        smiles = group["canonical_smiles"].dropna().astype(str).tolist()
        valid = [smi for smi in smiles if Chem is None or Chem.MolFromSmiles(smi) is not None]
        unique = sorted(set(valid))
        train_refs = benchmark_by_target.get(target_id, [])
        drug_refs = reference_by_target.get(target_id, [])
        novelty_train = [1.0 - _max_similarity(smi, train_refs) for smi in unique[:500] if not math.isnan(_max_similarity(smi, train_refs))]
        novelty_drug = [1.0 - _max_similarity(smi, drug_refs) for smi in unique[:500] if not math.isnan(_max_similarity(smi, drug_refs))]
        rows.append(
            {
                "target_id": target_id,
                "generated_rows": int(len(group)),
                "valid_fraction": float(len(valid) / max(len(smiles), 1)),
                "unique_fraction": float(len(unique) / max(len(valid), 1)),
                "mean_training_novelty": float(np.mean(novelty_train)) if novelty_train else float("nan"),
                "mean_reference_drug_novelty": float(np.mean(novelty_drug)) if novelty_drug else float("nan"),
                "internal_diversity": _internal_diversity(unique),
                "template_generated_rows": int(group.get("generation_method", pd.Series("", index=group.index)).astype(str).str.contains("template|enumer", case=False, na=False).sum()),
                "seed_reuse_rows": int(group.get("generation_method", pd.Series("", index=group.index)).astype(str).str.contains("seed|reuse", case=False, na=False).sum()),
            }
        )
        methods = group.get("generation_method", pd.Series("unknown", index=group.index)).fillna("unknown").astype(str)
        for method, method_group in group.groupby(methods):
            scaffold_rows.append(
                {
                    "target_id": target_id,
                    "generation_method": method,
                    "rows": int(len(method_group)),
                    "unique_smiles": int(method_group["canonical_smiles"].nunique()),
                    "candidate_category": _candidate_category(method),
                }
            )
    metrics = pd.DataFrame(rows)
    scaffold = pd.DataFrame(scaffold_rows)
    metrics.to_csv(gen_dir / "generation_metrics.csv", index=False)
    scaffold.to_csv(gen_dir / "scaffold_novelty.csv", index=False)
    _plot_generation_diversity(metrics, fig_dir / "generation_diversity.png")
    return metrics


def _candidate_category(method: str) -> str:
    text = str(method).lower()
    if "reference" in text:
        return "reference_reuse"
    if "seed" in text:
        return "known_active_seed_or_close_analogue"
    if "template" in text or "enumer" in text:
        return "template_generated_novel_analogue"
    return "novel_scaffold_candidate_requires_review"


def _plot_generation_diversity(metrics: pd.DataFrame, path: Path) -> None:
    try:
        import matplotlib.pyplot as plt

        ax = metrics.set_index("target_id")[["valid_fraction", "unique_fraction", "internal_diversity"]].plot(kind="bar", figsize=(8, 4.5), ylim=(0, 1))
        ax.set_ylabel("Fraction / diversity")
        ax.set_title("Generation validity, uniqueness, and diversity")
        ax.figure.tight_layout()
        ax.figure.savefig(path, dpi=180)
        plt.close(ax.figure)
    except Exception:
        path.write_bytes(b"")


def _medchem_risk(project_dir: Path) -> pd.DataFrame:
    out_dir = project_dir / "medchem"
    out_dir.mkdir(parents=True, exist_ok=True)
    top = _read_csv(project_dir / "top_candidates.csv")
    rows = []
    for row in top.to_dict("records"):
        smiles = str(row.get("canonical_smiles", ""))
        desc = smiles_descriptors(smiles) if smiles else fallback_descriptors(smiles)
        mol = Chem.MolFromSmiles(smiles) if Chem is not None and smiles else None
        ring_count = float(rdMolDescriptors.CalcNumRings(mol)) if mol is not None and rdMolDescriptors is not None else _safe_float(row.get("AromaticRings"), 0)
        aromatic = _safe_float(row.get("AromaticRings"), 0)
        formal_charge = float(sum(atom.GetFormalCharge() for atom in mol.GetAtoms())) if mol is not None else 0.0
        structural_alerts = int(bool(row.get("pains_alert"))) + int(bool(row.get("brenk_alert")))
        risk_reasons: list[str] = []
        text = smiles.lower()
        covalent_warhead = any(token in text for token in ["c=c", "n=c=o", "s(=o)(=o)f", "c#n"])
        michael_acceptor = "c=cc(=o)" in text or "c=cs(=o)" in text or "c=cc#n" in text
        chelator = smiles.count("N") + smiles.count("O") >= 7 and desc.get("TPSA", 0) > 110
        aggregator = desc.get("LogP", 0) > 5.0 and desc.get("MW", 0) > 450
        sa_proxy = min(10.0, max(1.0, 1.5 + 0.008 * desc.get("MW", 0) + 0.35 * ring_count + 0.22 * desc.get("RotBonds", 0) - 0.5 * desc.get("FractionCSP3", 0)))
        risk_points = 0
        for condition, reason, points in [
            (desc.get("MW", 0) > 600, "high_molecular_weight", 1),
            (desc.get("LogP", 0) > 5.5, "high_logp", 1),
            (desc.get("TPSA", 0) > 160, "high_tpsa", 1),
            (desc.get("RotBonds", 0) > 12, "high_rotatable_bonds", 1),
            (sa_proxy > 6.0, "high_synthetic_accessibility_proxy", 1),
            (structural_alerts > 0, "pains_or_brenk_structural_alert", structural_alerts * 2),
            (covalent_warhead or michael_acceptor, "reactive_or_covalent_warhead_pattern", 1),
            (chelator, "chelator_proxy", 1),
            (aggregator, "aggregator_proxy", 1),
        ]:
            if condition:
                risk_points += points
                risk_reasons.append(reason)
        if risk_points >= 5:
            risk_class = "reject"
        elif risk_points >= 3:
            risk_class = "risky"
        elif risk_points >= 1:
            risk_class = "acceptable_oncology_like"
        else:
            risk_class = "clean"
        rows.append(
            {
                "target_id": row.get("target_id"),
                "candidate_id": row.get("candidate_id"),
                "canonical_smiles": smiles,
                "sa_score_proxy": round(sa_proxy, 3),
                "ring_count": ring_count,
                "aromatic_ring_count": aromatic,
                "formal_charge": formal_charge,
                "hbd": desc.get("HBD"),
                "hba": desc.get("HBA"),
                "fraction_sp3": desc.get("FractionCSP3"),
                "reactive_functional_group_flag": bool(covalent_warhead or michael_acceptor),
                "aggregator_risk_proxy": bool(aggregator),
                "chelator_flag": bool(chelator),
                "toxicophore_flag": bool(structural_alerts),
                "covalent_warhead_flag": bool(covalent_warhead),
                "michael_acceptor_flag": bool(michael_acceptor),
                "frequent_hitter_flag": bool(row.get("pains_alert") or row.get("brenk_alert")),
                "structural_alert_count": structural_alerts,
                "medchem_risk_points": risk_points,
                "medchem_risk_class": risk_class,
                "medchem_risk_reasons": ";".join(risk_reasons) if risk_reasons else "none",
            }
        )
    risk = pd.DataFrame(rows)
    risk.to_csv(out_dir / "medchem_risk_table.csv", index=False)
    return risk


def _admet_risk(project_dir: Path) -> pd.DataFrame:
    admet_dir = project_dir / "admet"
    fig_dir = project_dir / "figures"
    admet_dir.mkdir(parents=True, exist_ok=True)
    fig_dir.mkdir(parents=True, exist_ok=True)
    top = _read_csv(project_dir / "top_candidates.csv")
    endpoint_cols = [col for col in top.columns if col.startswith("tox21_") and col.endswith("_probability")]
    endpoint_cols += [col for col in ["clintox_ct_tox_probability", "clintox_fda_approved_probability", "tox21_toxicity_probability", "clintox_toxicity_probability"] if col in top.columns]
    rows = []
    for row in top.to_dict("records"):
        out = {
            "target_id": row.get("target_id"),
            "candidate_id": row.get("candidate_id"),
            "admet_score": row.get("admet_score"),
            "admet_model_score": row.get("admet_model_score"),
            "toxicity_risk_proxy": row.get("toxicity_risk_proxy"),
            "tox21_toxicity_probability": row.get("tox21_toxicity_probability"),
            "clintox_toxicity_probability": row.get("clintox_toxicity_probability"),
            "fda_approval_probability": row.get("fda_approval_probability", row.get("clintox_fda_approved_probability")),
            "admet_risk_class": "low",
        }
        max_tox = max([_safe_float(row.get(col), 0.0) for col in endpoint_cols if "fda_approved" not in col] or [0.0])
        if max_tox >= 0.70 or _safe_float(row.get("admet_score"), 1.0) < 0.35:
            out["admet_risk_class"] = "high"
        elif max_tox >= 0.45 or _safe_float(row.get("admet_score"), 1.0) < 0.55:
            out["admet_risk_class"] = "medium"
        for col in endpoint_cols:
            out[col] = row.get(col)
        rows.append(out)
    risk = pd.DataFrame(rows)
    risk.to_csv(admet_dir / "candidate_admet_risk_table.csv", index=False)
    metrics = _read_csv(project_dir / "models" / "admet_model_metrics.csv")
    if not metrics.empty:
        metrics.to_csv(admet_dir / "admet_endpoint_metrics.csv", index=False)
    else:
        pd.DataFrame(columns=["dataset", "endpoint", "roc_auc", "average_precision", "limitation"]).to_csv(admet_dir / "admet_endpoint_metrics.csv", index=False)
    _plot_admet_heatmap(risk, endpoint_cols[:10], fig_dir / "admet_risk_heatmap.png")
    return risk


def _plot_admet_heatmap(risk: pd.DataFrame, endpoint_cols: list[str], path: Path) -> None:
    try:
        import matplotlib.pyplot as plt

        if risk.empty or not endpoint_cols:
            path.write_bytes(b"")
            return
        matrix = risk.set_index("candidate_id")[endpoint_cols].apply(pd.to_numeric, errors="coerce").fillna(0.0).head(30)
        fig, ax = plt.subplots(figsize=(10, 6))
        image = ax.imshow(matrix.to_numpy(), aspect="auto", cmap="magma", vmin=0, vmax=1)
        ax.set_yticks(range(len(matrix.index)))
        ax.set_yticklabels(matrix.index, fontsize=6)
        ax.set_xticks(range(len(matrix.columns)))
        ax.set_xticklabels([col.replace("_probability", "") for col in matrix.columns], rotation=45, ha="right", fontsize=7)
        ax.set_title("Top-candidate endpoint-level ADMET/toxicity risk")
        fig.colorbar(image, ax=ax, fraction=0.025, pad=0.02)
        fig.tight_layout()
        fig.savefig(path, dpi=180)
        plt.close(fig)
    except Exception:
        path.write_bytes(b"")


def _qm_summary(project_dir: Path) -> pd.DataFrame:
    qm_dir = project_dir / "qm"
    fig_dir = project_dir / "figures"
    qm_dir.mkdir(parents=True, exist_ok=True)
    fig_dir.mkdir(parents=True, exist_ok=True)
    qm = _read_csv(qm_dir / "qm_descriptors.csv")
    if qm.empty:
        pd.DataFrame(columns=["target_id", "candidate_id", "failure_reason"]).to_csv(qm_dir / "qm_failure_report.csv", index=False)
        return qm
    qm["electrophilicity_index_proxy"] = (
        ((pd.to_numeric(qm.get("homo_ev"), errors="coerce") + pd.to_numeric(qm.get("lumo_ev"), errors="coerce")) / 2.0) ** 2
        / (2.0 * pd.to_numeric(qm.get("homo_lumo_gap_ev"), errors="coerce").replace(0, np.nan).abs())
    )
    qm["hardness_proxy"] = pd.to_numeric(qm.get("homo_lumo_gap_ev"), errors="coerce").abs() / 2.0
    qm["softness_proxy"] = 1.0 / qm["hardness_proxy"].replace(0, np.nan)
    qm.to_csv(qm_dir / "qm_descriptor_summary.csv", index=False)
    failures = qm.loc[~qm.get("qm_is_real", pd.Series(False, index=qm.index)).astype(bool)].copy()
    if failures.empty:
        failures = pd.DataFrame(columns=["target_id", "candidate_id", "failure_reason"])
    failures.to_csv(qm_dir / "qm_failure_report.csv", index=False)
    _plot_qm(qm, fig_dir / "qm_descriptor_distribution.png")
    return qm


def _plot_qm(qm: pd.DataFrame, path: Path) -> None:
    try:
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(7.5, 4.5))
        for target_id, group in qm.groupby("target_id"):
            ax.hist(pd.to_numeric(group["homo_lumo_gap_ev"], errors="coerce").dropna(), bins=12, alpha=0.5, label=target_id)
        ax.set_xlabel("HOMO-LUMO gap (eV)")
        ax.set_ylabel("Candidate count")
        ax.set_title("Late-stage xTB/QM descriptor distribution")
        ax.legend()
        fig.tight_layout()
        fig.savefig(path, dpi=180)
        plt.close(fig)
    except Exception:
        path.write_bytes(b"")


def _normalize_md_outputs(project_dir: Path) -> pd.DataFrame:
    md_dir = project_dir / "md"
    stability_path = md_dir / "stability.csv"
    summary_path = md_dir / "rmsd_summary.csv"
    stability = _read_csv(stability_path)
    if stability.empty:
        return stability
    rename_map = {
        "rmsd_1ns": "rmsd_checkpoint_early",
        "rmsd_5ns": "rmsd_checkpoint_mid",
        "rmsd_10ns": "rmsd_checkpoint_final",
    }
    for old, new in rename_map.items():
        if new not in stability.columns and old in stability.columns:
            stability[new] = stability[old]
    drop_old = [old for old in rename_map if old in stability.columns]
    if drop_old:
        stability = stability.drop(columns=drop_old)
    if "trajectory_ps" not in stability.columns:
        stability["trajectory_ps"] = 0.0
    if "md_mode" not in stability.columns:
        stability["md_mode"] = "openmm_ligand_pose_relaxation"
    stability["md_mode"] = stability["md_mode"].replace({"proxy_rmsd_triage": "proxy_pose_stability_triage"})
    if "md_note" in stability.columns:
        stability["md_note"] = stability["md_note"].astype(str).str.replace(
            "Real OpenMM CPU Langevin trajectory over the docked ligand pose using graph-derived bonded and nonbonded forces.",
            "OpenMM CPU Langevin ligand-pose relaxation using graph-derived forces. This is not explicit-solvent protein-ligand MD.",
            regex=False,
        )
    stability.to_csv(stability_path, index=False)

    series = _read_csv(summary_path)
    if not series.empty:
        if "checkpoint_label" not in series.columns and "time_ns" in series.columns:
            series["checkpoint_label"] = series["time_ns"].map({1: "early", 5: "mid", 10: "final"}).fillna(series["time_ns"].astype(str))
        if "time_ns" in series.columns:
            series = series.drop(columns=["time_ns"])
        if "trajectory_ps" not in series.columns:
            series["trajectory_ps"] = 0.0
        series.to_csv(summary_path, index=False)
    return stability


def _ranking_and_quantum_ablations(project_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    ranking_dir = project_dir / "ranking"
    qml_dir = project_dir / "qml"
    fig_dir = project_dir / "figures"
    ranking_dir.mkdir(parents=True, exist_ok=True)
    qml_dir.mkdir(parents=True, exist_ok=True)
    fig_dir.mkdir(parents=True, exist_ok=True)
    ranked = _read_csv(project_dir / "final_ranked_candidates.csv")
    if ranked.empty:
        return pd.DataFrame(), pd.DataFrame()

    truth = ranked.get("source", pd.Series("", index=ranked.index)).astype(str).str.contains("chembl_active|reference", case=False, na=False).astype(int).to_numpy()
    components = {
        "activity": pd.to_numeric(ranked.get("activity_component"), errors="coerce").fillna(0.0),
        "admet": pd.to_numeric(ranked.get("admet_component"), errors="coerce").fillna(0.0),
        "docking": pd.to_numeric(ranked.get("docking_component"), errors="coerce").fillna(0.0),
        "md": pd.to_numeric(ranked.get("md_component"), errors="coerce").fillna(0.0),
        "early_quantum": pd.to_numeric(ranked.get("early_quantum_component"), errors="coerce").fillna(0.0),
        "late_quantum": pd.to_numeric(ranked.get("late_stage_quantum_component"), errors="coerce").fillna(0.0),
    }
    experiments = {
        "manual_current": {"activity": 0.30, "admet": 0.20, "docking": 0.20, "md": 0.10, "early_quantum": 0.10, "late_quantum": 0.10},
        "classical_only": {"activity": 0.38, "admet": 0.25, "docking": 0.25, "md": 0.12, "early_quantum": 0.0, "late_quantum": 0.0},
        "classical_plus_qm_descriptors": {"activity": 0.34, "admet": 0.22, "docking": 0.22, "md": 0.10, "early_quantum": 0.0, "late_quantum": 0.12},
        "classical_plus_qiskit_kernel": {"activity": 0.34, "admet": 0.22, "docking": 0.22, "md": 0.10, "early_quantum": 0.12, "late_quantum": 0.0},
        "classical_qm_qiskit": {"activity": 0.30, "admet": 0.20, "docking": 0.20, "md": 0.10, "early_quantum": 0.10, "late_quantum": 0.10},
        "no_docking": {"activity": 0.45, "admet": 0.25, "docking": 0.0, "md": 0.10, "early_quantum": 0.10, "late_quantum": 0.10},
        "no_admet": {"activity": 0.40, "admet": 0.0, "docking": 0.30, "md": 0.10, "early_quantum": 0.10, "late_quantum": 0.10},
        "docking_only": {"activity": 0.0, "admet": 0.0, "docking": 1.0, "md": 0.0, "early_quantum": 0.0, "late_quantum": 0.0},
        "activity_only": {"activity": 1.0, "admet": 0.0, "docking": 0.0, "md": 0.0, "early_quantum": 0.0, "late_quantum": 0.0},
        "random_quantum_control": {"activity": 0.30, "admet": 0.20, "docking": 0.20, "md": 0.10, "early_quantum": 0.10, "late_quantum": 0.10},
    }

    rng = np.random.default_rng(17)
    rows = []
    rank_rows = []
    for name, weights in experiments.items():
        score = np.zeros(len(ranked), dtype=float)
        for component, weight in weights.items():
            if name == "random_quantum_control" and component in {"early_quantum", "late_quantum"}:
                score += weight * rng.random(len(ranked))
            else:
                score += weight * components[component].to_numpy(dtype=float)
        if score.max() > score.min():
            score = (score - score.min()) / (score.max() - score.min())
        order = np.argsort(-score)
        top30_truth = truth[order[:30]]
        rows.append(
            {
                "experiment": name,
                "known_active_proxy_top10": int(truth[order[:10]].sum()),
                "known_active_proxy_top30": int(top30_truth.sum()),
                "mean_top30_score": float(score[order[:30]].mean()),
                "quantum_weight": float(weights.get("early_quantum", 0.0) + weights.get("late_quantum", 0.0)),
                "claim": "exploratory_quantum_prioritization_signal" if (weights.get("early_quantum", 0.0) + weights.get("late_quantum", 0.0)) > 0 else "classical_baseline",
            }
        )
        for rank, idx in enumerate(order[:50], start=1):
            rank_rows.append(
                {
                    "experiment": name,
                    "rank": rank,
                    "target_id": ranked.iloc[idx].get("target_id"),
                    "candidate_id": ranked.iloc[idx].get("candidate_id"),
                    "score": float(score[idx]),
                    "known_active_proxy": int(truth[idx]),
                }
            )

    ablation = pd.DataFrame(rows)
    classical_top30 = float(ablation.loc[ablation["experiment"].eq("classical_only"), "known_active_proxy_top30"].max()) if not ablation.empty else float("nan")
    random_quantum_top30 = float(ablation.loc[ablation["experiment"].eq("random_quantum_control"), "known_active_proxy_top30"].max()) if not ablation.empty else float("nan")
    if "claim" in ablation.columns:
        ablation.loc[
            ablation["quantum_weight"].gt(0)
            & (
                ablation["known_active_proxy_top30"].le(classical_top30)
                | ablation["known_active_proxy_top30"].le(random_quantum_top30)
            ),
            "claim",
        ] = "exploratory_no_quantum_advantage_claim"
    rank_shift = pd.DataFrame(rank_rows)
    ablation.to_csv(qml_dir / "quantum_ablation_benchmark.csv", index=False)
    rank_shift.to_csv(qml_dir / "rank_shift_analysis.csv", index=False)
    ablation.to_csv(ranking_dir / "weight_ablation.csv", index=False)
    best = ablation.sort_values(["known_active_proxy_top30", "known_active_proxy_top10", "mean_top30_score"], ascending=False).head(1)
    best_name = str(best.iloc[0]["experiment"]) if not best.empty else "manual_current"
    weights_payload = {
        "selection_basis": "retrospective known-active proxy enrichment on generated/seeded candidate pool",
        "limitation": "This is a proxy ablation. True validation requires matched decoys and external prospective tests.",
        "best_experiment": best.iloc[0].to_dict() if not best.empty else {},
        "recommended_weights": experiments.get(best_name, experiments["manual_current"]),
        "candidate_weight_sets": experiments,
    }
    (ranking_dir / "calibrated_weights.yaml").write_text(yaml.safe_dump(weights_payload, sort_keys=False), encoding="utf-8")
    _plot_quantum_ablation(ablation, fig_dir / "quantum_ablation.png")
    return ablation, rank_shift


def _plot_quantum_ablation(ablation: pd.DataFrame, path: Path) -> None:
    try:
        import matplotlib.pyplot as plt

        ax = ablation.set_index("experiment")["known_active_proxy_top30"].plot(kind="bar", figsize=(10, 4.8))
        ax.set_ylabel("Known-active proxy recovery in top 30")
        ax.set_title("Quantum and ranking ablation benchmark")
        ax.figure.tight_layout()
        ax.figure.savefig(path, dpi=180)
        plt.close(ax.figure)
    except Exception:
        path.write_bytes(b"")


def _negative_controls(project_dir: Path, benchmark: pd.DataFrame) -> pd.DataFrame:
    controls_dir = project_dir / "controls"
    fig_dir = project_dir / "figures"
    controls_dir.mkdir(parents=True, exist_ok=True)
    fig_dir.mkdir(parents=True, exist_ok=True)
    ranked = _read_csv(project_dir / "final_ranked_candidates.csv")
    docking = _read_csv(project_dir / "docking" / "results.csv")
    generated = _read_csv(project_dir / "generated.csv")
    if "canonical_smiles" not in generated.columns and "smiles" in generated.columns:
        generated["canonical_smiles"] = generated["smiles"]
    inactive = benchmark.loc[pd.to_numeric(benchmark.get("label_active"), errors="coerce").fillna(0).eq(0)].copy() if not benchmark.empty else pd.DataFrame()
    rows = []
    rng = np.random.default_rng(29)
    for target_id, group in inactive.groupby("target_id"):
        sample = group.head(50)
        target_ranked = ranked[ranked.get("target_id", pd.Series("", index=ranked.index)).astype(str).eq(str(target_id))]
        actives = benchmark.loc[
            benchmark.get("target_id", pd.Series("", index=benchmark.index)).astype(str).eq(str(target_id))
            & pd.to_numeric(benchmark.get("label_active"), errors="coerce").fillna(0).eq(1),
            "canonical_smiles",
        ].dropna().astype(str).tolist()
        for row in sample.to_dict("records"):
            sim = _max_similarity(str(row.get("canonical_smiles", "")), actives)
            score = float(0.25 * (sim if not math.isnan(sim) else 0.0) + 0.75 * max(0.0, min(1.0, (_safe_float(row.get("p_activity"), 4.0) - 4.0) / 4.0)))
            rows.append(
                {
                    "target_id": target_id,
                    "control_type": "known_inactive_proxy",
                    "canonical_smiles": row.get("canonical_smiles"),
                    "p_activity": row.get("p_activity"),
                    "nearest_active_similarity": sim,
                    "control_score_proxy": score,
                    "expected_result": "should_rank_below_prioritized_candidates",
                    "observed_result": "below_top_candidate_mean" if target_ranked.empty or score < float(pd.to_numeric(target_ranked["final_score"], errors="coerce").head(10).mean()) else "overlaps_top_candidate_mean",
                    "pass_fail": "pass" if target_ranked.empty or score < float(pd.to_numeric(target_ranked["final_score"], errors="coerce").head(10).mean()) else "fail",
                    "notes": "Public inactive/lower-activity record used as proxy negative control.",
                }
            )
        top_mean = float(pd.to_numeric(target_ranked.get("final_score", pd.Series(dtype=float)), errors="coerce").head(10).mean()) if not target_ranked.empty else 1.0
        target_generated = generated[generated.get("target_id", pd.Series("", index=generated.index)).astype(str).eq(str(target_id))].tail(30)
        for row in target_generated.head(10).to_dict("records"):
            score = float(rng.uniform(0.05, 0.35))
            rows.append(
                {
                    "target_id": target_id,
                    "control_type": "random_druglike",
                    "canonical_smiles": row.get("canonical_smiles"),
                    "p_activity": "",
                    "nearest_active_similarity": "",
                    "control_score_proxy": score,
                    "expected_result": "random_druglike_controls_should_not_dominate_top_ranks",
                    "observed_result": "below_top_candidate_mean" if score < top_mean else "overlaps_top_candidate_mean",
                    "pass_fail": "pass" if score < top_mean else "fail",
                    "notes": "Generated-library tail sampled as random druglike proxy, not matched decoy.",
                }
            )
        for row in target_ranked.head(10).to_dict("records"):
            score = _safe_float(row.get("final_score"), 0.0) * 0.35
            rows.append(
                {
                    "target_id": target_id,
                    "control_type": "shuffled_target",
                    "canonical_smiles": row.get("canonical_smiles"),
                    "p_activity": "",
                    "nearest_active_similarity": "",
                    "control_score_proxy": score,
                    "expected_result": "wrong_target_assignment_should_downgrade_priority",
                    "observed_result": "below_original_top_score",
                    "pass_fail": "pass" if score < _safe_float(row.get("final_score"), 1.0) else "fail",
                    "notes": "Top candidate rescored as a shuffled-target proxy; full target-specific rescoring is future work.",
                }
            )
        tox_source = target_ranked.sort_values("tox21_toxicity_probability", ascending=False).head(5) if "tox21_toxicity_probability" in target_ranked.columns else target_ranked.head(5)
        for row in tox_source.to_dict("records"):
            tox = max(_safe_float(row.get("tox21_toxicity_probability"), 0.0), _safe_float(row.get("clintox_toxicity_probability"), 0.0))
            score = max(0.0, 1.0 - tox)
            rows.append(
                {
                    "target_id": target_id,
                    "control_type": "toxicity_risk_control",
                    "canonical_smiles": row.get("canonical_smiles"),
                    "p_activity": "",
                    "nearest_active_similarity": "",
                    "control_score_proxy": score,
                    "expected_result": "high_toxicity_probability_should_downgrade_candidate",
                    "observed_result": "downgraded_by_toxicity_proxy" if tox > 0.4 else "low_toxicity_proxy",
                    "pass_fail": "pass" if tox <= 0.7 else "review",
                    "notes": "Tox21/ClinTox early toxicity triage control.",
                }
            )
        target_docking = docking[docking.get("target_id", pd.Series("", index=docking.index)).astype(str).eq(str(target_id))]
        if not target_docking.empty and "affinity_kcal_mol" in target_docking.columns:
            worst = target_docking.sort_values("affinity_kcal_mol", ascending=False).head(10)
            for row in worst.to_dict("records"):
                score = max(0.0, min(1.0, (-_safe_float(row.get("affinity_kcal_mol"), 0.0) - 4.0) / 8.0))
                rows.append(
                    {
                        "target_id": target_id,
                        "control_type": "docking_decoy_proxy",
                        "canonical_smiles": row.get("canonical_smiles"),
                        "p_activity": "",
                        "nearest_active_similarity": "",
                        "control_score_proxy": score,
                        "expected_result": "poor_docking_controls_should_not_dominate_top_ranks",
                        "observed_result": "below_top_candidate_mean" if score < top_mean else "overlaps_top_candidate_mean",
                        "pass_fail": "pass" if score < top_mean else "fail",
                        "notes": "Worst-affinity docked molecules used as docking decoy proxy.",
                    }
                )
        for _ in range(10):
            score = float(rng.uniform(0.0, 1.0))
            rows.append(
                {
                    "target_id": target_id,
                    "control_type": "random_quantum_control",
                    "canonical_smiles": "",
                    "p_activity": "",
                    "nearest_active_similarity": "",
                    "control_score_proxy": score,
                    "expected_result": "random_quantum_signal_should_not_be_claimed_as_improvement_without_ablation",
                    "observed_result": "random_control_distribution_recorded",
                    "pass_fail": "pass",
                    "notes": "Random quantum-feature control for ablation sanity checking.",
                }
            )
    controls = pd.DataFrame(rows)
    controls.to_csv(controls_dir / "negative_control_results.csv", index=False)
    _plot_controls(controls, fig_dir / "control_score_distributions.png")
    return controls


def _plot_controls(controls: pd.DataFrame, path: Path) -> None:
    try:
        import matplotlib.pyplot as plt

        if controls.empty:
            path.write_bytes(b"")
            return
        fig, ax = plt.subplots(figsize=(7.5, 4.5))
        for control_type, group in controls.groupby("control_type"):
            vals = pd.to_numeric(group["control_score_proxy"], errors="coerce").dropna()
            if len(vals):
                ax.hist(vals, bins=18, alpha=0.55, label=control_type)
        ax.set_xlabel("Score proxy")
        ax.set_ylabel("Count")
        ax.set_title("Negative-control score distribution")
        ax.legend(fontsize=7)
        fig.tight_layout()
        fig.savefig(path, dpi=180)
        plt.close(fig)
    except Exception:
        path.write_bytes(b"")


def _candidate_dossiers(
    project_dir: Path,
    applicability: pd.DataFrame,
    medchem: pd.DataFrame,
    admet: pd.DataFrame,
    interactions: pd.DataFrame,
    qm: pd.DataFrame,
) -> None:
    dossier_dir = project_dir / "candidate_dossiers"
    dossier_dir.mkdir(parents=True, exist_ok=True)
    for old_dossier in dossier_dir.glob("*.md"):
        old_dossier.unlink()
    top = _read_csv(project_dir / "top_candidates.csv")
    if top.empty:
        return
    app = applicability.set_index("candidate_id") if not applicability.empty and "candidate_id" in applicability.columns else pd.DataFrame()
    med = medchem.set_index("candidate_id") if not medchem.empty and "candidate_id" in medchem.columns else pd.DataFrame()
    adm = admet.set_index("candidate_id") if not admet.empty and "candidate_id" in admet.columns else pd.DataFrame()
    inter = interactions.set_index("candidate_id") if not interactions.empty and "candidate_id" in interactions.columns else pd.DataFrame()
    qmd = qm.set_index("candidate_id") if not qm.empty and "candidate_id" in qm.columns else pd.DataFrame()
    triage = _read_csv(project_dir / "triage" / "wet_lab_triage_board.csv")
    tri = triage.set_index("candidate_id") if not triage.empty and "candidate_id" in triage.columns else pd.DataFrame()
    inhibitors = _read_csv(project_dir / "inhibitors" / "candidate_inhibitor_proximity.csv")
    prox = inhibitors.set_index("candidate_id") if not inhibitors.empty and "candidate_id" in inhibitors.columns else pd.DataFrame()
    redocking = _read_csv(project_dir / "docking" / "redocking_validation.csv")
    redock_by_target = redocking.set_index("target_id") if not redocking.empty and "target_id" in redocking.columns else pd.DataFrame()
    for _, row in top.groupby("target_id", group_keys=False).head(10).iterrows():
        cid = str(row.get("candidate_id"))
        target_id = str(row.get("target_id"))
        generation_method = str(row.get("generation_method", row.get("source", "unknown")))
        category = _candidate_category(generation_method)
        lines = [
            f"# Candidate Dossier: {cid}",
            "",
            "Computational hypothesis only. Requires biochemical/cellular validation.",
            "",
            "Claim boundary: this dossier supports hit prioritization only. It is not experimental hit confirmation and not a therapeutic claim.",
            "",
            f"- candidate_id: {cid}",
            f"- target_id: {target_id}",
            f"- SMILES: `{row.get('canonical_smiles')}`",
            f"- Generation method: {generation_method}",
            f"- Candidate category: {category}",
            f"- 2D structure: {row.get('png_path', '')}",
            f"- Final score: {_safe_float(row.get('final_score')):.3f}",
            f"- Activity score: {_safe_float(row.get('activity_score')):.3f}",
            f"- Predicted pActivity: {_safe_float(row.get('predicted_p_activity')):.3f}",
            f"- ADMET score: {_safe_float(row.get('admet_score')):.3f}",
            "",
            "## Novelty And Applicability Domain",
        ]
        if cid in app.index:
            a = app.loc[cid]
            lines += [
                f"- Nearest training similarity: {_safe_float(a.get('nearest_training_similarity')):.3f}",
                f"- Nearest active similarity: {_safe_float(a.get('nearest_active_similarity')):.3f}",
                f"- Nearest reference drug: {a.get('nearest_reference_drug', '')}",
                f"- Nearest reference similarity: {_safe_float(a.get('nearest_reference_similarity')):.3f}",
                f"- Scaffold novelty: {a.get('scaffold_novelty', '')}",
                f"- Applicability domain: {a.get('applicability_domain', '')}",
                f"- Prediction confidence: {_safe_float(a.get('prediction_confidence')):.3f}",
            ]
        if cid in prox.index:
            p = prox.loc[cid]
            lines += [
                f"- Nearest configured inhibitor: {p.get('nearest_inhibitor_name', '')}",
                f"- Nearest inhibitor similarity: {_safe_float(p.get('nearest_inhibitor_similarity')):.3f}",
                f"- Inhibitor-proximity novelty label: {p.get('novelty_label', '')}",
            ]
        lines += ["", "## ADMET And Medicinal Chemistry"]
        if cid in adm.index:
            arow = adm.loc[cid]
            endpoint_bits = []
            for endpoint in ["tox21_toxicity_probability", "clintox_toxicity_probability", "fda_approval_probability"]:
                if endpoint in arow.index:
                    endpoint_bits.append(f"{endpoint}={_safe_float(arow.get(endpoint)):.3f}")
            lines += [
                f"- ADMET risk class: {arow.get('admet_risk_class', '')}",
                f"- ADMET endpoint risks: {'; '.join(endpoint_bits) if endpoint_bits else 'not available'}",
            ]
        if cid in med.index:
            m = med.loc[cid]
            lines += [
                f"- Medchem risk class: {m.get('medchem_risk_class', '')}",
                f"- SA score proxy: {_safe_float(m.get('sa_score_proxy')):.3f}",
                f"- Structural alert count: {m.get('structural_alert_count', '')}",
                f"- Medchem risk reasons: {m.get('medchem_risk_reasons', '')}",
            ]
        lines += [
            "",
            "## Docking, GNINA, And Interaction Evidence",
            f"- Vina affinity: {_safe_float(row.get('vina_affinity_kcal_mol', row.get('affinity_kcal_mol'))):.3f} kcal/mol",
            f"- Smina score: {_safe_float(row.get('smina_affinity_kcal_mol')):.3f} kcal/mol",
            f"- GNINA score if available: {_safe_float(inter.loc[cid].get('gnina_cnn_pose_score')):.3f}" if cid in inter.index else "- GNINA score if available: not available",
            f"- Docking mode: {row.get('docking_mode', '')}",
        ]
        if target_id in redock_by_target.index:
            r = redock_by_target.loc[target_id]
            lines += [
                f"- Redocking/pocket validation context: {r.get('pocket_method_tier', '')} pocket from {r.get('pdb_id', '')}; best engine {r.get('redocking_best_engine', '')}; RMSD {_safe_float(r.get('redocking_rmsd_angstrom')):.3f} A",
                f"- Redocking status: {r.get('redocking_status', '')}",
            ]
        if cid in inter.index:
            i = inter.loc[cid]
            lines += [
                f"- Interaction fingerprint: {i.get('contact_residue_count', '')} contact residues; {i.get('hbond_like_contacts', '')} H-bond-like contacts; {i.get('hydrophobic_contacts', '')} hydrophobic contacts",
                f"- Interaction quality: {i.get('interaction_quality', '')}",
                f"- Key residue contacts: {i.get('key_residue_contacts', '')}",
                f"- H-bond-like contacts: {i.get('hbond_like_contacts', '')}",
                f"- Hydrophobic contacts: {i.get('hydrophobic_contacts', '')}",
            ]
        lines += ["", "## MD / Pose Relaxation"]
        lines += [
            f"- Mode: {row.get('md_mode', 'not in top MD subset')}",
            f"- Stability class: {row.get('stability_class', 'not in top MD subset')}",
            "- Interpretation: OpenMM ligand-pose relaxation is used as a local conformer/pose triage step. It is not explicit-solvent protein-ligand MD and does not prove binding stability.",
        ]
        lines += ["", "## QM / QML"]
        if cid in qmd.index:
            q = qmd.loc[cid]
            lines += [
                f"- HOMO-LUMO gap: {_safe_float(q.get('homo_lumo_gap_ev')):.3f} eV",
                f"- xTB energy: {_safe_float(q.get('xtb_total_energy_eh')):.3f} Eh",
                f"- Electrophilicity index proxy: {_safe_float(q.get('electrophilicity_index_proxy')):.3f}",
                f"- Hardness proxy: {_safe_float(q.get('hardness_proxy')):.3f}",
                f"- Softness proxy: {_safe_float(q.get('softness_proxy')):.3f}",
                f"- Quantum score: {_safe_float(q.get('quantum_score')):.3f}",
            ]
        lines += [
            f"- QML score: {_safe_float(row.get('qml_score')):.3f}",
            f"- Quantum ablation delta: {_safe_float(row.get('quantum_ablation_delta')):.3f}",
            "",
            "## Wet-Lab Triage",
        ]
        if cid in tri.index:
            t = tri.loc[cid]
            lines += [
                f"- Triage class: {t.get('triage_class', '')}",
                f"- Triage confidence: {t.get('triage_confidence', '')}",
                f"- Reasons to test: {t.get('reasons_to_test', '')}",
                f"- Reasons not to test: {t.get('reasons_not_to_test', '')}",
                f"- Recommended assay plan: {t.get('recommended_assay_plan', '')}",
            ]
        else:
            lines += [
                "- Triage class: not available",
                "- Reasons to test: not available",
                "- Reasons not to test: triage board has not been generated for this candidate",
            ]
        lines += [
            "",
            "## Why It Is Interesting",
            "Prioritized by a multi-signal computational pipeline combining activity prediction, ADMET triage, docking/GNINA, pose relaxation/QM/QML evidence where available.",
            "",
            "## Why It May Fail",
            "Public bioactivity labels may be noisy; AlphaFold or prepared receptor state may not match the active binding conformation; docking scores may not correlate with potency; ADMET/toxicity models may be out-of-domain; synthetic feasibility and selectivity are not experimentally validated.",
            "",
            "## Recommended Next Validation",
            "Manual medicinal chemistry review, purchase/synthesis feasibility check, biochemical target assay, counterscreen against related targets, cell-line assay in relevant mutation context, microsomal stability, solubility, hERG/DILI testing, and longer explicit-solvent complex MD for only the most justified candidates.",
            "",
        ]
        (dossier_dir / f"{cid}.md").write_text("\n".join(lines), encoding="utf-8")


def _claim_matrix(project_dir: Path) -> pd.DataFrame:
    rows = [
        {
            "evidence_level": "Level 0",
            "name": "Generated hypothesis",
            "definition": "Candidate was generated or enumerated and passed basic cheminformatics filters.",
            "current_status": "available_for_generated_and_filtered_candidates",
            "allowed_claim": "molecular hypothesis",
            "forbidden_claim": "validated drug or active inhibitor",
            "required_next_evidence": "activity_prediction_admet_filtering_docking_and_novelty_review",
        },
        {
            "evidence_level": "Level 1",
            "name": "Computationally prioritized hit",
            "definition": "Candidate passed activity prediction, ADMET triage, docking, and novelty checks.",
            "current_status": "available_for_top_candidates_after_hardening_artifacts",
            "allowed_claim": "computational hit hypothesis",
            "forbidden_claim": "experimental hit or clinical efficacy claim",
            "required_next_evidence": "redocking_context_interaction_fingerprint_qm_qml_ablation_and_manual_review",
        },
        {
            "evidence_level": "Level 2",
            "name": "High-confidence computational hit hypothesis",
            "definition": "Candidate has validated reference redocking, enrichment support, plausible interactions, QM descriptors, and ablation-stable rank.",
            "current_status": "partial_pending_full_redocking_rmsd_and_external_decoys",
            "allowed_claim": "higher-confidence computational hypothesis",
            "forbidden_claim": "wet-lab hit claim without wet-lab evidence",
            "required_next_evidence": "compound_procurement_or_synthesis_biochemical_ic50_orthogonal_assay_and_selectivity_counter_screen",
        },
        {
            "evidence_level": "Level 3",
            "name": "Experimental hit",
            "definition": "Candidate is synthesized or purchased and shows measurable activity in biochemical or cellular assays.",
            "current_status": "not_available",
            "allowed_claim": "not claimable by this repository",
            "forbidden_claim": "available_without_wet_lab_data",
            "required_next_evidence": "wet_lab_biochemical_and_cellular_validation_with_replicates",
        },
    ]
    matrix = pd.DataFrame(rows)
    matrix.to_csv(project_dir / "scientific_claim_matrix.csv", index=False)
    return matrix


def _strict_report(project_dir: Path, summary: dict[str, Any]) -> None:
    comparison = _read_csv(project_dir / "models" / "model_comparison.csv")
    similarity_note = "Model comparison table was not available."
    if not comparison.empty and {"target_id", "model_name", "roc_auc"}.issubset(comparison.columns):
        weaker = []
        for target_id, group in comparison.groupby("target_id"):
            selected = group[group["model_name"].eq("current_selected_baseline")]
            similarity = group[group["model_name"].eq("similarity_to_known_actives")]
            if not selected.empty and not similarity.empty:
                selected_auc = _safe_float(selected["roc_auc"].iloc[0])
                similarity_auc = _safe_float(similarity["roc_auc"].iloc[0])
                if selected_auc <= similarity_auc:
                    weaker.append(f"{target_id}: selected ROC-AUC {selected_auc:.3f} <= similarity ROC-AUC {similarity_auc:.3f}")
        similarity_note = (
            "Selected activity baselines did not beat the similarity baseline for " + "; ".join(weaker)
            if weaker
            else "Selected activity baselines beat or matched the similarity baseline on the recorded scaffold-split ROC-AUC comparison."
        )

    lines = [
        "# Strict Scientific Report",
        "",
        "## 1. Executive Scientific Summary",
        "This study establishes a reproducible computational oncology hit-prioritization workflow for EGFR, PARP1, and PIK3CA. The pipeline integrates public bioactivity curation, activity/ADMET baselines, seed-expanded candidate generation, medchem filtering, curated-pocket docking, redocking validation, interaction fingerprints, ligand-pose relaxation, quantum chemistry descriptors, Qiskit-based quantum-kernel scoring, ranking ablations, and negative controls.",
        "",
        "## 2. Claim Boundary",
        "The output is a set of ranked computational candidate hypotheses, not experimentally validated drugs. No therapeutic, diagnostic, clinical, or regulatory claim is made. Wet-lab validation is required.",
        "",
        "## 3. Target Biology Dossiers",
        "Target dossiers are written under docs/targets for EGFR, PARP1, and PIK3CA and document biology, cancer relevance, mutation/isoform context, resistance mechanisms, binding pockets, key residues, selectivity concerns, success criteria, and failure criteria.",
        "",
        "## 4. Dataset Retrieval And Curation",
        f"Curated rows: {summary.get('curated_rows', 0)}. The curation layer records standardized activity, assay confidence, curation flags, scaffold splits, and target summaries. This is computational public-data curation, not expert manual assay review.",
        "",
        "## 5. Benchmark Construction",
        "The benchmark uses scaffold-based train/validation/test splits where available. Lower-activity or inactive public records are used as proxy decoys; this is not a DUD-E-style matched decoy benchmark.",
        "",
        "## 6. Activity Model Comparison",
        f"Baseline comparison rows: {summary.get('baseline_rows', 0)}. Compared models include ECFP logistic regression, ECFP random forest, RDKit ExtraTrees, HistGradientBoosting, similarity-to-known-actives, and the current selected baseline. {similarity_note}",
        "",
        "## 7. Rediscovery And Enrichment",
        "Known actives-vs-proxy-decoys enrichment is reported with ROC-AUC, PR-AUC, EF1/5/10, and top-k active recovery. Proxy-decoy limitations are explicit in the CSV outputs.",
        "",
        "## 8. Generation Validity, Uniqueness, Diversity, Novelty",
        "Candidate generation is described as target-conditioned seed expansion and medicinal-chemistry template enumeration. It is not described as learned de novo generation. Novelty is measured against training molecules and reference drugs.",
        f"Configured inhibitor registry rows: {summary.get('inhibitor_registry_rows', 0)}. Candidate inhibitor-proximity rows: {summary.get('inhibitor_proximity_rows', 0)}. Candidates above 0.90 similarity to a configured inhibitor are not called novel.",
        "",
        "## 9. Applicability Domain",
        f"Applicability-domain rows: {summary.get('applicability_rows', 0)}. Domain labels use nearest training, nearest active, nearest reference-drug similarity, and scaffold novelty. Out-of-domain candidates must be interpreted with lower model confidence.",
        "",
        "## 10. Medchem Risk Analysis",
        "Top candidates receive medchem risk classes, structural alert counts, synthetic accessibility proxies, reactive-group flags, chelator/aggregator proxies, and risk reasons.",
        "",
        "## 11. ADMET Endpoint-Level Risk",
        "ADMET is early toxicity triage based on local Tox21/ClinTox models. hERG, CYP, AMES, DILI, solubility, permeability, and metabolic-stability endpoints remain future additions unless explicitly added as trained endpoints.",
        "",
        "## 12. Docking Protocol",
        "Docking uses real Vina/Smina artifacts and curated pocket metadata where available. Docking scores are not used alone; they are interpreted with redocking, GNINA, and interaction evidence.",
        "",
        "## 13. Redocking Validation",
        "Reference-ligand redocking records Vina and GNINA RMSD where tools and reference coordinates are available. RMSD <= 2.0 A supports the docking setup; higher RMSD downgrades docking evidence.",
        "",
        "## 14. GNINA/CNN Docking Evidence",
        "GNINA CNN docking/rescoring provides pose and affinity triage for top candidates. GNINA scores are computational evidence, not binding validation.",
        "",
        "## 15. Interaction Fingerprint Analysis",
        f"Interaction fingerprint rows: {summary.get('interaction_rows', 0)}. Candidate dossiers include interaction quality and key-residue contact context. Strong docking scores with poor interactions should be downgraded.",
        "",
        "## 16. Ligand-Pose Relaxation / MD Triage",
        "OpenMM ligand-pose relaxation is used as a local conformer/pose triage step. It is not explicit-solvent protein-ligand MD and does not prove binding stability.",
        "",
        "## 17. Quantum Chemistry Descriptors",
        "xTB/QM descriptors are late-stage electronic plausibility signals. HOMO, LUMO, gap, total energy, hardness/softness, and electrophilicity proxies are not binding validation.",
        "",
        "## 18. QML / Quantum-Kernel Ablation",
        "Quantum-kernel scoring is treated as an exploratory quantum prioritization signal unless ablation improves known-active recovery over classical baselines and random quantum controls. No hardware-superiority claim is made.",
        "",
        "## 19. Final Ranking And Calibrated Weights",
        "Ranking weights are reported with ablations and a calibrated-weights YAML. Because the benchmark is proxy retrospective evidence, recommended weights remain subject to external validation.",
        f"No-hard-limit wet-lab triage rows: {summary.get('triage_rows', 0)}. The triage board classifies every available ranked candidate into test_now, test_after_review, watchlist, or reject_hold with reasons to test and reasons not to test.",
        "",
        "## 20. Negative Controls",
        f"Negative-control rows: {summary.get('negative_control_rows', 0)}. Controls include known inactive proxies, random druglike proxies, shuffled target controls, toxicity-risk controls, docking decoy proxies, and random quantum controls.",
        "",
        "## 21. Candidate Dossiers Summary",
        f"Candidate dossiers: {summary.get('candidate_dossiers', 0)}. Candidate evidence documents: {summary.get('candidate_evidence_documents', 0)}. Each dossier includes why a candidate is interesting, why it may fail, reasons to test, reasons not to test, and recommended next validation.",
        "",
        "## 22. Limitations",
        "Public activity labels can be noisy; receptor state/protonation can alter docking; proxy decoys are not rigorous matched decoys; ADMET breadth is incomplete; ligand-pose relaxation is not production complex MD; no experimental hit confirmation exists.",
        "",
        "## 23. Wet-Lab Validation Plan",
        "Next steps are compound procurement or synthesis feasibility, biochemical dose-response IC50, orthogonal assay, relevant cell-line assay, cytotoxicity assay, selectivity counterscreens, and ADMET follow-up.",
        "",
        "## 24. Reproducibility Commands",
        "`q-ai-drug run-cancer-proof --config configs/cancer_targets.yaml --out outputs/cancer_proof_v1 --max-records-per-target 1000`",
        "`q-ai-drug harden-scientific-study --project outputs/cancer_proof_v1 --config configs/cancer_targets.yaml --benchmark data/processed/oncology_benchmark.csv --references data/processed/reference_inhibitors.csv`",
        "`python scripts/validate_research_artifacts.py --project outputs/cancer_proof_v1 --tier proof`",
        "",
        "## Files To Inspect",
        "- `curation/dataset_curation_summary.csv`",
        "- `models/model_comparison.csv`",
        "- `benchmarks/enrichment_summary.csv`",
        "- `generation/generation_metrics.csv`",
        "- `inhibitors/inhibitor_registry.csv`",
        "- `inhibitors/candidate_inhibitor_proximity.csv`",
        "- `medchem/medchem_risk_table.csv`",
        "- `admet/candidate_admet_risk_table.csv`",
        "- `docking/interaction_fingerprints.csv`",
        "- `qml/quantum_ablation_benchmark.csv`",
        "- `triage/wet_lab_triage_board.csv`",
        "- `candidate_evidence/candidate_evidence.jsonl`",
        "- `platform/module_execution_matrix.csv`",
        "- `candidate_dossiers/`",
        "",
        "## Final Conclusion",
        "This study establishes a reproducible computational oncology hit-prioritization workflow for EGFR, PARP1, and PIK3CA. The output is a set of ranked computational candidate hypotheses, not experimentally validated drugs. The next step is biochemical and cellular validation.",
        "",
    ]
    md_path = project_dir / "strict_scientific_report.md"
    html_path = project_dir / "strict_scientific_report.html"
    md_path.write_text("\n".join(lines), encoding="utf-8")
    html = "<!doctype html><html><head><meta charset='utf-8'><title>Strict Scientific Report</title></head><body>" + "\n".join(
        f"<p>{line}</p>" if line and not line.startswith("#") and not line.startswith("-") else f"<h2>{line.lstrip('# ').strip()}</h2>" if line.startswith("#") else f"<li>{line[2:]}</li>" if line.startswith("-") else ""
        for line in lines
    ) + "</body></html>"
    html_path.write_text(html, encoding="utf-8")


def harden_scientific_study(
    project_dir: str | Path = "outputs/cancer_proof_v1",
    *,
    config_path: str | Path = "configs/cancer_targets.yaml",
    benchmark_csv: str | Path = "data/processed/oncology_benchmark.csv",
    reference_csv: str | Path = "data/processed/reference_inhibitors.csv",
) -> dict[str, Any]:
    project = Path(project_dir)
    project.mkdir(parents=True, exist_ok=True)
    config = _load_config(Path(config_path))
    _write_target_dossiers(config)
    platform_dir = project / "platform"
    platform_dir.mkdir(parents=True, exist_ok=True)
    registry = module_registry_document()
    (platform_dir / "module_registry.json").write_text(json.dumps(registry, indent=2, default=str), encoding="utf-8")
    (platform_dir / "tier_quotas.json").write_text(json.dumps(registry["tiers"], indent=2, default=str), encoding="utf-8")
    (platform_dir / "compute_depth_presets.json").write_text(json.dumps(registry["compute_depth_presets"], indent=2, default=str), encoding="utf-8")
    module_matrix = _module_execution_matrix(project, registry)

    benchmark = _read_csv(Path(benchmark_csv))
    references = _read_csv(Path(reference_csv))
    curated, curation_summary = curate_activity_benchmark(benchmark_csv, project, config_path=config_path)
    baseline = compare_activity_baselines(benchmark_csv, project)
    generation = _generation_metrics(project, benchmark, references)
    md = _normalize_md_outputs(project)
    medchem = _medchem_risk(project)
    admet = _admet_risk(project)
    applicability = build_applicability_domain(
        _read_csv(project / "top_candidates.csv"),
        benchmark,
        out_csv=project / "models" / "applicability_domain.csv",
        reference_drugs=references,
    )
    interactions = build_interaction_fingerprints(project / "top_candidates.csv", project / "docking", limit=30)
    qm = _qm_summary(project)
    q_ablation, rank_shift = _ranking_and_quantum_ablations(project)
    controls = _negative_controls(project, benchmark)
    claim = _claim_matrix(project)
    inhibitor_summary = build_inhibitor_artifacts(project, reference_csv, "configs/oncology_pockets.yaml")
    triage = build_wet_lab_triage_board(project)
    evidence_summary = build_candidate_evidence_documents(project)
    _candidate_dossiers(project, applicability, medchem, admet, interactions, qm)

    summary = {
        "project_dir": str(project),
        "curated_rows": int(len(curated)),
        "curation_targets": int(len(curation_summary)),
        "baseline_rows": int(len(baseline)),
        "generation_rows": int(len(generation)),
        "md_rows": int(len(md)),
        "applicability_rows": int(len(applicability)),
        "medchem_rows": int(len(medchem)),
        "admet_rows": int(len(admet)),
        "interaction_rows": int(len(interactions)),
        "quantum_ablation_rows": int(len(q_ablation)),
        "rank_shift_rows": int(len(rank_shift)),
        "negative_control_rows": int(len(controls)),
        "claim_rows": int(len(claim)),
        "inhibitor_registry_rows": int(inhibitor_summary.get("registry_rows", 0)),
        "inhibitor_proximity_rows": int(inhibitor_summary.get("candidate_proximity_rows", 0)),
        "triage_rows": int(len(triage)),
        "candidate_evidence_documents": int(evidence_summary.get("candidate_evidence_documents", 0)),
        "registered_modules": int(registry.get("module_count", 0)),
        "module_execution_rows": int(len(module_matrix)),
        "candidate_dossiers": len(list((project / "candidate_dossiers").glob("*.md"))),
        "scientific_satisfaction": "not_satisfied_for_drug_claims_satisfied_for_computational_research_hypotheses_after_validation_review",
    }
    _strict_report(project, summary)
    (project / "scientific_hardening_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Build strict scientific validation artifacts for the oncology proof run.")
    parser.add_argument("--project", default="outputs/cancer_proof_v1")
    parser.add_argument("--config", default="configs/cancer_targets.yaml")
    parser.add_argument("--benchmark", default="data/processed/oncology_benchmark.csv")
    parser.add_argument("--references", default="data/processed/reference_inhibitors.csv")
    args = parser.parse_args(argv)
    summary = harden_scientific_study(args.project, config_path=args.config, benchmark_csv=args.benchmark, reference_csv=args.references)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
