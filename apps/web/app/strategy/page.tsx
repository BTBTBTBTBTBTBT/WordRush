import type { Metadata } from 'next';
import Link from 'next/link';
import { STRATEGY_ARTICLES } from '@/lib/strategy-content';
import { strategyOrder, strategySections } from '@/lib/strategy-games';
import { InfoPageLayout } from '@/components/ui/info-page';
import { GuideBody, GuideSectionHead, StrategyTile } from '@/components/strategy/guide-family';
import { TipOfTheDay, type TipItem } from '@/components/strategy/tip-of-the-day';

export const metadata: Metadata = {
  title: 'Word Puzzle Strategy — Tips & Guides | Wordocious',
  description:
    'Original strategy for daily word puzzles: the best starting words, how to solve in fewer guesses, and a plain-English tour of every Wordocious mode.',
  alternates: { canonical: 'https://wordocious.com/strategy' },
};

const LINK = { color: '#7c3aed', fontWeight: 700 } as const;

export default function StrategyIndexPage() {
  // The guide page family (parity spec): a hero, TIP OF THE DAY, then the
  // articles grouped by game (dailies, puzzles, every game) as 2-up tiles.
  const sections = strategySections(STRATEGY_ARTICLES);
  const tips: TipItem[] = strategyOrder(STRATEGY_ARTICLES).map(({ article: a, look }) => ({
    slug: a.slug,
    title: a.title,
    dek: a.dek,
    minutes: a.minutes,
    accent: look.accent,
    host: look.host,
    art: look.titleArt,
    artText: look.mode ? look.mode.title : 'Every game',
  }));

  return (
    <InfoPageLayout title="Word Puzzle Strategy" art="art-title-strategy" artLabel="Word Puzzle Strategy">
      <div className="flex flex-col gap-6">
        <div className="text-center px-2">
          <p className="m-0 font-black uppercase" style={{ fontSize: 12, letterSpacing: '0.14em', color: '#7c3aed' }}>Solve smarter</p>
          <p className="m-0 mt-1 font-extrabold" style={{ fontSize: 16, color: 'var(--color-text)' }}>Original strategy for every Wordocious game.</p>
        </div>

        <section className="flex flex-col gap-3" aria-labelledby="tip-of-the-day">
          <h2 id="tip-of-the-day" className="m-0 font-black uppercase" style={{ fontSize: 13, letterSpacing: '0.09em', color: 'var(--color-text)' }}>
            Tip of the day
          </h2>
          <TipOfTheDay items={tips} />
        </section>

        {sections.map((s) => (
          <section key={s.group} className="flex flex-col gap-3" aria-labelledby={`group-${s.group}`}>
            <h2 id={`group-${s.group}`} className="m-0 font-black uppercase" style={{ fontSize: 13, letterSpacing: '0.09em', color: 'var(--color-text)' }}>
              {s.label}
            </h2>
            {/* Grid rows stretch, so the two tiles in a row share a height. */}
            <div className="grid grid-cols-2 gap-3">
              {s.items.map(({ article: a, look }) => (
                <StrategyTile
                  key={a.slug}
                  href={`/strategy/${a.slug}`}
                  accent={look.accent}
                  art={look.titleArt}
                  host={look.host}
                  isVs={look.gameId === 'vs'}
                  title={a.title}
                  minutes={a.minutes}
                />
              ))}
            </div>
          </section>
        ))}

        {/* The editorial frame behind every article (web copy, crawlable). */}
        <section className="flex flex-col gap-4 mt-2" aria-labelledby="principles">
          <h2 id="principles" className="m-0 font-black uppercase" style={{ fontSize: 13, letterSpacing: '0.09em', color: 'var(--color-text)' }}>
            The three principles
          </h2>
          <div className="flex flex-col gap-2.5">
            <GuideSectionHead n={1} accent="#7c3aed" as="h3">Guesses are questions, not answers.</GuideSectionHead>
            <GuideBody size={15}>
              Early guesses exist to gather information, not to be right. A first guess that turns five tiles gray but rules
              out five common letters did its job; a lucky-feeling guess that repeats letters you already confirmed wasted a
              turn. The math of elimination is the spine of the{' '}
              <Link href="/strategy/best-starting-words" style={LINK}>starting-words article</Link>, and it applies to every mode.
            </GuideBody>
          </div>
          <div className="flex flex-col gap-2.5">
            <GuideSectionHead n={2} accent="#ec4899" as="h3">Read every tile, including the gray ones.</GuideSectionHead>
            <GuideBody size={15}>
              An amber tile doesn&apos;t just say the letter is present, it eliminates that letter from that column, which
              often prunes more candidates than a purple does. Deduction from negative space is the single biggest skill gap
              between casual and fast solvers. Pair these articles with the{' '}
              <Link href="/guides" style={LINK}>per-mode guides</Link> for the exact rules and scoring.
            </GuideBody>
          </div>
          <div className="flex flex-col gap-2.5">
            <GuideSectionHead n={3} accent="#f59e0b" as="h3">Difficulty lives in the answer list, not the rules.</GuideSectionHead>
            <GuideBody size={15}>
              Repeated letters, rare letters, and near-miss neighbors are what make a puzzle hard, which is why our{' '}
              <Link href="/words" style={LINK}>Word of the Day archive</Link> breaks down real answers letter by letter.
              Studying yesterday&apos;s answer is quiet training for tomorrow&apos;s.
            </GuideBody>
          </div>
        </section>
      </div>
    </InfoPageLayout>
  );
}
