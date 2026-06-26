import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { MODE_GUIDES } from '@/lib/guide-content';
import { GuideIcon } from '@/components/guides/guide-icon';

export const metadata: Metadata = {
  title: 'Wordocious Mode Guides — Rules, Scoring & Strategy for All 9 Modes',
  description:
    'In-depth guides for every Wordocious mode: Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance, Gauntlet, and ProperNoundle. Exact scoring formulas, hint economics, and winning strategy.',
};

export default function GuidesIndexPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>

        <h1 className="text-3xl font-black uppercase mb-2 text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>Mode Guides</h1>
        <p className="text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Every Wordocious mode, explained properly — exact rules, the real scoring math, and the strategy that separates the leaderboard from the middle of the pack.
        </p>

        <div className="space-y-3">
          {MODE_GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="flex items-center justify-between p-4 transition-transform hover:scale-[1.01]"
              style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${g.accent}15` }}>
                    <GuideIcon slug={g.slug} accent={g.accent} />
                  </span>
                  <span className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{g.title}</span>
                </div>
                <p className="text-xs font-medium mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>{g.tagline}</p>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0 ml-2" style={{ color: 'var(--color-text-muted)' }} />
            </Link>
          ))}
        </div>

        <p className="text-xs font-medium mt-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          New to word puzzles entirely? Start with <Link href="/how-to-play" style={{ color: '#7c3aed', fontWeight: 700 }}>How to Play</Link> for
          the tile-color basics, then come back here when you want to climb the daily leaderboards.
        </p>
      </div>
    </div>
  );
}
