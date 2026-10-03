import { describe, it, expect } from 'vitest';
import {
  mergeQuizState, parseQuizHistory, pruneQuizHistory, quizHistKey, recordQuizAnswer, type QuizHistory,
} from './wotd-quiz-history';

// FINISH_SPEC BI17 §3: Word of the Day quiz answers survive a database outage.

const local: QuizHistory = {
  '2026-10-01': { picked: 0, correct: true, word: 'CRANE' },
  '2026-10-02': { picked: 1, correct: true, word: 'SLATE' },
  '2026-10-03': { picked: 2, correct: true, word: 'PLANT' },
};

describe('mergeQuizState', () => {
  it('uses the device history alone when the server read failed', () => {
    const s = mergeQuizState(null, local, '2026-10-03');
    expect(s.today).toEqual({ picked: 2, correct: true });
    expect(s.streak).toBe(3);
    expect(s.localOnly).toEqual([]);
  });

  it('lets server rows win per day and fills gaps from the device', () => {
    const rows = [
      { day: '2026-10-01', picked: 1, correct: false },
      { day: '2026-10-02', picked: 1, correct: true },
    ];
    const s = mergeQuizState(rows, local, '2026-10-03');
    expect(s.days['2026-10-01']).toEqual({ played: 1, won: 0 });
    expect(s.today).toEqual({ picked: 2, correct: true });
    expect(s.streak).toBe(2);
    expect(s.localOnly).toEqual(['2026-10-03']);
  });

  it('answers nothing for today when neither side has it', () => {
    const s = mergeQuizState([], {}, '2026-10-03');
    expect(s.today).toBeNull();
    expect(s.streak).toBe(0);
  });
});

describe('device history', () => {
  it('keys per player, guests included', () => {
    expect(quizHistKey('u1')).toBe('wordocious-wotd-quiz-hist-u1');
    expect(quizHistKey(null)).toBe('wordocious-wotd-quiz-hist-guest');
  });

  it('keeps the first answer of a day and prunes old days', () => {
    const h = recordQuizAnswer(local, '2026-10-03', 'PLANT', { picked: 0, correct: false });
    expect(h['2026-10-03'].picked).toBe(2);
    expect(Object.keys(pruneQuizHistory(h, '2026-10-02'))).toEqual(['2026-10-02', '2026-10-03']);
  });

  it('drops malformed storage', () => {
    expect(parseQuizHistory('not json')).toEqual({});
    expect(parseQuizHistory('[1,2]')).toEqual({});
    expect(parseQuizHistory(JSON.stringify({ bad: { picked: 1 }, '2026-10-01': { picked: 'x' }, '2026-10-02': { picked: 1, correct: 1, word: 'SLATE' } })))
      .toEqual({ '2026-10-02': { picked: 1, correct: true, word: 'SLATE' } });
  });
});
