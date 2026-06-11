from typing import Optional
from fastapi import APIRouter, Depends, Body
from fastapi.security import HTTPAuthorizationCredentials
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, AuthResponse, MeResponse
from app.services.auth_service import auth_service
from app.services.workspace_service import workspace_service
from app.core.dependencies import get_current_active_user, security
from app.schemas.user import UserResponse
from app.schemas.workspace import WorkspaceResponse
from app.core.security import decode_token, create_access_token, create_refresh_token
from app.core.exceptions import AppException

router = APIRouter(tags=["Auth"])

@router.post("/register")
async def register(request: RegisterRequest = Body(...)):
    result = await auth_service.register(request)
    return {
        "success": True,
        "data": {
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
            "user": UserResponse.from_mongo(result["user"]).model_dump(),
            "workspace": WorkspaceResponse.from_mongo(result["workspace"], result["workspace"]["role"]).model_dump()
        },
        "message": "Registration successful"
    }

@router.post("/login")
async def login(request: LoginRequest = Body(...)):
    result = await auth_service.login(request)
    data = {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": "bearer",
        "user": UserResponse.from_mongo(result["user"]).model_dump()
    }
    if "workspace" in result:
        data["workspace"] = WorkspaceResponse.from_mongo(result["workspace"], result["workspace"]["role"]).model_dump()
        
    return {
        "success": True,
        "data": data,
        "message": "Login successful"
    }

@router.post("/refresh")
async def refresh(request: RefreshRequest = Body(...)):
    try:
        payload = decode_token(request.refresh_token)
        if payload.get("type") != "refresh":
            raise AppException(status_code=401, code="UNAUTHORIZED", message="Invalid token type")
        
        user_id = payload.get("sub")
        
        access_token = create_access_token(subject=user_id, email=payload.get("email", ""))
        refresh_token = create_refresh_token(subject=user_id)
        
        return {
            "success": True,
            "data": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer"
            },
            "message": "Token refreshed"
        }
    except Exception:
        raise AppException(status_code=401, code="UNAUTHORIZED", message="Invalid refresh token")

@router.post("/logout")
async def logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    if credentials:
        token = credentials.credentials
        try:
            import time
            payload = decode_token(token)
            exp = payload.get("exp")
            if exp:
                ttl = int(exp - time.time())
                if ttl > 0:
                    from app.services.pipeline_execution_service import get_redis_client
                    r = get_redis_client()
                    if r:
                        r.setex(f"blacklist:{token}", ttl, "true")
        except Exception:
            pass # Ignore if token is already expired or Redis is down

    return {
        "success": True,
        "data": {},
        "message": "Logout successful"
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_active_user)):
    user_id = str(current_user["_id"])
    workspaces = await workspace_service.get_user_workspaces(user_id)
    
    return {
        "success": True,
        "data": {
            "user": UserResponse.from_mongo(current_user).model_dump(),
            "workspaces": [WorkspaceResponse.from_mongo(ws, ws["role"]).model_dump() for ws in workspaces]
        },
        "message": "Current user fetched"
    }
