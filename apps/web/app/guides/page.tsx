import type { Metadata } from 'next';
import Link from 'next/link';
import { PUBLIC_MODE_GUIDES as MODE_GUIDES } from '@/lib/guide-content';
import { GuideIcon } from '@/components/guides/guide-icon';
import { InfoCard, InfoPageLayout, IntroCard, IntroText, LinkCard, SectionCard } from '@/components/ui/info-page';

export const metadata: Metadata = {
  title: 'Wordocious Mode Guides — Rules, Scoring & Strategy for Every Mode',
  description:
    'In-depth guides for every Wordocious mode: Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance, Gauntlet, and the ten More Games dailies — ProperNoundle, Sudocious, Starsweep, Letter Ladder, Spyglass, Hubbub, Codebreaker, Kindred, Crosswordocious and Muddle. Exact scoring formulas, hint economics, and winning strategy.',
};

export default function GuidesIndexPage() {
  return (
    <InfoPageLayout title="Mode Guides" art="art-title-guides" artLabel="Mode Guides">
      <IntroCard title="How every game works">
        <IntroText>
          Every Wordocious mode, explained properly — exact rules, the real scoring math, and the strategy that separates the leaderboard from the middle of the pack.
        </IntroText>
      </IntroCard>

      {/* C6: game guides first, each in its own game's color (mockup .guidecard). */}
      {MODE_GUIDES.map((g) => (
        <LinkCard
          key={g.slug}
          href={`/guides/${g.slug}`}
          accent={g.accent}
          icon={<GuideIcon slug={g.slug} accent={g.accent} className="w-6 h-6" />}
          title={g.title}
          sub={g.tagline}
        />
      ))}

      <SectionCard heading="Which mode should you play first?" className="p-5 space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
          The eight daily word games are really four families, and More Games adds a fifth. <strong>Single-board classics</strong> — Classic (5 letters), Six,
          and Seven — are pure deduction: one hidden word, six to eight guesses, and the only variable is word length. Longer words
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
          Deliverance is a rescue mission against a shrinking guess budget. They&apos;re the antidote to autopilot.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
          <strong>Gauntlet</strong> chains five stages into one run where a single bust ends everything — the
          closest thing Wordocious has to a boss fight. Finish all eight word games in a day and you&apos;ve scored a{' '}
          <strong>Daily Sweep</strong>, tracked on the{' '}
          <Link href="/strategy/daily-sweep-guide" style={{ color: '#7c3aed', fontWeight: 700 }}>sweep leaderboard</Link> —
          the long-game goal that turns dabbling into a routine.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
          Finally, <strong style={{ color: '#4f46e5' }}>More Games</strong> is the tile on the home screen that opens ten extra
          dailies outside the sweep: ProperNoundle (famous names instead of dictionary words), Sudocious (sudoku),
          Starsweep (star placement), Letter Ladder, Spyglass (word search), Hubbub (seven-letter hub), Codebreaker
          (cryptogram), Kindred (groups of four), Crosswordocious (sayings crossword) and Muddle (scramble). They earn
          XP, medals and their own leaderboards but never change your sweep. Each guide above covers one mode&apos;s
          exact rules, its scoring formula, and the specific strategy that mode rewards.
        </p>
      </SectionCard>

      <InfoCard className="px-4 py-3">
        <p className="m-0 text-xs font-bold leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          New to word puzzles entirely? Start with <Link href="/how-to-play" style={{ color: '#7c3aed', fontWeight: 700 }}>How to Play</Link> for
          the tile-color basics, then come back here when you want to climb the daily leaderboards.
        </p>
      </InfoCard>
    </InfoPageLayout>
  );
}
