'use client';

import { CLOSE_OVERLAYS_EVENT } from '@/lib/nav-home';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { CastHeader, CAST_ROW } from '@/components/ui/cast-header';
import { GLYPH_SIZE, HeaderGlyph, TAP } from '@/components/ui/header-glyph';
import { CandyButton } from '@/components/ui/candy-button';
import { MenuModal } from '@/components/modals/menu-modal';
import { SettingsDialog } from '@/components/settings-dialog';
import { FlawlessPopup, ShieldPopup, StreakPopup } from '@/components/ui/streak-popups';
import { cachedFlawlessStreak, fetchDailySweepStats } from '@/lib/stats-service';
import { getTodayLocal } from '@/lib/daily-service';
import { readLinkReturn } from '@/lib/identity-linking';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { useFlags } from '@/hooks/use-flags';
import { sheetTapFires } from '@/lib/settings-previews';
import { EMPTY_STREAK_SUMMARY, type StreakSummary } from '@/lib/streak-summary';
import { DesktopTabs } from '@/components/ui/desktop-tabs';
import { tabTint } from '@/components/ui/tab-nav';
import { afterIntro } from '@/lib/intro';
import { warmTabWallpapers } from '@/lib/predecode';
import { DESKTOP_MIN, minWidthQuery } from '@/lib/desktop-layout';

// The home header (docs/HEADER_SPEC.md §1; FINISH_SPEC A3, A5, C1, C5), shared
// by Home, Leaderboard, Records, Stats and Pro. AS2: Row 1 is the controls —
// the soft 3D counters drawn bare (streak, flawless trophies, shields) on the
// left, help + settings on the right, each with the icon squish; Row 2 is the
// living cast header — the ten heroes spelling WORDOCIOUS edge to edge, one of
// them playing its move every few seconds (Pro: W wears the crown). The
// counters open the streak / shield / flawless popups (C5), portaled to <body>
// full screen (AS6); the streak popup carries every streak (AS7).
// Desktop website (≥ 1024 px, lib/desktop-layout.ts; globals.css .app-hdr):
// the same pieces become ONE sticky top bar — the cast wordmark on the left,
// the candy pill tabs in the middle (DesktopTabs; the bottom bar hides on these
// pages), the counters + help + settings on the right. Below 1024 px the extra
// tabs are hidden and the header is exactly the phone header.

/** BJ6 round 3: the right group's gap between visual edges, and the glyph box hugging its icon. */
const RIGHT_GAP = 8;
const HUG = { minWidth: GLYPH_SIZE } as const;

/** FINISH_SPEC BJ6: Home's share-today control (Home only); absent when not shown (no reserved slot). */
export interface HeaderShare {
  visible: boolean;
  onShare: () => void;
}

export function AppHeader({ share }: { share?: HeaderShare } = {}) {
  const { profile, isProActive, isGuest, exitGuest } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // BI25: help / gear fire once — a double click can't open and then close a sheet.
  const lastSheetTap = useRef<number | null>(null);
  const openSheetOnce = (open: () => void) => {
    const now = performance.now();
    if (!sheetTapFires(now, lastSheetTap.current, helpOpen || settingsOpen)) return;
    lastSheetTap.current = now;
    open();
  };
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

  // Desktop: publish the sticky top bar's height (--desk-hdr-h) so sticky side
  // columns and scroll anchors clear it.
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--desk-hdr-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--desk-hdr-h'); };
  }, []);

  // Desktop website: once the intro has landed and the browser is idle, fetch +
  // decode the four tabs' wide wallpapers so a tab switch never paints a cold
  // 2400 × 1500 image in its first frames (phones skip it: no extra data).
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia(minWidthQuery(DESKTOP_MIN)).matches) return;
    return afterIntro(() => warmTabWallpapers(true));
  }, []);

  return (
    <>
      {/* FINISH_SPEC AG: on desktop web the header is the 560 px centered column, so the cast row stays 90% of it.
          ≥ 1024 px it is the website's sticky top bar (globals.css .app-hdr). */}
      <header className="app-hdr pb-1 page-col" ref={headerRef} data-tab-tint={tabTint(pathname)} style={{ paddingTop: CAST_ROW.topMargin }}>
        {/* AS2 Row 1: the controls — the bare 3D counters left, help + settings right. */}
        <div className="hdr-row relative flex items-center justify-between gap-2 px-3">
          <div className="flex items-center gap-1 min-w-0">
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

          {/* BJ6 round 3 (founder 10-03): ONE right-aligned, evenly spaced group — guests
              [SIGN IN] [?] [gear]; Home once there is something to share [Share] [?] [gear]. Every
              control is 8 apart edge to edge (the glyph boxes hug their icons; .hdr-glyph::after keeps
              the 44 px tap target), and an absent control just drops out — no reserved slots. The
              group keeps the gear where it was (the old 44 box's inset on the right). */}
          <div className="flex items-center shrink-0" style={{ gap: RIGHT_GAP, paddingRight: (TAP - GLYPH_SIZE) / 2 }}>
            {/* Guest — prominent Sign In entry (returns to the landing/login). */}
            {isGuest && !profile && (
              <CandyButton size="sm" color="purple" onClick={exitGuest}>Sign In</CandyButton>
            )}
            {share?.visible && (
              <HeaderGlyph icon="share" onClick={share.onShare} label="Share today's progress" style={HUG} />
            )}
            {/* "?" menu — opens the site-nav menu (native MenuSheet parity) */}
            <HeaderGlyph icon="help" onClick={() => openSheetOnce(() => setHelpOpen(true))} label="Menu" style={HUG} />
            {/* Settings button — always visible (theme, sound, accessibility). BI25: single-fire. */}
            <HeaderGlyph icon="gear" onClick={() => openSheetOnce(() => setSettingsOpen(true))} label="Settings" style={HUG} />
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
        <Link href="/" aria-label="Wordocious home" className="hdr-cast block mx-auto" style={{ width: `${CAST_ROW.widthPct}%`, marginTop: CAST_ROW.controlsGap }} data-no-squish="">
          <CastHeader crown={isPro} ground />
        </Link>
        {/* Desktop website: the four tabs as candy pills (hidden below 1024 px). */}
        <DesktopTabs />

      </header>

      <MenuModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
