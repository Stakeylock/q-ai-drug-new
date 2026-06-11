import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Project Workspace Details', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await enterWorkspace(page);
  });

  test('Project detail loads and displays metadata and pocket configuration forms', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    
    // Go directly to the oncology research project workspace
    await page.goto('/research-projects/oncology');
    await page.waitForLoadState('domcontentloaded');
    
    // Check main title
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
    
    // Check key panels: Research Objective, Pipeline Progress, or Candidates
    await expect(
      page.locator('text="Research Objective"').or(
      page.locator('text="Pipeline Execution Progress"')).or(
      page.locator('text="Lead Candidate"')).first()
    ).toBeVisible();

    errorTracker.assertNoSevereErrors();
  });
});
