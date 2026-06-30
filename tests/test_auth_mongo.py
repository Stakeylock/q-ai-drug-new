from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from q_ai_drug.service import mongo_store
from q_ai_drug.service.auth import get_current_principal, hash_api_key, hash_password
from q_ai_drug.service.routes.auth import router


def test_login_uses_mongo_user_when_available(monkeypatch):
    password = "research-pass-123"
    user = {
        "id": "user-mongo-1",
        "email": "researcher@example.com",
        "password_hash": hash_password(password),
        "is_active": True,
    }
    membership = {
        "id": "member-mongo-1",
        "user_id": user["id"],
        "organization_id": "org-mongo-1",
        "role": "owner",
    }

    def fake_find(collection_name, query):
        if collection_name == "users" and query == {"email": user["email"]}:
            return user
        return None

    def fake_list(collection_name, query, **kwargs):
        if collection_name == "organization_members" and query == {"user_id": user["id"]}:
            return [membership]
        return []

    monkeypatch.setattr(mongo_store, "find_core_document", fake_find)
    monkeypatch.setattr(mongo_store, "list_core_documents", fake_list)

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post("/auth/login", json={"email": "Researcher@Example.com", "password": password})

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == user["id"]
    assert payload["organization_id"] == membership["organization_id"]
    assert payload["role"] == "owner"


def test_api_key_principal_uses_mongo_documents(monkeypatch):
    api_key = "qai_dev_test_key"
    user = {
        "id": "user-mongo-2",
        "email": "api@example.com",
        "is_active": True,
    }
    key_record = {
        "id": "key-mongo-1",
        "user_id": user["id"],
        "organization_id": "org-mongo-2",
        "key_hash": hash_api_key(api_key),
        "revoked_at": None,
    }
    membership = {
        "id": "member-mongo-2",
        "user_id": user["id"],
        "organization_id": "org-mongo-2",
        "role": "researcher",
    }

    def fake_find(collection_name, query):
        if collection_name == "api_keys" and query == {"key_hash": key_record["key_hash"], "revoked_at": None}:
            return key_record
        return None

    def fake_get(collection_name, document_id):
        if collection_name == "users" and document_id == user["id"]:
            return user
        return None

    def fake_list(collection_name, query, **kwargs):
        if collection_name == "organization_members" and query == {"user_id": user["id"]}:
            return [membership]
        return []

    monkeypatch.setattr(mongo_store, "find_core_document", fake_find)
    monkeypatch.setattr(mongo_store, "get_core_document", fake_get)
    monkeypatch.setattr(mongo_store, "list_core_documents", fake_list)

    principal = get_current_principal(authorization=None, x_api_key=api_key)

    assert principal.user_id == user["id"]
    assert principal.email == user["email"]
    assert principal.organizations == {"org-mongo-2": "researcher"}
    assert principal.api_key_id == key_record["id"]
