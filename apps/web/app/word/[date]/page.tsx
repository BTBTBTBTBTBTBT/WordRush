import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Lightbulb } from 'lucide-react';
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

  // Don't expose future days. +1 tolerance: this renders on a UTC server, so a
  // viewer ahead of UTC has a local "today" the server still considers
  // tomorrow — without the allowance their own featured day 404s every evening.
  const todayIdx = daysSinceEpoch(new Date());
  if (daysSinceEpoch(date) > todayIdx + 1) notFound();

  const entry = await wordOfDay(date);
  const w = entry.word.toUpperCase();
  const analysis = wordPlayAnalysis(entry.word);

  // Calendar arithmetic, not ±86400000 — local-midnight dates shift by an hour
  // across DST, which would flip the neighboring dateKey.
  const prev = dateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const hasNext = daysSinceEpoch(nextDate) <= todayIdx + 1;
  const next = dateKey(nextDate);

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Link href="/words" className="inline-flex items-center gap-1 text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> All words
        </Link>

        {/* Hero band — white tiles on a purple→pink gradient (matches native). */}
        <div className="rounded-2xl px-6 py-7 mb-6 text-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
          <p className="text-[11px] font-extrabold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Word of the Day · {prettyDate(date)}
          </p>
          <div className="flex gap-1.5 justify-center mb-3">
            {w.split('').map((ch, i) => (
              <div
                key={i}
                className="w-12 h-12 rounded-md flex items-center justify-center text-xl font-black"
                style={{ background: '#fff', color: '#6d28d9', boxShadow: '0 3px 0 rgba(0,0,0,0.12)' }}
              >
                {ch}
              </div>
            ))}
          </div>
          <h1 className="text-3xl font-black text-white">{w}</h1>
          {(entry.phonetic || entry.partOfSpeech) && (
            <p className="text-sm font-bold mt-1" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {entry.phonetic && <span className="mr-2">{entry.phonetic}</span>}
              {entry.partOfSpeech && <span className="italic">{entry.partOfSpeech}</span>}
            </p>
          )}
        </div>

        {/* Definition (dictionary) */}
        {entry.definition && (
          <section className="rounded-2xl p-5 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h2 className="text-sm font-black uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.14)' }}>
                <BookOpen className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
              </span>
              Meaning
            </h2>
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
        <section className="rounded-2xl p-5 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-black uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.16)' }}>
              <Lightbulb className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            </span>
            {w} as a word-puzzle answer
          </h2>
          <p className="text-base leading-relaxed mb-3" style={{ color: 'var(--color-text)' }}>{analysis.summary}</p>
          <p className="text-base leading-relaxed" style={{ color: 'var(--color-text)' }}>{analysis.strategy}</p>
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
