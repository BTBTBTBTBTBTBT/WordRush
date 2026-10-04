'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
// Loaded on the "Sign in" tap only (founder, 2026-09-29).
const LoginScreen = dynamic(() => import('./login-screen').then((m) => m.LoginScreen));
import { useAuth } from '@/lib/auth-context';
import { getGuide, PUBLIC_MODE_GUIDES as MODE_GUIDES } from '@/lib/guide-content';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton, TextLink, TextLinkA } from '@/components/ui/cast-button';
import { softRow } from '@/components/ui/soft-popup';
import { softBackground } from '@/lib/soft-surface';

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
  const accent = guide.accent;
  const others = MODE_GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: softBackground('#7c3aed', 0.06) }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 max-w-3xl mx-auto">
        <Link href="/" className="text-2xl font-black tracking-tight" style={wordmarkStyle}>WORDOCIOUS</Link>
        <CastButton color="purple" size="sm" onClick={() => setShowLogin(true)}>
          Sign In
        </CastButton>
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
        <CastButton color="purple" size="lg" icon="play" onClick={() => setShowLogin(true)}>
          Sign in to play
        </CastButton>
        <div className="mt-3">
          <TextLink onClick={enterGuest} style={{ textTransform: 'none' }}>
            Play without an account
          </TextLink>
          <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Play today&apos;s daily {guide.title} free. Sign in to save stats, streaks, and compete on the leaderboard.
          </p>
        </div>
      </section>

      {/* Quick facts */}
      <section className="px-5 pb-8 max-w-3xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {guide.facts.map((f) => (
            <div key={f.label} className="p-3 text-center" style={softRow(accent, { radius: 12 })}>
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
        <div className="p-5 space-y-3" style={softRow(accent, { radius: 16 })}>
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
        <div className="p-5 space-y-3" style={softRow(accent, { radius: 16 })}>
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
            <div key={t.heading} className="p-4" style={softRow(accent, { radius: 14 })}>
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
            <Link key={g.slug} href={`/guides/${g.slug}`} className="px-3 py-1.5 text-xs font-extrabold" style={{ ...softRow(g.accent, { radius: 10 }), color: 'var(--color-text)' }}>
              {g.title}
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 text-center border-t" style={{ borderColor: 'var(--color-border)' }}>
        <CastButton color="purple" size="lg" icon="play" onClick={() => setShowLogin(true)} className="mb-2">
          Sign in to play
        </CastButton>
        <div className="mb-4">
          <TextLink onClick={enterGuest} style={{ textTransform: 'none' }}>
            Play without an account
          </TextLink>
        </div>
        <div className="flex items-center justify-center gap-3 text-[11px] font-bold flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
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
