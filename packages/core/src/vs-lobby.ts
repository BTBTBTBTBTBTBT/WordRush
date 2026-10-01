// VS lobby rules (founder-approved VS overhaul, 2026-10-01; canvas Round 7,
// spec docs/VS_REDESIGN_SPEC.md). The VS page gets the home banner's shape:
// a frosted headline strip over TODAY (the Daily Battle and the Bot of the
// Day) and RECORD (people, bots, the ladder). Async friend challenges ("race
// my run") are scored with the same rule as a live match.
//
// Everything here is pure so web, iOS and Android read the SAME words and
// reach the SAME outcomes: the Swift and Kotlin ports assert against
// vs-lobby-fixtures.json (scripts/gen-parity-fixtures.ts).

/** The nine VS modes in lobby-strip order (db keys). */
export const VS_MODE_ORDER = ['DUEL', 'DUEL_6', 'DUEL_7', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET', 'PROPERNOUNDLE'] as const;

export type VsDayResult = 'open' | 'won' | 'lost' | 'draw';

export interface VsBannerInput {
  /** The player's username; empty for none. */
  name: string;
  /** Today's Daily Battle (a person, or the bot that stepped in). */
  battle: VsDayResult;
  /** Today's Bot of the Day. */
  botOfDay: VsDayResult;
  /** Username of the newest open challenge sent to the player, if any. */
  incomingFrom?: string | null;
  /** Current bot win streak (the same progression store Stats reads). */
  streak: number;
}

const upper = (s: string) => s.trim().toUpperCase();

/** Both of today's battles won: the banner turns gold. */
export function vsSweep(i: Pick<VsBannerInput, 'battle' | 'botOfDay'>): boolean {
  return i.battle === 'won' && i.botOfDay === 'won';
}

/**
 * The VS banner headline, always upper case. An open challenge leads; then a
 * VS sweep; then a hot streak; then today's own news; then a greeting.
 */
export function vsBannerHeadline(i: VsBannerInput): string {
  if (i.incomingFrom && i.incomingFrom.trim()) return `${upper(i.incomingFrom)} CHALLENGED YOU!`;
  if (vsSweep(i)) return 'VS SWEEP!';
  if (i.streak >= 3) return `ON A ROLL · ${i.streak} WINS IN A ROW`;
  if (i.battle === 'won') return 'DAILY BATTLE WON!';
  if (i.botOfDay === 'won') return 'BOT OF THE DAY BEATEN!';
  if (i.battle !== 'open' || i.botOfDay !== 'open') return 'BACK FOR MORE?';
  const name = upper(i.name);
  return name ? `READY TO RACE, ${name}?` : 'READY TO RACE?';
}

/**
 * The line under the headline. `clock` is the HH:MM:SS countdown to the next
 * UTC midnight (the Daily Battle and Bot of the Day are UTC-seeded);
 * `challengeLeft` is the open challenge's time left, e.g. "17H".
 */
export function vsBannerClockLine(i: VsBannerInput, clock: string, opts: { free?: boolean; challengeLeft?: string } = {}): string {
  if (i.incomingFrom && i.incomingFrom.trim()) {
    return `RACE ${upper(i.incomingFrom)}’S RUN · ${opts.challengeLeft ?? '24H'} LEFT`;
  }
  const done = (i.battle !== 'open' ? 1 : 0) + (i.botOfDay !== 'open' ? 1 : 0);
  if (done === 2) return `NEW BATTLES IN ${clock}`;
  if (done === 0) return opts.free ? `TWO FREE BATTLES A DAY · RESET IN ${clock}` : `DAILY BATTLE + BOT OF THE DAY · RESET IN ${clock}`;
  return `RESETS IN ${clock}`;
}

/** The TODAY row's status: "0/2", "1/2", "2/2", or "SWEEP · 2/2 WON". */
export function vsTodayStatus(i: Pick<VsBannerInput, 'battle' | 'botOfDay'>): string {
  if (vsSweep(i)) return 'SWEEP · 2/2 WON';
  const done = (i.battle !== 'open' ? 1 : 0) + (i.botOfDay !== 'open' ? 1 : 0);
  return `${done}/2`;
}

export interface WinLoss { wins: number; losses: number }

/**
 * The RECORD row: "PEOPLE 12–7 · BOTS 31–9 · LADDER 2/4". People and bots are
 * summed exactly like the Stats page's VS section (user_stats play_type 'vs'
 * and 'vs_cpu'), so the two can never disagree. The ladder is left out when
 * `ladder` is null (free players).
 */
export function vsRecordLine(people: WinLoss, bots: WinLoss, ladder: number | null): string {
  const parts = [`PEOPLE ${people.wins}–${people.losses}`, `BOTS ${bots.wins}–${bots.losses}`];
  if (ladder !== null) parts.push(ladder >= LADDER_BOTS.length ? 'LADDER CLEARED' : `LADDER ${ladder}/${LADDER_BOTS.length}`);
  return parts.join(' · ');
}

// ── Async challenges ("race my run") ────────────────────────────────────────

/** One side of a VS game: the same numbers a live match compares. */
export interface VsRun {
  solved: boolean;
  boardsSolved: number;
  /** Guess count (the VS score unit). */
  guesses: number;
  timeMs: number;
}

/** 45 seconds of speed is worth one guess (apps/server endMatch). */
export const VS_TIME_WEIGHT_S = 45;

const composite = (r: VsRun) => r.guesses + r.timeMs / 1000 / VS_TIME_WEIGHT_S;

/**
 * Who won, from `me`'s side. Mirrors the live server: a solve beats no solve;
 * two solves compare boards, then guesses + time/45s (within 0.01 is a draw).
 * Two failed runs (the live server scores both as losses) compare boards
 * solved, and are otherwise a draw.
 */
export function vsOutcome(me: VsRun, them: VsRun): 'win' | 'loss' | 'draw' {
  if (me.solved !== them.solved) return me.solved ? 'win' : 'loss';
  if (me.boardsSolved !== them.boardsSolved) return me.boardsSolved > them.boardsSolved ? 'win' : 'loss';
  if (!me.solved) return 'draw';
  const a = composite(me), b = composite(them);
  if (Math.abs(a - b) < 0.01) return 'draw';
  return a < b ? 'win' : 'loss';
}

/** "1:05" from milliseconds (whole seconds, rounded). */
export function vsClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * What decided it, from the winner's side: "ONLY ONE SOLVE", "2 MORE BOARDS",
 * "1 FEWER GUESS", "FASTER BY 0:12"; a draw reads "DEAD EVEN".
 */
export function vsMargin(me: VsRun, them: VsRun): string {
  const out = vsOutcome(me, them);
  if (out === 'draw') return 'DEAD EVEN';
  const [w, l] = out === 'win' ? [me, them] : [them, me];
  if (w.solved !== l.solved) return 'ONLY ONE SOLVE';
  if (w.boardsSolved !== l.boardsSolved) {
    const d = w.boardsSolved - l.boardsSolved;
    return `${d} MORE ${d === 1 ? 'BOARD' : 'BOARDS'}`;
  }
  if (w.guesses < l.guesses) {
    const d = l.guesses - w.guesses;
    return `${d} FEWER ${d === 1 ? 'GUESS' : 'GUESSES'}`;
  }
  return `FASTER BY ${vsClock(l.timeMs - w.timeMs)}`;
}

/** The challenge result headline: "YOU BEAT DOUG’S RUN!" / "DOUG’S RUN HELD!" / "DEAD HEAT WITH DOUG!". */
export function challengeHeadline(outcome: 'win' | 'loss' | 'draw', from: string): string {
  const n = upper(from) || 'THEIR';
  if (outcome === 'win') return `YOU BEAT ${n}’S RUN!`;
  if (outcome === 'loss') return `${n}’S RUN HELD!`;
  return `DEAD HEAT WITH ${n}!`;
}

// ── The bot ladder ──────────────────────────────────────────────────────────

/** Ladder order: Rook (easy) → Lexi (medium) → Nova (hard) → Adapt (matches you). */
export const LADDER_BOTS = ['rook', 'lexi', 'nova', 'adapt'] as const;
/** Wins in a row against the next bot that clear its rung. */
export const LADDER_CLEAR_RUN = 3;

export interface BotLadderState {
  /** Rungs cleared, 0–4. */
  cleared: number;
  /** Current wins in a row against the next bot (LADDER_BOTS[cleared]). */
  run: number;
}

/**
 * Fold one finished bot game into the ladder. Only games against the NEXT
 * bot count: a win adds to the run (three clear the rung), a loss resets the
 * run. Games against other bots (or the Bot of the Day / Beat your best)
 * leave the ladder alone.
 */
export function ladderAfterGame(s: BotLadderState, botId: string, won: boolean): BotLadderState {
  if (s.cleared >= LADDER_BOTS.length) return { cleared: LADDER_BOTS.length, run: 0 };
  if (botId !== LADDER_BOTS[s.cleared]) return { ...s };
  if (!won) return { cleared: s.cleared, run: 0 };
  const run = s.run + 1;
  return run >= LADDER_CLEAR_RUN ? { cleared: s.cleared + 1, run: 0 } : { cleared: s.cleared, run };
}

export type RungState = 'cleared' | 'next' | 'locked';

/** Each rung's state and its line ("Cleared", "Win 3 in a row to clear · 1 so far", "Clear Nova to unlock"). */
export function ladderRungs(s: BotLadderState): Array<{ id: string; state: RungState; line: string }> {
  const name = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
  return LADDER_BOTS.map((id, i) => {
    if (i < s.cleared) return { id, state: 'cleared' as const, line: 'Cleared' };
    if (i === s.cleared) return { id, state: 'next' as const, line: `Win ${LADDER_CLEAR_RUN} in a row to clear · ${s.run} so far` };
    return { id, state: 'locked' as const, line: `Clear ${name(LADDER_BOTS[i - 1])} to unlock` };
  });
}
