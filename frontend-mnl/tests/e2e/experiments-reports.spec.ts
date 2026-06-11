import { test, expect } from '@playwright/test';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Experiments & Research Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('demo_mode', 'false');
      window.localStorage.setItem('auth_token', 'e2e-token');
      window.localStorage.setItem('active_workspace_id', 'workspace-1');
      window.localStorage.setItem('active_workspace_name', 'E2E Workspace');
      window.localStorage.setItem('active_project_id', 'project-123');
      window.localStorage.setItem('active_project_name', 'EGFR NSCLC Discovery Program');
    });
  });

  test('Experiments page loads the dynamic progress tracking table', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('table, .table, [role="table"]').first()).toBeVisible();
    
    // Assert presence of status and metadata columns
    await expect(
      page.locator('text="Status"').or(
      page.locator('text="Progress"')).or(
      page.locator('text="Created"')).or(
      page.locator('text="Type"')).first()
    ).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Reports/results directory loads analytic downloads list', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.route('**/api/v1/projects/project-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'project-123',
            name: 'EGFR NSCLC Discovery Program',
            status: 'active',
          },
          message: 'Project fetched',
        }),
      });
    });

    await page.route('**/api/v1/projects/project-123/reports/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            project_id: 'project-123',
            total_reports: 0,
            completed_reports: 0,
            draft_reports: 0,
            imported_reports: 0,
            failed_reports: 0,
            available_sections: {
              molecules: false,
              docking: false,
              gnina: false,
              quantum: false,
              admet: false,
              simulations: false,
            },
          },
          message: 'Summary fetched',
        }),
      });
    });

    await page.route('**/api/v1/projects/project-123/reports', async (route) => {
      const method = route.request().method();
      if (method !== 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: {}, message: 'OK' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            project_id: 'project-123',
            reports: [],
            count: 0,
            total: 0,
            limit: 100,
            skip: 0,
          },
          message: 'Reports fetched',
        }),
      });
    });

    await page.evaluate(() => {
      window.localStorage.setItem('active_project_id', 'project-123');
      window.localStorage.setItem('active_project_name', 'EGFR NSCLC Discovery Program');
      window.localStorage.setItem('demo_mode', 'false');
    });

    await page.goto('/results');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('REAL BACKEND REPORTS')).toBeVisible();
    await expect(page.getByText('No reports generated yet.')).toBeVisible();
    await expect(page.getByText('Total reports')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(0);

    await page.unroute('**/api/v1/projects/project-123/reports');
    await page.unroute('**/api/v1/projects/project-123/reports/summary');
    await page.unroute('**/api/v1/projects/project-123');

    await page.route('**/api/v1/projects/project-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'project-123',
            name: 'EGFR NSCLC Discovery Program',
            status: 'active',
          },
          message: 'Project fetched',
        }),
      });
    });

    await page.route('**/api/v1/projects/project-123/reports/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            project_id: 'project-123',
            total_reports: 1,
            completed_reports: 1,
            draft_reports: 0,
            imported_reports: 0,
            failed_reports: 0,
            available_sections: {
              molecules: true,
              docking: true,
              gnina: true,
              quantum: true,
              admet: true,
              simulations: true,
            },
          },
          message: 'Summary fetched',
        }),
      });
    });

    await page.route('**/api/v1/projects/project-123/reports', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            project_id: 'project-123',
            reports: [
              {
                report_id: 'report-123',
                workspace_id: 'workspace-1',
                project_id: 'project-123',
                title: 'Project Summary Report',
                report_type: 'project_summary',
                status: 'completed',
                source: 'qudrugforge',
                source_module: 'reports',
                candidate_molecule_ids: [],
                target_ids: [],
                experiment_ids: [],
                sections: [
                  { section_id: 'overview', title: 'Project Overview', status: 'available', summary: 'Overview ready', data_refs: { molecules: [], docking_results: [], gnina_results: [], quantum_results: [], admet_results: [], simulation_results: [] } },
                ],
                file_ids: ['file-pdf-123', 'file-html-123'],
                primary_file_id: 'file-pdf-123',
                metadata: {
                  candidate_count: 24,
                  target_count: 1,
                  has_docking: true,
                  has_gnina: true,
                  has_quantum: true,
                  has_admet: true,
                  has_simulations: true,
                  imported_source_dir: null,
                },
                created_by: 'user-1',
                created_at: '2026-05-18T12:00:00.000Z',
                updated_at: '2026-05-18T12:30:00.000Z',
                completed_at: '2026-05-18T12:30:00.000Z',
                error_message: null,
              },
            ],
            count: 1,
            total: 1,
            limit: 100,
            skip: 0,
          },
          message: 'Reports fetched',
        }),
      });
    });

    await page.route('**/api/v1/projects/project-123/reports/report-123/files', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            report_id: 'report-123',
            files: [
              {
                file_id: 'file-pdf-123',
                filename: 'Project_Summary.pdf',
                file_type: 'pdf',
                mime_type: 'application/pdf',
                size_bytes: 204800,
                download_url: '/api/v1/files/file-pdf-123/download',
              },
              {
                file_id: 'file-html-123',
                filename: 'Project_Summary.html',
                file_type: 'html',
                mime_type: 'text/html',
                size_bytes: 102400,
                download_url: '/api/v1/files/file-html-123/download',
              },
            ],
          },
          message: 'Files fetched',
        }),
      });
    });

    await page.goto('/results');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Project Summary Report')).toBeVisible();
    await expect(page.getByText('Generated by QuDrugForge')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download' })).toHaveCount(2);
    await expect(page.getByText('Project_Summary.pdf')).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });
});
