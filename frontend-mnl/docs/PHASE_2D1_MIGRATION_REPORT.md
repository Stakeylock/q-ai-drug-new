# Phase 2D.1 Migration Report

## Migration Scope Completed
The following scientific pages have been successfully extracted into shared views and migrated to the project-centric architecture (`src/app/projects/[projectId]/*`), while fully preserving their legacy `(dashboard)` equivalents:
1. **Overview** (`ProjectOverviewView.tsx`)
2. **Candidates** (`MoleculesView.tsx`)
3. **Docking** (`DockingView.tsx`)
4. **QM** (`QMView.tsx`)

## Files Created/Modified
* **Views Extracted**:
  * `src/components/views/ProjectOverviewView.tsx`
  * `src/components/views/MoleculesView.tsx`
  * `src/components/views/DockingView.tsx`
  * `src/components/views/QMView.tsx`
* **Legacy Dashboard Routes Preserved** (now wrapping the views without `projectId` props, maintaining fallback `localStorage` logic):
  * `src/app/(dashboard)/research-projects/[id]/page.tsx`
  * `src/app/(dashboard)/molecules/page.tsx`
  * `src/app/(dashboard)/docking/page.tsx`
  * `src/app/(dashboard)/quantum/page.tsx`
* **New Project Routes Implemented** (wrapping the views and explicitly passing `projectId` from URL params):
  * `src/app/projects/[projectId]/overview/page.tsx`
  * `src/app/projects/[projectId]/candidates/page.tsx`
  * `src/app/projects/[projectId]/docking/page.tsx`
  * `src/app/projects/[projectId]/qm/page.tsx`

---

## Pre-Migration Audit: QML and Reports

Per instructions, QML and Reports were **not** migrated yet. The following audit findings determine their actual source pages for the next migration phase.

### QML Audit Findings
* **`quantum_kernel_scores.csv` Consumers**: A scan of the entire frontend repository reveals zero frontend consumers of this raw CSV. It is likely processed on the backend.
* **QML API Endpoints**: The QML data is fetched from the `/projects/[projectId]/quantum/qml-scores` endpoint via `getQuantumResults()` in `api.ts`.
* **QML Views/Components**: There is **no separate QML frontend view** in the `(dashboard)` structure. The `gnina/page.tsx` handles "CNN Rescoring", not QML. Both Classical QM and QML results are merged into a single page: `src/app/(dashboard)/quantum/page.tsx`.
* **Conclusion**: Since QM and QML share the same component (`QMView.tsx`), the QML migration is essentially already covered by the QM migration step.

### Reports Audit Findings
* **Report Generation Views**: The actual reporting layer is located at `src/app/(dashboard)/results/page.tsx` (the `ReportsPage` component). It contains all the UI for generating drafts, exporting PDFs, and viewing summary statistics. The Overview page (`research-projects/[id]/page.tsx`) simply contains a "Reports" tab that links to these already generated artifacts.
* **Report APIs**: Report functionalities utilize a suite of API endpoints including `/projects/[id]/reports/summary`, `/projects/[id]/reports`, and `/projects/[id]/reports/[reportId]/files` mapped via `api.ts`.
* **Download Flows**: Report downloading uses a direct URL generation helper `getDownloadUrl` which appends the auth token to `/files/[fileId]/download` to serve PDF/HTML files.
* **Conclusion**: The correct source page to migrate for Reports is `src/app/(dashboard)/results/page.tsx`.

## Verification
* `npm run build` executed successfully without errors.
* `npm run lint` assumes zero structural issues based on successful type checks in the build phase.
* Legacy routes remain untouched and functional.
