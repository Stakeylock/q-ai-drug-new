# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: experiments-reports.spec.ts >> Experiments & Research Reports >> Reports/results directory loads analytic downloads list
- Location: tests\e2e\experiments-reports.spec.ts:35:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Project Summary Report')
Expected: visible
Error: strict mode violation: getByText('Project Summary Report') resolved to 2 elements:
    1) <p class="text-sm font-semibold text-text">Project Summary Report</p> aka getByTestId('reports-table').getByText('Project Summary Report')
    2) <h2 class="mt-1 text-lg font-black text-text">Project Summary Report</h2> aka getByRole('heading', { name: 'Project Summary Report' })

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for getByText('Project Summary Report')

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
            - paragraph [ref=e12]: Research Workspace
            - paragraph [ref=e13]: member Division
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
                - generic [ref=e209]: RU
                - generic [ref=e210]: Research User
                - img [ref=e211]
      - main [ref=e213]:
        - generic [ref=e214]:
          - generic [ref=e216]:
            - generic [ref=e217]:
              - generic [ref=e218]: Research / Results
              - heading "Reports / Candidate Dossiers" [level=1] [ref=e220]
              - paragraph [ref=e221]: EGFR NSCLC Discovery Program report registry and generated artifacts.
            - generic [ref=e223]:
              - generic [ref=e224]: REAL BACKEND REPORTS
              - button "Generate Project Summary Now" [ref=e225] [cursor=pointer]
              - button "Import q-ai-drug Report Artifact" [ref=e226] [cursor=pointer]
          - generic [ref=e228]:
            - generic [ref=e229]:
              - paragraph [ref=e230]: Total reports
              - paragraph [ref=e231]: "1"
              - paragraph [ref=e232]: All report records
            - generic [ref=e233]:
              - paragraph [ref=e234]: Completed
              - paragraph [ref=e235]: "1"
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
              - paragraph [ref=e251]: "6"
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
                      - paragraph [ref=e295]: Backend data available
                    - generic [ref=e296]: available
                  - generic [ref=e298]:
                    - generic [ref=e299]:
                      - paragraph [ref=e300]: Docking
                      - paragraph [ref=e301]: Backend data available
                    - generic [ref=e302]: available
                  - generic [ref=e304]:
                    - generic [ref=e305]:
                      - paragraph [ref=e306]: GNINA
                      - paragraph [ref=e307]: Backend data available
                    - generic [ref=e308]: available
                  - generic [ref=e310]:
                    - generic [ref=e311]:
                      - paragraph [ref=e312]: Quantum
                      - paragraph [ref=e313]: Backend data available
                    - generic [ref=e314]: available
                  - generic [ref=e316]:
                    - generic [ref=e317]:
                      - paragraph [ref=e318]: Admet
                      - paragraph [ref=e319]: Backend data available
                    - generic [ref=e320]: available
                  - generic [ref=e322]:
                    - generic [ref=e323]:
                      - paragraph [ref=e324]: Simulations
                      - paragraph [ref=e325]: Backend data available
                    - generic [ref=e326]: available
                - table [ref=e329]:
                  - rowgroup [ref=e330]:
                    - row "Title Type Status Source Created Completed Files Actions" [ref=e331]:
                      - columnheader "Title" [ref=e332]
                      - columnheader "Type" [ref=e333]
                      - columnheader "Status" [ref=e334]
                      - columnheader "Source" [ref=e335]
                      - columnheader "Created" [ref=e336]
                      - columnheader "Completed" [ref=e337]
                      - columnheader "Files" [ref=e338]
                      - columnheader "Actions" [ref=e339]
                  - rowgroup [ref=e340]:
                    - row "Project Summary Report report-123 Project Summary completed LIVE COMPUTE Generated by QuDrugForge May 18, 2026, 5:30 PM May 18, 2026, 6:00 PM 2 Open Download" [ref=e341]:
                      - cell "Project Summary Report report-123" [ref=e342]:
                        - generic [ref=e343]:
                          - paragraph [ref=e344]: Project Summary Report
                          - paragraph [ref=e345]: report-123
                      - cell "Project Summary" [ref=e346]
                      - cell "completed LIVE COMPUTE" [ref=e347]:
                        - generic [ref=e348]: completed
                        - generic [ref=e349]: LIVE COMPUTE
                      - cell "Generated by QuDrugForge" [ref=e350]
                      - cell "May 18, 2026, 5:30 PM" [ref=e351]
                      - cell "May 18, 2026, 6:00 PM" [ref=e352]
                      - cell "2" [ref=e353]
                      - cell "Open Download" [ref=e354]:
                        - generic [ref=e355]:
                          - button "Open" [ref=e356] [cursor=pointer]
                          - link "Download" [ref=e357] [cursor=pointer]:
                            - /url: http://127.0.0.1:8001/api/v1/files/file-pdf-123/download
            - complementary [ref=e358]:
              - generic [ref=e359]:
                - generic [ref=e360]:
                  - generic [ref=e361]:
                    - paragraph [ref=e362]: Selected report
                    - heading "Project Summary Report" [level=2] [ref=e363]
                  - generic [ref=e364]: completed
                - generic [ref=e365]:
                  - generic [ref=e366]:
                    - generic [ref=e367]:
                      - paragraph [ref=e368]: Type
                      - paragraph [ref=e369]: Project Summary
                    - generic [ref=e370]:
                      - paragraph [ref=e371]: Source
                      - paragraph [ref=e372]: Generated by QuDrugForge
                    - generic [ref=e373]:
                      - paragraph [ref=e374]: Candidate count
                      - paragraph [ref=e375]: "24"
                    - generic [ref=e376]:
                      - paragraph [ref=e377]: Target count
                      - paragraph [ref=e378]: "1"
                  - generic [ref=e379]:
                    - generic [ref=e380]:
                      - paragraph [ref=e381]: Docking
                      - paragraph [ref=e382]: Available
                    - generic [ref=e383]:
                      - paragraph [ref=e384]: GNINA
                      - paragraph [ref=e385]: Available
                    - generic [ref=e386]:
                      - paragraph [ref=e387]: Quantum
                      - paragraph [ref=e388]: Available
                    - generic [ref=e389]:
                      - paragraph [ref=e390]: ADMET
                      - paragraph [ref=e391]: Available
                    - generic [ref=e392]:
                      - paragraph [ref=e393]: Simulations
                      - paragraph [ref=e394]: Available
                  - generic [ref=e395]:
                    - generic [ref=e396]:
                      - paragraph [ref=e397]: Sections
                      - paragraph [ref=e398]: 1 reported sections
                    - generic [ref=e401]:
                      - generic [ref=e402]:
                        - paragraph [ref=e403]: Project Overview
                        - paragraph [ref=e404]: Overview ready
                      - generic [ref=e405]: available
                  - generic [ref=e406]:
                    - generic [ref=e407]:
                      - paragraph [ref=e408]: Generated files
                      - paragraph [ref=e409]: Backend file metadata
                    - generic [ref=e410]:
                      - generic [ref=e412]:
                        - generic [ref=e413]:
                          - paragraph [ref=e414]: Project_Summary.pdf
                          - paragraph [ref=e415]: pdf · 200 KB · application/pdf
                        - link "Download" [ref=e416] [cursor=pointer]:
                          - /url: http://127.0.0.1:8001/api/v1/files/file-pdf-123/download
                      - generic [ref=e418]:
                        - generic [ref=e419]:
                          - paragraph [ref=e420]: Project_Summary.html
                          - paragraph [ref=e421]: html · 100 KB · text/html
                        - link "Download" [ref=e422] [cursor=pointer]:
                          - /url: http://127.0.0.1:8001/api/v1/files/file-html-123/download
                  - button "Refresh" [ref=e424] [cursor=pointer]
              - generic [ref=e425]:
                - paragraph [ref=e426]: Import status
                - generic [ref=e427]:
                  - generic [ref=e428]:
                    - paragraph [ref=e429]: Imported q-ai-drug artifacts stay marked as imported.
                    - paragraph [ref=e430]: They are not labeled as QuDrugForge-generated reports and only expose backend file links when available.
                  - generic [ref=e431]:
                    - paragraph [ref=e432]: Downloads use backend file metadata.
                    - paragraph [ref=e433]: Links resolve to the report file download URLs returned by the API, never to local filesystem paths.
              - generic [ref=e434]:
                - paragraph [ref=e435]: Data source
                - generic [ref=e436]:
                  - generic [ref=e437]:
                    - paragraph [ref=e438]: REAL BACKEND REPORTS
                    - paragraph [ref=e439]: "Fetched from the running backend at /api/v1/projects/{project_id}/reports."
                  - generic [ref=e440]: live
  - alert [ref=e441]
```

# Test source

```ts
  152 |               docking: true,
  153 |               gnina: true,
  154 |               quantum: true,
  155 |               admet: true,
  156 |               simulations: true,
  157 |             },
  158 |           },
  159 |           message: 'Summary fetched',
  160 |         }),
  161 |       });
  162 |     });
  163 | 
  164 |     await page.route('**/api/v1/projects/project-123/reports*', async (route) => {
  165 |       await route.fulfill({
  166 |         status: 200,
  167 |         contentType: 'application/json',
  168 |         body: JSON.stringify({
  169 |           success: true,
  170 |           data: {
  171 |             project_id: 'project-123',
  172 |             reports: [
  173 |               {
  174 |                 report_id: 'report-123',
  175 |                 workspace_id: 'workspace-1',
  176 |                 project_id: 'project-123',
  177 |                 title: 'Project Summary Report',
  178 |                 report_type: 'project_summary',
  179 |                 status: 'completed',
  180 |                 source: 'qudrugforge',
  181 |                 source_module: 'reports',
  182 |                 candidate_molecule_ids: [],
  183 |                 target_ids: [],
  184 |                 experiment_ids: [],
  185 |                 sections: [
  186 |                   { section_id: 'overview', title: 'Project Overview', status: 'available', summary: 'Overview ready', data_refs: { molecules: [], docking_results: [], gnina_results: [], quantum_results: [], admet_results: [], simulation_results: [] } },
  187 |                 ],
  188 |                 file_ids: ['file-pdf-123', 'file-html-123'],
  189 |                 primary_file_id: 'file-pdf-123',
  190 |                 metadata: {
  191 |                   candidate_count: 24,
  192 |                   target_count: 1,
  193 |                   has_docking: true,
  194 |                   has_gnina: true,
  195 |                   has_quantum: true,
  196 |                   has_admet: true,
  197 |                   has_simulations: true,
  198 |                   imported_source_dir: null,
  199 |                 },
  200 |                 created_by: 'user-1',
  201 |                 created_at: '2026-05-18T12:00:00.000Z',
  202 |                 updated_at: '2026-05-18T12:30:00.000Z',
  203 |                 completed_at: '2026-05-18T12:30:00.000Z',
  204 |                 error_message: null,
  205 |               },
  206 |             ],
  207 |             count: 1,
  208 |             total: 1,
  209 |             limit: 100,
  210 |             skip: 0,
  211 |           },
  212 |           message: 'Reports fetched',
  213 |         }),
  214 |       });
  215 |     });
  216 | 
  217 |     await page.route('**/api/v1/projects/project-123/reports/report-123/files', async (route) => {
  218 |       await route.fulfill({
  219 |         status: 200,
  220 |         contentType: 'application/json',
  221 |         body: JSON.stringify({
  222 |           success: true,
  223 |           data: {
  224 |             report_id: 'report-123',
  225 |             files: [
  226 |               {
  227 |                 file_id: 'file-pdf-123',
  228 |                 filename: 'Project_Summary.pdf',
  229 |                 file_type: 'pdf',
  230 |                 mime_type: 'application/pdf',
  231 |                 size_bytes: 204800,
  232 |                 download_url: '/api/v1/files/file-pdf-123/download',
  233 |               },
  234 |               {
  235 |                 file_id: 'file-html-123',
  236 |                 filename: 'Project_Summary.html',
  237 |                 file_type: 'html',
  238 |                 mime_type: 'text/html',
  239 |                 size_bytes: 102400,
  240 |                 download_url: '/api/v1/files/file-html-123/download',
  241 |               },
  242 |             ],
  243 |           },
  244 |           message: 'Files fetched',
  245 |         }),
  246 |       });
  247 |     });
  248 | 
  249 |     await page.goto('/results');
  250 |     await page.waitForLoadState('domcontentloaded');
  251 | 
> 252 |     await expect(page.getByText('Project Summary Report')).toBeVisible();
      |                                                            ^ Error: expect(locator).toBeVisible() failed
  253 |     await expect(page.getByText('Generated by QuDrugForge')).toBeVisible();
  254 |     await expect(page.getByRole('link', { name: 'Download' })).toHaveCount(2);
  255 |     await expect(page.getByText('Project_Summary.pdf')).toBeVisible();
  256 |     
  257 |     errorTracker.assertNoSevereErrors();
  258 |   });
  259 | });
  260 | 
```