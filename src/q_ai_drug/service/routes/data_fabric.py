from __future__ import annotations

import hashlib
import json
import math
import os
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from fastapi import APIRouter
from pydantic import BaseModel, Field

from q_ai_drug.service.routes.ai_models import ai_model_status_payload

try:
    from rdkit import Chem
    from rdkit.Chem import Crippen, Descriptors, Lipinski, QED, rdMolDescriptors
except Exception:
    Chem = None
    Crippen = None
    Descriptors = None
    Lipinski = None
    QED = None
    rdMolDescriptors = None


router = APIRouter(prefix="/v1/research", tags=["data-fabric"])

CACHE_DIR = Path(os.getenv("QAI_REALTIME_CACHE_DIR", "data/research_resources/realtime_cache"))
DEFAULT_TTL_SECONDS = int(os.getenv("QAI_REALTIME_CACHE_TTL_SECONDS", str(24 * 60 * 60)))
USER_AGENT = "q-ai-drug-realtime-data-fabric/0.1"

CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data"
PUBCHEM_API = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
UNIPROT_API = "https://rest.uniprot.org/uniprotkb"
OPEN_TARGETS_GRAPHQL = "https://api.platform.opentargets.org/api/v4/graphql"


class FabricTarget(BaseModel):
    gene: str = Field(..., min_length=1, max_length=64)
    uniprot: str | None = Field(default=None, max_length=64)
    ensembl_id: str | None = Field(default=None, max_length=64)
    role: str | None = Field(default=None, max_length=256)


class FabricLigand(BaseModel):
    candidate_id: str | None = Field(default=None, max_length=128)
    smiles: str | None = Field(default=None, max_length=4096)
    chembl_id: str | None = Field(default=None, max_length=64)
    target: str | None = Field(default=None, max_length=64)


class DataFabricRequest(BaseModel):
    targets: list[FabricTarget] = Field(default_factory=list, max_length=25)
    ligands: list[FabricLigand] = Field(default_factory=list, max_length=250)
    diagnosis: str | None = Field(default=None, max_length=500)
    max_chembl_activities: int = Field(default=80, ge=1, le=500)
    max_ligands: int = Field(default=60, ge=1, le=250)
    ttl_seconds: int = Field(default=DEFAULT_TTL_SECONDS, ge=60, le=7 * 24 * 60 * 60)
    use_live: bool = True


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cache_key(namespace: str, payload: Any) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()
    return CACHE_DIR / namespace / f"{digest}.json"


def _cache_read(path: Path, ttl_seconds: int) -> Any | None:
    if not path.exists():
        return None
    age = time.time() - path.stat().st_mtime
    if age > ttl_seconds:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _cache_write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def _get_json(namespace: str, url: str, params: dict[str, Any] | None, ttl_seconds: int, use_live: bool = True) -> dict[str, Any]:
    key = _cache_key(namespace, {"url": url, "params": params or {}})
    cached = _cache_read(key, ttl_seconds)
    if cached is not None:
        return {"status": "cached", "cache_path": key.as_posix(), "payload": cached}
    if not use_live:
        return {"status": "cache_miss", "cache_path": key.as_posix(), "payload": None}
    response = requests.get(url, params=params, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}, timeout=40)
    response.raise_for_status()
    payload = response.json()
    _cache_write(key, payload)
    return {"status": "live", "cache_path": key.as_posix(), "payload": payload}


def _post_json(namespace: str, url: str, body: dict[str, Any], ttl_seconds: int, use_live: bool = True) -> dict[str, Any]:
    key = _cache_key(namespace, {"url": url, "body": body})
    cached = _cache_read(key, ttl_seconds)
    if cached is not None:
        return {"status": "cached", "cache_path": key.as_posix(), "payload": cached}
    if not use_live:
        return {"status": "cache_miss", "cache_path": key.as_posix(), "payload": None}
    response = requests.post(url, json=body, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}, timeout=40)
    response.raise_for_status()
    payload = response.json()
    _cache_write(key, payload)
    return {"status": "live", "cache_path": key.as_posix(), "payload": payload}


def _values(rows: list[dict[str, Any]], key: str) -> list[float]:
    values: list[float] = []
    for row in rows:
        value = row.get(key)
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(number):
            values.append(number)
    return values


def _summarize_activities(rows: list[dict[str, Any]]) -> dict[str, Any]:
    pchembl = _values(rows, "pchembl_value")
    standard_values = _values(rows, "standard_value")
    types = sorted({str(row.get("standard_type")) for row in rows if row.get("standard_type")})
    units = sorted({str(row.get("standard_units")) for row in rows if row.get("standard_units")})
    molecules = sorted({str(row.get("molecule_chembl_id")) for row in rows if row.get("molecule_chembl_id")})
    assays = sorted({str(row.get("assay_chembl_id")) for row in rows if row.get("assay_chembl_id")})
    return {
        "activity_count": len(rows),
        "unique_molecule_count": len(molecules),
        "assay_count": len(assays),
        "standard_types": types[:12],
        "standard_units": units[:8],
        "pchembl": {
            "count": len(pchembl),
            "median": round(statistics.median(pchembl), 3) if pchembl else None,
            "max": round(max(pchembl), 3) if pchembl else None,
            "min": round(min(pchembl), 3) if pchembl else None,
        },
        "standard_value": {
            "count": len(standard_values),
            "median": round(statistics.median(standard_values), 3) if standard_values else None,
        },
        "example_molecules": molecules[:10],
        "example_assays": assays[:10],
    }


def _chembl_target_payload(target: FabricTarget, request: DataFabricRequest) -> dict[str, Any]:
    gene = target.gene.strip()
    out: dict[str, Any] = {
        "gene": gene,
        "uniprot": target.uniprot,
        "role": target.role,
        "source": "ChEMBL target/search + activity endpoints",
    }
    try:
        search = _get_json(
            "chembl_target_search",
            f"{CHEMBL_API}/target/search.json",
            {"q": gene, "limit": 8},
            request.ttl_seconds,
            request.use_live,
        )
        hits = (search["payload"] or {}).get("targets") or []
        human_hits = [
            hit
            for hit in hits
            if str(hit.get("organism", "")).lower() == "homo sapiens"
            and (gene.upper() in str(hit.get("pref_name", "")).upper() or gene.upper() in str(hit.get("target_components", "")).upper())
        ]
        chosen = (human_hits or hits or [{}])[0]
        chembl_id = chosen.get("target_chembl_id")
        out.update({"status": search["status"], "chembl_target_id": chembl_id, "target_name": chosen.get("pref_name"), "organism": chosen.get("organism")})
        if chembl_id:
            activity = _get_json(
                "chembl_activity",
                f"{CHEMBL_API}/activity.json",
                {
                    "target_chembl_id": chembl_id,
                    "limit": request.max_chembl_activities,
                    "standard_type__in": "IC50,Ki,Kd,EC50,GI50",
                },
                request.ttl_seconds,
                request.use_live,
            )
            rows = (activity["payload"] or {}).get("activities") or []
            out["activity_source_status"] = activity["status"]
            out["activity_summary"] = _summarize_activities(rows)
            out["activity_examples"] = rows[: min(12, len(rows))]
        else:
            out["activity_summary"] = _summarize_activities([])
    except Exception as exc:
        out.update({"status": "error", "error": str(exc)[:700], "activity_summary": _summarize_activities([])})
    return out


def _uniprot_payload(target: FabricTarget, request: DataFabricRequest) -> dict[str, Any] | None:
    if not target.uniprot:
        return None
    try:
        result = _get_json("uniprot_entry", f"{UNIPROT_API}/{quote(target.uniprot)}.json", None, request.ttl_seconds, request.use_live)
        payload = result["payload"] or {}
        sequence = payload.get("sequence") or {}
        comments = payload.get("comments") or []
        keywords = payload.get("keywords") or []
        return {
            "status": result["status"],
            "accession": target.uniprot,
            "protein_name": ((payload.get("proteinDescription") or {}).get("recommendedName") or {}).get("fullName", {}).get("value"),
            "organism": (payload.get("organism") or {}).get("scientificName"),
            "sequence_length": sequence.get("length"),
            "sequence_mass": sequence.get("molWeight"),
            "keywords": [item.get("name") for item in keywords[:12] if item.get("name")],
            "comment_types": sorted({comment.get("commentType") for comment in comments if comment.get("commentType")})[:12],
        }
    except Exception as exc:
        return {"status": "error", "accession": target.uniprot, "error": str(exc)[:500]}


def _open_targets_payload(target: FabricTarget, request: DataFabricRequest) -> dict[str, Any] | None:
    if not target.ensembl_id:
        return {"status": "not_run", "reason": "ensembl_id missing"}
    query = """
    query targetDiseases($ensgId: String!) {
      target(ensemblId: $ensgId) {
        id
        approvedSymbol
        approvedName
        associatedDiseases(page: {index: 0, size: 8}) {
          count
          rows {
            score
            disease { id name }
            datatypeScores { id score }
          }
        }
      }
    }
    """
    try:
        result = _post_json(
            "open_targets_associated_diseases",
            OPEN_TARGETS_GRAPHQL,
            {"query": query, "variables": {"ensgId": target.ensembl_id}},
            request.ttl_seconds,
            request.use_live,
        )
        target_payload = ((result["payload"] or {}).get("data") or {}).get("target") or {}
        diseases = (target_payload.get("associatedDiseases") or {}).get("rows") or []
        return {
            "status": result["status"],
            "ensembl_id": target.ensembl_id,
            "approved_symbol": target_payload.get("approvedSymbol"),
            "disease_count": (target_payload.get("associatedDiseases") or {}).get("count"),
            "top_diseases": diseases,
        }
    except Exception as exc:
        return {"status": "error", "ensembl_id": target.ensembl_id, "error": str(exc)[:500]}


def _rdkit_ligand_payload(smiles: str | None) -> dict[str, Any] | None:
    if not smiles or Chem is None:
        return None
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return {"status": "error", "error": "SMILES could not be parsed by RDKit."}
    return {
        "status": "computed",
        "canonical_smiles": Chem.MolToSmiles(mol, canonical=True),
        "MW": round(float(Descriptors.MolWt(mol)), 3),
        "LogP": round(float(Crippen.MolLogP(mol)), 3),
        "TPSA": round(float(rdMolDescriptors.CalcTPSA(mol)), 3),
        "HBD": int(Lipinski.NumHDonors(mol)),
        "HBA": int(Lipinski.NumHAcceptors(mol)),
        "RotBonds": int(Lipinski.NumRotatableBonds(mol)),
        "QED": round(float(QED.qed(mol)), 4),
        "rings": int(rdMolDescriptors.CalcNumRings(mol)),
        "aromatic_rings": int(rdMolDescriptors.CalcNumAromaticRings(mol)),
    }


def _pubchem_ligand_payload(ligand: FabricLigand, request: DataFabricRequest) -> dict[str, Any] | None:
    if not ligand.smiles:
        return None
    props = "MolecularFormula,MolecularWeight,XLogP,TPSA,CanonicalSMILES,IsomericSMILES,InChIKey,IUPACName"
    url = f"{PUBCHEM_API}/compound/smiles/{quote(ligand.smiles, safe='')}/property/{props}/JSON"
    try:
        result = _get_json("pubchem_smiles_properties", url, None, request.ttl_seconds, request.use_live)
        rows = ((result["payload"] or {}).get("PropertyTable") or {}).get("Properties") or []
        return {"status": result["status"], "properties": rows[0] if rows else None}
    except Exception as exc:
        return {"status": "error", "error": str(exc)[:500]}


def _ligand_payload(ligand: FabricLigand, request: DataFabricRequest) -> dict[str, Any]:
    rdkit = _rdkit_ligand_payload(ligand.smiles)
    pubchem = _pubchem_ligand_payload(ligand, request)
    richness = 0
    if rdkit and rdkit.get("status") == "computed":
        richness += 1
    if pubchem and pubchem.get("properties"):
        richness += 1
    return {
        "candidate_id": ligand.candidate_id,
        "target": ligand.target,
        "chembl_id": ligand.chembl_id,
        "smiles": ligand.smiles,
        "rdkit": rdkit,
        "pubchem": pubchem,
        "data_richness": richness,
        "pipeline_use": "Ligand datapoints support descriptor sanity checks, identity crosswalk, ADMET/model applicability, and SAR grouping. They are not binding evidence.",
    }


def _target_payload(target: FabricTarget, request: DataFabricRequest) -> dict[str, Any]:
    chembl = _chembl_target_payload(target, request)
    uniprot = _uniprot_payload(target, request)
    open_targets = _open_targets_payload(target, request)
    activity_count = int((chembl.get("activity_summary") or {}).get("activity_count") or 0)
    sequence_length = (uniprot or {}).get("sequence_length")
    richness = 0
    if activity_count:
        richness += min(4, max(1, activity_count // 25))
    if sequence_length:
        richness += 1
    if open_targets and open_targets.get("status") not in {"not_run", "error"}:
        richness += 1
    return {
        "gene": target.gene,
        "uniprot": target.uniprot,
        "ensembl_id": target.ensembl_id,
        "chembl": chembl,
        "uniprot_record": uniprot,
        "open_targets": open_targets,
        "data_richness": richness,
        "pipeline_use": "Target datapoints support assay coverage, target identity, disease association, applicability-domain, and evidence-quality scoring. They do not replace experiment design.",
    }


@router.get("/data-fabric/status")
def data_fabric_status() -> dict[str, Any]:
    return {
        "generated_at": _now(),
        "cache_dir": CACHE_DIR.as_posix(),
        "ttl_seconds": DEFAULT_TTL_SECONDS,
        "connectors": {
            "chembl": {"base_url": CHEMBL_API, "status": "configured"},
            "pubchem": {"base_url": PUBCHEM_API, "status": "configured"},
            "uniprot": {"base_url": UNIPROT_API, "status": "configured"},
            "open_targets": {"base_url": OPEN_TARGETS_GRAPHQL, "status": "configured"},
        },
        "ai_models": ai_model_status_payload(),
        "local_model_paths": {
            "chemprop": sorted(path.as_posix() for path in Path("models").glob("**/*chemprop*"))[:8],
            "unimol": sorted(path.as_posix() for path in Path("models").glob("**/*unimol*"))[:8],
            "diffdock": sorted(path.as_posix() for path in Path("models").glob("**/*diffdock*"))[:8],
            "esm": sorted(path.as_posix() for path in Path("models").glob("**/*esm*"))[:8],
        },
        "claim_boundary": "Realtime public-data connectors and AI adapters add research evidence and context only; they do not create clinical or regulatory claims.",
    }


@router.post("/data-fabric/enrich")
def enrich_data_fabric(request: DataFabricRequest) -> dict[str, Any]:
    targets = [_target_payload(target, request) for target in request.targets]
    ligands = [_ligand_payload(ligand, request) for ligand in request.ligands[: request.max_ligands]]
    activity_count = sum(int((target.get("chembl", {}).get("activity_summary") or {}).get("activity_count") or 0) for target in targets)
    unique_molecule_count = sum(int((target.get("chembl", {}).get("activity_summary") or {}).get("unique_molecule_count") or 0) for target in targets)
    return {
        "generated_at": _now(),
        "diagnosis": request.diagnosis,
        "targets": targets,
        "ligands": ligands,
        "summary": {
            "target_count": len(targets),
            "ligand_count": len(ligands),
            "chembl_activity_datapoints": activity_count,
            "chembl_unique_molecules": unique_molecule_count,
            "pubchem_property_hits": sum(1 for ligand in ligands if (ligand.get("pubchem") or {}).get("properties")),
            "rdkit_descriptor_hits": sum(1 for ligand in ligands if (ligand.get("rdkit") or {}).get("status") == "computed"),
            "cache_dir": CACHE_DIR.as_posix(),
        },
        "model_hooks": {
            "protein_embeddings": "ESM evidence route can embed target sequences and attach artifacts.",
            "ligand_descriptors": "RDKit descriptors are computed immediately; Chemprop/Uni-Mol/DiffDock adapters remain optional model-provider hooks.",
            "visual_docking_review": "DiffusionGemma/MedGemma visual QA can review rendered docking scenes when configured.",
        },
        "claim_boundary": "Realtime datapoints improve prioritization, auditability, and model applicability checks. They are not measured efficacy, clinical safety, or treatment recommendations.",
    }
