# Hidden Mock and Silent Fallback Audit

This document provides a comprehensive audit of all silent mock data fallbacks, hardcoded datasets, and demo-mode assumptions currently existing in `frontend-mnl`.

## 1. Audit of `frontend-mnl/src/services/api.ts`

The core API service file contains numerous functions that check `isDemoMode()` to return mock data, which is standard for demo runs. However, many functions also implement `try-catch` blocks that silently fall back to `mockApi` methods if a real backend API request fails, hiding connectivity issues.

### Silent Fallback Points:

1. **`getDashboardData()`**
   - **Current Code**:
     ```typescript
     export async function getDashboardData() {
       if (isDemoMode()) {
         return mockApi.getDashboardData();
       }
       try {
         const [summary, recent] = await Promise.all([
           getExperimentSummary(),
           getRecentRuns()
         ]);
         return { summary, recent };
       } catch {
         return mockApi.getDashboardData(); // SILENT FALLBACK
       }
     }
     ```
   - **Risk**: Hides backend service failure or database connection issues, rendering simulated metrics as real.

2. **`getMolecules()`**
   - **Current Code**:
     ```typescript
     export async function getMolecules(...) {
       ...
       if (isDemoMode()) {
         return mockApi.getMolecules(page, limit);
       }
       try {
         return await apiFetch<MoleculesListResponse>("/molecules", { params });
       } catch {
         return mockApi.getMolecules(page, limit); // SILENT FALLBACK
       }
     }
     ```
   - **Risk**: Renders simulated molecule listings when backend-mnl is offline.

3. **`getMolecularSimilarity()`**
   - **Current Code**:
     ```typescript
     export async function getMolecularSimilarity(...) {
       try {
         return await apiFetch<SimilaritySearchResponse>("/similarity/search", ...);
       } catch {
         return mockApi.getMolecularSimilarity(smiles, topK); // SILENT FALLBACK
       }
     }
     ```
   - **Risk**: Blurs real chemical space comparisons with hardcoded simulated neighbors.

4. **`getResearchSummary()` and `getResultsOverview()`**
   - **Current Code**:
     ```typescript
     export async function getResearchSummary() {
       ...
       try {
         return await getResultsOverview();
       } catch {
         return mockApi.getResearchSummary(); // SILENT FALLBACK
       }
     }
     ```
   - **Risk**: Mixes mock results statistics with actual project progress.

5. **`getDockingResults()`**
   - **Current Code**:
     ```typescript
     export async function getDockingResults(...) {
       ...
       try {
         return await apiFetch<DockingResult[]>("/results/docking", { params: { limit } });
       } catch {
         return mockApi.getDockingResults(limit); // SILENT FALLBACK
       }
     }
     ```
   - **Risk**: Hardcoded molecular docking energies are shown to users instead of throwing connection error.

6. **`getQuantumResults()`**
   - **Current Code**:
     ```typescript
     export async function getQuantumResults(...) {
       ...
       try {
         return await apiFetch<QuantumResult[]>("/results/quantum", { params: { limit } });
       } catch {
         return mockApi.getQuantumMetrics(limit); // SILENT FALLBACK
       }
     }
     ```
   - **Risk**: Presents simulated orbital HOMO/LUMO energies as calculated quantum results.

7. **`getCandidates()`**
   - **Current Code**:
     ```typescript
     export async function getCandidates(...) {
       ...
       try {
         return await getRankedCandidates("existing", limit);
       } catch {
         return mockApi.getCandidates(limit); // SILENT FALLBACK
       }
     }
     ```
   - **Risk**: Fails to signal ranked candidate generation errors.

8. **`getValidationStatus()`**
   - **Current Code**:
     ```typescript
     export async function getValidationStatus(...) {
       try {
         return await getPipelineStatus(experimentId);
       } catch {
         return mockApi.getValidationStatus(experimentId); // SILENT FALLBACK
       }
     }
     ```
   - **Risk**: Implies validation pipeline tasks succeeded when backend is actually offline.

9. **`getPipelineExperiments()`**
   - **Current Code**:
     ```typescript
     export async function getPipelineExperiments(...) {
       ...
       try {
         ...
       } catch (err) {
         return mockApi.getExperiments(); // SILENT FALLBACK
       }
     }
     ```
   - **Risk**: Lists hardcoded oncology experiments rather than warning about DB retrieval failure.

---

## 2. Audit of `frontend-mnl/src/services/experiments.ts`

- **Current Config**: `const USE_EXPERIMENTS_API = false;`
- **Assumptions**: Bypasses the backend-mnl experiments API completely by default, routing all queries locally.
- **Risk**: Overwrites database checks with local react-state or localStorage, violating platform authority.

---

## 3. Remediation Strategy for Phase B

1. **Strict Fallback Prevention**: Modify `api.ts` catch blocks so they only return mock data when `isDemoMode()` resolves to `true`. If `isDemoMode()` is `false`, the caught exception must be propagated (`throw err;`) to let the page trigger error boundaries or render local scientific error/unavailable UI states.
2. **Explicit Demo Defaulting**: Toggle `isDemoMode()` default from `true` to `false`. Explicit `NEXT_PUBLIC_DEMO_MODE=true` environment configuration is required to invoke demo fallbacks.
3. **Canonical Routing**: Change `USE_EXPERIMENTS_API` to `true` by default when demo mode is inactive.
