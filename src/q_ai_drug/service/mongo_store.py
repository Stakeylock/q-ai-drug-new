from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlsplit, urlunsplit

from q_ai_drug.service.settings import get_settings

try:
    from pymongo import ASCENDING, DESCENDING, MongoClient
    from pymongo.collection import Collection
except Exception:  # pragma: no cover - exercised only when optional dependency is absent.
    ASCENDING = 1
    DESCENDING = -1
    MongoClient = None  # type: ignore[assignment]
    Collection = Any  # type: ignore[misc,assignment]


IndexSpec = tuple[Sequence[tuple[str, int]], dict[str, Any]]

CORE_INDEXES: dict[str, list[IndexSpec]] = {
    "users": [
        ([("email", ASCENDING)], {"unique": True}),
        ([("created_at", DESCENDING)], {}),
    ],
    "organizations": [
        ([("owner_user_id", ASCENDING)], {}),
        ([("created_at", DESCENDING)], {}),
    ],
    "organization_members": [
        ([("organization_id", ASCENDING), ("user_id", ASCENDING)], {"unique": True}),
        ([("user_id", ASCENDING)], {}),
    ],
    "projects": [
        ([("organization_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("owner_user_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("status", ASCENDING)], {}),
    ],
    "runs": [
        ([("project_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("status", ASCENDING), ("updated_at", DESCENDING)], {}),
    ],
    "jobs": [
        ([("project_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("run_id", ASCENDING)], {}),
        ([("status", ASCENDING), ("updated_at", DESCENDING)], {}),
        ([("task_name", ASCENDING)], {}),
    ],
    "job_logs": [
        ([("job_id", ASCENDING), ("created_at", ASCENDING)], {}),
        ([("run_id", ASCENDING), ("created_at", ASCENDING)], {}),
    ],
    "targets": [
        ([("project_id", ASCENDING), ("target_id", ASCENDING)], {}),
    ],
    "molecules": [
        ([("project_id", ASCENDING), ("created_at", DESCENDING)], {}),
    ],
    "candidates": [
        ([("project_id", ASCENDING), ("rank", ASCENDING)], {}),
        ([("run_id", ASCENDING), ("rank", ASCENDING)], {}),
        ([("target_id", ASCENDING), ("final_score", DESCENDING)], {}),
    ],
    "candidate_scores": [
        ([("candidate_id", ASCENDING), ("score_type", ASCENDING)], {}),
    ],
    "models": [
        ([("organization_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("model_type", ASCENDING)], {}),
    ],
    "model_versions": [
        ([("model_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("status", ASCENDING)], {}),
    ],
    "artifacts": [
        ([("project_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("run_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("artifact_type", ASCENDING)], {}),
    ],
    "reports": [
        ([("project_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("run_id", ASCENDING), ("created_at", DESCENDING)], {}),
    ],
    "api_keys": [
        ([("key_hash", ASCENDING)], {"unique": True}),
        ([("user_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("organization_id", ASCENDING), ("created_at", DESCENDING)], {}),
    ],
    "usage_events": [
        ([("organization_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("project_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("event_type", ASCENDING), ("created_at", DESCENDING)], {}),
    ],
    "billing_accounts": [
        ([("organization_id", ASCENDING)], {"unique": True}),
    ],
    "credit_ledger": [
        ([("organization_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ([("run_id", ASCENDING), ("created_at", DESCENDING)], {}),
    ],
}

CHEMICAL_RECORD_INDEXES: list[IndexSpec] = [
    ([("chemical_id", ASCENDING)], {"unique": True}),
    ([("target", ASCENDING), ("updated_at", DESCENDING)], {}),
    ([("wet_lab_ready", ASCENDING), ("updated_at", DESCENDING)], {}),
]

MIRRORED_COLLECTIONS = tuple(CORE_INDEXES)

_client: Any | None = None
_last_error: str | None = None
_indexes_ready: set[str] = set()


def _redact_mongo_uri(uri: str) -> str:
    try:
        parts = urlsplit(uri)
        if "@" not in parts.netloc:
            return uri
        host = parts.netloc.rsplit("@", 1)[1]
        return urlunsplit((parts.scheme, f"***:***@{host}", parts.path, parts.query, parts.fragment))
    except Exception:
        return "mongodb://***"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _mongo_settings() -> tuple[bool, bool, str, str, int]:
    settings = get_settings()
    return (
        settings.mongodb_enabled,
        settings.mongodb_required,
        settings.mongodb_uri,
        settings.mongodb_database,
        max(250, int(settings.mongodb_timeout_ms)),
    )


def _get_client() -> Any | None:
    global _client, _last_error
    enabled, _, uri, _, timeout_ms = _mongo_settings()
    if not enabled:
        _last_error = "MongoDB document store is disabled."
        return None
    if MongoClient is None:
        _last_error = "pymongo is not installed."
        return None
    if _client is None:
        try:
            _client = MongoClient(uri, serverSelectionTimeoutMS=timeout_ms, connectTimeoutMS=timeout_ms)
        except Exception as exc:
            _last_error = str(exc)
            return None
    try:
        _client.admin.command("ping")
        _last_error = None
        return _client
    except Exception as exc:
        _last_error = str(exc)
        try:
            _client.close()
        except Exception:
            pass
        _client = None
        return None


def close_mongo_store() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def mongo_status() -> dict[str, Any]:
    enabled, required, uri, database_name, _ = _mongo_settings()
    client = _get_client() if enabled else None
    connected = client is not None
    return {
        "configured": enabled,
        "required": required,
        "connected": connected,
        "status": "connected" if connected else ("disabled" if not enabled else "unavailable"),
        "store": "mongodb" if connected else "file",
        "database": database_name if enabled else None,
        "uri": _redact_mongo_uri(uri) if enabled else None,
        "mirrored_collections": list(MIRRORED_COLLECTIONS),
        "error": None if connected or not enabled else _last_error,
    }


def _collection(name: str) -> Collection | None:
    client = _get_client()
    if client is None:
        return None
    _, _, _, database_name, _ = _mongo_settings()
    return client[database_name][name]


def _ensure_indexes(name: str, indexes: Iterable[IndexSpec]) -> Collection | None:
    collection = _collection(name)
    if collection is None:
        return None
    if name in _indexes_ready:
        return collection
    collection.create_index([("id", ASCENDING)], unique=True, sparse=True)
    for keys, options in indexes:
        collection.create_index(list(keys), **options)
    _indexes_ready.add(name)
    return collection


def _core_collection(name: str) -> Collection | None:
    return _ensure_indexes(name, CORE_INDEXES.get(name, []))


def _chemical_records() -> Collection | None:
    return _ensure_indexes("chemical_records", CHEMICAL_RECORD_INDEXES)


def init_mongo_store(required: bool | None = None, retries: int = 8, delay_seconds: float = 1.5) -> bool:
    enabled, settings_required, _, _, _ = _mongo_settings()
    required = settings_required if required is None else required
    if not enabled:
        if required:
            raise RuntimeError("MongoDB document store is required but QAI_MONGO_ENABLED is false.")
        return False
    connected = False
    max_attempts = max(1, retries if required else 1)
    for attempt in range(1, max_attempts + 1):
        if _get_client() is not None:
            connected = True
            break
        if attempt < max_attempts:
            time.sleep(delay_seconds)
    if not connected:
        if required:
            raise RuntimeError(f"MongoDB document store is required but unavailable: {_last_error}")
        return False
    for collection_name, indexes in CORE_INDEXES.items():
        _ensure_indexes(collection_name, indexes)
    _chemical_records()
    return True


def require_mongo_ready() -> None:
    enabled, required, _, _, _ = _mongo_settings()
    if required and (not enabled or _get_client() is None):
        raise RuntimeError(f"MongoDB document store is required but unavailable: {_last_error}")


def _without_mongo_id(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if not document:
        return None
    clean = dict(document)
    clean.pop("_id", None)
    return clean


def _bson_safe(value: Any) -> Any:
    if isinstance(value, datetime):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): _bson_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_bson_safe(item) for item in value]
    if isinstance(value, set):
        return sorted(_bson_safe(item) for item in value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def sync_core_document(collection_name: str, document: Mapping[str, Any], key: str = "id") -> bool:
    collection = _core_collection(collection_name)
    document_id = document.get(key)
    if collection is None or document_id is None:
        return False
    payload = _bson_safe(dict(document))
    payload["synced_to_mongo_at"] = _now()
    collection.update_one(
        {key: document_id},
        {
            "$set": payload,
            "$setOnInsert": {"created_in_mongo_at": _now()},
        },
        upsert=True,
    )
    return True


def sync_core_documents(items: Iterable[tuple[str, Mapping[str, Any]]]) -> int:
    synced = 0
    for collection_name, document in items:
        if sync_core_document(collection_name, document):
            synced += 1
    return synced


def get_core_document(collection_name: str, document_id: Any) -> dict[str, Any] | None:
    collection = _core_collection(collection_name)
    if collection is None:
        return None
    return _without_mongo_id(collection.find_one({"id": document_id}))


def find_core_document(collection_name: str, query: Mapping[str, Any]) -> dict[str, Any] | None:
    collection = _core_collection(collection_name)
    if collection is None:
        return None
    return _without_mongo_id(collection.find_one(dict(query)))


def list_core_documents(
    collection_name: str,
    query: Mapping[str, Any] | None = None,
    *,
    sort: Sequence[tuple[str, int]] | None = None,
    limit: int = 100,
) -> list[dict[str, Any]] | None:
    collection = _core_collection(collection_name)
    if collection is None:
        return None
    cursor = collection.find(dict(query or {}), {"_id": 0})
    if sort:
        cursor = cursor.sort(list(sort))
    cursor = cursor.limit(max(1, min(int(limit), 1000)))
    return [dict(row) for row in cursor]


def update_core_document(collection_name: str, document_id: Any, patch: Mapping[str, Any]) -> bool:
    collection = _core_collection(collection_name)
    if collection is None:
        return False
    payload = _bson_safe(dict(patch))
    payload["synced_to_mongo_at"] = _now()
    result = collection.update_one({"id": document_id}, {"$set": payload})
    return bool(result.matched_count)


def upsert_chemical_record(record: dict[str, Any]) -> bool:
    collection = _chemical_records()
    chemical_id = record.get("chemical_id")
    if collection is None or not chemical_id:
        return False
    document = {
        **record,
        "synced_to_mongo_at": _now_iso(),
    }
    collection.update_one(
        {"chemical_id": chemical_id},
        {
            "$set": _bson_safe(document),
            "$setOnInsert": {"created_in_mongo_at": _now_iso()},
        },
        upsert=True,
    )
    return True


def list_chemical_records(limit: int = 100) -> list[dict[str, Any]] | None:
    collection = _chemical_records()
    if collection is None:
        return None
    cursor = collection.find({}, {"_id": 0}).sort("updated_at", DESCENDING).limit(max(1, min(limit, 500)))
    return [dict(row) for row in cursor]


def get_chemical_record(chemical_id: str) -> dict[str, Any] | None:
    collection = _chemical_records()
    if collection is None:
        return None
    return _without_mongo_id(collection.find_one({"chemical_id": chemical_id}))
