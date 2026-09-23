'use client';

import { useState, useEffect } from 'react';
import { LogOut, Star, BookOpen, Trophy, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { MODE_CARDS } from '@/components/home/mode-chrome';
import { ModeCard, modeCardState } from '@/components/home/mode-card';
import { MoreGamesSheet, useMoreSheetUrl } from '@/components/home/more-games-sheet';
import { morePlayedCount, morePlayedText } from '@/lib/more-games';
import { useFlags } from '@/hooks/use-flags';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModeLimitModal } from '@/components/modals/mode-limit-modal';
import { InviteModal } from '@/components/invites/invite-modal';
import { PendingInvitesBanner } from '@/components/invites/pending-invites-banner';
import { FirstGameCard } from '@/components/ui/first-game-card';
import { PlayModeToggle, UnlimitedHero, type PlayMode } from '@/components/ui/play-mode-toggle';
import { useLivePlayerCount } from '@/hooks/use-live-player-count';
import { useCountdown } from '@/hooks/use-countdown';
import { getSecondsUntilMidnightLocal, computeDailyTotals, getTodayLocal, fetchDailyVsResult, type DailyCompletion } from '@/lib/daily-service';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { SweepCelebration } from '@/components/effects/sweep-celebration';
import { cachedFlawlessStreak } from '@/lib/stats-service';
import { shareDailySweep } from '@/lib/daily-share';
import { SWEEP_MODES, MORE_GAME_MODES } from '@/lib/modes.generated';

// The Daily Sweep set, from the catalog (More Games Stage 4). Every count on
// this page is taken over these keys only, so a More Games result on the
// completions map can never move N/8, the celebration or the hero.
const SWEEP_KEYS = new Set<string>(SWEEP_MODES.map((m) => m.dbKey as string));
const sweepEntries = <T,>(m: Map<string, T>): Array<[string, T]> => Array.from(m.entries()).filter(([k]) => SWEEP_KEYS.has(k));
import { SOLUTIONS_CUTOVER_DATE, SOLUTION_SWAP_CUTOVER_DATE, SOLUTION_SWAP_2_CUTOVER_DATE, SOLUTION_SWAPS, SOLUTION_SWAPS_2 } from '@wordle-duel/core';

/** Offline Word-of-the-Day fallback: same index math as lib/word-of-day.ts,
 *  including the §265 answer swaps from their cutover date on. */
function offlineWotd(list: string[], dayIndex: number, dayKey: string): string {
  let w = list[dayIndex % list.length];
  if (dayKey >= SOLUTION_SWAP_CUTOVER_DATE) w = SOLUTION_SWAPS[w.toUpperCase()] ?? w;
  if (dayKey >= SOLUTION_SWAP_2_CUTOVER_DATE) w = SOLUTION_SWAPS_2[w.toUpperCase()] ?? w;
  return w;
}
import { hasPlayedModeToday, cleanupOldPlayData, getSecondsUntilMidnightLocal as getResetSeconds, formatCountdown, syncPlayLimits, setActivePlayUser } from '@/lib/play-limit-service';

interface WordDefinition {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
}

function WordOfTheDay() {
  const [info, setInfo] = useState<WordDefinition | null>(null);

  useEffect(() => {
    const now = new Date();
    // Day index of the LOCAL calendar date (not Date.now()/86400000, which
    // rolls at UTC midnight — 7 PM Central — and made the home card show
    // tomorrow's word while the archive still said today's). Date.UTC on the
    // local Y/M/D gives the same index the /word/[date] archive derives for
    // this date, so the card and the archive always agree, all local day.
    const daysSinceEpoch = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    // Answer pool for THIS displayed date — pre-cutover dates keep the legacy
    // word (matches the /word/[date] archive); curated after. YYYY-MM-DD of the
    // local displayed date vs the cutover.
    const displayedKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const useLegacy = displayedKey < SOLUTIONS_CUTOVER_DATE;

    // Day-keyed cache: the word only changes at midnight, so one good answer
    // serves every home visit that day. Only a result WITH a definition is
    // cached — a miss is now a single cheap request, worth retrying next visit.
    const cacheKey = `wordocious-wotd-${daysSinceEpoch}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const v = JSON.parse(cached) as WordDefinition;
        if (v?.word && v.definition) { setInfo(v); return; }
      }
    } catch {}

    // §255 (founder: "the main screen didn't populate the word of the day or
    // definition, it was blank"): this card used to walk up to TWENTY serial
    // requests to dictionaryapi.dev from the browser — the one surface §250
    // missed — so an API outage left it on its skeleton. One request to our
    // own /api/wotd now answers from the committed local dataset, instantly.
    let cancelled = false;
    fetch(`/api/wotd?date=${displayedKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (v: WordDefinition | null) => {
        if (cancelled) return;
        if (v?.word) {
          setInfo(v);
          if (v.definition) { try { localStorage.setItem(cacheKey, JSON.stringify(v)); } catch {} }
          return;
        }
        // Route unreachable: still show the day's word, computed locally, so
        // the card is never blank. (Lazy import — shared chunk with the games.)
        const solutions = useLegacy
          ? (await import('@/data/solutions-legacy.json')).default
          : (await import('@/data/solutions.json')).default;
        if (!cancelled) setInfo({ word: offlineWotd(solutions, daysSinceEpoch, displayedKey) });
      })
      .catch(async () => {
        if (cancelled) return;
        const solutions = useLegacy
          ? (await import('@/data/solutions-legacy.json')).default
          : (await import('@/data/solutions.json')).default;
        if (!cancelled) setInfo({ word: offlineWotd(solutions, daysSinceEpoch, displayedKey) });
      });
    return () => { cancelled = true; };
  }, []);

  if (!info) return (
    <div
      className="px-3 py-2 animate-pulse"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-3 h-3 rounded" style={{ background: 'var(--color-border)' }} />
        <div className="h-2.5 w-24 rounded" style={{ background: 'var(--color-border)' }} />
      </div>
      <div className="h-4 w-32 rounded mb-1" style={{ background: 'var(--color-border)' }} />
      <div className="h-3 w-48 rounded" style={{ background: 'var(--color-border)' }} />
    </div>
  );

  const { word: dailyWord } = info;

  return (
    <div
      className="px-3 py-2"
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: '14px',
      }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Word of the Day
          </span>
        </div>
        <Link href="/words" className="text-[10px] font-bold hover:underline" style={{ color: '#c4b5fd' }}>
          Past words →
        </Link>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-base font-black" style={{ color: 'var(--color-text)' }}>
          {dailyWord.charAt(0) + dailyWord.slice(1).toLowerCase()}
        </span>
        {info.phonetic && (
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {info.phonetic}
          </span>
        )}
        {info.partOfSpeech && (
          <span className="text-[10px] font-extrabold italic" style={{ color: '#7c3aed' }}>
            {info.partOfSpeech}
          </span>
        )}
      </div>

      {info.definition && (
        <p className="mt-1 text-[11px] font-bold leading-snug" style={{ color: '#4b5563' }}>
          {info.definition}
        </p>
      )}
    </div>
  );
}

function DailyCountdown() {
  const secs = useCountdown(getSecondsUntilMidnightLocal);
  if (secs === null) {
    return <span style={{ color: 'var(--color-text-muted)' }} className="text-xs font-bold">Resets in --:--:--</span>;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <span style={{ color: 'var(--color-text-muted)' }} className="text-xs font-bold">
      Resets in {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
    </span>
  );
}

/**
 * Bare HH:MM:SS countdown with no label or built-in styling. Used by
 * the merged Daily Sweep hero where the surrounding copy reads
 * "Next puzzles in <timer>" and the styling is owned by the parent.
 */
function DailyCountdownText() {
  const secs = useCountdown(getSecondsUntilMidnightLocal);
  if (secs === null) return <span>--:--:--</span>;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <span>
      {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
    </span>
  );
}

// Mode cards (chrome + catalog) and the card itself live in components/home
// (More Games Stage 5) so the home grid and the More Games sheet share them.


export default function HomePage() {
  const { user, signOut, isProActive } = useAuth();
  const [limitModal, setLimitModal] = useState<{ open: boolean; modeName: string; modeHref: string }>({ open: false, modeName: '', modeHref: '' });
  // resetCountdown is derived from useCountdown hook below (no useState needed)
  const [inviteOpen, setInviteOpen] = useState(false);
  const livePlayerCount = useLivePlayerCount();
  const [playMode, setPlayModeState] = useState<PlayMode>('daily');
  const { todayDailies, dailiesDay } = useDailyCompletions();
  // The celebration renders from a SNAPSHOT captured at fire time, so a
  // concurrent refresh (e.g. the new day's empty map) can never blank the
  // stats mid-celebration (the iOS widget-launch "0/N WON · 0:00" bug).
  const [sweepCeleb, setSweepCeleb] = useState<Map<string, DailyCompletion> | null>(null);
  // Today's daily VS outcome (server-backed, iOS vsDailyWon parity) — the VS
  // Battle card greys with a W/L badge like every other completed daily.
  // null = not played today. Home remounts on every return from a game, so a
  // just-finished daily VS refetches naturally.
  const [vsDailyWon, setVsDailyWon] = useState<boolean | null>(null);
  const router = useRouter();
  // More Games sheet (Stage 5) — open state lives in the URL (/?more=1).
  const { open: moreOpen, openSheet: openMoreSheet, closeSheet: closeMoreSheet } = useMoreSheetUrl();
  // Remote flags (Stage 7): the More tile and every More Games title are
  // shown only when their app_flags row says so for this viewer.
  const { isOn: flagOn } = useFlags();
  const visibleCards = MODE_CARDS.filter((c) => flagOn(c.flagKey));
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

  // Restore the toggle on mount for Pro users — but only within the SAME
  // browser session and local day (founder-approved UX: reopening the app
  // always lands on Daily; the founder's sister reopened after a night of
  // Unlimited, tapped Classic, and her result never hit the daily
  // leaderboard). sessionStorage keeps the choice across in-session
  // navigations (home → game → home remounts this page) but not across a
  // fresh browser session; the day stamp resets a session that crosses local
  // midnight. Freemium users never see the toggle and are forced to 'daily'.
  useEffect(() => {
    if (!isPro) { setPlayModeState('daily'); return; }
    try {
      // One-time cleanup of the old cross-session preference key.
      localStorage.removeItem('wordocious-play-mode');
      const saved = sessionStorage.getItem('wordocious-play-mode');
      if (!saved) return;
      const { mode, day } = JSON.parse(saved) as { mode?: string; day?: string };
      if (mode === 'unlimited' && day === getTodayLocal()) setPlayModeState('unlimited');
    } catch {}
  }, [isPro]);

  // Day rollover while the tab stayed open: returning to a home page left
  // open overnight snaps the toggle back to Daily (same rule as a fresh
  // open). Same-day returns change nothing.
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

  // Lazy-load word lists to keep them out of the home page's critical JS bundle.
  // Game pages import them synchronously (they need them immediately), but the
  // home page only uses them for pre-warming and Word of the Day — both can wait.
  useEffect(() => {
    cleanupOldPlayData();
    // Pre-warm via the central loader — it loads ALL lists (5/6/7 + the
    // legacy answer banks the date-gate needs). A hand-rolled 2-arg init here
    // once wiped the legacy list and crashed every pre-cutover daily.
    import('@/lib/init-dictionary')
      .then((m) => m.ensureDictionaryInitialized())
      .catch(() => {});
  }, []);

  // Hydrate the play-limits localStorage cache from the DB so freshly-
  // cleared storage can't bypass the daily mode caps. Fires whenever the
  // signed-in user changes.
  useEffect(() => {
    // Scope the play-limit cache to the signed-in user (or anon on sign-out)
    // so a prior account's daily completions can't leak into this one.
    setActivePlayUser(user?.id ?? null);
    if (user) {
      syncPlayLimits(user.id);
      // Re-fire any game results whose record calls were cut off by a tab
      // close right after the final guess. Dynamic import keeps
      // stats-service out of the home page's critical JS bundle.
      import('@/lib/stats-service')
        .then((m) => m.drainPendingRecords(user.id))
        .catch(() => {});
    }
  }, [user]);

  // Daily completions are now served from the DailyCompletionsProvider
  // context (persists across navigations — no flash on return).

  // Prefetch VS routes so the initial tap is instant (mode cards already
  // prefetch via <Link>, but the VS button uses router.push).
  useEffect(() => {
    router.prefetch('/vs');                       // VS lobby (both toggles)
    router.prefetch('/practice/vs?daily=true');   // free daily VS CTA
  }, [router]);

  useEffect(() => {
    if (!user?.id) { setVsDailyWon(null); return; }
    let cancelled = false;
    fetchDailyVsResult(user.id).then((w) => { if (!cancelled) setVsDailyWon(w); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  // Countdown for locked cards — uses shared global timer via useCountdown
  const resetSecs = useCountdown(getResetSeconds);
  const resetCountdownText = resetSecs !== null ? formatCountdown(resetSecs) : '';

  const handleVsClick = (vsHref: string) => {
    // Everyone (incl. Pro) follows the href the card passed: the daily tile →
    // shared daily VS (?daily=true); the unlimited-mode tile → /practice/vs.
    // Pro now plays the same shared daily VS as freemium, with an "Unlimited
    // VS" escape offered on the already-played screen.
    router.push(vsHref);
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader />

      <div className="px-4 flex-1 min-h-0 overflow-y-auto pb-24" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <PendingInvitesBanner userId={user?.id} />
        <FirstGameCard />

        {/* Pro-only: switch between Daily and Unlimited. Freemium users
            never see the pill (playMode is forced to 'daily' above). */}
        {isPro && <PlayModeToggle value={playMode} onChange={setPlayMode} />}

        {/* §255 (founder: toggling Daily/Unlimited "shouldn't shift any of the
            games around — the Daily Sweep window is what's causing that"):
            the three hero variants differed by a few px of font metrics and
            the swept card ran a line taller, so the mode grid below jumped on
            every toggle. Same cure as native §248 — the slot is ONE fixed
            height and every variant fills it, content centred.
            Measured live after the first cut: the h-[88px] rule applied yet the
            box came out 82.5px / 68px — this is a flex item in a column whose
            parent overflows, so the browser SHRANK it to its content. shrink-0
            is what actually pins it; the inline height is belt-and-braces. */}
        <div className="flex flex-col shrink-0" style={{ height: 88 }}>
        {playMode === 'unlimited' ? (
          <UnlimitedHero />
        ) : (() => {
          const sweepToday = sweepEntries(todayDailies);
          const completed = sweepToday.length;
          const wins = sweepToday.filter(([, r]) => r.won).length;
          const total = SWEEP_MODES.length;
          const allDone = completed >= total;
          const flawless = allDone && wins === total;

          // Sweep / Flawless variants absorb the countdown under the
          // celebratory header, so the user sees one "today's status"
          // surface instead of two stacked cards. Tap still routes to
          // /daily (the leaderboards page) like the plain button does.
          if (allDone) {
            const totals = computeDailyTotals(todayDailies);
            const totalTime = `${Math.floor(totals.totalTimeSeconds / 60)}:${String(totals.totalTimeSeconds % 60).padStart(2, '0')}`;
            const bg = flawless
              ? 'linear-gradient(135deg, #fef3c7, #fde68a)'
              : 'linear-gradient(135deg, #f5f3ff, #fce7f3)';
            const border = flawless ? '1.5px solid #f59e0b' : '1.5px solid #c4b5fd';
            const titleText = flawless ? 'FLAWLESS VICTORY!' : 'DAILY SWEEP!';
            const titleGradient = flawless
              ? 'linear-gradient(135deg, #d97706, #b45309)'
              : 'linear-gradient(135deg, #a78bfa, #ec4899)';
            // §248 (founder: the main page must "clearly show that I am on a
            // 4 day win streak" — same footprint, the toggle depends on it):
            // a live streak replaces the redundant "All 9 won" (the FLAWLESS
            // headline already says it) — text swap only, no size change.
            // Trust the cache only when stamped TODAY (a flawless banner
            // means today is in the streak, so a fresh stamp exists — the
            // §244 award hook wrote it at the 9th win).
            const homeFlawlessStreak = (() => {
              if (!flawless) return 0;
              const c = cachedFlawlessStreak();
              return c && c.day === getTodayLocal() ? c.streak : 0;
            })();
            const subtitle = flawless
              ? homeFlawlessStreak >= 2
                ? `🏆 ${homeFlawlessStreak}-day streak · ${totalTime} · ${totals.totalScore.toLocaleString()} pts`
                : `All ${total} won · ${totalTime} · ${totals.totalScore.toLocaleString()} pts`
              : `All ${total} done · ${totalTime} · ${totals.totalScore.toLocaleString()} pts`;
            const subtitleColor = flawless ? '#b45309' : '#6d28d9';
            const iconColor = flawless ? '#b45309' : '#7c3aed';

            // Tap shares the all-dailies card (was: route to /daily).
            return (
              <button
                onClick={() => { shareDailySweep(todayDailies); }}
                className="w-full h-full shrink-0 btn-3d flex flex-col items-center justify-center py-2.5 font-black relative overflow-hidden transition-transform active:scale-[0.98]"
                style={{ background: bg, border, borderRadius: '14px' }}
              >
                {/* Subtle foil shimmer sweep */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="animate-foil-sweep absolute top-0 h-full"
                    style={{ width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }}
                  />
                </div>
                <div className="relative flex items-center gap-2">
                  {flawless ? (
                    <>
                      <Trophy className="w-5 h-5" style={{ color: iconColor }} fill="currentColor" />
                      <span className="text-lg font-black text-transparent bg-clip-text" style={{ backgroundImage: titleGradient }}>
                        {titleText}
                      </span>
                      <Trophy className="w-5 h-5" style={{ color: iconColor }} fill="currentColor" />
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />
                      <span className="text-base font-black text-transparent bg-clip-text" style={{ backgroundImage: titleGradient }}>
                        {titleText}
                      </span>
                      <Sparkles className="w-4 h-4" style={{ color: '#ec4899' }} />
                    </>
                  )}
                </div>
                <div className="relative text-[11px] font-extrabold mt-0.5" style={{ color: subtitleColor }}>
                  {subtitle}
                </div>
                <div className="relative text-[10px] font-bold mt-0.5" style={{ color: subtitleColor, opacity: 0.75 }}>
                  Tap to share · Next in <DailyCountdownText />
                </div>
              </button>
            );
          }

          // Daily hero. Sized to match UnlimitedHero exactly (same py,
          // three lines of copy) so tapping the Pro Daily/Unlimited pill
          // doesn't shift the game-cards grid below. Palette stays in the
          // same purple family as Unlimited for a coherent aesthetic, but
          // leans cool (violet→indigo) so the two modes are still visually
          // distinct — Unlimited runs warm (pink→violet).
          return (
            <Link href="/daily" className="block h-full">
              <button
                className="w-full h-full btn-3d flex flex-col items-center justify-center py-2.5 font-black relative"
                style={{
                  background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                  border: '1.5px solid #a78bfa',
                  borderRadius: '14px',
                }}
              >
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5" style={{ color: '#7c3aed' }} fill="currentColor" />
                  <span
                    className="text-lg font-black text-transparent bg-clip-text"
                    style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    Daily Challenge
                  </span>
                  <Star className="w-5 h-5" style={{ color: '#4f46e5' }} fill="currentColor" />
                </div>
                <div className="text-[10px] font-bold mt-0.5" style={{ color: '#6d28d9' }}>
                  {SWEEP_MODES.length} puzzles · Leaderboards &amp; medals
                </div>
                <div className="text-[10px] font-bold mt-0.5" style={{ color: '#6d28d9' }}>
                  Resets in <DailyCountdownText />
                </div>
              </button>
            </Link>
          );
        })()}
        </div>

        {/* Word of the Day */}
        <WordOfTheDay />

        {/* Game Mode Cards - 2 column grid */}
        <div className="section-header mt-1 mb-0.5">GAME MODES</div>
        <div className="grid grid-cols-2 gap-2">
          {visibleCards.map((mode) => {
            // Today's daily result for this mode, if played (Daily mode only).
            // Keyed by the DB game_mode string (DUEL/QUORDLE/…). The VS Battle
            // card has no daily row; the More Games tile has no puzzle at all.
            const isMore = mode.id === 'more';
            const dailyResult = playMode === 'daily' && mode.dbKey ? todayDailies.get(mode.dbKey) : undefined;
            // The More Games tile: "N of M played" over the More Games dailies in
            // Daily mode, its description in Unlimited. Never locks, never tints.
            const morePlayed = morePlayedCount(todayDailies.keys(), visibleMore);
            const state = modeCardState({
              card: mode,
              playMode,
              dailyResult,
              // VS has no solo daily_results row — its W/L comes from the
              // play_type='vs' row (vsDailyWon).
              vsWon: mode.id === 'vs' ? vsDailyWon : null,
              playedToday: hasPlayedModeToday(mode.id),
              isPro,
              signedIn: !!user,
              resetCountdownText,
              subtitleOverride: isMore
                ? (playMode === 'daily' ? morePlayedText(morePlayed.played, morePlayed.total) : mode.desc)
                : null,
            });

            // In Unlimited mode (Pro-only), route to the non-daily
            // variant so each tap lands on a fresh random seed. VS: the
            // DAILY toggle goes straight into the shared daily VS puzzle
            // (same seed for every player); the UNLIMITED toggle opens the
            // mode-selection lobby (/vs, native VSLobbyView parity).
            const effectiveHref = playMode === 'unlimited'
              ? (mode.id === 'vs' ? '/vs' : mode.href.split('?')[0])
              : mode.href;

            const handleCardClick = (e: React.MouseEvent) => {
              if (isMore) {
                e.preventDefault();
                openMoreSheet();
              } else if (state.isLocked) {
                e.preventDefault();
                router.prefetch(effectiveHref);
                setLimitModal({ open: true, modeName: mode.title, modeHref: effectiveHref });
              } else if (mode.id === 'vs') {
                e.preventDefault();
                handleVsClick(effectiveHref);
              }
            };

            return (
              <Link key={mode.id} href={effectiveHref} onClick={handleCardClick}>
                <ModeCard card={mode} state={state} />
              </Link>
            );
          })}
        </div>

        {/* LIVE banner — shows the real-time connected-player count
            from the matchmaking server's /presence endpoint. VS button
            lives on the mode cards now; Invite is Pro-only so freemium
            sees just the count. */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '14px',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-black text-xs" style={{ color: 'var(--color-text)' }}>LIVE</span>
            </div>
            <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              {livePlayerCount === null
                ? 'Players online'
                : `${livePlayerCount.toLocaleString()} ${livePlayerCount === 1 ? 'player' : 'players'} online`}
            </div>
          </div>
          {isPro && (
            <button
              onClick={() => setInviteOpen(true)}
              className="btn-3d px-3 py-1.5 text-white font-black text-[10px] rounded-md transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #db2777)',
                boxShadow: '0 2px 0 #9f1239',
              }}
            >
              Invite
            </button>
          )}
        </div>

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
      <MoreGamesSheet
        open={moreOpen}
        onClose={closeMoreSheet}
        modes={visibleMore}
        playMode={playMode}
        todayDailies={todayDailies}
        isPro={isPro}
        signedIn={!!user}
        resetCountdownText={resetCountdownText}
        onLocked={(card, href) => {
          router.prefetch(href);
          setLimitModal({ open: true, modeName: card.title, modeHref: href });
        }}
      />
      {sweepCeleb && (
        <SweepCelebration completions={sweepCeleb} onClose={() => setSweepCeleb(null)} />
      )}
    </div>
  );
}
