import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { join } from 'node:path';
import { bubbleAtlasLayout, bubbleFit, bubbleGlyphName, bubbleWidthEm, homeHeadlineFit, BUBBLE_ATLAS, BUBBLE_GLYPHS } from './bubble-text';
import { BUBBLE_ATLAS_METRICS } from './bubble-atlas-metrics';
import { createHash } from 'node:crypto';
import { bannerHeadline } from './home-banner';
import { headlineFontSize } from './headline-tokens';

const fixDir = join(__dirname, '..', '..', '..', 'apps', 'ios', 'Tests', 'Fixtures');

/** Every headline/title the parity fixtures pin (home, VS, friends, leaderboard) plus the nastiest hand-made ones. */
export function headlineCorpus(): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if ((k === 'headline' || k === 'headlineA' || k === 'headlineB' || k === 'title') && typeof x === 'string') out.add(x.toUpperCase());
        else walk(x);
      }
    }
  };
  for (const f of ['home-banner-fixtures.json', 'vs-lobby-fixtures.json', 'friendly-games-fixtures.json', 'leaderboard-title-fixtures.json']) {
    walk(JSON.parse(fs.readFileSync(join(fixDir, f), 'utf8')));
  }
  // The greeting for every hour band with long usernames.
  const none = { played: 0, total: 8, won: 0, flawless: 0 };
  for (const hour of [2, 6, 13, 20]) {
    for (const name of ['', 'BMT', 'Maximillian_The_Great', 'Wolfgang Amadeus', 'xX_DragonSlayer_2009_Xx']) {
      out.add(bannerHeadline(none as never, { ...none, total: 10 } as never, { hour, name, unlimited: false }));
    }
  }
  // Longest values: 4-digit numbers, the longest news lines, Halloween strings.
  for (const s of [
    'WORDOCIOUS FLAWLESS! 10 PUZZLES LEFT', 'PUZZLES FLAWLESS! 10 PUZZLES LEFT', 'WORDOCIOUS SWEPT! 10 PUZZLES LEFT',
    'ON A ROLL · 11 OF 18', 'HOME STRETCH · 12 LEFT', 'FLAWLESS + SWEEP!', 'HAPPY HALLOWEEN, MAXIMILLIAN_THE_GREAT!',
    'SPOOKY SEASON · TRICK OR TREAT ★ 9,999 POINTS', 'YOU’RE #1 TODAY ★ 9,999 POINTS', 'DOUG & BMT · 9,999 - 9,999',
    'SATURDAY SUPERSTARS', 'WEDNESDAY WIZARDS', 'W',
  ]) out.add(s);
  return [...out].filter((s) => s.length > 0);
}

// iPhone SE/mini (285 slot) up to Pro Max / iPad / wide web, plus a 360 px web column's slot.
export const BUBBLE_TEST_SLOTS = [220, 285, 300, 334, 358, 400, 520, 760];

describe('bubble text fit (2.8 item 6): never clips, never truncates, fills the slot', () => {
  it('has the atlas glyph set', () => {
    expect(BUBBLE_GLYPHS).toContain('★');
    expect(bubbleGlyphName('a')).toBe('a');
    expect(bubbleGlyphName('!')).toBe('excl');
    expect(bubbleGlyphName('?')).toBe('quest');
    expect(bubbleGlyphName('-')).toBe('hyphen');
    expect(bubbleGlyphName('%')).toBe('percent');
    expect(bubbleGlyphName('·')).toBe('dot');
    expect(bubbleGlyphName('#')).toBeNull();
  });

  const texts = headlineCorpus();
  it('has a real corpus', () => expect(texts.length).toBeGreaterThan(40));

  for (const slot of BUBBLE_TEST_SLOTS) {
    it(`every headline fits a ${slot}px slot (bubbleFit)`, () => {
      for (const t of texts) {
        const maxSize = 38;
        const f = bubbleFit(t, slot, { maxSize });
        // nothing dropped, nothing ellipsized
        expect(f.lines.join('').replace(/ /g, ''), t).toBe(t.replace(/ /g, ''));
        for (const l of f.lines) {
          expect(l).not.toContain('…');
          expect(bubbleWidthEm(l) * f.size, `${t} @${slot} line "${l}"`).toBeLessThanOrEqual(slot + 1e-6);
        }
        // under-fill: a single line is the largest size that fits (or the cap)
        if (!f.wrapped) {
          expect(f.size === maxSize || bubbleWidthEm(f.lines[0]) * (f.size + 1) > slot, `${t} @${slot} under-filled at ${f.size}`).toBe(true);
        } else {
          expect(f.lines.length, t).toBeLessThanOrEqual(6);
        }
      }
    });

    it(`every Home headline fits a ${slot}px slot (homeHeadlineFit, incl. long usernames)`, () => {
      for (const t of texts) {
        for (const name of ['', 'BMT', 'Maximillian_The_Great']) {
          const f = homeHeadlineFit(t, name, slot);
          expect(f.size).toBeLessThanOrEqual(headlineFontSize(slot));
          for (const l of f.lines) {
            expect(l).not.toContain('…');
            expect(bubbleWidthEm(l) * f.size, `${t} / ${name} @${slot} "${l}"`).toBeLessThanOrEqual(slot + 1e-6);
          }
        }
      }
    });
  }

  it('scales up to fill a wide slot and caps at maxSize', () => {
    expect(bubbleFit('HI', 300, { maxSize: 60 }).size).toBe(60);
    const f = bubbleFit('PLAY', 200, { maxSize: 80 });
    expect(f.size).toBeGreaterThan(38);
    expect(bubbleWidthEm('PLAY') * f.size).toBeLessThanOrEqual(200);
  });

  it('wraps the long Home headline in two balanced lines instead of truncating', () => {
    const f = homeHeadlineFit('WORDOCIOUS FLAWLESS! 3 PUZZLES LEFT', '', 285);
    expect(f.lines).toEqual(['WORDOCIOUS FLAWLESS!', '3 PUZZLES LEFT']);
    expect(f.wrapped).toBe(true);
  });

  it('hard-splits a single word wider than the slot', () => {
    const f = bubbleFit('SUPERCALIFRAGILISTICEXPIALIDOCIOUS', 200);
    expect(f.lines.length).toBeGreaterThan(1);
    expect(f.lines.join('')).toBe('SUPERCALIFRAGILISTICEXPIALIDOCIOUS');
  });
});

describe('the shipped glyph atlas (2.8 item 6 acceptance)', () => {
  const repo = join(__dirname, '..', '..', '..');
  const stems = Object.keys(BUBBLE_ATLAS_METRICS);
  const sha = (p: string) => createHash('sha1').update(fs.readFileSync(p)).digest('hex');

  it('is ready and ships all 48 glyphs byte-identical on web, iOS and Android', () => {
    expect(BUBBLE_ATLAS.ready).toBe(true);
    expect(stems.length).toBe(48);
    for (const s of stems) {
      const web = join(repo, 'apps/web/public/art/bubble', `${s}.png`);
      const ios = join(repo, 'apps/ios/Wordocious/Resources/Assets.xcassets', `bubble-${s}.imageset`, `bubble-${s}.png`);
      const and = join(repo, 'apps/android/app/src/main/res/drawable-nodpi', `bubble_${s}.png`);
      for (const p of [web, ios, and]) expect(fs.existsSync(p), p).toBe(true);
      expect(sha(ios), s).toBe(sha(web));
      expect(sha(and), s).toBe(sha(web));
    }
  });

  it('every drawable character maps to a shipped stem; every stem is reachable', () => {
    const reached = new Set(Array.from(BUBBLE_GLYPHS).map((c) => bubbleGlyphName(c)));
    expect(reached.has(null)).toBe(false);
    for (const s of stems) expect(reached.has(s), s).toBe(true);
  });

  it('lays out DAILIES on one baseline and drops the comma below it', () => {
    const l = bubbleAtlasLayout('DAILIES');
    expect(l.places.length).toBe(7);
    for (const p of l.places) expect(Math.abs(p.y + p.h - (l.asc + 0.0)) , p.stem).toBeLessThan(0.08);
    const c = bubbleAtlasLayout('A,');
    expect(c.places[1].y + c.places[1].h).toBeGreaterThan(c.asc);
  });

  it('keeps the side-by-side acceptance sheet (scripts/build-bubble-atlas.py)', () => {
    expect(fs.existsSync(join(repo, 'docs/design/brand/2.8/glyphs/acceptance-wired.png'))).toBe(true);
  });
});
