# Product Deployment Notes

The local investor demo is served by FastAPI with the static Discovery Console and investor site. The Docker Compose stack adds the deployable product shell requested in the investor plan: API, worker containers, PostgreSQL, Redis, and MinIO.

## Local Investor Demo

```powershell
cmake --workflow --preset investor-demo
```

This workflow builds the investor package, runs tests and validation, generates the completion report, starts the API, and opens:

```text
http://127.0.0.1:8000/investor
http://127.0.0.1:8000/dashboard
```

## Docker Compose Demo

```powershell
docker compose up --build
```

Services:

| Service | Purpose |
| --- | --- |
| `api` | FastAPI API gateway, dashboard, investor website, artifact serving |
| `worker-base` | Redis/RQ worker for default, data, training, generation, and reporting queues |
| `worker-docking` | Redis/RQ worker for docking and MD queues with OpenBabel, AutoDock Vina, Smina, GNINA, xTB, RDKit, and Meeko dependencies |
| `worker-gnina` | Redis/RQ worker dedicated to GNINA CNN docking/rescoring |
| `worker-quantum` | Redis/RQ worker for xTB/Qiskit QM/QML queues |
| `postgres` | PostgreSQL database for users, organizations, projects, runs, jobs, logs, candidates, models, artifacts, reports, API keys, and usage events |
| `redis` | Queue broker for long-running jobs |
| `minio` | Object-storage target for structures, poses, reports, logs, and model files |

The service now has a SQLAlchemy schema and explicit Alembic migration for SaaS entities and Docker Compose points `DATABASE_URL` at PostgreSQL. The API runs migrations on container startup, enqueues runs into Redis/RQ when `QAI_USE_QUEUE=1`, and refuses to silently fall back to local execution when queue enqueue fails. Local developer mode can still disable queues for quick testing. Candidate rows from completed worker runs are ingested into PostgreSQL query tables.

Auth is active for SaaS endpoints: signup/login issue HMAC-signed JWTs, passwords use PBKDF2-HMAC-SHA256, API keys can be created/revoked, and project/run/upload/artifact endpoints enforce organization/project access. Research demo endpoints remain public so the investor dashboard can still load without a login.

User uploads now accept SMILES CSV/SMI, SDF, PDB, PDBQT, and YAML target/pocket config files. Uploads are written through the object-storage layer to MinIO/S3 when configured, with local object-storage fallback for developer mode. Metadata is stored in `artifacts`, and downloads are served through authenticated `/api/artifacts/{artifact_id}/download` routes.

Runs now record stage-by-stage progress, dry-run jobs are available for CI and smoke testing, and usage events are written for project creation, queued runs, uploaded artifacts, uploaded molecules, compute seconds, molecules generated/filtered, docking/GNINA/QM/QML work, and reports.

## Production Hardening Checklist

- Harden auth with email verification, password reset, OAuth, audit logs, and rate limiting.
- Add billing accounts, quotas, and payment integration on top of existing usage events.
- Add curated pocket registry and production receptor preparation.
- Add explicit-solvent protein-ligand MD only after parameterization and validation are implemented.

## Honest Naming

This repository is currently a **deployable investor demo and SaaS-MVP architecture prototype**. It should not be marketed as production SaaS until hosted deployment, security hardening, quotas/billing enforcement, operational monitoring, customer data policies, and full scientific worker scale-out are complete.
