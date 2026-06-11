import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { SELECTORS } from './utils/selectors';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Workspace Management', () => {
  test('Workspace selector lists available workspaces and handles transitions', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    
    // 1. Perform login to reach workspace selector
    await loginUser(page);
    
    // 2. Validate cards and lists
    await expect(page.locator('text="Organization Workspaces"')).toBeVisible();
    await expect(page.locator('text="Oncology Research Workspace"')).toBeVisible();
    await expect(page.locator('text="Demo Workspace"')).toBeVisible();
    
    // 3. Select default active workspace & click enter
    await enterWorkspace(page);
    
    // 4. Assert landing on dashboard
    await expect(page).toHaveURL(/dashboard/);
    
    errorTracker.assertNoSevereErrors();
  });

  test('Workspace Wizard buttons trigger institutional notifications', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await loginUser(page);
    
    // Bind dialog handler
    let alertMsg = '';
    page.once('dialog', async (dialog) => {
      alertMsg = dialog.message();
      await dialog.accept();
    });
    
    // Click Create Workspace button
    await page.click('button:has-text("Create Workspace")');
    expect(alertMsg).toContain('Create Workspace Wizard');
    
    errorTracker.assertNoSevereErrors();
  });
});
