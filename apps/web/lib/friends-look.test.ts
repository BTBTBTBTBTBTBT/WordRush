import { describe, expect, it } from 'vitest';
import {
  FR_LOOK, MEDAL, MOMENT_POSES, RACE_REST, RACE_YOU, frBar, frSurface, momentAccent, momentKey, momentPoses, numberRuns, podiumSlots,
  raceChipColor, rowStripe,
} from './friends-look';
import { POSE_ART_NAMES } from './art';
import { SOFT, softMix } from './soft-surface';

describe('frSurface (A1 on the light-only Friends page)', () => {
  it('mixes the accent over white, never the theme card base', () => {
    const s = frSurface(FR_LOOK.pink);
    expect(s.background).toBe(softMix(FR_LOOK.pink, SOFT.tint));
    expect(String(s.background)).not.toContain('var(');
    expect(s.border).toBe(`1.5px solid ${softMix(FR_LOOK.pink, SOFT.line)}`);
    expect(s.borderRadius).toBe(20);
    expect(s.boxShadow).toBe(FR_LOOK.shadow);
  });

  it('takes a share, radius, and drops the shadow / border on request', () => {
    const s = frSurface('#7c3aed', { share: 0.24, radius: 12, shadow: false, border: false });
    expect(s.background).toBe(softMix('#7c3aed', 0.24));
    expect(s.borderRadius).toBe(12);
    expect(s.boxShadow).toBeUndefined();
    expect(s.border).toBeUndefined();
  });

  it('draws a 10 px top bar by default', () => {
    expect(frBar(FR_LOOK.goldBar)).toEqual({ height: 10, background: FR_LOOK.goldBar, flex: 'none' });
    expect(frBar('#f97316', 7).height).toBe(7);
  });
});

describe('rowStripe', () => {
  it('stripes every other row', () => {
    expect(rowStripe(0)).toBeUndefined();
    expect(rowStripe(1)).toBe('#ffffff73');
    expect(rowStripe(2)).toBeUndefined();
    expect(rowStripe(3)).toBe('#ffffff73');
  });
});

describe('raceChipColor', () => {
  it('gives the top three medal colors once the race has points', () => {
    expect(raceChipColor({ rank: 1, points: 7891, me: false }, true)).toBe(MEDAL.gold);
    expect(raceChipColor({ rank: 2, points: 2000, me: false }, true)).toBe(MEDAL.silver);
    expect(raceChipColor({ rank: 3, points: 10, me: true }, true)).toBe(MEDAL.bronze);
  });

  it('keeps medals off rows without points and before the race starts', () => {
    expect(raceChipColor({ rank: 2, points: 0, me: false }, true)).toBe(RACE_REST);
    expect(raceChipColor({ rank: 1, points: 0, me: true }, false)).toBe(RACE_YOU);
    expect(raceChipColor({ rank: 1, points: 0, me: false }, false)).toBe(RACE_REST);
  });

  it('marks you purple off the podium', () => {
    expect(raceChipColor({ rank: 5, points: 0, me: true }, true)).toBe(RACE_YOU);
    expect(raceChipColor({ rank: 4, points: 120, me: false }, true)).toBe(RACE_REST);
  });
});

describe('podiumSlots', () => {
  it('lays out 2nd, 1st, 3rd with first place centered and tallest', () => {
    const s = podiumSlots(5);
    expect(s.map((x) => x.place)).toEqual([2, 1, 3]);
    expect(s.map((x) => x.index)).toEqual([1, 0, 2]);
    expect(s.map((x) => x.column)).toEqual([1, 2, 3]);
    const first = s.find((x) => x.place === 1)!;
    expect(first.step).toBeGreaterThan(s.find((x) => x.place === 2)!.step);
    expect(s.find((x) => x.place === 2)!.step).toBeGreaterThan(s.find((x) => x.place === 3)!.step);
    expect(first.avatar).toBeGreaterThan(s.find((x) => x.place === 3)!.avatar);
    expect(first.to).toBe(MEDAL.gold);
  });

  it('only draws the places that exist, keeping their columns', () => {
    expect(podiumSlots(2).map((x) => [x.place, x.column])).toEqual([[2, 1], [1, 2]]);
    expect(podiumSlots(1).map((x) => [x.place, x.column])).toEqual([[1, 2]]);
    expect(podiumSlots(0)).toEqual([]);
    expect(podiumSlots(-3)).toEqual([]);
  });
});

describe('K1 moment notices', () => {
  it('keys medals and pocket-game results', () => {
    expect(momentKey({ type: 'medal', kind: 'gold', me: false }, 'me')).toBe('medal-gold');
    expect(momentKey({ type: 'medal', kind: 'streak_30', me: false }, 'me')).toBe('medal-streak');
    expect(momentKey({ type: 'medal', kind: 'odd', me: false }, 'me')).toBe('medal');
    expect(momentKey({ type: 'game', kind: 'draw', me: true }, 'me')).toBe('game-draw');
    expect(momentKey({ type: 'game', kind: 'win', me: true }, 'me')).toBe('game-win');
    expect(momentKey({ type: 'game', kind: 'win', me: false, otherId: 'me' }, 'me')).toBe('game-beat-you');
    expect(momentKey({ type: 'game', kind: 'win', me: false, otherId: 'x' }, 'me')).toBe('game');
    expect(momentKey({ type: 'game', kind: 'win', me: false, otherId: null }, null)).toBe('game');
    expect(momentKey({ type: 'sweep', me: false }, 'me')).toBe('sweep');
  });

  it('colors each notice, pocket games in their own accent', () => {
    expect(momentAccent('flawless')).toBe('#ec4899');
    expect(momentAccent('medal-gold')).toBe(MEDAL.gold);
    expect(momentAccent('game-win', '#059669')).toBe('#059669');
    expect(momentAccent('game-beat-you')).toBe('#db2777');
    expect(momentAccent('whatever')).toBe('#7c3aed');
  });

  it('only names poses that ship', () => {
    const shipped = new Set<string>(POSE_ART_NAMES);
    for (const list of Object.values(MOMENT_POSES)) for (const p of list) expect(shipped.has(p), p).toBe(true);
  });

  it('never repeats a pose on screen and honors the exclusions (A7)', () => {
    const keys = ['sweep', 'sweep', 'sweep', 'sweep', 'game-beat-you', 'medal-perfect', 'flawless'];
    const poses = momentPoses(keys, ['art-pose-o2-cheer']);
    expect(poses.slice(0, 3)).toEqual(['art-pose-s-trophy', 'art-pose-s-flex', 'art-pose-s-victory']);
    expect(poses[3]).toBeNull();
    expect(poses[4]).toBe('art-pose-o2-gasp');
    expect(poses[5]).toBe('art-pose-o2-strut');
    expect(poses[6]).toBe('art-pose-o2-twirl');
    const shown = poses.filter(Boolean);
    expect(new Set(shown).size).toBe(shown.length);
    expect(momentPoses(['unknown'])).toEqual(['art-pose-w-wave']);
  });

  it('splits headline numbers into soft-number runs', () => {
    expect(numberRuns('Oliver beat you · 2,005 vs 1,860')).toEqual([
      { text: 'Oliver beat you · ', num: false },
      { text: '2,005', num: true },
      { text: ' vs ', num: false },
      { text: '1,860', num: true },
    ]);
    expect(numberRuns('no numbers')).toEqual([{ text: 'no numbers', num: false }]);
    expect(numberRuns('30-day streak')).toEqual([{ text: '30', num: true }, { text: '-day streak', num: false }]);
    expect(numberRuns('')).toEqual([]);
  });
});
