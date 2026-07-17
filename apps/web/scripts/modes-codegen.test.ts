import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Guards the modes.json codegen: the three committed ModeCatalog.generated.*
 * files must match what gen-mode-catalog.mjs renders from modes.json TODAY.
 * Fails when someone edits modes.json (or the generator) and forgets
 * `pnpm gen:modes` — which would silently drift the three clients apart.
 */
describe('mode-catalog codegen freshness', () => {
  it('committed generated files match a fresh render', async () => {
    // The generator only writes when run as a main script; importing it just
    // exposes OUTPUTS (path + freshly-rendered content).
    const { OUTPUTS } = await import('../../../packages/core/scripts/gen-mode-catalog.mjs');
    expect(OUTPUTS).toHaveLength(3);
    for (const { path, content } of OUTPUTS) {
      expect(readFileSync(path, 'utf8'), `${path} is stale — run pnpm gen:modes`).toBe(content);
    }
  });
});
