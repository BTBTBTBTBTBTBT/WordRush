import solutions from '@/data/solutions.json';

/**
 * Original, deterministic per-word insights computed from Wordocious's OWN
 * curated answer bank (data/solutions.json) — letter-frequency context,
 * near-miss neighbors, anagrams, and a difficulty read. This is first-party
 * analysis no dictionary site has, and it renders as real prose on the
 * /word/[date] archive pages (server-side, crawlable).
 *
 * Everything derives from the 5-letter curated list at module load — a few
 * hundred KB of one-time work, cached for the life of the process.
 */

const BANK: string[] = (solutions as string[]).map((w) => w.toUpperCase());
const BANK_SET = new Set(BANK);

/** % of bank answers containing each letter (at least once), descending rank. */
const LETTER_PCT: Map<string, number> = (() => {
  const counts = new Map<string, number>();
  for (const w of BANK) {
    for (const ch of new Set(w.split(''))) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  const pct = new Map<string, number>();
  for (const [ch, n] of counts) pct.set(ch, Math.round((n / BANK.length) * 100));
  return pct;
})();

const LETTER_RANK: Map<string, number> = (() => {
  const sorted = [...LETTER_PCT.entries()].sort((a, b) => b[1] - a[1]);
  return new Map(sorted.map(([ch], i) => [ch, i + 1]));
})();

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export interface WordInsights {
  /** Per-letter frequency prose, e.g. "R appears in 38% of answers (6th most common)". */
  letterFacts: { letter: string; pct: number; rank: number }[];
  /** Bank words differing from this word by exactly one letter (same positions). */
  neighbors: string[];
  /** Bank words that are anagrams of this word. */
  anagrams: string[];
  /** How many bank answers share the first two letters. */
  sameStartCount: number;
  prefix: string;
  /** 1 (easy) – 5 (hard) with a one-line justification. */
  difficulty: number;
  difficultyLabel: string;
  difficultyWhy: string;
}

const DIFF_LABELS = ['very approachable', 'approachable', 'moderate', 'tricky', 'brutal'];

export function wordInsights(word: string): WordInsights {
  const w = word.toUpperCase();
  const letters = w.split('');
  const unique = [...new Set(letters)];

  const letterFacts = unique
    .map((letter) => ({ letter, pct: LETTER_PCT.get(letter) ?? 0, rank: LETTER_RANK.get(letter) ?? 26 }))
    .sort((a, b) => a.rank - b.rank);

  // Neighbors: same length, exactly one differing position. O(bank × len) once
  // per page render — trivial at this scale.
  const neighbors: string[] = [];
  if (w.length === 5) {
    for (const cand of BANK) {
      if (cand === w) continue;
      let diff = 0;
      for (let i = 0; i < 5 && diff < 2; i++) if (cand[i] !== w[i]) diff++;
      if (diff === 1) neighbors.push(cand);
      if (neighbors.length >= 8) break;
    }
  }

  const sortKey = (s: string) => s.split('').sort().join('');
  const wKey = sortKey(w);
  const anagrams = w.length === 5 ? BANK.filter((c) => c !== w && sortKey(c) === wKey).slice(0, 4) : [];

  const prefix = w.slice(0, 2);
  const sameStartCount = BANK.filter((c) => c !== w && c.startsWith(prefix)).length;

  // Difficulty: repeats, rare letters, neighbor pressure, letter commonness.
  const repeats = letters.length - unique.length;
  const avgRank = letterFacts.reduce((s, f) => s + f.rank, 0) / letterFacts.length;
  let score = 1;
  if (repeats > 0) score += 1.25;
  if (letterFacts.some((f) => f.rank >= 20)) score += 1;
  if (neighbors.length >= 4) score += 1;
  else if (neighbors.length >= 2) score += 0.5;
  if (avgRank > 12) score += 0.75;
  const difficulty = Math.max(1, Math.min(5, Math.round(score)));

  const why: string[] = [];
  if (repeats > 0) why.push('the repeated letter hides one position');
  if (letterFacts.some((f) => f.rank >= 20)) why.push('it uses at least one genuinely rare letter');
  if (neighbors.length >= 4) why.push(`${neighbors.length}+ near-miss answers compete for the same greens`);
  if (why.length === 0) why.push('its letters are common and no close neighbors compete with it');

  return {
    letterFacts,
    neighbors,
    anagrams,
    sameStartCount,
    prefix,
    difficulty,
    difficultyLabel: DIFF_LABELS[difficulty - 1],
    difficultyWhy: why.join(', and '),
  };
}

/** Bank size, for prose ("across the N curated Wordocious answers"). */
export const BANK_SIZE = BANK.length;

/** True if the (uppercased) word is in the current curated bank. */
export function inCurrentBank(word: string): boolean {
  return BANK_SET.has(word.toUpperCase());
}

export { ordinal };
