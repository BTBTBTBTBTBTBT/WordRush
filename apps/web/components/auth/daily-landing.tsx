'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
// Loaded on the "Sign in" tap only (founder, 2026-09-29).
const LoginScreen = dynamic(() => import('./login-screen').then((m) => m.LoginScreen));
import { useAuth } from '@/lib/auth-context';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton, TextLink, TextLinkA } from '@/components/ui/cast-button';
import { softRow } from '@/components/ui/soft-popup';
import { softBackground } from '@/lib/soft-surface';

/**
 * §229: public landing for /daily — the Daily Challenge leaderboard page.
 * The signed-out pre-auth render used to be the generic 7-word skeleton, so
 * crawlers indexed an empty page under an ad banner (AdSense: "low value
 * content", review after review). This is the ModeLanding pattern applied
 * to the leaderboard: real explanatory content (what the Daily Challenge
 * is, how scoring and the Sweep board work, medals, streaks), with the same
 * sign-in / guest doors. Signed-in users never see it — AuthGate renders
 * the real page once auth resolves.
 */
export function DailyLanding() {
  const [showLogin, setShowLogin] = useState(false);
  const { enterGuest } = useAuth();
  if (showLogin) return <LoginScreen />;

  const wordmarkStyle = {
    backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
  };
  const h = { color: 'var(--color-text)' };
  const p = { color: 'var(--color-text-secondary)' };

  const modes = [
    ['Classic', 'One five-letter word, six guesses — the original.'],
    ['QuadWord', 'Four boards, nine shared guesses.'],
    ['OctoWord', 'Eight boards at once, thirteen guesses.'],
    ['Succession', 'Four words in a row; each solve reveals the next.'],
    ['Deliverance', 'Rescue four boards before the guesses run out.'],
    ['Six', 'A six-letter word, with hints on offer.'],
    ['Seven', 'A seven-letter word, the longest daily.'],
    ['Gauntlet', 'Five chained stages — one miss ends the run.'],
  ];

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: softBackground('#7c3aed', 0.06) }}>
      <header className="flex items-center justify-between px-5 py-4 max-w-3xl mx-auto">
        <Link href="/" className="text-2xl font-black tracking-tight" style={wordmarkStyle}>WORDOCIOUS</Link>
        <CastButton color="purple" size="sm" onClick={() => setShowLogin(true)}>
          Sign In
        </CastButton>
      </header>

      <section className="text-center px-6 pt-8 pb-8 max-w-2xl mx-auto">
        <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>
          Eight word puzzles a day, one leaderboard
        </p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3" style={h}>Daily Challenge</h1>
        <p className="text-base font-bold mb-6 leading-relaxed" style={p}>
          The same eight words for every player in the world, every day. Solve them, then see exactly where you stand.
        </p>
        <CastButton color="purple" size="lg" icon="play" onClick={() => setShowLogin(true)}>
          Sign in to see the leaderboards
        </CastButton>
        <div className="mt-3">
          <TextLink onClick={enterGuest} style={{ textTransform: 'none' }}>
            Play without an account
          </TextLink>
          <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Today&apos;s dailies are free to play. Sign in to save stats, build streaks, and rank on the boards.
          </p>
        </div>
      </section>

      <section className="px-5 pb-8 max-w-3xl mx-auto text-sm leading-relaxed" style={p}>
        <h2 className="text-lg font-black mb-2" style={h}>How the Daily Challenge works</h2>
        <p className="mb-4">
          Every day Wordocious deals one fresh puzzle in each of its eight daily word games. The words are
          identical for everyone that day, so the leaderboard is a fair race: every player faced exactly
          the same boards. The day rolls over at midnight in your local time zone, and each mode can be
          played once per day — after that it is Unlimited practice, which never touches the boards.
          The ten More Games titles behind the home tile — ProperNoundle, Sudocious, Starsweep and the
          rest — have dailies and leaderboards of their own, but they sit outside this board.
        </p>

        <h3 className="font-black mt-5 mb-2" style={h}>The eight modes</h3>
        <ul className="grid sm:grid-cols-3 gap-2 mb-4">
          {modes.map(([name, blurb]) => (
            <li key={name} className="p-3" style={softRow('#7c3aed', { radius: 12 })}>
              <div className="font-black" style={h}>{name}</div>
              <div className="text-xs mt-0.5">{blurb}</div>
            </li>
          ))}
        </ul>

        <h3 className="font-black mt-5 mb-1" style={h}>Scoring</h3>
        <p className="mb-4">
          Each result earns a composite score. Guess efficiency matters most — solving in fewer guesses is
          worth far more than solving quickly — and a time bonus rewards speed on top of it. Multi-board
          modes add a bonus for every board solved, so a loss that cleared seven of eight OctoWord boards
          still scores well above one that cleared two. Hints in Six and Seven cost points.
          Exact ties on score and time share the same rank.
        </p>

        <h3 className="font-black mt-5 mb-1" style={h}>The Sweep board</h3>
        <p className="mb-4">
          Finish all eight word games in a day and you have swept. The Sweep leaderboard ranks sweepers by total
          points across every mode, with total time as the tiebreaker. Win all eight and your row earns the
          gold FLAWLESS badge; a dot per mode under every player shows how each one went — bright for a
          near-perfect solve, faded for a slow one, red for a loss. Because the ranking is total points,
          eight slow wins can finish below seven sharp ones. More Games results never count here.
        </p>

        <h3 className="font-black mt-5 mb-1" style={h}>Medals, streaks, and friends</h3>
        <p className="mb-4">
          When the day closes, the top three in every mode receive gold, silver, and bronze medals that live
          in their trophy case, and Yesterday&apos;s Winners stays visible so the podium can be admired or
          contested. Playing at least one daily each day builds your streak. The Friends view narrows every
          board to the people you know, with a weekly race that resets each Monday.
        </p>

        <p className="mb-2">
          New here? Start with <Link href="/practice" className="font-extrabold underline underline-offset-2" style={h}>Classic</Link> and
          work up to the <Link href="/gauntlet" className="font-extrabold underline underline-offset-2" style={h}>Gauntlet</Link>. The{' '}
          <Link href="/how-to-play" className="font-extrabold underline underline-offset-2" style={h}>how-to-play guide</Link> covers every mode in detail.
        </p>
      </section>

      <footer className="px-5 py-8 max-w-3xl mx-auto flex flex-wrap gap-2 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
        <Link href="/about">About</Link><span>·</span>
        <Link href="/how-to-play">How to Play</Link><span>·</span>
        <Link href="/guides">Guides</Link><span>·</span>
        <Link href="/privacy">Privacy</Link><span>·</span>
        <Link href="/terms">Terms</Link><span>·</span>
        <Link href="/support">Support</Link>
      </footer>
    </div>
  );
}
