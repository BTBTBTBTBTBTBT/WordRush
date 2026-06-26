import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { wordOfDay, parseDateKey, dateKey, daysSinceEpoch, wordPlayAnalysis } from '@/lib/word-of-day';

export const revalidate = 86400;
export const dynamicParams = true;

interface Props {
  params: { date: string };
}

function prettyDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const date = parseDateKey(params.date);
  if (!date) return { title: 'Word of the Day | Wordocious' };
  const entry = await wordOfDay(date);
  const w = entry.word.toUpperCase();
  const desc = entry.definition
    ? `${w} (${entry.partOfSpeech}): ${entry.definition} The Wordocious Word of the Day for ${prettyDate(date)}, with pronunciation, meaning, and word-puzzle letter analysis.`
    : `${w} — the Wordocious Word of the Day for ${prettyDate(date)}, with a letter-by-letter breakdown for word-puzzle players.`;
  return {
    title: `${w} — Word of the Day (${params.date}) | Wordocious`,
    description: desc.slice(0, 300),
    alternates: { canonical: `https://wordocious.com/word/${params.date}` },
  };
}

export default async function WordOfDayPage({ params }: Props) {
  const date = parseDateKey(params.date);
  if (!date) notFound();

  // Don't expose future days (they'd reveal upcoming daily answers).
  const todayIdx = daysSinceEpoch(new Date());
  if (daysSinceEpoch(date) > todayIdx) notFound();

  const entry = await wordOfDay(date);
  const w = entry.word.toUpperCase();
  const analysis = wordPlayAnalysis(entry.word);

  const prev = dateKey(new Date(date.getTime() - 86400000));
  const nextDate = new Date(date.getTime() + 86400000);
  const hasNext = daysSinceEpoch(nextDate) <= todayIdx;
  const next = dateKey(nextDate);

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Link href="/words" className="inline-flex items-center gap-1 text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> All words
        </Link>

        <p className="text-xs font-extrabold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Word of the Day · {prettyDate(date)}
        </p>

        {/* Tiles */}
        <div className="flex gap-1.5 mb-4">
          {w.split('').map((ch, i) => (
            <div
              key={i}
              className="w-12 h-12 rounded-md flex items-center justify-center text-xl font-black text-white"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 3px 0 #5b21b6' }}
            >
              {ch}
            </div>
          ))}
        </div>

        <h1 className="text-4xl font-black mb-1" style={{ color: 'var(--color-text)' }}>{w}</h1>
        {(entry.phonetic || entry.partOfSpeech) && (
          <p className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {entry.phonetic && <span className="mr-2">{entry.phonetic}</span>}
            {entry.partOfSpeech && <span style={{ color: '#7c3aed' }}>{entry.partOfSpeech}</span>}
          </p>
        )}

        {/* Definition (dictionary) */}
        {entry.definition && (
          <section className="rounded-xl p-4 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h2 className="text-sm font-black uppercase tracking-wide mb-2" style={{ color: 'var(--color-text)' }}>Meaning</h2>
            <p className="text-base leading-relaxed" style={{ color: 'var(--color-text)' }}>{entry.definition}</p>
            {entry.example && (
              <p className="text-sm italic mt-2" style={{ color: 'var(--color-text-muted)' }}>“{entry.example}”</p>
            )}
            {entry.extraSenses && entry.extraSenses.length > 0 && (
              <ul className="mt-3 space-y-1">
                {entry.extraSenses.map((s, i) => (
                  <li key={i} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    <span style={{ color: '#7c3aed' }} className="font-bold mr-1">{s.partOfSpeech}</span>
                    {s.definition}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ORIGINAL: letter analysis — unique, factual, useful for word-puzzle players */}
        <section className="rounded-xl p-4 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-black uppercase tracking-wide mb-3" style={{ color: 'var(--color-text)' }}>
            {w} as a word-puzzle answer
          </h2>
          <p className="text-base leading-relaxed mb-3" style={{ color: 'var(--color-text)' }}>{analysis.summary}</p>
          <p className="text-base leading-relaxed" style={{ color: 'var(--color-text)' }}>{analysis.strategy}</p>
        </section>

        {/* CTA + cross-links (original copy) */}
        <section className="rounded-xl p-4 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-base leading-relaxed mb-3" style={{ color: 'var(--color-text)' }}>
            Wordocious is a daily word game with nine modes — guess a hidden word in six tries (Classic), juggle four or eight
            boards at once (QuadWord, OctoWord), race a live opponent in VS Battle, or chain five modes into one run in the
            Gauntlet. Every player gets the same word each day, so {w} was today&apos;s shared challenge.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="px-4 py-2 rounded-lg text-white font-black text-sm" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              Play today&apos;s puzzle
            </Link>
            <Link href="/how-to-play" className="px-4 py-2 rounded-lg font-black text-sm" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              How to play
            </Link>
            <Link href="/words" className="px-4 py-2 rounded-lg font-black text-sm" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              Past words
            </Link>
          </div>
        </section>

        {/* Prev / next day */}
        <div className="flex items-center justify-between">
          <Link href={`/word/${prev}`} className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <ChevronLeft className="w-4 h-4" /> {prev}
          </Link>
          {hasNext && (
            <Link href={`/word/${next}`} className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
              {next} <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
