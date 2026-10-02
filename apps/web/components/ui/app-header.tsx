'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { CastTitle } from '@/components/ui/cast-title';
import { Icon3D } from '@/components/ui/icon3d';
import { HEADER_SHADOW } from '@/components/ui/page-header';
import { MenuModal } from '@/components/modals/menu-modal';
import { SettingsDialog } from '@/components/settings-dialog';
import { StatPopover } from '@/components/ui/stat-popover';
import { cachedFlawlessStreak, fetchDailySweepStats } from '@/lib/stats-service';
import { getTodayLocal } from '@/lib/daily-service';
import { readLinkReturn } from '@/lib/identity-linking';

// The home header (docs/HEADER_SPEC.md §1), shared by Home, Leaderboard,
// Records, Stats and Pro. Row 1: the cast title (replaces the WORDOCIOUS text
// and the PRO pill; Pro gets the crowned W + gold glow line). Row 2: the stat
// pills (streak, flawless trophies, shields) on the left, help + settings on
// the right. Every tap is the same as before the redesign.

/** Stat pill inks (§1). */
const INK = { streak: '#c2410c', trophy: '#92400e', shield: '#5b21b6' } as const;

function StatPill({ icon, value, ink, onClick, label }: {
  icon: 'flame' | 'trophy' | 'shield';
  value: number;
  ink: string;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center gap-1 pl-1.5 pr-2.5 rounded-full transition-transform active:scale-95"
      style={{ height: 32, background: '#ffffff', boxShadow: HEADER_SHADOW, color: ink }}
    >
      <Icon3D name={icon} size={20} priority />
      <span className="font-black leading-none" style={{ fontSize: 15 }}>{value}</span>
    </button>
  );
}

function HeaderIconButton({ icon, onClick, label }: { icon: 'help' | 'gear'; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center rounded-full transition-transform active:scale-95"
      style={{ width: 38, height: 38, background: '#ffffff', boxShadow: HEADER_SHADOW }}
    >
      <Icon3D name={icon} size={22} priority />
    </button>
  );
}

export function AppHeader() {
  const { profile, isProActive, isGuest, exitGuest } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [shieldOpen, setShieldOpen] = useState(false);
  const [flawlessOpen, setFlawlessOpen] = useState(false);

  // Back from a Settings › Linked sign-ins round trip (?link=apple): reopen
  // Settings so the section can say whether it worked (founder, 2026-09-30).
  useEffect(() => {
    if (readLinkReturn(window.location.href)) setSettingsOpen(true);
  }, []);

  // §244: the flawless-streak pill reads the day-stamped cache written by
  // fetchDailySweepStats — synchronous, no query on the render path.
  // Trusted only when stamped today or yesterday (older = possibly broken).
  const readFlawlessStreak = () => {
    const c = cachedFlawlessStreak();
    if (!c || c.streak < 2) return 0;
    const today = getTodayLocal();
    const [y, m, d] = today.split('-').map(Number);
    const yd = new Date(y, (m ?? 1) - 1, (d ?? 1) - 1);
    const yesterday = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`;
    return c.day === today || c.day === yesterday ? c.streak : 0;
  };
  const [flawlessStreak, setFlawlessStreak] = useState(readFlawlessStreak);
  const pathname = usePathname();
  // §255 (founder: "the web version is missing the flawless streak button at
  // the top"): that cache was written ONLY by the Records and Profile pages, so
  // on the home screen — or any fresh browser — the pill stayed hidden until
  // one of them had been visited that day. The header now refreshes the cache
  // itself once per day per sign-in, and re-reads it on every navigation so a
  // sweep finished on /daily shows up here without a reload.
  useEffect(() => {
    setFlawlessStreak(readFlawlessStreak());
    if (!profile?.id) return;
    if (cachedFlawlessStreak()?.day === getTodayLocal()) return;
    let cancelled = false;
    fetchDailySweepStats(profile.id)
      .then(() => { if (!cancelled) setFlawlessStreak(readFlawlessStreak()); })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, pathname]);

  const shields = (profile as any)?.streak_shields ?? 0;
  const streak = profile?.daily_login_streak ?? 0;
  const bestStreak = (profile as any)?.best_daily_login_streak ?? 0;
  const isPro = isProActive;

  const openStreak = () => {
    setShieldOpen(false);
    setFlawlessOpen(false);
    setStreakOpen((prev) => !prev);
  };

  const openShield = () => {
    setStreakOpen(false);
    setFlawlessOpen(false);
    setShieldOpen((prev) => !prev);
  };

  const openFlawless = () => {
    setStreakOpen(false);
    setShieldOpen(false);
    setFlawlessOpen((prev) => !prev);
  };

  return (
    <>
      <header className="px-4 pt-2 pb-2 space-y-2">
        {/* Row 1: the cast title. The link home is the old wordmark's tap. */}
        <Link href="/" aria-label="Wordocious home" className="flex justify-center">
          <CastTitle crown={isPro} />
        </Link>

        {/* Row 2: stat pills left, help + settings right. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 relative min-w-0">
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
                  <StatPill icon="flame" value={streak} ink={INK.streak} onClick={openStreak} label={`Daily streak: ${streak}`} />
                )}
                {/* §244: flawless-streak pill — only when a live run >= 2. */}
                {flawlessStreak >= 2 && (
                  <StatPill icon="trophy" value={flawlessStreak} ink={INK.trophy} onClick={openFlawless} label={`Flawless streak: ${flawlessStreak}`} />
                )}
                {/* Shield pill */}
                <StatPill icon="shield" value={shields} ink={INK.shield} onClick={openShield} label={`Streak shields: ${shields}`} />

                {/* §244: Flawless Popover */}
                <StatPopover open={flawlessOpen} onClose={() => setFlawlessOpen(false)} align="left">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon3D name="trophy" size={20} />
                      <span className="font-black text-sm" style={{ color: 'var(--color-text)' }}>Flawless Streak</span>
                    </div>
                    <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                      {flawlessStreak} straight day{flawlessStreak === 1 ? '' : 's'} winning every daily.
                      Win every daily today to keep it alive.
                    </p>
                  </div>
                </StatPopover>

                {/* Streak Popover */}
                <StatPopover open={streakOpen} onClose={() => setStreakOpen(false)} align="left">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon3D name="flame" size={20} />
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
                <StatPopover open={shieldOpen} onClose={() => setShieldOpen(false)} align="left">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon3D name="shield" size={20} />
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

          <div className="flex items-center gap-2 shrink-0">
            {/* "?" menu — opens the site-nav menu (native MenuSheet parity) */}
            <HeaderIconButton icon="help" onClick={() => setHelpOpen(true)} label="Menu" />
            {/* Settings button — always visible (theme, sound, accessibility) */}
            <HeaderIconButton icon="gear" onClick={() => setSettingsOpen(true)} label="Settings" />
          </div>
        </div>
      </header>

      <MenuModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
