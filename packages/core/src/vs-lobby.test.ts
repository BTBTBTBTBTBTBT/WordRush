import { describe, expect, it } from 'vitest';
import { challengeHeadline, ladderAfterGame, ladderRungs, vsBannerClockLine, vsBannerHeadline, vsMargin, vsOutcome, vsRecordLine, vsTodayStatus, type VsBannerInput } from './vs-lobby';

const base: VsBannerInput = { name: 'BT', battle: 'open', botOfDay: 'open', incomingFrom: null, streak: 0 };

describe('VS banner', () => {
  it('headline ladder', () => {
    expect(vsBannerHeadline(base)).toBe('READY TO RACE, BT?');
    expect(vsBannerHeadline({ ...base, name: '' })).toBe('READY TO RACE?');
    expect(vsBannerHeadline({ ...base, incomingFrom: 'doug', battle: 'won', botOfDay: 'won' })).toBe('DOUG CHALLENGED YOU!');
    expect(vsBannerHeadline({ ...base, battle: 'won', botOfDay: 'won', streak: 6 })).toBe('VS SWEEP!');
    expect(vsBannerHeadline({ ...base, battle: 'won', streak: 3 })).toBe('ON A ROLL · 3 WINS IN A ROW');
    expect(vsBannerHeadline({ ...base, battle: 'won' })).toBe('DAILY BATTLE WON!');
    expect(vsBannerHeadline({ ...base, botOfDay: 'won', battle: 'lost' })).toBe('BOT OF THE DAY BEATEN!');
    expect(vsBannerHeadline({ ...base, battle: 'lost' })).toBe('BACK FOR MORE?');
  });
  it('clock line and status', () => {
    expect(vsBannerClockLine(base, '07:12:40')).toBe('DAILY BATTLE + BOT OF THE DAY · RESET IN 07:12:40');
    expect(vsBannerClockLine(base, '07:12:40', { free: true })).toBe('TWO FREE BATTLES A DAY · RESET IN 07:12:40');
    expect(vsBannerClockLine({ ...base, battle: 'won' }, '04:05:12')).toBe('RESETS IN 04:05:12');
    expect(vsBannerClockLine({ ...base, battle: 'won', botOfDay: 'lost' }, '02:10:05')).toBe('NEW BATTLES IN 02:10:05');
    expect(vsBannerClockLine({ ...base, incomingFrom: 'doug' }, 'x', { challengeLeft: '17H' })).toBe('RACE DOUG’S RUN · 17H LEFT');
    expect(vsTodayStatus(base)).toBe('0/2');
    expect(vsTodayStatus({ battle: 'won', botOfDay: 'lost' })).toBe('2/2');
    expect(vsTodayStatus({ battle: 'won', botOfDay: 'won' })).toBe('SWEEP · 2/2 WON');
  });
  it('record line matches the Stats buckets', () => {
    expect(vsRecordLine({ wins: 12, losses: 7 }, { wins: 31, losses: 9 }, 2)).toBe('PEOPLE 12–7 · BOTS 31–9 · LADDER 2/10');
    expect(vsRecordLine({ wins: 0, losses: 0 }, { wins: 4, losses: 2 }, null)).toBe('PEOPLE 0–0 · BOTS 4–2');
    expect(vsRecordLine({ wins: 1, losses: 0 }, { wins: 1, losses: 0 }, 10)).toBe('PEOPLE 1–0 · BOTS 1–0 · LADDER CLEARED');
  });
});

describe('challenge outcome', () => {
  const r = (solved: boolean, boardsSolved: number, guesses: number, timeMs: number) => ({ solved, boardsSolved, guesses, timeMs });
  it('mirrors the live server rule', () => {
    expect(vsOutcome(r(true, 1, 3, 100000), r(true, 1, 4, 112000))).toBe('win');
    expect(vsOutcome(r(true, 1, 4, 30000), r(true, 1, 3, 120000))).toBe('win'); // 90 s faster beats one guess
    expect(vsOutcome(r(false, 0, 6, 60000), r(true, 1, 6, 300000))).toBe('loss');
    expect(vsOutcome(r(true, 1, 4, 60000), r(true, 1, 4, 60000))).toBe('draw');
    expect(vsOutcome(r(false, 3, 9, 1), r(false, 2, 9, 1))).toBe('win');
    expect(vsOutcome(r(false, 2, 9, 1), r(false, 2, 9, 900))).toBe('draw');
  });
  it('margin and headline', () => {
    expect(vsMargin(r(true, 1, 3, 100000), r(true, 1, 3, 112000))).toBe('FASTER BY 0:12');
    expect(vsMargin(r(true, 1, 3, 100000), r(true, 1, 4, 90000))).toBe('1 FEWER GUESS');
    expect(vsMargin(r(true, 1, 5, 100000), r(true, 1, 3, 90000))).toBe('2 FEWER GUESSES');
    expect(vsMargin(r(false, 0, 6, 1), r(true, 1, 6, 1))).toBe('ONLY ONE SOLVE');
    expect(vsMargin(r(true, 1, 4, 1000), r(true, 1, 4, 1000))).toBe('DEAD EVEN');
    expect(challengeHeadline('win', 'doug')).toBe('YOU BEAT DOUG’S RUN!');
    expect(challengeHeadline('loss', 'doug')).toBe('DOUG’S RUN HELD!');
    expect(challengeHeadline('draw', 'doug')).toBe('DEAD HEAT WITH DOUG!');
  });
});

describe('bot ladder', () => {
  it('three in a row against the next bot clears its rung', () => {
    let s = { cleared: 0, run: 0 };
    s = ladderAfterGame(s, 'rip', true);
    s = ladderAfterGame(s, 'dewey', false); // other bots don't touch it
    s = ladderAfterGame(s, 'rip', true);
    expect(s).toEqual({ cleared: 0, run: 2 });
    s = ladderAfterGame(s, 'rip', true);
    expect(s).toEqual({ cleared: 1, run: 0 });
    s = ladderAfterGame(s, 'ivy', true);
    s = ladderAfterGame(s, 'ivy', false);
    expect(s).toEqual({ cleared: 1, run: 0 });
    expect(ladderAfterGame({ cleared: 10, run: 0 }, 'webster', true)).toEqual({ cleared: 10, run: 0 });
  });
  it('old ids count as their cast replacement', () => {
    // rook → ivy (rung 2)
    expect(ladderAfterGame({ cleared: 1, run: 0 }, 'rook', true)).toEqual({ cleared: 1, run: 1 });
    expect(ladderAfterGame({ cleared: 5, run: 2 }, 'adapt', true)).toEqual({ cleared: 6, run: 0 });
  });
  it('rung lines', () => {
    const rungs = ladderRungs({ cleared: 2, run: 1 });
    expect(rungs).toHaveLength(10);
    expect(rungs.slice(0, 4).map((x) => [x.id, x.state, x.line])).toEqual([
      ['rip', 'cleared', 'Cleared'], ['ivy', 'cleared', 'Cleared'], ['ollie', 'next', 'Win 3 in a row to clear · 1 so far'], ['opal', 'locked', 'Clear Ollie to unlock'],
    ]);
    expect(rungs[9]).toEqual({ id: 'webster', state: 'locked', line: 'Clear Scoot to unlock' });
  });
});
