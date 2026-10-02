'use client';

import { CLOSE_OVERLAYS_EVENT } from '@/lib/nav-home';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { CastHeader, CAST_ROW } from '@/components/ui/cast-header';
import { HeaderGlyph } from '@/components/ui/header-glyph';
import { CandyButton } from '@/components/ui/candy-button';
import { MenuModal } from '@/components/modals/menu-modal';
import { SettingsDialog } from '@/components/settings-dialog';
import { FlawlessPopup, ShieldPopup, StreakPopup } from '@/components/ui/streak-popups';
import { cachedFlawlessStreak, fetchDailySweepStats } from '@/lib/stats-service';
import { getTodayLocal } from '@/lib/daily-service';
import { readLinkReturn } from '@/lib/identity-linking';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { useFlags } from '@/hooks/use-flags';
import { EMPTY_STREAK_SUMMARY, type StreakSummary } from '@/lib/streak-summary';

// The home header (docs/HEADER_SPEC.md §1; FINISH_SPEC A3, A5, C1, C5), shared
// by Home, Leaderboard, Records, Stats and Pro. AS2: Row 1 is the controls —
// the soft 3D counters drawn bare (streak, flawless trophies, shields) on the
// left, help + settings on the right, each with the icon squish; Row 2 is the
// living cast header — the ten heroes spelling WORDOCIOUS edge to edge, one of
// them playing its move every few seconds (Pro: W wears the crown). The
// counters open the streak / shield / flawless popups (C5), portaled to <body>
// full screen (AS6); the streak popup carries every streak (AS7).

export function AppHeader() {
  const { profile, isProActive, isGuest, exitGuest } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [shieldOpen, setShieldOpen] = useState(false);
  const [flawlessOpen, setFlawlessOpen] = useState(false);
  // FINISH_SPEC AJ: a footer tab tap closes every header popup / sheet.
  useEffect(() => {
    const close = () => { setHelpOpen(false); setSettingsOpen(false); setStreakOpen(false); setShieldOpen(false); setFlawlessOpen(false); };
    window.addEventListener(CLOSE_OVERLAYS_EVENT, close);
    return () => window.removeEventListener(CLOSE_OVERLAYS_EVENT, close);
  }, []);

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

  // AS7: the streak popup shows every run — loaded when it opens.
  const { isOn: flagOn } = useFlags();
  const [summary, setSummary] = useState<StreakSummary>(EMPTY_STREAK_SUMMARY);
  useEffect(() => {
    if (!streakOpen || !profile?.id) return;
    let cancelled = false;
    const uid = profile.id;
    Promise.all([
      import('@/lib/stats-service').then((m) => m.fetchDailySweepStats(uid)),
      import('@/components/home/mode-chrome').then((m) => m.MORE_CARDS.filter((c) => c.dailyEligible && c.dbKey && flagOn(c.flagKey)).map((c) => c.dbKey as string)),
    ])
      .then(async ([sweep, keys]) => {
        const puzzles = await import('@/lib/home-streaks').then((m) => m.fetchPuzzleRecords(uid, keys));
        if (cancelled) return;
        setSummary({
          wordSweep: { current: sweep.currentSweepStreak, best: null },
          puzzleSweep: { current: puzzles.sweep, best: puzzles.bestSweep },
          wordFlawless: { current: sweep.currentFlawlessStreak, best: sweep.bestFlawlessStreak },
          puzzleFlawless: { current: puzzles.flawless, best: puzzles.bestFlawless },
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streakOpen, profile?.id]);

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
      {/* FINISH_SPEC AG: on desktop web the header is the 560 px centered column, so the cast row stays 90% of it. */}
      <header className="pb-1 page-col" style={{ paddingTop: CAST_ROW.topMargin }}>
        {/* AS2 Row 1: the controls — the bare 3D counters left, help + settings right. */}
        <div className="relative flex items-center justify-between gap-2 px-3">
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
              <StreakPopup open={streakOpen} onClose={() => setStreakOpen(false)} streak={streak} best={bestStreak} today={today} playedToday={playedToday} summary={summary} shields={shields} />
              <ShieldPopup open={shieldOpen} onClose={() => setShieldOpen(false)} shields={shields} />
            </>
          )}
        </div>
        {/* AS2 Row 2: the living cast header (under the controls) — FINISH_SPEC N3: ≈90% of the width,
            centered, with a soft ground shadow. The link home is the old wordmark's tap. */}
        <Link href="/" aria-label="Wordocious home" className="block mx-auto" style={{ width: `${CAST_ROW.widthPct}%`, marginTop: CAST_ROW.controlsGap }} data-no-squish="">
          <CastHeader crown={isPro} ground />
        </Link>

      </header>

      <MenuModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
