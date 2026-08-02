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
  webServer: {
    // Dedicated port so a stray Vite dev server on 5173 is never mistaken for the app.
    command: 'pnpm --filter @values-cards/app exec vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
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
