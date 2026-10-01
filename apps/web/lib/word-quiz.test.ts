import { describe, expect, it } from 'vitest';
import { wordOfDay, dictEntry } from './word-of-day';
import { wordQuizFor, isMeaning } from './word-quiz';
import { rankSenses } from './sense-rank';

describe('word of the day quiz', () => {
  it('is the same every time for a date, with the real meaning at the answer index', async () => {
    for (let i = 0; i < 40; i++) {
      const d = new Date(2026, 9, 1 + i);
      const e = await wordOfDay(d);
      const q = wordQuizFor(d, e.word);
      if (!q) continue;
      expect(wordQuizFor(d, e.word)).toEqual(q);
      expect(q.choices).toHaveLength(3);
      expect(new Set(q.choices.map((c) => c.toLowerCase())).size).toBe(3);
      const own = dictEntry(e.word);
      const meanings = own ? rankSenses(e.word, own.senses).map((s) => s.def.trim()) : [];
      if (meanings.some(isMeaning)) expect(meanings).toContain(q.choices[q.answer]);
      q.choices.forEach((c, j) => {
        expect(isMeaning(c)).toBe(true);
        if (j !== q.answer) expect(c.toLowerCase()).not.toContain(e.word.toLowerCase());
      });
    }
  });

  it('almost every day has a quiz (only words with no usable meaning fall back)', async () => {
    let quizzes = 0;
    for (let i = 0; i < 120; i++) {
      const d = new Date(2026, 9, 1 + i);
      if (wordQuizFor(d, (await wordOfDay(d)).word)) quizzes++;
    }
    expect(quizzes).toBeGreaterThanOrEqual(110);
  });

  it('never uses a grammar note as a choice', () => {
    expect(isMeaning('simple past and past participle of fling')).toBe(false);
    expect(isMeaning('plural of vibe')).toBe(false);
    expect(isMeaning('A small, rounded hill or mound.')).toBe(true);
  });
});
