# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visualization.spec.ts >> Macromolecular & Data Visualization >> Molecular similarity charts and grids render successfully
- Location: tests\e2e\visualization.spec.ts:35:7

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
                  - img [ref=e105]
                  - generic [ref=e109]: Chemical Space
                - link "Similarity" [ref=e110] [cursor=pointer]:
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
              - generic [ref=e192]: Structural similarity
            - heading "Similarity" [level=1] [ref=e193]
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
              - generic [ref=e259]: Research / Structural similarity
              - generic [ref=e260]:
                - heading "Structural Similarity Matrix" [level=1] [ref=e261]
                - generic [ref=e262]: MOCK DATA / DEMO MODE
              - paragraph [ref=e264]: Quantify structural relationships and scaffold novelties across the candidate library. Compare lead molecules against known drug space and detect applicability domain risks.
            - generic [ref=e266]:
              - button "Export Report" [ref=e268] [cursor=pointer]:
                - generic [ref=e269]: Export Report
              - generic [ref=e270]:
                - button "Recalculate Matrix" [disabled]:
                  - generic: Recalculate Matrix
          - generic [ref=e272]:
            - generic [ref=e273]: "Data Source:"
            - generic [ref=e274]: MOCK DATA
          - generic [ref=e275]:
            - generic [ref=e276]:
              - generic [ref=e277]:
                - generic [ref=e278]: Compared Candidates
                - generic [ref=e280]: completed
              - generic [ref=e281]:
                - generic [ref=e283]: "6"
                - generic [ref=e285]: Active comparison set
            - generic [ref=e286]:
              - generic [ref=e287]:
                - generic [ref=e288]: Nearest Neighbors
                - generic [ref=e290]: completed
              - generic [ref=e291]:
                - generic [ref=e293]: "5"
                - generic [ref=e295]: Similar lead counts
            - generic [ref=e296]:
              - generic [ref=e297]:
                - generic [ref=e298]: Novel Scaffolds
                - generic [ref=e300]: active
              - generic [ref=e301]:
                - generic [ref=e303]: "4"
                - generic [ref=e305]: Low overlap with FDA
            - generic [ref=e306]:
              - generic [ref=e307]:
                - generic [ref=e308]: Similarity Alerts
                - generic [ref=e310]: completed
              - generic [ref=e311]:
                - generic [ref=e313]: "0"
                - generic [ref=e315]: Potential IP conflict
            - generic [ref=e316]:
              - generic [ref=e317]:
                - generic [ref=e318]: Out-of-domain
                - generic [ref=e320]: completed
              - generic [ref=e321]:
                - generic [ref=e323]: "0"
                - generic [ref=e325]: Reliability warning
          - generic [ref=e326]:
            - generic [ref=e327]:
              - generic [ref=e328]:
                - generic [ref=e329]:
                  - generic [ref=e330]:
                    - text: Fingerprint Manifold
                    - text: Active Structure
                  - generic [ref=e333]: In-Domain
                - generic [ref=e334]:
                  - generic [ref=e335]:
                    - generic [ref=e337]:
                      - heading "Similarity Search Sandbox" [level=3] [ref=e338]
                      - paragraph [ref=e339]: Query lead candidates or input custom SMILES
                    - generic [ref=e340]:
                      - textbox "Enter SMILES representation..." [ref=e341]: CN(C)C/C=C/C(=O)NC1=CC2=C(C=C1)N=CN=C2NC3=CC(=C(C=C3)F)Cl
                      - button "Search" [disabled] [ref=e342]
                  - generic [ref=e343]:
                    - generic [ref=e344]:
                      - paragraph [ref=e345]: Query Molecule ID
                      - paragraph [ref=e346]: Custom Query
                    - generic [ref=e347]:
                      - paragraph [ref=e348]: Fingerprint Format
                      - paragraph [ref=e349]: Morgan / Jaccard Fallback
              - generic [ref=e350]:
                - generic [ref=e352]:
                  - heading "Pairwise Tanimoto Matrix" [level=2] [ref=e353]
                  - paragraph [ref=e354]: Heatmap of structural Jaccard similarity metrics calculated on Morgan fingerprints.
                - generic [ref=e356]:
                  - generic [ref=e359]:
                    - generic [ref=e360]: QDF-EGFR-001
                    - generic [ref=e361]: QDF-EGFR-014
                    - generic [ref=e362]: QDF-EGFR-027
                    - generic [ref=e363]: Gefitinib
                    - generic [ref=e364]: Erlotinib
                    - generic [ref=e365]: Osimertinib
                  - generic [ref=e366]:
                    - generic [ref=e367]:
                      - generic [ref=e368]: QDF-EGFR-001
                      - generic [ref=e369]:
                        - 'generic "QDF-EGFR-001 vs QDF-EGFR-001: 1.00" [ref=e370] [cursor=pointer]': "1.00"
                        - 'generic "QDF-EGFR-001 vs QDF-EGFR-014: 0.82" [ref=e371] [cursor=pointer]': "0.82"
                        - 'generic "QDF-EGFR-001 vs QDF-EGFR-027: 0.75" [ref=e372] [cursor=pointer]': "0.75"
                        - 'generic "QDF-EGFR-001 vs Gefitinib: 0.78" [ref=e373] [cursor=pointer]': "0.78"
                        - 'generic "QDF-EGFR-001 vs Erlotinib: 0.72" [ref=e374] [cursor=pointer]': "0.72"
                        - 'generic "QDF-EGFR-001 vs Osimertinib: 0.65" [ref=e375] [cursor=pointer]': "0.65"
                    - generic [ref=e376]:
                      - generic [ref=e377]: QDF-EGFR-014
                      - generic [ref=e378]:
                        - 'generic "QDF-EGFR-014 vs QDF-EGFR-001: 0.82" [ref=e379] [cursor=pointer]': "0.82"
                        - 'generic "QDF-EGFR-014 vs QDF-EGFR-014: 1.00" [ref=e380] [cursor=pointer]': "1.00"
                        - 'generic "QDF-EGFR-014 vs QDF-EGFR-027: 0.88" [ref=e381] [cursor=pointer]': "0.88"
                        - 'generic "QDF-EGFR-014 vs Gefitinib: 0.71" [ref=e382] [cursor=pointer]': "0.71"
                        - 'generic "QDF-EGFR-014 vs Erlotinib: 0.68" [ref=e383] [cursor=pointer]': "0.68"
                        - 'generic "QDF-EGFR-014 vs Osimertinib: 0.58" [ref=e384] [cursor=pointer]': "0.58"
                    - generic [ref=e385]:
                      - generic [ref=e386]: QDF-EGFR-027
                      - generic [ref=e387]:
                        - 'generic "QDF-EGFR-027 vs QDF-EGFR-001: 0.75" [ref=e388] [cursor=pointer]': "0.75"
                        - 'generic "QDF-EGFR-027 vs QDF-EGFR-014: 0.88" [ref=e389] [cursor=pointer]': "0.88"
                        - 'generic "QDF-EGFR-027 vs QDF-EGFR-027: 1.00" [ref=e390] [cursor=pointer]': "1.00"
                        - 'generic "QDF-EGFR-027 vs Gefitinib: 0.65" [ref=e391] [cursor=pointer]': "0.65"
                        - 'generic "QDF-EGFR-027 vs Erlotinib: 0.62" [ref=e392] [cursor=pointer]': "0.62"
                        - 'generic "QDF-EGFR-027 vs Osimertinib: 0.52" [ref=e393] [cursor=pointer]': "0.52"
                    - generic [ref=e394]:
                      - generic [ref=e395]: Gefitinib
                      - generic [ref=e396]:
                        - 'generic "Gefitinib vs QDF-EGFR-001: 0.78" [ref=e397] [cursor=pointer]': "0.78"
                        - 'generic "Gefitinib vs QDF-EGFR-014: 0.71" [ref=e398] [cursor=pointer]': "0.71"
                        - 'generic "Gefitinib vs QDF-EGFR-027: 0.65" [ref=e399] [cursor=pointer]': "0.65"
                        - 'generic "Gefitinib vs Gefitinib: 1.00" [ref=e400] [cursor=pointer]': "1.00"
                        - 'generic "Gefitinib vs Erlotinib: 0.89" [ref=e401] [cursor=pointer]': "0.89"
                        - 'generic "Gefitinib vs Osimertinib: 0.61" [ref=e402] [cursor=pointer]': "0.61"
                    - generic [ref=e403]:
                      - generic [ref=e404]: Erlotinib
                      - generic [ref=e405]:
                        - 'generic "Erlotinib vs QDF-EGFR-001: 0.72" [ref=e406] [cursor=pointer]': "0.72"
                        - 'generic "Erlotinib vs QDF-EGFR-014: 0.68" [ref=e407] [cursor=pointer]': "0.68"
                        - 'generic "Erlotinib vs QDF-EGFR-027: 0.62" [ref=e408] [cursor=pointer]': "0.62"
                        - 'generic "Erlotinib vs Gefitinib: 0.89" [ref=e409] [cursor=pointer]': "0.89"
                        - 'generic "Erlotinib vs Erlotinib: 1.00" [ref=e410] [cursor=pointer]': "1.00"
                        - 'generic "Erlotinib vs Osimertinib: 0.59" [ref=e411] [cursor=pointer]': "0.59"
                    - generic [ref=e412]:
                      - generic [ref=e413]: Osimertinib
                      - generic [ref=e414]:
                        - 'generic "Osimertinib vs QDF-EGFR-001: 0.65" [ref=e415] [cursor=pointer]': "0.65"
                        - 'generic "Osimertinib vs QDF-EGFR-014: 0.58" [ref=e416] [cursor=pointer]': "0.58"
                        - 'generic "Osimertinib vs QDF-EGFR-027: 0.52" [ref=e417] [cursor=pointer]': "0.52"
                        - 'generic "Osimertinib vs Gefitinib: 0.61" [ref=e418] [cursor=pointer]': "0.61"
                        - 'generic "Osimertinib vs Erlotinib: 0.59" [ref=e419] [cursor=pointer]': "0.59"
                        - 'generic "Osimertinib vs Osimertinib: 1.00" [ref=e420] [cursor=pointer]': "1.00"
            - generic [ref=e421]:
              - generic [ref=e422]:
                - heading "Nearest Neighbors" [level=4] [ref=e423]
                - generic [ref=e424]:
                  - generic [ref=e425] [cursor=pointer]:
                    - generic [ref=e426]:
                      - generic [ref=e427]: Gefitinib
                      - generic [ref=e428]: "0.78"
                    - generic [ref=e429]:
                      - generic [ref=e430]: Quinazoline
                      - generic [ref=e431]: Approved Drug
                  - generic [ref=e432] [cursor=pointer]:
                    - generic [ref=e433]:
                      - generic [ref=e434]: Erlotinib
                      - generic [ref=e435]: "0.72"
                    - generic [ref=e436]:
                      - generic [ref=e437]: Quinazoline
                      - generic [ref=e438]: Approved Drug
                  - generic [ref=e439] [cursor=pointer]:
                    - generic [ref=e440]:
                      - generic [ref=e441]: Osimertinib
                      - generic [ref=e442]: "0.65"
                    - generic [ref=e443]:
                      - generic [ref=e444]: Pyrimidine
                      - generic [ref=e445]: Approved Drug
                  - generic [ref=e446] [cursor=pointer]:
                    - generic [ref=e447]:
                      - generic [ref=e448]: QDF-EGFR-014
                      - generic [ref=e449]: "0.82"
                    - generic [ref=e450]:
                      - generic [ref=e451]: Quinazoline
                      - generic [ref=e452]: Generated
                  - generic [ref=e453] [cursor=pointer]:
                    - generic [ref=e454]:
                      - generic [ref=e455]: QDF-EGFR-027
                      - generic [ref=e456]: "0.75"
                    - generic [ref=e457]:
                      - generic [ref=e458]: Quinazoline
                      - generic [ref=e459]: Generated
              - generic [ref=e460]:
                - button "Initiate Benchmarking" [ref=e461] [cursor=pointer]
                - button "Scaffold Clustering" [ref=e462] [cursor=pointer]
      - button [ref=e464] [cursor=pointer]:
        - img [ref=e466]
  - alert [ref=e471]
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