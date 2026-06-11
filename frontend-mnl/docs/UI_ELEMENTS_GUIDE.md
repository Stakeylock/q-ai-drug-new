# QuDrugForge UI Elements Guide

## 1. Overview
QuDrugForge™ is a Quantum AI Drug Discovery Platform. It serves as a project-centric research workspace, providing a seamless computational drug discovery workflow UI. The platform unites classical docking, AI rescoring (GNINA), quantum mechanics (QM) reranking, ADMET toxicity checking, and molecular dynamic simulations into a single, high-performance web interface.

## 2. Global Layout

The application utilizes a consistent AppShell layout across all dashboard pages:

*   **Sidebar:** The primary navigation menu on the left. It is grouped into sections (Main, Research, Visualization, AI, Infrastructure, Organization). It features an active state highlight that tracks the user's current route.
*   **Topbar:** The horizontal header at the top of the workspace.
    *   **Collapse Sidebar Button:** A toggle to minimize the sidebar for a distraction-free, wider workspace.
    *   **Search Bar:** A global search input for finding molecules, targets, or reports. Pressing `Ctrl+K` (or `Cmd+K`) opens the global Command Palette.
    *   **Notifications (Bell Icon):** Displays system alerts, experiment completion statuses, and background task progress.
    *   **Theme Toggle (Sun/Moon Icon):** Switches the UI between the dark (cyber-biotech) and light (slate-clean) themes.
    *   **User Menu:** Displays the active user avatar and provides access to logout and profile settings.
*   **Breadcrumbs:** Located just below the topbar on most pages, indicating the structural hierarchy of the current view (e.g., `Research OS / Oncology Division`).
*   **Research Context Bar (Active Project Pill):** A persistent sticky banner that appears on scientific pages, displaying the active project (e.g., "EGFR NSCLC Discovery Program"), target protein, current pipeline stage, and a progress bar.
*   **Page Headers:** Distinct titles for each page, often accompanied by action buttons (e.g., "Run Pipeline", "Generate Report").
*   **Metric Cards:** Small widget panels summarizing key statistics (e.g., Active Molecules, Average QED, Total Experiments).
*   **Status Badges:** Small, colored pills indicating the state of a process (e.g., green for Success, yellow for Warning, blue for Running, red for Failed).
*   **Tables:** High-density data grids used for displaying molecules, experiment histories, and docking results. They feature horizontal scrolling to prevent layout breakage on smaller screens.
*   **Action Buttons:** Primary (accent color) and secondary (outline/ghost) buttons used to trigger workflows, downloads, or modal dialogs.
*   **Empty/Error/Loading States:** Consistent fallback UI used when data is missing, an API call fails, or a heavy component is mounting.
*   **Pharma LLM Assistant Widget:** A floating, AI chat widget (Copilot) available on certain pages to help researchers interpret data or navigate the platform.

## 3. Page-wise UI Explanation

### Auth Pages

#### Login / Register
*   **Purpose:** Authenticate users into the platform.
*   **UI Elements:** Email/password input fields, OAuth provider buttons (e.g., Google/GitHub), and a "Sign In" or "Create Account" primary button. The layout uses a split-screen design with a cinematic, glowing 3D/molecular graphic on one side and the auth form on the other.
*   **State:** Currently mock; accepts any input to proceed.

#### Workspace Selector
*   **Purpose:** Allows users belonging to multiple organizations to select their active tenant space.
*   **UI Elements:** A list of cards representing different workspaces (e.g., "Oncology Team", "Personal"). Clicking a card redirects the user to the main Dashboard.
*   **State:** Currently mock.

### Core Pages

#### Dashboard (`/dashboard`)
*   **Purpose:** The central hub providing a high-level overview of the entire system.
*   **UI Elements:**
    *   **Metric Cards:** Display total molecules, active experiments, and compute usage.
    *   **Charts Section:** Recharts-based graphs showing activity over time or molecular property distributions.
    *   **Recent Runs Table:** A summary list of the latest pipeline executions.
*   **State:** Data is powered by high-fidelity static mock objects.

#### Research Projects (`/research-projects`)
*   **Purpose:** Manage drug discovery programs.
*   **UI Elements:**
    *   **Project Cards:** Display project name, disease target, timeline, and a progress bar.
    *   **New Project Button:** Opens a modal to define a new program.
*   **State:** Mock data.

#### Project Detail Workspace (Placeholder / Combined into tabs)
*   **Purpose:** The specific workspace for a selected project.
*   **UI Elements:** Contains tabbed navigation to switch between "Input Data" (drag-and-drop file upload zones), "Targets", and "Molecules".

#### Experiments (`/history`)
*   **Purpose:** A comprehensive ledger of all computational tasks.
*   **UI Elements:** A detailed, paginated data table showing Run ID, Pipeline Stage, Engine used, Duration, and Status badges. Includes filter dropdowns to search by status.
*   **State:** Mock data.

#### Reports (`/results`)
*   **Purpose:** Repository of finalized candidate dossiers and validation packages.
*   **UI Elements:** Report Cards displaying the report title, generation date, and download action buttons (PDF/CSV).
*   **State:** Mock data; download buttons trigger success toasts rather than real file downloads.

### Research Modules

#### Targets (`/targets`)
*   **Purpose:** Inspect biological protein targets.
*   **UI Elements:** Information panels detailing protein sequences, UniProt IDs, and a 3D viewer canvas to inspect the target pocket.
*   **State:** Mock data.

#### Molecules (`/molecules`)
*   **Purpose:** Manage the active ligand library.
*   **UI Elements:** Data table listing SMILES strings, molecular weights, LogP, QED, and TPSA. Includes range sliders and search bars for filtering the dataset.
*   **State:** Mock data.

#### Docking (`/docking`)
*   **Purpose:** Setup and review classical molecular docking runs (e.g., AutoDock Vina).
*   **UI Elements:** Parameter configuration sidebar (grid size, exhaustiveness), a primary "Run Docking" button, and a results table showing Binding Affinity (kcal/mol).
*   **State:** Mock data.

#### GNINA (`/docking?engine=gnina`)
*   **Purpose:** Deep-learning based structural rescoring.
*   **UI Elements:** Similar layout to standard docking but includes CNN Pose Score and CNN Affinity metrics in the results table.
*   **State:** Mock data.

#### Quantum (`/quantum`)
*   **Purpose:** QM-assisted affinity reranking.
*   **UI Elements:** Configuration for basis sets and functionals. Results table shows highly precise Delta G (kcal/mol) calculations.
*   **State:** Mock data.

#### Simulations (`/simulation`)
*   **Purpose:** Molecular dynamics (MD) trajectory analysis.
*   **UI Elements:** Time-series charts showing RMSD (Root Mean Square Deviation) over nanoseconds, and a panel for trajectory playback.
*   **State:** Mock data.

#### ADMET (`/validation?panel=admet`)
*   **Purpose:** Pharmacokinetics and toxicity risk assessment.
*   **UI Elements:** Radar charts or specialized metric cards highlighting risks like hERG blockade, Ames toxicity, and Lipinski Rule violations. Warning badges alert users to high-risk compounds.
*   **State:** Mock data.

### Visualization

#### 3D Viewer (`/visualization`)
*   **Purpose:** Interactive structural discovery.
*   **UI Elements:** A large, WebGL-accelerated 3Dmol.js canvas. A sidebar provides controls to toggle representations (sticks, spheres, surface) and adjust visual styles.
*   **State:** Uses real 3Dmol.js rendering, but loads mock/hardcoded SDF data or fetches public PubChem structures based on SMILES strings.

#### Chemical Space (`/chemical-space`)
*   **Purpose:** Spatial intelligence of molecular libraries.
*   **UI Elements:** A large Plotly.js 2D scatter plot representing UMAP or PCA embeddings of the molecule dataset. Hovering over points reveals chemical properties.
*   **State:** Mock coordinate data.

#### Similarity (`/similarity`)
*   **Purpose:** Structural distance indices and neighbor search.
*   **UI Elements:** A search input for a reference SMILES string, followed by a ranked list or grid of the most structurally similar compounds with Tanimoto similarity scores.
*   **State:** Mock data.

### AI

#### Models (`/models`)
*   **Purpose:** AI model registry and inference playground.
*   **UI Elements:** A list of available ML models (e.g., Toxicity Predictor, Pose Generator) with their version numbers, accuracy benchmarks, and an interface to test them manually.
*   **State:** Mock data.

#### Pharma LLM (`/copilot`)
*   **Purpose:** Literature and workflow assistant.
*   **UI Elements:** A chat interface resembling standard LLM applications. It includes a message history area and a text input box for user prompts.
*   **State:** Mock data; responses are hardcoded or simulated.

### Infrastructure & Organization

#### Settings Suite (`/settings?section=...`)
*   **Purpose:** Centralized platform controls.
*   **UI Elements:** A secondary left-hand navigation menu within the settings page to switch between sections.
    *   **Compute:** Charts showing CPU/GPU cluster utilization and instance types.
    *   **Storage:** Progress bars showing AWS S3 bucket usage.
    *   **API:** Tables listing active Developer API tokens with "Revoke" and "Generate New" buttons.
    *   **Integrations:** Toggle switches for connecting third-party tools (e.g., Benchling, AWS).
    *   **Team:** A list of organization members, their roles (Admin, Scientist), and an "Invite User" button.
    *   **Billing:** Current subscription tier, monthly cost estimates, and invoice history tables.
    *   **Audit Logs:** A read-only, timestamped ledger of user actions (Part 11 compliance).
*   **State:** All settings panels currently display mock enterprise data.

## 4. Reusable Components

*   **AppShell / Layout:** The foundational wrapper (found in `src/app/(dashboard)/layout.tsx`) that provides the sidebar, topbar, background styling (`aurora-bg`), and responsive scrolling behavior.
*   **PageHeader:** A standardized title block used at the top of main content areas, often including a title string and a slot for `children` (usually ActionButtons).
*   **MetricCard:** A small, rectangular panel displaying a title, a large numeric value, an icon, and optionally a trend indicator (e.g., "+5%").
*   **StatusBadge:** A small colored pill component. Props usually include the `status` string which determines the color (e.g., "completed" -> green, "running" -> blue).
*   **DataTable / ExperimentTable:** High-density grids utilizing `@tanstack/react-table` for sorting, filtering, and pagination of complex datasets.
*   **CommandPalette:** A modal overlay triggered by `Cmd/Ctrl+K` containing a search input and a list of navigable actions.
*   **EmptyState:** A placeholder component showing an icon, a message, and a call-to-action button, used when a table or list has no data.
*   **ApiErrorState / ErrorState:** A fallback UI showing an error message and a "Retry" button, used when a data fetch fails.
*   **DashboardPageSkeleton:** Animated placeholder blocks that render while heavy client-side components (like charts) are loading, preventing layout shift.

## 5. UI State System

*   **Loading States:** Extensive use of Skeleton components (pulsing gray blocks) and inline spinners within buttons to indicate background processing. Heavy visualizers use React `Suspense` or Next.js `dynamic` loaders.
*   **Empty States:** Displayed when a user has no projects, no molecules in a library, or a search returns zero results. They guide the user on what to do next (e.g., "Upload your first dataset").
*   **Error States:** If a component fails to render or an API call fails (simulated), an inline error panel with a retry mechanism is shown rather than crashing the whole page.
*   **Offline / Demo Mode:** The platform is configured to run in "Demo Mode" by default. The `isDemoMode()` flag in `api.ts` ensures that the UI gracefully serves static mock data instead of attempting to connect to offline backend servers, preventing default error screens.

## 6. Notes for Future Backend Integration

The current UI is highly polished but relies on local state and mock services (`src/services/api.ts` and `mockApi.ts`). 
To productionize the application, the following areas require real API integration:
*   **Authentication API:** Wire the login/signup forms to an identity provider (e.g., Auth0, AWS Cognito) to issue real JWTs.
*   **Project & File Upload APIs:** Connect the drag-and-drop zones to an S3 bucket or blob storage service to persist PDB/SDF files.
*   **Experiment Orchestration API:** The "Run Docking" or "Run Pipeline" buttons currently trigger a mock timeout and a success toast. These must be wired to a backend job queue (e.g., Celery, AWS Batch).
*   **Scientific Engines:** The data populating the Docking, GNINA, Quantum, and ADMET tables must be replaced with the actual output of the respective backend computational pipelines.
*   **Reports API:** Download buttons should trigger backend PDF generation or data aggregation endpoints.
*   **Notifications API:** WebSockets or Server-Sent Events (SSE) should be implemented to push real-time pipeline status updates to the bell icon.
