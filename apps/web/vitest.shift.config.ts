import { defineConfig } from 'vitest/config';
import path from 'path';

// The screen-shift harness (e2e/screen-shift.test.ts, item 37): boots `next dev` and drives
// Chromium, so it runs on its own (`pnpm test:shift`), not with the node unit tests.
export default defineConfig({
  resolve: {
    alias: {
      '@wordle-duel/core': path.resolve(__dirname, '../../packages/core/src'),
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    include: ['e2e/screen-shift.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 240_000,
  },
});
