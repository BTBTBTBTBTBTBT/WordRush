// VS lobby helpers for the web (founder-approved VS overhaul, 2026-10-01; spec
// docs/VS_REDESIGN_SPEC.md). The shared words live in packages/core vs-lobby.ts;
// this file holds the web-only glue: the day keys, the local Daily Battle
// fallback result, the lobby's line builders and the record sums. Everything
// here is pure (or a guarded localStorage read) so it is unit tested.

import { vsClock, LADDER_BOTS, botCastMember, type VsDayResult, type VsRun, type WinLoss } from '@wordle-duel/core';
import { MODE_BY_DBKEY } from './modes.generated';
import type { CpuKind } from './adapters/bot-match-service';

/** The VS accent (spec §0). */
export const VS = {
  ink: 'var(--vs-ink, #0f766e)',
  soft: 'var(--vs-soft, #ccfbf1)',
  deep: 'var(--vs-deep, #134e4a)',
  title: 'linear-gradient(90deg, #0d9488, #0891b2)',
  page: 'var(--vs-page, #f8f7ff)',
  label: 'var(--vs-label, #6b7280)',
  // §11 (docs/ART_SPEC.md): the page's tinted shadow on a PageBackground, else the old one.
  cardShadow: 'var(--page-card-shadow, 0 2px 10px rgba(76,29,149,0.07))',
} as const;

/** The mode's display title ("Classic", "QuadWord"…) from its db key. */
export function modeTitle(dbKey: string): string {
  return MODE_BY_DBKEY[dbKey]?.title ?? 'Classic';
}

/** The mode's accent color from its db key. */
export function modeColor(dbKey: string): string {
  return MODE_BY_DBKEY[dbKey]?.accentHex ?? '#7c3aed';
}

// ── Persisted mode selection ────────────────────────────────────────────────

export const VS_MODE_STORAGE_KEY = 'wordocious-vs-mode';

/** The lobby's selected mode (default DUEL). Free players always read DUEL. */
export function loadVsMode(isPro: boolean, valid: readonly string[]): string {
  if (!isPro || typeof window === 'undefined') return 'DUEL';
  try {
    const v = window.localStorage.getItem(VS_MODE_STORAGE_KEY);
    return v && valid.includes(v) ? v : 'DUEL';
  } catch {
    return 'DUEL';
  }
}

export function saveVsMode(mode: string): void {
  try { window.localStorage.setItem(VS_MODE_STORAGE_KEY, mode); } catch { /* private window */ }
}

// ── Days and clocks (the Daily Battle and Bot of the Day are UTC-seeded) ─────

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** HH:MM:SS to the next UTC midnight. */
export function utcCountdown(now = new Date()): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const s = Math.max(0, Math.floor((next - now.getTime()) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** Whole hours left on a challenge, at least 1 ("17"). */
export function hoursLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - now) / 3_600_000));
}

// ── Today's Daily Battle ────────────────────────────────────────────────────

/** Local key for a Daily Battle a bot stepped into (spec §1/§6). */
export function botDailyKey(dayUtc: string): string {
  return `wordocious-vs-daily-${dayUtc}`;
}

export interface BotDailyResult { result: 'won' | 'lost' | 'draw'; opponent: string }

export function readBotDaily(dayUtc: string): BotDailyResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(botDailyKey(dayUtc));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && (v.result === 'won' || v.result === 'lost' || v.result === 'draw') ? { result: v.result, opponent: String(v.opponent ?? '') } : null;
  } catch {
    return null;
  }
}

export function writeBotDaily(dayUtc: string, r: BotDailyResult): void {
  try { window.localStorage.setItem(botDailyKey(dayUtc), JSON.stringify(r)); } catch { /* non-fatal */ }
}

/** A daily_results 'vs' row → the battle's state: wins → won, losses → lost, a played game with neither → draw. */
export function battleFromRow(row: { vs_wins?: number | null; vs_losses?: number | null; vs_games?: number | null } | null): VsDayResult {
  if (!row) return 'open';
  if ((row.vs_wins ?? 0) > 0) return 'won';
  if ((row.vs_losses ?? 0) > 0) return 'lost';
  return (row.vs_games ?? 0) > 0 ? 'draw' : 'open';
}

/**
 * Today's Daily Battle: the person row wins if both exist; otherwise the bot
 * that stepped in. `personName` is the human opponent's username when known.
 */
export function todaysBattle(
  row: Parameters<typeof battleFromRow>[0],
  personName: string | null,
  bot: BotDailyResult | null,
): { result: VsDayResult; opponent: string | null } {
  const person = battleFromRow(row);
  if (person !== 'open') return { result: person, opponent: personName ? `@${personName}` : null };
  if (bot) return { result: bot.result, opponent: bot.opponent || null };
  return { result: 'open', opponent: null };
}

/** A TODAY tile's line: "Classic · open", "Beat @kate", "Lost to Lexi", "Draw with @kate". */
export function todayTileLine(result: VsDayResult, opponent: string | null, openLabel: string, free: boolean): string {
  if (result === 'open') return `${openLabel} · ${free ? 'free' : 'open'}`;
  if (!opponent) return result === 'won' ? 'Won' : result === 'lost' ? 'Lost' : 'Draw';
  if (result === 'won') return `Beat ${opponent}`;
  if (result === 'lost') return `Lost to ${opponent}`;
  return `Draw with ${opponent}`;
}

// ── Records (exactly the Stats page's VS section sums) ──────────────────────

export function sumRecord(rows: Array<{ play_type: string; wins?: number | null; losses?: number | null }>, playType: 'vs' | 'vs_cpu'): WinLoss {
  let wins = 0, losses = 0;
  for (const r of rows) {
    if (r.play_type !== playType) continue;
    wins += r.wins || 0;
    losses += r.losses || 0;
  }
  return { wins, losses };
}

// ── Lobby lines ─────────────────────────────────────────────────────────────

/** The nav's honest count: "3 looking" (green) when anyone waits, else "41 online" (gray). */
export function lobbyCount(waiting: number, online: number | null): { text: string; live: boolean } | null {
  if (waiting > 0) return { text: `${waiting} looking`, live: true };
  if (online === null) return null;
  return { text: `${online.toLocaleString()} online`, live: false };
}

export function liveTileSub(waiting: number, mode: string): string {
  return waiting > 0 ? `${waiting} waiting now in ${modeTitle(mode)}.` : '0 waiting now. A bot steps in at 0:15.';
}

const botName = (id: string) => botCastMember(id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1);

export function botsTileSub(cleared: number): string {
  if (cleared >= LADDER_BOTS.length) return 'Ladder cleared!';
  return `Ladder ${cleared} of ${LADDER_BOTS.length}. ${botName(LADDER_BOTS[cleared])} is next.`;
}

/** The ladder's next bot as a CpuKind (Umi, the adaptive one, once the ladder is cleared). */
export function ladderNextKind(cleared: number): CpuKind {
  if (cleared >= LADDER_BOTS.length) return 'umi';
  return LADDER_BOTS[Math.max(0, cleared)];
}

/** "Classic · solved in 4 · 1:52 · 17h left" / "Classic · not solved · 17h left". */
export function incomingLine(gameMode: string, run: Pick<VsRun, 'solved' | 'guesses' | 'timeMs'>, expiresAt: string, now = Date.now()): string {
  const left = `${hoursLeft(expiresAt, now)}h left`;
  return run.solved
    ? `${modeTitle(gameMode)} · solved in ${run.guesses} · ${vsClock(run.timeMs)} · ${left}`
    : `${modeTitle(gameMode)} · not solved · ${left}`;
}

/** A Rivals / friends head-to-head line: "You lead 4–3", "You trail 1–2", "Even 2–2" (+ " · last: QuadWord"). */
export function h2hLine(wins: number, losses: number, lastMode?: string | null): { text: string; ahead: boolean } {
  const base = wins > losses ? `You lead ${wins}–${losses}` : wins < losses ? `You trail ${wins}–${losses}` : `Even ${wins}–${losses}`;
  return { text: lastMode ? `${base} · last: ${modeTitle(lastMode)}` : base, ahead: wins > losses };
}

/** A friend row's line on the Friend page: the H2H, or "Never played · new friend". */
export function friendLine(wins: number, losses: number): string {
  return wins + losses === 0 ? 'Never played · new friend' : h2hLine(wins, losses).text;
}

export interface SentChallenge {
  code: string;
  gameMode: string;
  createdAt: string;
  expiresAt: string;
  invitees: number;
  results: Array<{ username: string; outcome: 'win' | 'loss' | 'draw'; guesses: number; timeMs: number; solved: boolean }>;
}

/** "Classic · sent to 2" (a link-only challenge reads "Classic · link"). */
export function sentLabel(s: Pick<SentChallenge, 'gameMode' | 'invitees'>): string {
  return s.invitees > 0 ? `${modeTitle(s.gameMode)} · sent to ${s.invitees}` : `${modeTitle(s.gameMode)} · link`;
}

/** The right side of a YOUR CHALLENGES row. Outcomes are already from the sender's side. */
export function sentStatus(s: Pick<SentChallenge, 'results'>): string {
  const r = s.results[0];
  if (!r) return 'waiting';
  const more = s.results.length > 1 ? ` +${s.results.length - 1}` : '';
  if (r.outcome === 'loss') return `@${r.username} beat it${more}`;
  if (r.outcome === 'win') return `@${r.username} lost${more}`;
  return `@${r.username} tied${more}`;
}

/** Sent in the last 24 hours (the lobby only lists those). */
export function recentSent(sent: SentChallenge[], now = Date.now()): SentChallenge[] {
  return sent.filter((s) => now - new Date(s.createdAt).getTime() < 24 * 3_600_000);
}

/** The Friend page CTA: "PLAY, THEN SEND TO 2 FRIENDS" / "… TO 1 FRIEND" / "PLAY, THEN SHARE A LINK". */
export function friendCta(friends: number, link: boolean): string {
  if (friends > 0) return `PLAY, THEN SEND TO ${friends} ${friends === 1 ? 'FRIEND' : 'FRIENDS'}`;
  if (link) return 'PLAY, THEN SHARE A LINK';
  return 'PLAY, THEN SEND';
}

/** The challenge-send game's opponent panel line. */
export function sendPanelLine(friends: number, link: boolean): string {
  if (friends > 0) return `${friends} ${friends === 1 ? 'friend' : 'friends'} will race it`;
  return link ? 'Anyone with the link' : '';
}

/** The CHALLENGE SENT sub line: "CLASSIC · SOLVED IN 4 · 1:52 · 24H TO RACE". */
export function challengeSentSub(gameMode: string, run: Pick<VsRun, 'solved' | 'guesses' | 'timeMs'>): string {
  const title = modeTitle(gameMode).toUpperCase();
  return run.solved
    ? `${title} · SOLVED IN ${run.guesses} · ${vsClock(run.timeMs)} · 24H TO RACE`
    : `${title} · NOT SOLVED · 24H TO RACE`;
}

/** The race intro's target: "Solved in 4 · 1:52" or "Not solved — just solve it". */
export function raceTarget(run: Pick<VsRun, 'solved' | 'guesses' | 'timeMs'>): string {
  return run.solved ? `Solved in ${run.guesses} · ${vsClock(run.timeMs)}` : 'Not solved — just solve it';
}

/** The share text for a challenge link. */
export function challengeShareText(gameMode: string, code: string): string {
  return `Race my Wordocious ${modeTitle(gameMode)} run — code ${code}`;
}

// ── "Ping me when someone's looking" (§13) ──────────────────────────────────

/** The live search row's label. */
export function lookingRowLabel(gameMode: string): string {
  return `Ping me when someone’s looking for ${modeTitle(gameMode)}`;
}

/** The opt-in reads ON only when vsLooking is exactly true (a missing key is OFF). */
export function vsLookingOn(prefs: Record<string, unknown> | null | undefined): boolean {
  return prefs?.vsLooking === true;
}

/**
 * The step-in card line under the buttons after KEEP WAITING pinged (§13).
 * Null (throttled, failed, or not pinged) leaves the card's `We'll keep looking`.
 */
export function keepWaitingPingLine(ping: { pinged: number; throttled: boolean } | null): string | null {
  if (!ping || ping.throttled) return null;
  if (ping.pinged <= 0) return 'Nobody has pings on yet. We’ll keep looking.';
  return ping.pinged === 1 ? 'We pinged 1 player who plays live.' : `We pinged ${ping.pinged} players who play live.`;
}

// ── Rivals (head-to-head from the shared `matches` rows) ────────────────────

export interface RivalRow { opponentId: string; wins: number; losses: number; draws: number; total: number; lastMode: string | null }

/**
 * Fold `matches` rows (newest first) into per-opponent records: most-played
 * first, with the mode of the latest meeting. Rows without a second player
 * are solo games and are skipped.
 */
export function aggregateRivals(
  rows: Array<{ player1_id: string; player2_id: string | null; winner_id: string | null; game_mode: string | null }>,
  userId: string,
  limit = 3,
): RivalRow[] {
  const map = new Map<string, RivalRow>();
  for (const m of rows) {
    if (!m.player2_id) continue;
    const opp = m.player1_id === userId ? m.player2_id : m.player1_id;
    if (!opp || opp === userId) continue;
    const e = map.get(opp) ?? { opponentId: opp, wins: 0, losses: 0, draws: 0, total: 0, lastMode: m.game_mode };
    if (m.winner_id === userId) e.wins++;
    else if (m.winner_id) e.losses++;
    else e.draws++;
    e.total++;
    map.set(opp, e);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

// ── Result mini boards ──────────────────────────────────────────────────────

/** Wordle coloring of one guess against a solution (two passes, duplicate letters honored). */
export function rowStates(solution: string, guess: string): Array<'correct' | 'present' | 'absent'> {
  const sol = solution.toUpperCase().split('');
  const g = guess.toUpperCase().split('').slice(0, sol.length);
  const out: Array<'correct' | 'present' | 'absent'> = sol.map(() => 'absent');
  const left: Record<string, number> = {};
  sol.forEach((c, i) => { if (g[i] !== c) left[c] = (left[c] ?? 0) + 1; });
  sol.forEach((c, i) => { if (g[i] === c) out[i] = 'correct'; });
  g.forEach((c, i) => {
    if (out[i] === 'correct') return;
    if ((left[c] ?? 0) > 0) { out[i] = 'present'; left[c]--; }
  });
  return out;
}
