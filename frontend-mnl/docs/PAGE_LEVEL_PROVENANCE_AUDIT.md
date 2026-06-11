# Page-Level Provenance Integration Audit

This audit evaluates the main scientific workspaces in `frontend-mnl` to determine how they load data and how to integrate standard provenance badges.

---

## 1. Docking Workspace (`/docking`)
- **File**: `frontend-mnl/src/app/(dashboard)/docking/page.tsx`
- **Data Loaders**:
  - `apiClient.get("/projects/{id}/docking/results")`
  - `apiClient.get("/projects/{id}/gnina/results")`
- **Current Provenance Logic**:
  - Checks if any result contains `r.source === "q_ai_drug_import"` or `r.metadata?.import_id`.
  - Renders a hardcoded custom source badge (lines 240-249).
- **Target Implementation**:
  - Replace the custom banner with `<ProvenanceBadge items={activeResults} isDemo={isDemoMode()} hasError={hasError} />` using the centralized `ProvenanceResolver`.
  - Add specific warning overlay: if page is empty or falls back, render `<PlaceholderNotice type="docking" />`.

---

## 2. Quantum Workspace (`/quantum`)
- **File**: `frontend-mnl/src/app/(dashboard)/quantum/page.tsx`
- **Data Loaders**:
  - `apiClient.get("/projects/{id}/quantum/qml-scores")`
- **Current Provenance Logic**:
  - Sets data source status to `"IMPORTED Q-AI-DRUG DATA"` or `"REAL BACKEND DATA"` based on checking items for source `"q_ai_drug"`.
  - Renders custom source badge at lines 185-194.
- **Target Implementation**:
  - Integrate `<ProvenanceBadge items={realQuantum} isDemo={isDemoMode()} />`.
  - Show warning notice if data falls back.

---

## 3. Simulation Workspace (`/simulation`)
- **File**: `frontend-mnl/src/app/(dashboard)/simulation/page.tsx`
- **Data Loaders**:
  - `apiClient.get("/projects/{id}/simulations/results")`
- **Current Provenance Logic**:
  - Sets source based on item metadata source/import flags.
  - Renders badge at lines 167-176.
- **Target Implementation**:
  - Replace with `<ProvenanceBadge items={realSim} isDemo={isDemoMode()} />`.

---

## 4. Validation Workspace (`/validation`)
- **File**: `frontend-mnl/src/app/(dashboard)/validation/page.tsx`
- **Data Loaders**:
  - `apiClient.get("/projects/{id}/admet/results")`
- **Current Provenance Logic**:
  - Checks items for `"q_ai_drug"` or `import_id` source flags.
  - Renders badge at lines 181-190.
- **Target Implementation**:
  - Integrate `<ProvenanceBadge items={realAdmet} isDemo={isDemoMode()} />`.

---

## 5. Reports Workspace (`/results`)
- **File**: `frontend-mnl/src/app/(dashboard)/results/page.tsx`
- **Data Loaders**:
  - `getReportSummary(projectId)`
  - `getReports(projectId)`
  - `getReportFiles(projectId, reportId)`
- **Current Provenance Logic**:
  - Explicitly categorizes source: `"qudrugforge"`, `"q_ai_drug"`, `"manual_import"`.
  - Renders source status in table cells and sidebar cards.
- **Target Implementation**:
  - Standardize source rendering using `<ProvenanceBadge>` mapping for each individual report entry.
  - Eliminate the hardcoded "REAL BACKEND REPORTS" static section (lines 1004-1013) in favor of the global `BackendStatusBanner` and individual file state resolvers.
