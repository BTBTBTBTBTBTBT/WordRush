// Friends overhaul (founder, 2026-10-01; canvas Round 8, spec
// docs/FRIENDS_REDESIGN_SPEC.md): pocket games you play with a friend — Rock
// Paper Scissors, Tic-Tac-Tile, Call It and Pass the Puzzle — plus the Friends
// banner words, friend streaks and the "on now" rule. Ghost and Word Chain
// joined the same night (founder: "I didn't see ghost and word chain").
//
// The server (apps/web/app/api/friends/games) is the only writer: it runs
// applyFriendlyMove and stores the state, so a client can never cheat a coin
// or peek at a pick. Clients render the state and the words below; the Swift
// and Kotlin ports assert against friendly-games-fixtures.json.

import { evaluateGuess } from './evaluator';
import { shiftDay } from './home-banner';

export type FriendlyKind = 'rps' | 'ttt' | 'coin' | 'pass' | 'ghost' | 'chain';
export type Side = 'a' | 'b';
export type RpsPick = 'rock' | 'paper' | 'scissors';
export type CoinFace = 'heads' | 'tails';
export type CellMark = '' | Side;

export const FRIENDLY_KINDS: readonly FriendlyKind[] = ['rps', 'ttt', 'coin', 'pass', 'ghost', 'chain'];
export const FRIENDLY_TITLES: Record<FriendlyKind, string> = {
  rps: 'Rock Paper Scissors',
  ttt: 'Tic-Tac-Tile',
  coin: 'Call It',
  pass: 'Pass the Puzzle',
  ghost: 'Ghost',
  chain: 'Word Chain',
};
/** Wins needed: best of 3 (RPS, Tic-Tac-Tile, Ghost), best of 5 (Call It); Word Chain is points. */
export const FRIENDLY_TARGET: Record<FriendlyKind, number> = { rps: 2, ttt: 2, coin: 3, pass: 1, ghost: 2, chain: 30 };
/** Call It stakes — a fixed list (no free text). */
export const COIN_STAKES = ['Bragging rights', "Loser picks tonight's VS mode", 'Winner goes first next time'] as const;
/** Pass the Puzzle shares one Classic board: six guesses between the two players. */
export const PASS_MAX_GUESSES = 6;
/** Ghost and Word Chain play on the 5- to 7-letter word lists. */
export const WORD_MIN = 5;
export const WORD_MAX = 7;
/** Word Chain: a word scores its letters; first to 30 wins. */
export const CHAIN_TARGET = 30;

export interface RpsState { kind: 'rps'; picks: { a?: RpsPick; b?: RpsPick }; rounds: Array<{ a: RpsPick; b: RpsPick; winner: Side | null }>; score: { a: number; b: number } }
export interface TttState { kind: 'ttt'; board: CellMark[]; starter: Side; turn: Side; games: Array<{ winner: Side | null }>; score: { a: number; b: number } }
export interface CoinState { kind: 'coin'; caller: Side; rounds: Array<{ caller: Side; call: CoinFace; flip: CoinFace; winner: Side }>; score: { a: number; b: number }; stake: string }
export interface PassState { kind: 'pass'; turn: Side; guesses: Array<{ by: Side; word: string; tiles: string[] }>; solvedBy: Side | null }
/** Ghost: add a letter each turn. Spell a whole word, or leave letters no word starts with, and you lose the round. */
export interface GhostState { kind: 'ghost'; fragment: string; letters: Side[]; turn: Side; starter: Side; rounds: Array<{ fragment: string; loser: Side; reason: 'word' | 'dead' }>; score: { a: number; b: number } }
/** Word Chain: each word starts with the last letter of the one before; a word scores its letters. */
export interface ChainState { kind: 'chain'; words: Array<{ by: Side; word: string; points: number }>; turn: Side; score: { a: number; b: number } }
export type FriendlyState = RpsState | TttState | CoinState | PassState | GhostState | ChainState;

export type FriendlyMove =
  | { kind: 'rps'; pick: RpsPick }
  | { kind: 'ttt'; cell: number }
  | { kind: 'coin'; call: CoinFace }
  | { kind: 'pass'; word: string }
  | { kind: 'ghost'; letter: string }
  | { kind: 'chain'; word: string };

export interface MoveContext {
  /** Server randomness for the coin (0 ≤ r < 1). */
  random?: () => number;
  /** Pass the Puzzle: the hidden answer and a word check. */
  solution?: string;
  isValidWord?: (w: string) => boolean;
  /** Ghost / Word Chain: a 5–7 letter word on the lists (upper case in). */
  isWord?: (w: string) => boolean;
  /** Ghost: some 5–7 letter word starts with these letters. */
  hasPrefix?: (fragment: string) => boolean;
  /** Ghost / Word Chain: letters the app never shows (the blocked-term list). */
  blocked?: (s: string) => boolean;
}

export type MoveResult =
  | { ok: true; state: FriendlyState; done: boolean; winner: Side | 'draw' | null }
  | { ok: false; error: string };

const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');

/** A fresh game; side `a` is whoever started it. */
export function newFriendlyState(kind: FriendlyKind, stake?: string): FriendlyState {
  switch (kind) {
    case 'rps': return { kind, picks: {}, rounds: [], score: { a: 0, b: 0 } };
    case 'ttt': return { kind, board: Array(9).fill('') as CellMark[], starter: 'a', turn: 'a', games: [], score: { a: 0, b: 0 } };
    case 'coin': return { kind, caller: 'a', rounds: [], score: { a: 0, b: 0 }, stake: stake && (COIN_STAKES as readonly string[]).includes(stake) ? stake : COIN_STAKES[0] };
    case 'pass': return { kind, turn: 'a', guesses: [], solvedBy: null };
    case 'ghost': return { kind, fragment: '', letters: [], turn: 'a', starter: 'a', rounds: [], score: { a: 0, b: 0 } };
    case 'chain': return { kind, words: [], turn: 'a', score: { a: 0, b: 0 } };
  }
}

export function rpsBeats(x: RpsPick, y: RpsPick): boolean {
  return (x === 'rock' && y === 'scissors') || (x === 'paper' && y === 'rock') || (x === 'scissors' && y === 'paper');
}

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

/** The winning line on a Tic-Tac-Tile board, if any. */
export function tttLine(board: CellMark[]): { side: Side; cells: number[] } | null {
  for (const l of LINES) {
    const m = board[l[0]];
    if (m && m === board[l[1]] && m === board[l[2]]) return { side: m, cells: l };
  }
  return null;
}

/** Whose move it is: a side, 'both' (an open RPS round), or null when the game is over. */
export function whoseTurn(s: FriendlyState): Side | 'both' | null {
  if (friendlyWinner(s) !== null) return null;
  switch (s.kind) {
    case 'rps': return s.picks.a && !s.picks.b ? 'b' : s.picks.b && !s.picks.a ? 'a' : 'both';
    case 'ttt': return s.turn;
    case 'coin': return s.caller;
    case 'pass': return s.turn;
    case 'ghost': return s.turn;
    case 'chain': return s.turn;
  }
}

/** The match winner, 'draw', or null while it is still going. */
export function friendlyWinner(s: FriendlyState): Side | 'draw' | null {
  if (s.kind === 'pass') {
    if (s.solvedBy) return s.solvedBy;
    return s.guesses.length >= PASS_MAX_GUESSES ? 'draw' : null;
  }
  const target = FRIENDLY_TARGET[s.kind];
  if (s.score.a >= target) return 'a';
  if (s.score.b >= target) return 'b';
  // Tic-Tac-Tile stops after five games (draws included), Ghost after five rounds: the leader wins.
  if (s.kind === 'ttt' && s.games.length >= 5) return s.score.a === s.score.b ? 'draw' : s.score.a > s.score.b ? 'a' : 'b';
  if (s.kind === 'ghost' && s.rounds.length >= 5) return s.score.a === s.score.b ? 'draw' : s.score.a > s.score.b ? 'a' : 'b';
  return null;
}

/** Apply one move by `by`. Pure: randomness and the answer come from `ctx`. */
export function applyFriendlyMove(s: FriendlyState, by: Side, move: FriendlyMove, ctx: MoveContext = {}): MoveResult {
  if (move.kind !== s.kind) return { ok: false, error: 'Wrong game' };
  if (friendlyWinner(s) !== null) return { ok: false, error: 'This game is over' };
  const turn = whoseTurn(s);
  if (turn !== 'both' && turn !== by) return { ok: false, error: 'Not your turn' };
  const done = (state: FriendlyState): MoveResult => ({ ok: true, state, done: friendlyWinner(state) !== null, winner: friendlyWinner(state) });

  if (s.kind === 'rps' && move.kind === 'rps') {
    if (s.picks[by]) return { ok: false, error: 'Already picked' };
    const picks = { ...s.picks, [by]: move.pick };
    if (!picks.a || !picks.b) return done({ ...s, picks });
    const winner: Side | null = picks.a === picks.b ? null : rpsBeats(picks.a, picks.b) ? 'a' : 'b';
    const score = { ...s.score };
    if (winner) score[winner] += 1;
    return done({ ...s, picks: {}, rounds: [...s.rounds, { a: picks.a, b: picks.b, winner }], score });
  }

  if (s.kind === 'ttt' && move.kind === 'ttt') {
    if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell > 8 || s.board[move.cell]) return { ok: false, error: 'Pick an empty tile' };
    const board = [...s.board];
    board[move.cell] = by;
    const line = tttLine(board);
    if (line || board.every(Boolean)) {
      const winner = line ? line.side : null;
      const score = { ...s.score };
      if (winner) score[winner] += 1;
      const starter = other(s.starter);
      return done({ ...s, board: Array(9).fill('') as CellMark[], starter, turn: starter, games: [...s.games, { winner }], score });
    }
    return done({ ...s, board, turn: other(by) });
  }

  if (s.kind === 'coin' && move.kind === 'coin') {
    const r = (ctx.random ?? Math.random)();
    const flip: CoinFace = r < 0.5 ? 'heads' : 'tails';
    const winner: Side = flip === move.call ? by : other(by);
    const score = { ...s.score, [winner]: s.score[winner] + 1 };
    return done({ ...s, caller: other(s.caller), rounds: [...s.rounds, { caller: by, call: move.call, flip, winner }], score });
  }

  if (s.kind === 'pass' && move.kind === 'pass') {
    const word = (move.word ?? '').trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(word)) return { ok: false, error: 'Five letters, please' };
    if (ctx.isValidWord && !ctx.isValidWord(word)) return { ok: false, error: 'Not in the word list' };
    if (s.guesses.some((g) => g.word === word)) return { ok: false, error: 'Already guessed' };
    if (!ctx.solution) return { ok: false, error: 'No puzzle' };
    const tiles = evaluateGuess(ctx.solution, word).tiles.map((t) => String(t.state));
    const solved = word === ctx.solution.toUpperCase();
    return done({ ...s, turn: other(by), guesses: [...s.guesses, { by, word, tiles }], solvedBy: solved ? by : null });
  }

  if (s.kind === 'ghost' && move.kind === 'ghost') {
    const letter = (move.letter ?? '').trim().toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return { ok: false, error: 'One letter, please' };
    const fragment = s.fragment + letter;
    if (ctx.blocked && ctx.blocked(fragment)) return { ok: false, error: 'Try another letter' };
    const spelled = fragment.length >= WORD_MIN && !!ctx.isWord?.(fragment);
    const dead = !spelled && !!ctx.hasPrefix && !ctx.hasPrefix(fragment);
    if (spelled || dead) {
      const winner = other(by);
      const starter = other(s.starter);
      return done({
        ...s, fragment: '', letters: [], starter, turn: starter,
        rounds: [...s.rounds, { fragment, loser: by, reason: spelled ? 'word' : 'dead' }],
        score: { ...s.score, [winner]: s.score[winner] + 1 },
      });
    }
    return done({ ...s, fragment, letters: [...s.letters, by], turn: other(by) });
  }

  if (s.kind === 'chain' && move.kind === 'chain') {
    const word = (move.word ?? '').trim().toUpperCase();
    if (!/^[A-Z]+$/.test(word) || word.length < WORD_MIN || word.length > WORD_MAX) return { ok: false, error: `${WORD_MIN} to ${WORD_MAX} letters, please` };
    const last = s.words[s.words.length - 1];
    if (last && word[0] !== last.word[last.word.length - 1]) return { ok: false, error: `Start with ${last.word[last.word.length - 1]}` };
    if (s.words.some((w) => w.word === word)) return { ok: false, error: 'Already played' };
    if (ctx.blocked && ctx.blocked(word)) return { ok: false, error: 'Try another word' };
    if (ctx.isWord && !ctx.isWord(word)) return { ok: false, error: 'Not in the word list' };
    const points = word.length;
    return done({ ...s, turn: other(by), words: [...s.words, { by, word, points }], score: { ...s.score, [by]: s.score[by] + points } });
  }
  return { ok: false, error: 'Bad move' };
}

/** What the OTHER player may see: an open RPS pick is hidden until both are in. */
export function friendlyStateFor(s: FriendlyState, viewer: Side): FriendlyState {
  if (s.kind !== 'rps') return s;
  const theirs = other(viewer);
  if (!s.picks[theirs]) return s;
  const picks: RpsState['picks'] = { ...s.picks };
  // Keep the key so the UI can say "Doug picked"; the value is never sent.
  (picks as Record<string, string | undefined>)[theirs] = 'hidden' as unknown as RpsPick;
  return { ...s, picks };
}

// ── Words every client shows (parity) ───────────────────────────────────────

export interface GameLineInput {
  kind: FriendlyKind;
  state: FriendlyState;
  me: Side;
  /** The friend's username. */
  them: string;
  /** Minutes since the last move. */
  minutesAgo: number;
}

const ago = (m: number) => (m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 60 * 24 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`);

/** The one-line status on a game card: "Your move · Doug moved 4 min ago", "You won 2–1". */
export function friendlyCardLine(i: GameLineInput): string {
  const s = i.state;
  const w = friendlyWinner(s);
  const mine = s.kind === 'pass' ? 0 : s.score[i.me];
  const theirs = s.kind === 'pass' ? 0 : s.score[i.me === 'a' ? 'b' : 'a'];
  if (w !== null) {
    if (s.kind === 'pass') return w === 'draw' ? 'Nobody solved it' : w === i.me ? 'You solved it' : `${i.them} solved it`;
    if (w === 'draw') return `Draw ${mine}–${theirs}`;
    return w === i.me ? `You won ${mine}–${theirs}` : `${i.them} won ${theirs}–${mine}`;
  }
  const t = whoseTurn(s);
  const myTurn = t === 'both' || t === i.me;
  if (s.kind === 'rps') {
    const round = s.rounds.length + 1;
    return myTurn ? `Round ${round} · your pick` : `Round ${round} · waiting on ${i.them}`;
  }
  if (s.kind === 'pass') {
    const used = s.guesses.length;
    return myTurn ? `Your guess · ${used} of ${PASS_MAX_GUESSES} used` : `${i.them}'s guess · ${used} of ${PASS_MAX_GUESSES} used`;
  }
  if (s.kind === 'coin') return myTurn ? `Your call · ${mine}–${theirs}` : `${i.them} calls next · ${mine}–${theirs}`;
  if (s.kind === 'ghost') return myTurn ? (s.fragment ? `Your letter · ${s.fragment}` : `Your letter · start it`) : `Waiting on ${i.them} · ${mine}–${theirs}`;
  if (s.kind === 'chain') {
    const last = s.words[s.words.length - 1];
    return myTurn ? (last ? `Your word · starts with ${last.word[last.word.length - 1]}` : 'Your word · any word') : `${i.them}'s word · ${mine}–${theirs}`;
  }
  return myTurn ? `Your move · ${i.them} moved ${ago(i.minutesAgo)}` : `Waiting on ${i.them} · ${mine}–${theirs}`;
}

/** The big headline on the game screen: "ROUND 2 OF 3", "YOUR MOVE", "YOU WIN!". */
export function friendlyHeadline(s: FriendlyState, me: Side): string {
  const w = friendlyWinner(s);
  if (w !== null) return w === 'draw' ? (s.kind === 'pass' ? 'NOBODY SOLVED IT' : "IT'S A DRAW") : w === me ? 'YOU WIN!' : 'THEY WIN';
  const t = whoseTurn(s);
  const myTurn = t === 'both' || t === me;
  switch (s.kind) {
    case 'rps': return `ROUND ${s.rounds.length + 1}`;
    case 'ttt': return myTurn ? 'YOUR MOVE' : 'THEIR MOVE';
    case 'coin': return `ROUND ${s.rounds.length + 1} OF 5`;
    case 'pass': return myTurn ? `YOUR GUESS · ${s.guesses.length + 1} OF ${PASS_MAX_GUESSES}` : `THEIR GUESS · ${s.guesses.length + 1} OF ${PASS_MAX_GUESSES}`;
    case 'ghost': return myTurn ? 'YOUR LETTER' : 'THEIR LETTER';
    case 'chain': {
      const last = s.words[s.words.length - 1];
      return myTurn ? (last ? `YOUR WORD · STARTS WITH ${last.word[last.word.length - 1]}` : 'YOUR WORD') : 'THEIR WORD';
    }
  }
}

// ── Presence, friend streaks, the Friends banner ────────────────────────────

/** A friend is "on now" when their app heartbeat is under two minutes old. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isOnline(lastSeenMs: number | null, nowMs: number): boolean {
  return lastSeenMs !== null && nowMs - lastSeenMs < ONLINE_WINDOW_MS && nowMs - lastSeenMs > -ONLINE_WINDOW_MS;
}

/** A friend row's presence line: "On now · in Muddle", "On now", "Here 12 min ago", or null (older than a day). */
export function presenceLine(lastSeenMs: number | null, activity: string | null, nowMs: number): string | null {
  if (lastSeenMs === null) return null;
  if (isOnline(lastSeenMs, nowMs)) return activity ? `On now · in ${activity}` : 'On now';
  const m = Math.floor((nowMs - lastSeenMs) / 60000);
  if (m < 60) return `Here ${m} min ago`;
  if (m < 60 * 24) return `Here ${Math.floor(m / 60)} h ago`;
  return null;
}

/**
 * Days in a row BOTH players finished at least one daily, ending today (or
 * yesterday while today is still open for either of them).
 */
export function friendStreak(myDays: Iterable<string>, theirDays: Iterable<string>, today: string): number {
  const mine = new Set(myDays);
  const both = new Set([...theirDays].filter((d) => mine.has(d)));
  let cursor: string | null = both.has(today) ? today : both.has(shiftDay(today, -1)) ? shiftDay(today, -1) : null;
  let n = 0;
  while (cursor && both.has(cursor)) { n += 1; cursor = shiftDay(cursor, -1); }
  return n;
}

export interface FriendsBannerInput {
  friendCount: number;
  /** Usernames of friends on now. */
  online: string[];
  /** Today's race: my rank (1-based) among me + friends, and the points. */
  myRank: number;
  myPoints: number;
  leaderName: string;
  leaderPoints: number;
  /** Points of the person right behind me (or 0). */
  nextPoints: number;
}

const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : n % 10 === 1 ? 'ST' : n % 10 === 2 ? 'ND' : n % 10 === 3 ? 'RD' : 'TH'}`;

/** The Friends banner headline, always upper case. */
export function friendsBannerHeadline(i: FriendsBannerInput): string {
  if (i.friendCount === 0) return 'BRING YOUR FRIENDS';
  if (i.online.length === 1) return `${upper(i.online[0])} IS ON NOW`;
  if (i.online.length > 1) return `${i.online.length} FRIENDS ON NOW`;
  if (i.myRank === 1 && i.myPoints > 0) return 'YOU LEAD TODAY’S RACE!';
  if (i.leaderPoints > 0) return `${upper(i.leaderName)} LEADS TODAY’S RACE`;
  return 'QUIET IN HERE · START A GAME';
}

/** The line under it. `clock` counts down to local midnight. */
export function friendsBannerClockLine(i: FriendsBannerInput, clock: string): string {
  if (i.friendCount === 0) return 'ADD A FRIEND TO RACE, PLAY AND TRADE STREAKS';
  if (i.leaderPoints <= 0 && i.myPoints <= 0) return `TODAY’S RACE IS OPEN · ENDS IN ${clock}`;
  if (i.myRank === 1) return `YOU LEAD BY ${Math.max(0, i.myPoints - i.nextPoints).toLocaleString('en-US')} · ENDS IN ${clock}`;
  return `TODAY’S RACE ENDS IN ${clock} · YOU’RE ${ord(i.myRank)}, ${(i.leaderPoints - i.myPoints).toLocaleString('en-US')} BEHIND`;
}

function upper(s: string): string {
  return s.trim().toUpperCase();
}
