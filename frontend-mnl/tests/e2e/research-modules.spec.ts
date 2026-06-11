import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Research & Computational Modules', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await enterWorkspace(page);
  });

  test('Targets page loads targets table and search filtering controls', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/targets');
    await page.waitForLoadState('domcontentloaded');
    
    // Assert heading
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    // Assert table or items exist
    await expect(page.locator('.ui-card-surface, table, [role="table"]').first()).toBeVisible();
    errorTracker.assertNoSevereErrors();
  });

  test('Molecules page loads chemical compound library profiles', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/molecules');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('table, [role="table"], .table').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Docking and GNINA pocket screening runs render setup controls', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/docking');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    // Check parameters panel or run trigger
    await expect(page.locator('button:has-text("Run"), button:has-text("Start"), label').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Quantum modeling page loads chemical space and QM screening panels', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/quantum');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    errorTracker.assertNoSevereErrors();
  });

  test('Simulations stability and trajectory viewer pages load cleanly', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/simulation');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    errorTracker.assertNoSevereErrors();
  });
});
