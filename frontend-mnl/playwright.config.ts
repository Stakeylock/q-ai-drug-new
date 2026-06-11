import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load E2E custom environment variables if present
dotenv.config({ path: path.resolve(__dirname, '.env.e2e') });

const isMock = (process.env.E2E_MODE || 'mock').toLowerCase() === 'mock';
process.env.NEXT_PUBLIC_DEMO_MODE = isMock ? 'true' : 'false';

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3001';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 360000,       // 6 minutes — full stage-by-stage run
  expect: {
    timeout: 20000,
  },
  use: {
    baseURL: FRONTEND_BASE_URL,
    trace: 'on',
    screenshot: 'on',    // capture on every step for recording quality
    video: { mode: 'on', size: { width: 2560, height: 1440 } },
    actionTimeout: 30000,
    navigationTimeout: 60000,
    // Maximized browser window for HD video quality
    viewport: { width: 2560, height: 1440 },
    launchOptions: {
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2560, height: 1440 },
        launchOptions: {
          args: ['--start-maximized', '--no-sandbox'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 180000,
  },
});
