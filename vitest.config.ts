import { defineConfig } from 'vitest/config';

// Test discovery is include-by-default (Vitest default globs) in every
// project — never add `include`/testMatch whitelists (repo rule).
export default defineConfig({
  test: {
    projects: ['app', 'party', 'shared', 'decks', 'scripts'],
  },
});
