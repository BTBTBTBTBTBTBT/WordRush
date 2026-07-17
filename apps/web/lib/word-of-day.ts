import { SOLUTIONS_CUTOVER_DATE } from '@wordle-duel/core';
import solutions from '@/data/solutions.json';
import legacySolutions from '@/data/solutions-legacy.json';

/**
 * Word of the Day — the deterministic daily word (from the shared solutions list,
 * indexed by LOCAL calendar day) plus its dictionary definition. The home card
 * and the public /word/[date] archive both derive the word the SAME way so they
 * always agree.
 *
 * LOCAL, not UTC: the home card (app/page.tsx) and both native home cards index
 * by the viewer's local calendar day. This module briefly used raw-UTC
 * timestamps, which made the archive's "today" run a day ahead of the home card
 * every local evening (between UTC midnight and local midnight).
 */
export interface WordEntry {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  example?: string;
  /** Other senses (part of speech + definition) for a richer archive page. */
  extraSenses?: { partOfSpeech: string; definition: string }[];
}

/** LOCAL-calendar-day number since the Unix epoch — the daily index. Same
 *  formula as the home card (app/page.tsx) and the native home cards. */
export function daysSinceEpoch(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

/** `YYYY-MM-DD` from the LOCAL calendar date — the archive URL key. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` key into a LOCAL-midnight Date, or null if malformed —
 *  so dateKey(parseDateKey(k)) === k and the parsed date indexes the same day. */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Answer list governing a given archive date — legacy for dates before the
 * cutover (so Past Words keeps showing what was actually played), curated
 * after. Keyed on the same LOCAL dateKey the archive uses.
 */
export function solutionsForDate(date: Date): string[] {
  return dateKey(date) < SOLUTIONS_CUTOVER_DATE ? legacySolutions : solutions;
}

/** Deterministic candidate words for a date: today's index + the next 19 offsets. */
export function candidateWords(date: Date): string[] {
  const list = solutionsForDate(date);
  const idx = daysSinceEpoch(date);
  return Array.from({ length: 20 }, (_, o) => list[(idx + o) % list.length]);
}

/**
 * The Word of the Day for a date, with its definition. Tries each candidate until
 * one has a dictionary entry (free dictionaryapi.dev), mirroring the home card.
 * Cached for a day per word so crawler hits don't hammer the API.
 */
export async function wordOfDay(date: Date): Promise<WordEntry> {
  for (const word of candidateWords(date)) {
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`,
        { next: { revalidate: 86400 } },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const entry = data?.[0];
      if (!entry) continue;
      const phonetic: string =
        entry.phonetics?.find((p: { text?: string }) => p.text)?.text || entry.phonetic || '';
      const meanings: { partOfSpeech?: string; definitions?: { definition?: string; example?: string }[] }[] =
        entry.meanings || [];
      const primary = meanings[0];
      const def = primary?.definitions?.[0];
      const definition = def?.definition || '';
      if (!definition) continue;
      const extraSenses = meanings
        .slice(1, 4)
        .map((m) => ({ partOfSpeech: m.partOfSpeech || '', definition: m.definitions?.[0]?.definition || '' }))
        .filter((s) => s.definition);
      return {
        word,
        phonetic,
        partOfSpeech: primary?.partOfSpeech || '',
        definition,
        example: def?.example || '',
        extraSenses,
      };
    } catch {
      // try the next candidate
    }
  }
  return { word: candidateWords(date)[0] };
}

/** The last `count` LOCAL dates ending today, newest first — for the archive
 *  index. Calendar arithmetic (not `- i*86400000` on a timestamp), so DST days
 *  can't skip or repeat a date. */
export function recentDates(count: number, today: Date = new Date()): Date[] {
  return Array.from(
    { length: count },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - i),
  );
}

// ── Original per-word "as a puzzle answer" analysis ───────────────────────────
// Two plain-text paragraphs, deterministic from the word. Shared by the web
// /word/[date] page AND the /api/words endpoint so native renders the exact
// same prose (single source of truth).
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const COMMON = new Set(['E', 'A', 'R', 'I', 'O', 'T', 'N', 'S']);
const RARE = new Set(['J', 'Q', 'X', 'Z', 'V', 'K', 'W']);

export function wordPlayAnalysis(word: string): { summary: string; strategy: string } {
  const w = word.toUpperCase();
  const letters = w.split('');
  const vowels = letters.filter((c) => VOWELS.has(c));
  const consonants = letters.filter((c) => !VOWELS.has(c));
  const unique = new Set(letters);
  const repeats = letters.length - unique.size;
  const commons = [...unique].filter((c) => COMMON.has(c));
  const rares = [...unique].filter((c) => RARE.has(c));

  const summary =
    `${w} is a ${letters.length}-letter word with ${vowels.length} vowel${vowels.length === 1 ? '' : 's'} ` +
    `(${vowels.join(', ') || 'none'}) and ${consonants.length} consonant${consonants.length === 1 ? '' : 's'} ` +
    `(${consonants.join(', ') || 'none'}). ` +
    (repeats > 0
      ? `It repeats ${repeats} letter${repeats === 1 ? '' : 's'}, which is a classic trap — guessers who assume five distinct letters get stuck.`
      : 'Every letter is distinct, so it rarely punishes a clean opening guess.');

  const strategy =
    (commons.length > 0
      ? `It leans on high-frequency letters (${commons.join(', ')}), so a strong vowel-and-common-consonant opener tends to light up quickly. `
      : '') +
    (rares.length > 0
      ? `Watch for the less-common letter${rares.length === 1 ? '' : 's'} ${rares.join(', ')} — saving a guess to test ${rares.length === 1 ? 'it' : 'them'} once the vowels are placed is usually the fastest route.`
      : 'There are no rare letters here, so it is a fair, mid-difficulty answer for the daily Classic puzzle.');

  return { summary, strategy };
}
