import { expect, test } from '@playwright/test';
import path from 'path';

const BACKEND_URL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8001';

test.describe('Reports flow', () => {
  test('renders real backend reports and generates a project summary', async ({ page, request }) => {
    const runId = Math.random().toString(36).slice(2, 8);
    const email = `reports.e2e.${runId}@example.com`;
    const password = 'ReportsPass123!';
    const workspaceName = `Reports Workspace ${runId}`;
    const projectName = `Reports Project ${runId}`;

    const registerResponse = await request.post(`${BACKEND_URL}/api/v1/auth/register`, {
      data: {
        email,
        password,
        full_name: 'Reports E2E Researcher',
        workspace_name: workspaceName,
      },
    });
    expect(registerResponse.status()).toBe(200);
    const registerJson = await registerResponse.json();
    const authToken = registerJson.data.access_token;
    expect(authToken).toBeTruthy();

    const authHeaders = {
      Authorization: `Bearer ${authToken}`,
    };

    const workspacesResponse = await request.get(`${BACKEND_URL}/api/v1/workspaces`, {
      headers: authHeaders,
    });
    expect(workspacesResponse.status()).toBe(200);
    const workspacesJson = await workspacesResponse.json();
    const workspace = workspacesJson.data.find((item: { name: string; id: string }) => item.name === workspaceName) ?? workspacesJson.data[0];
    expect(workspace?.id).toBeTruthy();

    const projectResponse = await request.post(`${BACKEND_URL}/api/v1/projects`, {
      headers: authHeaders,
      data: {
        workspace_id: workspace.id,
        name: projectName,
        description: 'Real backend reports integration test project.',
        disease_type: 'Non-small cell lung cancer',
        cancer_type: 'EGFR',
      },
    });
    expect(projectResponse.status()).toBe(200);
    const projectJson = await projectResponse.json();
    const projectId = projectJson.data.id;
    expect(projectId).toBeTruthy();

    const sampleRunDir = path.resolve(
      __dirname,
      '../../..',
      'backend-mnl/qudrugforge-backend/tests/utils/sample_q_ai_drug_outputs/cancer_proof_v1'
    );

    const artifactImportResponse = await request.post(
      `${BACKEND_URL}/api/v1/projects/${projectId}/q-ai-drug/import-artifacts`,
      {
        headers: authHeaders,
        data: {
          run_name: 'cancer_proof_v1',
          source_output_dir: sampleRunDir,
          experiment_id: null,
        },
      }
    );
    expect(artifactImportResponse.status()).toBe(200);

    const reportImportResponse = await request.post(
      `${BACKEND_URL}/api/v1/projects/${projectId}/reports/import-q-ai-drug`,
      {
        headers: authHeaders,
        data: {
          title: 'Imported q-ai-drug Report',
          source_output_dir: sampleRunDir,
        },
      }
    );
    expect(reportImportResponse.status()).toBe(200);
    const importedReport = (await reportImportResponse.json()).data;
    expect(importedReport.status).toBe('imported');
    expect(importedReport.report_id).toBeTruthy();

    await page.addInitScript(
      ({ token, activeWorkspaceId, activeWorkspaceName, activeProjectId, activeProjectName }) => {
        window.localStorage.setItem('demo_mode', 'false');
        window.localStorage.setItem('auth_token', token);
        window.localStorage.setItem('active_workspace_id', activeWorkspaceId);
        window.localStorage.setItem('active_workspace_name', activeWorkspaceName);
        window.localStorage.setItem('active_project_id', activeProjectId);
        window.localStorage.setItem('active_project_name', activeProjectName);
      },
      {
        token: authToken,
        activeWorkspaceId: workspace.id,
        activeWorkspaceName: workspace.name,
        activeProjectId: projectId,
        activeProjectName: projectName,
      }
    );

    await page.goto('/results');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('reports-page')).toBeVisible();
    await expect(page.getByTestId('reports-summary')).toBeVisible();
    await expect(page.getByText('Real backend reports')).toBeVisible();
    await expect(page.getByText('Imported q-ai-drug artifact')).toBeVisible();
    await expect(page.getByText('Imported q-ai-drug Report')).toBeVisible();

    const initialRowCount = await page.locator('tbody tr').count();
    expect(initialRowCount).toBeGreaterThanOrEqual(1);

    await page.getByTestId('create-project-summary-report').click();
    await expect(page.getByText('Project Summary Draft')).toBeVisible({ timeout: 20000 });
    expect(await page.locator('tbody tr').count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId('reports-table')).toBeVisible();
    await expect(page.getByTestId('report-download-button').first()).toBeVisible();
  });
});
