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

describe('reveal timing (BI5: the pre-overhaul pacing)', () => {
  it('turns each single-board tile over in 500 ms, 150 ms apart (a 5-letter row ≈ 1.1 s)', () => {
    expect(REVEAL.flipMs).toBe(500);
    expect(REVEAL.stagger).toBe(150);
    expect(REVEAL.end(5)).toBe(1100);
    expect(REVEAL.end(1)).toBe(500);
    expect(REVEAL.end(0)).toBe(500);
  });

  it('turns each multi-board (mini) tile over in 300 ms, 80 ms apart', () => {
    expect(REVEAL.miniFlipMs).toBe(300);
    expect(REVEAL.miniStagger).toBe(80);
    expect(REVEAL.flipFor(true)).toBe(300);
    expect(REVEAL.staggerFor(true)).toBe(80);
    expect(REVEAL.flipFor()).toBe(500);
    expect(REVEAL.staggerFor()).toBe(150);
    expect(REVEAL.end(5, true)).toBe(4 * 80 + 300);
  });

  it('lands tile i at i × stagger + flip, the last one at the row end', () => {
    expect(REVEAL.landMs(0)).toBe(500);
    expect(REVEAL.landMs(2)).toBe(2 * 150 + 500);
    expect(REVEAL.landMs(4)).toBe(REVEAL.end(5));
    expect(REVEAL.landMs(-1)).toBe(500);
    expect(REVEAL.landMs(2, true)).toBe(2 * 80 + 300);
    expect(REVEAL.landMs(4, true)).toBe(REVEAL.end(5, true));
  });

  it('holds the finished board until the row (and a win hop wave) is done, then a 200 ms beat', () => {
    expect(REVEAL.hopWaveMs(5)).toBe(4 * REVEAL.hopStagger + REVEAL.hopMs);
    expect(REVEAL.finishHoldMs(5, true)).toBe(1100 + REVEAL.hopWaveMs(5) + 200);
    expect(REVEAL.finishHoldMs(5, false)).toBe(1100 + 200);
    expect(REVEAL.finishHoldMs(5, true, true)).toBe(REVEAL.end(5, true) + REVEAL.hopWaveMs(5) + 200);
    for (let tiles = 1; tiles <= 8; tiles++) {
      for (const mini of [false, true]) expect(REVEAL.finishHoldMs(tiles, false, mini)).toBeGreaterThanOrEqual(REVEAL.end(tiles, mini));
    }
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
    // The flip length is --gt-flip-ms (LetterTile sets the mini value), defaulting to REVEAL.flipMs.
    expect(css).toContain(`.gt-flip { animation: gt-flip var(--gt-flip-ms, ${REVEAL.flipMs}ms)`);
    expect(css).toContain(`animation: gt-cover var(--gt-flip-ms, ${REVEAL.flipMs}ms)`);
    expect(css).toContain(`gt-glow ${REVEAL.bloomMs}ms ease-out calc(var(--gt-d, 0ms) + var(--gt-flip-ms, ${REVEAL.flipMs}ms))`);
    expect(css).toContain(`.gt-flip.gt-hop { animation: gt-flip var(--gt-flip-ms, ${REVEAL.flipMs}ms)`);
    expect(css).toContain(`.gt-flip.gt-sink { animation: gt-flip var(--gt-flip-ms, ${REVEAL.flipMs}ms)`);
    expect(css).not.toMatch(/gt-flip 220ms/);
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
    // Smoothness pass: no permanent layer hints — the last row keeps .gt-flip until
    // the next guess, so a static will-change kept 3 GPU layers per tile alive.
    expect(css).not.toMatch(/\.gt-flip \{[^}]*(will-change|translateZ|backface-visibility)/);
    expect(css).not.toMatch(/\.gt-(glow|cover) \{[^}]*will-change/);
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
