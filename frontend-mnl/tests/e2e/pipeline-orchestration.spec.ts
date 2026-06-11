import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Pipeline Orchestration E2E Flow', () => {
  test('Should trigger full pipeline run, observe stepper progression, and verify generated reports', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);

    // 1. Perform login and go to workspace selector
    await loginUser(page);
    await expect(page).toHaveURL(/workspace-selector/);

    // 2. Select workspace & proceed to dashboard
    await enterWorkspace(page);
    await expect(page).toHaveURL(/dashboard/);

    // 3. Navigate directly to EGFR NSCLC project details page
    await page.goto('/research-projects/egfr-nsclc');
    await page.waitForLoadState('domcontentloaded');

    // 4. Assert header metadata and dynamic data labels exist
    await expect(page.locator('h1:has-text("EGFR NSCLC Discovery Program")')).toBeVisible();
    await expect(page.locator('text="REAL BACKEND DATA"').first()).toBeVisible();

    // 5. Trigger the sequential pipeline enqueuing using the header action button
    const runPipelineBtn = page.locator('button:has-text("Run Full Pipeline")').first();
    await expect(runPipelineBtn).toBeVisible();
    await runPipelineBtn.click();

    // 6. Observe stepper progression. Status indicator should transition or poll.
    // The active stepper step is styled with high-fidelity ring indicating running/completed.
    const activeStepperStep = page.locator('text="Real-time status"').first();
    await expect(activeStepperStep).toBeVisible();

    // 7. Check reports dossier status
    const reportsTab = page.locator('button[role="tab"]:has-text("Reports")').first();
    await expect(reportsTab).toBeVisible();
    await reportsTab.click();

    // 8. Assert that dynamically registered downloadable report links appear
    await expect(page.locator('text="Generated Scientific Dossiers"').first()).toBeVisible();

    errorTracker.assertNoSevereErrors();
  });
});
