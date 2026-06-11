import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Research Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await enterWorkspace(page);
  });

  test('Dashboard loads key telemetry cards and lists recent experiments', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    
    // 1. Verify dashboard landing header
    await expect(page.locator('h1, h2').first()).toContainText('Dashboard');
    
    // 2. Assert key metric cards render
    await expect(page.getByText('GPU Utilization').or(page.getByText('GNINA Queue')).first()).toBeVisible();
    
    // 3. Recent activity or recent runs panel is visible
    await expect(page.getByText('Active Research Pipeline').or(page.getByText('Global Experiment Log')).first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });
});
