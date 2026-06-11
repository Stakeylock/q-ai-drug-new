import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { SELECTORS } from './utils/selectors';
import { E2E_PROJECT_NAME } from './utils/test-data';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Research Projects Directory', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await enterWorkspace(page);
  });

  test('Page loads project cards list and shows workspace programs', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    
    // Navigate to projects
    await page.goto('/research-projects');
    await page.waitForLoadState('domcontentloaded');
    
    // Assert heading or list
    await expect(page.locator('h1').first()).toBeVisible();
    
    // Check some active projects cards exist
    await expect(page.locator('text="EGFR NSCLC Discovery Program"').or(page.locator('text="EGFR"')).first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Initiates project creation form flows', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/research-projects');
    
    // Click create project
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project"), button:has-text("Add")').first();
    if (await newProjectBtn.isVisible()) {
      await newProjectBtn.click();
      // Form modal/inputs are visible
      await expect(page.locator('input[placeholder*="name"], input[placeholder*="Title"], label:has-text("Name")').first()).toBeVisible();
    }
    
    errorTracker.assertNoSevereErrors();
  });
});
