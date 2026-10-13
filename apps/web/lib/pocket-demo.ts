// DEV-ONLY perf + playthrough harness for the pocket games (founder 10-13). Pocket games are two-player and server-driven, so no
// guest can reach one. In `next dev` only (every caller is behind `process.env.NODE_ENV === 'development'`, which a production build
// compiles away), /dev/pocket?kind=<kind> plays ONE local game through the real core rules (applyFriendlyMove) with a scripted
// "Doug" on the other side and no network at all. `autoplay=1` scripts my side too, so the game plays itself to its finished screen;
// without it my taps / keys go through the same onMove path as a real game and Doug answers after a beat.
// Mirrors apps/android/.../data/PocketDemo.kt.

import {
  applyFriendlyMove, friendlyStateFor, friendlyWinner, newFriendlyState, whoseTurn,
  type CoinFace, type FriendlyKind, type FriendlyMove, type FriendlyState, type MoveContext, type RpsPick, type Side,
} from '@wordle-duel/core';
import type { GameView, MoveOutcome } from './friendly-games-client';

export const DEMO_PREFIX = 'debug-pocket-';
export const isPocketDemoId = (id: string): boolean => process.env.NODE_ENV === 'development' && id.startsWith(DEMO_PREFIX);

const GHOST_WORDS = ['STRAND', 'PLANT'];
const COIN_WINNERS: Side[] = ['a', 'b', 'a', 'b', 'a'];
const CHAIN_MINE = ['STUPENDOUS', 'STRAIGHTFORWARD', 'LIGHTHOUSE', 'YESTERDAY', 'FANTASTIC'];
const CHAIN_THEIRS = ['SERENDIPITOUS', 'DEVELOPMENTAL', 'EXTRAORDINARY', 'YOURSELF'];
const TTT_MINE = [[0, 4, 8], [0, 4, 8]];
const TTT_THEIRS = [[1, 2], [1, 2, 3]];

let kind: FriendlyKind = 'rps';
let variant = '';
let state: FriendlyState = newFriendlyState('rps');
let seq = 0;
let base = 0;
let startedAt = 0;
let last: GameView | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let runId = 0;
const log = (...a: unknown[]) => { try { console.info('[PocketDemo]', ...a); } catch { /* ignore */ } };

const clamp = (n: number, max: number) => Math.min(n, max);

function myMove(s: FriendlyState): FriendlyMove | null {
  switch (s.kind) {
    case 'rps': return s.picks.a ? null : { kind: 'rps', pick: (['rock', 'paper', 'scissors'] as RpsPick[])[s.rounds.length % 3] };
    case 'ttt': return s.turn !== 'a' ? null : { kind: 'ttt', cell: TTT_MINE[clamp(s.games.length, 1)][clamp(s.board.filter((c) => c === 'a').length, 2)] };
    case 'coin': return s.caller !== 'a' ? null : { kind: 'coin', call: (s.rounds.length % 4 === 0 ? 'heads' : 'tails') as CoinFace };
    case 'pass': {
      if (s.turn !== 'a') return null;
      const mine = variant === 'full' ? ['CRANE', 'BLAND', 'QUILT'] : ['CRANE', 'BLAND', 'PLANT'];
      return { kind: 'pass', word: mine[clamp(s.guesses.filter((g) => g.by === 'a').length, 2)] };
    }
    case 'ghost': return s.turn !== 'a' ? null : { kind: 'ghost', letter: GHOST_WORDS[clamp(s.rounds.length, 1)][s.fragment.length] };
    case 'chain': return s.turn !== 'a' ? null : { kind: 'chain', word: CHAIN_MINE[clamp(s.words.filter((w) => w.by === 'a').length, 4)] };
  }
}

function theirMove(s: FriendlyState): FriendlyMove | null {
  switch (s.kind) {
    case 'rps': {
      // Doug picks first on rounds 1 and 3 (the face-down fist), after me on round 2.
      const ready = !s.picks.b && (s.rounds.length % 2 === 0 || !!s.picks.a);
      return ready ? { kind: 'rps', pick: (['scissors', 'scissors', 'paper'] as RpsPick[])[s.rounds.length % 3] } : null;
    }
    case 'ttt': {
      if (s.turn !== 'b') return null;
      const opts = TTT_THEIRS[clamp(s.games.length, 1)];
      const want = opts[clamp(s.board.filter((c) => c === 'b').length, opts.length - 1)];
      return { kind: 'ttt', cell: s.board[want] === '' ? want : s.board.findIndex((c) => c === '') };
    }
    case 'coin': return s.caller !== 'b' ? null : { kind: 'coin', call: 'tails' };
    case 'pass': {
      if (s.turn !== 'b') return null;
      return { kind: 'pass', word: ['SLOTH', 'GLINT', 'FUDGY'][clamp(s.guesses.filter((g) => g.by === 'b').length, 2)] };
    }
    case 'ghost': return s.turn !== 'b' ? null : { kind: 'ghost', letter: GHOST_WORDS[clamp(s.rounds.length, 1)][s.fragment.length] };
    case 'chain': return s.turn !== 'b' ? null : { kind: 'chain', word: CHAIN_THEIRS[clamp(s.words.filter((w) => w.by === 'b').length, 3)] };
  }
}

function ctxFor(s: FriendlyState, by: Side, move: FriendlyMove): MoveContext {
  return {
    // Call It: the scripted winner of this round wins the flip.
    random: () => {
      if (move.kind !== 'coin' || s.kind !== 'coin') return 0.5;
      const want = COIN_WINNERS[clamp(s.rounds.length, 4)];
      const flip: CoinFace = want === by ? move.call : move.call === 'heads' ? 'tails' : 'heads';
      return flip === 'heads' ? 0.2 : 0.8;
    },
    solution: 'PLANT',
    isValidWord: () => true,
    isWord: (w) => (s.kind === 'ghost' ? GHOST_WORDS.includes(w) : true),
    hasPrefix: (p) => GHOST_WORDS.some((w) => w.startsWith(p)),
  };
}

function view(): GameView {
  const s = state;
  const w = friendlyWinner(s);
  seq += 1;
  const t = new Date(base + seq * 50).toISOString();
  const turn = whoseTurn(s);
  return {
    id: DEMO_PREFIX + kind, kind, title: kind, me: 'a',
    opponent: { id: '5d0e0000-0000-4000-8000-000000000013', username: 'Doug', avatarUrl: null, avatarEmoji: null },
    state: friendlyStateFor(s, 'a'),
    status: w === null ? 'active' : 'done',
    yourTurn: w === null && (turn === 'a' || turn === 'both'),
    result: w === null ? null : w === 'a' ? 'win' : w === 'b' ? 'loss' : 'draw',
    line: w === null ? '' : w === 'a' ? 'You won' : w === 'b' ? 'Doug won' : 'Draw',
    answer: kind === 'pass' && w !== null ? 'PLANT' : null,
    createdAt: t, updatedAt: t,
  };
}

function publish(): void { last = view(); }

function apply(by: Side, mv: FriendlyMove): string | null {
  const r = applyFriendlyMove(state, by, mv, ctxFor(state, by, mv));
  if (!r.ok) return r.error;
  state = r.state;
  publish();
  log('move', by, JSON.stringify(mv), `t=${Math.round(performance.now() - startedAt)}ms`);
  return null;
}

const roundsOf = (s: FriendlyState): number =>
  s.kind === 'rps' || s.kind === 'coin' || s.kind === 'ghost' ? s.rounds.length : s.kind === 'ttt' ? s.games.length : 0;

/** A fresh game on my turn; autoplay scripts my side too. */
export function startPocketDemo(k: FriendlyKind, name: string, autoplay: boolean, paceMs: number): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (timer) clearTimeout(timer);
  const my = ++runId;
  kind = k;
  variant = name.endsWith('full') ? 'full' : '';
  seq = 0;
  base = Date.now();
  startedAt = performance.now();
  state = newFriendlyState(k);
  publish();
  (window as unknown as { __pocketDemo?: unknown }).__pocketDemo = { move: demoMove };
  log('start', k, `autoplay=${autoplay}`, `pace=${paceMs}`);
  let lastRounds = 0;
  const step = () => {
    if (my !== runId) return;
    if (friendlyWinner(state) !== null) { log('done', k, `t=${Math.round(performance.now() - startedAt)}ms`, `result=${last?.result}`); return; }
    const mine = autoplay ? myMove(state) : null;
    const theirs = theirMove(state);
    let wait = 250;
    if (theirs) {
      timer = setTimeout(() => {
        if (my !== runId) return;
        apply('b', theirs);
        const r = roundsOf(state);
        const reveal = r > lastRounds && (k === 'rps' || k === 'coin');
        lastRounds = r;
        timer = setTimeout(step, reveal ? 4300 : 150);
      }, autoplay ? paceMs / 2 : 1100);
      return;
    }
    if (mine) {
      timer = setTimeout(() => {
        if (my !== runId) return;
        apply('a', mine);
        const r = roundsOf(state);
        const reveal = r > lastRounds && (k === 'rps' || k === 'coin');
        lastRounds = r;
        timer = setTimeout(step, reveal ? 4300 : 150);
      }, paceMs);
      return;
    }
    timer = setTimeout(step, wait);
  };
  timer = setTimeout(step, 1500); // let the screen show the opening board first
}

export async function demoFetch(): Promise<GameView> {
  return last ?? view();
}

/** My tap- / key-driven move (the screen's real send path lands here). */
export async function demoMove(move: FriendlyMove): Promise<MoveOutcome> {
  const err = apply('a', move);
  if (err) return { ok: false, error: err };
  // Opponent answers after a beat even without autoplay (the step loop does it).
  return { ok: true, game: last ?? view() };
}
