'use client';

import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { MODE_CARDS, MORE_CARDS, type HomeCard } from '@/components/home/mode-chrome';
import { ModeCard, modeCardState } from '@/components/home/mode-card';
import { HomeBanner, type BannerRow } from '@/components/home/home-banner';
import { WordOfTheDay } from '@/components/home/word-of-the-day';
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
import { getSecondsUntilMidnightLocal, getTodayLocal, fetchDailyVsResult, type DailyCompletion } from '@/lib/daily-service';
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

/** HH:MM:SS from seconds; the banner's live countdown. */
function hms(secs: number | null): string {
  if (secs === null) return '--:--:--';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), x = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}

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
    if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2000);
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
      import('@/lib/stats-service')
        .then((m) => m.drainPendingRecords(user.id))
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    router.prefetch('/vs');
    router.prefetch('/practice/vs?daily=true');
  }, [router]);

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
    import('@/lib/stats-service')
      .then((m) => m.fetchDailySweepStats(user.id))
      .then((st) => { if (!cancelled) setSweepStreaks({ sweep: st.currentSweepStreak, flawless: st.currentFlawlessStreak }); })
      .catch(() => {});
    import('@/lib/home-streaks')
      .then((m) => m.fetchPuzzleStreaks(user.id, puzzleKeys ? puzzleKeys.split(',') : []))
      .then((st) => { if (!cancelled) setPuzzleStreaks(st); })
      .catch(() => {});
    return () => { cancelled = true; };
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

  // Countdown for locked cards and the banner's clock — the shared global timer.
  const resetSecs = useCountdown(getResetSeconds);
  const resetCountdownText = resetSecs !== null ? formatCountdown(resetSecs) : '';
  const clock = hms(useCountdown(getSecondsUntilMidnightLocal));

  const handleVsClick = (vsHref: string) => {
    router.push(vsHref);
  };

  // Where a card (or its banner tile) goes: Unlimited opens a fresh seed; VS
  // in Unlimited opens the lobby.
  const hrefFor = (card: HomeCard) => (playMode === 'unlimited'
    ? (card.id === 'vs' ? '/vs' : card.href.split('?')[0])
    : card.href);
  const stateFor = (card: HomeCard) => modeCardState({
    card,
    playMode,
    dailyResult: playMode === 'daily' && card.dbKey ? todayDailies.get(card.dbKey) : undefined,
    vsWon: null,
    playedToday: hasPlayedModeToday(card.id),
    isPro,
    signedIn: !!user,
    resetCountdownText,
    subtitleOverride: null,
  });
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

  const grid = (cards: HomeCard[]) => (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((card) => {
        const state = stateFor(card);
        const href = hrefFor(card);
        return (
          <Link
            key={card.id}
            href={href}
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

      <div className="px-4 flex-1 min-h-0 overflow-y-auto pb-24" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
          clock={clock}
          onOpen={open}
          onShare={() => {
            const headline = bannerHeadline(wordRow.progress, puzzleRow.progress, { hour: new Date().getHours(), name });
            shareTodayProgress(todayDailies, headline);
          }}
        />

        {/* WORDOCIOUS DAILIES and PUZZLES: the whole-cast title art
            (docs/ART_SPEC.md §2, §12), one header style, ~70% width, left aligned. */}
        <HomeSectionTitle name="art-title-dailies" label="Wordocious Dailies" />
        {grid(wordCards)}

        <HomeSectionTitle id="puzzles" name="art-title-puzzles" label="Puzzles" />
        {grid(puzzleCards)}

        {/* Word of the Day, now a quick quiz under its own section header
            (§12; see components/home/word-of-the-day.tsx). */}
        <WordOfTheDay />

        {/* VS Battle — the VS card and the LIVE strip as one full-width tile, last. */}
        {(() => {
          const vs = visibleCards.find((c) => c.id === 'vs');
          if (!vs) return null;
          // The tile always opens the VS lobby (VS overhaul, 2026-10-01): the
          // Daily Battle and Bot of the Day now live in its banner.
          const href = '/vs';
          return (
            <VSLiveTile
              card={vs}
              livePlayerCount={livePlayerCount}
              vsDailyWon={vsDailyWon}
              playMode={playMode}
              isPro={isPro}
              onOpen={() => handleVsClick(href)}
              onInvite={() => setInviteOpen(true)}
            />
          );
        })()}

        {/* Sign out — only with a real session; a guest has nothing to sign
            out of (the header shows "Sign In"). */}
        {user && (
          <button
            onClick={() => signOut()}
            className="w-full py-1 text-center text-[10px] font-bold hover:opacity-70 active:opacity-50 transition-all"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <LogOut className="w-3 h-3 inline mr-1" />
            Sign Out
          </button>
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
