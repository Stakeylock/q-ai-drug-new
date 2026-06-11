# Scientific UI State Matrix

This document maps all dashboard interfaces to their standard scientific UI states, ensuring consistent error handling and loading indicators across the application.

---

## 1. Unified State Components Library

All pages consume the following components from `@/components/ui`:

*   **`LoadingState`**: Displays a themed loading spinner and high-contrast micro-animations with a custom message.
*   **`ErrorState`**: Displays an error alert with visual cues, technical debugging information, and a retry action button.
*   **`EmptyState`**: Rendered when database tables exist but contain no records. Offers action buttons to initiate runs.
*   **`UnavailableState`**: Renders when the pipeline scheduler or compute nodes are unreachable.
*   **`PlaceholderNotice` / `ScientificWarning`**: Displays warnings when visual layers mix imported assets or contain partial metrics.

---

## 2. Page State Mapping Matrix

| Page Path | Loading State | Error State | Empty State | Partial/Imported Notice |
| :--- | :--- | :--- | :--- | :--- |
| **Docking** (`/docking`) | "Loading docking trajectory calculations..." | "Compute session error" + Retry | "No Docking Results Found" + Setup Docking | Dynamic `ProvenanceBadge` (`simulated`, `q_ai_drug`, `qudrugforge`) |
| **Quantum** (`/quantum`) | "Loading quantum orbital calculations..." | "Quantum compute session error" + Retry | "No Quantum Mechanical Scores Found" | Dynamic `ProvenanceBadge` (`simulated`, `q_ai_drug`, `qudrugforge`) |
| **Simulation** (`/simulation`) | "Loading molecular dynamics trajectory calculations..." | "Simulation compute session error" + Retry | "No Molecular Dynamics Trajectories Found" | Dynamic `ProvenanceBadge` (`simulated`, `q_ai_drug`, `qudrugforge`) |
| **Validation** (`/validation`) | "Loading ADMET physiological assessments..." | "Validation compute session error" + Retry | "No ADMET Profiles Found" | Dynamic `ProvenanceBadge` (`simulated`, `q_ai_drug`, `qudrugforge`) |
| **Results** (`/results`) | "Fetching unified experiment database..." | "Failed to fetch project results" + Retry | "No Results Recorded" | Dynamic `ProvenanceBadge` (`simulated`, `q_ai_drug`, `qudrugforge`) |

---

## 3. Implementation Blueprint for New Pages

When developing a new workspace panel, implement state switches in this order:

```typescript
// 1. Loading Switch
if (isLoading) {
  return <LoadingState message="Fetching data..." />;
}

// 2. Error Switch
if (error) {
  return (
    <ErrorState 
      title="Compute Error" 
      explanation="Backend request failed." 
      debugHint={error} 
      action={<button onClick={fetchData}>Retry</button>} 
    />
  );
}

// 3. Empty List Switch
if (data.length === 0) {
  return <EmptyState title="No Data" description="Run calculations." />;
}

// 4. Content Switch
return <MainContentView data={data} />;
```
