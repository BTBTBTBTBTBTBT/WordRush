import { defineConfig } from 'vitest/config';
import path from 'path';

// The rendered season contrast sweep (e2e/season-contrast.test.ts): boots `next dev` and drives
// Chromium, so it runs on its own (`pnpm test:contrast`), not with the node unit tests.
export default defineConfig({
  resolve: {
    alias: {
      '@wordle-duel/core': path.resolve(__dirname, '../../packages/core/src'),
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    include: ['e2e/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 240_000,
  },
});
