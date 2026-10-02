import type { Metadata } from 'next';
import Link from 'next/link';
import { STRATEGY_ARTICLES } from '@/lib/strategy-content';
import { getPublicGuide } from '@/lib/guide-content';
import { InfoPageLayout, IntroCard, IntroText, LinkCard, SectionCard, infoAccent } from '@/components/ui/info-page';

export const metadata: Metadata = {
  title: 'Word Puzzle Strategy — Tips & Guides | Wordocious',
  description:
    'Original strategy for daily word puzzles: the best starting words, how to solve in fewer guesses, and a plain-English tour of every Wordocious mode.',
  alternates: { canonical: 'https://wordocious.com/strategy' },
};

export default function StrategyIndexPage() {
  return (
    <InfoPageLayout title="Word Puzzle Strategy" art="art-title-strategy" artLabel="Word Puzzle Strategy">
      <IntroCard>
        <IntroText>
          Practical, original strategy for solving daily word puzzles faster and in fewer guesses — the thinking behind a
          good opening word, how to read every tile, and what each Wordocious mode actually asks of you. Pair these with our{' '}
          <Link href="/guides" style={{ color: '#7c3aed' }} className="font-bold">per-mode guides</Link> for the exact rules and scoring.
        </IntroText>
      </IntroCard>

      <SectionCard heading="The three principles behind every article here" className="p-5 space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
          <strong>1. Guesses are questions, not answers.</strong> Early guesses exist to gather information, not to be
          right. A first guess that turns five tiles gray but rules out five common letters did its job; a lucky-feeling
          guess that repeats letters you already confirmed wasted a turn. The math of elimination — which letters appear in
          what share of possible answers — is the spine of the{' '}
          <Link href="/strategy/best-starting-words" style={{ color: '#7c3aed', fontWeight: 700 }}>starting-words article</Link>,
          and it applies to every mode.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
          <strong>2. Read every tile, including the gray ones.</strong> Most players read purple as &quot;good&quot; and gray as
          &quot;bad&quot; and stop there. The leaderboard reads position: a amber tile doesn&apos;t just say the letter is present,
          it eliminates that letter from that column, which often prunes more candidates than a purple does. Deduction from
          negative space is the single biggest skill gap between casual and fast solvers.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
          <strong>3. Difficulty lives in the answer list, not the rules.</strong> Repeated letters, rare letters, and
          near-miss neighbors (answers one letter apart) are what make a puzzle hard — which is why our{' '}
          <Link href="/words" style={{ color: '#7c3aed', fontWeight: 700 }}>Word of the Day archive</Link> breaks down real
          answers letter by letter. Studying yesterday&apos;s answer is quiet training for tomorrow&apos;s.
        </p>
      </SectionCard>

      {STRATEGY_ARTICLES.map((a, i) => {
        // A playbook for one game wears that game's color; the rest rotate.
        const accent = (a.guide && getPublicGuide(a.guide)?.accent) || infoAccent(i);
        return (
          <LinkCard
            key={a.slug}
            href={`/strategy/${a.slug}`}
            accent={accent}
            eyebrow={`${a.minutes} min read`}
            title={a.title}
            titleAs="h2"
            sub={a.dek}
            subLines={0}
          />
        );
      })}
    </InfoPageLayout>
  );
}
