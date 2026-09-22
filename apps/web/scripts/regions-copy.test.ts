import { describe, it, expect } from 'vitest';
import { REGIONS_ALL_COPY, REGIONS_WIN_TITLE, REGIONS_WIN_SHORT } from '../components/regions/copy';
import { getGuide } from '../lib/guide-content';
import { ACHIEVEMENTS } from '../lib/achievement-service';
import { MODES } from '../lib/modes.generated';

/**
 * Starsweep wording guard (More Games §18b). "Sweep" already means the Daily
 * Sweep, which Starsweep does NOT count toward. So: the game is always
 * "Starsweep" (one word), never "Star Sweep" or "the sweep"; its win copy is
 * "Board cleared" / "Starsweep solved", never "Sweep!"; the picker chip is
 * "Stars"; the guide says More Games do not count toward the Daily Sweep; and
 * no Starsweep string uses a bare "sweep" except in that exact phrase.
 */
const bareSweep = (s: string) => /(^|[^a-z])sweep/i.test(s.replace(/Daily Sweep/g, '').replace(/sweep celebration/g, ''));

describe('Starsweep wording', () => {
  const guide = getGuide('starsweep')!;
  const regionsAchievements = ACHIEVEMENTS.filter((a) => a.key.startsWith('regions_') || a.key.startsWith('pure_regions_'));
  const catalog = MODES.find((m) => m.id === 'regions')!;

  it('has the game, its guide, its achievements and its catalog record', () => {
    expect(guide).toBeDefined();
    expect(regionsAchievements.length).toBeGreaterThanOrEqual(4);
    expect(catalog).toBeDefined();
  });

  it('never writes "Star Sweep" as two words', () => {
    const all = [...REGIONS_ALL_COPY, JSON.stringify(guide), ...regionsAchievements.map((a) => `${a.name} ${a.description}`), catalog.title, catalog.desc];
    for (const s of all) expect(/star\s+sweep/i.test(s), s).toBe(false);
  });

  it('win copy is "Board cleared" / "Starsweep solved", never "Sweep!"', () => {
    expect(REGIONS_WIN_TITLE).toBe('Board cleared');
    expect(REGIONS_WIN_SHORT).toBe('Starsweep solved');
    for (const s of REGIONS_ALL_COPY) expect(bareSweep(s), s).toBe(false);
  });

  it('achievements and catalog never use a bare "sweep"', () => {
    for (const a of regionsAchievements) expect(bareSweep(`${a.name} ${a.description}`), a.key).toBe(false);
    expect(bareSweep(`${catalog.title} ${catalog.desc}`)).toBe(false);
    expect(catalog.shortTitle).toBe('Stars');
    expect(catalog.title).toBe('Starsweep');
  });

  it('the guide says More Games do not count toward the Daily Sweep and otherwise never says "sweep"', () => {
    expect(guide.facts.some((f) => /Daily Sweep/.test(f.label) && /not counted/i.test(f.value))).toBe(true);
    const strings: string[] = [guide.title, guide.tagline, guide.metaDescription, ...guide.rules, ...guide.scoring,
      ...guide.tips.flatMap((t) => [t.heading, t.body]), ...(guide.controls ?? []).flatMap((c) => [c.label, c.body]),
      ...guide.facts.flatMap((f) => [f.label, f.value])];
    for (const s of strings) expect(bareSweep(s), s).toBe(false);
  });
});
