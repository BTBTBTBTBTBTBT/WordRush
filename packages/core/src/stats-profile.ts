// ============================================================
// Stats page + player profile rules (FRIDAY-QUEUE items 16 + 17, 2.8 wave 4)
// ============================================================
// Pure rules shared by web, iOS and Android so the three pages say the SAME words and make the
// SAME decisions: the VS picker's 5-over-4 split, the four hero stats, when the guess chart
// shows, the bots line, the pocket-game records (item 16's POCKET GAMES section + the
// head-to-head rows + the profile's strip), the profile's friendship state + action row, the
// highlights layout, and the cast color each section title wears. The Swift and Kotlin ports
// assert against stats-profile-fixtures.json (scripts/gen-parity-fixtures.ts).

import type { FriendlyKind } from './friendly-games';
import { ADS_SERVING } from './ads';

// ---- VS picker: 9 games, 5 on top and 4 centered under, no swipe --------------------------

export interface PickerSplit<T> { top: T[]; bottom: T[] }

/** 9 -> 5 + 4 (top row always the longer one). Fewer than 6 stay on one row. */
export function pickerSplit<T>(items: readonly T[]): PickerSplit<T> {
  if (items.length <= 5) return { top: [...items], bottom: [] };
  const n = Math.ceil(items.length / 2);
  return { top: items.slice(0, n), bottom: items.slice(n) };
}

// ---- Hero stats ---------------------------------------------------------------------------

/** Win rate as a whole percent; 0 with no games. */
export function winRatePct(wins: number, losses: number): number {
  const total = wins + losses;
  return total > 0 ? Math.round((wins / total) * 100) : 0;
}

/** "16s" / "1m 5s" / "2m" / "—" (none). */
export function formatFastest(seconds: number): string {
  if (!(seconds > 0)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export type HeroKey = 'record' | 'winRate' | 'streak' | 'fastest';

export interface HeroStat {
  key: HeroKey;
  label: string;
  /** The big number text: "3–2", "60%", "2", "16s". */
  value: string;
  /** The small line under it ("Best 4") or null. */
  sub: string | null;
  /** The shipped stat icon (art-stat-<icon>); the win rate wears the ring instead. */
  icon: 'crown' | 'donut' | 'bolt' | 'stopwatch';
}

export interface HeroInput { wins: number; losses: number; streak: number; bestStreak: number; fastestSeconds: number }

/** The four hero stats: Record W–L, Win rate (a ring), Streak with the best small, Fastest. */
export function heroStats(i: HeroInput): HeroStat[] {
  const rate = winRatePct(i.wins, i.losses);
  const played = i.wins + i.losses > 0;
  return [
    { key: 'record', label: 'Record', value: `${i.wins}–${i.losses}`, sub: null, icon: 'crown' },
    { key: 'winRate', label: 'Win rate', value: played ? `${rate}%` : '—', sub: null, icon: 'donut' },
    { key: 'streak', label: 'Streak', value: String(i.streak), sub: i.bestStreak > 0 ? `Best ${i.bestStreak}` : null, icon: 'bolt' },
    { key: 'fastest', label: 'Fastest', value: formatFastest(i.fastestSeconds), sub: null, icon: 'stopwatch' },
  ];
}

/** The guess chart stays hidden until there is a win (no sentence + placeholder icon). */
export function showGuessDistribution(distribution: ReadonlyArray<{ count: number }>): boolean {
  return distribution.some((d) => d.count > 0);
}

// ---- Record bar + bots line ---------------------------------------------------------------

export interface RecordBar { winFrac: number; lossFrac: number; empty: boolean }

/** The two-color bar's split: wins vs losses (draws are ignored). Always sums to 1 unless empty. */
export function recordBar(wins: number, losses: number): RecordBar {
  const t = wins + losses;
  if (t <= 0) return { winFrac: 0, lossFrac: 0, empty: true };
  return { winFrac: wins / t, lossFrac: losses / t, empty: false };
}

/** VS Bots in one line: "26–17 · 60%" (no match count: it is wins + losses). */
export function botsLine(wins: number, losses: number): string {
  if (wins + losses === 0) return 'Beat a bot to start';
  return `${wins}–${losses} · ${winRatePct(wins, losses)}%`;
}

// ---- Pocket games -------------------------------------------------------------------------

/** The finished-game slice the records need (a friendly_games row). */
export interface PocketGameRow {
  kind: FriendlyKind;
  player_a: string;
  player_b: string;
  status: 'active' | 'done' | 'resigned' | 'expired';
  winner: string | null;
  /** Word Chain: how many words the game held (for the best run). */
  chainWords?: number;
}

export interface PocketRecord { wins: number; losses: number; draws: number }
export interface PocketKindRecord extends PocketRecord { kind: FriendlyKind; bestChain: number }

export interface PocketRecords {
  /** One row per pocket game, in the fixed pocket order, zeros included. */
  byKind: PocketKindRecord[];
  /** Per opponent: the total and one record per kind. */
  byFriend: Record<string, { total: PocketRecord; byKind: Partial<Record<FriendlyKind, PocketRecord>> }>;
  total: PocketRecord;
}

export const POCKET_ORDER: readonly FriendlyKind[] = ['rps', 'ttt', 'coin', 'pass', 'ghost', 'chain'];

const emptyRec = (): PocketRecord => ({ wins: 0, losses: 0, draws: 0 });

/** Records for `me` from their finished pocket games (expired / unfinished games do not count). */
export function pocketRecords(rows: readonly PocketGameRow[], me: string): PocketRecords {
  const kinds = new Map<FriendlyKind, PocketKindRecord>(POCKET_ORDER.map((k) => [k, { kind: k, ...emptyRec(), bestChain: 0 }]));
  const byFriend: PocketRecords['byFriend'] = {};
  const total = emptyRec();
  for (const g of rows) {
    if (g.status !== 'done' && g.status !== 'resigned') continue;
    if (g.player_a !== me && g.player_b !== me) continue;
    const opp = g.player_a === me ? g.player_b : g.player_a;
    const k = kinds.get(g.kind);
    if (!k) continue;
    const slot = byFriend[opp] ?? (byFriend[opp] = { total: emptyRec(), byKind: {} });
    const kindSlot = slot.byKind[g.kind] ?? (slot.byKind[g.kind] = emptyRec());
    const bump = (r: PocketRecord) => { if (g.winner === me) r.wins++; else if (g.winner) r.losses++; else r.draws++; };
    bump(k); bump(slot.total); bump(kindSlot); bump(total);
    if (g.kind === 'chain' && g.winner === me && (g.chainWords ?? 0) > k.bestChain) k.bestChain = g.chainWords ?? 0;
  }
  return { byKind: POCKET_ORDER.map((x) => kinds.get(x)!), byFriend, total };
}

/** "3–1" or "3–1–1" with draws; "No games yet" when nothing was played. */
export function pocketLine(r: PocketRecord): string {
  if (r.wins + r.losses + r.draws === 0) return 'No games yet';
  return r.draws > 0 ? `${r.wins}–${r.losses}–${r.draws}` : `${r.wins}–${r.losses}`;
}

/** A pocket game's small second line on the Stats tile: its record, or the best chain for Word Chain. */
export function pocketTileLine(r: PocketKindRecord): string {
  if (r.kind === 'chain' && r.bestChain > 0) return `${pocketLine(r)} · best ${r.bestChain}`;
  return pocketLine(r);
}

// ---- Player profile -----------------------------------------------------------------------

export type FriendshipState = 'self' | 'friends' | 'incoming' | 'requested' | 'none';

/** Which state the viewer sees for a player. */
export function friendshipState(o: { isSelf: boolean; isFriend: boolean; incoming: boolean; requested: boolean }): FriendshipState {
  if (o.isSelf) return 'self';
  if (o.isFriend) return 'friends';
  if (o.incoming) return 'incoming';
  if (o.requested) return 'requested';
  return 'none';
}

export type ProfileAction = 'challenge' | 'pocket' | 'react' | 'addFriend' | 'requested' | 'accept' | 'decline';
export type ProfileMenuAction = 'unfriend' | 'block' | 'report';

export interface ProfileActions {
  /** The family button row, left to right. */
  row: ProfileAction[];
  /** The "⋯" menu (never on your own profile). */
  menu: ProfileMenuAction[];
}

/**
 * Challenge · Pocket game · React · Add friend, by who they are to you:
 * - friends: Challenge · Pocket game · React (Unfriend in the menu)
 * - not friends: a clear Add friend (challenges, pocket games and reactions are for friends)
 * - request sent: Requested (quiet, tap cancels)
 * - they asked you: Accept · Decline right there
 * - yourself: no row
 * Block + Report are always in the menu for someone else; Unfriend only for friends.
 */
export function profileActions(state: FriendshipState): ProfileActions {
  switch (state) {
    case 'self': return { row: [], menu: [] };
    case 'friends': return { row: ['challenge', 'pocket', 'react'], menu: ['unfriend', 'block', 'report'] };
    case 'incoming': return { row: ['accept', 'decline'], menu: ['block', 'report'] };
    case 'requested': return { row: ['requested'], menu: ['block', 'report'] };
    default: return { row: ['addFriend'], menu: ['block', 'report'] };
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "Friends since Sep 2026" from the friendship's ISO time (UTC month), or null without a date. */
export function friendsSinceLine(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `Friends since ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * HIGHLIGHTS never shows a lonely tile with an empty half: under two it folds into Lately;
 * two or more shows as an even 2-column grid (an odd last one is dropped), at most four.
 */
export function highlightsLayout(count: number): { mode: 'fold' | 'grid'; shown: number } {
  if (count < 2) return { mode: 'fold', shown: count };
  const capped = Math.min(count, 4);
  return { mode: 'grid', shown: capped - (capped % 2) };
}

/** The Head-to-Head strip's one line: "VS 3–1 · Pocket 2–2" (a side with no games is left out). */
export function headToHeadLine(vs: PocketRecord, pocket: PocketRecord): string {
  const parts: string[] = [];
  if (vs.wins + vs.losses + vs.draws > 0) parts.push(`Daily scores ${pocketLine(vs)}`);
  if (pocket.wins + pocket.losses + pocket.draws > 0) parts.push(`Pocket games ${pocketLine(pocket)}`);
  return parts.length ? parts.join(' · ') : 'No games together yet';
}

// ---- Section title cast colors ------------------------------------------------------------

/** The cast body colors a section title wears (W purple, C teal, I green, D blue, S gold, R slate, O orange). */
export const CAST_COLORS = { W: '#7c3aed', C: '#0d9488', I: '#16a34a', D: '#2563eb', S: '#f59e0b', R: '#64748b', O: '#f97316' } as const;

/** Stats + profile section titles -> their cast color (unknown titles take the W purple). */
export const SECTION_TITLE_COLORS: Record<string, string> = {
  'MY GAMES': CAST_COLORS.W,
  'HEAD TO HEAD': CAST_COLORS.D,
  'BOTS': CAST_COLORS.C,
  'GUESSES': CAST_COLORS.I,
  'ACTIVITY': CAST_COLORS.O,
  'POCKET GAMES': CAST_COLORS.S,
  'MORE STATS': CAST_COLORS.R,
  'TROPHY CASE': CAST_COLORS.S,
  'HIGHLIGHTS': CAST_COLORS.O,
  'LATELY': CAST_COLORS.C,
  'VS': CAST_COLORS.D,
};

export function sectionTitleColor(title: string): string {
  return SECTION_TITLE_COLORS[title.toUpperCase()] ?? CAST_COLORS.W;
}

// ---- Go Pro scenes (item 20) --------------------------------------------------------------

export type ProBenefit = 'unlimited' | 'items' | 'vsBots' | 'stats' | 'noLimits';

/** One distinct scene per benefit (art-pro-<name>; the pedestal is the free mascot's stage). */
export const PRO_SCENES: Record<ProBenefit, string> = {
  unlimited: 'art-pro-unlimited',
  items: 'art-pro-items',
  vsBots: 'art-pro-vs-bots',
  stats: 'art-pro-stats',
  noLimits: 'art-pro-no-limits',
};
export const PRO_PEDESTAL = 'art-pro-stage-pedestal';

export const PRO_BENEFIT_ORDER: readonly ProBenefit[] = ['unlimited', 'items', 'vsBots', 'stats', 'noLimits'];

/** One line under each benefit's scene (the screen's caption). */
export const PRO_BENEFIT_CAPTION: Record<ProBenefit, string> = {
  unlimited: 'Every game, any time',
  items: 'Wear every Pro mascot item',
  vsBots: 'VS on every game, bots included',
  stats: 'Stats that go deeper',
  noLimits: ADS_SERVING ? 'No limits. No ads.' : 'No limits. No waiting.',
};

/** Which benefit scene a Go Pro request shows, from the reason the surface gave ("Pro mascot styles", "Unlimited QuadWord"). */
export function proBenefitForReason(reason: string | null | undefined): ProBenefit {
  const r = (reason ?? '').toLowerCase();
  if (r.includes('mascot') || r.includes('item') || r.includes('style') || r.includes('dress')) return 'items';
  if (r.includes('unlimited')) return 'unlimited';
  if (r.includes('bot') || r.includes('vs') || r.includes('versus')) return 'vsBots';
  if (r.includes('stat') || r.includes('insight') || r.includes('trend')) return 'stats';
  if (r.includes('no limit') || r.includes('ad-free') || r.includes('ads')) return 'noLimits';
  return 'unlimited';
}
