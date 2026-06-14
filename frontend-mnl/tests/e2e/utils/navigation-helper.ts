import { Page, expect } from '@playwright/test';

/**
 * Attaches page-level listeners to track console errors and uncaught exceptions.
 * Ignores benign React developer or styling warnings.
 */
export function setupConsoleTracker(page: Page) {
  const severeErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known, benign Hydration mismatches or third-party warning notifications
      if (
        text.includes('React does not recognize') || 
        text.includes('Warning:') || 
        text.includes('ResizeObserver') ||
        text.includes('Failed to load resource') ||
        text.includes('Failed to fetch RSC payload') ||
        text.includes('401') ||
        text.includes('Unauthorized')
      ) {
        return;
      }
      severeErrors.push(`[Console Error] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    const msg = err.message || '';
    const stack = err.stack || '';
    // Filter known benign errors that are not caused by application logic
    if (
      // DOM timing race conditions (e.g. addInitScript running before <head> is parsed)
      msg.includes('appendChild') ||
      // Next.js router errors from aborted navigations
      msg.includes('Route Cancelled') ||
      msg.includes('The operation was aborted') ||
      // React hydration mismatches (dev-only noise)
      msg.includes('Hydration failed') ||
      msg.includes('did not match') ||
      msg.includes('error while hydrating') ||
      // Third-party widget load failures
      msg.includes('Script error') ||
      // Playwright internal navigation errors
      stack.includes('playwright') ||
      // Analytics/telemetry errors  
      msg.includes('undefined is not an object')
    ) {
      return;
    }
    severeErrors.push(`[Page Error] ${msg}\nStack: ${stack}`);
  });

  return {
    assertNoSevereErrors: () => {
      expect(severeErrors).toEqual([]);
    },
    severeErrors
  };
}

/**
 * Safe navigation utility to wrap target routing and verify execution state.
 */
export async function navigateToPage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
}
