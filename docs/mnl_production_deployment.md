# QuDrugForge MNL Production Deployment

This checklist covers the `frontend-mnl`, `backend-mnl/qudrugforge-backend`, and `docker-compose.mnl.prod.yml` stack.

## Required Secrets And URLs

Set these before deploying the production Compose stack:

```text
POSTGRES_PASSWORD
MINIO_ROOT_USER
MINIO_ROOT_PASSWORD
QAI_JWT_SECRET
QAI_ALLOWED_ORIGINS
JWT_SECRET_KEY
FRONTEND_URL
CORS_ORIGINS
NEXT_PUBLIC_API_URL
```

For Razorpay pricing checkout, also set these when payment collection is ready:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

Do not commit real Razorpay keys or JWT secrets. Keep `NEXT_PUBLIC_DEMO_MODE=false` for production.

## Preflight

```powershell
docker compose -f docker-compose.mnl.prod.yml config --quiet
npm audit --omit=dev --prefix frontend-mnl --audit-level=high
npm audit --omit=dev --prefix user-front --audit-level=high
npm run build --prefix frontend-mnl
pytest backend-mnl\qudrugforge-backend\tests -q
pytest tests -q
```

## Frontend Standalone Server

The frontend uses Next standalone output. `npm run build --prefix frontend-mnl` now copies `.next/static` and `public` into `.next/standalone`, so the generated server can serve JS/CSS assets correctly outside Docker.

```powershell
cd frontend-mnl
npm ci
npm run build
$env:PORT="3001"
npm run start
```

## Docker Production Stack

```powershell
docker compose -f docker-compose.mnl.prod.yml up -d --build
```

Production hardening currently enforced by the app:

- Backend docs/OpenAPI are disabled when `APP_ENV=production`.
- Backend debug internals are redacted from system info in production.
- Health checks return HTTP 503 when database or storage dependencies are degraded.
- CORS is driven by explicit production origins.
- Demo/mock data is isolated behind demo mode instead of silently replacing failed production API calls.
- Razorpay order creation and verification paths are present, but inert until real keys and webhook secret are configured.

