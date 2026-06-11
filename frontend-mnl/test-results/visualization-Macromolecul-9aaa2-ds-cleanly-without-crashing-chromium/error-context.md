# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visualization.spec.ts >> Macromolecular & Data Visualization >> 3D Macromolecule Viewer loads cleanly without crashing
- Location: tests\e2e\visualization.spec.ts:11:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   "[Console Error] Failed to load user session context: ApiError: Network request failed
+     at request (webpack-internal:///(app-pages-browser)/./src/services/api.ts:249:15)
+     at async fetchUserAndWorkspaces (webpack-internal:///(app-pages-browser)/./src/app/(dashboard)/layout.tsx:1467:29)",
+   "[Console Error] Failed to load user session context: ApiError: Network request failed
+     at request (webpack-internal:///(app-pages-browser)/./src/services/api.ts:249:15)
+     at async fetchUserAndWorkspaces (webpack-internal:///(app-pages-browser)/./src/app/(dashboard)/layout.tsx:1467:29)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e5]: Simulated Mode Enabled — Fully Simulated Workflow
    - generic [ref=e6]: NEXT_PUBLIC_DEMO_MODE=true
  - region "Notifications alt+T"
  - generic [ref=e9]: Demo Mode Active
  - generic [ref=e10]:
    - complementary [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - img "Quinfosys QuDrugForge" [ref=e15]
          - paragraph [ref=e16]: Quantum AI Drug Discovery
          - generic [ref=e19]:
            - paragraph [ref=e20]: Research Workspace
            - paragraph [ref=e21]: member Division
        - navigation [ref=e23]:
          - generic [ref=e24]:
            - generic [ref=e25]:
              - generic [ref=e26]: Main
              - generic [ref=e27]:
                - link "Dashboard" [ref=e28] [cursor=pointer]:
                  - /url: /dashboard
                  - img [ref=e29]
                  - generic [ref=e32]: Dashboard
                - link "Investor Hub" [ref=e33] [cursor=pointer]:
                  - /url: /investor
                  - img [ref=e34]
                  - generic [ref=e38]: Investor Hub
                - link "Research Projects" [ref=e39] [cursor=pointer]:
                  - /url: /research-projects
                  - img [ref=e40]
                  - generic [ref=e42]: Research Projects
                - link "Experiments" [ref=e43] [cursor=pointer]:
                  - /url: /dashboard/history
                  - img [ref=e44]
                  - generic [ref=e46]: Experiments
                - link "Reports" [ref=e47] [cursor=pointer]:
                  - /url: /results
                  - img [ref=e48]
                  - generic [ref=e51]: Reports
            - generic [ref=e52]:
              - generic [ref=e53]: Research
              - generic [ref=e54]:
                - link "Targets" [ref=e55] [cursor=pointer]:
                  - /url: /targets
                  - img [ref=e56]
                  - generic [ref=e60]: Targets
                - link "Molecules" [ref=e61] [cursor=pointer]:
                  - /url: /molecules
                  - img [ref=e62]
                  - generic [ref=e67]: Molecules
                - link "Docking" [ref=e68] [cursor=pointer]:
                  - /url: /docking
                  - img [ref=e69]
                  - generic [ref=e75]: Docking
                - link "GNINA" [ref=e76] [cursor=pointer]:
                  - /url: /docking?engine=gnina
                  - img [ref=e77]
                  - generic [ref=e80]: GNINA
                - link "Quantum" [ref=e81] [cursor=pointer]:
                  - /url: /quantum
                  - img [ref=e82]
                  - generic [ref=e86]: Quantum
                - link "Simulations" [ref=e87] [cursor=pointer]:
                  - /url: /simulation
                  - img [ref=e88]
                  - generic [ref=e90]: Simulations
                - link "ADMET" [ref=e91] [cursor=pointer]:
                  - /url: /validation?panel=admet
                  - img [ref=e92]
                  - generic [ref=e95]: ADMET
            - generic [ref=e96]:
              - generic [ref=e97]: Visualization
              - generic [ref=e98]:
                - link "3D Viewer" [ref=e99] [cursor=pointer]:
                  - /url: /visualization
                  - img [ref=e101]
                  - generic [ref=e104]: 3D Viewer
                - link "Chemical Space" [ref=e105] [cursor=pointer]:
                  - /url: /chemical-space
                  - img [ref=e106]
                  - generic [ref=e110]: Chemical Space
                - link "Similarity" [ref=e111] [cursor=pointer]:
                  - /url: /similarity
                  - img [ref=e112]
                  - generic [ref=e115]: Similarity
            - generic [ref=e116]:
              - generic [ref=e117]: AI
              - generic [ref=e118]:
                - link "Models" [ref=e119] [cursor=pointer]:
                  - /url: /models
                  - img [ref=e120]
                  - generic [ref=e125]: Models
                - link "Pharma LLM" [ref=e126] [cursor=pointer]:
                  - /url: /copilot
                  - img [ref=e127]
                  - generic [ref=e131]: Pharma LLM
            - generic [ref=e132]:
              - generic [ref=e133]: Infrastructure
              - generic [ref=e134]:
                - link "Compute" [ref=e135] [cursor=pointer]:
                  - /url: /settings?section=compute
                  - img [ref=e136]
                  - generic [ref=e139]: Compute
                - link "Storage" [ref=e140] [cursor=pointer]:
                  - /url: /settings?section=storage
                  - img [ref=e141]
                  - generic [ref=e145]: Storage
                - link "API" [ref=e146] [cursor=pointer]:
                  - /url: /settings?section=api
                  - img [ref=e147]
                  - generic [ref=e150]: API
                - link "Integrations" [ref=e151] [cursor=pointer]:
                  - /url: /settings?section=integrations
                  - img [ref=e152]
                  - generic [ref=e154]: Integrations
            - generic [ref=e155]:
              - generic [ref=e156]: Organization
              - generic [ref=e157]:
                - link "Team" [ref=e158] [cursor=pointer]:
                  - /url: /settings?section=team
                  - img [ref=e159]
                  - generic [ref=e164]: Team
                - link "Billing" [ref=e165] [cursor=pointer]:
                  - /url: /settings?section=billing
                  - img [ref=e166]
                  - generic [ref=e168]: Billing
                - link "Audit Logs" [ref=e169] [cursor=pointer]:
                  - /url: /settings?section=audit
                  - img [ref=e170]
                  - generic [ref=e173]: Audit Logs
                - link "Settings" [ref=e174] [cursor=pointer]:
                  - /url: /settings
                  - img [ref=e175]
                  - generic [ref=e178]: Settings
        - button "Collapse sidebar" [ref=e180] [cursor=pointer]:
          - img [ref=e181]
          - generic [ref=e183]: Collapse
    - generic [ref=e184]:
      - banner [ref=e185]:
        - generic [ref=e186]:
          - generic [ref=e187]:
            - generic [ref=e188]:
              - generic [ref=e189]: Research
              - img [ref=e190]
              - generic [ref=e192]: 3D structural discovery
            - heading "3D Viewer" [level=1] [ref=e193]
          - generic [ref=e194]:
            - img [ref=e195]
            - searchbox [ref=e198]
          - generic [ref=e199]:
            - generic [ref=e200]: EGFR NSCLC active
            - button "Notifications" [ref=e201] [cursor=pointer]:
              - img [ref=e202]
            - generic [ref=e207]: Demo Mode
            - button "Switch to dark mode" [ref=e208] [cursor=pointer]:
              - generic [ref=e209]:
                - img [ref=e210]
                - img [ref=e213]
            - group [ref=e215]:
              - generic "User profile" [ref=e216] [cursor=pointer]:
                - generic [ref=e217]: RU
                - generic [ref=e218]: Research User
                - img [ref=e219]
      - generic [ref=e221]:
        - generic [ref=e222]:
          - generic [ref=e223]:
            - generic [ref=e224]: Active Project
            - heading "EGFR NSCLC Discovery Program" [level=2] [ref=e225]
          - generic [ref=e227]:
            - generic [ref=e228]: Disease / Target
            - generic [ref=e229]: Lung Cancer / EGFR (P00533)
          - generic [ref=e231]:
            - generic [ref=e232]: Current Stage
            - generic [ref=e234]: Docking & Quantum Reranking
          - generic [ref=e238]:
            - generic [ref=e239]: Progress
            - generic [ref=e240]: 68%
        - generic [ref=e243]:
          - link "Switch Project" [ref=e244] [cursor=pointer]:
            - /url: /research-projects
          - button "Run Pipeline" [ref=e245] [cursor=pointer]
          - button "Generate Report" [ref=e246] [cursor=pointer]:
            - img [ref=e247]
      - generic [ref=e249]:
        - generic [ref=e252]: Simulated Mode Enabled — Fully Simulated Workflow
        - generic [ref=e253]: NEXT_PUBLIC_DEMO_MODE=true
      - main [ref=e254]:
        - generic [ref=e255]:
          - generic [ref=e257]:
            - generic [ref=e258]:
              - generic [ref=e259]: Oncology Research / Molecular Workbench
              - generic [ref=e260]:
                - heading "3D Visualization Lab" [level=1] [ref=e261]
                - generic [ref=e262]: MOCK DATA / DEMO MODE
              - paragraph [ref=e264]: High-fidelity 3D structural analysis of ligand-receptor docking poses, hydrogen bonding networks, and electronic density surfaces.
            - generic [ref=e266]:
              - button "Capture PNG" [ref=e268] [cursor=pointer]:
                - generic [ref=e269]: Capture PNG
              - button "Export Mesh" [ref=e271] [cursor=pointer]:
                - generic [ref=e272]: Export Mesh
              - button "Show Fullscreen" [ref=e274] [cursor=pointer]:
                - generic [ref=e275]: Show Fullscreen
          - generic [ref=e277]:
            - generic [ref=e278]: "Data Source:"
            - generic [ref=e279]: MOCK DATA
          - generic [ref=e280]:
            - generic [ref=e281]:
              - generic [ref=e282]:
                - generic [ref=e283]: Binding Affinity
                - generic [ref=e285]: active
              - generic [ref=e286]:
                - generic [ref=e287]:
                  - generic [ref=e288]: "-10.2"
                  - generic [ref=e289]: kcal/mol
                - generic [ref=e291]: Predicted energy
            - generic [ref=e292]:
              - generic [ref=e293]:
                - generic [ref=e294]: CNN Pose Score
                - generic [ref=e296]: completed
              - generic [ref=e297]:
                - generic [ref=e299]: "0.942"
                - generic [ref=e301]: Deep Learning confidence
            - generic [ref=e302]:
              - generic [ref=e303]:
                - generic [ref=e304]: Active H-Bonds
                - generic [ref=e306]: completed
              - generic [ref=e307]:
                - generic [ref=e309]: "4"
                - generic [ref=e311]: Hydrogen bonds in pocket
            - generic [ref=e312]:
              - generic [ref=e313]:
                - generic [ref=e314]: RMSD Deviation
                - generic [ref=e316]: completed
              - generic [ref=e317]:
                - generic [ref=e319]: 1.2Å
                - generic [ref=e321]: Pose displacement vs reference
          - generic [ref=e322]:
            - generic [ref=e323]:
              - generic [ref=e324]:
                - generic [ref=e327]:
                  - heading "3D Molecular Workbench" [level=2] [ref=e328]
                  - paragraph [ref=e329]: "Inspecting conformation: Pose 01"
                - generic [ref=e331]:
                  - generic [ref=e332]:
                    - generic [ref=e333]:
                      - img [ref=e335]
                      - generic [ref=e337]:
                        - heading "3D Molecular Operations" [level=3] [ref=e338]
                        - paragraph [ref=e339]: "Target: EGFR | Ligand:"
                    - generic [ref=e340]:
                      - generic [ref=e341]:
                        - generic [ref=e342]: Protein Target
                        - combobox [ref=e343]:
                          - option "EGFR" [selected]
                          - option "PARP1"
                          - option "PIK3CA"
                      - generic [ref=e344]:
                        - generic [ref=e345]: Candidate
                        - combobox [ref=e346]
                      - button [ref=e347] [cursor=pointer]:
                        - img [ref=e348]
                  - generic [ref=e350]:
                    - generic [ref=e351]:
                      - generic [ref=e354]:
                        - paragraph [ref=e355]: Interaction Legend
                        - generic [ref=e356]:
                          - generic [ref=e359]: Carbon
                          - generic [ref=e362]: Oxygen
                          - generic [ref=e365]: Nitrogen
                          - generic [ref=e368]: Sulfur
                          - generic [ref=e371]: H-Bonds
                      - paragraph [ref=e378]: Loading receptor structure...
                    - complementary [ref=e381]:
                      - generic [ref=e382]:
                        - generic [ref=e383]:
                          - paragraph [ref=e384]: Simulation Telemetry
                          - generic [ref=e385]:
                            - generic [ref=e386]:
                              - paragraph [ref=e387]: Affinity
                              - paragraph [ref=e388]: "-9.2 kcal/mol"
                            - generic [ref=e389]:
                              - paragraph [ref=e390]: H-Bonds
                              - paragraph [ref=e391]: 4 active
                            - generic [ref=e392]:
                              - paragraph [ref=e393]: Quantum
                              - paragraph [ref=e394]: 0.96 QSVM
                            - generic [ref=e395]:
                              - paragraph [ref=e396]: Toxicity
                              - paragraph [ref=e397]: Low score
                        - generic [ref=e398]:
                          - paragraph [ref=e399]: Ligand Metadata
                          - generic [ref=e400]:
                            - generic [ref=e401]:
                              - generic [ref=e402]: MW
                              - generic [ref=e403]: 421.4 g/mol
                            - generic [ref=e404]:
                              - generic [ref=e405]: LogP
                              - generic [ref=e406]: "3.82"
                            - generic [ref=e407]:
                              - generic [ref=e408]: QED
                              - generic [ref=e409]: "0.88"
                            - generic [ref=e410]:
                              - generic [ref=e411]: GNINA Conf.
                              - generic [ref=e412]: 98.4%
                        - generic [ref=e413]:
                          - paragraph [ref=e414]: Visualization Controls
                          - generic [ref=e415]:
                            - button "stick" [ref=e416] [cursor=pointer]
                            - button "sphere" [ref=e417] [cursor=pointer]
                            - button "cartoon" [ref=e418] [cursor=pointer]
                          - generic [ref=e419]:
                            - button "Zoom +" [ref=e420] [cursor=pointer]
                            - button "Zoom -" [ref=e421] [cursor=pointer]
                            - button "Rotate" [ref=e422] [cursor=pointer]
                            - button "Reset" [ref=e423] [cursor=pointer]
              - generic [ref=e424]:
                - generic [ref=e426]:
                  - heading "Conformation Pool" [level=2] [ref=e427]
                  - paragraph [ref=e428]: Priority docking and rescoring poses ready for active rendering.
                - generic [ref=e429]:
                  - generic [ref=e430] [cursor=pointer]:
                    - generic [ref=e431]:
                      - generic [ref=e432]: Pose 01
                      - generic [ref=e433]: completed
                    - generic [ref=e434]:
                      - generic [ref=e435]: "Affinity: -10.2"
                      - generic [ref=e436]: "CNN: 0.942"
                  - generic [ref=e437] [cursor=pointer]:
                    - generic [ref=e438]:
                      - generic [ref=e439]: Pose 02
                      - generic [ref=e440]: completed
                    - generic [ref=e441]:
                      - generic [ref=e442]: "Affinity: -9.8"
                      - generic [ref=e443]: "CNN: 0.885"
                  - generic [ref=e444] [cursor=pointer]:
                    - generic [ref=e445]:
                      - generic [ref=e446]: Pose 03
                      - generic [ref=e447]: completed
                    - generic [ref=e448]:
                      - generic [ref=e449]: "Affinity: -9.5"
                      - generic [ref=e450]: "CNN: 0.81"
            - generic [ref=e451]:
              - generic [ref=e452]:
                - heading "Receptor / Target Config" [level=4] [ref=e453]:
                  - img [ref=e454]
                  - text: Receptor / Target Config
                - generic [ref=e457]:
                  - generic [ref=e458]:
                    - text: Target Molecule
                    - combobox [ref=e459]:
                      - option "EGFR AlphaFold (P00533)" [selected]
                      - 'option "EGFR Crystal (PDB: 1M17)"'
                  - generic [ref=e460]:
                    - text: Ligand Candidate
                    - combobox [ref=e461]:
                      - option "QDF-EGFR-001" [selected]
                      - option "QDF-EGFR-014"
                  - generic [ref=e462]:
                    - text: Binding Pocket
                    - combobox [ref=e463]:
                      - option "ATP-binding pocket" [selected]
                      - option "Allosteric site (C-helix)"
                      - option "Extracellular domain IV"
              - generic [ref=e464]:
                - heading "View Layers" [level=4] [ref=e465]:
                  - img [ref=e466]
                  - text: View Layers
                - generic [ref=e469]:
                  - generic [ref=e470] [cursor=pointer]:
                    - generic [ref=e471]: Protein Surface
                    - checkbox "Protein Surface" [ref=e472]
                  - generic [ref=e473] [cursor=pointer]:
                    - generic [ref=e474]: Cartoon Representation
                    - checkbox "Cartoon Representation" [checked] [ref=e475]
                  - generic [ref=e476] [cursor=pointer]:
                    - generic [ref=e477]: Ligand Sticks
                    - checkbox "Ligand Sticks" [checked] [ref=e478]
                  - generic [ref=e479] [cursor=pointer]:
                    - generic [ref=e480]: Hydrogen Bonds
                    - checkbox "Hydrogen Bonds" [checked] [ref=e481]
                  - generic [ref=e482] [cursor=pointer]:
                    - generic [ref=e483]: Hydrophobic Contacts
                    - checkbox "Hydrophobic Contacts" [ref=e484]
                  - generic [ref=e485] [cursor=pointer]:
                    - generic [ref=e486]: Pi-Stacking
                    - checkbox "Pi-Stacking" [ref=e487]
                  - generic [ref=e488] [cursor=pointer]:
                    - generic [ref=e489]: Pocket Residues
                    - checkbox "Pocket Residues" [checked] [ref=e490]
                  - generic [ref=e491] [cursor=pointer]:
                    - generic [ref=e492]: Electrostatic Surface
                    - checkbox "Electrostatic Surface" [ref=e493]
              - generic [ref=e494]:
                - heading "Interaction Network" [level=4] [ref=e495]
                - generic [ref=e496]:
                  - generic [ref=e498]:
                    - generic [ref=e499]: Hydrogen Bonds
                    - generic [ref=e500]: "4"
                  - generic [ref=e504]:
                    - generic [ref=e505]: Hydrophobic Contacts
                    - generic [ref=e506]: "12"
                  - generic [ref=e510]:
                    - generic [ref=e511]: Pi-Stacking
                    - generic [ref=e512]: "2"
                  - generic [ref=e516]:
                    - generic [ref=e517]: Salt Bridges
                    - generic [ref=e518]: "1"
              - generic [ref=e521]:
                - button "Initiate MD Refinement" [ref=e522] [cursor=pointer]
                - button "Compare with Benchmark" [ref=e523] [cursor=pointer]
      - button [ref=e525] [cursor=pointer]:
        - img [ref=e527]
  - alert [ref=e532]
```

# Test source

```ts
  1  | import { Page, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * Attaches page-level listeners to track console errors and uncaught exceptions.
  5  |  * Ignores benign React developer or styling warnings.
  6  |  */
  7  | export function setupConsoleTracker(page: Page) {
  8  |   const severeErrors: string[] = [];
  9  | 
  10 |   page.on('console', (msg) => {
  11 |     if (msg.type() === 'error') {
  12 |       const text = msg.text();
  13 |       // Ignore known, benign Hydration mismatches or third-party warning notifications
  14 |       if (
  15 |         text.includes('React does not recognize') || 
  16 |         text.includes('Warning:') || 
  17 |         text.includes('ResizeObserver') ||
  18 |         text.includes('Failed to load resource') ||
  19 |         text.includes('Failed to fetch RSC payload')
  20 |       ) {
  21 |         return;
  22 |       }
  23 |       severeErrors.push(`[Console Error] ${text}`);
  24 |     }
  25 |   });
  26 | 
  27 |   page.on('pageerror', (err) => {
  28 |     const msg = err.message || '';
  29 |     const stack = err.stack || '';
  30 |     // Filter known benign errors that are not caused by application logic
  31 |     if (
  32 |       // DOM timing race conditions (e.g. addInitScript running before <head> is parsed)
  33 |       msg.includes('appendChild') ||
  34 |       // Next.js router errors from aborted navigations
  35 |       msg.includes('Route Cancelled') ||
  36 |       msg.includes('The operation was aborted') ||
  37 |       // React hydration mismatches (dev-only noise)
  38 |       msg.includes('Hydration failed') ||
  39 |       msg.includes('did not match') ||
  40 |       // Third-party widget load failures
  41 |       msg.includes('Script error') ||
  42 |       // Playwright internal navigation errors
  43 |       stack.includes('playwright') ||
  44 |       // Analytics/telemetry errors  
  45 |       msg.includes('undefined is not an object')
  46 |     ) {
  47 |       return;
  48 |     }
  49 |     severeErrors.push(`[Page Error] ${msg}\nStack: ${stack}`);
  50 |   });
  51 | 
  52 |   return {
  53 |     assertNoSevereErrors: () => {
> 54 |       expect(severeErrors).toEqual([]);
     |                            ^ Error: expect(received).toEqual(expected) // deep equality
  55 |     },
  56 |     severeErrors
  57 |   };
  58 | }
  59 | 
  60 | /**
  61 |  * Safe navigation utility to wrap target routing and verify execution state.
  62 |  */
  63 | export async function navigateToPage(page: Page, path: string) {
  64 |   await page.goto(path);
  65 |   await page.waitForLoadState('domcontentloaded');
  66 | }
  67 | 
```