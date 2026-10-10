import { describe, expect, it } from 'vitest';
import {
  botsLine, formatFastest, friendsSinceLine, friendshipState, headToHeadLine, heroStats, highlightsLayout, pickerSplit,
  pocketLine, pocketRecords, pocketTileLine, profileActions, recordBar, sectionTitleColor, showGuessDistribution, winRatePct,
  proBenefitForReason, PRO_BENEFIT_ORDER, PRO_SCENES,
  type PocketGameRow,
} from './stats-profile';

describe('stats page rules', () => {
  it('splits 9 VS games 5 over 4', () => {
    const s = pickerSplit([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(s.top).toEqual([1, 2, 3, 4, 5]);
    expect(s.bottom).toEqual([6, 7, 8, 9]);
    expect(pickerSplit([1, 2, 3]).bottom).toEqual([]);
    expect(pickerSplit([1, 2, 3, 4, 5, 6]).top).toHaveLength(3);
  });

  it('builds the four hero stats', () => {
    const h = heroStats({ wins: 3, losses: 2, streak: 2, bestStreak: 4, fastestSeconds: 16 });
    expect(h.map((x) => x.value)).toEqual(['3–2', '60%', '2', '16s']);
    expect(h[2].sub).toBe('Best 4');
    expect(h[0].icon).toBe('crown');
    const none = heroStats({ wins: 0, losses: 0, streak: 0, bestStreak: 0, fastestSeconds: 0 });
    expect(none.map((x) => x.value)).toEqual(['0–0', '—', '0', '—']);
    expect(none[2].sub).toBeNull();
  });

  it('formats time and rate', () => {
    expect(formatFastest(65)).toBe('1m 5s');
    expect(formatFastest(120)).toBe('2m');
    expect(formatFastest(0)).toBe('—');
    expect(winRatePct(26, 17)).toBe(60);
    expect(winRatePct(0, 0)).toBe(0);
  });

  it('hides the guess chart until a win', () => {
    expect(showGuessDistribution([{ count: 0 }, { count: 0 }])).toBe(false);
    expect(showGuessDistribution([])).toBe(false);
    expect(showGuessDistribution([{ count: 0 }, { count: 2 }])).toBe(true);
  });

  it('draws the record bar and the bots line', () => {
    expect(recordBar(3, 1)).toEqual({ winFrac: 0.75, lossFrac: 0.25, empty: false });
    expect(recordBar(0, 0).empty).toBe(true);
    expect(botsLine(26, 17)).toBe('26–17 · 60%');
    expect(botsLine(0, 0)).toBe('Beat a bot to start');
  });
});

describe('pocket records', () => {
  const rows: PocketGameRow[] = [
    { kind: 'ghost', player_a: 'me', player_b: 'jo', status: 'done', winner: 'me' },
    { kind: 'ghost', player_a: 'jo', player_b: 'me', status: 'done', winner: 'jo' },
    { kind: 'ghost', player_a: 'me', player_b: 'jo', status: 'resigned', winner: 'me' },
    { kind: 'rps', player_a: 'me', player_b: 'al', status: 'done', winner: null },
    { kind: 'chain', player_a: 'me', player_b: 'al', status: 'done', winner: 'me', chainWords: 14 },
    { kind: 'chain', player_a: 'me', player_b: 'al', status: 'done', winner: 'me', chainWords: 9 },
    { kind: 'coin', player_a: 'me', player_b: 'al', status: 'active', winner: null },
    { kind: 'coin', player_a: 'me', player_b: 'al', status: 'expired', winner: null },
    { kind: 'ttt', player_a: 'x', player_b: 'y', status: 'done', winner: 'x' },
  ];
  const r = pocketRecords(rows, 'me');
  it('counts per game and per friend, finished games only', () => {
    expect(r.byKind.map((k) => k.kind)).toEqual(['rps', 'ttt', 'coin', 'pass', 'ghost', 'chain']);
    const ghost = r.byKind.find((k) => k.kind === 'ghost')!;
    expect([ghost.wins, ghost.losses, ghost.draws]).toEqual([2, 1, 0]);
    expect(pocketLine(ghost)).toBe('2–1');
    expect(r.byKind.find((k) => k.kind === 'rps')!.draws).toBe(1);
    expect(r.byKind.find((k) => k.kind === 'coin')!.wins).toBe(0);
    expect(r.byKind.find((k) => k.kind === 'ttt')!.wins).toBe(0);
    expect(r.total).toEqual({ wins: 4, losses: 1, draws: 1 });
    expect(r.byFriend.jo.total).toEqual({ wins: 2, losses: 1, draws: 0 });
    expect(r.byFriend.al.byKind.chain).toEqual({ wins: 2, losses: 0, draws: 0 });
  });
  it('shows the best chain on the Word Chain tile', () => {
    expect(pocketTileLine(r.byKind.find((k) => k.kind === 'chain')!)).toBe('2–0 · best 14');
    expect(pocketTileLine(r.byKind.find((k) => k.kind === 'pass')!)).toBe('No games yet');
    expect(pocketLine({ wins: 1, losses: 1, draws: 2 })).toBe('1–1–2');
  });
});

describe('player profile rules', () => {
  it('picks the action row by friendship', () => {
    const a = (o: Partial<Parameters<typeof friendshipState>[0]>) =>
      profileActions(friendshipState({ isSelf: false, isFriend: false, incoming: false, requested: false, ...o }));
    expect(a({ isFriend: true })).toEqual({ row: ['challenge', 'pocket', 'react'], menu: ['unfriend', 'block', 'report'] });
    expect(a({})).toEqual({ row: ['addFriend'], menu: ['block', 'report'] });
    expect(a({ requested: true }).row).toEqual(['requested']);
    expect(a({ incoming: true }).row).toEqual(['accept', 'decline']);
    expect(a({ isSelf: true })).toEqual({ row: [], menu: [] });
  });
  it('words the friendship date', () => {
    expect(friendsSinceLine('2026-09-14T12:00:00Z')).toBe('Friends since Sep 2026');
    expect(friendsSinceLine(null)).toBeNull();
    expect(friendsSinceLine('nope')).toBeNull();
  });
  it('keeps highlights symmetric', () => {
    expect(highlightsLayout(0)).toEqual({ mode: 'fold', shown: 0 });
    expect(highlightsLayout(1)).toEqual({ mode: 'fold', shown: 1 });
    expect(highlightsLayout(3)).toEqual({ mode: 'grid', shown: 2 });
    expect(highlightsLayout(6)).toEqual({ mode: 'grid', shown: 4 });
    expect(highlightsLayout(2)).toEqual({ mode: 'grid', shown: 2 });
  });
  it('words the head-to-head line', () => {
    expect(headToHeadLine({ wins: 3, losses: 1, draws: 0 }, { wins: 2, losses: 2, draws: 0 })).toBe('Daily scores 3–1 · Pocket games 2–2');
    expect(headToHeadLine({ wins: 0, losses: 0, draws: 0 }, { wins: 1, losses: 0, draws: 0 })).toBe('Pocket games 1–0');
    expect(headToHeadLine({ wins: 0, losses: 0, draws: 0 }, { wins: 0, losses: 0, draws: 0 })).toBe('No games together yet');
  });
  it('colors section titles from the cast', () => {
    expect(sectionTitleColor('Head to Head')).toBe('#2563eb');
    expect(sectionTitleColor('unknown')).toBe('#7c3aed');
  });
});

describe('go pro scenes', () => {
  it('maps a request reason to its benefit scene', () => {
    expect(proBenefitForReason('Pro mascot styles')).toBe('items');
    expect(proBenefitForReason('Unlimited QuadWord')).toBe('unlimited');
    expect(proBenefitForReason('Unlimited play')).toBe('unlimited');
    expect(proBenefitForReason('VS Bots')).toBe('vsBots');
    expect(proBenefitForReason('Extended stats')).toBe('stats');
    expect(proBenefitForReason(undefined)).toBe('unlimited');
  });
  it('has one distinct scene per benefit', () => {
    expect(new Set(PRO_BENEFIT_ORDER.map((b) => PRO_SCENES[b])).size).toBe(PRO_BENEFIT_ORDER.length);
  });
});
