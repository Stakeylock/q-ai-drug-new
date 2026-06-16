from __future__ import annotations

import base64
import os
import re
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote

import requests
from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(prefix="/v1", tags=["assistant"])

GOOGLE_AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
NVIDIA_ESM2_URL = "https://health.api.nvidia.com/v1/biology/meta/esm2-650m"
DEFAULT_CHAT_MODEL = "gemma-4-31b-it"
DEFAULT_ESM2_MODEL = "meta/esm2-650m"
LOCAL_ENV_FILES = (
    Path(".env"),
    Path(".env.local"),
    Path("backend-mnl/qudrugforge-backend/.env"),
)

APP_RAG_CONTEXT = """
Quinfo Q-AI user app context:
- Discovery: collect de-identified case metadata, diagnosis, genetic variants, expression/proteomics context, and AlphaFold protein choices.
- Pipeline: frame-by-frame audit trail explaining why each stage exists, what inputs it consumes, what outputs it creates, trust checks, and limitations.
- Molecules: ranked candidate workbench with 2D/3D structures, docking evidence, GNINA/Vina/Smima setup, quantum/ADMET metrics, human-protein safety simulation, artifacts, and exports.
- Chemistry Bench: molecule ideation workspace using elements, organic starters, inorganic starters, medicinal-chemistry guardrails, local triage, and handoff into the molecule workbench.
- Research Tools: target dossier, literature query planning, SAR matrix, assay planning, counter-screen planning, developability, ELN notes, comparator exports, and claim checking.
- My Account: tier, role, credits, permissions, and data-handling status.

Operating rules:
- This is a research planning and computational hypothesis platform, not a medical advice, diagnosis, treatment, clinical safety, or regulatory approval system.
- Prefer precise app navigation guidance: name the tab, button, or export the user should open next.
- When discussing patient context, keep it de-identified and research-focused.
- When discussing drug candidates, distinguish real backend evidence from simulated or local preview data.
- Explain why a step is needed, what evidence supports it, what can go wrong, and what validation should follow.
- If asked for protein-sequence reasoning, recommend the ESM2 protein analysis route for embeddings and sequence-level context.
""".strip()


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"] = "user"
    content: str = Field(..., min_length=1)


class AssistantChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    page: str | None = None
    app_state: dict[str, Any] = Field(default_factory=dict)
    max_tokens: int = Field(default=4096, ge=128, le=16384)
    temperature: float = Field(default=0.35, ge=0, le=2)
    top_p: float = Field(default=0.9, ge=0, le=1)
    stream: bool = False


class Esm2AnalyzeRequest(BaseModel):
    sequence: str = Field(..., min_length=1)
    protein_name: str | None = None
    question: str | None = None
    output_format: Literal["npz", "h5"] = "npz"
    return_embedding_b64: bool = False


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
                key = key.strip()
                if key.startswith("export "):
                    key = key.removeprefix("export ").strip()
                if key not in names:
                    continue
                value = value.strip().strip('"').strip("'")
                if value:
                    return value
        except OSError:
            continue
    return None


def _google_api_key() -> str | None:
    return _env_value("GOOGLE_AI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY")


def _nvidia_api_key() -> str | None:
    return _env_value("NVIDIA_API_KEY")


def _google_base_url() -> str:
    return _env_value("GOOGLE_AI_BASE_URL") or GOOGLE_AI_BASE_URL


def _esm2_url() -> str:
    return _env_value("NVIDIA_ESM2_URL") or NVIDIA_ESM2_URL


def _chat_model() -> str:
    return _env_value("GOOGLE_AI_MODEL", "GEMINI_MODEL") or DEFAULT_CHAT_MODEL


def _esm2_model() -> str:
    return _env_value("NVIDIA_ESM2_MODEL") or DEFAULT_ESM2_MODEL


def _google_generate_url(api_key: str) -> str:
    model = quote(_chat_model(), safe="")
    return f"{_google_base_url().rstrip('/')}/models/{model}:generateContent?key={api_key}"


def _google_public_url() -> str:
    model = quote(_chat_model(), safe="")
    return f"{_google_base_url().rstrip('/')}/models/{model}:generateContent"


def _google_timeout_seconds() -> int:
    raw = _env_value("GOOGLE_AI_TIMEOUT_SECONDS")
    try:
        return max(10, min(90, int(raw))) if raw else 35
    except ValueError:
        return 35


def _status_payload() -> dict[str, Any]:
    chat_configured = bool(_google_api_key())
    esm2_configured = bool(_nvidia_api_key())
    return {
        "configured": chat_configured,
        "chat_configured": chat_configured,
        "esm2_configured": esm2_configured,
        "chat_provider": "google-ai-studio",
        "chat_key_source": "env or local dotenv: GOOGLE_AI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY",
        "chat_model": _chat_model(),
        "chat_url": _google_public_url(),
        "esm2_provider": "nvidia-nim",
        "esm2_key_source": "env or local dotenv: NVIDIA_API_KEY",
        "esm2_model": _esm2_model(),
        "esm2_url": _esm2_url(),
        "secret_policy": "Backend only. Do not put Google or NVIDIA keys in Vite, React, localStorage, or browser-visible code.",
    }


def _safe_app_state(state: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "tier",
        "activeTab",
        "diagnosis",
        "caseId",
        "selectedProteins",
        "runStatus",
        "candidateCount",
        "selectedCandidate",
        "chemistryObjective",
    }
    safe: dict[str, Any] = {}
    for key, value in state.items():
        if key in allowed:
            safe[key] = value
    return safe


def _chat_tab_hint(request: AssistantChatRequest) -> str:
    latest = request.messages[-1].content.strip()
    tab_hint = "Copilot"
    lowered = latest.lower()
    if any(word in lowered for word in ["molecule", "candidate", "dock", "structure"]):
        tab_hint = "Molecules"
    elif any(word in lowered for word in ["protein", "alphafold", "variant", "sequence", "esm"]):
        tab_hint = "Discovery or Copilot protein analysis"
    elif any(word in lowered for word in ["chem", "smiles", "element", "scaffold", "starter"]):
        tab_hint = "Chemistry Bench"
    elif any(word in lowered for word in ["export", "assay", "sar", "literature", "eln"]):
        tab_hint = "Research Tools"
    elif any(word in lowered for word in ["pipeline", "why", "stage", "trust"]):
        tab_hint = "Pipeline"
    return tab_hint


def _offline_chat_response(request: AssistantChatRequest) -> dict[str, Any]:
    tab_hint = _chat_tab_hint(request)
    return {
        **_status_payload(),
        "answer": (
            "Google AI Studio is wired but not configured on this backend yet. Set GOOGLE_AI_API_KEY, GEMINI_API_KEY, "
            "or GOOGLE_API_KEY in the backend environment or local backend .env file, restart the API, and this Copilot "
            "will use Gemma through Google AI Studio. For now, use the "
            f"{tab_hint} tab for this request. Keep outputs research-only, verify backend evidence, and export a dossier "
            "before moving to wet-lab planning."
        ),
        "provider": "offline-fallback",
        "raw": None,
    }


def _system_prompt(request: AssistantChatRequest) -> str:
    safe_state = _safe_app_state(request.app_state)
    state_text = "\n".join(f"- {key}: {value}" for key, value in safe_state.items()) or "- No page state provided."
    page_text = request.page or safe_state.get("activeTab") or "unknown"
    return (
        f"{APP_RAG_CONTEXT}\n\n"
        f"Current page/tab: {page_text}\n"
        f"Current app state:\n{state_text}\n\n"
        "Respond as the in-app research copilot. Return only the final user-facing answer, not hidden reasoning, scratchpad, "
        "or a raw restatement of app state. Format with short Markdown sections when helpful: Next Step, Why, Actions, "
        "Validation Checks, and Limits. Use crisp bullets, avoid deeply nested bullets, and name the exact tab/button when an action is appropriate."
    )


def _google_contents(request: AssistantChatRequest) -> list[dict[str, Any]]:
    contents = []
    for message in request.messages:
        if message.role == "system" or not message.content.strip():
            continue
        role = "model" if message.role == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": message.content.strip()}]})
    return contents or [{"role": "user", "parts": [{"text": "Help me use the Quinfo Q-AI app."}]}]


def _extract_google_answer(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        return "Google AI Studio returned no candidates. Try a shorter prompt or verify the selected model."
    content = candidates[0].get("content") or {}
    parts = content.get("parts") or []
    text_parts = [part.get("text") for part in parts if isinstance(part, dict) and part.get("text")]
    if text_parts:
        return _clean_copilot_answer("\n".join(text_parts).strip())
    return _clean_copilot_answer(str(content or candidates[0]))


def _clean_copilot_answer(text: str) -> str:
    cleaned = text.replace("$\\rightarrow$", "->").replace("$\\to$", "->").strip()
    heading_match = re.search(r"(?im)^\s*#{1,4}\s+(next step|recommended next step|actions?|why|plan)\b", cleaned)
    if heading_match and heading_match.start() > 0:
        prefix = cleaned[: heading_match.start()].lower()
        if any(marker in prefix for marker in ["user is", "app state", "logical flow", "goal:", "current tab", "candidatecount"]):
            cleaned = cleaned[heading_match.start() :].strip()
    label_match = re.search(r"(?im)^\s*[*-]?\s*\**next step\**\s*:", cleaned)
    if label_match and label_match.start() > 0:
        prefix = cleaned[: label_match.start()].lower()
        if any(marker in prefix for marker in ["user is", "app state", "logical flow", "goal:", "current tab", "candidatecount"]):
            cleaned = cleaned[label_match.start() :].strip()
    cleaned = re.sub(r"(?m)^\s{4,}([*-]\s+)", r"\1", cleaned)
    return cleaned


def _clean_sequence(sequence: str) -> str:
    cleaned = re.sub(r"[^A-Za-z]", "", sequence).upper()
    allowed = set("ACDEFGHIKLMNPQRSTVWYBXZJUO")
    return "".join(char for char in cleaned if char in allowed)


def _sequence_summary(sequence: str) -> dict[str, Any]:
    length = len(sequence)
    hydrophobic = sum(sequence.count(char) for char in "AILMFWVY")
    charged = sum(sequence.count(char) for char in "DEKRH")
    cysteine = sequence.count("C")
    gly_pro = sequence.count("G") + sequence.count("P")
    composition = {char: sequence.count(char) for char in sorted(set(sequence))}
    return {
        "length": length,
        "composition": composition,
        "hydrophobic_fraction": round(hydrophobic / length, 4) if length else 0,
        "charged_fraction": round(charged / length, 4) if length else 0,
        "cysteine_count": cysteine,
        "glycine_proline_fraction": round(gly_pro / length, 4) if length else 0,
        "warnings": _sequence_warnings(sequence),
    }


def _sequence_warnings(sequence: str) -> list[str]:
    warnings = []
    if len(sequence) > 1024:
        warnings.append("NVIDIA ESM2-650M accepts sequences up to 1024 amino acids; this route will send the first 1024 residues.")
    if len(sequence) < 30:
        warnings.append("Very short sequences may produce less useful embeddings.")
    if any(char in sequence for char in "BXZJUO"):
        warnings.append("Sequence contains ambiguous or uncommon amino-acid symbols; review before interpreting embeddings.")
    return warnings


def _embedding_rationale(summary: dict[str, Any], generated: bool) -> str:
    status = "generated" if generated else "not generated"
    return (
        f"ESM2 embedding {status}. Use embeddings for protein similarity, clustering, mutation-context triage, "
        f"target-family comparison, and retrieval features. Sequence length {summary['length']}; "
        f"hydrophobic fraction {summary['hydrophobic_fraction']}; charged fraction {summary['charged_fraction']}."
    )


def _encode_b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


@router.get("/assistant/status")
def assistant_status() -> dict[str, Any]:
    return _status_payload()


@router.post("/assistant/chat")
def assistant_chat(request: AssistantChatRequest) -> dict[str, Any]:
    key = _google_api_key()
    if not key:
        return _offline_chat_response(request)

    payload = {
        "systemInstruction": {"parts": [{"text": _system_prompt(request)}]},
        "contents": _google_contents(request),
        "generationConfig": {
            "temperature": request.temperature,
            "topP": request.top_p,
            "maxOutputTokens": request.max_tokens,
        },
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    try:
        response = requests.post(_google_generate_url(key), headers=headers, json=payload, timeout=_google_timeout_seconds())
        response.raise_for_status()
        raw = response.json()
    except Exception as exc:
        fallback = _offline_chat_response(request)
        fallback["configured"] = True
        fallback["chat_configured"] = True
        fallback["provider"] = "google-ai-studio-error-fallback"
        fallback["provider_error"] = str(exc)[:700]
        tab_hint = _chat_tab_hint(request)
        fallback["answer"] = (
            "Google AI Studio is configured, but the provider call failed for this request. "
            "I kept the app usable with local guidance. Check backend logs, the selected Google model, API key, quota, and rate limits. "
            f"For now, use the {tab_hint} tab for this request, keep outputs research-only, and verify backend evidence before making assay decisions."
        )
        return fallback
    return {
        **_status_payload(),
        "answer": _extract_google_answer(raw),
        "provider": "google-ai-studio",
        "raw": raw,
    }


@router.post("/protein/esm2/analyze")
def analyze_protein_with_esm2(request: Esm2AnalyzeRequest) -> dict[str, Any]:
    sequence = _clean_sequence(request.sequence)
    if not sequence:
        return {
            **_status_payload(),
            "protein_name": request.protein_name,
            "sequence": _sequence_summary(""),
            "answer": "No valid amino-acid sequence was found. Paste a FASTA sequence or raw amino-acid letters.",
            "embedding": None,
            "provider": "validation",
        }

    sequence_for_model = sequence[:1024]
    summary = _sequence_summary(sequence)
    key = _nvidia_api_key()
    if not key:
        return {
            **_status_payload(),
            "protein_name": request.protein_name,
            "sequence": summary,
            "answer": _embedding_rationale(summary, generated=False),
            "embedding": None,
            "provider": "offline-fallback",
        }

    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/octet-stream",
        "Content-Type": "application/json",
    }
    payload = {"sequences": [sequence_for_model], "format": request.output_format}
    try:
        response = requests.post(_esm2_url(), headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        content = response.content
    except Exception as exc:
        return {
            **_status_payload(),
            "protein_name": request.protein_name,
            "sequence": summary,
            "answer": (
                "ESM2 is configured but the embedding endpoint failed. "
                "The local sequence summary is still available; verify the NVIDIA ESM2 endpoint URL, quota, and payload schema."
            ),
            "provider": "nvidia-esm2-error-fallback",
            "provider_error": str(exc)[:700],
            "embedding": None,
        }

    return {
        **_status_payload(),
        "protein_name": request.protein_name,
        "sequence": summary,
        "answer": _embedding_rationale(summary, generated=True),
        "provider": "nvidia-esm2",
        "embedding": {
            "format": request.output_format,
            "byte_length": len(content),
            "content_type": response.headers.get("content-type"),
            "base64": _encode_b64(content) if request.return_embedding_b64 else None,
            "truncated_to_1024_residues": len(sequence) > len(sequence_for_model),
        },
    }
