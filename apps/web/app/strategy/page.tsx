import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { STRATEGY_ARTICLES } from '@/lib/strategy-content';
import { InfoPageHeader } from '@/components/ui/info-page-header';

export const metadata: Metadata = {
  title: 'Word Puzzle Strategy — Tips & Guides | Wordocious',
  description:
    'Original strategy for daily word puzzles: the best starting words, how to solve in fewer guesses, and a plain-English tour of every Wordocious mode.',
  alternates: { canonical: 'https://wordocious.com/strategy' },
};

export default function StrategyIndexPage() {
  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--color-bg)' }}>
      <InfoPageHeader title="Word Puzzle Strategy" />
      <div className="max-w-2xl mx-auto px-4 pt-1">
        <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Practical, original strategy for solving daily word puzzles faster and in fewer guesses — the thinking behind a
          good opening word, how to read every tile, and what each Wordocious mode actually asks of you. Pair these with our{' '}
          <Link href="/guides" style={{ color: '#7c3aed' }} className="font-bold">per-mode guides</Link> for the exact rules and scoring.
        </p>

        <div className="rounded-2xl p-5 mb-6 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: 'var(--color-text)' }}>
            The three principles behind every article here
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            <strong>1. Guesses are questions, not answers.</strong> Early guesses exist to gather information, not to be
            right. A first guess that turns five tiles gray but rules out five common letters did its job; a lucky-feeling
            guess that repeats letters you already confirmed wasted a turn. The math of elimination — which letters appear in
            what share of possible answers — is the spine of the{' '}
            <Link href="/strategy/best-starting-words" style={{ color: '#7c3aed', fontWeight: 700 }}>starting-words article</Link>,
            and it applies to every mode.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            <strong>2. Read every tile, including the gray ones.</strong> Most players read green as &quot;good&quot; and gray as
            &quot;bad&quot; and stop there. The leaderboard reads position: a yellow tile doesn&apos;t just say the letter is present,
            it eliminates that letter from that column, which often prunes more candidates than a green does. Deduction from
            negative space is the single biggest skill gap between casual and fast solvers.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            <strong>3. Difficulty lives in the answer list, not the rules.</strong> Repeated letters, rare letters, and
            near-miss neighbors (answers one letter apart) are what make a puzzle hard — which is why our{' '}
            <Link href="/words" style={{ color: '#7c3aed', fontWeight: 700 }}>Word of the Day archive</Link> breaks down real
            answers letter by letter. Studying yesterday&apos;s answer is quiet training for tomorrow&apos;s.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {STRATEGY_ARTICLES.map((a) => (
            <Link
              key={a.slug}
              href={`/strategy/${a.slug}`}
              className="rounded-xl p-4 transition-transform active:scale-[0.99]"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wide mb-1" style={{ color: '#7c3aed' }}>{a.minutes} min read</div>
                  <h2 className="text-lg font-black leading-snug mb-1" style={{ color: 'var(--color-text)' }}>{a.title}</h2>
                  <p className="text-sm font-bold leading-snug" style={{ color: 'var(--color-text-muted)' }}>{a.dek}</p>
                </div>
                <ChevronRight className="w-5 h-5 shrink-0 mt-1" style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
