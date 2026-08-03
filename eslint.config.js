import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      // Agent worktrees are full checkouts of this repo nested inside it — linting them
      // double-reports every finding and breaks `pnpm gate` whenever a loop is in flight.
      '.claude/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/.wrangler/**',
      'playwright-report/**',
      'test-results/**',
      'scripts/fixtures/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['app/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
);
