# Quinfosys™ QuDrugForge™ — Frontend
> **Quantum AI Drug Discovery Platform — AI-Powered Computational Molecular Intelligence**

QuDrugForge™ is a highly advanced, web-based frontend for a Quantum AI Drug Discovery Platform. It demonstrates a project-centric computational research workspace tailored for oncology and molecular intelligence. It provides high-fidelity, interactive representations of structural biology, molecular properties, molecular dynamics, and quantum-assisted docking results within a premium, enterprise-grade scientific UI.

---

## 1. Core Visual Pillars

The platform delivers a complete virtual screening, deep-learning, and quantum-assisted lead refinement experience:
* **Project-Centric Research Workspace**: Manage complex clinical targets, target proteins, and molecular candidate libraries under organized discovery programs (e.g., EGFR NSCLC).
* **Unified Pipeline Orchestrator**: Enqueue full sequential multi-stage pipelines (Vina Docking, GNINA CNN rescoring, QML descriptor calculations, ADMET toxicity profiling, and MD Simulations) with a live visual stepper indicator.
* **WebGL Structural Visualizers**: Interact with real-time 3D molecular structures (proteins and candidate poses) using GPU-accelerated rendering widgets.
* **Dynamic Reports Panel**: Instantly compile analytical scientific dossiers and download reports as PDFs/HTMLs directly from active backend file storage metadata.

---

## 2. Integrated Mode & Verification Status

### Phase 20 Integration Status:
* **Real REST Integration**: **100% Fully Connected**. All Workspace triggers, pipeline enqueuers, docking configurations, GNINA rescorers, and report listings are hooked up directly to the FastAPI server running at `http://127.0.0.1:8001`.
* **Provenances Badges**: The interface features dynamic badges (`REAL BACKEND DATA`, `LIVE Q-AI-DRUG PIPELINE`, `IMPORTED RESULTS`) explicitly declaring actual data states.
* **4-Second Polling Loop**: Dynamic polling triggers during active background pipeline states, updating stepper transitions (`queued` ➔ `running` ➔ `importing_results` ➔ `completed`) and automatically refreshing dashboard totals.

---

## 3. Tech Stack

* **Framework**: React 18 / Next.js 14.2 (App Router)
* **Language**: TypeScript (verified compilation `tsc --noEmit` cleanly)
* **Styling**: Tailwind CSS (with PostCSS & Autoprefixer)
* **State Management**: Zustand
* **Animations**: Framer Motion
* **Scientific Visualizers**: react-plotly.js, 3Dmol.js, Recharts, @tanstack/react-table
* **UI Elements**: Sonner (Toast notifications), react-markdown

---

## 4. Directory Structure

```text
frontend-mnl/
├── src/
│   ├── app/                  # Next.js App Router definitions
│   │   ├── (auth)/           # Authentication layout and login/register routes
│   │   ├── (dashboard)/      # Main application workspace layout and features
│   │   │   ├── research-projects/[id]/page.tsx # E2E integrated project dashboard
│   │   │   └── docking/page.tsx # Docking run configuration & triggers page
│   │   └── globals.css       # Core design system and theme variables
│   ├── components/           # Reusable UI widgets
│   ├── services/             # Core API layer (apiClient mapping real vs mock)
│   ├── store/                # Zustand global state definitions
│   └── types/                # Shared TypeScript structures
├── tests/                    # Playwright end-to-end testing suite
│   └── e2e/
│       └── pipeline-orchestration.spec.ts # Master pipeline orchestration E2E spec
├── package.json              # System configurations
└── README.md                 # Frontend guide
```

---

## 5. Development Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Create a `.env.local` file mapping the backend endpoints:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001
NEXT_PUBLIC_DEMO_MODE=false
```

### Step 3: Run Development Server
```bash
npm run dev
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## 6. E2E Playwright Automation

The repository features automated, CI-ready end-to-end testing specs written in **Playwright**.

### Step 1: Install Browser Engines
```bash
npx playwright install
```

### Step 2: Run End-to-End Tests
Ensure the backend server is running on port 8001 and run E2E suites:

```bash
# Run all tests in headless mode
npm run test:e2e

# Run tests targeting the real backend integration
# Set E2E_MODE=real in .env.e2e
npx playwright test tests/e2e/pipeline-orchestration.spec.ts
```