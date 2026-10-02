import { describe, it, expect } from 'vitest';
import { BOT_CAST, BOT_CAST_IDS, botCastMember, botOfTheDay, botSolveLine, canonicalBotId, migrateLegacyLadderCleared } from './bot-cast';
import { LADDER_BOTS } from './vs-lobby';

describe('bot cast (FINISH_SPEC D1)', () => {
  it('is the ten-rung ladder in order', () => {
    expect(BOT_CAST_IDS).toEqual(['rip', 'ivy', 'ollie', 'opal', 'cosmo', 'umi', 'ozzy', 'dewey', 'scoot', 'webster']);
    expect(LADDER_BOTS).toEqual(BOT_CAST_IDS);
    expect(BOT_CAST.map((b) => b.castId)).toEqual(['r', 'i', 'o1', 'o2', 'c', 'u', 'o3', 'd', 's', 'w']);
    expect(BOT_CAST.map((b) => b.rung)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(BOT_CAST.map((b) => b.tier)).toEqual(['easy', 'easy', 'easy', 'medium', 'medium', 'adaptive', 'medium', 'hard', 'hard', 'hard']);
  });
  it('solve lines', () => {
    expect(BOT_CAST.map(botSolveLine)).toEqual([
      'Solves in 6', 'Solves in 5–6', 'Solves in 5', 'Solves in 4–5', 'Solves in 4–5', 'Matches your form',
      'Solves in 4–5', 'Solves in 3–4', 'Solves in 2–4', 'Solves in 2–3',
    ]);
  });
  it('maps the old ids by difficulty', () => {
    expect(['rook', 'lexi', 'nova', 'adapt'].map(canonicalBotId)).toEqual(['ivy', 'opal', 'dewey', 'umi']);
    expect(canonicalBotId('ghost')).toBe('ghost');
    expect(canonicalBotId('daily')).toBe('daily');
    expect(canonicalBotId('scoot')).toBe('scoot');
    expect(botCastMember('nova')?.name).toBe('Dewey');
    expect(botCastMember('ghost')).toBeNull();
  });
  it('migrates old ladder progress', () => {
    expect([0, 1, 2, 3, 4].map(migrateLegacyLadderCleared)).toEqual([0, 2, 4, 7, 10]);
    expect(migrateLegacyLadderCleared(-1)).toBe(0);
    expect(migrateLegacyLadderCleared(9)).toBe(10);
  });
  it('Bot of the Day rotates with the day host', () => {
    // 2026-10-04 is a Sunday.
    const week = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'];
    expect(week.map((d) => botOfTheDay(d).id)).toEqual(['ozzy', 'dewey', 'ivy', 'umi', 'scoot', 'opal', 'ollie']);
    expect(week.map((d) => botOfTheDay(d).castId)).toEqual(['o3', 'd', 'i', 'u', 's', 'o2', 'o1']);
  });
});
