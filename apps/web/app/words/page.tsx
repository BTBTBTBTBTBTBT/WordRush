import type { Metadata } from 'next';
import Link from 'next/link';
import { recentDates, wordOfDay, dateKey } from '@/lib/word-of-day';
import { LetterTile } from '@/components/game/letter-tile';
import { InfoPageLayout, IntroText } from '@/components/ui/info-page';
import { softBackground, softShadow } from '@/lib/soft-surface';

// FINISH_SPEC BI17 (3-platform parity): the guide page family look — the intro
// as plain copy and the archive rows as borderless soft fields (a purple / pink
// wash, radius 16, one soft shadow), keeping the glossy first-letter tile.
/** Month rows alternate the brand purple and pink washes. */
const ROW_ACCENTS = ['#7C3AED', '#EC4899'] as const;

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Word of the Day Archive — Past Wordocious Answers',
  description:
    'Browse past Wordocious Word of the Day entries, each with pronunciation, meaning, and a letter-by-letter breakdown for word-puzzle players. A new word every day.',
  alternates: { canonical: 'https://wordocious.com/words' },
};

function pretty(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default async function WordsArchivePage() {
  // Full archive back to the feature's first published day (sitemap window is
  // narrower; the hub links everything). Lookups are local-dataset reads, so
  // rendering the whole run is cheap and fully server-side.
  const dates = recentDates(60);
  const rows = await Promise.all(
    dates.map(async (d) => ({ key: dateKey(d), date: d, entry: await wordOfDay(d) })),
  );

  // Group by calendar month for scannable structure (and month sub-headings).
  const months: { label: string; rows: typeof rows }[] = [];
  for (const row of rows) {
    const label = monthLabel(row.date);
    const bucket = months.find((m) => m.label === label);
    if (bucket) bucket.rows.push(row);
    else months.push({ label, rows: [row] });
  }

  return (
    <InfoPageLayout title="Word of the Day" art="art-titlecast-words" artLabel="Word of the Day Archive">
      <div className="flex flex-col gap-2 px-1">
        <IntroText>
          Every day Wordocious surfaces a Word of the Day — a hand-curated five-letter word from the same answer bank the
          daily puzzles draw on. Each entry links to a full breakdown: pronunciation and meaning, synonyms and opposites,
          plus original analysis you won&apos;t find in a dictionary — how often its letters appear across our curated answer
          list, which near-miss answers sit one letter away, a difficulty rating, and the strategy for cracking words like it.
        </IntroText>
        <IntroText>
          It doubles as a vocabulary trainer for the game itself: the letter patterns, repeats, and rare-letter traps
          highlighted here are exactly what the{' '}
          <Link href="/" className="font-bold" style={{ color: '#7c3aed' }}>Daily Challenge</Link> tests. Pair it with the{' '}
          <Link href="/strategy/best-starting-words" className="font-bold" style={{ color: '#7c3aed' }}>starting-word guide</Link>{' '}
          and the <Link href="/guides" className="font-bold" style={{ color: '#7c3aed' }}>mode guides</Link> to turn
          word knowledge into faster solves.
        </IntroText>
      </div>

      {months.map(({ label, rows: monthRows }, mi) => {
        const accent = ROW_ACCENTS[mi % ROW_ACCENTS.length];
        return (
          <section key={label} className="flex flex-col gap-1.5 mt-2">
            <h2 className="m-0 px-1 font-black uppercase" style={{ fontSize: 11, letterSpacing: '1.2px', color: 'var(--color-text)' }}>{label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {monthRows.map(({ key, date, entry }) => (
                <Link
                  key={key}
                  href={`/word/${key}`}
                  // BJ7: tile + word top-aligned, the date line 4 under the word.
                  className="flex items-start gap-2.5 px-3 py-2"
                  style={{ background: softBackground(accent, 0.1), borderRadius: 16, boxShadow: softShadow(accent, 0.1, 12, 4) }}
                >
                  <LetterTile letter={entry.word.charAt(0).toUpperCase()} look="correct" aria-hidden className="shrink-0" style={{ width: 40, ['--gt-font' as string]: '18px' }} />
                  <div className="min-w-0">
                    <div className="font-black truncate" style={{ color: 'var(--color-text)' }}>{entry.word.toUpperCase()}</div>
                    <div className="text-xs font-bold truncate mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {pretty(date)}
                      {entry.partOfSpeech ? ` · ${entry.partOfSpeech}` : ''}
                    </div>
                    {entry.definition && (
                      <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{entry.definition}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <p className="m-0 mt-4 px-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
        Definitions adapted from Wiktionary via the Free Dictionary API (CC BY-SA). Analysis on each word page is original
        Wordocious research.
      </p>
    </InfoPageLayout>
  );
}
