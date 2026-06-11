# Demo Mode Enforcement and Runtime Integration

This document outlines the design and operational rules for the demo mode switch and how it integrates with the rest of the application.

---

## 1. Environment Configuration

By default, the application runs in **Production/Scientific Mode**. All connection parameters point to the real API gateways and require live compute connections.

Demo mode is strictly controlled via environment variables:

```bash
# To run in live scientific compute mode (Default):
NEXT_PUBLIC_DEMO_MODE=false

# To enforce offline demo mode:
NEXT_PUBLIC_DEMO_MODE=true
```

---

## 2. API Layer Enforcement

The `api.ts` file acts as the single gateway authority. It exposes `isDemoMode()` which is implemented as follows:

```typescript
export function isDemoMode(): boolean {
  // If the variable is not defined, we default to false (Live integration)
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
```

### API Call Separation
When `isDemoMode()` is `true`:
- Calls immediately return simulated JSON payloads from `mockApi` (e.g., `MOCK_EXPERIMENTS`, `QUANTUM_RERANKING`, etc.).
- Network logs will not query the backend-mnl ports.

When `isDemoMode()` is `false`:
- All requests are dispatched to `apiFetch` using the backend API prefix.
- All failed calls throw actual exceptions. Silent mock fallbacks are strictly prohibited.

---

## 3. Experiment Operations Routing

In `src/services/experiments.ts`, the constant `USE_EXPERIMENTS_API` determines whether experiment modifications go to the backend MongoDB or are stored locally:

```typescript
// Enforce MongoDB platform authority unless in explicit demo mode
export const USE_EXPERIMENTS_API = !isDemoMode();
```

---

## 4. UI Indicators and Health Banners

To ensure complete transparency, the following UI components respond directly to the runtime state:

1. **Backend Status Banner**: If `isDemoMode()` is `false` and the backend service becomes unreachable, a high-severity alert banner appears at the top of the dashboard. In demo mode, this banner is hidden.
2. **Health Indicator**: A small dot in the footer/header stays green if connected to backend-mnl, orange if loading, and blinking red if offline.
3. **Badge Metadata**: The dynamic provenance badges indicate `SIMULATED` vs `REAL` depending on `isDemoMode()`.
