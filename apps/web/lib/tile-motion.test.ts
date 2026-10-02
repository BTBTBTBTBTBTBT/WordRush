import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { REVEAL, keyDuringReject, tileLook } from './tile-motion';

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

describe('reveal timing (AQ1: ~30% tighter)', () => {
  it('turns each tile over in ≤ 220 ms, ≤ 70 ms apart', () => {
    expect(REVEAL.flipMs).toBeLessThanOrEqual(220);
    expect(REVEAL.stagger).toBeLessThanOrEqual(70);
    expect(REVEAL.flipMs).toBe(220);
    expect(REVEAL.stagger).toBe(70);
    expect(REVEAL.end(5)).toBe(4 * 70 + 220);
    expect(REVEAL.end(1)).toBe(220);
    expect(REVEAL.end(0)).toBe(220);
  });

  it('lands tile i at i × stagger + flip, the last one at the row end', () => {
    expect(REVEAL.landMs(0)).toBe(220);
    expect(REVEAL.landMs(2)).toBe(2 * 70 + 220);
    expect(REVEAL.landMs(4)).toBe(REVEAL.end(5));
    expect(REVEAL.landMs(-1)).toBe(220);
  });

  it('keeps a whole five-letter row + win hop wave under the 1.2 s finish hold', () => {
    const hopWaveEnd = REVEAL.end(5) + 4 * REVEAL.hopStagger + REVEAL.hopMs;
    expect(hopWaveEnd).toBeLessThanOrEqual(1200);
    expect(REVEAL.hopMs).toBeLessThan(560);
    expect(REVEAL.hopStagger).toBeLessThan(90);
  });

  it('holds a not-a-word reject ~0.7 s in red, then clears right to left 60 ms apart', () => {
    expect(REVEAL.badMs).toBe(700);
    expect(REVEAL.outStart).toBe(700);
    expect(REVEAL.outStagger).toBe(60);
    expect(REVEAL.rejectMs(5)).toBe(700 + 4 * 60 + 160);
    expect(REVEAL.rejectMs(7)).toBe(700 + 6 * 60 + 160);
    expect(REVEAL.rejectMs(0)).toBe(860);
  });

  it('lets letters typed during a reject start the fresh row; Enter / Delete only cut it short', () => {
    expect(keyDuringReject('A')).toBe('type');
    expect(keyDuringReject('Z')).toBe('type');
    expect(keyDuringReject('ENTER')).toBe('swallow');
    expect(keyDuringReject('BACK')).toBe('swallow');
    expect(keyDuringReject('BACKSPACE')).toBe('swallow');
  });

  it('keeps the globals.css keyframes in step with REVEAL', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    expect(css).toContain(`.gt-flip { animation: gt-flip ${REVEAL.flipMs}ms`);
    expect(css).toContain(`animation: gt-cover ${REVEAL.flipMs}ms`);
    expect(css).toContain(`gt-glow ${REVEAL.bloomMs}ms ease-out calc(var(--gt-d, 0ms) + ${REVEAL.flipMs}ms)`);
    expect(css).toContain(`.gt-hop { animation: gt-hop ${REVEAL.hopMs}ms`);
    expect(css).toContain(`.gt-sink { animation: gt-sink ${REVEAL.sinkMs}ms`);
    expect(css).toContain(`.gt-nudge { animation: gt-nudge ${REVEAL.nudgeMs}ms`);
    expect(css).toContain(`gt-outb ${REVEAL.outMs}ms`);
    expect(css).not.toMatch(/gt-flip 720ms/);
  });

  it('flips on the GPU only (AU4): transform + opacity keyframes, no animated box-shadow or layout', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    const frames = (name: string) => css.match(new RegExp(`@keyframes ${name} \\{([^\\n]*)\\}`))?.[1] ?? '';
    for (const name of ['gt-flip', 'gt-glow', 'gt-cover']) {
      const f = frames(name);
      expect(f, name).not.toBe('');
      expect(f, name).not.toMatch(/box-shadow|width|height|top|left|margin|padding/);
    }
    expect(css).toMatch(/\.gt-flip \{ will-change: transform; backface-visibility: hidden;/);
    expect(css).not.toContain('gt-bloom');
  });
});

describe('games never block typing on a reject (AQ1)', () => {
  const games = [
    'practice/practice-game', 'quordle/quordle-game', 'octordle/octordle-game', 'rescue/rescue-game',
    'sequence/sequence-game', 'gauntlet/gauntlet-game', 'ladder/ladder-game',
    'vs/vs-classic', 'vs/vs-quadword', 'vs/vs-octoword', 'vs/vs-deliverance', 'vs/vs-succession', 'vs/vs-gauntlet',
  ];
  it.each(games)('%s cuts a reject short instead of returning early', (g) => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'components', `${g}.tsx`), 'utf8');
    expect(src).toContain('useRejectRow(');
    expect(src).not.toMatch(/if \((isShaking|shaking)\) return;/);
    expect(src).not.toContain('REVEAL.rejectMs');
  });
});
