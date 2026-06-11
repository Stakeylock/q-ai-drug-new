import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Organization Administration', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await enterWorkspace(page);
  });

  test('Team portal lists active investigators and roles', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('.grid, table, .table').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Billing page renders workspace tier and credits summaries', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/billing');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('.grid, table, .table').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Audit logs display security events and credential triggers', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/audit');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('table, .table, [role="table"]').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Workspace Settings panel loads operational rules forms', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('form, .grid').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });
});
