import { describe, it, expect } from 'vitest';
import { MODE_GUIDES, PUBLIC_MODE_GUIDES, getGuide } from '../lib/guide-content';
import { MODES } from '../lib/modes.generated';
import { MODE_SCORE_CONFIG } from '../lib/composite-scoring';

/**
 * Guide guard (More Games §19). Every daily mode this build compiles in has a
 * guide; each guide's scoring copy quotes the REAL numbers from its score
 * config, so a scoring change that forgets the guide is a red build; More
 * Games titles explain every on-screen button; competitor names never appear;
 * and a flag-gated title's guide stays off the public index until launch.
 */
const COMPETITORS = /jumble|spelling.?bee|honeycomb|connections|strands|cryptoqu|wonderword|star battle/i;

describe('guide content', () => {
  it('every enabled daily mode has a guide at its catalog slug', () => {
    for (const m of MODES.filter((x) => x.enabled && x.dailyEligible && x.guideSlug)) {
      expect(getGuide(m.guideSlug as string), m.id).toBeDefined();
    }
  });

  it('scoring sections quote the mode\'s real hint cost, time cap and guess weight', () => {
    const byGuide: Record<string, string> = Object.fromEntries(
      MODES.filter((m) => m.guideSlug && m.dbKey).map((m) => [m.guideSlug as string, m.dbKey as string]),
    );
    for (const g of MODE_GUIDES) {
      const dbKey = byGuide[g.slug];
      if (!dbKey) continue;
      const cfg = MODE_SCORE_CONFIG[dbKey];
      const text = g.scoring.join(' ');
      // Word modes predate this guard and describe their formula in prose;
      // the More Games titles must carry the numbers.
      const more = MODES.find((m) => m.dbKey === dbKey)?.group === 'more';
      if (!more) continue;
      expect(text, `${g.slug} guessWeight`).toContain(String(cfg.guessWeight));
      if (cfg.hintCost) expect(text, `${g.slug} hintCost`).toContain(String(cfg.hintCost));
      const capMin = cfg.timeCap / 60;
      expect(text, `${g.slug} timeCap`).toMatch(new RegExp(`${capMin}[ -]?minute|${capMin}:00`));
    }
  });

  it('More Games guides explain every button and note the sweep rule', () => {
    for (const m of MODES.filter((x) => x.group === 'more' && x.guideSlug)) {
      const g = getGuide(m.guideSlug as string);
      if (!g) continue; // lands with its game
      expect(g.controls?.length ?? 0, `${g.slug} controls`).toBeGreaterThan(0);
      expect(g.facts.some((f) => /sweep/i.test(f.label) || /sweep/i.test(f.value)), `${g.slug} sweep fact`).toBe(true);
    }
  });

  it('never names a competitor', () => {
    for (const g of MODE_GUIDES) {
      const text = JSON.stringify(g);
      expect(COMPETITORS.test(text), g.slug).toBe(false);
    }
  });

  it('flag-gated titles stay off the public index until launch', () => {
    // Since the More Games launch the flags are a kill switch, not a launch gate: only disabled modes stay unlisted.
    const gated = new Set(MODES.filter((m) => !m.enabled).map((m) => m.guideSlug).filter(Boolean));
    for (const g of PUBLIC_MODE_GUIDES) expect(gated.has(g.slug), g.slug).toBe(false);
    for (const slug of ['classic', 'six', 'seven', 'quadword', 'octoword', 'succession', 'deliverance', 'gauntlet', 'propernoundle']) {
      expect(PUBLIC_MODE_GUIDES.some((g) => g.slug === slug), slug).toBe(true);
    }
  });
});

describe('bundled native guide copies', () => {
  it('iOS and Android carry the current guide JSON (regenerate: tsx scripts/gen-guides-json.ts)', async () => {
    const fs = await import('node:fs');
    const { renderGuidesJson, GUIDE_JSON_TARGETS } = await import('./gen-guides-json');
    const expected = renderGuidesJson();
    for (const t of GUIDE_JSON_TARGETS) {
      expect(fs.existsSync(t), t).toBe(true);
      expect(fs.readFileSync(t, 'utf8'), t).toBe(expected);
    }
  });
});
