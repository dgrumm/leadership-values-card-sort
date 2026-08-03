import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // The session DO (spec 01.1) — Vite proxies /api to it (app/vite.config.ts).
      // Deterministic test-only secret, matching party/vitest.config.ts's convention.
      command:
        'pnpm --filter @values-cards/party exec wrangler dev --port 8799 --var SESSION_TOKEN_SECRET:test-e2e-secret-do-not-use-in-prod --var DEV_STATE_DUMP:true',
      url: 'http://127.0.0.1:8799/api/health',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
    {
      // Dedicated port so a stray Vite dev server on 5173 is never mistaken for the app.
      command: 'pnpm --filter @values-cards/app exec vite --port 5199 --strictPort',
      url: 'http://localhost:5199',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
