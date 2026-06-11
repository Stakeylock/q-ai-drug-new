# QuDrugForge Phase 17 E2E Testing Guide

This documentation guides researchers on how to initialize, run, and customize the Playwright End-to-End (E2E) testing framework for QuDrugForge™.

---

## 📋 Prerequisites

Before running E2E tests, ensure you have the following prerequisites installed and configured:
1. **Node.js**: Node 18+ is recommended.
2. **Playwright Browsers**: Ensure Playwright's browser binaries are downloaded:
   ```bash
   npx playwright install chromium
   ```
3. **Environment Setup**: Ensure `.env.e2e` matches your target ports:
   - **Frontend**: http://localhost:3001
   - **Backend**: http://127.0.0.1:8001
   - **Q-AI-Drug**: http://127.0.0.1:8000

---

## 🚀 Execution Commands

We provide a set of npm scripts in `package.json` to make running and debugging tests straightforward:

### 1. Run All E2E Tests (Headless)
Runs all discovered tests inside the `tests/e2e` folder sequentially or in parallel as configured:
```bash
npm run test:e2e
```

### 2. Run Headed Mode
Visualizes the test browser execution in real-time. Extremely useful for debugging UI glitches:
```bash
npm run test:e2e:headed
```

### 3. Run Specific Smoke Test
Runs only the consolidated smoke suite:
```bash
npx playwright test tests/e2e/qudrugforge-smoke.spec.ts
```

### 4. View Test Report
Launches Playwright's beautiful interactive HTML report to view trace steps, failures, and media:
```bash
npm run test:e2e:report
```

---

## 🎥 Video Recording & Traces

Playwright is configured inside `playwright.config.ts` to automatically record videos and capture execution traces:
* **Traces (`trace: 'on'`)**: Captures complete step telemetry, console logs, and network state for every run.
* **Videos (`video: 'on'`)**: Records a WebM video of the browser interaction viewport, stored under the `test-results/` directory.
* **Screenshots (`screenshot: 'only-on-failure'`)**: Automatically snaps a viewport screenshot upon any failed assertion.

To view traces in the HTML report:
1. Run `npm run test:e2e:report`.
2. Click on a test case row.
3. Scroll to the **Traces** section and click on the trace preview to launch the Playwright Trace Viewer.

---

## ⚡ Run Headed Mode
To run a specific spec in headed mode with visual browser controls:
```bash
npx playwright test tests/e2e/qudrugforge-smoke.spec.ts --headed
```

---

## ⚠️ Known Limitations
* **Port Conflict**: Ensure no other background process is using port `3001` or `8001` before launching.
* **Database State**: In `real` mode, E2E tests automatically register a unique user via API calls to ensure clean database state. Avoid manual pre-created users when possible.
