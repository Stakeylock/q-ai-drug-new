from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from q_ai_drug.service import mongo_store
from q_ai_drug.service.auth import (
    CurrentPrincipal,
    create_access_token,
    create_access_token_for_identity,
    generate_api_key,
    get_current_principal,
    hash_api_key,
    hash_password,
    new_id,
    normalize_email,
    verify_password,
)
from q_ai_drug.service.db import ApiKeyRecord, OrganizationMemberRecord, OrganizationRecord, UserRecord, session_scope
from q_ai_drug.service.models import ApiKeyCreate, ApiKeyCreated, ApiKeyView, CurrentUserView, LoginRequest, SignupRequest, TokenResponse


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest) -> TokenResponse:
    email = normalize_email(payload.email)
    now = datetime.now(timezone.utc)
    if mongo_store.find_core_document("users", {"email": email}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    with session_scope() as session:
        existing = session.query(UserRecord).filter(UserRecord.email == email).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
        user = UserRecord(
            id=new_id(),
            email=email,
            password_hash=hash_password(payload.password),
            display_name=payload.display_name,
            is_active=True,
            created_at=now,
        )
        org = OrganizationRecord(id=new_id(), name=payload.organization_name, owner_user_id=user.id, created_at=now)
        membership = OrganizationMemberRecord(id=new_id(), organization_id=org.id, user_id=user.id, role="owner", created_at=now)
        session.add_all([user, org, membership])
        session.flush()
        token = create_access_token(user, organization_id=org.id, role="owner")
        return TokenResponse(access_token=token, user_id=user.id, organization_id=org.id, role="owner")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    email = normalize_email(payload.email)
    mongo_user = mongo_store.find_core_document("users", {"email": email})
    if mongo_user and mongo_user.get("is_active") is not False and verify_password(payload.password, mongo_user.get("password_hash")):
        memberships = mongo_store.list_core_documents(
            "organization_members",
            {"user_id": mongo_user["id"]},
            sort=[("created_at", 1)],
            limit=1,
        )
        membership = memberships[0] if memberships else None
        org_id = membership.get("organization_id") if membership else None
        role = membership.get("role") if membership else None
        token = create_access_token_for_identity(str(mongo_user["id"]), email, organization_id=org_id, role=role)
        return TokenResponse(access_token=token, user_id=str(mongo_user["id"]), organization_id=org_id, role=role)
    with session_scope() as session:
        user = session.query(UserRecord).filter(UserRecord.email == email).first()
        if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        membership = session.query(OrganizationMemberRecord).filter(OrganizationMemberRecord.user_id == user.id).first()
        org_id = membership.organization_id if membership else None
        role = membership.role if membership else None
        token = create_access_token(user, organization_id=org_id, role=role)
        return TokenResponse(access_token=token, user_id=user.id, organization_id=org_id, role=role)


@router.get("/me", response_model=CurrentUserView)
def me(principal: CurrentPrincipal = Depends(get_current_principal)) -> CurrentUserView:
    return CurrentUserView(
        user_id=principal.user_id,
        email=principal.email,
        organizations=[{"organization_id": org_id, "role": role} for org_id, role in principal.organizations.items()],
    )


@router.post("/api-keys", response_model=ApiKeyCreated)
def create_api_key(payload: ApiKeyCreate, principal: CurrentPrincipal = Depends(get_current_principal)) -> ApiKeyCreated:
    organization_id = payload.organization_id or principal.default_organization_id
    if organization_id not in principal.organizations:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization is not accessible")
    api_key = generate_api_key()
    now = datetime.now(timezone.utc)
    record = ApiKeyRecord(
        id=new_id(),
        user_id=principal.user_id,
        organization_id=organization_id,
        name=payload.name,
        key_hash=hash_api_key(api_key),
        created_at=now,
    )
    with session_scope() as session:
        session.add(record)
    return ApiKeyCreated(id=record.id, name=record.name, api_key=api_key, organization_id=organization_id, created_at=now)


@router.get("/api-keys", response_model=list[ApiKeyView])
def list_api_keys(principal: CurrentPrincipal = Depends(get_current_principal)) -> list[ApiKeyView]:
    mongo_rows = mongo_store.list_core_documents(
        "api_keys",
        {"user_id": principal.user_id},
        sort=[("created_at", -1)],
        limit=500,
    )
    if mongo_rows is not None:
        return [
            ApiKeyView(
                id=str(row["id"]),
                name=str(row.get("name") or "default"),
                organization_id=row.get("organization_id"),
                revoked_at=row.get("revoked_at"),
                created_at=row.get("created_at"),
            )
            for row in mongo_rows
        ]
    with session_scope() as session:
        rows = (
            session.query(ApiKeyRecord)
            .filter(ApiKeyRecord.user_id == principal.user_id)
            .order_by(ApiKeyRecord.created_at.desc())
            .all()
        )
        return [
            ApiKeyView(id=row.id, name=row.name, organization_id=row.organization_id, revoked_at=row.revoked_at, created_at=row.created_at)
            for row in rows
        ]


@router.delete("/api-keys/{api_key_id}", response_model=ApiKeyView)
def revoke_api_key(api_key_id: str, principal: CurrentPrincipal = Depends(get_current_principal)) -> ApiKeyView:
    with session_scope() as session:
        row = session.get(ApiKeyRecord, api_key_id)
        if not row or row.user_id != principal.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
        row.revoked_at = datetime.now(timezone.utc)
        mongo_store.update_core_document("api_keys", api_key_id, {"revoked_at": row.revoked_at})
        return ApiKeyView(id=row.id, name=row.name, organization_id=row.organization_id, revoked_at=row.revoked_at, created_at=row.created_at)
