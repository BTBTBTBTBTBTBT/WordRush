import type { Metadata } from 'next';
import Link from 'next/link';
import { recentDates, wordOfDay, dateKey } from '@/lib/word-of-day';
import { InfoPageHeader } from '@/components/ui/info-page-header';

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
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--color-bg)' }}>
      <InfoPageHeader title="Word of the Day" />
      <div className="max-w-2xl mx-auto px-4 pt-1">
        <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Every day Wordocious surfaces a Word of the Day — a hand-curated five-letter word from the same answer bank the
          daily puzzles draw on. Each entry links to a full breakdown: pronunciation and meaning, synonyms and opposites,
          plus original analysis you won&apos;t find in a dictionary — how often its letters appear across our curated answer
          list, which near-miss answers sit one letter away, a difficulty rating, and the strategy for cracking words like it.
        </p>
        <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
          It doubles as a vocabulary trainer for the game itself: the letter patterns, repeats, and rare-letter traps
          highlighted here are exactly what the{' '}
          <Link href="/" className="font-bold" style={{ color: '#7c3aed' }}>Daily Challenge</Link> tests. Pair it with the{' '}
          <Link href="/strategy/best-starting-words" className="font-bold" style={{ color: '#7c3aed' }}>starting-word guide</Link>{' '}
          and the <Link href="/guides" className="font-bold" style={{ color: '#7c3aed' }}>mode guides</Link> to turn
          word knowledge into faster solves.
        </p>

        {months.map(({ label, rows: monthRows }) => (
          <section key={label} className="mb-6">
            <h2 className="text-sm font-black uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {monthRows.map(({ key, date, entry }) => (
                <Link
                  key={key}
                  href={`/word/${key}`}
                  className="flex items-center gap-3 rounded-xl p-3 transition-transform active:scale-[0.98]"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center text-sm font-black text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                  >
                    {entry.word.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black truncate" style={{ color: 'var(--color-text)' }}>{entry.word.toUpperCase()}</div>
                    <div className="text-xs font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {pretty(date)}
                      {entry.partOfSpeech ? ` · ${entry.partOfSpeech}` : ''}
                    </div>
                    {entry.definition && (
                      <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{entry.definition}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <p className="text-[11px] mt-4" style={{ color: 'var(--color-text-muted)' }}>
          Definitions adapted from Wiktionary via the Free Dictionary API (CC BY-SA). Analysis on each word page is original
          Wordocious research.
        </p>
      </div>
    </div>
  );
}
