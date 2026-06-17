'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Swords, TrendingUp, Shield, Skull, Crown } from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { LoginScreen } from './login-screen';
import { useAuth } from '@/lib/auth-context';

type IconCmp = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

/**
 * Public marketing landing shown to signed-out visitors (and AdSense / search
 * crawlers) so the site presents real content, not a bare login wall. Matches
 * the app aesthetic (wordmark gradient, surface cards, mode accents, btn-3d).
 * "Sign in to play" reveals the existing LoginScreen — gameplay stays
 * login-gated.
 */
// Icons mirror the signed-in home grid (app/page.tsx MODE_CARDS): real game
// icons everywhere, except QuadWord/OctoWord which brand with roman numerals.
const MODES: { title: string; desc: string; accent: string; roman?: string; guide?: string; Icon?: IconCmp }[] = [
  { title: 'Classic', desc: 'Guess the hidden 5-letter word in six tries.', accent: '#7c3aed', guide: 'classic', Icon: WordleGridIcon },
  { title: 'VS Battle', desc: 'Race a live opponent on the same puzzle in real time.', accent: '#0d9488', Icon: Swords },
  { title: 'QuadWord', desc: 'Solve four words at once with nine shared guesses.', accent: '#ec4899', roman: 'IV', guide: 'quadword' },
  { title: 'OctoWord', desc: 'Eight boards, thirteen guesses — the ultimate grid.', accent: '#7e22ce', roman: 'VIII', guide: 'octoword' },
  { title: 'Succession', desc: 'Four words, unlocked and solved one at a time.', accent: '#2563eb', guide: 'succession', Icon: TrendingUp },
  { title: 'Deliverance', desc: 'Four boards that start with letters already placed.', accent: '#059669', guide: 'deliverance', Icon: Shield },
  { title: 'Six', desc: 'Longer six-letter words in seven tries.', accent: '#06b6d4', guide: 'six', Icon: SixIcon },
  { title: 'Seven', desc: 'Seven-letter words in eight tries for word pros.', accent: '#84cc16', guide: 'seven', Icon: SevenIcon },
  { title: 'Gauntlet', desc: 'Five escalating stages chained into one run.', accent: '#d97706', guide: 'gauntlet', Icon: Skull },
  { title: 'ProperNoundle', desc: 'Guess famous names from a daily category.', accent: '#dc2626', guide: 'propernoundle', Icon: Crown },
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Is Wordocious free to play?', a: 'Yes. A new daily puzzle in every mode is free every day. An optional Pro subscription removes ads and unlocks unlimited replays.' },
  { q: 'How is it different from other word games?', a: 'Wordocious bundles ten ways to play — single-board Classic, multi-board QuadWord and OctoWord, the sequential Succession, prefilled Deliverance, longer Six and Seven, a five-stage Gauntlet, name-guessing ProperNoundle, and real-time VS battles — all sharing one daily seed so everyone plays the same words.' },
  { q: 'Do I need an account?', a: 'You can read about every mode here without signing in. To play, save your streaks, and climb the daily leaderboards, sign in with Google or email.' },
  { q: 'How do daily challenges work?', a: 'Each mode has one shared daily puzzle that resets at local midnight. Finish all of them for a Daily Sweep, or win them all for a Flawless Victory and bonus XP.' },
  { q: 'What are leaderboards and medals?', a: 'Every daily puzzle has a leaderboard ranked by a composite of guesses and solve time. Top finishers earn gold, silver, and bronze medals shown on their profile.' },
];

export function Landing() {
  const [showLogin, setShowLogin] = useState(false);
  const { enterGuest } = useAuth();
  if (showLogin) return <LoginScreen />;

  const wordmarkStyle = {
    backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
  };
  const ctaStyle = { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' };

  return (
    <div className="min-h-screen overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 max-w-3xl mx-auto">
        <span className="text-2xl font-black tracking-tight" style={wordmarkStyle}>WORDOCIOUS</span>
        <button onClick={() => setShowLogin(true)} className="btn-3d px-5 py-2 rounded-xl text-white font-extrabold text-sm" style={ctaStyle}>
          Sign In
        </button>
      </header>

      {/* Hero */}
      <section className="text-center px-6 pt-8 pb-10 max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3" style={wordmarkStyle}>WORDOCIOUS</h1>
        <p className="text-base font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          One daily word game. Ten ways to play.
        </p>
        <p className="text-sm font-medium mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          A fresh set of word puzzles every day — from the classic five-letter chase to eight-board
          marathons, a five-stage Gauntlet, and real-time head-to-head battles. Everyone plays the same
          daily words, climbs the same leaderboards, and chases the same streaks.
        </p>
        <button onClick={() => setShowLogin(true)} className="btn-3d px-8 py-3 rounded-xl text-white font-black text-sm" style={ctaStyle}>
          Sign in to play
        </button>
        <div className="mt-3">
          <button onClick={enterGuest} className="text-sm font-extrabold underline underline-offset-2" style={{ color: 'var(--color-text-secondary)' }}>
            Play without an account
          </button>
          <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Play today&apos;s daily puzzles free. Sign in to save stats, streaks, and compete.
          </p>
        </div>
      </section>

      {/* Modes */}
      <section className="px-5 pb-10 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Ten Game Modes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODES.map((m) => (
            <div key={m.title} className="relative overflow-hidden p-4 pt-5" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px' }}>
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${m.accent}, ${m.accent}88)` }} />
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black" style={{ background: `${m.accent}15`, color: m.accent }}>
                  {m.roman ? m.roman : m.Icon ? <m.Icon className="w-4 h-4" style={{ color: m.accent }} /> : m.title.charAt(0)}
                </span>
                <h3 className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{m.title}</h3>
              </div>
              <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{m.desc}</p>
              {m.guide && (
                <Link href={`/guides/${m.guide}`} className="inline-block text-[11px] font-extrabold mt-1.5" style={{ color: m.accent }}>
                  Rules, scoring &amp; strategy →
                </Link>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs font-medium mt-3" style={{ color: 'var(--color-text-secondary)' }}>
          Want the deep dives? The <Link href="/guides" style={{ color: '#7c3aed', fontWeight: 800 }}>mode guides</Link> cover
          exact scoring formulas, hint economics, and leaderboard strategy for every mode.
        </p>
      </section>

      {/* How to play */}
      <section className="px-5 pb-10 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>How to Play</h2>
        <div className="p-5 space-y-2" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
          <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Guess the hidden word. After each guess, every tile flips to show how close you were:
            <strong style={{ color: '#7c3aed' }}> purple</strong> means the right letter in the right spot,
            <strong style={{ color: '#f59e0b' }}> amber</strong> means the letter is in the word but elsewhere, and
            <strong style={{ color: '#6b7280' }}> gray</strong> means it isn&apos;t in the word at all. Use those clues to
            narrow it down before you run out of tries.
          </p>
          <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Multi-board modes apply each guess to every board at once, so you have to juggle several words in parallel.
            Finish faster and in fewer guesses to score higher on the daily leaderboard.
          </p>
          <Link href="/how-to-play" className="inline-block text-sm font-extrabold pt-1" style={{ color: '#7c3aed' }}>
            Read the full guide →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 pb-10 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>Frequently Asked Questions</h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <div key={item.q} className="p-4" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px' }}>
              <h3 className="text-sm font-black mb-1" style={{ color: 'var(--color-text)' }}>{item.q}</h3>
              <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 text-center border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button onClick={() => setShowLogin(true)} className="btn-3d px-8 py-3 rounded-xl text-white font-black text-sm mb-2" style={ctaStyle}>
          Sign in to play
        </button>
        <div className="mb-4">
          <button onClick={enterGuest} className="text-sm font-extrabold underline underline-offset-2" style={{ color: 'var(--color-text-secondary)' }}>
            Play without an account
          </button>
        </div>
        <div className="flex items-center justify-center gap-3 text-[11px] font-bold flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
          <Link href="/about">About</Link><span>·</span>
          <Link href="/how-to-play">How to Play</Link><span>·</span>
          <Link href="/guides">Mode Guides</Link><span>·</span>
          <Link href="/faq">FAQ</Link><span>·</span>
          <Link href="/privacy">Privacy</Link><span>·</span>
          <Link href="/terms">Terms</Link><span>·</span>
          <Link href="/support">Support</Link>
        </div>
        <p className="text-[10px] font-bold mt-3" style={{ color: 'var(--color-text-muted)' }}>© Wordocious. A daily word game.</p>
      </footer>
    </div>
  );
}
