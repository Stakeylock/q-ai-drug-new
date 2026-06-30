from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Header, HTTPException, status

from q_ai_drug.service import mongo_store
from q_ai_drug.service.db import ApiKeyRecord, OrganizationMemberRecord, UserRecord, session_scope
from q_ai_drug.service.settings import get_settings


ROLE_RANK = {"viewer": 1, "researcher": 2, "admin": 3, "owner": 4}
ACCESS_TOKEN_TTL_MINUTES = 60 * 12
PASSWORD_ITERATIONS = 260_000


@dataclass(frozen=True)
class CurrentPrincipal:
    user_id: str
    email: str
    organizations: dict[str, str]
    api_key_id: str | None = None

    @property
    def default_organization_id(self) -> str | None:
        return next(iter(self.organizations), None)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PASSWORD_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    try:
        scheme, iterations, salt_b64, digest_b64 = stored_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return secrets.compare_digest(actual, expected)
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def _sign(message: str) -> str:
    secret = get_settings().jwt_secret.encode("utf-8")
    return _b64url_encode(hmac.new(secret, message.encode("ascii"), hashlib.sha256).digest())


def create_access_token_for_identity(
    user_id: str,
    email: str,
    organization_id: str | None = None,
    role: str | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "org": organization_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES)).timestamp()),
    }
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = ".".join(
        [
            _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ]
    )
    return f"{signing_input}.{_sign(signing_input)}"


def create_access_token(user: UserRecord, organization_id: str | None = None, role: str | None = None) -> str:
    return create_access_token_for_identity(user.id, user.email, organization_id=organization_id, role=role)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, signature = token.split(".", 2)
        signing_input = f"{header_b64}.{payload_b64}"
        if not secrets.compare_digest(signature, _sign(signing_input)):
            raise ValueError("bad signature")
        payload = json.loads(_b64url_decode(payload_b64))
        if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError("expired token")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def generate_api_key() -> str:
    prefix = "qai_live" if get_settings().is_production else "qai_dev"
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def hash_api_key(api_key: str) -> str:
    secret = get_settings().jwt_secret.encode("utf-8")
    return hmac.new(secret, api_key.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_api_key(api_key: str, key_hash: str) -> bool:
    return secrets.compare_digest(hash_api_key(api_key), key_hash)


def _principal_for_user(user: UserRecord, api_key_id: str | None = None) -> CurrentPrincipal:
    with session_scope() as session:
        memberships = session.query(OrganizationMemberRecord).filter(OrganizationMemberRecord.user_id == user.id).all()
        organizations = {membership.organization_id: membership.role for membership in memberships}
    return CurrentPrincipal(user_id=user.id, email=user.email, organizations=organizations, api_key_id=api_key_id)


def _principal_for_mongo_user(user: dict[str, Any], api_key_id: str | None = None) -> CurrentPrincipal | None:
    user_id = str(user.get("id") or "")
    email = str(user.get("email") or "")
    if not user_id or not email or user.get("is_active") is False:
        return None
    memberships = mongo_store.list_core_documents(
        "organization_members",
        {"user_id": user_id},
        sort=[("created_at", 1)],
        limit=100,
    )
    if memberships is None:
        return None
    organizations = {
        str(membership.get("organization_id")): str(membership.get("role") or "viewer")
        for membership in memberships
        if membership.get("organization_id")
    }
    return CurrentPrincipal(user_id=user_id, email=email, organizations=organizations, api_key_id=api_key_id)


def get_current_principal(
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> CurrentPrincipal:
    credential = x_api_key
    bearer = None
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer":
            bearer = value.strip()
    if credential is None and bearer and bearer.startswith("qai_"):
        credential = bearer
        bearer = None

    if credential:
        key_hash = hash_api_key(credential)
        mongo_key = mongo_store.find_core_document("api_keys", {"key_hash": key_hash, "revoked_at": None})
        if mongo_key and mongo_key.get("user_id"):
            mongo_user = mongo_store.get_core_document("users", str(mongo_key["user_id"]))
            if mongo_user:
                principal = _principal_for_mongo_user(mongo_user, api_key_id=str(mongo_key.get("id") or ""))
                if principal:
                    organization_id = mongo_key.get("organization_id")
                    if organization_id and organization_id not in principal.organizations:
                        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key organization is not accessible")
                    return principal
        with session_scope() as session:
            record = (
                session.query(ApiKeyRecord)
                .filter(ApiKeyRecord.key_hash == key_hash, ApiKeyRecord.revoked_at.is_(None))
                .first()
            )
            if not record or not record.user_id:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
            user = session.get(UserRecord, record.user_id)
            if not user or not user.is_active:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key user")
            principal = _principal_for_user(user, api_key_id=record.id)
            if record.organization_id and record.organization_id not in principal.organizations:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key organization is not accessible")
            return principal

    if not bearer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    payload = decode_access_token(bearer)
    mongo_user = mongo_store.get_core_document("users", str(payload["sub"]))
    if mongo_user:
        principal = _principal_for_mongo_user(mongo_user)
        if principal:
            return principal
    with session_scope() as session:
        user = session.get(UserRecord, str(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return _principal_for_user(user)


def new_id() -> str:
    return str(uuid.uuid4())
