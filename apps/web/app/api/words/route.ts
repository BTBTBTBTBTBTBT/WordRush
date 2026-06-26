import { NextResponse } from 'next/server';
import { recentDates, wordOfDay, dateKey, wordPlayAnalysis } from '@/lib/word-of-day';

// Word of the Day archive for the native Words screen (iOS + Android). Returns
// the last ~30 days, each with the definition + the same original letter
// analysis the web /word/[date] page renders. Cached a day (the words + their
// dictionary lookups are deterministic per date).
export const runtime = 'edge';
export const revalidate = 86400;

export async function GET() {
  const dates = recentDates(30);
  const words = await Promise.all(
    dates.map(async (d) => {
      const entry = await wordOfDay(d);
      const analysis = wordPlayAnalysis(entry.word);
      return {
        date: dateKey(d),
        word: entry.word,
        phonetic: entry.phonetic ?? '',
        partOfSpeech: entry.partOfSpeech ?? '',
        definition: entry.definition ?? '',
        example: entry.example ?? '',
        extraSenses: entry.extraSenses ?? [],
        analysisSummary: analysis.summary,
        analysisStrategy: analysis.strategy,
      };
    }),
  );
  return NextResponse.json(
    { words },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
