import { describe, expect, it } from 'vitest';
import { CAST } from './mascots';
import { CAST_MOVES, CAST_MOVE_GAP, MASCOT_ART_SIZE, MASCOT_TRIM, castAspect, castTrimLayout, nextCastDelay, pickCastMove } from './cast-moves';

// FINISH_SPEC A5: every 2.6–5 s ONE random character (never the same twice in a row) plays its move.

describe('cast move picker', () => {
  it('has a move for every character with the approved timings', () => {
    expect(Object.keys(CAST_MOVES).sort()).toEqual([...CAST].sort());
    expect(CAST_MOVES.o1.ms).toBe(900);
    expect(CAST_MOVES.w.ms).toBe(700);
    expect(CAST_MOVES.r.ms).toBe(1600);
    expect(CAST_MOVES.d.ms).toBe(760);
    expect(CAST_MOVES.o2.ms).toBe(820);
    expect(CAST_MOVES.c.ms).toBe(1200);
    expect(CAST_MOVES.i.ms).toBe(900);
    expect(CAST_MOVES.o3.ms).toBe(760);
    expect(CAST_MOVES.u.ms).toBe(1800);
    expect(CAST_MOVES.s.ms).toBe(700);
  });

  it('never picks the same character twice in a row', () => {
    let last = pickCastMove(null, () => 0);
    for (let i = 0; i < 500; i++) {
      const next = pickCastMove(last);
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it('covers the whole cast and stays in range at the extremes', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(pickCastMove(null));
    expect(seen.size).toBe(CAST.length);
    expect(pickCastMove('w', () => 0)).toBe('o1');
    expect(CAST).toContain(pickCastMove('w', () => 0.999999));
    expect(pickCastMove('s', () => 1)).not.toBe('s');
  });

  it('waits 2.6–5 s between moves', () => {
    expect(nextCastDelay(() => 0)).toBe(CAST_MOVE_GAP.min);
    expect(nextCastDelay(() => 1)).toBe(CAST_MOVE_GAP.max);
    expect(CAST_MOVE_GAP).toEqual({ min: 2600, max: 5000 });
    for (let i = 0; i < 100; i++) {
      const d = nextCastDelay();
      expect(d).toBeGreaterThanOrEqual(2600);
      expect(d).toBeLessThanOrEqual(5000);
    }
  });
});

describe('cast trims', () => {
  it('keeps every art box inside the 512 px square', () => {
    for (const id of CAST) {
      const [x0, y0, x1, y1] = MASCOT_TRIM[id];
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(MASCOT_ART_SIZE);
      expect(y1).toBeLessThanOrEqual(MASCOT_ART_SIZE);
      expect(x1).toBeGreaterThan(x0);
      expect(y1).toBeGreaterThan(y0);
    }
  });

  it('matches the mockup row flex (aspect ratios)', () => {
    expect(castAspect('w')).toBeCloseTo(1.09, 2);
    expect(castAspect('i')).toBeCloseTo(0.47, 2);
  });

  it('lays the square art so only its box shows', () => {
    expect(castTrimLayout('i')).toEqual({ width: '230.631%', left: '-65.315%', top: '-4.459%' });
  });
});
