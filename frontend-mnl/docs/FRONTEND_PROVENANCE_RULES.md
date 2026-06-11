# Frontend Provenance Rules and UI Lineage Guidelines

This document details the rules and design standards for scientific data provenance and runtime honesty across the `frontend-mnl` application.

---

## 1. Governance Principles

The platform's primary value lies in scientific reliability and verifiable computations. Therefore, the user interface must enforce strict provenance rules:
1. **No Simulated Obfuscation**: The UI must never present mock data, static placeholders, or simulated results as live compute.
2. **Explicit Lineage Labeling**: Every page displaying computed properties (e.g., Docking, Quantum Reranking, Simulation, ADMET Validation) must render a dynamic provenance indicator specifying the exact dataset authority.
3. **Fail Loudly & Gracefully**: If backend nodes or MongoDB connections fail, the UI must halt loading and render a standardized `ErrorState` or `UnavailableState` component with detailed debug info and a retry trigger. It must **never** silently fall back to mock data.

---

## 2. Standardized Provenance Badges

To maintain a consistent and premium user experience, all pages must consume the unified components exported in `@/components/ui`:

```typescript
import { ProvenanceBadge, ProvenanceLegend } from "@/components/ui";
```

### Color Palette Mapping
The badges enforce strict semantic styling:

| Scientific Source | Color Token / Class | Hex Code | Meaning / Definition |
| :--- | :--- | :--- | :--- |
| **Simulated Mode** (`simulated`) | `bg-warning/20 text-warning` | `#EAB308` | local demo state, offline simulation placeholders. |
| **Legacy Compute** (`q_ai_drug`) | `bg-emerald-500/20 text-emerald-400` | `#10B981` | data imported from the `q-ai-drug` computation server. |
| **Active Forge Engine** (`qudrugforge`) | `bg-accent/20 text-accent` | `#0EA5E9` | live compute generated dynamically by the active backend pipeline. |

---

## 3. Data Linage Indicators Requirements

### Page Header Registry
Headers must compute their data source lineage dynamically. If results are loaded:
- If `isDemoMode()` is `true`, `dataSource` is `"mock"`.
- If there are results and they are imported from `q-ai-drug`, `dataSource` is `"real"` but visual badges highlight the import status.
- If there are no results, `dataSource` is `"missing"`.

### Data Grid Badging
When rendering compound cards or discovery ledgers:
- Individual rows and lists must denote any imported or mock entries clearly using secondary inline tags if they differ from the active project pipeline source.
- Do not mix simulated data with live compute within the same listing unless clearly demarcated.

---

## 4. Remediation Workflow for Developers
When implementing new visualization or analysis tabs:
1. **Define Error States**: Add `error` and `isLoading` states to the page component.
2. **Handle API Exceptions**: Catch errors in your service query and set the local component `error` state. Do not swallow it.
3. **Conditional Rendering**: Check `isLoading` first, then `error` second, and `empty results` third, before rendering the main dashboard viewport.
4. **Lineage Indicator**: Embed the dynamic `ProvenanceBadge` container directly below the `PageHeader`.
