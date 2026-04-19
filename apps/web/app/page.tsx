'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Swords, Skull, LogOut, Star, BookOpen, Shield, Crown, Lock, Trophy, Sparkles } from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModeLimitModal } from '@/components/modals/mode-limit-modal';
import { InviteModal } from '@/components/invites/invite-modal';
import { PendingInvitesBanner } from '@/components/invites/pending-invites-banner';
import { PlayModeToggle, UnlimitedHero, type PlayMode } from '@/components/ui/play-mode-toggle';
import { useLivePlayerCount } from '@/hooks/use-live-player-count';
import { fetchTodayDailyCompletions, type DailyCompletion } from '@/lib/daily-service';
import { initDictionary } from '@wordle-duel/core';
import { getSecondsUntilMidnightUTC } from '@/lib/daily-service';
import { hasPlayedModeToday, cleanupOldPlayData, getSecondsUntilMidnightUTC as getResetSeconds, formatCountdown, syncPlayLimits } from '@/lib/play-limit-service';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

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

    async function findWordWithDefinition() {
      // Try up to 20 words starting from today's index until we find one with a definition
      for (let offset = 0; offset < 20; offset++) {
        const word = solutionWords[(daysSinceEpoch + offset) % solutionWords.length];
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
                setInfo({ word, phonetic, partOfSpeech, definition });
                return;
              }
            }
          }
        } catch {}
      }
      // Fallback: show the original daily word without definition
      const fallback = solutionWords[daysSinceEpoch % solutionWords.length];
      setInfo({ word: fallback });
    }

    findWordWithDefinition();
  }, []);

  if (!info) return null;

  const { word: dailyWord } = info;

  return (
    <div
      className="px-3 py-2"
      style={{
        background: '#ffffff',
        border: '1.5px solid #ede9f6',
        borderRadius: '14px',
      }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" style={{ color: '#9ca3af' }} />
          <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
            Word of the Day
          </span>
        </div>
        <span className="text-[10px] font-bold" style={{ color: '#c4b5fd' }}>
          A new word every day
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-base font-black" style={{ color: '#1a1a2e' }}>
          {dailyWord.charAt(0) + dailyWord.slice(1).toLowerCase()}
        </span>
        {info.phonetic && (
          <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>
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
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    setSecs(getSecondsUntilMidnightUTC());
    const i = setInterval(() => setSecs(getSecondsUntilMidnightUTC()), 1000);
    return () => clearInterval(i);
  }, []);
  if (secs === null) {
    return <span style={{ color: '#9ca3af' }} className="text-xs font-bold">Resets in --:--:--</span>;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <span style={{ color: '#9ca3af' }} className="text-xs font-bold">
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
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    setSecs(getSecondsUntilMidnightUTC());
    const i = setInterval(() => setSecs(getSecondsUntilMidnightUTC()), 1000);
    return () => clearInterval(i);
  }, []);
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
const MODE_ID_TO_DB: Record<string, string> = {
  practice: 'DUEL',
  quordle: 'QUORDLE',
  octordle: 'OCTORDLE',
  sequence: 'SEQUENCE',
  rescue: 'RESCUE',
  gauntlet: 'GAUNTLET',
  propernoundle: 'PROPERNOUNDLE',
};

function formatShortTime(seconds: number): string {
  if (seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

const MODE_CARDS = [
  {
    id: 'practice',
    title: 'Classic',
    icon: WordleGridIcon,
    desc: '1 word, 6 tries',
    accentColor: '#7c3aed',
    href: '/practice?daily=true',
    vsHref: '/practice/vs',
  },
  {
    id: 'vs',
    title: 'VS Battle',
    icon: Swords,
    desc: 'Real-time PvP',
    accentColor: '#0d9488',
    // Freemium: daily VS (1 match/day, shared puzzle). Pro users get
    // redirected to the plain /practice/vs at click time in handleVsClick.
    href: '/practice/vs?daily=true',
    vsHref: '/practice/vs?daily=true',
  },
  {
    id: 'quordle',
    title: 'QuadWord',
    icon: null,
    romanNumeral: 'IV',
    desc: '4 words at once',
    accentColor: '#ec4899',
    href: '/quordle?daily=true',
    vsHref: '/quordle/vs',
  },
  {
    id: 'octordle',
    title: 'OctoWord',
    icon: null,
    romanNumeral: 'VIII',
    desc: '8 boards, 13 tries',
    accentColor: '#7e22ce',
    href: '/octordle?daily=true',
    vsHref: '/octordle/vs',
  },
  {
    id: 'sequence',
    title: 'Succession',
    icon: TrendingUp,
    desc: '4 words, one by one',
    accentColor: '#2563eb',
    href: '/sequence?daily=true',
    vsHref: '/sequence/vs',
  },
  {
    id: 'rescue',
    title: 'Deliverance',
    icon: Shield,
    desc: '4 prefilled boards',
    accentColor: '#059669',
    href: '/rescue?daily=true',
    vsHref: '/rescue/vs',
  },
  {
    id: 'gauntlet',
    title: 'Gauntlet',
    icon: Skull,
    desc: '5 escalating stages',
    accentColor: '#d97706',
    href: '/gauntlet?daily=true',
    vsHref: '/gauntlet/vs',
  },
  {
    id: 'propernoundle',
    title: 'ProperNoundle',
    icon: Crown,
    desc: 'Guess famous names',
    accentColor: '#dc2626',
    href: '/propernoundle?daily=true',
    vsHref: '/propernoundle/vs',
  },
];


export default function HomePage() {
  const { user, signOut, isProActive } = useAuth();
  const [limitModal, setLimitModal] = useState<{ open: boolean; modeName: string; modeHref: string }>({ open: false, modeName: '', modeHref: '' });
  const [resetCountdown, setResetCountdown] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const livePlayerCount = useLivePlayerCount();
  const [playMode, setPlayModeState] = useState<PlayMode>('daily');
  const [todayDailies, setTodayDailies] = useState<Map<string, DailyCompletion>>(new Map());
  const router = useRouter();

  const isPro = isProActive;

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

  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
    cleanupOldPlayData();
  }, []);

  // Hydrate the play-limits localStorage cache from the DB so freshly-
  // cleared storage can't bypass the daily mode caps. Fires whenever the
  // signed-in user changes.
  useEffect(() => {
    if (user) syncPlayLimits(user.id);
  }, [user]);

  // Pull today's daily W/L map for the celebratory banner.
  useEffect(() => {
    if (!user) { setTodayDailies(new Map()); return; }
    fetchTodayDailyCompletions(user.id).then(setTodayDailies).catch(() => {});
  }, [user]);

  // Prefetch VS routes so the initial tap is instant (mode cards already
  // prefetch via <Link>, but the VS button uses router.push).
  useEffect(() => {
    router.prefetch('/practice/vs');
    router.prefetch('/practice/vs?daily=true');
  }, [router]);

  // Countdown for locked cards
  useEffect(() => {
    const update = () => setResetCountdown(formatCountdown(getResetSeconds()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVsClick = (vsHref: string) => {
    // Pro users playing the main VS Classic tile skip the daily flow
    // entirely — they get unlimited random-seed matches. Freemium users
    // (and the ?daily=true variant) go through the daily VS flow.
    if (isPro && (vsHref === '/practice/vs?daily=true' || vsHref === '/practice/vs')) {
      router.push('/practice/vs');
      return;
    }
    router.push(vsHref);
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: '#f8f7ff' }}>
      <AppHeader />

      <div className="px-4 flex-1 min-h-0 overflow-y-auto pb-24" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <PendingInvitesBanner userId={user?.id} />

        {/* Pro-only: switch between Daily and Unlimited. Freemium users
            never see the pill (playMode is forced to 'daily' above). */}
        {isPro && <PlayModeToggle value={playMode} onChange={setPlayMode} />}

        {playMode === 'unlimited' ? (
          <UnlimitedHero />
        ) : (() => {
          const completed = todayDailies.size;
          const wins = Array.from(todayDailies.values()).filter((r) => r.won).length;
          const total = 7;
          const allDone = completed >= total;
          const flawless = allDone && wins === total;

          // Sweep / Flawless variants absorb the countdown under the
          // celebratory header, so the user sees one "today's status"
          // surface instead of two stacked cards. Tap still routes to
          // /daily (the leaderboards page) like the plain button does.
          if (allDone) {
            const bg = flawless
              ? 'linear-gradient(135deg, #fef3c7, #fde68a)'
              : 'linear-gradient(135deg, #f5f3ff, #fce7f3)';
            const border = flawless ? '1.5px solid #f59e0b' : '1.5px solid #c4b5fd';
            const titleText = flawless ? 'Flawless Victory!' : 'Daily Sweep!';
            const titleGradient = flawless
              ? 'linear-gradient(135deg, #d97706, #b45309)'
              : 'linear-gradient(135deg, #a78bfa, #ec4899)';
            const subtitle = flawless
              ? `All ${total} dailies won today · +600 XP earned`
              : `All ${total} dailies completed · +200 XP earned`;
            const subtitleColor = flawless ? '#b45309' : '#6d28d9';
            const iconColor = flawless ? '#b45309' : '#7c3aed';

            return (
              <Link href="/daily">
                <button
                  className="w-full btn-3d flex flex-col items-center py-2.5 font-black relative"
                  style={{ background: bg, border, borderRadius: '14px' }}
                >
                  <div className="flex items-center gap-2">
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
                  <div className="text-[11px] font-extrabold mt-0.5" style={{ color: subtitleColor }}>
                    {subtitle}
                  </div>
                  <div className="text-[10px] font-bold mt-0.5" style={{ color: subtitleColor, opacity: 0.75 }}>
                    Next puzzles in <DailyCountdownText />
                  </div>
                </button>
              </Link>
            );
          }

          return (
            <Link href="/daily">
              <button
                className="w-full btn-3d flex flex-col items-center py-2 font-black relative"
                style={{
                  background: 'linear-gradient(135deg, #f3f0ff, #ede5ff)',
                  border: '1.5px solid #c4b5fd',
                  borderRadius: '14px',
                }}
              >
                <div className="flex items-center gap-2 text-sm" style={{ color: '#5b21b6' }}>
                  <Star className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                  <span>Daily Challenge</span>
                  <Star className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                </div>
                <DailyCountdown />
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
            const isLocked = !isPro && user && hasPlayedModeToday(mode.id);

            // Today's daily result for this mode, if played. Keyed by the
            // DB game_mode string (DUEL/QUORDLE/…), so we look up via
            // mode.id → db key. The VS Battle card has no daily row.
            const dbKey = MODE_ID_TO_DB[mode.id];
            const dailyResult = playMode === 'daily' && dbKey ? todayDailies.get(dbKey) : undefined;
            const isDailyDone = !!dailyResult;

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
                    background: isDailyDone ? `${mode.accentColor}0f` : '#ffffff',
                    border: `1.5px solid ${isLocked ? '#d1d5db' : isDailyDone ? `${mode.accentColor}66` : '#ede9f6'}`,
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

                  {/* Lock */}
                  {isLocked ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      <Lock className="w-3 h-3" style={{ color: '#9ca3af' }} />
                    </div>
                  ) : null}

                  {/* W / L pill in the top-right when today's daily is
                      already on the books. Lives in the same slot as
                      the old lock indicator. */}
                  {isDailyDone && (
                    <div
                      className="absolute top-2.5 right-2.5 w-5 h-5 rounded-md flex items-center justify-center"
                      style={{ background: dailyResult!.won ? '#16a34a' : '#dc2626' }}
                    >
                      <span className="text-[10px] font-black text-white leading-none">
                        {dailyResult!.won ? 'W' : 'L'}
                      </span>
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5"
                    style={{ background: isLocked ? '#f3f4f6' : `${mode.accentColor}15` }}
                  >
                    {isLocked
                      ? <Lock className="w-4 h-4" style={{ color: '#9ca3af' }} />
                      : mode.romanNumeral
                      ? <span className="text-[11px] font-black leading-none" style={{ color: mode.accentColor }}>{mode.romanNumeral}</span>
                      : Icon
                      ? <Icon className="w-4 h-4" style={{ color: mode.accentColor }} />
                      : null
                    }
                  </div>
                  <div className="text-[13px] font-black" style={{ color: isLocked ? '#9ca3af' : '#1a1a2e' }}>{mode.title}</div>
                  <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
                    {isLocked
                      ? `Play again in ${resetCountdown}`
                      : isDailyDone
                      ? `${dailyResult!.guesses} ${dailyResult!.guesses === 1 ? 'guess' : 'guesses'} · ${formatShortTime(dailyResult!.timeSeconds)}`
                      : mode.desc}
                  </div>

                  {/* VS button — Pro only AND only in Unlimited mode.
                      Daily mode hides it so the card layout stays clean
                      (VS daily has its own dedicated button below). */}
                  {!isLocked && isPro && mode.id !== 'vs' && playMode === 'unlimited' && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleVsClick(mode.vsHref);
                      }}
                      className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center active:scale-95"
                      style={{ background: `${mode.accentColor}15` }}
                      aria-label={`${mode.title} VS`}
                    >
                      <Swords className="w-3.5 h-3.5" style={{ color: mode.accentColor }} />
                    </button>
                  )}
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
            background: '#ffffff',
            border: '1.5px solid #ede9f6',
            borderRadius: '14px',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-black text-xs" style={{ color: '#1a1a2e' }}>LIVE</span>
            </div>
            <div className="text-[9px] font-bold" style={{ color: '#9ca3af' }}>
              {livePlayerCount === null
                ? 'Players online'
                : `${livePlayerCount.toLocaleString()} ${livePlayerCount === 1 ? 'player' : 'players'} online`}
            </div>
          </div>
          {isPro && (
            <button
              onClick={() => setInviteOpen(true)}
              className="btn-3d px-3 py-1.5 text-white font-black text-[10px] rounded-md"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #db2777)',
                boxShadow: '0 2px 0 #9f1239',
              }}
            >
              Invite
            </button>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut()}
          className="w-full py-1 text-center text-[10px] font-bold hover:opacity-70 transition-colors"
          style={{ color: '#9ca3af' }}
        >
          <LogOut className="w-3 h-3 inline mr-1" />
          Sign Out
        </button>
      </div>

      <BottomNav />
      <ModeLimitModal
        open={limitModal.open}
        onClose={() => setLimitModal({ open: false, modeName: '', modeHref: '' })}
        modeName={limitModal.modeName}
        onViewPuzzle={() => router.push(limitModal.modeHref.includes('daily=true') ? limitModal.modeHref : `${limitModal.modeHref}?daily=true`)}
      />
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
