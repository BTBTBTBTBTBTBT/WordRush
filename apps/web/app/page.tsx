'use client';

import { afterIntro } from '@/lib/intro';
import { homeCardTapBlocked } from '@/lib/nav-home';
import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { CandyButton } from '@/components/ui/candy-button';
import { MODE_CARDS, MORE_CARDS, type HomeCard } from '@/components/home/mode-chrome';
import { ModeCard, modeCardState } from '@/components/home/mode-card';
import { HomeBanner, type BannerRow } from '@/components/home/home-banner';
import { WordOfTheDay } from '@/components/home/word-of-the-day';
import { HomeTodayCard } from '@/components/home/today-card';
import { VSLiveTile } from '@/components/home/vs-live-tile';
import { moreSweepTier } from '@/lib/more-games';
import { useFlags } from '@/hooks/use-flags';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { PageBackground } from '@/components/ui/page-background';
import { HomeSectionTitle } from '@/components/home/home-section-title';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModeLimitModal } from '@/components/modals/mode-limit-modal';
import { InviteModal } from '@/components/invites/invite-modal';
import { PendingInvitesBanner } from '@/components/invites/pending-invites-banner';
import { FirstGameCard } from '@/components/ui/first-game-card';
import type { PlayMode } from '@/components/ui/play-mode-toggle';
import { useLivePlayerCount } from '@/hooks/use-live-player-count';
import { useCountdown } from '@/hooks/use-countdown';
import { getTodayLocal, fetchDailyVsResult, type DailyCompletion } from '@/lib/daily-service';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { SweepCelebration } from '@/components/effects/sweep-celebration';
import { shareTodayProgress } from '@/lib/daily-share';
import { SWEEP_MODES, MORE_GAME_MODES } from '@/lib/modes.generated';
import { bannerHeadline, type GroupProgress } from '@wordle-duel/core';

// The Daily Sweep set, from the catalog (More Games Stage 4). Every count on
// this page is taken over these keys only, so a Puzzles result on the
// completions map can never move N/8, the celebration or the Wordocious row.
const SWEEP_KEYS = new Set<string>(SWEEP_MODES.map((m) => m.dbKey as string));
const sweepEntries = <T,>(m: Map<string, T>): Array<[string, T]> => Array.from(m.entries()).filter(([k]) => SWEEP_KEYS.has(k));
import { hasPlayedModeToday, cleanupOldPlayData, getSecondsUntilMidnightLocal as getResetSeconds, formatCountdown, syncPlayLimits, setActivePlayUser } from '@/lib/play-limit-service';

/** Today's progress over a set of cards: finished and won among their daily modes. */
function progressOf(cards: HomeCard[], today: Map<string, DailyCompletion>): GroupProgress {
  let played = 0, won = 0;
  for (const c of cards) {
    const r = c.dbKey ? today.get(c.dbKey) : undefined;
    if (!r) continue;
    played += 1; if (r.won) won += 1;
  }
  return { played, won, total: cards.length };
}

// Mode cards (chrome + catalog) and the card itself live in components/home.

export default function HomePage() {
  const { user, profile, signOut, isProActive } = useAuth();
  const [limitModal, setLimitModal] = useState<{ open: boolean; modeName: string; modeHref: string }>({ open: false, modeName: '', modeHref: '' });
  const [inviteOpen, setInviteOpen] = useState(false);
  const livePlayerCount = useLivePlayerCount();
  const [playMode, setPlayModeState] = useState<PlayMode>('daily');
  const { todayDailies, dailiesDay } = useDailyCompletions();
  // The celebration renders from a SNAPSHOT captured at fire time, so a
  // concurrent refresh (e.g. the new day's empty map) can never blank the
  // stats mid-celebration (the iOS widget-launch "0/N WON · 0:00" bug).
  const [sweepCeleb, setSweepCeleb] = useState<Map<string, DailyCompletion> | null>(null);
  // Puzzles Sweep / Flawless celebration (founder, 2026-09-26) — same once-per-day-per-tier
  // rule, its own key, and it waits for the Daily Sweep celebration to close first.
  const [moreCeleb, setMoreCeleb] = useState<Map<string, DailyCompletion> | null>(null);
  // Today's daily VS outcome (server-backed, iOS vsDailyWon parity) — the VS
  // Battle card grays with a W/L badge like every other completed daily.
  const [vsDailyWon, setVsDailyWon] = useState<boolean | null>(null);
  // The banner rows' streaks (home redesign, 2026-10-01): Wordocious from the
  // Daily Sweep stats, Puzzles counted from daily_results; Unlimited's per-mode
  // "played today" counts.
  const [sweepStreaks, setSweepStreaks] = useState({ sweep: 0, flawless: 0 });
  const [puzzleStreaks, setPuzzleStreaks] = useState({ sweep: 0, flawless: 0 });
  const [unlimitedCounts, setUnlimitedCounts] = useState<Map<string, number>>(new Map());
  const router = useRouter();
  // Remote flags (Stage 7): every Puzzles title is shown only when its
  // app_flags row says so for this viewer.
  const { isOn: flagOn } = useFlags();
  const visibleCards = MODE_CARDS.filter((c) => flagOn(c.flagKey));
  const wordCards = visibleCards.filter((c) => !c.homeWide);
  const puzzleCards = MORE_CARDS.filter((c) => c.dailyEligible && c.dbKey && flagOn(c.flagKey));
  const visibleMore = MORE_GAME_MODES.filter((m) => flagOn(m.flagKey));

  const isPro = isProActive;

  // One-time-per-day celebration modal when every sweep daily is complete. Keyed
  // on the local day; re-fires if the player upgrades a Sweep → Flawless.
  useEffect(() => {
    if (!user) return;
    const sweepToday = sweepEntries(todayDailies);
    const completed = sweepToday.length;
    if (completed < SWEEP_MODES.length) return;
    const wins = sweepToday.filter(([, r]) => r.won).length;
    // Hard guards (iOS widget-launch "0/N sweep" parity): the completed set
    // must BELONG to today — a tab alive across local midnight briefly holds
    // yesterday's map — and a "sweep" with zero recorded wins is by definition
    // stale/degenerate data, never a real day of play.
    if (dailiesDay !== getTodayLocal() || wins === 0) return;
    const tier = wins >= SWEEP_MODES.length ? 'flawless' : 'sweep';
    const key = `wordocious-sweep-celebrated-${getTodayLocal()}`;
    try {
      const seen = localStorage.getItem(key);
      if (seen === 'flawless' || seen === tier) return;
      localStorage.setItem(key, tier);
      setSweepCeleb(new Map(todayDailies));
    } catch {}
  }, [user, todayDailies, dailiesDay]);

  useEffect(() => {
    if (!user || sweepCeleb) return;
    if (dailiesDay !== getTodayLocal()) return;
    const tier = moreSweepTier(todayDailies, visibleMore);
    if (!tier) return;
    const key = `wordocious-more-sweep-celebrated-${getTodayLocal()}`;
    try {
      const seen = localStorage.getItem(key);
      if (seen === 'flawless' || seen === tier) return;
      localStorage.setItem(key, tier);
      setMoreCeleb(new Map(todayDailies));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, todayDailies, dailiesDay, sweepCeleb]);

  // Restore the switch on mount for Pro users — but only within the SAME
  // browser session and local day (founder-approved UX: reopening the app
  // always lands on Daily; the founder's sister reopened after a night of
  // Unlimited, tapped Classic, and her result never hit the daily
  // leaderboard). Freemium users never see the switch and are forced to 'daily'.
  useEffect(() => {
    if (!isPro) { setPlayModeState('daily'); return; }
    try {
      localStorage.removeItem('wordocious-play-mode');
      const saved = sessionStorage.getItem('wordocious-play-mode');
      if (!saved) return;
      const { mode, day } = JSON.parse(saved) as { mode?: string; day?: string };
      if (mode === 'unlimited' && day === getTodayLocal()) setPlayModeState('unlimited');
    } catch {}
  }, [isPro]);

  // Day rollover while the tab stayed open snaps the switch back to Daily.
  useEffect(() => {
    if (!isPro) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const saved = sessionStorage.getItem('wordocious-play-mode');
        if (!saved) return;
        const { day } = JSON.parse(saved) as { day?: string };
        if (day !== getTodayLocal()) {
          sessionStorage.removeItem('wordocious-play-mode');
          setPlayModeState('daily');
        }
      } catch {}
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isPro]);

  const setPlayMode = (next: PlayMode) => {
    setPlayModeState(next);
    try {
      sessionStorage.setItem('wordocious-play-mode', JSON.stringify({ mode: next, day: getTodayLocal() }));
    } catch {}
  };

  useEffect(() => {
    cleanupOldPlayData();
    // Pre-warm the 5-letter lists once the page is idle, through the central loader.
    const warm = () => { import('@/lib/init-dictionary').then((m) => m.loadDictionary([5])).catch(() => {}); };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    // AU5: never during the cold-start intro.
    return afterIntro(() => { if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2000); });
  }, []);

  // The More Games sheet is gone (home redesign, 2026-10-01): its old links
  // (`/?more=1`) land on the PUZZLES section instead.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('more')) return;
    router.replace('/');
    requestAnimationFrame(() => document.getElementById('puzzles')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [router]);

  // Hydrate the play-limits localStorage cache from the DB so freshly-
  // cleared storage can't bypass the daily mode caps.
  useEffect(() => {
    setActivePlayUser(user?.id ?? null);
    if (user) {
      syncPlayLimits(user.id);
      // AU5: the pending-record drain waits for the intro to land.
      return afterIntro(() => {
        import('@/lib/stats-service')
          .then((m) => m.drainPendingRecords(user.id))
          .catch(() => {});
      });
    }
  }, [user]);

  // AU5: route prefetches wait for the intro to land.
  useEffect(() => afterIntro(() => {
    router.prefetch('/vs');
    router.prefetch('/practice/vs?daily=true');
  }), [router]);

  useEffect(() => {
    if (!user?.id) { setVsDailyWon(null); return; }
    let cancelled = false;
    fetchDailyVsResult(user.id).then((w) => { if (!cancelled) setVsDailyWon(w); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  // Row streaks refresh whenever today's completions change (a finished game
  // can extend a run). Dynamic imports keep stats-service off the critical path.
  const completionsKey = Array.from(todayDailies.keys()).sort().join(',');
  const puzzleKeys = puzzleCards.map((c) => c.dbKey as string).join(',');
  useEffect(() => {
    if (!user?.id) { setSweepStreaks({ sweep: 0, flawless: 0 }); setPuzzleStreaks({ sweep: 0, flawless: 0 }); return; }
    let cancelled = false;
    // AU5: after the cold-start intro has landed.
    const cancelWait = afterIntro(() => {
      import('@/lib/stats-service')
        .then((m) => m.fetchDailySweepStats(user.id))
        .then((st) => { if (!cancelled) setSweepStreaks({ sweep: st.currentSweepStreak, flawless: st.currentFlawlessStreak }); })
        .catch(() => {});
      import('@/lib/home-streaks')
        .then((m) => m.fetchPuzzleStreaks(user.id, puzzleKeys ? puzzleKeys.split(',') : []))
        .then((st) => { if (!cancelled) setPuzzleStreaks(st); })
        .catch(() => {});
    });
    return () => { cancelled = true; cancelWait(); };
  }, [user?.id, completionsKey, puzzleKeys]);

  useEffect(() => {
    if (!user?.id || playMode !== 'unlimited') return;
    let cancelled = false;
    import('@/lib/home-streaks')
      .then((m) => m.fetchUnlimitedCountsToday(user.id))
      .then((c) => { if (!cancelled) setUnlimitedCounts(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, playMode]);

  // Countdown for locked cards ("Play again in HH:MM:SS") — the shared global
  // timer, subscribed ONLY while a card shows it: the page no longer re-renders
  // every second for nothing (the banner's and the desktop Today card's clocks
  // are leaves, components/home/home-clock.tsx).
  const cardState = (card: HomeCard, resetText: string) => modeCardState({
    card,
    playMode,
    dailyResult: playMode === 'daily' && card.dbKey ? todayDailies.get(card.dbKey) : undefined,
    vsWon: null,
    playedToday: hasPlayedModeToday(card.id),
    isPro,
    signedIn: !!user,
    resetCountdownText: resetText,
    subtitleOverride: null,
  });
  const needsResetClock = [...visibleCards, ...puzzleCards].some((c) => { const st = cardState(c, ''); return st.isLocked && !st.isDailyDone; });
  const resetSecs = useCountdown(getResetSeconds, needsResetClock);
  const resetCountdownText = resetSecs !== null ? formatCountdown(resetSecs) : '';

  const handleVsClick = (vsHref: string) => {
    router.push(vsHref);
  };

  // Where a card (or its banner tile) goes: Unlimited opens a fresh seed; VS
  // in Unlimited opens the lobby.
  const hrefFor = (card: HomeCard) => (playMode === 'unlimited'
    ? (card.id === 'vs' ? '/vs' : card.href.split('?')[0])
    : card.href);
  const stateFor = (card: HomeCard) => cardState(card, resetCountdownText);
  const open = (card: HomeCard) => {
    const href = hrefFor(card);
    if (stateFor(card).isLocked) {
      router.prefetch(href);
      setLimitModal({ open: true, modeName: card.title, modeHref: href });
      return;
    }
    router.push(href);
  };

  const unlimitedPlayed = (cards: HomeCard[]) => cards.reduce((n, c) => n + (c.dbKey ? unlimitedCounts.get(c.dbKey) ?? 0 : 0), 0);
  const wordRow: BannerRow = { cards: wordCards, progress: progressOf(wordCards, todayDailies), streaks: sweepStreaks, unlimitedPlayed: unlimitedPlayed(wordCards) };
  const puzzleRow: BannerRow = { cards: puzzleCards, progress: progressOf(puzzleCards, todayDailies), streaks: puzzleStreaks, unlimitedPlayed: unlimitedPlayed(puzzleCards) };
  const name = profile?.username ?? '';
  // Desktop Today card: the next daily to play (Daily mode), else share.
  const nextCard = playMode === 'daily'
    ? [...wordCards, ...puzzleCards].find((c) => c.dbKey && !todayDailies.get(c.dbKey) && !stateFor(c).isLocked)
    : undefined;
  const shareToday = () => {
    const headline = bannerHeadline(wordRow.progress, puzzleRow.progress, { hour: new Date().getHours(), name });
    shareTodayProgress(todayDailies, headline);
  };

  // home-cards: 2 columns on phones; 3–4 on the desktop website (globals.css).
  const grid = (cards: HomeCard[]) => (
    <div className="home-cards grid grid-cols-2 gap-2">
      {cards.map((card) => {
        const state = stateFor(card);
        const href = hrefFor(card);
        return (
          <Link
            key={card.id}
            href={href}
            className="block"
            onClick={(e) => {
              if (state.isLocked) {
                e.preventDefault();
                router.prefetch(href);
                setLimitModal({ open: true, modeName: card.title, modeHref: href });
              }
            }}
          >
            <ModeCard card={card} state={state} unlimited={playMode === 'unlimited'} />
          </Link>
        );
      })}
    </div>
  );

  return (
    <PageBackground tint="home" className="fixed inset-0 flex flex-col">
      <AppHeader />

      {/* FINISH_SPEC AG (desktop web ≥ 900 px; nothing changes below): the
          scroller stays full width, its content centers at up to 1100 px; the
          banner keeps the 560 column; DAILIES | PUZZLES and WORD OF THE DAY |
          VS BATTLE sit side by side as two-column grids (globals.css .page-*).
          Desktop website (≥ 1024 px, lib/desktop-layout.ts): a dashboard up to
          1180 px — the hero (banner | the Today card), then DAILIES and PUZZLES
          each in 3–4 columns of the same cards, then WORD OF THE DAY | VS BATTLE. */}
      {/* AY: right after a Home-button tap, a tap on a card here is the same finger
          falling through — ignore it (HOME_TAP_GUARD_MS). */}
      <div
        className="px-4 page-wide-pad flex-1 min-h-0 overflow-y-auto pb-tab-clear"
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        onClickCapture={(e) => { if (homeCardTapBlocked()) { e.preventDefault(); e.stopPropagation(); } }}
      >
        {/* home-hero: display: contents on phones (no box, nothing moves); the desktop hero row. */}
        <div className="home-hero">
        <div className="page-col flex flex-col gap-2">
        <PendingInvitesBanner userId={user?.id} />
        <FirstGameCard />

        {/* The banner (home redesign, 2026-10-01): the headline, both rows of
            today's games, the share button and Pro's Daily/Unlimited switch. */}
        <HomeBanner
          word={wordRow}
          puzzles={puzzleRow}
          todayDailies={todayDailies}
          playMode={playMode}
          isPro={isPro}
          onModeChange={setPlayMode}
          name={name}
          onOpen={open}
          onShare={shareToday}
        />
        </div>
        {/* Desktop website only (hidden below 1024 px): today's progress beside the banner. */}
        <div className="dk-only">
          <HomeTodayCard
            word={wordRow.progress}
            puzzles={puzzleRow.progress}
            unlimited={playMode === 'unlimited'}
            wordPlayed={wordRow.unlimitedPlayed}
            puzzlesPlayed={puzzleRow.unlimitedPlayed}
            streak={profile?.daily_login_streak ?? 0}
            next={nextCard}
            onOpen={open}
            onShare={shareToday}
            canShare={wordRow.progress.played + puzzleRow.progress.played > 0}
          />
        </div>
        </div>

        {/* DAILIES and PUZZLES: the whole-cast title art (docs/ART_SPEC.md §2,
            §12, §19.2), one header style, ~78% width, centered. */}
        <div className="home-games page-grid-2 flex flex-col gap-2">
        <div className="flex flex-col gap-2">
        <HomeSectionTitle name="art-title-dailies" label="Dailies" />
        {grid(wordCards)}
        </div>

        <div className="flex flex-col gap-2">
        <HomeSectionTitle id="puzzles" name="art-title-puzzles" label="Puzzles" />
        {grid(puzzleCards)}
        </div>
        </div>

        <div className="page-grid-2 flex flex-col gap-2">
        {/* Word of the Day, now a quick quiz under its own section header
            (§12; see components/home/word-of-the-day.tsx). */}
        <div className="flex flex-col gap-2">
        <WordOfTheDay />
        </div>

        {/* VS BATTLE — its section title, then the VS card + LIVE strip as one full-width tile, last. */}
        {(() => {
          const vs = visibleCards.find((c) => c.id === 'vs');
          if (!vs) return null;
          // The tile always opens the VS lobby (VS overhaul, 2026-10-01): the
          // Daily Battle and Bot of the Day now live in its banner.
          const href = '/vs';
          return (
            <div className="flex flex-col gap-2">
            {/* FINISH_SPEC O1: VS BATTLE gets its own section title (lettering only, the N1 size rule). */}
            <HomeSectionTitle name="art-title-vsbattle" label="VS Battle" />
            <VSLiveTile
              card={vs}
              livePlayerCount={livePlayerCount}
              vsDailyWon={vsDailyWon}
              playMode={playMode}
              isPro={isPro}
              onOpen={() => handleVsClick(href)}
              onInvite={() => setInviteOpen(true)}
            />
            </div>
          );
        })()}
        </div>

        {/* Sign out — only with a real session; a guest has nothing to sign
            out of (the header shows "Sign In"). */}
        {user && (
          <div className="flex justify-center pt-1">
            <CandyButton size="sm" color="peach" onClick={() => signOut()} icon={<LogOut className="w-3.5 h-3.5" aria-hidden="true" />}>
              Sign out
            </CandyButton>
          </div>
        )}

        {/* Footer links for SEO */}
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2 pb-4">
          <Link href="/how-to-play" className="text-[10px] font-bold uppercase tracking-wide hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>How to Play</Link>
          <Link href="/guides" className="text-[10px] font-bold uppercase tracking-wide hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>Guides</Link>
          <Link href="/strategy" className="text-[10px] font-bold uppercase tracking-wide hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>Strategy</Link>
          <Link href="/words" className="text-[10px] font-bold uppercase tracking-wide hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>Words</Link>
          <Link href="/faq" className="text-[10px] font-bold uppercase tracking-wide hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>FAQ</Link>
          <Link href="/privacy" className="text-[10px] font-bold uppercase tracking-wide hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>Privacy</Link>
          <Link href="/terms" className="text-[10px] font-bold uppercase tracking-wide hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>Terms</Link>
        </div>
      </div>

      <BottomNav />
      <ModeLimitModal
        open={limitModal.open}
        onClose={() => setLimitModal({ open: false, modeName: '', modeHref: '' })}
        modeName={limitModal.modeName}
        unlimitedHref={limitModal.modeHref ? limitModal.modeHref.split('?')[0] : undefined}
        onViewPuzzle={() => router.push(limitModal.modeHref.includes('daily=true') ? limitModal.modeHref : `${limitModal.modeHref}?daily=true`)}
      />
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      {moreCeleb && !sweepCeleb && (
        <SweepCelebration variant="more" completions={moreCeleb} onClose={() => setMoreCeleb(null)} />
      )}
      {sweepCeleb && (
        <SweepCelebration completions={sweepCeleb} onClose={() => setSweepCeleb(null)} />
      )}
    </PageBackground>
  );
}
