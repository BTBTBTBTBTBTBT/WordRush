import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STRATEGY_ARTICLES, getArticle } from '@/lib/strategy-content';
import { getPublicGuide } from '@/lib/guide-content';
import { CandyLink } from '@/components/ui/candy-button';
import { InfoCard, InfoLabel, InfoPageLayout, IntroCard, IntroText, LinkCard, SectionCard, infoAccent } from '@/components/ui/info-page';

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
  // The mode guide this playbook belongs to (rules + exact scoring), when it is about one game.
  const guide = a.guide ? getPublicGuide(a.guide) : undefined;
  // The article's cards wear its game's color (a playbook), else the brand purple.
  const accent = guide?.accent ?? infoAccent(0);

  return (
    // C6: the Strategy title art is the section headline (a div); the article
    // title stays this page's h1, in the intro card.
    <InfoPageLayout title="Strategy" art="art-title-strategy" titleTag="div" backHref="/strategy">
      <article className="flex flex-col gap-3">
        <IntroCard
          titleAs="h1"
          title={
            <>
              <span className="block text-[11px] font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Strategy · {a.minutes} min read
              </span>
              <span className="block text-2xl uppercase leading-tight">{a.title}</span>
            </>
          }
        >
          <IntroText size={15}>{a.dek}</IntroText>
        </IntroCard>

        {a.sections.map((s, i) => (
          <SectionCard key={i} heading={s.heading} accent={accent}>
            {s.body.map((p, j) => (
              <p key={j} className="text-[15px] leading-relaxed mb-3 last:mb-0" style={{ color: 'var(--color-text)' }}>{p}</p>
            ))}
          </SectionCard>
        ))}

        <InfoCard accent={accent} className="p-4">
          <p className="text-[15px] leading-relaxed mb-3" style={{ color: 'var(--color-text)' }}>
            Put it into practice — Wordocious gives everyone the same daily puzzle in every mode, so you can test these
            ideas and compare your result on the global leaderboard.
          </p>
          {/* A8: candy buttons. */}
          <div className="flex flex-wrap gap-2">
            <CandyLink href="/" color="purple" size="md" icon="play">
              Play today&apos;s puzzle
            </CandyLink>
            {guide && (
              <CandyLink href={`/guides/${guide.slug}`} color="pink" size="md">
                {guide.title} guide
              </CandyLink>
            )}
            <CandyLink href="/guides" color="peach" size="md">
              Mode guides
            </CandyLink>
          </div>
        </InfoCard>

        {a.related.length > 0 && (
          <>
            <InfoLabel accent={accent}>Keep reading</InfoLabel>
            {a.related.map((slug, i) => {
              const r = getArticle(slug);
              if (!r) return null;
              const rGuide = r.guide ? getPublicGuide(r.guide) : undefined;
              return <LinkCard key={slug} href={`/strategy/${slug}`} accent={rGuide?.accent ?? infoAccent(i + 1)} title={r.title} />;
            })}
          </>
        )}
      </article>
    </InfoPageLayout>
  );
}
