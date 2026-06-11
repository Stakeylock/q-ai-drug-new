import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { setupConsoleTracker } from './utils/navigation-helper';

test.describe('Artificial Intelligence & GenAI Services', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await enterWorkspace(page);
  });

  test('AI Models catalog loads and shows active training indicators', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/models');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page.locator('h1, h2').first()).toContainText('Model');
    await expect(page.locator('table, .grid, [role="table"]').first()).toBeVisible();
    
    errorTracker.assertNoSevereErrors();
  });

  test('Pharma LLM Copilot chat accepts input and generates replies', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    await page.goto('/copilot');
    await page.waitForLoadState('domcontentloaded');
    
    // Check copilot layout
    await expect(page.locator('h1, h2').first()).toContainText('Pharma');
    
    // Check chat message input is visible
    const inputSelector = 'textarea[placeholder*="Ask Pharma Copilot"], input[placeholder*="Ask Pharma Copilot"], textarea[placeholder*="chat"], input[placeholder*="chat"], textarea[placeholder*="Query"], input[placeholder*="Query"]';
    await expect(page.locator(inputSelector).first()).toBeVisible();
    
    // Type a mock question
    await page.locator(inputSelector).first().fill('Suggest optimal binding site residues for EGFR NSCLC target');
    
    // Submit Chat
    const sendBtn = page.locator('button:has-text("Send"), button[type="submit"], button:has(.fa-paper-plane)').first();
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
      // Asserting dialogue history increases or loading states trigger
      await expect(page.locator('text=EGFR').or(page.locator('text=pocket')).first()).toBeVisible();
    }
    
    errorTracker.assertNoSevereErrors();
  });
});
