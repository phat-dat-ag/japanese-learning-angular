import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8088',
    browserName: 'chromium',
    actionTimeout: 15_000,
    channel: process.env['QUIZ_E2E_BROWSER_CHANNEL'] || undefined,
    // Auth requests contain credentials: never persist traces, HAR, or storageState.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
