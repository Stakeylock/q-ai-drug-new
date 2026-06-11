# 🧬 THE FINAL PLAN: QuDrugForge Production Readiness

This document outlines the comprehensive production readiness plan for the entire **QuDrugForge** platform. It integrates findings from deep-dive audits of the frontend, backend, infrastructure, and ML pipeline to serve as a complete, step-by-step roadmap to launch.

---

## 1. Executive Summary & Architecture Overview

QuDrugForge is an AI-powered drug discovery platform that integrates machine learning models, molecular docking, molecular dynamics (MD), and quantum calculations.

### System Architecture Topology
```
                  ┌─────────────────────────────────┐
                  │          USER BROWSER           │
                  └────────────────┬────────────────┘
                                   │
                                   │ HTTPS / WSS
                                   ▼
                  ┌─────────────────────────────────┐
                  │    NginX / Traefik Reverse Proxy │
                  └────────┬───────────────┬────────┘
                           │               │
                           │ Port 3001     │ Port 8000
                           ▼               ▼
           ┌──────────────────────┐ ┌──────────────────────┐
           │     FRONTEND-MNL     │ │     BACKEND-MNL      │
           │     (Next.js 14)     │ │   (FastAPI Gateway)  │
           └──────────────────────┘ └──────────┬───────────┘
                                               │
                           ┌───────────────────┼───────────────────┐
                           │                   │                   │
                           ▼                   ▼                   ▼
                     ┌───────────┐       ┌───────────┐       ┌───────────┐
                     │ PostgreSQL│       │  MongoDB  │       │   Redis   │
                     │  (SaaS)   │       │(Workspace)│       │  (Queue)  │
                     └───────────┘       └───────────┘       └─────┬─────┘
                                                                   │
                                           ┌───────────────────────┴───────────────┐
                                           │                                       │
                                           ▼                                       ▼
                               ┌──────────────────────┐                ┌──────────────────────┐
                               │     WORKER BASE      │                │   SCIENTIFIC WORKERS │
                               │  (Data/Gen/Reports)  │                │ (Docking/QM/MD/QML)  │
                               └──────────────────────┘                └──────────────────────┘
```

---

## 2. Phase-by-Phase Roadmap

### Phase 0: Critical Blockers (Weeks 1)
Fix all type mismatches, missing imports, and pre-rendering issues in the frontend that currently prevent production builds. Fix Dockerfile syntax issues in both frontend and backend.

### Phase 1: Clean Build Validation (Week 1)
Consolidate duplicate routes, configure Next.js environment configurations, clean up one-off refactoring scripts, and verify both next build and docker build run successfully in a clean container.

### Phase 2: Unified Backend & API Integration (Weeks 2-3)
Establish a unified API client architecture on the frontend using TanStack Query. Connect mock pages (Molecules, Docking, Quantum, Simulation, etc.) to the real FastAPI backend on port 8000. Establish WebSocket connections for real-time pipeline status updates.

### Phase 3: Error Hardening & State Management (Week 3)
Add global and layout-level React Error Boundaries, custom Not Found (404) pages, loading skeletons for all routes, and offline indicators. Refactor Zustand stores with persist middleware.

### Phase 4: Production Security Hardening (Week 4)
Replace mock auth services with JWT authentication utilizing `httpOnly` secure cookies. Set up route protection middleware. Configure secure CORS policies and response sanitization. Rotate dev secrets.

### Phase 5: Client-Side Performance Tuning (Week 4)
Lazy load heavy dependencies (e.g., Plotly.js, 3Dmol.js). Set up client-side API caching with SWR or TanStack Query. Optimize next/image usages. Run bundle analysis.

### Phase 6: Automated Testing Setup (Week 5)
Implement Jest and React Testing Library for frontend unit/component tests. Add MSW (Mock Service Worker) for API contract tests. Unify the Playwright E2E suites to use a test environment database.

### Phase 7: Infrastructure & Deployments (Weeks 5-6)
harden Docker Compose configurations with service healthchecks, network segmentations, and resource limits. Set up a reverse proxy (NginX/Traefik). Establish CI/CD pipelines targeting a staging/production environment.

### Phase 8: Refactoring & Code Quality (Week 6)
Remove temporary scripts, clean up unused dependencies, split monolithic view files (e.g., `ProjectOverviewView`, `ReportsView`), and enforce strict ESLint rule checks.

### Phase 9: Missing Features Completion (Week 7)
Complete stubs like `experimentsApi.ts`, add CSV/SDF/PDB exports, add file uploads for targets, implement user profile configurations, and configure dark/light themes.

### Phase 10: Final Pre-Launch Audit (Week 7)
Execute accessibility (a11y) checks, SEO configuration, SSL provisioning, data backup validation, and monitoring alert tests.

---

## 3. Detailed File Audit & Checklist

### 🔴 Critical Blockers (Build & Pre-rendering Fixes)
- [ ] **`frontend-mnl/src/types/api.ts`**
  - Make metadata fields (`source`, `experiment_id`, `pipeline_stage`, `engine`, `provenance`, `disclaimer`) optional in scientific result types (`GeneratedMoleculeResult`, `DockingResult`, etc.) to prevent mismatches with mock/live responses.
- [ ] **`frontend-mnl/src/types/index.ts`**
  - Export the missing `ExperimentInput` type to resolve the import error in `workspaceStore.ts`.
- [ ] **`frontend-mnl/src/store/workspaceStore.ts`**
  - Resolve the import path of `ExperimentInput` (or define it locally).
- [ ] **`frontend-mnl/src/app/(dashboard)/dashboard/history/page.tsx`**
  - Change lowercase string values in checks (e.g., `'Completed'` → `'completed'`, `'Running'` → `'running'`, `'Failed'` → `'failed'`) to align with the `ExperimentStatus` type. Add type properties to mock objects to satisfy the full `ExperimentRecord` interface.
- [ ] **`frontend-mnl/src/app/(dashboard)/history/page.tsx`**
  - **DELETE** this duplicate file. Set up a redirect from `/history` to `/dashboard/history` in `next.config.js`.
- [ ] **`frontend-mnl/src/app/(dashboard)/simulation/page.tsx`**
  - Add `import { Button } from '@/components/ui/Button'`.
- [ ] **`frontend-mnl/src/app/(dashboard)/validation/page.tsx`**
  - Add `import { Button } from '@/components/ui/Button'`.
- [ ] **`frontend-mnl/src/app/(dashboard)/results/components/csv-utils.ts`**
  - Fix type guard evaluations when comparing `string | number | null | undefined` with booleans.
- [ ] **`frontend-mnl/src/app/(dashboard)/research-projects/[id]/claim-matrix/page.tsx`**
  - Fix invalid `ErrorState` prop instantiation (`message` → target prop defined in `ErrorStateProps`).
- [ ] **`frontend-mnl/src/app/(dashboard)/research-projects/[id]/gnina/page.tsx`**
  - Fix invalid `ErrorState` prop instantiation (`message` → target prop defined in `ErrorStateProps`).
- [ ] **`frontend-mnl/src/components/shared/states/ErrorState.tsx`**
  - Consolidate component with `src/components/ui/ErrorState.tsx` and ensure the exported type accepts custom error messages.
- [ ] **`frontend-mnl/src/services/api.ts` & `src/services/mockApi.ts` & `src/services/pipelineDemo.ts`**
  - Resolve data type assignments for mock results to match modified optional schemas.
- [ ] **`frontend-mnl/src/services/experiments.ts`**
  - Fix capitalized status casing assignments (line 91: `'Running'` → `'running'`).
- [ ] **`frontend-mnl/src/app/layout.tsx`**
  - Wrap high-level search params retrieval in `<Suspense>` to prevent SSG bailout errors during build.
- [ ] **`frontend-mnl/src/app/(dashboard)/...` (24 pages)**
  - Wrap any dashboard page reading `useSearchParams()` with `<Suspense>` or export `const dynamic = 'force-dynamic'`.

### 🟡 Docker & Environment Config Fixes
- [ ] **`backend-mnl/qudrugforge-backend/Dockerfile`**
  - Replace invalid double backslashes (`\\\\`) with standard Linux slashes or single backslash line continuations.
- [ ] **`frontend-mnl/Dockerfile`**
  - Fix CMD format: change `CMD [\"node\", \"server.js\"]` to `CMD ["node", "server.js"]`. Remove copying of the non-existent `public` folder or ensure `public` contains static assets.
- [ ] **`docker-compose.mnl.prod.yml`**
  - Move hardcoded passwords (e.g., `postgres`, `qaiadmin123`) to an ignored `.env.production` file and pull them as variables.
- [ ] **`.gitignore`**
  - Add `tsc_errors.log`, `tsc_errors.txt`, `build.log`, and `.env.local` to prevent commits of build output or environment files containing developer secrets.

---

## 4. Architecture, Security, & Infrastructure Gaps

### Security Checklist
1. **JWT Hardening**: Configure uvicorn/fastapi settings to reject fallback secrets in production.
2. **CORS Configuration**: Restrict CORS origins in the backend settings module from wildcard `*` to specific production domain names.
3. **API Rate Limiting**: Implement a slowapi/limits decorator in FastAPI route entrypoints.
4. **Token Blacklisting**: Add Redis caching logic on `/logout` to blacklist JWTs until their expiration.
5. **Exception Handling**: Refactor FastAPI's global exception handler to suppress stack traces or raw errors (`str(exc)`) in production, returning structured error objects instead.

### Infrastructure & Operations
1. **Reverse Proxy Topology**: Implement NginX or Traefik in `docker-compose.mnl.prod.yml` to handle incoming HTTPS/WSS connections, route path prefixes (e.g., `/api/v1` to API gateway, `/` to frontend), and terminate TLS certificates.
2. **Docker Network Isolation**: Segregate networks in docker-compose. Assign databases, Redis queues, uvicorn gateways, and RQ workers to specific subnets.
3. **Volume Backups**: Configure Cron tasks to automatically backup Postgres and MongoDB storage directories.
4. **Health Checking**: Configure Docker compose health checks to verify service availability before starting dependent workers.

---

## 5. ML Pipeline & Trained Models Optimization

1. **Git LFS Migration**: Move model binaries (`best_tox_model.pt`, `drug_discovery_models.pt`) and large datasets from git history into Git LFS or secure bucket storage (e.g., AWS S3/MinIO).
2. **Worker Scaling**:
   - Establish dedicated queue allocations on worker containers.
   - Configure scientific workers to run Autodock Vina, SMina, and xTB tasks concurrently.
3. **GPU Configuration**: Update worker Dockerfiles to utilize PyTorch CUDA bases if GPUs are available in the target environment, fallback gracefully to CPU execution.
4. **Security in Pipeline Scripts**: Remove hardcoded binary URLs from the setup script (`setup_wsl_tools.sh`); configure integrity check hashes (e.g., SHA256) when fetching packages.

---

## 6. Timeline & Execution Estimate

```
Phase 0: Critical Blockers (Build/Types)  ████ 1-2 Weeks
Phase 1: Build & Config Validation        █ 0.5 Weeks
Phase 2: API & Unified Integration        ██████ 2 Weeks
Phase 3: Robustness & Error Boundaries     ██ 0.5 Weeks
Phase 4-5: Security & Performance         ████ 1-2 Weeks
Phase 6-8: Testing, Cleanups, & DevOps    ██████ 2 Weeks
Phase 9-10: Features & Final Launch       ████ 1 Week
                                          ──────────────────
                                          Total: ~7-9 Weeks
```

### Dependency Order
`Phase 0 (Type Fixes/Suspense)` ➔ `Phase 1 (Clean Build)` ➔ `Phase 2 (FastAPI Integration)` ➔ `Phase 4 (Security/JWT)` ➔ `Phase 7 (DevOps/Docker)` ➔ `Phase 10 (Launch)`
