export const E2E_EMAIL = process.env.E2E_EMAIL || 'e2e_researcher@example.com';
export const E2E_PASSWORD = process.env.E2E_PASSWORD || 'Password123!';
export const E2E_WORKSPACE_NAME = process.env.E2E_WORKSPACE_NAME || 'E2E Oncology Workspace';
export const E2E_PROJECT_NAME = process.env.E2E_PROJECT_NAME || 'E2E EGFR NSCLC Project';
export const E2E_MODE = (process.env.E2E_MODE || 'mock').toLowerCase() as 'mock' | 'real';
export const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
export const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8001';
