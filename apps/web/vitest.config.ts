import { defineConfig } from 'vitest/config';
import path from 'path';

// Node-only unit tests for the web app's pure logic (no jsdom / no React
// rendering). Aliases mirror tsconfig.json's `paths` so tests import exactly
// what the app does.
export default defineConfig({
  resolve: {
    alias: {
      '@wordle-duel/core': path.resolve(__dirname, '../../packages/core/src'),
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
