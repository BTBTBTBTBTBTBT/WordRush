'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Swords, Skull, LogOut, Star, BookOpen, Shield, Crown, Lock, Trophy, Sparkles } from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import Link from 'next/link';
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
import { getSecondsUntilMidnightLocal, computeDailyTotals, getTodayLocal, type DailyCompletion } from '@/lib/daily-service';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { SweepCelebration } from '@/components/effects/sweep-celebration';
import { shareDailySweep } from '@/lib/daily-share';
import { MODES } from '@/lib/modes.generated';
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
    const daysSinceEpoch = Math.floor(now.getTime() / 86400000);

    // H1: the word only changes at midnight, but this used to re-run the
    // definition scan (up to 20 serial external API calls) on EVERY home
    // visit. Cache the day's result — including the no-definition fallback,
    // so a flaky API day doesn't retrigger the scan per visit.
    const cacheKey = `wordocious-wotd-${daysSinceEpoch}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setInfo(JSON.parse(cached)); return; }
    } catch {}
    const saveAndSet = (v: WordDefinition) => {
      setInfo(v);
      try { localStorage.setItem(cacheKey, JSON.stringify(v)); } catch {}
    };

    async function findWordWithDefinition() {
      // Lazy-load solutions list (shared chunk with game pages)
      const solutions = (await import('@/data/solutions.json')).default;
      // Try up to 20 words starting from today's index until we find one with a definition
      for (let offset = 0; offset < 20; offset++) {
        const word = solutions[(daysSinceEpoch + offset) % solutions.length];
        try {
          const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data[0]) {
              const entry = data[0];
              const phonetic = entry.phonetics?.find((p: any) => p.text)?.text || entry.phonetic || '';
              const meaning = entry.meanings?.[0];
              const partOfSpeech = meaning?.partOfSpeech || '';
              const definition = meaning?.definitions?.[0]?.definition || '';
              if (definition) {
                saveAndSet({ word, phonetic, partOfSpeech, definition });
                return;
              }
            }
          }
        } catch {}
      }
      // Fallback: show the original daily word without definition
      const fallback = solutions[daysSinceEpoch % solutions.length];
      saveAndSet({ word: fallback });
    }

    findWordWithDefinition();
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

// Home-screen mode-card id → daily_results.game_mode key. The VS card
// isn't a daily mode (no row in daily_results), so it's absent.
// Single-sourced from the mode catalog (modes.json → modes.generated).
const MODE_ID_TO_DB: Record<string, string> = Object.fromEntries(
  MODES.filter((m) => m.dbKey).map((m) => [m.id, m.dbKey as string]),
);

function formatShortTime(seconds: number): string {
  if (seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// Per-mode icon + route chrome (web-native; not centralizable). Title/desc/
// accent/romanNumeral come from the single-source catalog (modes.generated).
const MODE_CHROME: Record<string, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null; href: string; vsHref: string }> = {
  practice: { icon: WordleGridIcon, href: '/practice?daily=true', vsHref: '/practice/vs' },
  vs: { icon: Swords, href: '/practice/vs?daily=true', vsHref: '/practice/vs?daily=true' },
  quordle: { icon: null, href: '/quordle?daily=true', vsHref: '/quordle/vs' },
  octordle: { icon: null, href: '/octordle?daily=true', vsHref: '/octordle/vs' },
  sequence: { icon: TrendingUp, href: '/sequence?daily=true', vsHref: '/sequence/vs' },
  rescue: { icon: Shield, href: '/rescue?daily=true', vsHref: '/rescue/vs' },
  six: { icon: SixIcon, href: '/six?daily=true', vsHref: '/six/vs' },
  seven: { icon: SevenIcon, href: '/seven?daily=true', vsHref: '/seven/vs' },
  gauntlet: { icon: Skull, href: '/gauntlet?daily=true', vsHref: '/gauntlet/vs' },
  propernoundle: { icon: Crown, href: '/propernoundle?daily=true', vsHref: '/propernoundle/vs' },
};

const MODE_CARDS = MODES.map((m) => ({
  id: m.id,
  title: m.title,
  icon: MODE_CHROME[m.id]?.icon ?? null,
  romanNumeral: m.romanNumeral ?? undefined,
  desc: m.desc,
  accentColor: m.accentHex,
  href: MODE_CHROME[m.id]?.href ?? '/',
  vsHref: MODE_CHROME[m.id]?.vsHref ?? '/',
}));


export default function HomePage() {
  const { user, signOut, isProActive } = useAuth();
  const [limitModal, setLimitModal] = useState<{ open: boolean; modeName: string; modeHref: string }>({ open: false, modeName: '', modeHref: '' });
  // resetCountdown is derived from useCountdown hook below (no useState needed)
  const [inviteOpen, setInviteOpen] = useState(false);
  const livePlayerCount = useLivePlayerCount();
  const [playMode, setPlayModeState] = useState<PlayMode>('daily');
  const { todayDailies } = useDailyCompletions();
  const [sweepCeleb, setSweepCeleb] = useState(false);
  const router = useRouter();

  const isPro = isProActive;

  // One-time-per-day celebration modal when all 9 dailies are complete. Keyed
  // on the local day; re-fires if the player upgrades a Sweep → Flawless.
  useEffect(() => {
    if (!user) return;
    const completed = todayDailies.size;
    if (completed < 9) return;
    const wins = Array.from(todayDailies.values()).filter((r) => r.won).length;
    const tier = wins >= 9 ? 'flawless' : 'sweep';
    const key = `wordocious-sweep-celebrated-${getTodayLocal()}`;
    try {
      const seen = localStorage.getItem(key);
      if (seen === 'flawless' || seen === tier) return;
      localStorage.setItem(key, tier);
      setSweepCeleb(true);
    } catch {}
  }, [user, todayDailies]);

  // Restore the toggle preference on mount for Pro users. Freemium users
  // never see the toggle and are forced back to 'daily' so the mode
  // cards keep their existing daily-limit behavior.
  useEffect(() => {
    if (!isPro) { setPlayModeState('daily'); return; }
    try {
      const saved = localStorage.getItem('wordocious-play-mode');
      if (saved === 'unlimited') setPlayModeState('unlimited');
    } catch {}
  }, [isPro]);

  const setPlayMode = (next: PlayMode) => {
    setPlayModeState(next);
    try { localStorage.setItem('wordocious-play-mode', next); } catch {}
  };

  // Lazy-load word lists to keep them out of the home page's critical JS bundle.
  // Game pages import them synchronously (they need them immediately), but the
  // home page only uses them for pre-warming and Word of the Day — both can wait.
  useEffect(() => {
    cleanupOldPlayData();
    Promise.all([
      import('@/data/allowed.json').then(m => m.default),
      import('@/data/solutions.json').then(m => m.default),
      import('@wordle-duel/core'),
    ]).then(([allowed, solutions, core]) => {
      core.initDictionary(allowed, solutions);
      // G5: also pre-warm the Six/Seven lists (200-300KB chunks) so a first
      // open of those modes doesn't pay the download. After the 5-letter
      // warm so it never competes with the primary path.
      Promise.all([
        import('@/data/allowed-6.json').then(m => m.default),
        import('@/data/solutions-6.json').then(m => m.default),
        import('@/data/allowed-7.json').then(m => m.default),
        import('@/data/solutions-7.json').then(m => m.default),
      ]).then(([a6, s6, a7, s7]) => {
        core.initDictionaryForLength(6, a6, s6);
        core.initDictionaryForLength(7, a7, s7);
      }).catch(() => {});
    });
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
    router.prefetch('/practice/vs');
    router.prefetch('/practice/vs?daily=true');
  }, [router]);

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

        {playMode === 'unlimited' ? (
          <UnlimitedHero />
        ) : (() => {
          const completed = todayDailies.size;
          const wins = Array.from(todayDailies.values()).filter((r) => r.won).length;
          const total = 9;
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
            const titleText = flawless ? 'Flawless Victory!' : 'Daily Sweep!';
            const titleGradient = flawless
              ? 'linear-gradient(135deg, #d97706, #b45309)'
              : 'linear-gradient(135deg, #a78bfa, #ec4899)';
            const subtitle = flawless
              ? `All ${total} won · ${totalTime} · ${totals.totalScore.toLocaleString()} pts`
              : `All ${total} done · ${totalTime} · ${totals.totalScore.toLocaleString()} pts`;
            const subtitleColor = flawless ? '#b45309' : '#6d28d9';
            const iconColor = flawless ? '#b45309' : '#7c3aed';

            // Tap shares the all-dailies card (was: route to /daily).
            return (
              <button
                onClick={() => { shareDailySweep(todayDailies); }}
                className="w-full shrink-0 btn-3d flex flex-col items-center py-2.5 font-black relative overflow-hidden transition-transform active:scale-[0.98]"
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
            <Link href="/daily">
              <button
                className="w-full btn-3d flex flex-col items-center py-2.5 font-black relative"
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
                  9 puzzles · Leaderboards &amp; medals
                </div>
                <div className="text-[10px] font-bold mt-0.5" style={{ color: '#6d28d9' }}>
                  Resets in <DailyCountdownText />
                </div>
              </button>
            </Link>
          );
        })()}

        {/* Word of the Day */}
        <WordOfTheDay />

        {/* Game Mode Cards - 2 column grid */}
        <div className="section-header mt-1 mb-0.5">GAME MODES</div>
        <div className="grid grid-cols-2 gap-2">
          {MODE_CARDS.map((mode) => {
            const Icon = mode.icon;
            // Today's daily result for this mode, if played. Keyed by the
            // DB game_mode string (DUEL/QUORDLE/…), so we look up via
            // mode.id → db key. The VS Battle card has no daily row.
            const dbKey = MODE_ID_TO_DB[mode.id];
            const dailyResult = playMode === 'daily' && dbKey ? todayDailies.get(dbKey) : undefined;
            // VS has no daily_results row; reflect its completed state from the
            // play-limit cache so the card shows "played" like other modes.
            const isDailyDone = !!dailyResult || (mode.id === 'vs' && playMode === 'daily' && hasPlayedModeToday('vs'));

            // Freemium users: lock card once the daily is done OR the
            // play-limit cache says played. isDailyDone covers modes
            // whose play-limit modeId was recorded under the wrong key.
            const isLocked = !isPro && user && (isDailyDone || hasPlayedModeToday(mode.id));

            // In Unlimited mode (Pro-only), route to the non-daily
            // variant so each tap lands on a fresh random seed.
            const effectiveHref = playMode === 'unlimited'
              ? (mode.id === 'vs' ? '/practice/vs' : mode.href.split('?')[0])
              : mode.href;

            const handleCardClick = (e: React.MouseEvent) => {
              if (isLocked) {
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
                <div
                  className={`relative px-3 py-3 cursor-pointer transition-transform active:scale-[0.96] overflow-hidden ${isLocked ? 'opacity-60' : ''}`}
                  style={{
                    // Completed daily: soft tint in the mode's accent
                    // color to signal "you've played this one". Fresh/
                    // unplayed cards stay white.
                    background: isDailyDone ? `${mode.accentColor}0f` : 'var(--color-surface)',
                    border: `1.5px solid ${isLocked ? '#d1d5db' : isDailyDone ? `${mode.accentColor}66` : 'var(--color-border)'}`,
                    borderRadius: '14px',
                  }}
                >
                  {/* Top accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{
                      background: isLocked
                        ? '#d1d5db'
                        : `linear-gradient(90deg, ${mode.accentColor}, ${mode.accentColor}88)`,
                      borderRadius: '14px 14px 0 0',
                    }}
                  />

                  {/* Lock icon (only when locked but NOT daily-done — the
                      W/L badge takes this slot when the daily is complete) */}
                  {isLocked && !isDailyDone ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      <Lock className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  ) : null}

                  {/* W / L pill in the top-right when today's daily is
                      already on the books. */}
                  {isDailyDone && (
                    <div
                      className="absolute top-2.5 right-2.5 w-5 h-5 rounded-md flex items-center justify-center"
                      style={{ background: dailyResult ? (dailyResult.won ? '#7c3aed' : '#dc2626') : '#7c3aed' }}
                    >
                      <span className="text-[10px] font-black text-white leading-none">
                        {dailyResult ? (dailyResult.won ? 'W' : 'L') : '✓'}
                      </span>
                    </div>
                  )}

                  {/* Icon — show mode icon when daily is done (even if
                      locked), show lock only when locked without a result */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5"
                    style={{ background: (isLocked && !isDailyDone) ? '#f3f4f6' : `${mode.accentColor}15` }}
                  >
                    {(isLocked && !isDailyDone)
                      ? <Lock className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                      : mode.romanNumeral
                      ? <span className="text-[11px] font-black leading-none" style={{ color: mode.accentColor }}>{mode.romanNumeral}</span>
                      : Icon
                      ? <Icon className="w-4 h-4" style={{ color: mode.accentColor }} />
                      : null
                    }
                  </div>
                  <div className="text-[13px] font-black" style={{ color: isLocked ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{mode.title}</div>
                  <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    {isDailyDone
                      ? (dailyResult
                          ? `${dailyResult.guesses} ${dailyResult.guesses === 1 ? 'guess' : 'guesses'} · ${formatShortTime(dailyResult.timeSeconds)}`
                          : 'Played today')
                      : isLocked
                      ? `Play again in ${resetCountdownText}`
                      : mode.desc}
                  </div>

                  {/* Per-card VS swords shortcut removed (redundant) — VS is
                      reachable only from the dedicated VS Battle card. */}
                </div>
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
          <Link href="/about" className="text-[10px] font-bold uppercase tracking-wide hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>About</Link>
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
      {sweepCeleb && (
        <SweepCelebration completions={todayDailies} onClose={() => setSweepCeleb(false)} />
      )}
    </div>
  );
}
