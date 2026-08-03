import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // Full-stack WS tests (reconnect/presence) have real timing variance under parallel load
  // against the single Miniflare DO. They pass 5/5 in isolation; the residual flake is
  // contention, not a logic bug. CI already retries; give local runs one retry too so a
  // green suite doesn't depend on machine load. The workers cap below keeps it rare.
  retries: process.env['CI'] ? 2 : 1,
  // Every worker's browser hits the SAME single `wrangler dev` (Miniflare) session server,
  // so full-stack parallelism is bounded by that one DO, not by CPU. Uncapped (one worker
  // per core — 14 here) oversubscribes it and the timing-sensitive reconnect/presence tests
  // exceed their windows. Cap local runs to keep the DO responsive; CI keeps its 2 retries.
  workers: process.env['CI'] ? undefined : 4,
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
      // Never reuse a manually-started `pnpm dev` here: it won't have the test-only
      // `DEV_STATE_DUMP` binding, so the privacy suite's storage-dump assertion 404s and
      // reports as a code failure. Failing with "address in use" is far more legible.
      reuseExistingServer: false,
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
