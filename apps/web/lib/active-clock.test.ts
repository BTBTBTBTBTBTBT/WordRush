import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RUNNING, activeMs, pauseAt, resumeAt } from './active-clock';

// Founder 10-02: VS Gauntlet matches solo — the race clock pauses during the
// player's own stage card, so recorded race + stage times exclude it.

describe('VS Gauntlet active clock', () => {
  it('excludes every stage-card pause from the race time', () => {
    const start = 1_000;
    let l = RUNNING;
    l = pauseAt(l, start + 30_000);          // stage 1 cleared at 30 s → card up
    expect(activeMs(start, l, start + 33_000)).toBe(30_000); // frozen while the card shows
    l = resumeAt(l, start + 35_000);         // card held 5 s
    l = pauseAt(l, start + 75_000);          // stage 2 cleared 40 s of play later
    l = resumeAt(l, start + 76_000);         // tapped to skip after 1 s
    expect(activeMs(start, l, start + 96_000)).toBe(30_000 + 40_000 + 20_000);
  });

  it('pause / resume are idempotent and never go negative', () => {
    const l = pauseAt(pauseAt(RUNNING, 10), 50);
    expect(l.pausedAt).toBe(10);
    expect(resumeAt(RUNNING, 99)).toBe(RUNNING);
    expect(activeMs(100, RUNNING, 50)).toBe(0);
  });

  it('holds the card 5 s in VS like solo, and the VS game times with the active clock', () => {
    const card = fs.readFileSync(path.join(__dirname, '..', 'components', 'gauntlet', 'stage-transition.tsx'), 'utf8');
    const hold = Number(card.match(/STAGE_HOLD_MS = (\d+)/)![1]);
    const vs = Number(card.match(/STAGE_HOLD_VS_MS = (\d+)/)![1]);
    expect(vs).toBe(hold);
    expect(vs).toBeGreaterThanOrEqual(5000);
    const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'vs', 'vs-gauntlet.tsx'), 'utf8');
    expect(src).not.toContain('Date.now() - startTime');
    expect(src).toContain("dispatch({ type: 'NEXT_STAGE', elapsedMs: activeElapsedMs() })");
    expect(src).toMatch(/showTransition \? pauseAt\(/);
  });
});
