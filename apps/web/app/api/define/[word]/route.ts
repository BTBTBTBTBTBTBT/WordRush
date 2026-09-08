import { NextResponse } from 'next/server';
import { dictEntry } from '@/lib/word-of-day';

/**
 * One word's dictionary entry, for the client-side victory / post-game cards.
 *
 * §255 (founder: "the screens all take a long time to load"): the client hook
 * used to import dictEntry — and with it the whole 2.3 MB word-definitions.json
 * — straight into the browser bundle of every game page. §250 had tripled that
 * file. The dataset belongs on the server; the browser asks for ONE word.
 *
 * Local-first, same as before: the committed dataset answers instantly; the
 * free dictionary API is only a fallback for the rare uncovered word, and a
 * dead API just yields 404 rather than a hung request. Node runtime — the
 * dataset is too large for an edge function (see /api/words).
 */
export const runtime = 'nodejs';

const CACHE = { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' };

export async function GET(_req: Request, { params }: { params: { word: string } }) {
  const word = decodeURIComponent(params.word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!word || word.length > 20) return NextResponse.json(null, { status: 400 });

  const local = dictEntry(word);
  if (local && local.senses.length > 0) {
    return NextResponse.json(
      { phonetic: local.phonetic, partOfSpeech: local.senses[0].pos, definition: local.senses[0].def },
      { headers: CACHE },
    );
  }

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const data = await res.json();
      const entry = data?.[0];
      const meaning = entry?.meanings?.[0];
      const def = meaning?.definitions?.[0]?.definition || '';
      if (def) {
        return NextResponse.json(
          {
            phonetic: entry.phonetics?.find((p: { text?: string }) => p.text)?.text || entry.phonetic || '',
            partOfSpeech: meaning?.partOfSpeech || '',
            definition: def,
          },
          { headers: CACHE },
        );
      }
    }
  } catch { /* outage — fall through to 404 */ }
  return NextResponse.json(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=3600' } });
}
