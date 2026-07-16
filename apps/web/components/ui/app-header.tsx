'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import Link from 'next/link';
import { Flame, HelpCircle, Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ProBadge } from '@/components/ui/pro-badge';
import { MenuModal } from '@/components/modals/menu-modal';
import { SettingsDialog } from '@/components/settings-dialog';
import { StatPopover } from '@/components/ui/stat-popover';

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L3 5.5V10C3 14.5 6 17.5 10 19C14 17.5 17 14.5 17 10V5.5L10 2Z" fill="#A78BFA" stroke="#8B5CF6" strokeWidth="1"/>
      <path d="M8.5 10.5L9.5 11.5L12 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * Wordmark that SCALES its font down to fit the space left of the header
 * controls — the web equivalent of the native header's minimumScaleFactor.
 * "WORDOCIOUS" (+ PRO badge) must always show in full: an ellipsized
 * wordmark or a badge clipping into the help button are both unacceptable.
 * Measured with a ResizeObserver so streak/shield digit growth, rotation,
 * and font load all re-fit; 11px floor, then ellipsis as a never-in-practice
 * fallback.
 */
function FitWordmark() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '20px';
      const scale = el.clientWidth / Math.max(1, el.scrollWidth);
      if (scale < 1) el.style.fontSize = `${Math.max(10, Math.floor(20 * scale * 10) / 10)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (el.parentElement) ro.observe(el.parentElement);
    // Nunito loads async — the fallback font measures differently.
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(fit).catch(() => {});
    }
    return () => ro.disconnect();
  }, []);
  return (
    <span
      ref={ref}
      className="font-black truncate min-w-0"
      style={{
        fontSize: '20px',
        backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      WORDOCIOUS
    </span>
  );
}

export function AppHeader() {
  const { profile, isProActive, isGuest, exitGuest } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [shieldOpen, setShieldOpen] = useState(false);

  const shields = (profile as any)?.streak_shields ?? 0;
  const streak = profile?.daily_login_streak ?? 0;
  const bestStreak = (profile as any)?.best_daily_login_streak ?? 0;
  const isPro = isProActive;

  const openStreak = () => {
    setShieldOpen(false);
    setStreakOpen((prev) => !prev);
  };

  const openShield = () => {
    setStreakOpen(false);
    setShieldOpen((prev) => !prev);
  };

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-1.5 min-w-0 shrink overflow-hidden">
          <FitWordmark />
          {isPro && <span className="shrink-0 flex items-center"><ProBadge size="sm" /></span>}
        </Link>

        {/* gap-1.5 matches the native header's spacing(6) — the extra 2px per
            gap was part of what squeezed the wordmark into truncating. */}
        <div className="flex items-center gap-1.5 relative shrink-0">
          {/* "?" menu — opens the site-nav menu (native MenuSheet parity) */}
          <button
            onClick={() => setHelpOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
            style={{
              background: 'var(--color-surface-alt)',
              border: '1.5px solid var(--color-border-alt)',
              color: 'var(--color-text-muted)',
            }}
            aria-label="Menu"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Settings button — always visible (theme, sound, accessibility) */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
            style={{
              background: 'var(--color-surface-alt)',
              border: '1.5px solid var(--color-border-alt)',
              color: 'var(--color-text-muted)',
            }}
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Guest — prominent Sign In entry (returns to the landing/login). */}
          {isGuest && !profile && (
            <button
              onClick={exitGuest}
              className="px-3.5 py-1.5 rounded-xl text-white font-extrabold text-sm transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 2px 0 #4c1d95' }}
            >
              Sign In
            </button>
          )}

          {profile && (
            <>
              {/* Streak pill */}
              {streak > 0 && (
                <button
                  onClick={openStreak}
                  className="flex items-center gap-1 px-2.5 py-1.5 font-extrabold text-sm transition-transform active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #fffbeb, #fff7ed)',
                    border: '1.5px solid #fde68a',
                    borderRadius: '20px',
                    color: '#92400e',
                  }}
                >
                  <Flame className="w-3.5 h-3.5" style={{ color: '#f97316' }} />
                  <span>{streak}</span>
                </button>
              )}
              {/* Shield pill */}
              <button
                onClick={openShield}
                className="flex items-center gap-1.5 px-2.5 py-1.5 font-extrabold text-sm transition-transform active:scale-95"
                style={{
                  background: 'var(--color-surface-hover)',
                  border: '1.5px solid #c4b5fd',
                  borderRadius: '20px',
                  color: '#5b21b6',
                }}
              >
                <ShieldIcon className="w-4 h-4" />
                <span>{shields}</span>
              </button>

              {/* Streak Popover */}
              <StatPopover open={streakOpen} onClose={() => setStreakOpen(false)}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5" style={{ color: '#f97316' }} />
                    <span className="text-sm font-black" style={{ color: 'var(--color-text)' }}>Daily Streak</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>Current</span>
                      <span className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{streak} {streak === 1 ? 'day' : 'days'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>Best</span>
                      <span className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{bestStreak} {bestStreak === 1 ? 'day' : 'days'}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-divider)' }} className="pt-2.5">
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      Play any daily puzzle each day to keep your streak going. Miss a day and it resets — unless you use a streak shield.
                    </p>
                  </div>
                </div>
              </StatPopover>

              {/* Shield Popover */}
              <StatPopover open={shieldOpen} onClose={() => setShieldOpen(false)}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldIcon className="w-5 h-5" />
                    <span className="text-sm font-black" style={{ color: 'var(--color-text)' }}>Streak Shields</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>Available</span>
                    <span className="text-sm font-black" style={{ color: '#5b21b6' }}>{shields} {shields === 1 ? 'shield' : 'shields'}</span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-divider)' }} className="pt-2.5">
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      Shields protect your streak if you miss a day. Earn a free shield every 7-day streak milestone. PRO members get 4 shields each billing period.
                    </p>
                  </div>
                </div>
              </StatPopover>
            </>
          )}
        </div>
      </header>

      <MenuModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
