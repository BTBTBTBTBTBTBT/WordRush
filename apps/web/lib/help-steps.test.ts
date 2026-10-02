import { describe, expect, it } from 'vitest';
import { MODES } from './modes.generated';
import { HELP_STEP_SLUGS, helpRow, helpSteps } from './help-steps';

describe('help steps (FINISH_SPEC AF)', () => {
  const slugs = MODES.map((m) => m.guideSlug).filter((s): s is string => !!s);

  it('covers every game in the catalog that has a guide', () => {
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) expect(HELP_STEP_SLUGS, slug).toContain(slug);
  });

  it.each(slugs)('%s has a title and 3–4 short non-empty steps, each with an example', (slug) => {
    const h = helpSteps(slug);
    expect(h).not.toBeNull();
    expect(h!.title.trim().length).toBeGreaterThan(0);
    expect(h!.steps.length).toBeGreaterThanOrEqual(3);
    expect(h!.steps.length).toBeLessThanOrEqual(4);
    for (const step of h!.steps) {
      expect(step.text.trim().length).toBeGreaterThan(0);
      expect(step.text.length).toBeLessThanOrEqual(110);
      const ex = step.example;
      if (ex.kind === 'tiles') {
        expect(ex.rows.length).toBeGreaterThan(0);
        expect(ex.rows.length).toBeLessThanOrEqual(2);
        for (const row of ex.rows) {
          expect(row.tiles.length).toBeGreaterThan(0);
          expect(row.tiles.length).toBeLessThanOrEqual(9);
        }
      } else {
        expect(ex.chips.length).toBeGreaterThan(0);
        for (const c of ex.chips) expect(c.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('every slug with steps is a real guide', () => {
    for (const slug of HELP_STEP_SLUGS) expect(helpSteps(slug), slug).not.toBeNull();
  });

  it('helpRow maps codes to looks; uppercase colored tiles flip, lowercase sit still', () => {
    const r = helpRow('CR NE', 'CpeTX');
    expect(r.tiles.map((t) => t.look)).toEqual(['correct', 'present', 'empty', 'typed', 'conflict']);
    expect(r.tiles.map((t) => t.flip)).toEqual([true, false, false, false, true]);
    expect(r.tiles[2].ch).toBe('');
    expect(() => helpRow('AB', 'C')).toThrow();
    expect(() => helpRow('A', 'Z')).toThrow();
  });

  it('the word-game color example is truthful (CRANE against CHAIR)', () => {
    const h = helpSteps('classic')!;
    const row = h.steps[1].example.kind === 'tiles' ? h.steps[1].example.rows[0] : null;
    expect(row?.tiles.map((t) => t.look)).toEqual(['correct', 'present', 'correct', 'absent', 'absent']);
  });

  it('returns null for an unknown slug', () => {
    expect(helpSteps('nope')).toBeNull();
  });
});
