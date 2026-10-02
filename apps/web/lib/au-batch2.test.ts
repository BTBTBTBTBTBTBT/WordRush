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

  it('keeps the day title ≤ 110 tall and the picker in one scrolling row', () => {
    expect(read('components/leaderboard/leaderboard-banner.tsx')).toContain('layout="strip"');
    expect(read('components/ui/game-picker.tsx')).toContain("overflow-x-auto");
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
