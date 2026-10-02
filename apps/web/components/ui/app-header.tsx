'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { CastHeader } from '@/components/ui/cast-header';
import { HeaderGlyph } from '@/components/ui/header-glyph';
import { CandyButton } from '@/components/ui/candy-button';
import { MenuModal } from '@/components/modals/menu-modal';
import { SettingsDialog } from '@/components/settings-dialog';
import { FlawlessPopup, ShieldPopup, StreakPopup } from '@/components/ui/streak-popups';
import { cachedFlawlessStreak, fetchDailySweepStats } from '@/lib/stats-service';
import { getTodayLocal } from '@/lib/daily-service';
import { readLinkReturn } from '@/lib/identity-linking';
import { useDailyCompletions } from '@/lib/daily-completions-context';

// The home header (docs/HEADER_SPEC.md §1; FINISH_SPEC A3, A5, C1, C5), shared
// by Home, Leaderboard, Records, Stats and Pro. Row 1: the living cast header —
// the ten heroes spelling WORDOCIOUS edge to edge, one of them playing its
// move every few seconds (Pro: W wears the crown). Row 2: the soft 3D
// counters drawn bare (streak, flawless trophies, shields) on the left, help +
// settings on the right, each with the icon squish. The counters open the
// streak / shield / flawless popups (C5). Every tap is the same as before.

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

  const { todayDailies, dailiesDay } = useDailyCompletions();
  const today = getTodayLocal();
  const playedToday = dailiesDay === today && todayDailies.size > 0;
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
      <header className="pt-1 pb-1">
        {/* Row 1: the living cast header, edge to edge. The link home is the old wordmark's tap. */}
        <Link href="/" aria-label="Wordocious home" className="block px-1" data-no-squish="">
          <CastHeader crown={isPro} />
        </Link>

        {/* Row 2: the bare 3D counters left, help + settings right. The popups hang under this row. */}
        <div className="relative flex items-center justify-between gap-2 px-3 mt-0.5">
          <div className="flex items-center gap-1 min-w-0">
            {/* Guest — prominent Sign In entry (returns to the landing/login). */}
            {isGuest && !profile && (
              <CandyButton size="sm" color="purple" onClick={exitGuest}>Sign In</CandyButton>
            )}

            {profile && (
              <>
                {streak > 0 && (
                  <HeaderGlyph icon="flame" value={streak} onClick={openStreak} label={`Daily streak: ${streak}`} aria-expanded={streakOpen} />
                )}
                {/* §244: flawless-streak counter — only when a live run >= 2. */}
                {flawlessStreak >= 2 && (
                  <HeaderGlyph icon="trophy" value={flawlessStreak} onClick={openFlawless} label={`Flawless streak: ${flawlessStreak}`} aria-expanded={flawlessOpen} />
                )}
                <HeaderGlyph icon="shield" value={shields} onClick={openShield} label={`Streak shields: ${shields}`} aria-expanded={shieldOpen} />
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* "?" menu — opens the site-nav menu (native MenuSheet parity) */}
            <HeaderGlyph icon="help" onClick={() => setHelpOpen(true)} label="Menu" />
            {/* Settings button — always visible (theme, sound, accessibility) */}
            <HeaderGlyph icon="gear" onClick={() => setSettingsOpen(true)} label="Settings" />
          </div>

          {profile && (
            <>
              <FlawlessPopup open={flawlessOpen} onClose={() => setFlawlessOpen(false)} streak={flawlessStreak} />
              <StreakPopup open={streakOpen} onClose={() => setStreakOpen(false)} streak={streak} best={bestStreak} today={today} playedToday={playedToday} />
              <ShieldPopup open={shieldOpen} onClose={() => setShieldOpen(false)} shields={shields} />
            </>
          )}
        </div>
      </header>

      <MenuModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
