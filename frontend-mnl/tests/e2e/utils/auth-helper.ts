import { Page } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD, E2E_MODE } from './test-data';
import { SELECTORS } from './selectors';

/**
 * Configure local storage on init to synchronize demo mode state.
 */
export async function bypassDemoMode(page: Page) {
  const isMock = E2E_MODE === 'mock';
  const demoModeValue = isMock ? 'true' : 'false';
  
  await page.addInitScript((val) => {
    window.localStorage.setItem('demo_mode', val);
  }, demoModeValue);
}

/**
 * Perform login workflow using credentials form.
 */
export async function loginUser(page: Page, email = E2E_EMAIL, password = E2E_PASSWORD) {
  await bypassDemoMode(page);
  await page.goto('/login');
  
  // Wait for login fields to be fully interactive
  await page.waitForSelector(SELECTORS.auth.loginEmail);
  await page.fill(SELECTORS.auth.loginEmail, email);
  await page.fill(SELECTORS.auth.loginPassword, password);
  
  // Submit Form
  await page.click(SELECTORS.auth.loginSubmit);
  
  // Wait for routing transition to workspace-selector
  await page.waitForURL('**/workspace-selector', { timeout: 15000 });
}

/**
 * Select default active workspace and proceed to the primary researcher dashboard.
 */
export async function enterWorkspace(page: Page) {
  await page.waitForURL('**/workspace-selector');
  await page.waitForSelector(SELECTORS.workspace.continueDashboard);
  await page.click(SELECTORS.workspace.continueDashboard);
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}
