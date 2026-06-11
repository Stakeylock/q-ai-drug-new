import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { SELECTORS } from './utils/selectors';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Full-Stack Integration E2E Smoke Test', () => {
  test('Should login, enter workspace dashboard, and browse research projects directory cleanly', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);

    // 1. Perform login and go to workspace selector
    await loginUser(page);
    await expect(page).toHaveURL(/workspace-selector/);

    // 2. Select default active workspace & proceed to dashboard
    await enterWorkspace(page);
    await expect(page).toHaveURL(/dashboard/);

    // 3. Navigate to Research Projects directory
    await page.goto('/research-projects');
    await page.waitForLoadState('domcontentloaded');

    // 4. Assert page headers and project cards
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('text="Active Research Programs"').first()).toBeVisible();
    await expect(page.locator('text="EGFR NSCLC Discovery Program"').first()).toBeVisible();

    // 5. Verify Create Project button initiates flow
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project"), button:has-text("Add")').first();
    await expect(newProjectBtn).toBeVisible();

    errorTracker.assertNoSevereErrors();
  });
});
