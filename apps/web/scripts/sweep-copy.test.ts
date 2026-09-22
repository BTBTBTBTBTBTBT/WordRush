import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * More Games Stage 4: the Daily Sweep size is a catalog fact (SWEEP_MODES,
 * sweepModesFor), never a literal. This greps the app for copy or code that
 * still says "all 9 modes" / "nine dailies" / "9 puzzles" and fails on any hit
 * outside the allowlist, so a stray literal cannot creep back in.
 *
 * Allowlist (each entry says why):
 *   - guide-content.ts / strategy-content.ts / how-to-play-content.ts /
 *     static-content.ts: long-form editorial copy; "nine guesses" is QuadWord's
 *     real rule, and the "all nine modes" article prose is rewritten in the
 *     Stage 9 copy audit alongside the ProperNoundle guide.
 *   - auth/daily-landing.tsx, auth/landing.tsx: public marketing pages that
 *     describe the LIVE product; they flip at launch (Stage 11), not before.
 *   - portal-html.ts: the investor/ops portal, historical description.
 *   - sense-rank-fixtures.json: dictionary text ("twenty-nine").
 */
const ROOT = join(__dirname, '..');
const DIRS = ['app', 'components', 'lib'].map((d) => join(ROOT, d));
const ALLOW = [
  'lib/guide-content.ts', 'lib/strategy-content.ts', 'lib/how-to-play-content.ts', 'lib/content/static-content.ts',
  'components/auth/daily-landing.tsx', 'components/auth/landing.tsx', 'lib/portal-html.ts',
  'app/guides/page.tsx', 'app/strategy/[slug]/page.tsx', // public editorial pages describing the live product; Stage 9 copy audit
  'lib/__fixtures__/sense-rank-fixtures.json', 'scripts/sweep-copy.test.ts',
];
// "all modes" on its own is fine ("stats across all modes"); the literal size is the problem.
const PATTERN = /\b(all )?(nine|9)[ -](modes|dailies|puzzles|daily modes|game modes)\b|\b(nine|9)\/(nine|9)\b|\/9\b|all-nine|nine-for-nine|nine shared|nine words|nine puzzles|all nine\b/i;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '.next') yield* walk(p); }
    // Test files pin behaviour on dated fixtures (a 2026-08 day IS a 9-mode day), so they are not scanned.
    else if (/\.(tsx?|mjs|json)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

describe('no literal sweep size in app code or copy', () => {
  it('finds no "all 9 modes"-style literals outside the allowlist', () => {
    const hits: string[] = [];
    for (const dir of DIRS) {
      for (const file of walk(dir)) {
        const rel = relative(ROOT, file);
        if (ALLOW.includes(rel)) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => { if (PATTERN.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`); });
      }
    }
    expect(hits, `Sweep-size literals found:\n${hits.join('\n')}`).toEqual([]);
  });
});
