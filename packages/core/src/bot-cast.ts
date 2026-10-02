// The bot cast (founder-approved finishing build, docs/FINISH_SPEC.md D1–D2,
// 2026-10-02): the VS bots ARE the ten WORDOCIOUS characters, on a ten-rung
// ladder (three wins in a row clear a rung). Shared by web, iOS and Android —
// the Swift and Kotlin ports mirror THIS table exactly (vs-lobby-fixtures.json
// pins the ladder words).
//
// ┌──────┬─────────┬──────┬─────────┬──────────┬────────────┬───────────────────────────┐
// │ rung │ id      │ name │ cast id │ tier     │ guesses    │ trait                     │
// ├──────┼─────────┼──────┼─────────┼──────────┼────────────┼───────────────────────────┤
// │  1   │ rip     │ Rip  │ r       │ easy     │ 6–6        │ easy going                │
// │  2   │ ivy     │ Ivy  │ i       │ easy     │ 5–6        │ shy but steady            │
// │  3   │ ollie   │ Ollie│ o1      │ easy     │ 5–5        │ cheerful                  │
// │  4   │ opal    │ Opal │ o2      │ medium   │ 4–5        │ a little dramatic         │
// │  5   │ cosmo   │ Cosmo│ c       │ medium   │ 4–5        │ bold openers              │
// │  6   │ umi     │ Umi  │ u       │ adaptive │ (adaptive) │ matches your form         │
// │  7   │ ozzy    │ Ozzy │ o3      │ medium   │ 4–5        │ tricky guesses            │
// │  8   │ dewey   │ Dewey│ d       │ hard     │ 3–4        │ studious                  │
// │  9   │ scoot   │ Scoot│ s       │ hard     │ 2–4        │ fast                      │
// │ 10   │ webster │ Webster│ w     │ hard     │ 2–3        │ the boss                  │
// └──────┴─────────┴──────┴─────────┴──────────┴────────────┴───────────────────────────┘
//
// `tier` is the old engine difficulty each bot borrows (its think time per
// guess and its miss chance); `guesses` narrows the tier's solve range to the
// bot's own. Umi has no fixed range: the adaptive engine shadows the player.
// "Your Ghost" (the player's best run, replayed) is not part of the cast and
// keeps its id `ghost`.
//
// Old ids (before 2026-10-02) map by difficulty, so old matches and stats keep
// counting: rook → ivy, lexi → opal, nova → dewey, adapt → umi. The old
// four-rung ladder's cleared count N (0–4 over rook, lexi, nova, adapt) becomes
// the new cleared count [0, 2, 4, 7, 10][N] (the run in progress resets to 0).
//
// Bot of the Day rotates with the Leaderboard day host (UTC weekday of the
// day's date): Sun ozzy · Mon dewey · Tue ivy · Wed umi · Thu scoot · Fri opal
// · Sat ollie.

export type BotCastId = 'rip' | 'ivy' | 'ollie' | 'opal' | 'cosmo' | 'umi' | 'ozzy' | 'dewey' | 'scoot' | 'webster';

/** The old engine tier a cast bot borrows. */
export type BotCastTier = 'easy' | 'medium' | 'hard' | 'adaptive';

/** The mascot / pose id each bot draws (lib/mascots, art-pose-<castId>-*). */
export type BotCastLetter = 'r' | 'i' | 'o1' | 'o2' | 'c' | 'u' | 'o3' | 'd' | 's' | 'w';

export interface BotCastMember {
  id: BotCastId;
  name: string;
  /** The character it is (mascot / pose art id). */
  castId: BotCastLetter;
  /** Ladder rung, 1–10. */
  rung: number;
  tier: BotCastTier;
  /** The solve range in guesses (Classic), or null for the adaptive bot. */
  guesses: readonly [number, number] | null;
  /** One short line about how it plays. */
  trait: string;
  /** Its accent color (the character's own color). */
  color: string;
}

/** The ten bots in ladder order. */
export const BOT_CAST: readonly BotCastMember[] = [
  { id: 'rip', name: 'Rip', castId: 'r', rung: 1, tier: 'easy', guesses: [6, 6], trait: 'Easy going', color: '#22c55e' },
  { id: 'ivy', name: 'Ivy', castId: 'i', rung: 2, tier: 'easy', guesses: [5, 6], trait: 'Shy but steady', color: '#10b981' },
  { id: 'ollie', name: 'Ollie', castId: 'o1', rung: 3, tier: 'easy', guesses: [5, 5], trait: 'Cheers every guess', color: '#f97316' },
  { id: 'opal', name: 'Opal', castId: 'o2', rung: 4, tier: 'medium', guesses: [4, 5], trait: 'A little dramatic', color: '#ec4899' },
  { id: 'cosmo', name: 'Cosmo', castId: 'c', rung: 5, tier: 'medium', guesses: [4, 5], trait: 'Bold openers', color: '#0ea5e9' },
  { id: 'umi', name: 'Umi', castId: 'u', rung: 6, tier: 'adaptive', guesses: null, trait: 'Matches your form', color: '#8b5cf6' },
  { id: 'ozzy', name: 'Ozzy', castId: 'o3', rung: 7, tier: 'medium', guesses: [4, 5], trait: 'Tricky guesses', color: '#eab308' },
  { id: 'dewey', name: 'Dewey', castId: 'd', rung: 8, tier: 'hard', guesses: [3, 4], trait: 'Studies every letter', color: '#2563eb' },
  { id: 'scoot', name: 'Scoot', castId: 's', rung: 9, tier: 'hard', guesses: [2, 4], trait: 'Lightning fast', color: '#ef4444' },
  { id: 'webster', name: 'Webster', castId: 'w', rung: 10, tier: 'hard', guesses: [2, 3], trait: 'The boss', color: '#7c3aed' },
];

export const BOT_CAST_IDS: readonly BotCastId[] = BOT_CAST.map((b) => b.id);

const BY_ID: Record<string, BotCastMember> = Object.fromEntries(BOT_CAST.map((b) => [b.id, b]));

/** Old bot ids → their cast replacement (by difficulty). */
export const LEGACY_BOT_IDS: Readonly<Record<string, BotCastId>> = { rook: 'ivy', lexi: 'opal', nova: 'dewey', adapt: 'umi' };

/** Old ladder cleared count N (0–4) → the new cleared count. */
export const LEGACY_LADDER_CLEARED: readonly number[] = [0, 2, 4, 7, 10];

/**
 * A bot id in the current cast: old ids map (rook → ivy, …); cast ids, `ghost`,
 * `daily` and anything unknown pass through unchanged.
 */
export function canonicalBotId(id: string): string {
  return LEGACY_BOT_IDS[id] ?? id;
}

/** The cast member for an id (old ids map first), or null (ghost, daily, unknown). */
export function botCastMember(id: string | null | undefined): BotCastMember | null {
  if (!id) return null;
  return BY_ID[canonicalBotId(id)] ?? null;
}

/** "Solves in 5–6" / "Solves in 6" / "Matches your form" (adaptive). */
export function botSolveLine(b: BotCastMember): string {
  if (!b.guesses) return 'Matches your form';
  const [lo, hi] = b.guesses;
  return lo === hi ? `Solves in ${lo}` : `Solves in ${lo}–${hi}`;
}

/** The new ladder cleared count for an old (four-rung) one; already-new counts stay. */
export function migrateLegacyLadderCleared(oldCleared: number): number {
  const n = Math.max(0, Math.min(LEGACY_LADDER_CLEARED.length - 1, Math.floor(oldCleared)));
  return LEGACY_LADDER_CLEARED[n];
}

/** Bot of the Day by UTC weekday, Sunday first (Date#getUTCDay order). */
export const BOT_OF_DAY_BY_WEEKDAY: readonly BotCastId[] = ['ozzy', 'dewey', 'ivy', 'umi', 'scoot', 'opal', 'ollie'];

/** Today's Bot of the Day for a YYYY-MM-DD day (the UTC day the Bot of the Day is seeded on). */
export function botOfTheDay(day: string): BotCastMember {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
  return BY_ID[BOT_OF_DAY_BY_WEEKDAY[Number.isFinite(wd) ? wd : 0]];
}
