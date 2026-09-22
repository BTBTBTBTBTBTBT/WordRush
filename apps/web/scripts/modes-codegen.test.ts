import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODE_SCORE_CONFIG } from '../lib/composite-scoring';

/**
 * Guards the modes.json codegen: the four committed generated files must match
 * what gen-mode-catalog.mjs renders from modes.json TODAY. Fails when someone
 * edits modes.json (or the generator) and forgets `pnpm gen:modes` — which
 * would silently drift the three clients (and the SQL era functions) apart.
 *
 * Also asserts the catalog invariants the More Games plan relies on (§1, §11).
 */
describe('mode-catalog codegen freshness', () => {
  it('committed generated files match a fresh render', async () => {
    const { OUTPUTS } = await import('../../../packages/core/scripts/gen-mode-catalog.mjs');
    expect(OUTPUTS).toHaveLength(4);
    for (const { path, content } of OUTPUTS) {
      expect(readFileSync(path, 'utf8'), `${path} is stale — run pnpm gen:modes`).toBe(content);
    }
  });
});

describe('mode-catalog invariants', () => {
  type Mode = { id: string; dbKey: string | null; group: string; sweep: boolean; enabled: boolean; dailyEligible: boolean; guessBase: number; category: string | null; flagKey: string | null; guideSlug: string | null; engine: string };
  type Catalog = { modes: Mode[]; sweepEras: { since: string; modes: string[] }[]; moreCategories: { key: string }[] };
  const load = async (): Promise<Catalog> => (await import('../../../packages/core/scripts/gen-mode-catalog.mjs')).CATALOG;

  it('the newest era equals the modes flagged sweep today', async () => {
    const { modes, sweepEras } = await load();
    const flagged = modes.filter((m) => m.sweep && m.enabled && m.dailyEligible && m.dbKey).map((m) => m.dbKey);
    expect([...sweepEras[0].modes].sort()).toEqual([...flagged].sort());
  });

  it('eras are newest-first, strictly descending, and end at the beginning of time', async () => {
    const { sweepEras } = await load();
    for (let i = 1; i < sweepEras.length; i++) expect(sweepEras[i - 1].since > sweepEras[i].since).toBe(true);
    expect(sweepEras[sweepEras.length - 1].since).toBe('0000-00-00');
    for (const e of sweepEras) expect(new Set(e.modes).size).toBe(e.modes.length);
  });

  it('the two historical eras are byte-identical to the pre-refactor MODE_COUNT_ERAS (7 → 9 on 2026-05-21)', async () => {
    const { sweepEras } = await load();
    const hist = sweepEras.filter((e) => e.since <= '2026-05-21');
    expect(hist.map((e) => ({ since: e.since, count: e.modes.length }))).toEqual([
      { since: '2026-05-21', count: 9 },
      { since: '0000-00-00', count: 7 },
    ]);
    expect(hist[0].modes).toEqual(['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET', 'PROPERNOUNDLE', 'DUEL_6', 'DUEL_7']);
  });

  it('More Games entries never count toward the sweep, and every sweep mode is a core word-or-PN daily', async () => {
    const { modes } = await load();
    for (const m of modes) {
      if (m.group === 'more') expect(m.sweep, m.id).toBe(false);
      if (m.sweep) { expect(m.group, m.id).toBe('core'); expect(m.dailyEligible, m.id).toBe(true); expect(m.dbKey, m.id).toBeTruthy(); }
    }
  });

  it('every More Games entry has a flag key, a category from moreCategories and a guide slug', async () => {
    const { modes, moreCategories } = await load();
    const cats = new Set(moreCategories.map((c) => c.key));
    for (const m of modes.filter((x) => x.group === 'more')) {
      expect(m.flagKey, m.id).toMatch(/^mode\./);
      expect(cats.has(m.category as string), `${m.id} category`).toBe(true);
      expect(m.guideSlug, m.id).toBeTruthy();
    }
  });

  it('ids and dbKeys are unique, and dbKeys are generic (no brand names)', async () => {
    const { modes } = await load();
    expect(new Set(modes.map((m) => m.id)).size).toBe(modes.length);
    const keys = modes.map((m) => m.dbKey).filter(Boolean) as string[];
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[A-Z_0-9]+$/);
    const brands = /muddle|hubbub|crosswordocious|kindred|letter.?ladder|codebreaker|spyglass|starsweep/i;
    for (const m of modes) { expect(m.id).not.toMatch(brands); if (m.dbKey) expect(m.dbKey).not.toMatch(brands); }
  });

  it('guessBase equals the score config perfect run for every mode that has a config', async () => {
    const { modes } = await load();
    for (const m of modes) {
      const cfg = m.dbKey ? MODE_SCORE_CONFIG[m.dbKey] : undefined;
      if (!cfg) continue;
      const perfect = (cfg as { perfectGuesses?: number }).perfectGuesses ?? cfg.totalBoards;
      expect(m.guessBase, `${m.id} guessBase`).toBe(perfect);
    }
  });

  it('competitor names appear nowhere in the catalog', async () => {
    const raw = readFileSync(new URL('../../../packages/core/modes.json', import.meta.url), 'utf8');
    expect(raw).not.toMatch(/jumble|spelling.?bee|honeycomb|connections|strands|cryptoqu|wonderword|star.?battle/i);
  });
});
