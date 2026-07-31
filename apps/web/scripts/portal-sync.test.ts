import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PORTAL_HTML } from '../lib/portal-html';

// The engineering portal ships twice from one source: /admin/portal renders
// PORTAL_HTML, and WORDOCIOUS_PORTAL.html at the repo root is the standalone
// copy that survives the site being down. Editing the module without running
// scripts/gen-portal-html.mjs would silently fork them — fail here instead.
describe('engineering portal copies are identical', () => {
  const repoRoot = join(__dirname, '..', '..', '..');

  it('WORDOCIOUS_PORTAL.html matches lib/portal-html.ts', () => {
    const standalone = readFileSync(join(repoRoot, 'WORDOCIOUS_PORTAL.html'), 'utf8');
    expect(
      standalone.trim(),
      'run: node scripts/gen-portal-html.mjs',
    ).toBe(PORTAL_HTML.trim());
  });

  it('contains no obvious secret material', () => {
    // Belt-and-braces: the doc is meant to name services, never credentials.
    for (const needle of ['sk_live', 'sk_test', 'BEGIN PRIVATE KEY', 'service_role_key', 'eyJhbGciOi']) {
      expect(PORTAL_HTML.includes(needle), `portal contains "${needle}"`).toBe(false);
    }
  });
});
