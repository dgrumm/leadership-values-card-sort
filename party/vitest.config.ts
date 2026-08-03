import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // Deterministic test-only secret — never used outside vitest-pool-workers.
        bindings: { SESSION_TOKEN_SECRET: 'test-secret-do-not-use-in-prod' },
      },
    }),
  ],
  test: {
    name: 'party',
  },
});
