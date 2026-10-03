import { describe, expect, it } from 'vitest';
import { headlineTokens, headlineLayout, headlineWidthEm, headlineFontSize, HEADLINE_SIZING_LINE } from './headline-tokens';

describe('headlineTokens (FINISH_SPEC AR)', () => {
  it('splits numbers, names and the star separator', () => {
    expect(headlineTokens('WARMING UP · 3 DOWN')).toEqual([
      { kind: 'text', text: 'WARMING UP ' },
      { kind: 'star', text: '·' },
      { kind: 'text', text: ' ' },
      { kind: 'number', text: '3' },
      { kind: 'text', text: ' DOWN' },
    ]);
    expect(headlineTokens("OLIVER LEADS TODAY'S RACE", ['Oliver'])).toEqual([
      { kind: 'name', text: 'OLIVER' },
      { kind: 'text', text: " LEADS TODAY'S RACE" },
    ]);
  });

  it('reads ranks, scores, fractions, times, percents and ordinals as numbers', () => {
    const nums = (s: string) => headlineTokens(s).filter((t) => t.kind === 'number').map((t) => t.text);
    expect(nums("YOU'RE #3 TODAY")).toEqual(['#3']);
    expect(nums('6,976 POINTS')).toEqual(['6,976']);
    expect(nums('3/8 DONE IN 3:12')).toEqual(['3/8', '3:12']);
    expect(nums('TOP 85% · 3RD PLACE')).toEqual(['85%', '3RD']);
    expect(nums('STAGE 3 OF 5')).toEqual(['3', '5']);
  });

  it('leaves digits inside words alone', () => {
    expect(headlineTokens('COVID19 X2Y')).toEqual([{ kind: 'text', text: 'COVID19 X2Y' }]);
    expect(headlineTokens('3D ICONS')).toEqual([{ kind: 'text', text: '3D ICONS' }]);
  });

  it('matches names whole-word, case-insensitive, longest first; blank names ignored', () => {
    expect(headlineTokens('GO OLIVERA', ['oliver'])).toEqual([{ kind: 'text', text: 'GO OLIVERA' }]);
    expect(headlineTokens('BEAT ANN MARIE', ['Ann', 'Ann Marie', ' '])).toEqual([
      { kind: 'text', text: 'BEAT ' },
      { kind: 'name', text: 'ANN MARIE' },
    ]);
    expect(headlineTokens('OLIVER_22 IS UP 2', ['oliver_22'])).toEqual([
      { kind: 'name', text: 'OLIVER_22' },
      { kind: 'text', text: ' IS UP ' },
      { kind: 'number', text: '2' },
    ]);
  });

  it('never drops a character', () => {
    for (const s of ['', '·', 'A · B · C', 'DOUBLE SWEEP!', "BMT'S 48-DAY RUN"]) {
      expect(headlineTokens(s, ['bmt']).map((t) => t.text).join('')).toBe(s);
    }
  });
});


describe('BJ6 greeting layout (one line, else a stacked full-size name)', () => {
  // The narrowest supported phone (SE, 375 pt): card 343 − strip padding 24 − sparkles 34.
  const SE_WIDTH = 285;
  const size = headlineFontSize(SE_WIDTH);
  const maxEm = SE_WIDTH / size;

  it('fits the sizing line at the device size', () => {
    expect(headlineWidthEm(HEADLINE_SIZING_LINE) * size).toBeLessThanOrEqual(SE_WIDTH);
  });
  it('a short name stays on one line when it fits', () => {
    expect(headlineLayout('GOOD MORNING, BMT!', 'BMT', 40)).toEqual({ lines: ['GOOD MORNING, BMT!'], nameLines: [] });
  });
  it('a name that does not fit stacks under the greeting', () => {
    expect(headlineLayout('GOOD AFTERNOON, BMT!', 'BMT', maxEm)).toEqual({ lines: ['GOOD AFTERNOON,', 'BMT!'], nameLines: [1] });
  });
  it('breaks a long name at natural boundaries, never shrinking or truncating', () => {
    const l = headlineLayout('GOOD EVENING, MAXIMILLIAN_THE_GREAT!', 'Maximillian_The_Great', maxEm);
    expect(l.lines[0]).toBe('GOOD EVENING,');
    expect(l.lines.slice(1).join('')).toBe('MAXIMILLIAN_THE_GREAT!');
    for (const line of l.lines) expect(headlineWidthEm(line)).toBeLessThanOrEqual(maxEm);
  });
  it('walks every allowed length (3–20) of the widest letter on the narrowest phone', () => {
    for (let n = 3; n <= 20; n++) {
      for (const name of ['W'.repeat(n), 'M'.repeat(n), 'Ab1_'.repeat(5).slice(0, n), 'x '.repeat(10).slice(0, n).trim() || 'xyz']) {
        for (const greet of ['GOOD MORNING', 'GOOD AFTERNOON', 'GOOD EVENING', 'UP LATE']) {
          const text = `${greet}, ${name.toUpperCase()}${greet === 'UP LATE' ? '?' : '!'}`;
          const l = headlineLayout(text, name, maxEm);
          for (const line of l.lines) expect(headlineWidthEm(line)).toBeLessThanOrEqual(maxEm + 1e-9);
          // Nothing dropped: the lines rebuild the headline (spaces aside).
          expect(l.lines.join('').replace(/ /g, '')).toBe(text.replace(/ /g, ''));
        }
      }
    }
  });
});
