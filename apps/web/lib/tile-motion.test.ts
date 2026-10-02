import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { REVEAL, tileLook } from './tile-motion';

// FINISH_SPEC B1 / B3.

describe('tile looks', () => {
  it('maps game states to the shared tile', () => {
    expect(tileLook('CORRECT', 'A')).toBe('correct');
    expect(tileLook('present', 'A')).toBe('present');
    expect(tileLook('ABSENT', 'A')).toBe('absent');
    expect(tileLook('HINT_USED', '')).toBe('gap');
    expect(tileLook('EMPTY', 'A')).toBe('typed');
    expect(tileLook('EMPTY', '')).toBe('empty');
    expect(tileLook(undefined, ' ')).toBe('empty');
  });

  it('has a stylesheet look for every state', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    for (const look of ['empty', 'typed', 'correct', 'present', 'absent', 'given', 'conflict', 'gap']) {
      expect(css, look).toContain(`.gtile[data-s="${look}"]`);
    }
  });
});

describe('reveal timing', () => {
  it('turns each tile over in 720 ms, 300 ms apart', () => {
    expect(REVEAL.flipMs).toBe(720);
    expect(REVEAL.stagger).toBe(300);
    expect(REVEAL.end(5)).toBe(4 * 300 + 720);
    expect(REVEAL.end(1)).toBe(720);
    expect(REVEAL.end(0)).toBe(720);
  });

  it('hops 560 ms, 90 ms apart', () => {
    expect(REVEAL.hopMs).toBe(560);
    expect(REVEAL.hopStagger).toBe(90);
  });

  it('holds a not-a-word reject ~1 s in red, then clears right to left 90 ms apart (iOS parity)', () => {
    expect(REVEAL.badMs).toBe(1000);
    expect(REVEAL.outStart).toBe(1000);
    expect(REVEAL.outStagger).toBe(90);
    // The games block input until the last (leftmost) letter is gone.
    expect(REVEAL.rejectMs(5)).toBe(1000 + 4 * 90 + 220);
    expect(REVEAL.rejectMs(7)).toBe(1000 + 6 * 90 + 220);
    expect(REVEAL.rejectMs(0)).toBe(1220);
  });
});
