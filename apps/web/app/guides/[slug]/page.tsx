import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MODE_GUIDES, getGuide } from '@/lib/guide-content';
import { GuideIcon } from '@/components/guides/guide-icon';

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

const card = { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' } as const;

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const related = guide.related
    .map((slug) => getGuide(slug))
    .filter((g): g is NonNullable<typeof g> => !!g);

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          All mode guides
        </Link>

        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${guide.accent}15` }}>
            <GuideIcon slug={guide.slug} accent={guide.accent} className="w-5 h-5" />
          </span>
          <h1 className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>{guide.title}</h1>
        </div>
        <p className="text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>{guide.tagline}</p>

        {/* Quick facts */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {guide.facts.map((f) => (
            <div key={f.label} className="px-3 py-2.5" style={card}>
              <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{f.label}</div>
              <div className="text-sm font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{f.value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="p-5" style={card}>
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>How it works</h2>
            {guide.rules.map((p, i) => (
              <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
            ))}
          </div>

          <div className="p-5" style={card}>
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>How scoring works</h2>
            {guide.scoring.map((p, i) => (
              <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
            ))}
          </div>

          <div className="p-5" style={card}>
            <h2 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>Strategy</h2>
            <div className="space-y-4">
              {guide.tips.map((tip) => (
                <div key={tip.heading}>
                  <h3 className="text-xs font-black mb-1" style={{ color: guide.accent }}>{tip.heading}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{tip.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5" style={card}>
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Keep reading</h2>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/guides/${r.slug}`}
                  className="text-xs font-extrabold px-3 py-1.5 rounded-full"
                  style={{ color: r.accent, border: `1.5px solid ${r.accent}` }}
                >
                  {r.title} guide
                </Link>
              ))}
              <Link
                href="/faq"
                className="text-xs font-extrabold px-3 py-1.5 rounded-full"
                style={{ color: 'var(--color-text-secondary)', border: '1.5px solid var(--color-border)' }}
              >
                FAQ &amp; general strategy
              </Link>
            </div>
            <p className="text-xs leading-relaxed mt-3" style={{ color: 'var(--color-text-secondary)' }}>
              Every mode ships a fresh daily puzzle at your local midnight — the same words for every player worldwide, with a daily leaderboard per mode.
              <Link href="/" style={{ color: '#7c3aed', fontWeight: 700 }}> Play today&apos;s {guide.title} puzzle</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
