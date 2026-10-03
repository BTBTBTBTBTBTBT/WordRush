import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { compactRankLine } from './leaderboard-podium';

// FINISH_SPEC AU1–AU3 (web).

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('AU2 the compact rank row', () => {
  it('reads "#2 of 5 · 2,005 PTS · guesses · time" once, with no repeated headline', () => {
    const line = compactRankLine({ rank: 2, total: 5, points: '2,005', semantics: 'guesses', guessBase: 1, guesses: 4, timeSeconds: 48 });
    expect(line.startsWith('#2 of 5 · 2,005 PTS · ')).toBe(true);
    expect(line.endsWith(' · 48s')).toBe(true);
    expect(line).not.toMatch(/TODAY/i);
  });

  it('drops missing pieces; friends board says so; the Sweep uses its totals line', () => {
    expect(compactRankLine({ rank: null, total: null, points: null })).toBe('Your result');
    expect(compactRankLine({ rank: 1, total: 3, friends: true, points: null })).toBe('#1 of 3 friends');
    expect(compactRankLine({ rank: 7, total: 40, points: '9,100', detail: 'Swept · 8/8 · 6m' })).toBe('#7 of 40 · 9,100 PTS · Swept · 8/8 · 6m');
  });

  it('BB3/BB4: the Leaderboard picker is the compact two-row grid with no ALL-TIME button', () => {
    const banner = read('components/leaderboard/leaderboard-banner.tsx');
    expect(banner).toContain('density="compact"');
    expect(banner).not.toContain('layout="strip"');
    expect(banner).not.toContain('href="/records"');
    expect(read('components/ui/game-picker.tsx')).toContain('maxSize={compact ? 32 : 44}');
  });
});

describe('AU3 the Gauntlet stage card', () => {
  it('stays up at least 5 s solo and fades out over the next stage', async () => {
    const src = read('components/gauntlet/stage-transition.tsx');
    expect(src).toMatch(/STAGE_HOLD_MS = (\d+)/);
    expect(Number(src.match(/STAGE_HOLD_MS = (\d+)/)![1])).toBeGreaterThanOrEqual(5000);
    // VS too (founder 10-02): same 5 s hold; the race clock keeps running.
    expect(Number(src.match(/STAGE_HOLD_VS_MS = (\d+)/)![1])).toBeGreaterThanOrEqual(5000);
    expect(read('components/gauntlet/gauntlet-game.tsx')).toContain('onAdvance={handleTransitionAdvance}');
    expect(read('app/globals.css')).toMatch(/@keyframes st-card-in \{[^\n]*transform[^\n]*\}/);
  });
});

describe('AU1 the win / lose popup', () => {
  it('centers host + card as one group in the safe area', () => {
    const src = read('components/effects/result-popup.tsx');
    expect(src).toContain('marginTop: HOST_OVERHANG');
    expect(src).toContain('env(safe-area-inset-top)');
  });
});

describe('AX bigger game-page header buttons', () => {
  it('draws home, sound and ? at ~30 px inside unchanged 44 px tap targets (with the squish)', () => {
    const header = read('components/ui/page-header.tsx');
    expect(Number(header.match(/GAME_HEADER_GLYPH = (\d+)/)![1])).toBe(30);
    expect(Number(header.match(/GAME_HEADER_TAP = (\d+)/)![1])).toBeGreaterThanOrEqual(44);
    for (const f of ['components/game/game-home-button.tsx', 'components/game/game-guide-button.tsx', 'components/game/sound-toggle.tsx']) {
      const src = read(f);
      expect(src, f).toContain('size={GAME_HEADER_GLYPH}');
      expect(src, f).toContain('hdr-glyph w-11 h-11');
    }
  });
});

describe('BB Stats picker polish', () => {
  it('BB1 shows the selected game title art (~48 px) with a live-lettering fallback in the game accent', () => {
    const src = read('components/stats/stats-picker.tsx');
    expect(src).toContain('maxHeight={48}');
    expect(src).toMatch(/<LiveHeadline[^>]*accent=/);
    expect(src).toContain('className="intro-pop');
  });
  it('BB2 is a candy segmented control with a sliding (transform-only) accent thumb, 36–40 px', () => {
    const src = read('components/ui/candy-segment.tsx');
    expect(src).toContain('transform: `translateX(');
    expect(src).toMatch(/height = (3[6-9]|40)/);
    // BJ1 (founder 10-03): the Stats picker no longer carries the Today | All-time toggle.
    expect(read('components/stats/stats-picker.tsx')).not.toContain('<CandySegment');
  });
});

describe('Stats never jumps back to the picker (founder 10-02)', () => {
  it('a diagonal scroll is not a page swipe; a clear sideways swipe is', async () => {
    const { isPageSwipe } = await import('./stats-view');
    expect(isPageSwipe(80, 45)).toBe(false);   // passed the old |dy| ≤ 50 rule
    expect(isPageSwipe(-120, 30)).toBe(true);
    expect(isPageSwipe(60, 0)).toBe(false);
  });
  it('the picker and its title never scroll the page', () => {
    for (const f of ['components/ui/game-picker.tsx', 'components/stats/stats-picker.tsx', 'components/ui/candy-segment.tsx', 'components/ui/live-headline.tsx']) {
      expect(read(f), f).not.toMatch(/scrollIntoView|\.focus\(|window\.scroll/);
    }
    expect(read('app/stats/page.tsx')).toContain('if (!isPageSwipe(dx, dy)) return;');
  });
});
