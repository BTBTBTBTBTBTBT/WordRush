import { NextResponse } from 'next/server';
import { parseDateKey, wordOfDay, dateKey } from '@/lib/word-of-day';
import { wordQuizFor } from '@/lib/word-quiz';

/**
 * Today's Word of the Day + definition for the home card, from the committed
 * local dataset — one request, instant, immune to dictionaryapi.dev outages.
 *
 * §255 (founder: "the main screen didn't populate the word of the day or
 * definition, it was blank"): the web home card was the one surface §250
 * missed. It still walked up to TWENTY serial requests to the free dictionary
 * API from the browser, so when that API was down the card hung on its
 * skeleton. The natives, the archive and the victory card had all moved to the
 * local dataset; this brings the home card in line.
 *
 * The client passes ITS local date (the server's clock is UTC on Vercel), and
 * wordOfDay picks the first candidate with a local entry — the same walk the
 * card used to do against the network.
 */
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('date') || dateKey(new Date());
  const date = parseDateKey(key);
  if (!date) return NextResponse.json(null, { status: 400 });
  const e = await wordOfDay(date);
  // Home redesign (founder, 2026-10-01): the card is a three-choice quiz. Every
  // platform reads the same choices from here; null = no quiz today, plain card.
  // After answering, the card shows choices[answer] (the sense the quiz asked about).
  const quiz = wordQuizFor(date, e.word);
  return NextResponse.json(
    { word: e.word, phonetic: e.phonetic || '', partOfSpeech: e.partOfSpeech || '', definition: e.definition || '',
      choices: quiz?.choices ?? null, answer: quiz?.answer ?? null, quizPartOfSpeech: quiz?.partOfSpeech ?? null },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' } },
  );
}
