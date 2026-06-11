# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visualization.spec.ts >> Macromolecular & Data Visualization >> Chemical Space UMAP embedding visualizer renders charts
- Location: tests\e2e\visualization.spec.ts:23:7

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
                  - img [ref=e100]
                  - generic [ref=e103]: 3D Viewer
                - link "Chemical Space" [ref=e104] [cursor=pointer]:
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
              - generic [ref=e192]: Spatial intelligence
            - heading "Chemical Space" [level=1] [ref=e193]
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
              - generic [ref=e259]: Research / Spatial intelligence
              - generic [ref=e260]:
                - heading "Chemical Space Topography" [level=1] [ref=e261]
                - generic [ref=e262]: MOCK DATA / DEMO MODE
              - paragraph [ref=e264]: Navigate the multidimensional landscape of molecular embeddings. Identify scaffold clusters, analyze diversity gradients, and detect novel regions relative to known pharmaceutical space.
            - generic [ref=e266]:
              - generic [ref=e267]:
                - button "Recompute Space" [disabled]:
                  - generic: Recompute Space
              - button "Export Embedding" [ref=e269] [cursor=pointer]:
                - generic [ref=e270]: Export Embedding
          - generic [ref=e272]:
            - generic [ref=e273]: "Data Source:"
            - generic [ref=e274]: MOCK DATA
          - generic [ref=e275]:
            - generic [ref=e276]:
              - generic [ref=e277]:
                - generic [ref=e278]: Embedded Molecules
                - generic [ref=e280]: completed
              - generic [ref=e281]:
                - generic [ref=e283]: "3"
                - generic [ref=e285]: Total active manifold
            - generic [ref=e286]:
              - generic [ref=e287]:
                - generic [ref=e288]: Scaffold Clusters
                - generic [ref=e290]: completed
              - generic [ref=e291]:
                - generic [ref=e293]: "42"
                - generic [ref=e295]: Unique structural types
            - generic [ref=e296]:
              - generic [ref=e297]:
                - generic [ref=e298]: Novel Region Leads
                - generic [ref=e300]: active
              - generic [ref=e301]:
                - generic [ref=e303]: "186"
                - generic [ref=e305]: Low similarity to FDA
            - generic [ref=e306]:
              - generic [ref=e307]:
                - generic [ref=e308]: Approved Neighbors
                - generic [ref=e310]: completed
              - generic [ref=e311]:
                - generic [ref=e313]: "73"
                - generic [ref=e315]: Similar to known drugs
            - generic [ref=e316]:
              - generic [ref=e317]:
                - generic [ref=e318]: Applicability Alerts
                - generic [ref=e320]: completed
              - generic [ref=e321]:
                - generic [ref=e323]: "0"
                - generic [ref=e325]: Out-of-domain detections
          - generic [ref=e326]:
            - generic [ref=e327]:
              - generic [ref=e328]:
                - generic [ref=e329]:
                  - generic [ref=e330]:
                    - paragraph [ref=e331]: UMAP Topography
                    - heading "Low-Dimensional Embedding Map" [level=3] [ref=e332]
                  - generic [ref=e334]: Scroll to zoom | Drag to pan | Click to select
                - generic [ref=e335]:
                  - button "Color by Source" [ref=e336] [cursor=pointer]
                  - button "Color by QED" [ref=e337] [cursor=pointer]
              - generic [ref=e338]:
                - generic [ref=e339]:
                  - generic [ref=e341]:
                    - heading "Scaffold Distribution" [level=2] [ref=e342]
                    - paragraph [ref=e343]: Primary structural frameworks and their average performance metrics.
                  - generic [ref=e344]:
                    - generic [ref=e345] [cursor=pointer]:
                      - generic [ref=e346]:
                        - generic [ref=e347]: N-phenylquinazolin-4-amine
                        - generic [ref=e348]:
                          - generic [ref=e349]: "Count: 124"
                          - generic [ref=e350]: "Avg: -9.4"
                      - generic [ref=e351]:
                        - generic [ref=e352]: 45%
                        - generic [ref=e353]: Novelty
                    - generic [ref=e354] [cursor=pointer]:
                      - generic [ref=e355]:
                        - generic [ref=e356]: pyrido[2,3-d]pyrimidine
                        - generic [ref=e357]:
                          - generic [ref=e358]: "Count: 86"
                          - generic [ref=e359]: "Avg: -8.9"
                      - generic [ref=e360]:
                        - generic [ref=e361]: 72%
                        - generic [ref=e362]: Novelty
                    - generic [ref=e363] [cursor=pointer]:
                      - generic [ref=e364]:
                        - generic [ref=e365]: 1H-indazol-3-amine
                        - generic [ref=e366]:
                          - generic [ref=e367]: "Count: 62"
                          - generic [ref=e368]: "Avg: -8.6"
                      - generic [ref=e369]:
                        - generic [ref=e370]: 81%
                        - generic [ref=e371]: Novelty
                    - generic [ref=e372] [cursor=pointer]:
                      - generic [ref=e373]:
                        - generic [ref=e374]: macrocyclic peptide mimic
                        - generic [ref=e375]:
                          - generic [ref=e376]: "Count: 34"
                          - generic [ref=e377]: "Avg: -8.1"
                      - generic [ref=e378]:
                        - generic [ref=e379]: 94%
                        - generic [ref=e380]: Novelty
                - generic [ref=e381]:
                  - generic [ref=e383]:
                    - heading "Property Gradients" [level=2] [ref=e384]
                    - paragraph [ref=e385]: Distribution of physicochemical properties across the embedded space.
                  - generic [ref=e386]:
                    - generic [ref=e388]:
                      - generic [ref=e389]: Molecular Weight
                      - generic [ref=e390]:
                        - text: "421.4"
                        - generic [ref=e391]: g/mol
                    - generic [ref=e400]:
                      - generic [ref=e401]: LogP (Lipophilicity)
                      - generic [ref=e402]:
                        - text: "3.82"
                        - generic [ref=e403]: o/w
                    - generic [ref=e412]:
                      - generic [ref=e413]: QED (Drug-likeness)
                      - generic [ref=e414]:
                        - text: "0.85"
                        - generic [ref=e415]: score
            - generic [ref=e423]:
              - generic [ref=e424]:
                - heading "Candidate Focus" [level=4] [ref=e425]:
                  - img [ref=e426]
                  - text: Candidate Focus
                - generic [ref=e429]:
                  - generic [ref=e430]:
                    - generic "QDF-EGFR-001" [ref=e431]
                    - generic [ref=e432]: Generated Manifold
                  - generic [ref=e433]:
                    - generic [ref=e434]:
                      - generic [ref=e435]: MW
                      - generic [ref=e436]: 421.4 g/mol
                    - generic [ref=e437]:
                      - generic [ref=e438]: LogP
                      - generic [ref=e439]: "3.82"
                    - generic [ref=e440]:
                      - generic [ref=e441]: QED score
                      - generic [ref=e442]: "0.85"
                    - generic [ref=e443]:
                      - generic [ref=e444]: Applicability Domain
                      - generic [ref=e445]: Inside (High Conf)
                  - generic [ref=e447]:
                    - generic [ref=e448]: ADMET Risk
                    - generic [ref=e449]: Low
              - generic [ref=e452]:
                - heading "Manifold Clusters" [level=4] [ref=e453]
                - generic [ref=e454]:
                  - generic [ref=e455] [cursor=pointer]:
                    - generic [ref=e458]: quinazoline-like
                    - generic [ref=e459]: "450"
                  - generic [ref=e460] [cursor=pointer]:
                    - generic [ref=e463]: pyrimidine-like
                    - generic [ref=e464]: "320"
                  - generic [ref=e465] [cursor=pointer]:
                    - generic [ref=e468]: indazole-like
                    - generic [ref=e469]: "210"
                  - generic [ref=e470] [cursor=pointer]:
                    - generic [ref=e473]: macrocycle-like
                    - generic [ref=e474]: "120"
                  - generic [ref=e475] [cursor=pointer]:
                    - generic [ref=e478]: approved-drug-like
                    - generic [ref=e479]: "73"
              - generic [ref=e480]:
                - button "Filter Novel Regions" [ref=e481] [cursor=pointer]
                - button "Compare Scaffolds" [ref=e482] [cursor=pointer]
      - button [ref=e484] [cursor=pointer]:
        - img [ref=e486]
  - alert [ref=e491]
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