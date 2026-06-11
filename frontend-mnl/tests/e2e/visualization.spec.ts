import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Macromolecular & Data Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await enterWorkspace(page);
  });

  test('3D Macromolecule Viewer loads cleanly without crashing', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/visualization');
    await page.waitForLoadState('domcontentloaded');
    
    // Assert 3D structure container is mapped
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('#mol3d-container, canvas, .viewer-3d, .border').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Chemical Space UMAP embedding visualizer renders charts', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/chemical-space');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    // Look for canvas, chart or plotly containers
    await expect(page.locator('canvas, .plotly, .chart, .js-plotly-plot, svg').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Molecular similarity charts and grids render successfully', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/similarity');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    // Similarity matrix table exists
    await expect(page.locator('table, .ui-card-surface').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });
});
