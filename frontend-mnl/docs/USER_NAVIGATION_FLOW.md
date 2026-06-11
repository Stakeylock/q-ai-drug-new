# QuDrugForge User Navigation Flow

## 1. What is QuDrugForge?
QuDrugForge is a powerful, AI-assisted platform designed to help scientists and researchers discover new medicines faster. Instead of using dozens of different software tools, QuDrugForge brings everything together in one organized workspace. 

The platform is designed for computational chemists, biologists, and pharmaceutical researchers. 

A **Research Project** in QuDrugForge is like a digital folder for a specific disease or target you are working on (for example, finding a cure for a specific type of lung cancer). The workflow guides you from selecting the protein you want to target, exploring potential chemical compounds (molecules), simulating how well they bind, and finally checking if they are safe to use as a drug.

## 2. First-time User Flow
If you are logging in for the first time, your journey will look something like this:

1. **Login/Register:** Create an account and sign in.
2. **Select Workspace:** Choose your organization or team space.
3. **Open Dashboard:** Get a quick overview of system health, active pipelines, and recent experiments.
4. **Open or Create Research Project:** Go to "Research Projects" and open your active project workspace.
5. **Upload/Select Input Data:** Define the protein target and upload any molecule libraries.
6. **Review Targets:** Look at the 3D structure of the protein you want to target.
7. **Review/Generate Molecules:** Browse potential drug compounds or ask the AI to generate new ones.
8. **Run/Inspect Docking:** Run a simulation to see how the molecules fit into the protein target.
9. **Review GNINA Rescoring:** Use advanced AI to double-check and improve the docking scores.
10. **Review Quantum Reranking:** Use highly precise quantum mechanics to find the absolute best-binding molecules.
11. **Review Simulations:** Watch a video-like simulation (Molecular Dynamics) of the molecule moving inside the protein.
12. **Review ADMET Risk:** Check if the best molecules are safe (not toxic) and absorbable by the human body.
13. **Use Visualization Pages:** Look at your molecule library in 3D or map them on a "Chemical Space" chart.
14. **Ask Pharma LLM:** Chat with the built-in AI assistant to ask questions about biology or get help with the platform.
15. **Track Experiments:** View the "Experiments" page to see a history of all the simulations you've run.
16. **Generate Reports/Dossiers:** Go to "Reports" to create a final summary of your best candidates.
17. **Export Artifacts:** Download your results to share with your lab team.

## 3. Main Navigation Areas
The sidebar on the left is your main way to navigate. It is divided into logical groups:

### Main
- **Dashboard:** A quick summary of everything happening in the system. Start here to check on running tasks.
- **Research Projects:** Your main workspace. Go here to manage different drug discovery programs.
- **Experiments:** A history log of all calculations, simulations, and AI tasks you have executed.
- **Reports:** A library of generated documents and candidate summaries ready for review.

### Research
- **Targets:** Information and 3D views of the biological proteins you are trying to drug.
- **Molecules:** A library of the chemical compounds you are testing.
- **Docking:** The tool used to test how well a molecule physically fits into the target protein.
- **GNINA:** An advanced AI version of docking that provides better accuracy.
- **Quantum:** Highly precise physics calculations to rank your best compounds.
- **Simulations:** Tools to see how the protein and drug interact over time.
- **ADMET:** A dashboard that warns you if a molecule might be toxic or have bad side effects.

### Visualization
- **3D Viewer:** A dedicated page to examine molecules and proteins from every angle.
- **Chemical Space:** A map showing how similar or different your molecules are from each other.
- **Similarity:** A tool to find new molecules that look structurally similar to your best ones.

### AI
- **Models:** A technical list of the AI engines powering the platform.
- **Pharma LLM:** A chat interface where you can talk to an AI trained on pharmaceutical data.

### Infrastructure
- **Compute:** Check how many servers are currently running your heavy calculations.
- **Storage:** See how much data (files, results) you are storing.
- **API:** Tools for programmers to connect QuDrugForge to other software.
- **Integrations:** Settings to connect to cloud providers or lab notebooks.

### Organization
- **Team:** Invite colleagues and manage their permissions.
- **Billing:** View your subscription and computation costs.
- **Audit Logs:** A security trail showing exactly who did what, and when.
- **Settings:** General preferences for your account and workspace.

## 4. Research Project Workflow
Here is an example of a realistic workflow for the **EGFR NSCLC Discovery Program** (a lung cancer project):

1. Go to **Research Projects** and open the EGFR project.
2. In the setup phase, choose your disease and select the target protein (EGFR).
3. Upload the 3D structure of the protein (a PDB file).
4. Define the exact "pocket" on the protein where the drug should bind.
5. Go to the **Molecules** tab and upload a library of 10,000 potential compounds.
6. Use filters to narrow down the list to 1,000 molecules that aren't too heavy or greasy.
7. Go to **Docking** and run a simulation to test those 1,000 molecules.
8. Take the top 100 results and run **GNINA** to rescore them using AI.
9. Inspect the top 10 poses in the **3D Viewer**.
10. Send the top 5 to **Quantum** reranking for the most accurate physics check.
11. Run **ADMET** to ensure none of the top 5 have heart toxicity risks (like hERG).
12. Compare the remaining safe molecules in **Chemical Space** to ensure they are diverse.
13. Generate a final Candidate Dossier in the **Reports** tab.
14. Export the data as a CSV and PDF to hand off to the physical chemistry lab for testing.

## 5. How to Use Each Major Feature
*   **Dashboard:** Look at the top cards for a quick status update. Use the "Recent Activity" list to jump back into a recent experiment.
*   **Research Projects:** Click on a project card to open it. Use the tabs inside the project to navigate between Input Data, Targets, and Molecules.
*   **Input Data:** Use the drag-and-drop zones to upload your protein files and molecule libraries.
*   **Docking / GNINA / Quantum:** These pages have a "Run" button. Select your parameters on the left, click run, and wait for the results to populate the table.
*   **3D Viewer:** Click and drag your mouse to rotate the molecule. Scroll to zoom. Use the buttons on the right to change how the molecule looks (e.g., sticks, spheres, or surface).
*   **Chemical Space:** Hover over the dots on the scatter plot graph to see details about specific molecules.
*   **Pharma LLM:** Type a question in the chat box at the bottom, just like you would with ChatGPT, to get help analyzing your results.
*   **Settings / Organization pages:** Use the left menu within the settings page to switch between Team, Billing, and Compute preferences.

## 6. Common User Questions
*   **Where do I upload protein files?** Go to your Research Project and click the "Input Data" or "Targets" tab.
*   **Where do I upload molecules?** Go to your Research Project and click the "Molecules" tab.
*   **Where do I see docking results?** Go to the "Docking" page under the Research menu. Results will appear in the table once the experiment finishes.
*   **What is GNINA?** GNINA is an AI tool that predicts how well a drug binds to a protein better than traditional docking.
*   **What is quantum reranking?** It is a very slow but highly accurate physics calculation used only on your very best molecules to confirm they are good candidates.
*   **Where do I check toxicity?** Go to the "ADMET" page. Look for red warning badges that indicate toxicity.
*   **Where do I download reports?** Go to the "Reports" page and click the "Download" icon next to a dossier.
*   **What does Pharma LLM do?** It's a smart assistant. You can ask it to summarize a report, explain a biological target, or guide you on how to use the platform.
*   **What is the difference between Experiments and Reports?** "Experiments" is a raw log of everything the computer calculated. "Reports" are polished, finalized documents summarizing the best results.
*   **What is Compute used for?** It shows how many cloud servers you are currently renting to run heavy calculations like docking.
*   **What is Storage used for?** It shows how much hard drive space your uploaded files and generated results are taking up.
*   **What is the Models page?** It is a technical registry for data scientists to manage the AI models running behind the scenes. 

## 7. Current Prototype Notes
Please note that you are currently viewing a **Frontend Prototype**:
*   The data you see (molecules, scores, charts) is currently **mock/static data** meant to demonstrate how the platform looks and feels.
*   Buttons like "Run Pipeline" or "Generate Report" will show a success notification, but they are currently UI-only and do not trigger real cloud calculations.
*   Backend systems (databases, real AI servers) will be integrated in future phases.
*   Authentication (Login/Signup) accepts any input to let you explore the workspace.
