import { describe, expect, it } from 'vitest';
import { headlineTokens } from './headline-tokens';

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
