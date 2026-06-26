import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { recentDates, wordOfDay, dateKey } from '@/lib/word-of-day';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Word of the Day Archive — Past Wordocious Answers',
  description:
    'Browse past Wordocious Word of the Day answers, each with pronunciation, meaning, and a letter-by-letter breakdown for word-puzzle players. A new word every day.',
  alternates: { canonical: 'https://wordocious.com/words' },
};

function pretty(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default async function WordsArchivePage() {
  const dates = recentDates(30);
  const rows = await Promise.all(
    dates.map(async (d) => ({ key: dateKey(d), date: d, entry: await wordOfDay(d) })),
  );

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>

        <h1 className="text-3xl font-black uppercase mb-2 text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>Word of the Day Archive</h1>
        <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Every day Wordocious surfaces a Word of the Day — the shared answer that thousands of players race to solve. Each
          entry below links to its meaning, pronunciation, and an original letter-by-letter breakdown showing what makes the
          word tick as a puzzle answer. Come back daily for a new word, or read up on the strategy in our{' '}
          <Link href="/guides" style={{ color: '#7c3aed' }} className="font-bold">mode guides</Link>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rows.map(({ key, date, entry }) => (
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
                <div className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{pretty(date)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
