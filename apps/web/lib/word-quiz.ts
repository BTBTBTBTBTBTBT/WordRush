import { candidateWords, dictEntry, solutionsForDate, dateKey } from '@/lib/word-of-day';
import { rankSenses } from '@/lib/sense-rank';

/**
 * Word of the Day quiz (founder-approved home redesign, 2026-10-01): the card
 * hides the definition and offers three, one real. The two decoys are the
 * leading definitions of OTHER answer-pool words with the same part of speech,
 * so they read like real dictionary lines. Everything is derived from the date,
 * so every player (web, iOS, Android) sees the same three choices in the same
 * order, and the right answer moves around from day to day.
 */

export interface WordQuiz {
  choices: string[];
  answer: number;
  /** The sense the quiz asks about (its part of speech can differ from the card's when the card's leads with a grammar note). */
  partOfSpeech: string;
}

/** FNV-1a: small, stable, and identical everywhere it might be recomputed. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const MAX_LEN = 140;

/** "simple past of stand", "plural of goose": a grammar note, not a meaning; it gives the game away. */
const FORM_OF = /^(simple past|past participle|present participle|plural of|third-person|(an )?alternative (form|spelling)|obsolete (form|spelling)|archaic (form|spelling)|misspelling|comparative form|superlative form|ellipsis of|abbreviation of|initialism of)/i;

/** True when a definition is a real meaning the quiz can use. */
export function isMeaning(def: string): boolean {
  return !!def && !FORM_OF.test(def.trim());
}

/** A decoy has to look like a peer of the real definition and never name the day's word. */
function usable(def: string, target: string, word: string): boolean {
  if (!def || def.length > Math.max(MAX_LEN, target.length * 1.3) || !isMeaning(def)) return false;
  if (def.length < target.length * 0.35 || def.length > Math.max(target.length * 2.6, 48)) return false;
  const lower = def.toLowerCase();
  const stem = word.toLowerCase().slice(0, Math.max(4, word.length - 1));
  return !lower.includes(word.toLowerCase()) && !lower.includes(stem);
}

/**
 * The day's quiz, or null when the day's word has no definition or not enough
 * decoys were found (the card then just shows the definition, as before).
 */
export function wordQuizFor(date: Date, word: string): WordQuiz | null {
  const own = word ? dictEntry(word) : null;
  if (!own) return null;
  // The first ranked sense that is a real meaning ("FIXED" leads with "simple
  // past of fix"; its quiz asks about "Attached; affixed" instead).
  let sense = rankSenses(word, own.senses).find((x) => isMeaning(x.def));
  if (!sense) {
    // Every sense is a grammar note ("simple past of begin", "plural of vibe"):
    // quiz the base word's meaning instead, which is what the player wants to know.
    const base = own.senses.map((x) => /\bof ([a-z]+)/i.exec(x.def)?.[1]).find(Boolean);
    const baseEntry = base ? dictEntry(base) : null;
    sense = baseEntry ? rankSenses(base as string, baseEntry.senses).find((x) => isMeaning(x.def)) : undefined;
  }
  if (!sense) return null;
  const definition = sense.def.trim();
  const partOfSpeech = sense.pos;
  const key = dateKey(date);
  const list = solutionsForDate(date);
  if (list.length < 3) return null;
  const skip = new Set(candidateWords(date).map((w) => w.toUpperCase()));
  skip.add(word.toUpperCase());
  const decoys: string[] = [];
  const seen = new Set([definition.trim().toLowerCase()]);
  const start = hash(`wotd-quiz:${key}`) % list.length;
  // A stride coprime-ish with the list keeps the walk from clustering on neighbors.
  const stride = 7919;
  // First pass: same part of speech, so the decoys read like the real one. A rare
  // part of speech (a determiner) falls back to any part of speech.
  for (const samePos of [true, false]) {
    for (let i = 0; i < list.length && decoys.length < 2; i++) {
      const other = list[(start + i * stride) % list.length];
      if (!other || skip.has(other.toUpperCase())) continue;
      const entry = dictEntry(other);
      if (!entry) continue;
      const [primary] = rankSenses(other, entry.senses);
      if (!primary || (samePos && primary.pos !== partOfSpeech)) continue;
      const def = primary.def.trim();
      if (seen.has(def.toLowerCase()) || !usable(def, definition, word)) continue;
      seen.add(def.toLowerCase());
      decoys.push(def);
    }
  }
  if (decoys.length < 2) return null;
  const answer = hash(`wotd-answer:${key}`) % 3;
  const choices = [...decoys];
  choices.splice(answer, 0, definition);
  return { choices, answer, partOfSpeech };
}
