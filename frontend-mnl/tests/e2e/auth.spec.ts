import { test, expect } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD, E2E_MODE } from './utils/test-data';
import { SELECTORS } from './utils/selectors';
import { bypassDemoMode } from './utils/auth-helper';
import { setupConsoleTracker as tracker } from './utils/navigation-helper';

test.describe('Authentication Services', () => {
  test.beforeEach(async ({ page }) => {
    await bypassDemoMode(page);
  });

  test('Login and registration pages render cleanly with validation triggers', async ({ page }) => {
    const errorTracker = tracker(page);

    // 1. Check Login Page Render
    await page.goto('/login');
    await expect(page.locator(SELECTORS.auth.loginEmail)).toBeVisible();
    await expect(page.locator(SELECTORS.auth.loginPassword)).toBeVisible();

    // 2. Form validation trigger
    await expect(page.locator(SELECTORS.auth.loginSubmit)).toBeDisabled();

    // 3. Navigate to Register/Signup Page
    await page.click('text="Create account"');
    await page.waitForURL('**/signup');
    await expect(page.locator(SELECTORS.auth.registerName)).toBeVisible();
    await expect(page.locator(SELECTORS.auth.registerEmail)).toBeVisible();

    // 4. Register validation trigger
    await page.click(SELECTORS.auth.registerSubmit);
    await expect(page.locator('text="All profile credentials are required to mount research workspace."')).toBeVisible();

    errorTracker.assertNoSevereErrors();
  });

  test('Successful authorization transitions to workspace-selector', async ({ page }) => {
    const errorTracker = tracker(page);
    await page.goto('/login');

    await page.fill(SELECTORS.auth.loginEmail, E2E_EMAIL);
    await page.fill(SELECTORS.auth.loginPassword, E2E_PASSWORD);

    // Trigger submit
    await page.click(SELECTORS.auth.loginSubmit);

    // Should navigate to workspace selector
    await page.waitForURL('**/workspace-selector', { timeout: 15000 });
    await expect(page).toHaveURL(/workspace-selector/);

    errorTracker.assertNoSevereErrors();
  });
});
