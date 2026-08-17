import { getSolutionPoolForDate, getSolutionPoolForLengthAndDate } from './dictionary';

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ── Deck dealing (§215) ─────────────────────────────────────────────────────
// Independent hash draws gave every daily a uniform-random word WITH
// replacement: ~43 draws/day from one shared bank made birthday collisions
// routine (60 simulated days: 639 of 2,400 words dealt twice+, BRAWL ×6 —
// Doug's DECOY/SPARE complaint). Post-cutover daily seeds instead deal from a
// deterministic shuffled deck: one Fisher–Yates permutation of the pool per
// "epoch", with every daily mode assigned a fixed, non-overlapping slice of
// each day's deals. No answer repeats anywhere across the 5-letter dailies
// (solo + daily VS) until the deck reshuffles (~40 days), and a day's ~43
// words are all distinct by construction.
//
// The cutover is a HARD engine-behavior gate, like SOLUTIONS_CUTOVER_DATE:
// clients older than this constant resolve post-cutover seeds to different
// words. Ship all three platforms before the date arrives.
export const DECK_CUTOVER_DATE = '2026-08-24';

type DeckDeal = { offset: number; count: number };

// FROZEN deal table — offsets are cumulative and MUST never be reordered or
// resized for existing modes (that would reshuffle every future daily). New
// daily modes append at the end and bump the total, which shifts nothing on
// or before the day the addition ships only if it also rides a cutover —
// treat any change here as a new DECK_CUTOVER_DATE.
const DECK_DEALS_5: Record<string, DeckDeal> = {
  DUEL: { offset: 0, count: 1 },
  QUORDLE: { offset: 1, count: 4 },
  OCTORDLE: { offset: 5, count: 8 },
  SEQUENCE: { offset: 13, count: 4 },
  RESCUE: { offset: 17, count: 4 },
  GAUNTLET: { offset: 21, count: 21 },
  DUEL_VS: { offset: 42, count: 1 },
};
const DECK_TOTAL_5 = 43;
const DECK_DEALS_6: Record<string, DeckDeal> = { DUEL_6: { offset: 0, count: 1 } };
const DECK_DEALS_7: Record<string, DeckDeal> = { DUEL_7: { offset: 0, count: 1 } };

/** mulberry32 PRNG — 32-bit state, returns uint32. The Swift/Kotlin ports
 *  replicate this exactly (wrapping 32-bit adds/multiplies + unsigned
 *  shifts); it is as parity-critical as simpleHash. */
function mulberry32(seedValue: number): () => number {
  let a = seedValue | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

const deckPermCache = new Map<string, number[]>();

/** Fisher–Yates permutation of [0, poolSize) seeded from the epoch number. */
function deckPermutation(poolSize: number, epoch: number, lengthKey: number): number[] {
  const key = `${lengthKey}:${epoch}:${poolSize}`;
  const cached = deckPermCache.get(key);
  if (cached) return cached;
  const perm = Array.from({ length: poolSize }, (_, i) => i);
  const rand = mulberry32(simpleHash(`deck-${lengthKey}-${epoch}`));
  for (let i = poolSize - 1; i > 0; i--) {
    const j = rand() % (i + 1);
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  deckPermCache.set(key, perm);
  return perm;
}

/** Whole days from DECK_CUTOVER_DATE to `date` (both `YYYY-MM-DD`, UTC math);
 *  null when the date doesn't parse. */
function deckDayIndex(date: string): number | null {
  const from = Date.parse(`${DECK_CUTOVER_DATE}T00:00:00Z`);
  const to = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(to)) return null;
  return Math.round((to - from) / 86400000);
}

/**
 * Deck-dealt words for a post-cutover daily seed, or null when the seed isn't
 * one (pre-cutover, unlimited/match/replacement seeds, unknown mode, or a
 * count that doesn't match the frozen table — all of which keep the legacy
 * hash path). Epochs are aligned to whole days (floor(pool/total) days per
 * epoch) so a day's deals always come from ONE permutation.
 */
function deckSolutions(
  seed: string,
  count: number,
  pool: string[],
  deals: Record<string, DeckDeal>,
  dailyTotal: number,
  lengthKey: number,
): string[] | null {
  const parts = seed.split('-');
  // Exactly daily-YYYY-MM-DD-MODE: suffixed seeds (gauntlet blackout
  // replacements, etc.) must never collide with the day's real deals.
  if (parts.length !== 5 || parts[0] !== 'daily') return null;
  const date = `${parts[1]}-${parts[2]}-${parts[3]}`;
  if (date < DECK_CUTOVER_DATE) return null;
  const deal = deals[parts[4]];
  if (!deal || deal.count !== count) return null;
  const daysPerEpoch = Math.floor(pool.length / dailyTotal);
  if (daysPerEpoch < 1) return null;
  const dayIndex = deckDayIndex(date);
  if (dayIndex === null || dayIndex < 0) return null;
  const epoch = Math.floor(dayIndex / daysPerEpoch);
  const perm = deckPermutation(pool.length, epoch, lengthKey);
  const base = (dayIndex % daysPerEpoch) * dailyTotal + deal.offset;
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(pool[perm[base + i]]);
  return out;
}
// ────────────────────────────────────────────────────────────────────────────

export function generateSolutionsFromSeed(seed: string, count: number): string[] {
  const solutions: string[] = [];
  // Answer pool is chosen by the DATE embedded in the seed (never wall clock),
  // so every client resolves the same seed to the same pool: pre-cutover daily
  // dates → legacy list, post-cutover dailies + all non-daily seeds → curated.
  const pool = getSolutionPoolForDate(getDailySeedDate(seed));
  // Post-DECK_CUTOVER_DATE dailies deal from the shuffled deck (§215);
  // everything else (unlimited, match, replacement seeds) keeps hashing.
  const deck = deckSolutions(seed, count, pool, DECK_DEALS_5, DECK_TOTAL_5, 5);
  if (deck) return deck;
  const solutionCount = pool.length;
  const used = new Set<number>();

  for (let i = 0; i < count; i++) {
    const seedWithIndex = `${seed}-${i}`;
    let hash = simpleHash(seedWithIndex);
    let attempts = 0;

    while (used.has(hash % solutionCount) && attempts < solutionCount) {
      hash = simpleHash(`${seedWithIndex}-${attempts}`);
      attempts++;
    }

    const index = hash % solutionCount;
    used.add(index);
    solutions.push(pool[index % solutionCount]);
  }

  return solutions;
}

export function generateSolutionsFromSeedForLength(seed: string, count: number, wordLength: number): string[] {
  const solutions: string[] = [];
  // Same date-gate as the 5-letter path — pre-cutover Six/Seven dailies keep
  // their legacy words; new dailies + non-daily seeds use the curated list.
  const pool = getSolutionPoolForLengthAndDate(wordLength, getDailySeedDate(seed));
  // Six/Seven post-cutover dailies deal from their own decks (§215) — one
  // word a day means zero repeats until the whole pool has been dealt.
  const lengthDeals = wordLength === 6 ? DECK_DEALS_6 : wordLength === 7 ? DECK_DEALS_7 : null;
  if (lengthDeals) {
    const deck = deckSolutions(seed, count, pool, lengthDeals, 1, wordLength);
    if (deck) return deck;
  }
  const solutionCount = pool.length;
  const used = new Set<number>();

  for (let i = 0; i < count; i++) {
    const seedWithIndex = `${seed}-${i}`;
    let hash = simpleHash(seedWithIndex);
    let attempts = 0;

    while (used.has(hash % solutionCount) && attempts < solutionCount) {
      hash = simpleHash(`${seedWithIndex}-${attempts}`);
      attempts++;
    }

    const index = hash % solutionCount;
    used.add(index);
    solutions.push(pool[index % solutionCount]);
  }

  return solutions;
}

export function generateMatchSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a deterministic daily seed for a given date and game mode.
 * Everyone playing the same mode on the same day gets the same seed.
 */
export function generateDailySeed(date: string, gameMode: string): string {
  return `daily-${date}-${gameMode}`;
}

/**
 * Check if a seed is a daily seed.
 */
export function isDailySeed(seed: string): boolean {
  return seed.startsWith('daily-');
}

/**
 * Extract the date from a daily seed string.
 */
export function getDailySeedDate(seed: string): string | null {
  if (!isDailySeed(seed)) return null;
  const parts = seed.split('-');
  // daily-YYYY-MM-DD-MODE → date is parts[1]-parts[2]-parts[3]
  if (parts.length >= 4) {
    return `${parts[1]}-${parts[2]}-${parts[3]}`;
  }
  return null;
}
