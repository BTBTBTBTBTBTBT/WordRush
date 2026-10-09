// The moment shares (FRIDAY-QUEUE item 46): level-up, a pocket-game result and the streak calendar: three cards that had
// no share on any platform. Pure builders over ShareMomentInput (drawn by share-image.ts drawMomentCard, with the sender's
// hero band above); the buttons call shareResult(build...(...)). Lines are always complete sentences, never cut.

import type { ShareMomentInput } from './share-image';

const PURPLE = '#7c3aed';
const GOLD = '#f59e0b';

/** "LEVEL UP!": the new level, its tier and what it takes to the next one. */
export function buildLevelUpShareInput(opts: { level: number; tierLabel: string; accentHex?: string; xpToNext?: number | null }): ShareMomentInput {
  const lines = [`${opts.tierLabel} tier`];
  if (opts.xpToNext && opts.xpToNext > 0) lines.push(`${opts.xpToNext.toLocaleString('en-US')} XP to level ${opts.level + 1}`);
  return {
    layout: 'moment', mode: 'Classic', kind: 'levelUp', title: 'LEVEL UP!', accentHex: opts.accentHex ?? PURPLE,
    big: String(opts.level), bigLabel: 'Level', lines,
  };
}

/** A finished pocket game: the title, the final score (sender first) and who it was against. */
export function buildPocketResultShareInput(opts: {
  gameTitle: string; won: boolean | null; mine: number | null; theirs: number | null; opponent: string; accentHex?: string;
}): ShareMomentInput {
  const score = opts.mine != null && opts.theirs != null ? `${opts.mine}–${opts.theirs}` : opts.won ? 'WIN' : opts.won === false ? 'LOSS' : 'DRAW';
  const verdict = opts.won === true ? `I beat ${opts.opponent}` : opts.won === false ? `Good game, ${opts.opponent}` : `A draw with ${opts.opponent}`;
  return {
    layout: 'moment', mode: 'Classic', kind: 'pocket', title: opts.gameTitle.toUpperCase(), accentHex: opts.accentHex ?? PURPLE,
    big: score, bigLabel: 'Final score', lines: [verdict, 'Play me on Wordocious'], won: opts.won ?? undefined,
  };
}

/** The streak calendar: the streak, the best, and the last seven days as dots (oldest first). */
export function buildStreakShareInput(opts: { streak: number; best: number; lastDays: boolean[]; accentHex?: string }): ShareMomentInput {
  const lines = [opts.streak === 1 ? 'One day down' : `${opts.streak} days in a row`];
  if (opts.best > 0) lines.push(opts.streak >= opts.best ? 'A new personal best' : `Best: ${opts.best} days`);
  return {
    layout: 'moment', mode: 'Classic', kind: 'streak', title: 'ON A STREAK', accentHex: opts.accentHex ?? GOLD,
    big: String(opts.streak), bigLabel: opts.streak === 1 ? 'Day streak' : 'Day streak', lines, dots: opts.lastDays.slice(-7),
  };
}
