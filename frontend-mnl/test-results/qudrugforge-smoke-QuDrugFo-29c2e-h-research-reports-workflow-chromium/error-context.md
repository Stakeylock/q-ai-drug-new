# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qudrugforge-smoke.spec.ts >> QuDrugForge E2E End-to-End Smoke Suite >> Execute full happy path research reports workflow
- Location: tests\e2e\qudrugforge-smoke.spec.ts:6:7

# Error details

```
TimeoutError: page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - region "Notifications alt+T"
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - img "Quinfosys QuDrugForge" [ref=e7]
          - paragraph [ref=e8]: Quantum AI Drug Discovery
          - generic [ref=e11]:
            - paragraph [ref=e12]: Smoke Workspace 6yopca
            - paragraph [ref=e13]: owner Division
        - navigation [ref=e15]:
          - generic [ref=e16]:
            - generic [ref=e17]:
              - generic [ref=e18]: Main
              - generic [ref=e19]:
                - link "Dashboard" [ref=e20] [cursor=pointer]:
                  - /url: /dashboard
                  - img [ref=e21]
                  - generic [ref=e24]: Dashboard
                - link "Investor Hub" [ref=e25] [cursor=pointer]:
                  - /url: /investor
                  - img [ref=e26]
                  - generic [ref=e30]: Investor Hub
                - link "Research Projects" [ref=e31] [cursor=pointer]:
                  - /url: /research-projects
                  - img [ref=e32]
                  - generic [ref=e34]: Research Projects
                - link "Experiments" [ref=e35] [cursor=pointer]:
                  - /url: /dashboard/history
                  - img [ref=e36]
                  - generic [ref=e38]: Experiments
                - link "Reports" [ref=e39] [cursor=pointer]:
                  - /url: /results
                  - img [ref=e41]
                  - generic [ref=e44]: Reports
            - generic [ref=e45]:
              - generic [ref=e46]: Research
              - generic [ref=e47]:
                - link "Targets" [ref=e48] [cursor=pointer]:
                  - /url: /targets
                  - img [ref=e49]
                  - generic [ref=e53]: Targets
                - link "Molecules" [ref=e54] [cursor=pointer]:
                  - /url: /molecules
                  - img [ref=e55]
                  - generic [ref=e60]: Molecules
                - link "Docking" [ref=e61] [cursor=pointer]:
                  - /url: /docking
                  - img [ref=e62]
                  - generic [ref=e68]: Docking
                - link "GNINA" [ref=e69] [cursor=pointer]:
                  - /url: /docking?engine=gnina
                  - img [ref=e70]
                  - generic [ref=e73]: GNINA
                - link "Quantum" [ref=e74] [cursor=pointer]:
                  - /url: /quantum
                  - img [ref=e75]
                  - generic [ref=e79]: Quantum
                - link "Simulations" [ref=e80] [cursor=pointer]:
                  - /url: /simulation
                  - img [ref=e81]
                  - generic [ref=e83]: Simulations
                - link "ADMET" [ref=e84] [cursor=pointer]:
                  - /url: /validation?panel=admet
                  - img [ref=e85]
                  - generic [ref=e88]: ADMET
            - generic [ref=e89]:
              - generic [ref=e90]: Visualization
              - generic [ref=e91]:
                - link "3D Viewer" [ref=e92] [cursor=pointer]:
                  - /url: /visualization
                  - img [ref=e93]
                  - generic [ref=e96]: 3D Viewer
                - link "Chemical Space" [ref=e97] [cursor=pointer]:
                  - /url: /chemical-space
                  - img [ref=e98]
                  - generic [ref=e102]: Chemical Space
                - link "Similarity" [ref=e103] [cursor=pointer]:
                  - /url: /similarity
                  - img [ref=e104]
                  - generic [ref=e107]: Similarity
            - generic [ref=e108]:
              - generic [ref=e109]: AI
              - generic [ref=e110]:
                - link "Models" [ref=e111] [cursor=pointer]:
                  - /url: /models
                  - img [ref=e112]
                  - generic [ref=e117]: Models
                - link "Pharma LLM" [ref=e118] [cursor=pointer]:
                  - /url: /copilot
                  - img [ref=e119]
                  - generic [ref=e123]: Pharma LLM
            - generic [ref=e124]:
              - generic [ref=e125]: Infrastructure
              - generic [ref=e126]:
                - link "Compute" [ref=e127] [cursor=pointer]:
                  - /url: /settings?section=compute
                  - img [ref=e128]
                  - generic [ref=e131]: Compute
                - link "Storage" [ref=e132] [cursor=pointer]:
                  - /url: /settings?section=storage
                  - img [ref=e133]
                  - generic [ref=e137]: Storage
                - link "API" [ref=e138] [cursor=pointer]:
                  - /url: /settings?section=api
                  - img [ref=e139]
                  - generic [ref=e142]: API
                - link "Integrations" [ref=e143] [cursor=pointer]:
                  - /url: /settings?section=integrations
                  - img [ref=e144]
                  - generic [ref=e146]: Integrations
            - generic [ref=e147]:
              - generic [ref=e148]: Organization
              - generic [ref=e149]:
                - link "Team" [ref=e150] [cursor=pointer]:
                  - /url: /settings?section=team
                  - img [ref=e151]
                  - generic [ref=e156]: Team
                - link "Billing" [ref=e157] [cursor=pointer]:
                  - /url: /settings?section=billing
                  - img [ref=e158]
                  - generic [ref=e160]: Billing
                - link "Audit Logs" [ref=e161] [cursor=pointer]:
                  - /url: /settings?section=audit
                  - img [ref=e162]
                  - generic [ref=e165]: Audit Logs
                - link "Settings" [ref=e166] [cursor=pointer]:
                  - /url: /settings
                  - img [ref=e167]
                  - generic [ref=e170]: Settings
        - button "Collapse sidebar" [ref=e172] [cursor=pointer]:
          - img [ref=e173]
          - generic [ref=e175]: Collapse
    - generic [ref=e176]:
      - banner [ref=e177]:
        - generic [ref=e178]:
          - generic [ref=e179]:
            - generic [ref=e180]:
              - generic [ref=e181]: Reports
              - img [ref=e182]
              - generic [ref=e184]: Candidate evidence packages
            - heading "Reports" [level=1] [ref=e185]
          - generic [ref=e186]:
            - img [ref=e187]
            - searchbox [ref=e190]
          - generic [ref=e191]:
            - generic [ref=e192]: EGFR NSCLC active
            - button "Notifications" [ref=e193] [cursor=pointer]:
              - img [ref=e194]
            - generic [ref=e199]: System Online
            - button "Switch to dark mode" [ref=e200] [cursor=pointer]:
              - generic [ref=e201]:
                - img [ref=e202]
                - img [ref=e205]
            - group [ref=e207]:
              - generic "User profile" [ref=e208] [cursor=pointer]:
                - generic [ref=e209]: ST
                - generic [ref=e210]: Smoke Test Researcher
                - img [ref=e211]
      - main [ref=e213]:
        - generic [ref=e214]:
          - generic [ref=e216]:
            - generic [ref=e217]:
              - generic [ref=e218]: Research / Results
              - heading "Reports / Candidate Dossiers" [level=1] [ref=e220]
              - paragraph [ref=e221]: Real backend report registry and generated artifacts.
            - generic [ref=e223]:
              - generic [ref=e224]: REAL BACKEND REPORTS
              - button "Generate Project Summary Now" [ref=e225] [cursor=pointer]
              - button "Import q-ai-drug Report Artifact" [ref=e226] [cursor=pointer]
          - generic [ref=e228]:
            - generic [ref=e229]:
              - paragraph [ref=e230]: Total reports
              - paragraph [ref=e231]: "0"
              - paragraph [ref=e232]: All report records
            - generic [ref=e233]:
              - paragraph [ref=e234]: Completed
              - paragraph [ref=e235]: "0"
              - paragraph [ref=e236]: Finished exports
            - generic [ref=e237]:
              - paragraph [ref=e238]: Drafts
              - paragraph [ref=e239]: "0"
              - paragraph [ref=e240]: Needs generation
            - generic [ref=e241]:
              - paragraph [ref=e242]: Imported
              - paragraph [ref=e243]: "0"
              - paragraph [ref=e244]: q-ai-drug artifacts
            - generic [ref=e245]:
              - paragraph [ref=e246]: Failed
              - paragraph [ref=e247]: "0"
              - paragraph [ref=e248]: Generation errors
            - generic [ref=e249]:
              - paragraph [ref=e250]: Sections available
              - paragraph [ref=e251]: "0"
              - paragraph [ref=e252]: Backend data present
          - generic [ref=e253]:
            - generic [ref=e254]:
              - generic [ref=e255]:
                - generic [ref=e256]:
                  - generic [ref=e257]:
                    - paragraph [ref=e258]: Create reports
                    - heading "Drafts and generation controls" [level=2] [ref=e259]
                    - paragraph [ref=e260]: Draft project summaries or candidate dossiers from the active project, then generate the full artifact set when ready.
                  - generic [ref=e261]: Backend status is authoritative
                - generic [ref=e262]:
                  - generic [ref=e263]:
                    - text: Project summary draft title
                    - textbox "Project summary draft title" [ref=e264]: Project Summary Draft
                  - generic [ref=e265]:
                    - text: Candidate dossier title
                    - textbox "Candidate dossier title" [ref=e266]: Candidate Dossier Draft
                  - generic [ref=e267]:
                    - text: Optional candidate molecule IDs, comma separated
                    - textbox "Optional candidate molecule IDs, comma separated" [ref=e268]:
                      - /placeholder: mol_001, mol_002, mol_003
                - generic [ref=e269]:
                  - button "Create Project Summary Draft" [ref=e270] [cursor=pointer]
                  - button "Create Candidate Dossier Draft" [ref=e271] [cursor=pointer]
                  - button "Generate Project Summary Now" [ref=e272] [cursor=pointer]
                  - button "Generate Candidate Dossier Now" [ref=e273] [cursor=pointer]
                - generic [ref=e274]:
                  - generic [ref=e275]:
                    - text: Import title
                    - textbox "Import title" [ref=e276]: Imported q-ai-drug Report
                  - generic [ref=e277]:
                    - text: Source output directory
                    - textbox "Source output directory" [ref=e278]:
                      - /placeholder: C:\\runs\\q-ai-drug\\export
                  - generic [ref=e279]:
                    - text: File IDs, comma separated
                    - textbox "File IDs, comma separated" [ref=e280]:
                      - /placeholder: file_123, file_456
                - generic [ref=e281]:
                  - button "Import q-ai-drug Report Artifact" [ref=e282] [cursor=pointer]
                  - button "Refresh from backend" [ref=e283] [cursor=pointer]
              - generic [ref=e284]:
                - generic [ref=e285]:
                  - generic [ref=e286]:
                    - paragraph [ref=e287]: Summary
                    - heading "Backend availability and report totals" [level=2] [ref=e288]
                  - textbox "Search reports..." [ref=e289]
                - generic [ref=e290]:
                  - generic [ref=e292]:
                    - generic [ref=e293]:
                      - paragraph [ref=e294]: Molecules
                      - paragraph [ref=e295]: No backend data yet
                    - generic [ref=e296]: missing
                  - generic [ref=e298]:
                    - generic [ref=e299]:
                      - paragraph [ref=e300]: Docking
                      - paragraph [ref=e301]: No backend data yet
                    - generic [ref=e302]: missing
                  - generic [ref=e304]:
                    - generic [ref=e305]:
                      - paragraph [ref=e306]: GNINA
                      - paragraph [ref=e307]: No backend data yet
                    - generic [ref=e308]: missing
                  - generic [ref=e310]:
                    - generic [ref=e311]:
                      - paragraph [ref=e312]: Quantum
                      - paragraph [ref=e313]: No backend data yet
                    - generic [ref=e314]: missing
                  - generic [ref=e316]:
                    - generic [ref=e317]:
                      - paragraph [ref=e318]: Admet
                      - paragraph [ref=e319]: No backend data yet
                    - generic [ref=e320]: missing
                  - generic [ref=e322]:
                    - generic [ref=e323]:
                      - paragraph [ref=e324]: Simulations
                      - paragraph [ref=e325]: No backend data yet
                    - generic [ref=e326]: missing
                - generic [ref=e327]:
                  - generic [ref=e328]:
                    - img [ref=e330]
                    - generic [ref=e332]:
                      - heading "Failed to Retrieve Reports" [level=3] [ref=e333]
                      - paragraph [ref=e334]: We were unable to load the scientific reports or dossiers from the backend platform authority.
                  - generic [ref=e336]:
                    - button "Retry Connection" [ref=e338] [cursor=pointer]
                    - button "Show Technical Details" [ref=e339] [cursor=pointer]
                - generic [ref=e340]:
                  - paragraph [ref=e341]: No reports generated yet.
                  - paragraph [ref=e342]: Create a draft or generate a project summary to populate the reports registry.
            - complementary [ref=e343]:
              - generic [ref=e344]:
                - generic [ref=e346]:
                  - paragraph [ref=e347]: Selected report
                  - heading "No report selected" [level=2] [ref=e348]
                - generic [ref=e349]: Pick a report from the registry to view its sections, status, and files.
              - generic [ref=e350]:
                - paragraph [ref=e351]: Import status
                - generic [ref=e352]:
                  - generic [ref=e353]:
                    - paragraph [ref=e354]: Imported q-ai-drug artifacts stay marked as imported.
                    - paragraph [ref=e355]: They are not labeled as QuDrugForge-generated reports and only expose backend file links when available.
                  - generic [ref=e356]:
                    - paragraph [ref=e357]: Downloads use backend file metadata.
                    - paragraph [ref=e358]: Links resolve to the report file download URLs returned by the API, never to local filesystem paths.
              - generic [ref=e359]:
                - paragraph [ref=e360]: Data source
                - generic [ref=e361]:
                  - generic [ref=e362]:
                    - paragraph [ref=e363]: REAL BACKEND REPORTS
                    - paragraph [ref=e364]: "Fetched from the running backend at /api/v1/projects/{project_id}/reports."
                  - generic [ref=e365]: live
  - alert [ref=e366]
```

# Test source

```ts
  14  |     
  15  |     // 1. API registration first to guarantee clean user
  16  |     const registerResponse = await request.post(`${BACKEND_BASE_URL}/api/v1/auth/register`, {
  17  |       data: {
  18  |         email,
  19  |         password,
  20  |         full_name: 'Smoke Test Researcher',
  21  |         workspace_name: workspaceName,
  22  |       },
  23  |     });
  24  |     expect(registerResponse.status()).toBe(200);
  25  |     const registerJson = await registerResponse.json();
  26  |     const token = registerJson.data.access_token;
  27  |     expect(token).toBeTruthy();
  28  | 
  29  |     const authHeaders = {
  30  |       Authorization: `Bearer ${token}`,
  31  |     };
  32  | 
  33  |     // Get workspace
  34  |     const workspacesResponse = await request.get(`${BACKEND_BASE_URL}/api/v1/workspaces`, {
  35  |       headers: authHeaders,
  36  |     });
  37  |     expect(workspacesResponse.status()).toBe(200);
  38  |     const workspacesJson = await workspacesResponse.json();
  39  |     const workspace = workspacesJson.data.find((w: any) => w.name === workspaceName) ?? workspacesJson.data[0];
  40  |     const selectedWorkspaceId = workspace.id;
  41  | 
  42  |     if (E2E_MODE === 'real') {
  43  |       // Create Project
  44  |       const projectResponse = await request.post(`${BACKEND_BASE_URL}/api/v1/projects`, {
  45  |         headers: authHeaders,
  46  |         data: {
  47  |           workspace_id: selectedWorkspaceId,
  48  |           name: projectName,
  49  |           description: 'E2E smoke test research program.',
  50  |           disease_type: 'Oncology Indication',
  51  |           cancer_type: 'SmokeTarget',
  52  |         },
  53  |       });
  54  |       expect(projectResponse.status()).toBe(200);
  55  |       const projectJson = await projectResponse.json();
  56  |       expect(projectJson.data.id).toBeTruthy();
  57  |     }
  58  | 
  59  |     // 2. Perform UI login using the registered user's credentials
  60  |     console.log('Performing UI Login...');
  61  |     await loginUser(page, email, password);
  62  | 
  63  |     // 3. Select workspace via UI
  64  |     console.log('Selecting workspace...');
  65  |     if (E2E_MODE === 'real') {
  66  |       // Find the specific workspace card and click its "Enter Workspace" button
  67  |       const enterBtn = page.getByRole('button', { name: 'Enter Workspace' }).first();
  68  |       await expect(enterBtn).toBeVisible();
  69  |       await enterBtn.click();
  70  |       await page.waitForURL('**/dashboard', { timeout: 15000 });
  71  |     } else {
  72  |       await enterWorkspace(page);
  73  |     }
  74  | 
  75  |     // 4. Visit research projects directory via UI
  76  |     console.log('Navigating to Research Projects directory...');
  77  |     await page.goto('/research-projects');
  78  |     await page.waitForLoadState('domcontentloaded');
  79  |     
  80  |     // Wait for hydration by checking the provenance badge
  81  |     const provenanceBadge = page.getByTestId('data-source-badge');
  82  |     await expect(provenanceBadge).toBeVisible();
  83  |     await page.waitForTimeout(1000); // Small buffer for hydration events
  84  | 
  85  |     // 5. Select project via UI
  86  |     console.log('Selecting project card...');
  87  |     const projectCardText = E2E_MODE === 'real' ? projectName : 'EGFR NSCLC Discovery Program';
  88  |     const projectCard = page.locator('main').locator(`text="${projectCardText}"`).first();
  89  |     await expect(projectCard).toBeVisible();
  90  |     await projectCard.click();
  91  | 
  92  |     // Wait for project detail page to load
  93  |     await page.waitForURL('**/research-projects/**');
  94  |     console.log('Project detail page loaded.');
  95  |     await page.waitForTimeout(1000); // Allow workspace effect to complete completely
  96  | 
  97  |     // 6. Visit reports/results page
  98  |     console.log('Navigating to Results page via sidebar click...');
  99  |     await page.locator('a[href="/results"]').first().click();
  100 |     await page.waitForURL('**/results');
  101 |     await page.waitForLoadState('domcontentloaded');
  102 | 
  103 |     // Confirm reports page & data source badge
  104 |     await expect(page.getByTestId('reports-page')).toBeVisible();
  105 |     
  106 |     if (E2E_MODE === 'real') {
  107 |       await expect(page.getByText(/real backend reports/i).first()).toBeVisible();
  108 |     } else {
  109 |       await expect(page.getByText(/mock demo reports/i).first()).toBeVisible();
  110 |     }
  111 | 
  112 |     // 7. Create Project Summary Draft
  113 |     console.log('Creating project summary draft...');
> 114 |     const createDraftResponsePromise = page.waitForResponse((response) =>
      |                                             ^ TimeoutError: page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"
  115 |       response.url().includes('/reports') &&
  116 |       response.request().method() === 'POST' &&
  117 |       response.status() === 200
  118 |     );
  119 |     await page.getByRole('button', { name: 'Create Project Summary Draft' }).click();
  120 |     await createDraftResponsePromise;
  121 | 
  122 |     // Wait for the report draft to be added/rendered
  123 |     await expect(page.getByTestId('reports-table')).toBeVisible();
  124 | 
  125 |     // Confirm the download or status row exists
  126 |     const rowCount = await page.locator('tbody tr').count();
  127 |     expect(rowCount).toBeGreaterThanOrEqual(1);
  128 | 
  129 |     // Confirm download button or fallback exists on the first row
  130 |     const firstRow = page.locator('tbody tr').first();
  131 |     const downloadBtn = firstRow.getByTestId('report-download-button');
  132 |     const noFileBadge = firstRow.getByText('No file yet');
  133 |     
  134 |     const hasDownload = await downloadBtn.count() > 0;
  135 |     const hasNoFile = await noFileBadge.count() > 0;
  136 |     expect(hasDownload || hasNoFile).toBe(true);
  137 |     
  138 |     console.log('✓ Smoke test happy path completed successfully.');
  139 |   });
  140 | });
  141 | 
```