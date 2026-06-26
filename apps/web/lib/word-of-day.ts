import solutions from '@/data/solutions.json';

/**
 * Word of the Day — the deterministic daily word (from the shared solutions list,
 * indexed by UTC day) plus its dictionary definition. The home card and the public
 * /word/[date] archive both derive the word the SAME way so they always agree.
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

/** UTC days since the Unix epoch — the daily index (matches the home WordOfTheDay). */
export function daysSinceEpoch(date: Date): number {
  return Math.floor(date.getTime() / 86400000);
}

/** `YYYY-MM-DD` (UTC) for a date — the archive URL key. */
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse a `YYYY-MM-DD` key into a UTC Date, or null if malformed. */
export function parseDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Deterministic candidate words for a date: today's index + the next 19 offsets. */
export function candidateWords(date: Date): string[] {
  const idx = daysSinceEpoch(date);
  return Array.from({ length: 20 }, (_, o) => solutions[(idx + o) % solutions.length]);
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

/** The last `count` dates ending today (UTC), newest first — for the archive index. */
export function recentDates(count: number, today: Date = new Date()): Date[] {
  const base = daysSinceEpoch(today);
  return Array.from({ length: count }, (_, i) => new Date((base - i) * 86400000));
}
