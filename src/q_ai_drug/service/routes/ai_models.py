from __future__ import annotations

import json
import hashlib
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote

import requests
from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(prefix="/v1", tags=["ai-models"])

DEFAULT_OUTPUT_DIR = Path(os.getenv("QAI_OUTPUT_DIR", "outputs/cancer_proof_v1"))
PROTEIN_CACHE_DIR = Path("data/research_resources/protein_sequences")
NVIDIA_ESM2_URL = "https://health.api.nvidia.com/v1/biology/meta/esm2-650m"
DIFFUSIONGEMMA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
DIFFUSIONGEMMA_MODEL = "google/diffusiongemma-26b-a4b-it"
MEDGEMMA_MODEL = "google/medgemma-1.5-4b-it"
LOCAL_ENV_FILES = (
    Path(".env"),
    Path(".env.local"),
    Path("backend-mnl/qudrugforge-backend/.env"),
)


class ProteinEvidenceTarget(BaseModel):
    gene: str
    uniprot: str | None = None
    alphafold_id: str | None = None
    role: str | None = None
    variants: list[str] = Field(default_factory=list)
    sequence: str | None = None


class ProteinEvidenceRequest(BaseModel):
    targets: list[ProteinEvidenceTarget] = Field(..., min_length=1)
    patient_context: dict[str, Any] = Field(default_factory=dict)
    use_esm: bool = True
    output_format: Literal["npz", "h5"] = "npz"


class DockingVisionReviewRequest(BaseModel):
    candidate_id: str
    target: str | None = None
    pose_source: str | None = None
    receptor_url: str | None = None
    ligand_url: str | None = None
    image_url: str | None = None
    notes: str | None = None
    provider: str | None = None
    max_tokens: int = Field(default=900, ge=128, le=4096)


def _env_value(*names: str) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    for path in LOCAL_ENV_FILES:
        if not path.exists():
            continue
        try:
            for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                clean = line.strip()
                if not clean or clean.startswith("#") or "=" not in clean:
                    continue
                key, value = clean.split("=", 1)
                key = key.strip().removeprefix("export ").strip()
                if key not in names:
                    continue
                value = value.strip().strip('"').strip("'")
                if value:
                    return value
        except OSError:
            continue
    return None


def _nvidia_api_key() -> str | None:
    return _env_value("NVIDIA_API_KEY")


def _dgemma_api_key() -> str | None:
    return _env_value("DGEMMA_API_KEY", "NVIDIA_API_KEY")


def _medgemma_api_key() -> str | None:
    return _env_value("MEDGEMMA_API_KEY", "HF_TOKEN", "HUGGINGFACE_API_KEY")


def _esm2_url() -> str:
    return _env_value("NVIDIA_ESM2_URL") or NVIDIA_ESM2_URL


def _esm2_model() -> str:
    return _env_value("NVIDIA_ESM2_MODEL") or "meta/esm2-650m"


def _dgemma_url() -> str:
    return _env_value("DGEMMA_API_URL", "NVIDIA_CHAT_COMPLETIONS_URL") or DIFFUSIONGEMMA_URL


def _dgemma_model() -> str:
    return _env_value("DGEMMA_MODEL") or DIFFUSIONGEMMA_MODEL


def _medgemma_base_url() -> str | None:
    return _env_value("MEDGEMMA_BASE_URL")


def _medgemma_model() -> str:
    return _env_value("MEDGEMMA_MODEL") or MEDGEMMA_MODEL


def ai_model_status_payload() -> dict[str, Any]:
    medgemma_base = _medgemma_base_url()
    return {
        "esm2_configured": bool(_nvidia_api_key()),
        "esm2_provider": "nvidia-nim",
        "esm2_model": _esm2_model(),
        "esm2_url": _esm2_url(),
        "diffusiongemma_configured": bool(_dgemma_api_key()),
        "diffusiongemma_provider": "nvidia-nim",
        "diffusiongemma_model": _dgemma_model(),
        "diffusiongemma_url": _dgemma_url(),
        "diffusiongemma_key_source": "DGEMMA_API_KEY or NVIDIA_API_KEY",
        "medgemma_configured": bool(medgemma_base),
        "medgemma_provider": "local-or-private-openai-compatible",
        "medgemma_model": _medgemma_model(),
        "medgemma_base_url": medgemma_base,
        "medgemma_access_note": "Hugging Face model files require accepting Health AI Developer Foundation terms before local/private deployment.",
        "secret_policy": "Backend only. Do not expose provider keys through Vite, React, localStorage, or browser-visible code.",
    }


def _clean_sequence(sequence: str) -> str:
    cleaned = re.sub(r"[^A-Za-z]", "", sequence).upper()
    allowed = set("ACDEFGHIKLMNPQRSTVWYBXZJUO")
    return "".join(char for char in cleaned if char in allowed)


def _sequence_summary(sequence: str) -> dict[str, Any]:
    length = len(sequence)
    hydrophobic = sum(sequence.count(char) for char in "AILMFWVY")
    charged = sum(sequence.count(char) for char in "DEKRH")
    polar = sum(sequence.count(char) for char in "STNQCY")
    gly_pro = sequence.count("G") + sequence.count("P")
    warnings = []
    if length > 1024:
        warnings.append("Sequence is longer than 1024 residues; ESM2-650M request is truncated for provider compatibility.")
    if length < 30:
        warnings.append("Very short sequence; embeddings may be weak for target-family inference.")
    if any(char in sequence for char in "BXZJUO"):
        warnings.append("Ambiguous or uncommon amino-acid symbols present; review sequence before interpreting ESM evidence.")
    return {
        "length": length,
        "hydrophobic_fraction": round(hydrophobic / length, 4) if length else 0,
        "charged_fraction": round(charged / length, 4) if length else 0,
        "polar_fraction": round(polar / length, 4) if length else 0,
        "glycine_proline_fraction": round(gly_pro / length, 4) if length else 0,
        "cysteine_count": sequence.count("C"),
        "warnings": warnings,
    }


def _parse_fasta(text: str) -> str:
    return _clean_sequence("".join(line.strip() for line in text.splitlines() if not line.startswith(">")))


def _fetch_uniprot_sequence(accession: str) -> tuple[str, str]:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", accession)
    PROTEIN_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache = PROTEIN_CACHE_DIR / f"{safe}.fasta"
    if cache.exists() and cache.stat().st_size > 0:
        return _parse_fasta(cache.read_text(encoding="utf-8", errors="replace")), "local_uniprot_cache"
    url = f"https://rest.uniprot.org/uniprotkb/{quote(accession)}.fasta"
    response = requests.get(url, headers={"User-Agent": "q-ai-drug-protein-evidence/0.1"}, timeout=30)
    response.raise_for_status()
    cache.write_text(response.text, encoding="utf-8")
    return _parse_fasta(response.text), "uniprot_rest"


def _artifact_url(path: Path) -> str:
    rel = path.resolve().relative_to(DEFAULT_OUTPUT_DIR.resolve()).as_posix()
    return "/artifacts/" + "/".join(quote(part) for part in rel.split("/"))


def _run_esm_embedding(sequence: str, target: ProteinEvidenceTarget, output_format: str) -> dict[str, Any]:
    key = _nvidia_api_key()
    if not key:
        return {"status": "not_configured", "provider": "local_sequence_summary", "model": _esm2_model()}
    sequence_for_model = sequence[:1024]
    protein_dir = DEFAULT_OUTPUT_DIR / "protein_ai"
    protein_dir.mkdir(parents=True, exist_ok=True)
    safe_gene = re.sub(r"[^A-Za-z0-9_.-]+", "_", target.gene or "target")
    safe_uniprot = re.sub(r"[^A-Za-z0-9_.-]+", "_", target.uniprot or "unknown")
    seq_hash = hashlib.sha256(sequence_for_model.encode("utf-8")).hexdigest()[:12]
    path = protein_dir / f"{safe_gene}_{safe_uniprot}_{seq_hash}_esm2.{output_format}"
    if path.exists() and path.stat().st_size > 0:
        return {
            "status": "generated",
            "provider": "nvidia-esm2-cache",
            "model": _esm2_model(),
            "byte_length": path.stat().st_size,
            "artifact_url": _artifact_url(path),
            "truncated_to_1024_residues": len(sequence) > 1024,
            "content_type": "application/octet-stream",
        }

    payload = {"sequences": [sequence_for_model], "format": output_format}
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/octet-stream",
        "Content-Type": "application/json",
    }
    try:
        response = requests.post(_esm2_url(), headers=headers, json=payload, timeout=120)
        response.raise_for_status()
    except Exception as exc:
        return {
            "status": "provider_error",
            "provider": "nvidia-esm2",
            "model": _esm2_model(),
            "error": str(exc)[:700],
        }

    path.write_bytes(response.content)
    return {
        "status": "generated",
        "provider": "nvidia-esm2",
        "model": _esm2_model(),
        "byte_length": len(response.content),
        "artifact_url": _artifact_url(path),
        "truncated_to_1024_residues": len(sequence) > 1024,
        "content_type": response.headers.get("content-type"),
    }


def _protein_evidence_row(target: ProteinEvidenceTarget, use_esm: bool, output_format: str) -> dict[str, Any]:
    sequence = _clean_sequence(target.sequence or "")
    source = "request_sequence"
    if not sequence and target.uniprot:
        try:
            sequence, source = _fetch_uniprot_sequence(target.uniprot)
        except Exception as exc:
            return {
                "gene": target.gene,
                "uniprot": target.uniprot,
                "alphafold_id": target.alphafold_id,
                "sequence_source": "missing",
                "sequence_error": str(exc)[:500],
                "esm": {"status": "not_run"},
                "target_context_score": 0.5,
                "pipeline_use": "Sequence unavailable; target keeps clinical/genomic context only.",
            }
    summary = _sequence_summary(sequence)
    esm = _run_esm_embedding(sequence, target, output_format) if use_esm and sequence else {"status": "not_run"}
    base = 0.54
    if summary["length"] >= 100:
        base += 0.08
    if esm.get("status") == "generated":
        base += 0.08
    elif sequence:
        base += 0.03
    if summary["warnings"]:
        base -= 0.04
    target_context_score = max(0.25, min(0.75, base))
    return {
        "gene": target.gene,
        "uniprot": target.uniprot,
        "alphafold_id": target.alphafold_id,
        "role": target.role,
        "variants": target.variants,
        "sequence_source": source,
        "sequence": summary,
        "esm": esm,
        "target_context_score": round(target_context_score, 3),
        "pipeline_use": (
            "ESM embedding is part of target-context evidence for similarity, clustering, mutation-context triage, "
            "and applicability-domain review. It is not binding or efficacy evidence."
        ),
    }


def _offline_visual_review(request: DockingVisionReviewRequest) -> str:
    checks = [
        "Confirm ligand and receptor are loaded from the same coordinate frame.",
        "Confirm the active pose source is REAL or GNINA, not an RDKit conformer proxy.",
        "Confirm the ligand is inside the configured docking box and near the curated pocket.",
        "Review receptor provenance, redocking RMSD if available, cofactors, waters, protonation, and key-residue contacts.",
    ]
    if not request.image_url:
        checks.append("No viewer screenshot was supplied, so this is artifact/provenance QA rather than visual inspection.")
    return (
        f"Visual QA fallback for {request.candidate_id}. "
        "A multimodal model is not configured, so use this as a deterministic checklist: "
        + " ".join(checks)
    )


def _vision_messages(request: DockingVisionReviewRequest) -> list[dict[str, Any]]:
    text = (
        "You are reviewing a computational protein-ligand docking visualization for research QA only. "
        "Do not claim potency, efficacy, clinical safety, or treatment relevance. "
        "Look for visible problems: detached ligand, wrong coordinate frame, receptor/ligand scale mismatch, hidden ligand, bad pocket placement, "
        "proxy pose confused with real pose, or missing provenance. "
        f"Candidate: {request.candidate_id}; target: {request.target}; pose source: {request.pose_source}; "
        f"receptor URL: {request.receptor_url}; ligand URL: {request.ligand_url}; notes: {request.notes or 'none'}. "
        "Return concise sections: Visual QA, Possible Bugs, Research Interpretation, Required Validation."
    )
    content: list[dict[str, Any]] = [{"type": "text", "text": text}]
    if request.image_url:
        content.append({"type": "image_url", "image_url": {"url": request.image_url}})
    return [{"role": "user", "content": content}]


def _extract_chat_answer(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        return json.dumps(payload)[:1800]
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    return json.dumps(content or message)[:1800]


def _call_openai_compatible(base_url: str, model: str, key: str | None, messages: list[dict[str, Any]], max_tokens: int) -> dict[str, Any]:
    url = base_url.rstrip("/")
    if url.endswith("/v1"):
        url = f"{url}/chat/completions"
    elif not url.endswith("/chat/completions"):
        url = f"{url}/v1/chat/completions"
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "top_p": 0.9,
    }
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    return response.json()


@router.get("/ai/model-status")
def ai_model_status() -> dict[str, Any]:
    return ai_model_status_payload()


@router.post("/research/protein-evidence")
def protein_evidence(request: ProteinEvidenceRequest) -> dict[str, Any]:
    rows = [_protein_evidence_row(target, request.use_esm, request.output_format) for target in request.targets]
    return {
        **ai_model_status_payload(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "targets": rows,
        "summary": {
            "target_count": len(rows),
            "sequence_count": sum(1 for row in rows if row.get("sequence")),
            "esm_generated_count": sum(1 for row in rows if row.get("esm", {}).get("status") == "generated"),
            "provider_error_count": sum(1 for row in rows if row.get("esm", {}).get("status") == "provider_error"),
        },
        "claim_boundary": "Protein-language-model evidence is target-context evidence only; it is not docking, binding, efficacy, safety, or clinical evidence.",
    }


@router.post("/vision/docking-review")
def docking_vision_review(request: DockingVisionReviewRequest) -> dict[str, Any]:
    provider = (request.provider or "").lower()
    messages = _vision_messages(request)
    if provider != "medgemma" and _dgemma_api_key():
        try:
            payload = {
                "model": _dgemma_model(),
                "messages": messages,
                "max_tokens": request.max_tokens,
                "temperature": 0.2,
                "top_p": 0.9,
                "stream": False,
                "chat_template_kwargs": {"enable_thinking": True},
            }
            headers = {
                "Authorization": f"Bearer {_dgemma_api_key()}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
            response = requests.post(_dgemma_url(), headers=headers, json=payload, timeout=120)
            response.raise_for_status()
            raw = response.json()
            return {
                **ai_model_status_payload(),
                "provider": "nvidia-diffusiongemma",
                "model": _dgemma_model(),
                "answer": _extract_chat_answer(raw),
                "raw": raw,
                "claim_boundary": "Visual QA only. Do not interpret as binding, potency, safety, or clinical evidence.",
            }
        except Exception as exc:
            return {
                **ai_model_status_payload(),
                "provider": "nvidia-diffusiongemma-error-fallback",
                "provider_error": str(exc)[:700],
                "answer": _offline_visual_review(request),
                "raw": None,
            }

    medgemma_base = _medgemma_base_url()
    if medgemma_base:
        try:
            raw = _call_openai_compatible(medgemma_base, _medgemma_model(), _medgemma_api_key(), messages, request.max_tokens)
            return {
                **ai_model_status_payload(),
                "provider": "medgemma-openai-compatible",
                "model": _medgemma_model(),
                "answer": _extract_chat_answer(raw),
                "raw": raw,
                "claim_boundary": "Visual QA only. MedGemma is medically oriented and does not validate docking physics.",
            }
        except Exception as exc:
            return {
                **ai_model_status_payload(),
                "provider": "medgemma-error-fallback",
                "provider_error": str(exc)[:700],
                "answer": _offline_visual_review(request),
                "raw": None,
            }

    return {
        **ai_model_status_payload(),
        "provider": "deterministic-visual-qa-fallback",
        "answer": _offline_visual_review(request),
        "raw": None,
        "claim_boundary": "Visual QA only. Configure DGEMMA_API_KEY or MEDGEMMA_BASE_URL for multimodal review.",
    }
