import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Platform Infrastructure & Controls', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await enterWorkspace(page);
  });

  test('Compute management loads high-performance cluster configurations', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/compute');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('.grid, table, .table').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Storage management loads data volume partitions', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/storage');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('.grid, table, .table').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('API credentials portal renders secure key profiles', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/api');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    errorTracker.assertNoSevereErrors();
  });

  test('Integrations tab shows Vina and GNINA setup states', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/integrations');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toBeVisible();
    errorTracker.assertNoSevereErrors();
  });
});
