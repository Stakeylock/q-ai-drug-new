import { expect, test } from '@playwright/test';
import { E2E_MODE, BACKEND_BASE_URL } from './utils/test-data';
import { loginUser, enterWorkspace } from './utils/auth-helper';

test.describe('QuDrugForge E2E End-to-End Smoke Suite', () => {
  test('Execute full happy path research reports workflow', async ({ page, request }) => {
    const runId = Math.random().toString(36).slice(2, 8);
    const email = `smoke.e2e.${runId}@example.com`;
    const password = 'SmokePass123!';
    const workspaceName = `Smoke Workspace ${runId}`;
    const projectName = `Smoke Project ${runId}`;

    console.log('Setting up database state via API...');
    
    // 1. API registration first to guarantee clean user
    const registerResponse = await request.post(`${BACKEND_BASE_URL}/api/v1/auth/register`, {
      data: {
        email,
        password,
        full_name: 'Smoke Test Researcher',
        workspace_name: workspaceName,
      },
    });
    expect(registerResponse.status()).toBe(200);
    const registerJson = await registerResponse.json();
    const token = registerJson.data.access_token;
    expect(token).toBeTruthy();

    const authHeaders = {
      Authorization: `Bearer ${token}`,
    };

    // Get workspace
    const workspacesResponse = await request.get(`${BACKEND_BASE_URL}/api/v1/workspaces`, {
      headers: authHeaders,
    });
    expect(workspacesResponse.status()).toBe(200);
    const workspacesJson = await workspacesResponse.json();
    const workspace = workspacesJson.data.find((w: any) => w.name === workspaceName) ?? workspacesJson.data[0];
    const selectedWorkspaceId = workspace.id;

    if (E2E_MODE === 'real') {
      // Create Project
      const projectResponse = await request.post(`${BACKEND_BASE_URL}/api/v1/projects`, {
        headers: authHeaders,
        data: {
          workspace_id: selectedWorkspaceId,
          name: projectName,
          description: 'E2E smoke test research program.',
          disease_type: 'Oncology Indication',
          cancer_type: 'SmokeTarget',
        },
      });
      expect(projectResponse.status()).toBe(200);
      const projectJson = await projectResponse.json();
      expect(projectJson.data.id).toBeTruthy();
    }

    // 2. Perform UI login using the registered user's credentials
    console.log('Performing UI Login...');
    await loginUser(page, email, password);

    // 3. Select workspace via UI
    console.log('Selecting workspace...');
    if (E2E_MODE === 'real') {
      // Find the specific workspace card and click its "Enter Workspace" button
      const enterBtn = page.getByRole('button', { name: 'Enter Workspace' }).first();
      await expect(enterBtn).toBeVisible();
      await enterBtn.click();
      await page.waitForURL('**/dashboard', { timeout: 15000 });
    } else {
      await enterWorkspace(page);
    }

    // 4. Visit research projects directory via UI
    console.log('Navigating to Research Projects directory...');
    await page.goto('/research-projects');
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for hydration by checking the provenance badge
    const provenanceBadge = page.getByTestId('data-source-badge');
    await expect(provenanceBadge).toBeVisible();
    await page.waitForTimeout(1000); // Small buffer for hydration events

    // 5. Select project via UI
    console.log('Selecting project card...');
    const projectCardText = E2E_MODE === 'real' ? projectName : 'EGFR NSCLC Discovery Program';
    const projectCard = page.locator('main').locator(`text="${projectCardText}"`).first();
    await expect(projectCard).toBeVisible();
    await projectCard.click();

    // Wait for project detail page to load
    await page.waitForURL('**/research-projects/**');
    console.log('Project detail page loaded.');
    await page.waitForTimeout(1000); // Allow workspace effect to complete completely

    // 6. Visit reports/results page
    console.log('Navigating to Results page via sidebar click...');
    await page.locator('a[href="/results"]').first().click();
    await page.waitForURL('**/results');
    await page.waitForLoadState('domcontentloaded');

    // Confirm reports page & data source badge
    await expect(page.getByTestId('reports-page')).toBeVisible();
    
    if (E2E_MODE === 'real') {
      await expect(page.getByText(/real backend reports/i).first()).toBeVisible();
    } else {
      await expect(page.getByText(/mock demo reports/i).first()).toBeVisible();
    }

    // 7. Create Project Summary Draft
    console.log('Creating project summary draft...');
    const createDraftResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/reports') &&
      response.request().method() === 'POST' &&
      response.status() === 200
    );
    await page.getByRole('button', { name: 'Create Project Summary Draft' }).click();
    await createDraftResponsePromise;

    // Wait for the report draft to be added/rendered
    await expect(page.getByTestId('reports-table')).toBeVisible();

    // Confirm the download or status row exists
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Confirm download button or fallback exists on the first row
    const firstRow = page.locator('tbody tr').first();
    const downloadBtn = firstRow.getByTestId('report-download-button');
    const noFileBadge = firstRow.getByText('No file yet');
    
    const hasDownload = await downloadBtn.count() > 0;
    const hasNoFile = await noFileBadge.count() > 0;
    expect(hasDownload || hasNoFile).toBe(true);
    
    console.log('✓ Smoke test happy path completed successfully.');
  });
});
