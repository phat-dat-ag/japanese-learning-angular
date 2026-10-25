import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';

// Defaults to the current checkout; opt in to the local production frontend.
const deployed = process.env['FLASHCARD_E2E_DEPLOYED'] === 'true';
export default defineConfig({
  ...base,
  testMatch: 'flashcard-learning.*.mjs',
  use: { ...base.use, baseURL: deployed ? 'http://127.0.0.1:8088' : 'http://127.0.0.1:4200' },
  webServer: deployed
    ? undefined
    : {
      command: 'npm run start -- --host 127.0.0.1 --port 4200',
      url: 'http://127.0.0.1:4200',
      reuseExistingServer: false,
      timeout: 90_000,
    },
});
