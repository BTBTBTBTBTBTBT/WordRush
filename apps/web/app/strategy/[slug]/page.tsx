import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STRATEGY_ARTICLES, getArticle } from '@/lib/strategy-content';
import { InfoPageHeader } from '@/components/ui/info-page-header';

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

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--color-bg)' }}>
      <InfoPageHeader title="Strategy" backHref="/strategy" titleTag="div" />
      <article className="max-w-2xl mx-auto px-4 pt-1">
        <p className="text-xs font-extrabold uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>
          Strategy · {a.minutes} min read
        </p>
        <h1 className="text-3xl font-black uppercase mb-2 leading-tight text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>{a.title}</h1>
        <p className="text-lg font-bold leading-snug mb-8" style={{ color: 'var(--color-text-muted)' }}>{a.dek}</p>

        {a.sections.map((s, i) => (
          <section key={i} className="mb-7">
            <h2 className="text-xl font-black mb-2" style={{ color: 'var(--color-text)' }}>{s.heading}</h2>
            {s.body.map((p, j) => (
              <p key={j} className="text-base leading-relaxed mb-3" style={{ color: 'var(--color-text)' }}>{p}</p>
            ))}
          </section>
        ))}

        <div className="rounded-xl p-4 mb-8" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-base leading-relaxed mb-3" style={{ color: 'var(--color-text)' }}>
            Put it into practice — Wordocious gives everyone the same daily word across nine modes, so you can test these
            ideas and compare your result on the global leaderboard.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="px-4 py-2 rounded-lg text-white font-black text-sm" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              Play today&apos;s puzzle
            </Link>
            <Link href="/guides" className="px-4 py-2 rounded-lg font-black text-sm" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              Mode guides
            </Link>
          </div>
        </div>

        {a.related.length > 0 && (
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>Keep reading</h2>
            <div className="flex flex-col gap-2">
              {a.related.map((slug) => {
                const r = getArticle(slug);
                if (!r) return null;
                return (
                  <Link key={slug} href={`/strategy/${slug}`} className="rounded-xl p-3 font-black" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                    {r.title}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
