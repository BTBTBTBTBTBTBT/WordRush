import { describe, expect, it } from 'vitest';
import { PUSH_COPY, pushCopy } from './push-copy';

describe('push copy (FINISH_SPEC AE)', () => {
  it('fills the cast-voice templates', () => {
    expect(pushCopy('friendBeat', { name: 'Oliver', game: 'QuadWord' })).toBe('Oliver just beat your QuadWord time ⚡ Your move!');
    expect(pushCopy('streakReminder', { days: 12 })).toBe('Your 🔥 12-day streak misses you! One quick game?');
    expect(pushCopy('challengeReceived', { name: 'Doug', game: 'Classic' })).toBe('Doug challenged you to Classic ⚔️');
    expect(pushCopy('friendRequest', {})).toBe('A friend wants to be friends! 🎉');
    expect(pushCopy('dailyReady')).toBe("Today's puzzles are fresh 🌅");
  });
  it('is short and free of em dashes', () => {
    for (const t of Object.values(PUSH_COPY)) {
      expect(t).not.toMatch(/—/);
      expect(t.length).toBeLessThan(70);
    }
  });
});
