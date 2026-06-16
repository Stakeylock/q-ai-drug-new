import asyncio
import time
import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings

logger = logging.getLogger("qudrugforge-ratelimit")

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Thread-safe in-memory sliding window rate limiting middleware.
    Restricts requests by IP address within a configurable time window.
    """
    def __init__(self, app, limit: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window = window_seconds
        self.requests = {}
        self._lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next):
        # Gracefully exempt static document or system health routes, or when running tests
        if settings.APP_ENV == "test":
            return await call_next(request)

        exempt_paths = {"/", "/health", "/docs", "/redoc", "/openapi.json"}
        if request.url.path in exempt_paths or request.url.path.startswith("/api/v1/health"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        async with self._lock:
            # Retrieve request timestamps for this IP
            timestamps = self.requests.get(client_ip, [])

            # Filter out timestamps outside the active window
            timestamps = [t for t in timestamps if now - t < self.window]
            self.requests[client_ip] = timestamps

            if len(timestamps) >= self.limit:
                logger.warning(f"Rate limit triggered for IP: {client_ip} on path: {request.url.path}")
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "success": False,
                        "error": {
                            "code": "TOO_MANY_REQUESTS",
                            "message": f"Too many requests. Limit is {self.limit} per {self.window} seconds."
                        }
                    }
                )

            self.requests[client_ip].append(now)
        return await call_next(request)
