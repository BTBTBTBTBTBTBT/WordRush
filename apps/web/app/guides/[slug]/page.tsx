import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PUBLIC_MODE_GUIDES as MODE_GUIDES, getPublicGuide as getGuide } from '@/lib/guide-content';
import { STRATEGY_ARTICLES } from '@/lib/strategy-content';
import { GuideIcon } from '@/components/guides/guide-icon';
import { Mascot } from '@/components/ui/mascot';
import { guideHost } from '@/lib/mascots';
import { gameTitleArtForGuide, gameTitleArtLabel } from '@/lib/art';
import { CandyLink } from '@/components/ui/candy-button';
import { InfoPageLayout, IntroCard, IntroText, SectionCard } from '@/components/ui/info-page';
import { softIconTile } from '@/lib/soft-surface';

export function generateStaticParams() {
  return MODE_GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = getGuide(params.slug);
  if (!guide) return {};
  return {
    title: `${guide.title} Guide — Rules, Scoring & Strategy | Wordocious`,
    description: guide.metaDescription,
  };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const related = guide.related
    .map((slug) => getGuide(slug))
    .filter((g): g is NonNullable<typeof g> => !!g);
  // The long-form playbook for this mode on /strategy, when one exists.
  const playbook = STRATEGY_ARTICLES.find((a) => a.guide === guide.slug);
  const host = guideHost(guide.slug);
  const titleArt = gameTitleArtForGuide(guide.slug);

  return (
    // C6: the game's own title art is this page's headline (h1, the footer-page
    // height); a game without title art shows the Guides title art and a text h1.
    <InfoPageLayout
      title={titleArt ? gameTitleArtLabel(titleArt) : 'Guides'}
      art={titleArt ?? 'art-titlecast-guides'}
      artLabel={titleArt ? gameTitleArtLabel(titleArt) : 'Guides'}
      titleTag={titleArt ? 'h1' : 'div'}
      backHref="/guides"
    >
      <IntroCard
        titleAs={titleArt ? 'p' : 'h1'}
        title={titleArt ? undefined : (
          <span className="flex items-center gap-2.5">
            <GuideIcon slug={guide.slug} accent={guide.accent} className="w-5 h-5" />
            <span className="min-w-0 uppercase" style={{ fontSize: 24 }}>{guide.title}</span>
            {/* The game's host waves beside its guide title. */}
            {host && <Mascot id={host} size={48} motion="wave" priority className="ml-auto" />}
          </span>
        )}
      >
        <IntroText>{guide.tagline}</IntroText>
      </IntroCard>

      {/* Quick facts: tinted mini cards in the game's color (A1). */}
      <div className="grid grid-cols-2 gap-2">
        {guide.facts.map((f) => (
          <div key={f.label} className="px-3 pt-3 pb-2.5" style={softIconTile(guide.accent, { radius: 14 })}>
            <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{f.label}</div>
            <div className="text-sm font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{f.value}</div>
          </div>
        ))}
      </div>

      <SectionCard heading="How it works" accent={guide.accent}>
        {guide.rules.map((p, i) => (
          <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
        ))}
      </SectionCard>

      <SectionCard heading="How scoring works" accent={guide.accent}>
        {guide.scoring.map((p, i) => (
          <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
        ))}
      </SectionCard>

      <SectionCard heading="Strategy" accent={guide.accent}>
        <div className="space-y-4 mt-1">
          {guide.tips.map((tip) => (
            <div key={tip.heading}>
              <h3 className="text-xs font-black mb-1" style={{ color: 'var(--color-text)' }}>
                <span aria-hidden="true" className="inline-block rounded-full mr-1.5 align-middle" style={{ width: 8, height: 8, background: guide.accent }} />
                {tip.heading}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{tip.body}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard heading="Keep reading" accent={guide.accent}>
        {/* A8: the related-page chips are candy buttons. */}
        <div className="flex flex-wrap gap-2 mt-1">
          {playbook && (
            <CandyLink href={`/strategy/${playbook.slug}`} color="purple" size="sm">
              {guide.title} playbook
            </CandyLink>
          )}
          {related.map((r) => (
            <CandyLink key={r.slug} href={`/guides/${r.slug}`} color="pink" size="sm">
              {r.title} guide
            </CandyLink>
          ))}
          <CandyLink href="/faq" color="peach" size="sm">
            FAQ &amp; general strategy
          </CandyLink>
        </div>
        <p className="text-xs leading-relaxed mt-3" style={{ color: 'var(--color-text-secondary)' }}>
          Every mode ships a fresh daily puzzle at your local midnight — the same words for every player worldwide, with a daily leaderboard per mode.
          <Link href="/" style={{ color: '#7c3aed', fontWeight: 700 }}> Play today&apos;s {guide.title} puzzle</Link>.
        </p>
      </SectionCard>
    </InfoPageLayout>
  );
}
