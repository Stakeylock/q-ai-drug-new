# 🧬 QuDrugForge: Q-AI Cancer Drug Discovery Platform

Quantum-augmented AI research pipeline and SaaS platform for oncology hit discovery targeting mechanisms such as **EGFR**, **PARP1**, and **PIK3CA**.

QuDrugForge transforms cutting-edge Jupyter notebook-based hit discovery pipelines into a production-ready, highly reproducible, CMake-orchestrated, and containerized research system. It is specifically designed to produce rigorous, reproducible computational candidate hypotheses with strict separation of evidence, bridging the gap between raw chemoinformatics and an enterprise SaaS presentation.

---

## 🚀 Key Capabilities & Science

- **AI/ML Candidate Pre-screening**: Deep learning models for robust early-stage activity profiling and ADMET safety thresholds.
- **Quantum-Assisted Logic**: Integrates real Qiskit statevector quantum-kernel portfolio prefiltering and xTB (GFN2) Single-Point QM feature generation.
- **High-Fidelity Docking**: Supports local pipelines utilizing Vina, Smina, and GNINA (equipped with CUDA/cuDNN CNN rescoring capabilities).
- **Automated MedChem Reports**: Strict evidence handling without therapeutic overclaims. Generates comprehensive dossiers including interaction fingerprints, RDKit closest-alignment RMSDs, logic ablation matrices, and automated literature proof extractions.
- **Project-Centric SaaS Frontend**: A high-fidelity Next.js App Router workspace featuring real-time polling, status step trackers, WebGL 3D molecular structures, and deep backend orchestration control.

---

## 🏗 System Architecture

The platform architecture is built for both local scientific exploration and massively concurrent SaaS deployment.

```text
                  ┌─────────────────────────────────┐
                  │          USER BROWSER           │
                  └────────────────┬────────────────┘
                                   │ HTTPS / WSS
                                   ▼
                  ┌─────────────────────────────────┐
                  │    NginX / Traefik Reverse Proxy│
                  └────────┬───────────────┬────────┘
                           │ Port 3001     │ Port 8000/8001
                           ▼               ▼
           ┌──────────────────────┐ ┌──────────────────────┐
           │     FRONTEND-MNL     │ │     BACKEND-MNL      │
           │     (Next.js 14)     │ │   (FastAPI Gateway)  │
           └──────────────────────┘ └──────────┬───────────┘
                           ┌───────────────────┼───────────────────┐
                           ▼                   ▼                   ▼
                     ┌───────────┐       ┌───────────┐       ┌───────────┐
                     │ PostgreSQL│       │  MongoDB  │       │   Redis   │
                     └───────────┘       └───────────┘       └─────┬─────┘
                                           ┌───────────────────────┴───────────────┐
                                           ▼                                       ▼
                               ┌──────────────────────┐                ┌──────────────────────┐
                               │     WORKER BASE      │                │   SCIENTIFIC WORKERS │
                               │  (Data/Gen/Reports)  │                │ (Docking/QM/MD/QML)  │
                               └──────────────────────┘                └──────────────────────┘
```

---

## 📁 Repository Structure

- **`backend-mnl/`** & **`src/` (`q_ai_drug`)**: Core FastAPI gateway and the Python package containing the rigorous chemo/quantum/docking pipelines (`module_runners`).
- **`frontend-mnl/`**: Next.js 14 production UI leveraging Tailwind CSS, Zustand, and `3Dmol.js`.
- **`models/`**: Serialized PyTorch deep learning models for active activity and ADMET hit generation.
- **`scripts/`**: Automation scripts to transparently install WSL layers, CUDA dependencies, and data setup algorithms.
- **`docker-compose.*.yml`**: Docker manifests representing default developer topologies and production-ready MongoDB/PostgreSQL SaaS clusters.
- **`CMakeLists.txt` & `CMakePresets.json`**: Make-style orchestration representing over 144 tests, experiment matrices, artifact compilations, and model building rules without raw scripting.

---

## ✅ Production Readiness & API Hardening

Recent updates have heavily focused on creating a resilient SaaS posture:
- **No Mock Fallbacks**: `NEXT_PUBLIC_DEMO_MODE=false` drops all placeholders. UI correctly visualizes strict HTTP errors and handles reconnections natively.
- **Security & Tokens**: JWT authentication with active lifespan Redis-blacklisting capabilities, plus secure length verifications at boot. Rate limiting is established.
- **Strict Evidence Reporting**: Docking runners strictly tag whether real `gnina`/`xtb` results were utilized or if `rdkit`/`EHT` fallbacks occurred. Pipeline rankings actively penalize fallback methods and explicitly separate proof into `evidence_status_report.csv` files.
- **Fully Verified**: Backend contains 124/124 passing unit integration tests, and the UI has integrated Playwright e2e suites.

---

## 🔧 Prerequisites

To effectively run the computational layers locally:
1. **Windows Subsystem for Linux (WSL2)**: Essential on Windows for native binaries like GNINA, Smina, xTB.
2. **Docker Compose**: Required if running the full isolated SaaS suite.
3. **Python 3.10+ & Conda**: For native local Python module execution.
4. **CMake**: Used to orchestrate local complex multi-step pipelines.

---

## ⚡ Quick Start: Deployment & Workflows

### Method A: Docker Compose (SaaS Deployment)
Deploy the full stack including Next.js, FastAPI, Database providers, and RQ job Workers. This offers the seamless QuDrugForge experience out-of-the-box.
```powershell
# Start the production-ready stack
docker compose -f docker-compose.mnl.prod.yml up --build -d
```
- **Frontend Workspace**: [http://localhost:3001](http://localhost:3001)
- **Backend API**: [http://localhost:8001/docs](http://localhost:8001/docs)

### Method B: CMake Scientific CLI (Research Mode)
Compile artifacts locally as an analyst exploring models and outputs straight to the file system using native environments:

1. **Bootstrap Native Environment (Installs binaries to WSL):**
   ```powershell
   cmake --workflow --preset research-bootstrap
   ```

2. **Generate AI Models from Cached Datasets:**
   ```powershell
   cmake --workflow --preset train-models
   ```

3. **Run GNINA Pipeline on Top Candidates:**
   ```powershell
   cmake --workflow --preset run-gnina
   ```
   *(Note: To adjust depth, use `-DQAI_GNINA_DEPTH_MODE=investor -DQAI_GNINA_TOP_PER_TARGET=3` during cmake config).*

4. **Build the Strict Scientific Study Output Artifacts:**
   Generates detailed medchem risk tables, redocking comparisons, QM ablations, and dossiers into `outputs/cancer_proof_v1`:
   ```powershell
   python -m q_ai_drug.research.scientific_study --project outputs/cancer_proof_v1 --config configs/cancer_targets.yaml
   ```

### Testing
To run the automated suite guaranteeing backend API constraints and science tooling integrity:
```powershell
pytest tests/ -v
npm run test:e2e --prefix frontend-mnl
```
