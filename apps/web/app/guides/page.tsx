import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MODE_GUIDES } from '@/lib/guide-content';
import { GuideIcon } from '@/components/guides/guide-icon';
import { InfoPageHeader } from '@/components/ui/info-page-header';

export const metadata: Metadata = {
  title: 'Wordocious Mode Guides — Rules, Scoring & Strategy for All 9 Modes',
  description:
    'In-depth guides for every Wordocious mode: Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance, Gauntlet, and ProperNoundle. Exact scoring formulas, hint economics, and winning strategy.',
};

export default function GuidesIndexPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <InfoPageHeader title="Mode Guides" />
      <div className="max-w-2xl mx-auto px-4 pt-1 pb-6">
        <p className="text-sm font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Every Wordocious mode, explained properly — exact rules, the real scoring math, and the strategy that separates the leaderboard from the middle of the pack.
        </p>

        <div className="rounded-2xl p-5 mb-6 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: 'var(--color-text)' }}>
            Which mode should you play first?
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            The nine daily modes are really four families. <strong>Single-board classics</strong> — Classic (5 letters), Six,
            and Seven — are pure deduction: one hidden word, six guesses, and the only variable is word length. Longer words
            sound harder but often play easier, because every guess reveals more letters; the real difficulty jump is the
            thinner vocabulary most players have at six and seven letters. If you&apos;re new, start with Classic and work up.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            <strong>Multi-board marathons</strong> — QuadWord (4 boards) and OctoWord (8) — solve several words with a shared
            guess pool. They reward breadth over depth: your opening guesses should maximize information across every board
            at once, not chase a single kill. These are the modes where a disciplined three-guess opening routine pays off
            most, and the ones that teach you to read multiple boards at a glance.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            <strong>Twist modes</strong> change the rules themselves. Succession chains answers so each solve feeds the next.
            Deliverance is a rescue mission against a shrinking guess budget. ProperNoundle breaks the biggest convention in
            the genre by hiding proper nouns — names, places, brands — which flips your instincts about likely letters on
            their head. They&apos;re the antidote to autopilot.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            Finally, <strong>Gauntlet</strong> chains five stages into one run where a single bust ends everything — the
            closest thing Wordocious has to a boss fight. Finish all nine modes in a day and you&apos;ve scored a{' '}
            <strong>Daily Sweep</strong>, tracked on the{' '}
            <Link href="/strategy/daily-sweep-guide" style={{ color: '#7c3aed', fontWeight: 700 }}>sweep leaderboard</Link> —
            the long-game goal that turns dabbling into a routine. Each guide below covers one mode&apos;s exact rules,
            its scoring formula, and the specific strategy that mode rewards.
          </p>
        </div>

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
