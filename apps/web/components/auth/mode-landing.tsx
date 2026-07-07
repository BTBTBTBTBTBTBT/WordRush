'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoginScreen } from './login-screen';
import { useAuth } from '@/lib/auth-context';
import { getGuide, MODE_GUIDES } from '@/lib/guide-content';

/**
 * Public per-mode landing shown to signed-out visitors (and crawlers) on a
 * game URL — /quordle, /six, /gauntlet, … Each game route serves UNIQUE
 * crawlable content sourced from the mode's guide (rules, scoring, tips)
 * instead of the one generic Landing, which read as ~10 duplicate pages to
 * AdSense. Gameplay stays gated: "Sign in to play" reveals LoginScreen and
 * "Play without an account" enters guest mode, which drops straight into
 * this game.
 */
export function ModeLanding({ guideSlug }: { guideSlug: string }) {
  const [showLogin, setShowLogin] = useState(false);
  const { enterGuest } = useAuth();
  const guide = getGuide(guideSlug);
  if (showLogin) return <LoginScreen />;
  if (!guide) return null;

  const wordmarkStyle = {
    backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
  };
  const ctaStyle = { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' };
  const accent = guide.accent;
  const others = MODE_GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <div className="min-h-screen overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 max-w-3xl mx-auto">
        <Link href="/" className="text-2xl font-black tracking-tight" style={wordmarkStyle}>WORDOCIOUS</Link>
        <button onClick={() => setShowLogin(true)} className="btn-3d px-5 py-2 rounded-xl text-white font-extrabold text-sm" style={ctaStyle}>
          Sign In
        </button>
      </header>

      {/* Hero */}
      <section className="text-center px-6 pt-8 pb-8 max-w-2xl mx-auto">
        <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: accent }}>
          A Wordocious daily game mode
        </p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3" style={{ color: 'var(--color-text)' }}>
          {guide.title}
        </h1>
        <p className="text-base font-bold mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {guide.tagline}
        </p>
        <button onClick={() => setShowLogin(true)} className="btn-3d px-8 py-3 rounded-xl text-white font-black text-sm" style={ctaStyle}>
          Sign in to play
        </button>
        <div className="mt-3">
          <button onClick={enterGuest} className="text-sm font-extrabold underline underline-offset-2" style={{ color: 'var(--color-text-secondary)' }}>
            Play without an account
          </button>
          <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Play today&apos;s daily {guide.title} free. Sign in to save stats, streaks, and compete on the leaderboard.
          </p>
        </div>
      </section>

      {/* Quick facts */}
      <section className="px-5 pb-8 max-w-3xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {guide.facts.map((f) => (
            <div key={f.label} className="p-3 text-center" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '12px' }}>
              <div className="text-[10px] font-black uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{f.label}</div>
              <div className="text-sm font-black mt-0.5" style={{ color: accent }}>{f.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <section className="px-5 pb-8 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
          How {guide.title} works
        </h2>
        <div className="p-5 space-y-3" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
          {guide.rules.map((p, i) => (
            <p key={i} className="text-sm font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
          ))}
        </div>
      </section>

      {/* Scoring */}
      <section className="px-5 pb-8 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Scoring &amp; the daily leaderboard
        </h2>
        <div className="p-5 space-y-3" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
          {guide.scoring.map((p, i) => (
            <p key={i} className="text-sm font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="px-5 pb-8 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
          {guide.title} strategy
        </h2>
        <div className="space-y-3">
          {guide.tips.map((t) => (
            <div key={t.heading} className="p-4" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px' }}>
              <h3 className="text-sm font-black mb-1" style={{ color: 'var(--color-text)' }}>{t.heading}</h3>
              <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{t.body}</p>
            </div>
          ))}
        </div>
        <p className="text-xs font-medium mt-3" style={{ color: 'var(--color-text-secondary)' }}>
          Want more? Read the full <Link href={`/guides/${guide.slug}`} style={{ color: accent, fontWeight: 800 }}>{guide.title} guide</Link> or
          browse our <Link href="/strategy" style={{ color: '#7c3aed', fontWeight: 800 }}>strategy articles</Link>.
        </p>
      </section>

      {/* Other modes */}
      <section className="px-5 pb-10 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
          More ways to play
        </h2>
        <div className="flex flex-wrap gap-2">
          {others.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="px-3 py-1.5 text-xs font-extrabold" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '10px', color: g.accent }}>
              {g.title}
            </Link>
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
