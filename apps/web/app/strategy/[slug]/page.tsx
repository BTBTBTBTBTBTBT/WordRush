import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STRATEGY_ARTICLES, getArticle } from '@/lib/strategy-content';
import { getPublicGuide } from '@/lib/guide-content';
import { splitTakeaway, strategyOrder } from '@/lib/strategy-games';
import { CandyLink } from '@/components/ui/candy-button';
import { InfoPageLayout } from '@/components/ui/info-page';
import {
  GuideBody, GuideHeroCard, GuideSectionHead, GuideTakeaway, GuideTitleArt, PrevNextLink, ReadChip,
} from '@/components/strategy/guide-family';

export function generateStaticParams() {
  return STRATEGY_ARTICLES.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = getArticle(params.slug);
  if (!a) return { title: 'Strategy | Wordocious' };
  return {
    title: `${a.title} | Wordocious Strategy`,
    description: a.description,
    alternates: { canonical: `https://wordocious.com/strategy/${a.slug}` },
  };
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const a = getArticle(params.slug);
  if (!a) notFound();
  // The guide page family (parity spec): the article reads like its game's guide page.
  const order = strategyOrder(STRATEGY_ARTICLES);
  const at = order.findIndex((x) => x.article.slug === a.slug);
  const look = order[at].look;
  const prev = at > 0 ? order[at - 1] : null;
  const next = at < order.length - 1 ? order[at + 1] : null;
  const accent = look.accent;
  // The mode guide this playbook belongs to (rules + exact scoring), when it is about one game.
  const guide = a.guide ? getPublicGuide(a.guide) : undefined;

  return (
    // C6: the Strategy title art is the section headline (a div); the article
    // title stays this page's h1, in the hero card.
    <InfoPageLayout title="Strategy" art="art-title-strategy" titleTag="div" backHref="/strategy">
      <article className="flex flex-col gap-6">
        <GuideHeroCard accent={accent} host={look.host} priority className="px-5 pt-3 pb-5 gap-2.5">
          {look.titleArt && (
            <div className="w-full flex justify-center">
              <GuideTitleArt art={look.titleArt} height={60} accent={accent} />
            </div>
          )}
          <h1 className="m-0 font-black leading-tight" style={{ fontSize: 22, color: 'var(--color-text)' }}>{a.title}</h1>
          <p className="m-0 font-bold leading-snug" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{a.dek}</p>
          <ReadChip accent={accent}>{a.minutes} min read</ReadChip>
        </GuideHeroCard>

        {a.sections.map((s, i) => {
          const [first, ...more] = s.body;
          const split = first != null ? splitTakeaway(first) : { takeaway: null, rest: '' };
          const paragraphs = [split.rest, ...more].filter((p) => p.length > 0);
          return (
            <section key={i} className="flex flex-col gap-3">
              <GuideSectionHead n={i + 1} accent={accent}>{s.heading}</GuideSectionHead>
              {split.takeaway && <GuideTakeaway accent={accent}>{split.takeaway}</GuideTakeaway>}
              {paragraphs.map((p, j) => <GuideBody key={j}>{p}</GuideBody>)}
            </section>
          );
        })}

        {look.playLabel && look.playHref && (
          <div className="flex flex-col items-center gap-2.5">
            <CandyLink href={look.playHref} color="purple" size="lg" icon="play">{look.playLabel}</CandyLink>
            {guide && (
              <Link href={`/guides/${guide.slug}`} className="text-xs font-black underline underline-offset-2" style={{ color: 'var(--color-text-muted)' }}>
                Read the {guide.title} guide
              </Link>
            )}
          </div>
        )}

        <nav aria-label="More strategy" className="grid grid-cols-2 gap-3">
          {prev ? (
            <PrevNextLink href={`/strategy/${prev.article.slug}`} accent={prev.look.accent} eyebrow="Previous" title={prev.article.title} />
          ) : <span aria-hidden="true" />}
          {next ? (
            <PrevNextLink href={`/strategy/${next.article.slug}`} accent={next.look.accent} eyebrow="Next" title={next.article.title} align="right" />
          ) : <span aria-hidden="true" />}
        </nav>
      </article>
    </InfoPageLayout>
  );
}
