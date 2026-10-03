'use client';

import { botAchievements, unlockAchievements } from '@/lib/achievement-service';
import { setLeaveGuard } from '@/lib/nav-home';
import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from 'react';
import {
  GameMode,
  generateDailySeed,
  generateMatchSeed,
  generateSolutionsFromSeed,
  generateSolutionsFromSeedForLength,
  evaluateGuess,
  vsOutcome,
  vsMargin,
  vsClock,
  GAUNTLET_STAGES,
} from '@wordle-duel/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { SocketIOMatchService, type MatchEndedData, type OpponentGuessLogEntry } from '@/lib/adapters/match-service';
import { shareCaption } from '@wordle-duel/core';
import { SwappableMatchService, LocalBotMatchService, CPU_OPPONENT_PREFIX, cpuIdentity, cpuOpponentIdForKind, botIdForKind, castBotForKind, engineDifficultyForKind, guessRangeForKind, parseCpuKind, type CpuKind } from '@/lib/adapters/bot-match-service';
import { VsSoloHudContext, VsOpponentContext } from './opponent-hud';
import { BOT_PERSONAS, botLine, botPersona, botRosterEntry, isBotCastId, type BotDifficulty, type BotEvent, type BotPose, type BotTier } from '@/lib/bot/bot-personas';
import { recordCpuGame, recordBotOfDay, recordBotOfDayResult, recordLadderGame, loadCpuProgression } from '@/lib/bot/cpu-progression';
import { VS, ladderNextKind, modeTitle, sendPanelLine, challengeShareText, readBotDaily, writeBotDaily, lookingRowLabel, vsLookingOn } from '@/lib/vs-lobby';
import { pingVsLooking, postRaceResult, sendChallenge, type ChallengeRun, type ChallengeView } from '@/lib/vs-challenges-client';
import { PENDING_RACE_SAVED_LINE, isRetryableFailure, savePendingRace } from '@/lib/vs-pending-races';
import { supabase } from '@/lib/supabase-client';
import { ChallengeResult, ChallengeSent } from './challenge-result';
import { VsQueueScreen, VsStartingScreen } from './vs-queue';
import { BotFigure, BotPoseAvatar, BotSpeech, CardBar, GhostAvatar, InitialAvatar, ModeChip, VS_ACCENT, VS_LIGHT_VARS, VsCard, VsLoadingScreen, VsModeIcon, VsModeTile, VsPill, vsCard } from './vs-ui';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { SoftNum } from '@/components/ui/soft-number';
import { PageBackground } from '@/components/ui/page-background';
import { darken } from '@/lib/soft-surface';
import { medalSrc, poseSrc } from '@/lib/art';
import { LADDER_BOTS } from '@wordle-duel/core';
import { letterTileRadius } from '@/components/ui/letter-tile-avatar';
import { useVsCounts } from './use-vs-lobby';
import { fetchBestGhostRun, type GhostRun } from '@/lib/bot/ghost-service';
import { PhotoFinish, type PhotoFinishKind } from '@/components/effects/photo-finish';
import { usePresenceId } from '@/lib/presence-id';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordMatch, recordCpuResult, type XpResult } from '@/lib/stats-service';
import { fetchHeadToHead, fetchVsProfile, type HeadToHeadRecord, type VsProfile } from '@/lib/head-to-head';
import { XpToast } from '@/components/effects/xp-toast';
import { useDictionary, dictLengthsForMode } from '@/lib/init-dictionary';
import { useProperNoundleBank } from '@/components/propernoundle/puzzle-service';
import { markInviteAcceptedByCode } from '@/lib/invite-service';
import { InviteModal } from '@/components/invites/invite-modal';
import { playOpponentThunk } from '@/lib/sounds';
import { feedback } from '@/lib/sound-events';
import { Loader2, X, Swords } from 'lucide-react';
import { HeaderBack } from '@/components/ui/page-header';
import { Icon3D } from '@/components/ui/icon3d';
import { GameHomeButton } from '@/components/game/game-home-button';
import { Confetti } from '@/components/effects/confetti';
import { MatchIntro, headToHeadLine, INTRO_DURATION_MS } from './match-intro';
import { FinalBoards, VsResultWindow, logSolved, type EvaluatedRow } from './vs-result-detail';
import { ResultHost } from '@/components/ui/mascot';
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES, resultMoment } from '@/lib/art';
import { MomentArt } from '@/components/ui/art-title';
import { vsResultHost } from '@/lib/mascots';
import { OpponentLiveBoards } from './opponent-mini-board';
import {
  hasPlayedModeToday,
  recordModePlayed,
  getSecondsUntilMidnightLocal,
  formatCountdown,
} from '@/lib/play-limit-service';
import { VsLimitModal } from '@/components/modals/vs-limit-modal';
import { getTodayUTC, fetchDailyVsResult } from '@/lib/daily-service';
import { isTypingTarget } from '@/lib/keyboard';

import { VsClassic } from './vs-classic';
import { VsQuadword } from './vs-quadword';
import { VsOctoword } from './vs-octoword';
import { VsSuccession } from './vs-succession';
import { VsDeliverance } from './vs-deliverance';
import { VsGauntlet } from './vs-gauntlet';
import { VsProperNoundle } from './vs-propernoundle';

interface VsGameProps {
  mode: GameMode;
  /**
   * Private-match invite code. When present, joinQueue routes through
   * the server's private-lobby map so the two invitees pair directly,
   * skipping the public queue.
   */
  inviteCode?: string;
  /**
   * When true, this is the freemium "daily VS" flow:
   * - The client joins the matchmaking queue with a deterministic daily
   *   seed so everyone who plays their free daily VS that day shares
   *   the same puzzle word.
   * - On match end, the VS tile is locked for the rest of the day via
   *   `recordModePlayed('vs')`.
   * - Rematch is hidden (freemium only gets one VS match/day).
   * - If the player has already used their daily, a read-only
   *   "already played" screen is shown with the answer and a pro
   *   upsell instead of queueing.
   *
   * Pro users do not need this flag — they get unlimited random-seed
   * matches and rematches as before.
   */
  isDaily?: boolean;
  /**
   * Race a friend's challenge run (VS overhaul §4): a ghost of their run on
   * their seed, scored with core vsOutcome, recorded as a People game.
   */
  race?: ChallengeView;
}

/** Opponent ids for the async-challenge games (never a real socket opponent). */
const SOLO_OPPONENT_ID = 'solo:run';
const RACE_OPPONENT_PREFIX = 'race:';

type VsScreen = 'entry' | 'queue' | 'warmup' | 'match' | 'waiting' | 'result';

const MODE_LABELS: Record<string, string> = {
  [GameMode.DUEL]: 'CLASSIC',
  [GameMode.QUORDLE]: 'QUADWORD',
  [GameMode.OCTORDLE]: 'OCTOWORD',
  [GameMode.SEQUENCE]: 'SUCCESSION',
  [GameMode.RESCUE]: 'DELIVERANCE',
  [GameMode.GAUNTLET]: 'GAUNTLET',
  [GameMode.PROPERNOUNDLE]: 'PROPERNOUNDLE',
  [GameMode.DUEL_6]: 'SIX',
  [GameMode.DUEL_7]: 'SEVEN',
};

const MODE_GRADIENTS: Record<string, string> = {
  [GameMode.DUEL]: 'from-blue-900 via-cyan-800 to-teal-700',
  [GameMode.QUORDLE]: 'from-purple-900 via-pink-800 to-orange-700',
  [GameMode.OCTORDLE]: 'from-indigo-900 via-purple-800 to-pink-700',
  [GameMode.SEQUENCE]: 'from-orange-900 via-red-800 to-pink-700',
  [GameMode.RESCUE]: 'from-indigo-900 via-purple-800 to-fuchsia-700',
  [GameMode.GAUNTLET]: 'from-purple-900 via-pink-800 to-orange-700',
  [GameMode.PROPERNOUNDLE]: 'from-red-900 via-rose-800 to-orange-700',
  [GameMode.DUEL_6]: 'from-cyan-900 via-teal-800 to-sky-700',
  [GameMode.DUEL_7]: 'from-lime-900 via-green-800 to-emerald-700',
};

const MODE_TITLE_GRADIENTS: Record<string, string> = {
  [GameMode.DUEL]: 'from-cyan-400 via-blue-400 to-teal-400',
  [GameMode.QUORDLE]: 'from-yellow-400 via-pink-400 to-purple-400',
  [GameMode.OCTORDLE]: 'from-cyan-400 via-purple-400 to-pink-400',
  [GameMode.SEQUENCE]: 'from-yellow-400 via-orange-400 to-red-400',
  [GameMode.RESCUE]: 'from-indigo-400 via-purple-400 to-fuchsia-400',
  [GameMode.GAUNTLET]: 'from-yellow-400 via-pink-400 to-purple-400',
  [GameMode.PROPERNOUNDLE]: 'from-red-400 via-rose-400 to-orange-400',
  [GameMode.DUEL_6]: 'from-cyan-400 via-teal-400 to-sky-400',
  [GameMode.DUEL_7]: 'from-lime-400 via-green-400 to-emerald-400',
};

// The solo screen's title per mode (VS polish §1): the VS match header is the
// solo header — same title, size and colors — plus a small teal VS pill.
// Gauntlet's solo screen has no title row (its stage stepper is the header).
const GRADIENT_TEXT: CSSProperties = { WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', color: 'transparent' };
const SOLO_TITLES: Record<string, { title: string; className: string; style?: CSSProperties }> = {
  [GameMode.DUEL]: { title: 'CLASSIC', className: 'text-3xl', style: { backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)', ...GRADIENT_TEXT } },
  [GameMode.DUEL_6]: { title: 'CLASSIC SIX', className: 'text-3xl', style: { backgroundImage: 'linear-gradient(135deg, #06b6d4, #22d3ee)', ...GRADIENT_TEXT } },
  [GameMode.DUEL_7]: { title: 'CLASSIC SEVEN', className: 'text-3xl', style: { backgroundImage: 'linear-gradient(135deg, #84cc16, #a3e635)', ...GRADIENT_TEXT } },
  [GameMode.QUORDLE]: { title: 'QUADWORD', className: 'text-3xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400' },
  [GameMode.OCTORDLE]: { title: 'OCTOWORD', className: 'text-3xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400' },
  [GameMode.SEQUENCE]: { title: 'SUCCESSION', className: 'text-3xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400' },
  [GameMode.RESCUE]: { title: 'DELIVERANCE', className: 'text-3xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400' },
  [GameMode.PROPERNOUNDLE]: { title: 'PROPERNOUNDLE', className: 'text-2xl', style: { color: '#dc2626' } },
};

/** Soft toast pill (VS polish §2: toasts are soft cards, not black slabs). */
function VsToast({ text, className = 'bottom-8' }: { text: string; className?: string }) {
  return (
    <div className={`fixed left-0 right-0 text-center z-50 px-4 pointer-events-none ${className}`} style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
      <span className="inline-block text-[13px] font-extrabold px-4 py-2 rounded-full animate-fade-in-up" style={{ ...vsCard(VS_ACCENT, { radius: 999 }), color: VS.deep }}>
        {text}
      </span>
    </div>
  );
}

/** Live opponent clock string (m:ss). */
const clockOf = (secs: number) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

// Per-mode accent used for the corner Home button during a VS match.
// Matches the solid accent each mode uses on the home-screen mode cards
// so tapping into VS keeps the visual identity consistent.
const MODE_ACCENT_COLORS: Record<string, string> = {
  [GameMode.DUEL]: '#7c3aed',
  [GameMode.QUORDLE]: '#ec4899',
  [GameMode.OCTORDLE]: '#7e22ce',
  [GameMode.SEQUENCE]: '#2563eb',
  [GameMode.RESCUE]: '#059669',
  [GameMode.GAUNTLET]: '#d97706',
  [GameMode.PROPERNOUNDLE]: '#dc2626',
  [GameMode.DUEL_6]: '#06b6d4',
  [GameMode.DUEL_7]: '#84cc16',
};

// Board count / max guesses / word length per mode — mirrors the server's
// MODE_BOARD_COUNT + the core reducer's per-mode maxGuesses.
const MODE_TOTAL_BOARDS: Record<string, number> = {
  [GameMode.DUEL]: 1,
  [GameMode.QUORDLE]: 4,
  [GameMode.OCTORDLE]: 8,
  [GameMode.SEQUENCE]: 4,
  [GameMode.RESCUE]: 4,
  [GameMode.GAUNTLET]: 21,
  [GameMode.PROPERNOUNDLE]: 1,
  [GameMode.DUEL_6]: 1,
  [GameMode.DUEL_7]: 1,
};

const VS_MODE_MAX_GUESSES: Record<string, number> = {
  [GameMode.DUEL]: 6,
  [GameMode.QUORDLE]: 9,
  [GameMode.OCTORDLE]: 13,
  [GameMode.SEQUENCE]: 10,
  [GameMode.RESCUE]: 6,
  [GameMode.GAUNTLET]: 50,
  [GameMode.PROPERNOUNDLE]: 6,
  [GameMode.DUEL_6]: 7,
  [GameMode.DUEL_7]: 8,
};

const MODE_WORD_LEN: Record<string, number> = {
  [GameMode.DUEL_6]: 6,
  [GameMode.DUEL_7]: 7,
};

// Per-BOARD full-frame rows for the spectator live board. The complete empty
// frame renders from the moment you start watching — guessed rows fill in
// top-down instead of the board growing row by row. For every mode this is
// the per-board maxGuesses; Gauntlet is the exception because its 50 is a
// TOTAL guess budget shared across 21 stage boards, so its frame starts at
// the stage-1 board height and only grows if a board accumulates more rows.
const VS_MODE_FRAME_ROWS: Record<string, number> = {
  [GameMode.DUEL]: 6,
  [GameMode.QUORDLE]: 9,
  [GameMode.OCTORDLE]: 13,
  [GameMode.SEQUENCE]: 10,
  [GameMode.RESCUE]: 6,
  [GameMode.GAUNTLET]: 6,
  [GameMode.PROPERNOUNDLE]: 6,
  [GameMode.DUEL_6]: 7,
  [GameMode.DUEL_7]: 8,
};

/**
 * Tug-of-war lead metric: boards solved dominate (weight 0.7); best-row
 * greens add the within-board signal (weight 0.3). For single-board modes
 * this reduces to greens-in-best-row until the solve flips boardsSolved.
 */
function computeVsProgress(
  boardsSolved: number,
  totalBoards: number,
  bestGreens: number,
  wordLen: number,
): number {
  return Math.min(
    1,
    (boardsSolved / Math.max(1, totalBoards)) * 0.7 + (bestGreens / Math.max(1, wordLen)) * 0.3,
  );
}

/** Max count of CORRECT tiles in any single row across all boards. */
function bestRowGreens(tiles: Record<number, string[][]>): number {
  let best = 0;
  for (const rows of Object.values(tiles)) {
    for (const row of rows) {
      const greens = row.filter((t) => t === 'CORRECT').length;
      if (greens > best) best = greens;
    }
  }
  return best;
}

/** Word lists (and ProperNoundle's puzzles) load on demand (founder, 2026-09-29): the match
 *  mounts only once they are in, so no guess or bot plan ever runs against an empty list. */
export function VsGame(props: VsGameProps) {
  const isPN = props.mode === GameMode.PROPERNOUNDLE;
  const dict = useDictionary(dictLengthsForMode(props.mode));
  const pn = useProperNoundleBank(isPN);
  return dict && pn ? <VsGameInner {...props} /> : <VsLoadingScreen mode={props.mode} />;
}

function VsGameInner({ mode, isDaily = false, inviteCode, race }: VsGameProps) {

  const { profile, session, isProActive, isGuest, exitGuest, refreshProfile } = useAuth();
  const isPro = isProActive;
  // Live ref so the once-wired socket handlers (rematch offer) read the
  // CURRENT Pro status, not the value captured at mount.
  const isProRef = useRef(isPro);
  isProRef.current = isPro;
  // VS is account-based (live opponents, recorded results). The /vs lobby
  // gates guests, but deep links (/classic/vs, invite links) mount this
  // component directly — mirror the lobby's sign-in gate here.
  const authGated = isGuest && !profile;

  // Daily VS uses the shared daily seed for EVERYONE (incl. Pro) so all players
  // play the same puzzle and pair together. The once-per-day limit + already-
  // played screen apply to all; Pro gets an "Unlimited VS" escape there.
  // Other modes are Pro-only, but this component must not assume that: its
  // BUTTONS were gated while the ROUTES weren't, so a bookmarked /quordle/vs
  // walked a free user straight past every check below. VsProGate on each VS
  // route is what makes the assumption true — keep the checks here anyway
  // (Quick Match / Invite below), so a future route can't reopen the hole.
  const dailyVsActive = isDaily && mode === GameMode.DUEL;

  // The deterministic seed for today's free daily VS puzzle. Intentionally
  // uses a different mode slug ("DUEL_VS") from Classic's daily
  // ("DUEL"), so the daily VS word is always different from the daily
  // Classic word even though both are derived from the same solution
  // list via generateSolutionsFromSeed.
  const todayDailySeed = useMemo(
    () => (dailyVsActive ? generateDailySeed(getTodayUTC(), 'DUEL_VS') : undefined),
    [dailyVsActive],
  );

  // Pre-compute the answer for today's daily VS so the "already played"
  // screen can show it without needing to re-connect to the server.
  const todayDailyAnswer = useMemo(
    () => (todayDailySeed ? generateSolutionsFromSeed(todayDailySeed, 1)[0] : ''),
    [todayDailySeed],
  );

  // Has this freemium user already used their daily VS today? If so we
  // short-circuit past the matchmaking queue entirely.
  const [alreadyPlayedDaily, setAlreadyPlayedDaily] = useState(
    () => dailyVsActive && hasPlayedModeToday('vs'),
  );
  // Today's daily VS outcome (server-backed) — drives the YOU WON / YOU LOST
  // pill on the already-played screen (iOS/Android parity).
  const [dailyWon, setDailyWon] = useState<boolean | null>(null);
  // Daily gate: the local play-limit cache answers instantly, but a daily VS
  // played on ANOTHER device only exists on the server — mirror the native
  // flow (local check, else server check) before joining the daily queue.
  // 'play' is the only state that queues.
  const [dailyGate, setDailyGate] = useState<'checking' | 'play' | 'played'>(
    () => (!dailyVsActive ? 'play' : hasPlayedModeToday('vs') ? 'played' : 'checking'),
  );
  useEffect(() => {
    if (!dailyVsActive) return;
    const me = profile;
    // A bot that stepped in (§6) leaves only the local result key.
    const botWon = () => { const b = readBotDaily(getTodayUTC()); return b && b.result !== 'draw' ? b.result === 'won' : null; };
    if (alreadyPlayedDaily) {
      // Locally known as played — fetch the W/L for the pill.
      if (me) fetchDailyVsResult(me.id).then((w) => setDailyWon(w ?? botWon())).catch(() => {});
      else setDailyWon(botWon());
      return;
    }
    if (!me) { setDailyGate('play'); return; }
    let cancelled = false;
    fetchDailyVsResult(me.id)
      .then((won) => {
        if (cancelled) return;
        if (won !== null) {
          setDailyWon(won);
          setAlreadyPlayedDaily(true);
          setDailyGate('played');
        } else {
          setDailyGate('play');
        }
      })
      .catch(() => { if (!cancelled) setDailyGate('play'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyVsActive, profile?.id]);
  // Shown if a freemium user tries to rematch after their daily game.
  const [vsLimitOpen, setVsLimitOpen] = useState(false);
  // Standard "tap a VS mode" flow now opens an entry chooser (Quick Match / Bot
  // Match / Invite a Friend) instead of silently joining the queue. Specific
  // intents — daily VS and accepting a private invite link — skip straight to
  // matchmaking (autoJoin below).
  // VS overhaul entry points (spec §2/§3/§8): the lobby's LIVE tile (?live=1)
  // queues at once; the Bots page starts a bot (?cpu=<kind>); the Friend page
  // starts the challenge-send game (?send=1&friends=<ids>&link=1). A race
  // arrives as the `race` prop from /vs/challenge/<code>.
  const searchParams = useSearchParams();
  const liveParam = searchParams?.get('live') === '1';
  // ?cpu=<cast id | daily | ghost> (old tier kinds still parse, FINISH_SPEC D1).
  const cpuParam = parseCpuKind(searchParams?.get('cpu'));
  const sendFriendIds = useMemo(() => (searchParams?.get('friends') ?? '').split(',').filter(Boolean), [searchParams]);
  // The challenge-send game's HUD line (VS overhaul §3): who will race this run.
  const soloHudLine = sendFriendIds.length > 0
    ? `${sendFriendIds.length} ${sendFriendIds.length === 1 ? 'friend' : 'friends'} will race it`
    : 'Anyone with the link';
  const sendLink = searchParams?.get('link') === '1';
  // Sending a challenge is Pro (the route gate and the server check it too).
  const flow: 'race' | 'send' | null = race ? 'race' : searchParams?.get('send') === '1' && isPro ? 'send' : null;
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const raceRef = useRef(race);
  raceRef.current = race;
  const autoJoin = dailyVsActive || !!inviteCode || liveParam;
  const [screen, setScreen] = useState<VsScreen>(autoJoin || cpuParam || flow ? 'queue' : 'entry');
  const [showInvite, setShowInvite] = useState(false);
  // Stable facade over the transport: starts on the socket, can hot-swap to a
  // client-side CPU bot (Pro-only practice) without re-wiring any handlers.
  const [matchService] = useState(() => new SwappableMatchService(new SocketIOMatchService(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001')));
  // CPU-vs state. cpuDifficulty !== null once the player picks a bot opponent.
  const [cpuDifficulty, setCpuDifficulty] = useState<BotDifficulty | null>(null);
  const isCpu = cpuDifficulty !== null;
  const isCpuRef = useRef(isCpu);
  isCpuRef.current = isCpu;
  // CPU practice is available for every mode (Gauntlet's 21-board / 5-stage run
  // is modeled by the bot engine, which also emits stage-completed events).
  const cpuSupported = true;
  // botId = the cast bot (rip … webster) or 'ghost' (D1): its art, color and banter.
  const [cpuPersona, setCpuPersona] = useState<{ tier: BotTier; name: string; avatar: string; color: string; botId: string } | null>(null);
  const cpuPersonaRef = useRef(cpuPersona);
  cpuPersonaRef.current = cpuPersona;
  const [showCpuChooser, setShowCpuChooser] = useState(false);
  const cpuKindRef = useRef<CpuKind | null>(null);
  const [ghostRun, setGhostRun] = useState<GhostRun | null>(null);
  const [ghostChecked, setGhostChecked] = useState(false);
  // Async challenges: the finished run (both flows), the send result, and the race's outcome.
  const myCompletionRef = useRef<{ status: 'won' | 'lost'; guesses: number; timeMs: number } | null>(null);
  const boardsSolvedRef = useRef(0);
  const [challengeRun, setChallengeRun] = useState<ChallengeRun | null>(null);
  const [sendResult, setSendResult] = useState<{ code: string | null; error: string | null } | null>(null);
  const [raceOutcome, setRaceOutcome] = useState<'win' | 'loss' | 'draw' | null>(null);
  // §14: the race result POST failed offline / 5xx and waits in the pending list.
  const [raceSavedOffline, setRaceSavedOffline] = useState(false);
  // Fun layer: photo-finish flourish, streak milestone, cosmetic unlock, and a
  // per-session run-it-back tally — all CPU-only.
  const [photoFinish, setPhotoFinish] = useState<PhotoFinishKind | null>(null);
  const [cpuMilestone, setCpuMilestone] = useState<number | null>(null);
  const [cpuUnlock, setCpuUnlock] = useState<string | null>(null);
  // The bot's word on the result (D3 banter: bot_win / bot_loss), picked once per match.
  const [cpuResultLine, setCpuResultLine] = useState<string | null>(null);
  // This game cleared a ladder rung (D1) — `final` = the whole ladder (Webster beaten).
  const [ladderMoment, setLadderMoment] = useState<{ cleared: number; final: boolean } | null>(null);
  const [cpuStreak, setCpuStreak] = useState(0);
  const [cpuSession, setCpuSession] = useState({ wins: 0, losses: 0 });
  const presenceId = usePresenceId();
  const router = useRouter();
  const [seed, setSeed] = useState('');
  // The match's answer words as the SERVER dealt them (match_start /
  // rematch_start). Preferred over deriving from the seed so both players
  // always see the same puzzle, whatever answer list their build carries.
  const [serverSolutions, setServerSolutions] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(0);
  // Live refs so the socket connect effect can run ONCE per mount and read the
  // latest profile/seed without listing them as deps. Listing `profile` as a
  // dep caused the effect to re-run (and its cleanup to disconnect the socket)
  // mid-match whenever auth refreshed the profile object — e.g. right after a
  // win wrote XP — which the opponent's client saw as "opponent left" and got
  // booted to home. Refs keep the connection stable for the whole match.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const seedRef = useRef(seed);
  seedRef.current = seed;
  // Ref so the once-wired socket handlers can read the live screen.
  const screenRef = useRef(screen);
  screenRef.current = screen;
  // Countdown seconds parked here in onMatchFound, started by the intro's onDone
  // (after the splash) so it no longer ticks underneath the intro overlay.
  const pendingCountdownRef = useRef(3);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownIsRematch, setCountdownIsRematch] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
  const [opponentTiles, setOpponentTiles] = useState<Record<number, string[][]>>({});
  const [puzzleMetadata, setPuzzleMetadata] = useState<{ display: string; category: string; answerLength: number; themeCategory?: string } | undefined>();
  const [matchResult, setMatchResult] = useState<any>(null);
  // FINISH_SPEC U: the whole bot ladder cleared = `celebrate`.
  useEffect(() => { if (matchResult && ladderMoment?.final) feedback('celebrate'); }, [matchResult, ladderMoment]);
  // FINISH_SPEC AJ: during a match, leaving through the footer tabs asks first (quitting counts as a forfeit).
  useEffect(() => {
    const live = screen === 'match' && !matchResult;
    setLeaveGuard(live ? 'Leave the match? It counts as a forfeit.' : null);
    return () => setLeaveGuard(null);
  }, [screen, matchResult]);
  const [playerStats, setPlayerStats] = useState<{ guesses: number; timeMs: number } | null>(null);
  const [message, setMessage] = useState('');
  const [rematchState, setRematchState] = useState<'idle' | 'offered' | 'received' | 'declined'>('idle');
  const resultRecordedRef = useRef(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  // ── VS experience upgrade state ──
  const [showIntro, setShowIntro] = useState(false);

  // Opponent-disconnect grace: seconds left on the server's reconnect window
  // (null = connected). Set by opponent_disconnected, cleared by
  // opponent_reconnected / opponent_left / match end.
  const [disconnectGrace, setDisconnectGrace] = useState<number | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearDisconnectGrace = useCallback(() => {
    if (graceTimerRef.current) {
      clearInterval(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    setDisconnectGrace(null);
  }, []);

  // Shared input-lock timeline: keyboard input is swallowed for the FULL
  // intro + countdown + GO beat measured from match_found, regardless of
  // whether this player tapped to skip the intro — so a hardware keyboard
  // (window keydown is live from match_start while the overlay only covers
  // the on-screen keys) and an intro-skipper can't get a head start.
  const [sharedInputLock, setSharedInputLock] = useState(false);
  const sharedLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginInputLock = useCallback((ms: number) => {
    setSharedInputLock(true);
    if (sharedLockTimerRef.current) clearTimeout(sharedLockTimerRef.current);
    sharedLockTimerRef.current = setTimeout(() => {
      sharedLockTimerRef.current = null;
      setSharedInputLock(false);
    }, ms);
  }, []);
  const endInputLock = useCallback(() => {
    if (sharedLockTimerRef.current) {
      clearTimeout(sharedLockTimerRef.current);
      sharedLockTimerRef.current = null;
    }
    setSharedInputLock(false);
  }, []);

  // While locked, swallow game keys at the CAPTURE phase so the mode
  // components' window keydown listeners (live from match_start, still under
  // the intro/countdown overlays) never see them. Modifier combos pass
  // through — only bare game keys are blocked.
  useEffect(() => {
    if (!sharedInputLock) return;
    const block = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;   // don't steal keys from a focused input/modal
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [sharedInputLock]);

  // Run the on-board countdown overlay. Called after the match-intro splash
  // finishes (see MatchIntro onDone) so the two no longer overlap.
  const startCountdown = useCallback((secs: number) => {
    setShowCountdown(true);
    setCountdown(secs);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    // 3-2-1-GO: the "GO!" beat (countdown === 0) overlaps the board's first
    // ~0.6s before the overlay drops.
    setTimeout(() => setShowCountdown(false), secs * 1000 + 600);
  }, []);
  const [opponentUserId, setOpponentUserId] = useState<string | null>(null);
  const [opponentInfo, setOpponentInfo] = useState<VsProfile | null>(null);
  const opponentNameRef = useRef('Opponent');
  const [headToHead, setHeadToHead] = useState<HeadToHeadRecord | null>(null);
  // My own play, mirrored locally so the header/result can render it:
  // tiles are evaluated client-side from the seed-derived solutions.
  const [myTiles, setMyTiles] = useState<Record<number, string[][]>>({});
  const [myGuessLog, setMyGuessLog] = useState<OpponentGuessLogEntry[]>([]);
  const myGuessLogRef = useRef<OpponentGuessLogEntry[]>([]);
  // Final snapshot of MY board rows at game end, captured by the mode
  // component (single-board modes). Unlike myGuessLog it includes hint
  // rows/tiles (Six/Seven/ProperNoundle), so the result recap can show them.
  const [myFinalRows, setMyFinalRows] = useState<EvaluatedRow[] | null>(null);
  const [myBoardsSolved, setMyBoardsSolved] = useState(0);
  const [myStatus, setMyStatus] = useState<'won' | 'lost' | null>(null);
  // `botId` set = a line in that bot's own voice (D3 banter), drawn with its character.
  const [callout, setCallout] = useState<{ id: number; text: string; botId?: string; pose?: BotPose } | null>(null);
  const lastCalloutRef = useRef('');
  const calloutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [opponentTyping, setOpponentTyping] = useState(false);
  const typingHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const prevOppBoardsSolvedRef = useRef(0);
  const [waitingClock, setWaitingClock] = useState(0);
  // Gauntlet: the stage the opponent is on (0-4), from opponent_stage_completed.
  const [opponentStage, setOpponentStage] = useState(0);

  const totalBoards = MODE_TOTAL_BOARDS[mode] || 1;
  const modeMaxGuesses = VS_MODE_MAX_GUESSES[mode] || 6;
  const wordLen = MODE_WORD_LEN[mode] || 5;

  // Solutions derived from the match seed so my own guess rows can be
  // evaluated locally for the tug-of-war bar and the result boards.
  // ProperNoundle's answer is server-side until match end, so it stays
  // empty (the result screen uses match_ended.solutions instead).
  const mySolutions = useMemo(() => {
    if (!seed || mode === GameMode.PROPERNOUNDLE) return [] as string[];
    if (serverSolutions.length > 0) return serverSolutions;
    if (mode === GameMode.DUEL_6) return generateSolutionsFromSeedForLength(seed, 1, 6);
    if (mode === GameMode.DUEL_7) return generateSolutionsFromSeedForLength(seed, 1, 7);
    return generateSolutionsFromSeed(seed, totalBoards);
  }, [seed, mode, totalBoards, serverSolutions]);
  const mySolutionsRef = useRef<string[]>([]);
  mySolutionsRef.current = mySolutions;

  const showCallout = useCallback((text: string, botId?: string, pose?: BotPose) => {
    // Dedupe consecutive identical callouts while one is still visible.
    if (text === lastCalloutRef.current && calloutTimerRef.current) return;
    lastCalloutRef.current = text;
    setCallout({ id: Date.now(), text, botId, pose });
    if (calloutTimerRef.current) clearTimeout(calloutTimerRef.current);
    calloutTimerRef.current = setTimeout(() => {
      setCallout(null);
      calloutTimerRef.current = null;
      lastCalloutRef.current = '';
    }, 2500);
  }, []);

  // Bot banter (FINISH_SPEC D3): the CPU opponent's line for an event, in its
  // own character's voice (lib/bot/bot-personas botLine — kind, never mean),
  // through the same callout channel. Ghosts and people never talk.
  const botSay = useCallback((event: BotEvent) => {
    const botId = isCpuRef.current ? cpuPersonaRef.current?.botId : undefined;
    if (!botId || !isBotCastId(botId)) return false;
    const line = botLine(botId, event);
    if (!line) return false;
    // A7: the HUD already shows the bot's 'ready' image, so its lines use another pose.
    showCallout(line, botId, event === 'bot_solved_board' ? 'victory' : 'waiting');
    return true;
  }, [showCallout]);
  const botSayRef = useRef(botSay);
  botSayRef.current = botSay;

  const resetPerMatchState = useCallback(() => {
    boardsSolvedRef.current = 0;
    myCompletionRef.current = null;
    setMyTiles({});
    setMyGuessLog([]);
    myGuessLogRef.current = [];
    setMyFinalRows(null);
    setMyBoardsSolved(0);
    setMyStatus(null);
    setCallout(null);
    setOpponentTyping(false);
    prevOppBoardsSolvedRef.current = 0;
    lastCalloutRef.current = '';
    // CPU fun-layer overlays don't carry into the next match.
    setPhotoFinish(null);
    setCpuMilestone(null);
    setCpuUnlock(null);
    setCpuResultLine(null);
    setLadderMoment(null);
  }, []);

  const formatTime = (ms: number) => {
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const gradient = MODE_GRADIENTS[mode] || MODE_GRADIENTS[GameMode.DUEL];
  const titleGradient = MODE_TITLE_GRADIENTS[mode] || MODE_TITLE_GRADIENTS[GameMode.DUEL];
  const accentColor = MODE_ACCENT_COLORS[mode] || MODE_ACCENT_COLORS[GameMode.DUEL];
  const label = MODE_LABELS[mode] || 'VS';

  useEffect(() => {
    // Anonymous guests never open the socket or queue — the sign-in gate
    // below renders instead (deep links /classic/vs and invite links mount
    // this component without passing through the /vs lobby's gate).
    if (authGated) return;
    matchService.connect(presenceId, session?.access_token);

    matchService.onQueueStatus((data) => {
      setQueuePosition(data.position);
      if (typeof data.queueSize === 'number') setQueueSize(data.queueSize);
    });

    matchService.onMatchFound((data) => {
      feedback('vs'); // FINISH_SPEC U: match found = `vs` + medium haptic (the intro's stinger collapses into it)
      // Park the countdown length; it starts when the intro splash finishes.
      pendingCountdownRef.current = Math.max(1, data.countdownSeconds);
      // The challenge-send game has nobody to meet: no intro, straight to 3-2-1.
      const solo = data.opponentUserId === SOLO_OPPONENT_ID;

      // Shared input-lock, anchored HERE to the full un-skipped timeline:
      // intro + countdown + the ~600ms GO beat. Tap-skipping the intro or
      // typing on a hardware keyboard (window keydown is live from
      // match_start while the overlays only cover the on-screen keys) can't
      // buy a head start.
      beginInputLock((solo ? 0 : INTRO_DURATION_MS) + pendingCountdownRef.current * 1000 + 600);

      if (solo) {
        setOpponentUserId(SOLO_OPPONENT_ID);
        setOpponentInfo({ username: 'YOUR RUN', avatarUrl: null, level: 0 });
        opponentNameRef.current = 'YOUR RUN';
        startCountdown(pendingCountdownRef.current);
        return;
      }

      // Match-intro splash: resolve the opponent's public profile and the
      // all-time head-to-head record while the 2.5s intro plays.
      setShowIntro(true);
      setHeadToHead(null);
      setOpponentInfo(null);
      opponentNameRef.current = 'Opponent';
      const oppId = data.opponentUserId ?? null;
      setOpponentUserId(oppId);
      if (oppId && oppId.startsWith(CPU_OPPONENT_PREFIX)) {
        // CPU opponent: use the persona identity locally (the bot's art) — no profile / H2H fetch.
        const id = cpuIdentity(oppId);
        setOpponentInfo({ username: id.name, avatarUrl: id.avatar, level: 0 });
        opponentNameRef.current = id.name;
        setHeadToHead(null);
      } else if (oppId && oppId.startsWith(RACE_OPPONENT_PREFIX) && raceRef.current) {
        // A friend's run: the challenger's identity, not a bot label.
        const c = raceRef.current.challenger;
        setOpponentInfo({ username: c.username, avatarUrl: c.avatarUrl, level: 0 });
        opponentNameRef.current = c.username;
        const me = profileRef.current;
        if (me) fetchHeadToHead(me.id, c.id).then(setHeadToHead).catch(() => {});
      } else if (oppId) {
        fetchVsProfile(oppId)
          .then((p) => {
            if (p) {
              setOpponentInfo(p);
              opponentNameRef.current = p.username;
            }
          })
          .catch(() => {});
        const me = profileRef.current;
        if (me) {
          fetchHeadToHead(me.id, oppId).then(setHeadToHead).catch(() => {});
        }
      }

      // Private-match invites: flip the match_invites row to 'accepted'
      // now that the matchmaking server paired both invitees. Keeps the
      // pending-invites banner from lingering and stops a stale click
      // from spawning a ghost lobby for the next 24 hours.
      if (inviteCode) {
        markInviteAcceptedByCode(inviteCode, data.matchId).catch(() => {});
      }

      // The countdown overlay is started by MatchIntro's onDone (below), after
      // the splash finishes — so it no longer ticks under the intro.
    });

    matchService.onMatchStart((data) => {
      setServerSolutions((data.solutions ?? []).map((w) => w.toUpperCase()));
      setSeed(data.seed);
      setStartTime(data.startTime);
      setPuzzleMetadata(data.puzzleMetadata);
      setScreen('match');
      setOpponentProgress({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
      setOpponentTiles({});
      setOpponentStage(0);
      resultRecordedRef.current = false;
      resetPerMatchState();
      clearDisconnectGrace();
      // Consume the free daily VS the moment the match STARTS, not only at
      // the end — quitting or killing the tab mid-match no longer refunds
      // the daily. The match-end write below stays as an idempotent
      // belt-and-braces (recordModePlayed just re-sets the same flag/row).
      // A bot that steps into the Daily Battle (§6) consumes it the same way.
      if (dailyVsActive) recordModePlayed('vs');
      // The bot says hello in character (after the reset above cleared old callouts).
      botSayRef.current('match_start');
    });

    matchService.onOpponentProgress((data: any) => {
      setOpponentProgress(data);

      // Moment callouts (one per progress event, most dramatic first).
      const name = opponentNameRef.current;
      const prevBoardsForBanter = prevOppBoardsSolvedRef.current;
      let calloutText: string | null = null;
      if (data.boardsSolved > prevOppBoardsSolvedRef.current && data.totalBoards > 1) {
        calloutText = `${name} solved board ${data.boardsSolved}!`;
      }
      prevOppBoardsSolvedRef.current = data.boardsSolved;

      // applyToAll modes (quordle/octordle/rescue) send `latestGuesses` — the
      // guess evaluated against every unsolved board — so all the opponent's
      // per-board mini-boards populate, not just board 0. Single-board / sequence
      // still send a single `latestGuess`.
      const perBoard: { boardIndex: number; tiles: string[] }[] =
        data.latestGuesses ?? (data.latestGuess ? [data.latestGuess] : []);
      if (perBoard.length > 0) {
        playOpponentThunk();
        setOpponentTiles(prev => {
          const next = { ...prev };
          for (const g of perBoard) {
            const idx = g.boardIndex ?? 0;
            next[idx] = [...(next[idx] || []), g.tiles];
          }
          return next;
        });
        // "N greens!" callout keys off the board the player is focused on (the
        // single latestGuess when present, else the first fanned-out board).
        const primary = data.latestGuess ?? perBoard[0];
        const greens = primary.tiles.filter((t: string) => t === 'CORRECT').length;
        const len = primary.tiles.length;
        if (!calloutText && len >= 2 && greens === len - 1) {
          calloutText = `${name} got ${greens} greens!`;
        }
      }
      if (!calloutText && !data.solved && data.attempts === modeMaxGuesses - 1) {
        calloutText = `${name} is on their last guess!`;
      }
      // A bot that just solved a board (or the puzzle) says so in its own voice.
      const botSolved = (data.totalBoards > 1 && data.boardsSolved > (prevBoardsForBanter ?? 0)) || (data.totalBoards <= 1 && data.solved);
      if (botSolved && botSayRef.current('bot_solved_board')) return;
      if (calloutText) showCallout(calloutText);
    });

    // Gauntlet: the opponent cleared a stage. Their next stage's boards reuse
    // the same board indices, so the live (display-only) tiles restart with it.
    matchService.onOpponentStageCompleted(({ stageIndex }) => {
      setOpponentStage((prev) => Math.max(prev, Math.min(GAUNTLET_STAGES.length - 1, stageIndex + 1)));
      setOpponentTiles({});
    });

    matchService.onOpponentTyping(() => {
      setOpponentTyping(true);
      // Hide after 2s without fresh pings (the sender throttles to 1/1.5s).
      if (typingHideTimerRef.current) clearTimeout(typingHideTimerRef.current);
      typingHideTimerRef.current = setTimeout(() => setOpponentTyping(false), 2000);
    });

    matchService.onMatchEnded((data) => {
      setMatchResult(data);
      setScreen('result');
      clearDisconnectGrace();
      endInputLock();

      // Record stats
      const me = profileRef.current;
      if (me && !resultRecordedRef.current) {
        resultRecordedRef.current = true;
        // Async challenges record through their own paths (§3: nothing now; §4: the race).
        if (flowRef.current) {
          void flowHandlersRef.current?.(data);
          return;
        }
        const won = data.winner === 'player';
        const isDraw = data.winner === 'draw';
        if (isCpuRef.current) {
          // Pure practice: record ONLY the separate vs_cpu bucket — no XP, no
          // matches row, no head-to-head, no achievements, no daily lock.
          recordCpuResult(me.id, mode, won, data.playerGuesses, Math.round(data.playerTime / 1000));
          // Fun layer: progression (streak / ladder / cosmetics / milestone),
          // session tally, and the photo-finish flourish on a close/last win.
          const tier: BotTier = cpuPersonaRef.current?.tier ?? 'medium';
          const kind = cpuKindRef.current;
          const outcome = recordCpuGame(won, tier, kind ? botIdForKind(kind) : BOT_PERSONAS[tier].id);
          const dayResult = isDraw ? 'draw' : won ? 'won' : 'lost';
          // The ladder (§7): only games against the next bot count (core ladderAfterGame).
          const clearedBefore = loadCpuProgression().ladderCleared;
          const ladderAfter = recordLadderGame(kind ? botIdForKind(kind) : BOT_PERSONAS[tier].id, won);
          // A rung just cleared (the 3rd win in a row) — the whole ladder when it was Webster.
          setLadderMoment(ladderAfter.ladderCleared > clearedBefore ? { cleared: ladderAfter.ladderCleared, final: ladderAfter.ladderCleared >= LADDER_BOTS.length } : null);
          // Bot of the Day: track the personal "beat today's bot" day-streak + today's result.
          if (kind === 'daily') {
            recordBotOfDay(won, getTodayUTC());
            recordBotOfDayResult(dayResult, getTodayUTC());
          }
          // FINISH_SPEC BE: the bot ladder + cast achievements (progression is per device).
          void unlockAchievements(me.id, botAchievements({ ladderCleared: ladderAfter.ladderCleared, botOfDayWins: loadCpuProgression().botOfDayWins ?? 0 }));
          // A bot stepped into the Daily Battle (§6): the local result key, never a
          // daily_results 'vs' row (People record and the VS leaderboard stay people-only).
          if (dailyVsActive) {
            writeBotDaily(getTodayUTC(), { result: dayResult, opponent: cpuPersonaRef.current?.name ?? 'Opal' });
            recordModePlayed('vs');
          }
          setCpuStreak(outcome.progression.streak);
          setCpuMilestone(outcome.milestone);
          setCpuUnlock(outcome.unlockedPersona);
          const talker = cpuPersonaRef.current?.botId;
          setCpuResultLine(talker && !isDraw ? botLine(talker, won ? 'bot_loss' : 'bot_win') : null);
          setCpuSession((s) => (won ? { ...s, wins: s.wins + 1 } : { ...s, losses: s.losses + 1 }));
          if (won) {
            const margin = Math.abs(data.playerTime - data.opponentTime);
            if (margin < 2000) setPhotoFinish('photo');
            else if (data.playerGuesses >= modeMaxGuesses) setPhotoFinish('clutch');
          }
          return;
        }
        // isDraw: a drawn VS counts the game without a loss (or a broken
        // win streak) — see recordGameResult / recordDailyVsResult.
        recordGameResult(me.id, mode, 'vs', won, data.playerGuesses, data.playerTime, seedRef.current, undefined, undefined, 0, undefined, undefined, isDraw)
          .then(xp => { if (xp) setXpResult(xp); });
        // Persist a match-history row so this VS battle shows in Recent Matches.
        // Exactly one client writes it (server flags player1 via recordMatch),
        // so there's a single shared row visible to both players.
        if (data.recordMatch && data.opponentId) {
          recordMatch({
            gameMode: mode,
            player1Id: me.id,
            player2Id: data.opponentId,
            winnerId: data.winner === 'player' ? me.id
              : data.winner === 'opponent' ? data.opponentId : undefined,
            player1Score: data.playerGuesses,
            player2Score: data.opponentGuesses,
            player1Time: Math.round(data.playerTime / 1000),
            player2Time: Math.round(data.opponentTime / 1000),
            seed: seedRef.current,
            solutions: data.solutions ?? [],
            player1Guesses: myGuessLogRef.current.map((g) => g.guess),
            player2Guesses: (data.opponentGuessLog ?? []).map((g) => g.guess),
            startedAt: new Date(Date.now() - data.playerTime).toISOString(),
            completedAt: new Date().toISOString(),
            forfeit: (data as any).forfeit === true,
          });
        }
        // Refresh the head-to-head line so the result screen shows the
        // UPDATED record including this match. Small delay gives the
        // single-writer client's `matches` insert time to land.
        if (data.opponentId) {
          const oppId = data.opponentId;
          setTimeout(() => {
            fetchHeadToHead(me.id, oppId).then(setHeadToHead).catch(() => {});
          }, 1200);
        }
      }
      // Freemium daily VS: lock the home-page VS tile for the rest of
      // the day. This replaces the old 2-per-day VS counter — the
      // freemium flow is now strictly one daily VS match, gated the
      // same way Classic/Quordle/etc. are.
      if (dailyVsActive) {
        recordModePlayed('vs');
      }
    });

    matchService.onRematchOffered(() => {
      // Free tier can't accept a rematch (Pro feature): decline immediately
      // instead of letting the Pro opponent stare at "Waiting…" for the full
      // 30s offer window while this side sees an upsell it can't act on.
      if (!isProRef.current && !isCpuRef.current) {
        matchService.declineRematch();
        return;
      }
      setRematchState('received');
    });

    matchService.onRematchDeclined(() => {
      setRematchState('declined');
    });

    matchService.onRematchStart((data) => {
      // Unlike the initial match there's no match-intro splash on a rematch, so
      // run a 3-2-1 "Rematch starting in" countdown before the board resets
      // (instead of snapping straight into a new game). The bot's engine is
      // delayed by the same 3s so pacing stays aligned.
      setRematchState('idle');
      setMatchResult(null);
      setPlayerStats(null);
      setCountdownIsRematch(true);
      startCountdown(3);
      // Same shared input-lock over the rematch countdown + GO beat.
      beginInputLock(3000 + 600);
      const start = Date.now() + 3000;
      setTimeout(() => {
        setServerSolutions(((data as any).solutions ?? []).map((w: string) => w.toUpperCase()));
        setSeed(data.seed);
        setStartTime(start);
        setPuzzleMetadata((data as any).puzzleMetadata);
        setScreen('match');
        setOpponentProgress({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
        setOpponentTiles({});
        setOpponentStage(0);
        resultRecordedRef.current = false;
        resetPerMatchState();
        setCountdownIsRematch(false);
      }, 3000);
    });

    matchService.onOpponentLeft(() => {
      // Only treat as a forfeit while actually mid-match or spectating; ignore
      // stray disconnects on the queue/result screens (don't boot home).
      if (screenRef.current !== 'match' && screenRef.current !== 'waiting') return;
      clearDisconnectGrace();
      setMessage('Opponent left the match');
      // The server follows a genuine leave with match_ended { forfeit: true }
      // awarding the win — hold for that result screen; only bail home if no
      // result ever lands (older server / dropped packet).
      setTimeout(() => {
        if (screenRef.current === 'result') return;
        window.location.href = '/';
      }, 4000);
    });

    // Opponent's socket dropped: run the server's reconnect-grace window as a
    // countdown banner. A resume clears it (opponent_reconnected); otherwise
    // the server ends the match itself via match_ended { forfeit: true }.
    matchService.onOpponentDisconnected((data) => {
      if (screenRef.current !== 'match' && screenRef.current !== 'waiting') return;
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      setDisconnectGrace(Math.max(0, Math.round(data.graceSeconds)));
      graceTimerRef.current = setInterval(() => {
        setDisconnectGrace((prev) => (prev === null || prev <= 0 ? prev : prev - 1));
      }, 1000);
    });

    matchService.onOpponentReconnected(() => {
      clearDisconnectGrace();
    });

    matchService.onError((data) => {
      setMessage(data.message);
    });

    // Skip queueing when a freemium user has already used their daily
    // VS — we're rendering the "already played" screen instead. Pro
    // users (and freemium who haven't played yet) join the queue
    // normally, passing the daily seed only when this is the daily flow.
    // Only auto-join for specific intents (daily VS / accepted invite). The
    // standard flow waits on the entry chooser and joins via handleQuickMatch.
    // Daily VS waits for the played-today gate (local OR server) to resolve —
    // the dedicated effect below joins once it says 'play'. Invite links and
    // other auto-join intents queue immediately as before.
    if (!alreadyPlayedDaily && autoJoin && !dailyVsActive) {
      matchService.joinQueue(mode, undefined, inviteCode);
    }

    return () => {
      matchService.disconnect();
      if (graceTimerRef.current) { clearInterval(graceTimerRef.current); graceTimerRef.current = null; }
      if (sharedLockTimerRef.current) { clearTimeout(sharedLockTimerRef.current); sharedLockTimerRef.current = null; }
    };
    // Connect ONCE per mount. Volatile values (profile, seed, daily flags) are
    // read via refs/stable closures inside the handlers, so the socket is never
    // torn down mid-match. Only matchService/presenceId (stable) and authGated
    // gate the effect — authGated flips at most once (guest → signed in, which
    // navigates through sign-in), never mid-match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchService, presenceId, session?.access_token, authGated]);

  // Daily VS: join the shared-seed queue only once the played-today gate says
  // 'play' (native parity — iOS awaits hasPlayedDailyVS before queueing, so a
  // daily finished on another device can't be replayed here).
  useEffect(() => {
    if (authGated || !dailyVsActive || dailyGate !== 'play' || alreadyPlayedDaily) return;
    // Re-derive at join time: a tab left open across midnight must queue with
    // TODAY'S seed, not the seed memoized at mount.
    const queueSeed = generateDailySeed(getTodayUTC(), 'DUEL_VS');
    matchService.joinQueue(mode, queueSeed, inviteCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyGate]);

  // Live clock while spectating the opponent finish their game.
  useEffect(() => {
    if (screen !== 'waiting') return;
    const tick = () => setWaitingClock(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [screen, startTime]);

  const handleBoardSolved = useCallback((boardIndex: number) => {
    matchService.reportBoardSolved(boardIndex);
    boardsSolvedRef.current += 1;
    setMyBoardsSolved((n) => n + 1);
    // Multi-board: pulling ahead of the bot gets a kind word from it.
    if (totalBoards > 1 && boardsSolvedRef.current === prevOppBoardsSolvedRef.current + 1) botSay('player_overtakes');
  }, [matchService, totalBoards, botSay]);

  const handleCompleted = useCallback((status: 'won' | 'lost', totalGuesses: number, timeMs: number) => {
    setPlayerStats({ guesses: totalGuesses, timeMs });
    setMyStatus(status);
    myCompletionRef.current = { status, guesses: totalGuesses, timeMs };
    // 'waiting' BEFORE reportCompletion: for a CPU, reportCompletion can end the
    // match synchronously (onMatchEnded → setScreen('result')); with both setState
    // calls batched, whichever runs LAST wins — so 'waiting' must come first or it
    // clobbers 'result' and strands the match on the spectator screen.
    setScreen('waiting');
    matchService.reportCompletion(status, totalGuesses, timeMs);
  }, [matchService]);

  const handleStageCompleted = useCallback((stageIndex: number) => {
    matchService.reportStageCompleted(stageIndex);
  }, [matchService]);

  // Final-state snapshot from the mode component (fired at game end, before
  // any reset) — feeds MY side of the result recap so hint rows/tiles show.
  const handleFinalBoard = useCallback((rows: EvaluatedRow[]) => {
    setMyFinalRows(rows);
  }, []);

  const handleGuessSubmitted = useCallback((guess: string, boardIndex: number) => {
    matchService.submitGuess(guess, boardIndex);
    // Mirror my own guess locally: word log for the result boards, tile
    // colors (via the seed-derived solution) for the tug-of-war bar.
    const entry = { boardIndex, guess: guess.toUpperCase() };
    myGuessLogRef.current = [...myGuessLogRef.current, entry];
    setMyGuessLog(myGuessLogRef.current);
    const solution = mySolutionsRef.current[boardIndex];
    if (solution) {
      try {
        const states = evaluateGuess(solution.toUpperCase(), guess.toUpperCase()).tiles.map((t: any) => t.state as string);
        setMyTiles(prev => ({ ...prev, [boardIndex]: [...(prev[boardIndex] || []), states] }));
        // One letter away: the bot cheers you on.
        const greens = states.filter((t) => t === 'CORRECT').length;
        if (states.length >= 4 && greens === states.length - 1) botSay('player_near_miss');
      } catch {
        // Length mismatch (shouldn't happen outside ProperNoundle) — skip greens.
      }
    }
  }, [matchService, botSay]);

  // Throttled typing relay: at most one ping per 1.5s while letters are
  // being entered in the current row.
  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    matchService.emitTyping();
  }, [matchService]);

  // Quick Match: join the live human matchmaking queue (deferred from mount so
  // the entry chooser can offer Bot Match / Invite first without silently
  // queuing the player).
  const handleQuickMatch = useCallback(() => {
    // Live VS outside the free daily Classic match is a Pro perk. The route
    // gate already turns free users away, so this only fires if some future
    // entry point mounts the chooser unguarded — cheap insurance, not a
    // second source of truth.
    if (!isPro && !dailyVsActive && !inviteCode) { router.push('/pro'); return; }
    const queueSeed = dailyVsActive ? generateDailySeed(getTodayUTC(), 'DUEL_VS') : undefined;
    matchService.joinQueue(mode, queueSeed, inviteCode);
    setMessage('');
    setScreen('queue');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchService, mode, dailyVsActive, inviteCode, isPro, router]);

  // Swap the live socket transport for a client-side CPU bot and start a match.
  // Pro-gated in the UI (non-Pro never reaches here).
  const startCpu = useCallback((kind: CpuKind, extra?: { ghost?: GhostRun; fixedSeed?: string }) => {
    const oppId = cpuOpponentIdForKind(kind);
    const id = cpuIdentity(oppId);
    cpuKindRef.current = kind;
    setCpuPersona({ tier: id.tier, name: id.name, avatar: id.avatar, color: id.color, botId: id.botId });
    cpuPersonaRef.current = { tier: id.tier, name: id.name, avatar: id.avatar, color: id.color, botId: id.botId };
    // The cast bot's own tier (Umi adaptive) and solve range (core BOT_CAST).
    const engineDifficulty: BotDifficulty = engineDifficultyForKind(kind);
    setCpuDifficulty(engineDifficulty);
    setShowCpuChooser(false);
    setMessage('');
    // The intro splash + countdown only render on the queue screen. The
    // entry-screen Bot Match chooser used to leave `screen` on 'entry', so
    // picking a difficulty just closed the chooser (read as "went back") and
    // the whole intro/countdown played invisibly — the match never appeared
    // to start. The queue-screen auto-offer path always worked because it was
    // already there.
    setScreen('queue');
    // Adaptive: shadow the player's recent form (higher CPU streak → tougher).
    const config: { opponentId: string; adaptive?: { winRate: number }; ghost?: GhostRun; fixedSeed?: string; guessRange?: readonly [number, number] | null } = { opponentId: oppId, guessRange: kind === 'ghost' ? null : guessRangeForKind(kind) };
    if (engineDifficulty === 'adaptive') config.adaptive = { winRate: Math.min(0.9, 0.4 + loadCpuProgression().streak * 0.05) };
    if (extra?.ghost) config.ghost = extra.ghost;
    if (extra?.fixedSeed) config.fixedSeed = extra.fixedSeed;
    matchService.swap(new LocalBotMatchService(engineDifficulty, config), { mode });
  }, [matchService, mode]);

  // Best recorded run for this mode → enables the "Beat Your Best" ghost.
  useEffect(() => {
    const me = profileRef.current;
    if (!isPro || !me) { setGhostChecked(true); return; }
    fetchBestGhostRun(me.id, mode).then(setGhostRun).catch(() => {}).finally(() => setGhostChecked(true));
  }, [isPro, mode]);

  // The run just played, in the shape the challenge API stores (§3/§4).
  const buildRun = useCallback((data: MatchEndedData | null): ChallengeRun => {
    const done = myCompletionRef.current;
    const solved = done?.status === 'won';
    const solutions = (data?.solutions?.length ? data.solutions : mySolutionsRef.current).map((w) => w.toUpperCase());
    return {
      solved,
      boardsSolved: solved ? totalBoards : Math.min(totalBoards, boardsSolvedRef.current),
      totalBoards,
      guesses: data?.playerGuesses ?? done?.guesses ?? myGuessLogRef.current.length,
      timeMs: Math.round(data?.playerTime ?? done?.timeMs ?? (startTime > 0 ? Date.now() - startTime : 0)),
      guessLog: myGuessLogRef.current.map((g) => g.guess),
      solutions,
    };
  }, [totalBoards, startTime]);

  // Finishing an async-challenge game. Send (§3): store the run and push the
  // friends — nothing is recorded to the challenger now. Race (§4): outcome =
  // core vsOutcome against the stored run (never the ghost's own winner), post
  // it (the server writes the shared matches row + the challenger's side),
  // then record OUR side through the normal live-VS path, with XP.
  const flowHandlersRef = useRef<((data: MatchEndedData) => Promise<void>) | null>(null);
  flowHandlersRef.current = async (data: MatchEndedData) => {
    const me = profileRef.current;
    const run = buildRun(data);
    setChallengeRun(run);
    if (flowRef.current === 'send') {
      const res = await sendChallenge({ gameMode: mode, seed: seedRef.current, run, friendIds: sendFriendIds, link: sendLink || sendFriendIds.length === 0 });
      setSendResult('code' in res ? { code: res.code, error: null } : { code: null, error: res.error });
      return;
    }
    const r = raceRef.current;
    if (!r || !me) return;
    const outcome = vsOutcome(run, r.run);
    setRaceOutcome(outcome);
    const res = await postRaceResult(r.code, run);
    if ('error' in res) {
      // §14: offline or a 5xx keeps the run for the next lobby load; the
      // result screen shows the locally computed outcome.
      if (isRetryableFailure(res.status)) {
        savePendingRace({ code: r.code, gameMode: mode, seed: seedRef.current || r.seed, run, savedAt: Date.now() });
        setRaceSavedOffline(true);
      } else setMessage(res.error);
      return;
    }
    if (!res.alreadyRecorded) {
      const xp = await recordGameResult(me.id, mode, 'vs', outcome === 'win', run.guesses, run.timeMs, seedRef.current, undefined, undefined, 0, undefined, undefined, outcome === 'draw');
      if (xp) setXpResult(xp);
    }
    fetchHeadToHead(me.id, r.challenger.id).then(setHeadToHead).catch(() => {});
  };

  // Entry points that start a game on arrival (no chooser): a bot from the
  // Bots page, the challenge-send game, or a friend's run to race.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (authGated || autoStartedRef.current) return;
    if (flow === 'race' && race) {
      autoStartedRef.current = true;
      setScreen('queue');
      matchService.swap(new LocalBotMatchService('medium', {
        fixedSeed: race.seed,
        opponentId: `${RACE_OPPONENT_PREFIX}${race.challenger.id}`,
        pace: { guesses: race.run.guesses, timeMs: race.run.timeMs, solved: race.run.solved },
      }), { mode });
      return;
    }
    if (flow === 'send') {
      autoStartedRef.current = true;
      setScreen('queue');
      matchService.swap(new LocalBotMatchService('medium', { fixedSeed: generateMatchSeed(), opponentId: SOLO_OPPONENT_ID, solo: true }), { mode });
      return;
    }
    if (!cpuParam) return;
    if (cpuParam === 'ghost') {
      if (!ghostChecked) return;
      autoStartedRef.current = true;
      if (ghostRun) startCpu('ghost', { ghost: ghostRun });
      else setScreen('entry'); // no best run to race yet
      return;
    }
    autoStartedRef.current = true;
    if (cpuParam === 'daily') startCpu('daily', { fixedSeed: generateDailySeed(getTodayUTC(), `${mode}_CPU`) });
    else startCpu(cpuParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authGated, ghostChecked, ghostRun]);

  // Live search step-in (§6): the Daily Battle gets the Bot of the Day character on the day's puzzle;
  // otherwise the ladder's next bot (Adapt once cleared). Private matches wait
  // for the friend, so no bot steps in there.
  const stepInKind: CpuKind | null = useMemo(
    // The Daily Battle's step-in is today's Bot of the Day character (as its own
    // kind, so it never counts as the Bot of the Day game itself).
    () => (inviteCode ? null : dailyVsActive ? castBotForKind('daily', getTodayUTC()) : ladderNextKind(loadCpuProgression().ladderCleared)),
    [inviteCode, dailyVsActive],
  );
  const stepInBot = useCallback(() => {
    if (!stepInKind) return;
    if (dailyVsActive) startCpu(stepInKind, { fixedSeed: generateDailySeed(getTodayUTC(), 'DUEL_VS') });
    else startCpu(stepInKind);
  }, [stepInKind, dailyVsActive, startCpu]);
  const liveSearch = screen === 'queue' && !isCpu && !flow && !cpuParam;
  const vsCounts = useVsCounts(liveSearch);

  // "Ping me when someone's looking" (§13): Pro, live random queue only (not
  // the Daily Battle, not a private match). Bound to
  // profiles.notification_prefs.vsLooking (missing = OFF), merged like the
  // Friends notification toggles.
  const [lookingSaving, setLookingSaving] = useState(false);
  const notificationPrefs = (profile as { notification_prefs?: Record<string, unknown> } | null)?.notification_prefs ?? {};
  const lookingOn = vsLookingOn(notificationPrefs);
  const toggleLooking = useCallback(async () => {
    if (lookingSaving || !profile) return;
    setLookingSaving(true);
    try {
      await (supabase as any).from('profiles').update({ notification_prefs: { ...notificationPrefs, vsLooking: !lookingOn } }).eq('id', profile.id);
      await refreshProfile();
    } finally {
      setLookingSaving(false);
    }
  }, [lookingSaving, profile, notificationPrefs, lookingOn, refreshProfile]);
  const lookingApplies = isPro && !dailyVsActive && !inviteCode;

  const handleCancel = useCallback(() => {
    matchService.leaveQueue();
    matchService.disconnect();
    // Client-side nav (not window.location.href) so home — and its footer —
    // renders instantly. A hard reload re-downloads + re-hydrates the whole
    // app, which is why the footer used to take a few seconds to reappear.
    router.push('/');
  }, [matchService, router]);

  const handleHome = useCallback(() => {
    matchService.disconnect();
    router.push('/');
  }, [matchService, router]);

  const handleRematch = useCallback(() => {
    // Freemium: no rematch allowed after the daily VS game. Show the
    // pro upsell modal instead of firing the rematch event.
    if (!isPro) {
      setVsLimitOpen(true);
      return;
    }
    setRematchState('offered');
    matchService.offerRematch();
  }, [matchService, isPro]);

  const handleDeclineRematch = useCallback(() => {
    matchService.declineRematch();
    setRematchState('declined');
  }, [matchService]);

  const handleForfeit = useCallback(async () => {
    // Forfeiting an IN-PROGRESS human match counts as a loss and (for daily
    // VS) consumes today's play — native parity: iOS/Android record their own
    // side before leaving. The web used to record NOTHING here, so the
    // forfeiter kept a clean record and could replay the daily VS. Leaving
    // from the 'waiting' spectator screen records NOTHING: that player
    // already finished (maybe even solved), so stamping a 0-guess loss over
    // their real game was wrong — and if the server's match_ended lands
    // before navigation it stays the single writer (no double record). CPU
    // practice records nothing (bot abandon is a pure teardown). Awaited so
    // the hard navigation below can't kill the in-flight writes.
    // A finished racer leaving the spectator screen: settle the race now (the
    // ghost's plan is fixed) so the result still posts, then show it.
    if (flow === 'race' && screen === 'waiting') { matchService.resolveNow(); return; }
    const me = profileRef.current;
    // Leaving a friend's race mid-game posts it as an unsolved run (a loss on
    // both sides, like a live forfeit); leaving the challenge-send game sends nothing.
    if (screen === 'match' && !resultRecordedRef.current && flow === 'race' && race && me) {
      resultRecordedRef.current = true;
      const run = { ...buildRun(null), solved: false };
      try {
        const res = await postRaceResult(race.code, run, true);
        if (!('error' in res) && !res.alreadyRecorded) {
          await recordGameResult(me.id, mode, 'vs', false, run.guesses, run.timeMs, seedRef.current);
        } else if ('error' in res && isRetryableFailure(res.status)) {
          // §14: offline — the pending list posts it (and records the loss) later.
          savePendingRace({ code: race.code, gameMode: mode, seed: seedRef.current || race.seed, run, savedAt: Date.now(), quit: true });
        }
      } catch { /* best effort — leaving anyway */ }
    }
    if (screen === 'match' && !resultRecordedRef.current && !isCpuRef.current && !flow && me) {
      resultRecordedRef.current = true;
      if (dailyVsActive) recordModePlayed('vs');
      const timeMs = startTime > 0 ? Math.max(0, Date.now() - startTime) : 0;
      try {
        await recordGameResult(me.id, mode, 'vs', false, 0, timeMs, seedRef.current);
      } catch { /* best effort — leaving anyway */ }
    }
    matchService.abandonMatch();
    matchService.disconnect();
    // AY: the Home button always lands on the Home root (a race used to land on /vs).
    window.location.href = '/';
  }, [matchService, screen, dailyVsActive, mode, startTime, flow, race, buildRun]);

  // Sign-in gate — mirrors the /vs lobby's guest gate. VS is account-based
  // (live opponents, recorded results); deep links (/classic/vs, invite
  // links) mount this component without passing through the lobby, so the
  // same gate must live here too. Rendered before anything can queue (the
  // socket effect above also early-returns while authGated).
  if (authGated) {
    return (
      <PageBackground tint="vs" scheme="light" className="h-screen-stable flex flex-col items-center justify-center relative px-5" style={{ ...VS_LIGHT_VARS, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full max-w-sm space-y-5">
          <VsScreenTitle mode={mode} />
          <VsCard>
            <div className="p-5 text-center space-y-3">
              <div className="text-[16px] font-black uppercase" style={{ color: VS.deep, letterSpacing: 0.4 }}>Sign in to play VS</div>
              <p className="text-[13px] font-bold" style={{ color: '#4b5563' }}>
                VS Battle pits you against a live opponent and records your results — it needs an account.
              </p>
              <CandyButton color="teal" size="lg" block onClick={exitGuest}>Sign in</CandyButton>
            </div>
          </VsCard>
          <div className="flex justify-center">
            <CandyButton color="peach" size="sm" onClick={() => router.push('/')} icon={<X className="w-3.5 h-3.5" aria-hidden="true" strokeWidth={3} />}>Cancel</CandyButton>
          </div>
        </div>
      </PageBackground>
    );
  }

  // "Already played today" screen — shown when a freemium user
  // revisits /practice/vs?daily=true after using their free daily VS
  // match. This mirrors how the home tile's "View Solved Puzzle" flow
  // works for Classic: instead of replaying, the user sees the answer
  // word plus a pro upsell and a reset countdown. Pro users never hit
  // this branch (dailyVsActive is false for them).
  if (alreadyPlayedDaily) {
    return (
      <DailyVsAlreadyPlayed
        answer={todayDailyAnswer}
        titleGradient={titleGradient}
        isPro={isPro}
        won={dailyWon}
      />
    );
  }

  // Queue screen
  // Countdown overlay — shown on the queue screen for the initial match, and on
  // the result screen for a rematch (relabeled). Kept as one element so both
  // reuse the exact styling.
  // Near-opaque vignette (same as the match-intro splash) — the queue screen's
  // "Match Found / Matching you with…" no longer bleeds through, and
  // intro → countdown reads as one continuous scene.
  const countdownOverlayEl = showCountdown ? (
    // VS polish §2: big 3-2-1-GO in the mode color (solid, no gradient text)
    // over the dimmed board. On the queue / result screens there is no board
    // yet, so the scrim is opaque — the search screen never bleeds through.
    // No fade-in on the ROOT: the intro splash unmounts the same frame this
    // mounts (the inner elements keep their entrances).
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      // AZ: a static scrim (no live blur under the animating countdown).
      style={{ background: screen === 'match' ? 'rgba(248,247,255,0.92)' : VS.page }}
    >
      <div className="text-center space-y-3">
        <div className="text-[12px] font-black uppercase animate-fade-in-scale" style={{ color: VS.label, letterSpacing: 1.4 }}>
          {countdownIsRematch ? 'Rematch starting in' : 'Match found'}
        </div>
        <div className="flex justify-center"><ModeChip mode={mode} /></div>
        {/* A2: the 3-2-1-GO in soft numbers. */}
        <SoftNum key={countdown} as="div" size={countdown === 0 ? 96 : 128} className="animate-fade-in-scale" style={{ lineHeight: 1.05 }}>
          {countdown === 0 ? 'GO!' : countdown}
        </SoftNum>
      </div>
    </div>
  ) : null;

  // Opponent-disconnect grace banner — rendered over the match and waiting
  // screens while the server holds the match open for a reconnect. When the
  // count hits 0 the server ends the match itself (match_ended, forfeit).
  const disconnectBannerEl = disconnectGrace !== null ? (
    <div className="absolute left-0 right-0 text-center z-40 pointer-events-none px-4" style={{ top: 'calc(env(safe-area-inset-top) + 56px)' }}>
      <span className="inline-block text-xs font-extrabold px-4 py-2 rounded-full animate-fade-in-up" style={{ background: '#fef3c7', color: '#92400e', boxShadow: '0 4px 14px rgba(146,64,14,0.12)' }}>
        {disconnectGrace > 0
          ? `Opponent lost connection — you win in ${disconnectGrace}s…`
          : 'Opponent lost connection — claiming your win…'}
      </span>
    </div>
  ) : null;

  // The bot picker (FINISH_SPEC D1): the ten cast bots in ladder order — each
  // its own character — with the ladder's progress marked (cleared ✓, NEXT).
  // Every bot is playable here, as every tier was in the old chooser (only
  // games against the NEXT bot count toward the ladder), then today's Bot of the
  // Day and Your Ghost (a faded version of your own letter tile). Pro-gated:
  // non-Pro sees an unlock CTA instead.
  const cpuChooserContent = () => {
    if (!isPro) {
      return (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-1 text-xs font-bold" style={{ color: VS.label }}>
            <Icon3D name="lock" size={17} /> Bot matches are a Pro feature
          </div>
          <CandyButton color="purple" size="md" block onClick={() => router.push('/pro')} icon={<Icon3D name="crown" size={18} />}>Unlock with Pro</CandyButton>
        </div>
      );
    }
    const cleared = Math.min(loadCpuProgression().ladderCleared, LADDER_BOTS.length);
    const today = botPersona(castBotForKind('daily', getTodayUTC()) ?? 'opal');
    const me = profile as { username?: string | null; avatar_emoji?: string | null; accent_color?: string | null } | null;
    return (
      <>
        <div className="grid grid-cols-5 gap-1.5" role="list" aria-label="The bot ladder">
          {LADDER_BOTS.map((id, i) => {
            const b = botPersona(id);
            // Ladder progress is shown, never enforced here (the old chooser offered every tier).
            const locked = false;
            const next = i === cleared;
            return (
              <button
                key={id}
                type="button"
                role="listitem"
                onClick={() => { if (!locked) startCpu(id); }}
                disabled={locked}
                aria-label={`${b.name}, rung ${b.rung}: ${b.line}${next ? ', next on the ladder' : i < cleared ? ', cleared' : ''}`}
                className="relative flex flex-col items-center gap-0.5 pt-1.5 pb-1 overflow-hidden"
                style={{ ...vsCard(locked ? '#94a3b8' : b.color, { selected: next, radius: 12, shadow: !locked }), cursor: locked ? 'default' : 'pointer' }}
              >
                <BotPoseAvatar id={id} pose="ready" accent={b.color} size={40} faded={locked} />
                {i < cleared && <span className="absolute top-1 right-0.5"><Icon3D name="badge-check" size={14} /></span>}
                {locked && <span className="absolute top-1 right-0.5"><Icon3D name="lock" size={12} /></span>}
                <span className="text-[10.5px] font-black truncate max-w-full" style={{ color: locked ? '#64748b' : VS.deep }}>{b.name}</span>
                <span className="text-[8.5px] font-extrabold uppercase" style={{ color: next ? darken(b.color, 0.35) : VS.label, letterSpacing: 0.3 }}>{next ? 'Next' : `Rung ${b.rung}`}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => startCpu('daily', { fixedSeed: generateDailySeed(getTodayUTC(), `${mode}_CPU`) })}
            className="flex items-center gap-2 px-2 py-2 text-left overflow-hidden"
            style={vsCard(today.color, { radius: 12 })}
          >
            {/* Today's bot, in another pose than its ladder tile (A7). */}
            <BotPoseAvatar id={today.id} pose="waiting" accent={today.color} size={34} />
            <span className="min-w-0">
              <span className="block text-[11.5px] font-black" style={{ color: VS.deep }}>Bot of the Day</span>
              <span className="block text-[10.5px] font-bold truncate" style={{ color: '#4b5563' }}>{today.name} · same puzzle for all</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => ghostRun && startCpu('ghost', { ghost: ghostRun })}
            disabled={!ghostRun}
            className="flex items-center gap-2 px-2 py-2 text-left overflow-hidden disabled:opacity-50"
            style={vsCard('#64748b', { radius: 12 })}
            title={ghostRun ? 'Race a replay of your best run' : 'Win this mode once to unlock'}
          >
            <GhostAvatar name={me?.username ?? 'You'} emoji={me?.avatar_emoji} accent={me?.accent_color} size={32} />
            <span className="min-w-0">
              <span className="block text-[11.5px] font-black" style={{ color: VS.deep }}>Your Ghost</span>
              <span className="block text-[10.5px] font-bold truncate" style={{ color: '#4b5563' }}>{ghostRun ? 'Beat your best run' : 'Win this mode once'}</span>
            </span>
          </button>
        </div>
        <p className="text-center text-[10.5px] font-bold" style={{ color: VS.label }}>Practice only — doesn’t affect your ranked stats</p>
      </>
    );
  };

  // Entry chooser — the first thing you see when you tap a VS mode: pick Quick
  // Match (live queue), Bot Match (CPU practice), or Invite a Friend (private
  // match). Replaces the old flow that silently queued AND offered the CPU at
  // the same time.
  if (screen === 'entry') {
    // A tinted card per way to play (A1), each with a character in its pose.
    const entryRow = (opts: { onClick: () => void; art: string; accent: string; title: string; sub: string; locked?: boolean }) => (
      <button
        type="button"
        onClick={opts.onClick}
        className="w-full flex flex-col text-left overflow-hidden"
        style={vsCard(opts.accent, { radius: 16 })}
      >
        <CardBar accent={opts.accent} />
        <span className="w-full flex items-center gap-3 px-3.5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={opts.art} alt="" aria-hidden="true" width={52} height={52} loading="lazy" draggable={false} className="shrink-0" style={{ width: 52, height: 52, objectFit: 'contain', filter: 'drop-shadow(0 3px 5px rgba(59,26,120,0.18))' }} />
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1.5 text-[15px] font-black uppercase" style={{ color: VS.deep, letterSpacing: 0.3 }}>
              {opts.title} {opts.locked && <Icon3D name="lock" size={17} />}
            </span>
            <span className="block text-[12px] font-bold" style={{ color: '#4b5563' }}>{opts.sub}</span>
          </span>
        </span>
      </button>
    );
    const nextBot = castBotForKind(ladderNextKind(loadCpuProgression().ladderCleared)) ?? 'opal';
    return (
      <PageBackground tint="vs" scheme="light" className="h-screen-stable flex flex-col items-center justify-center relative px-5 overflow-y-auto" style={{ ...VS_LIGHT_VARS, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <VsLimitModal open={vsLimitOpen} onClose={() => { setVsLimitOpen(false); router.push('/'); }} />
        <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
        <div className="w-full max-w-sm space-y-5 py-6">
          <VsScreenTitle mode={mode} />

          {!showCpuChooser ? (
            <div className="space-y-2.5">
              {entryRow({
                onClick: handleQuickMatch,
                art: poseSrc('c', 'telescope'),
                accent: VS_ACCENT,
                title: 'Quick Match',
                sub: 'Get matched with a live opponent',
              })}
              {entryRow({
                onClick: () => (isPro ? setShowCpuChooser(true) : router.push('/pro')),
                art: botPersona(nextBot).avatar,
                accent: botPersona(nextBot).color,
                title: 'Bot Match',
                sub: 'Play the cast, from Rip to Webster',
                locked: !isPro,
              })}
              {/* Invite a Friend — this MINTS an invite code, which is the
                  "private matches" bullet /pro sells, so it locks like Bot
                  Match. Accepting someone else's invite stays free (native
                  does the same); only creating one is the perk. */}
              {entryRow({
                onClick: () => (isPro ? setShowInvite(true) : router.push('/pro')),
                art: poseSrc('o1', 'hug'),
                accent: '#7c3aed',
                title: 'Invite a Friend',
                sub: 'Send a private match link or @username',
                locked: !isPro,
              })}

              <div className="flex justify-center pt-1">
                <CandyButton color="peach" size="sm" onClick={() => router.push('/')} icon={<X className="w-3.5 h-3.5" aria-hidden="true" strokeWidth={3} />}>Cancel</CandyButton>
              </div>
            </div>
          ) : (
            /* Bot Match → the cast picker */
            <VsCard>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-1 text-[13px] font-black uppercase" style={{ color: VS.deep, letterSpacing: 0.4 }}>
                  <HeaderBack kind="back" onClick={() => setShowCpuChooser(false)} size={32} />
                  Choose your opponent
                </div>
                {cpuChooserContent()}
              </div>
            </VsCard>
          )}
        </div>
      </PageBackground>
    );
  }

  if (screen === 'queue') {
    const cpuBotId = isCpu ? cpuPersona?.botId ?? null : null;
    const cpuIsGhost = cpuBotId === 'ghost';
    const cpuRoster = cpuBotId && !cpuIsGhost ? botRosterEntry(cpuBotId) : null;
    return (
      <PageBackground tint="vs" scheme="light" className="h-screen-stable flex flex-col items-center justify-center relative overflow-y-auto" style={{ ...VS_LIGHT_VARS, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <VsLimitModal open={vsLimitOpen} onClose={() => { setVsLimitOpen(false); window.location.href = '/'; }} />
        {/* Match-intro splash — sits above the countdown for 2.5s (or until tapped). */}
        {showIntro && (
          <MatchIntro
            me={{
              username: profile?.username || 'You',
              avatarUrl: (profile as any)?.avatar_url ?? null,
              level: (profile as any)?.level ?? null,
              emoji: (profile as any)?.avatar_emoji ?? null,
              accent: (profile as any)?.accent_color ?? null,
            }}
            // A cast bot shows its own character in its 'ready' pose (D3); Your
            // Ghost is a faded version of your own letter tile; people their avatar.
            opponent={opponentUserId ? (isCpu ? {
              username: opponentInfo?.username ?? cpuPersona?.name ?? 'Bot',
              avatarUrl: null,
              level: null,
              botId: cpuIsGhost ? undefined : cpuBotId ?? undefined,
              ghost: cpuIsGhost,
              ghostName: profile?.username || 'You',
              emoji: cpuIsGhost ? (profile as any)?.avatar_emoji ?? null : null,
              accent: cpuIsGhost ? (profile as any)?.accent_color ?? null : null,
              tag: cpuIsGhost ? 'Your best run' : cpuRoster ? `${cpuRoster.tier} · ${cpuRoster.line}` : undefined,
            } : {
              username: opponentInfo?.username ?? '…',
              avatarUrl: opponentInfo?.avatarUrl ?? null,
              level: flow ? null : (opponentInfo?.level ?? null),
            }) : null}
            headToHead={headToHead}
            mode={mode}
            onDone={() => { setShowIntro(false); startCountdown(pendingCountdownRef.current); }}
          />
        )}
        {/* Countdown overlay */}
        {countdownOverlayEl}

        {liveSearch ? (
          <VsQueueScreen
            modeName={modeTitle(mode)}
            othersWaiting={vsCounts ? Math.max(0, (vsCounts[mode] ?? 0) - 1) : null}
            // The step-in bot waits in its own 'waiting' pose (D3).
            stepIn={stepInKind ? (() => { const id = cpuIdentity(cpuOpponentIdForKind(stepInKind)); return { name: id.name, botId: id.botId, color: id.color }; })() : null}
            searching={!showIntro && !showCountdown && !opponentUserId}
            onPlayBot={stepInBot}
            onCancel={handleCancel}
            looking={lookingApplies ? {
              label: lookingRowLabel(mode),
              on: lookingOn,
              saving: lookingSaving,
              onToggle: () => { void toggleLooking(); },
              ping: () => pingVsLooking(mode),
            } : undefined}
          >
            {inviteCode && !isCpu && (
              <VsCard className="w-full max-w-xs mx-auto">
              <div className="p-4 space-y-2">
                <div className="text-[11px] font-black uppercase" style={{ color: VS.label, letterSpacing: 1.2 }}>
                  Private match
                </div>
                <SoftNum size={30} as="div" style={{ letterSpacing: 6 }}>{inviteCode}</SoftNum>
                <p className="text-xs font-bold" style={{ color: '#4b5563' }}>
                  Share this code — the match starts when your friend joins.
                </p>
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/vs/join/${inviteCode}`;
                    const text = `Join my Wordocious VS match — code ${inviteCode}`;
                    if ('share' in navigator) {
                      try { await (navigator as any).share({ title: 'Wordocious VS', text, url }); return; } catch {}
                    }
                    try { await navigator.clipboard.writeText(url); setMessage('Invite link copied'); } catch {}
                  }}
                  className="candy candy-teal candy-md candy-block"
                >
                  <span className="candy-label">Share invite</span>
                </button>
              </div>
              </VsCard>
            )}

          </VsQueueScreen>
        ) : (
          <VsStartingScreen
            mode={mode}
            title={flow === 'race' ? `RACE @${(race?.challenger.username ?? '').toUpperCase()}’S RUN` : flow === 'send' ? 'YOUR RUN' : `${cpuPersona?.name ?? 'Your bot'} is ready`}
            sub={flow === 'send' ? sendPanelLine(sendFriendIds.length, sendLink) : flow === 'race' ? 'Same puzzle. Their pace plays out beside you.' : cpuRoster ? `${cpuRoster.tier} · ${cpuRoster.line}` : undefined}
            // The bot steps up in its 'waiting' pose (the intro then shows 'ready');
            // Your Ghost is your own letter tile, faded.
            figure={cpuBotId && !flow ? (cpuIsGhost
              ? <GhostAvatar name={profile?.username || 'You'} emoji={(profile as any)?.avatar_emoji ?? null} accent={(profile as any)?.accent_color ?? null} size={84} />
              : <BotFigure id={cpuBotId} pose="waiting" size={120} />) : undefined}
          />
        )}

        {message && <VsToast text={message} />}
      </PageBackground>
    );
  }

  // Async challenge results, in the home palette (§3 CHALLENGE SENT, §5 race result).
  if (screen === 'result' && flow === 'send' && challengeRun) {
    const shareLink = async () => {
      if (!sendResult?.code) return;
      const url = `https://wordocious.com/vs/challenge/${sendResult.code}`;
      const text = challengeShareText(mode, sendResult.code);
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try { await (navigator as any).share({ title: 'Wordocious VS', text, url }); return; } catch { /* fall back to copy */ }
      }
      try { await navigator.clipboard.writeText(`${text}\n${url}`); setMessage('Link copied'); } catch { /* nothing to do */ }
    };
    return (
      <>
        {sendResult ? (
          <ChallengeSent
            mode={mode}
            run={challengeRun}
            guessLog={challengeRun.guessLog}
            solutions={challengeRun.solutions}
            code={sendResult.code}
            link={sendLink || sendFriendIds.length === 0}
            error={sendResult.error}
            onShare={shareLink}
            onHome={() => { matchService.disconnect(); router.push('/vs'); }}
          />
        ) : (
          <PageBackground tint="vs" scheme="light" className="h-screen-stable flex items-center justify-center" style={VS_LIGHT_VARS}>
            <VsStartingScreen mode={mode} title="SENDING YOUR RUN" />
          </PageBackground>
        )}
        {message && <VsToast text={message} />}
      </>
    );
  }
  if (screen === 'result' && flow === 'race' && race && challengeRun && raceOutcome) {
    const share = async () => {
      // FINISH_SPEC S4: the shared fun copy.
      const day = new Date().toISOString().slice(0, 10);
      const text = shareCaption(raceOutcome === 'draw' ? 'vsDraw' : raceOutcome === 'win' ? 'vsWin' : 'vsLose', { date: day, game: modeTitle(mode), opp: race.challenger.username });
      const payload = `${text}\nwordocious.com`;
      if (typeof navigator !== 'undefined' && navigator.share) navigator.share({ text: payload }).catch(() => {});
      else navigator.clipboard?.writeText(payload).then(() => setMessage('Copied to clipboard!')).catch(() => {});
    };
    return (
      <>
        {raceOutcome === 'win' && <Confetti />}
        <ChallengeResult
          mode={mode}
          outcome={raceOutcome}
          me={{ run: challengeRun, guessLog: challengeRun.guessLog }}
          them={{ run: race.run, guessLog: race.run.guessLog, name: race.challenger.username, avatarUrl: race.challenger.avatarUrl }}
          solutions={race.run.solutions.length ? race.run.solutions : challengeRun.solutions}
          h2h={headToHead}
          xp={xpResult?.xpGain ?? null}
          note={raceSavedOffline ? PENDING_RACE_SAVED_LINE : null}
          onClose={() => { matchService.disconnect(); router.push('/vs'); }}
          onHome={() => { matchService.disconnect(); router.push('/vs'); }}
          onChallengeBack={() => { matchService.disconnect(); router.push(isPro ? `/vs/friend?mode=${mode}&friend=${race.challenger.id}` : '/pro'); }}
          onShare={share}
        />
        {message && <VsToast text={message} />}
      </>
    );
  }

  // Result screen
  if (screen === 'result') {
    const winner = matchResult?.winner;
    const isWin = winner === 'player';
    const isDraw = winner === 'draw';
    const myName = profile?.username || 'You';
    const oppName = opponentInfo?.username || 'Opponent';

    // Solve status decides most matches (solving beats score), so spell it out —
    // the loser often has "better" numbers, which reads as a mistake otherwise.
    const mySolved = myStatus === 'won';
    const oppSolved = logSolved(matchResult?.opponentGuessLog ?? [], matchResult?.solutions ?? []);
    // Forfeit (opponent left / disconnected past grace / idled out) is its own
    // story — "Both solved — you won on score" was flatly wrong there.
    const isForfeit = matchResult?.forfeit === true;
    const whyLine = isForfeit
      ? (isWin ? `${oppName} left the match — you win by forfeit` : 'Match forfeited')
      : isDraw
      ? 'Dead even — identical scores'
      : isWin
        ? (mySolved && !oppSolved ? `You solved it — ${oppName} didn’t` : `${mySolved ? 'Both solved' : 'Neither solved'} — you won on score`)
        : (oppSolved && !mySolved ? `${oppName} solved it — you didn’t` : `${oppSolved ? 'Both solved' : 'Neither solved'} — ${oppName} won on score`);

    // The deciding margin (core vsMargin), shown only when the core rule agrees
    // with the server's verdict (a forfeit or a partial log can differ).
    const outcome: 'win' | 'loss' | 'draw' = isWin ? 'win' : isDraw ? 'draw' : 'loss';
    const myRun = { solved: mySolved, boardsSolved: mySolved ? totalBoards : myBoardsSolved, guesses: matchResult?.playerGuesses ?? 0, timeMs: matchResult?.playerTime ?? 0 };
    const oppRun = { solved: oppSolved, boardsSolved: oppSolved ? totalBoards : Math.min(totalBoards, opponentProgress.boardsSolved), guesses: matchResult?.opponentGuesses ?? 0, timeMs: matchResult?.opponentTime ?? 0 };
    const margin = isForfeit ? 'BY FORFEIT' : matchResult && vsOutcome(myRun, oppRun) === outcome ? vsMargin(myRun, oppRun) : null;
    const resultSub = [modeTitle(mode).toUpperCase(), margin].filter(Boolean).join(' · ');

    const handleShare = async () => {
      // FINISH_SPEC S4: the shared fun copy (core shareCaption), only used when no image can be sent.
      const day = new Date().toISOString().slice(0, 10);
      const text = shareCaption(isDraw ? 'vsDraw' : isWin ? 'vsWin' : 'vsLose', { date: day, game: modeTitle(mode), opp: oppName });
      const payload = `${text}\nwordocious.com`;

      // Render the VS share card (same aesthetic as the daily cards) and share
      // it as an image when the platform supports file sharing; text fallback.
      if (matchResult) {
        try {
          const solutions = matchResult.solutions ?? [];
          // Loaded on the Share tap, not with the match (founder, 2026-09-29).
          const { generateVsShareImage, logToGrids } = await import('@/lib/vs-share-image');
          const blob = await generateVsShareImage({
            modeLabel: `VS ${label}`,
            isWin,
            isDraw,
            me: {
              name: myName, score: matchResult.playerScore ?? matchResult.playerGuesses,
              won: isWin, solved: mySolved, grids: logToGrids(myGuessLog, solutions),
            },
            opponent: {
              name: oppName, score: matchResult.opponentScore ?? matchResult.opponentGuesses,
              won: !isWin && !isDraw, solved: oppSolved,
              grids: logToGrids(matchResult.opponentGuessLog ?? [], solutions),
            },
          });
          if (blob) {
            // S1: the IMAGE ONLY (no text, no link) so it never becomes a link-preview card.
            const file = new File([blob], `Wordocious-VS-${modeTitle(mode).replace(/[^A-Za-z0-9]+/g, '')}.png`, { type: 'image/png' });
            if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
              await navigator.share({ files: [file] });
              return;
            }
          }
        } catch { /* fall through to text share */ }
      }

      if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({ text: payload }).catch(() => {});
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(payload).then(() => {
          setMessage('Copied to clipboard!');
          setTimeout(() => setMessage(''), 2000);
        }).catch(() => {});
      }
    };

    // D3: a cast bot reacts in character — its 'victory' pose when it won,
    // 'goodgame' when it lost (or drew) — with a kind line in its own voice.
    // People and Your Ghost keep the result host (S win / R loss / U draw).
    const resultBotId = isCpu && cpuPersona && isBotCastId(cpuPersona.botId) ? cpuPersona.botId : null;
    const isGhostOpp = isCpu && cpuPersona?.botId === 'ghost';
    const meTile = { name: myName, emoji: (profile as any)?.avatar_emoji ?? null, accent: (profile as any)?.accent_color ?? null };
    return (
      <PageBackground tint="vs" scheme="light" className="h-screen-stable overflow-y-auto relative" style={{ ...VS_LIGHT_VARS, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Rematch countdown plays over the result screen before the new game. */}
        {countdownOverlayEl}
        {/* Photo-finish flourish (CPU close/last-guess win) — plays FIRST and is
            visually distinct from the win confetti; confetti follows once it
            dismisses so the two never overlap. */}
        {photoFinish && <PhotoFinish kind={photoFinish} onDone={() => setPhotoFinish(null)} />}
        {/* Confetti for wins only (held back while the photo-finish plays) */}
        {isWin && !photoFinish && <Confetti />}
        {/* Rematch upsell for freemium — handleRematch sets this open */}
        <VsLimitModal open={vsLimitOpen} onClose={() => setVsLimitOpen(false)} />
        <div className="max-w-md w-full mx-auto px-4 py-3 space-y-3.5">
          {/* Top bar — close (home) + wordmark, as on the challenge result. */}
          <div className="relative flex items-center justify-center" style={{ minHeight: 44 }}>
            <HeaderBack kind="close" onClick={handleHome} className="absolute left-0" />
            <span className="font-black" style={{ fontSize: 20, backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)', ...GRADIENT_TEXT }}>
              WORDOCIOUS
            </span>
          </div>

          {/* The ladder-cleared celebration when this game cleared the final rung. */}
          {matchResult && ladderMoment?.final && (
            <div className="flex flex-col items-center gap-1 animate-fade-in-scale">
              <ArtScene scene="ladder-cleared" height={170} maxWidthPct={70} />
              <p className="flex items-center gap-1.5 text-[15px] font-black uppercase" style={{ color: '#4c1d95', letterSpacing: 0.5 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={medalSrc('trophy')} alt="" aria-hidden="true" width={28} height={28} style={{ width: 28, height: 28 }} /> Ladder cleared!
              </p>
            </div>
          )}
          {matchResult && ladderMoment && !ladderMoment.final && (
            <p className="flex items-baseline justify-center gap-1 text-[13px] font-black uppercase" style={{ color: VS.ink, letterSpacing: 0.4 }}>
              Rung cleared! <SoftNum size={18}>{ladderMoment.cleared}/{LADDER_BOTS.length}</SoftNum> on the ladder
            </p>
          )}
          {matchResult && (resultBotId ? (
            <div className="flex items-center justify-center gap-2 animate-fade-in-up" style={{ marginBottom: -4 }}>
              <BotFigure id={resultBotId} pose={outcome === 'loss' ? 'victory' : 'goodgame'} size={96} />
              {cpuResultLine && <BotSpeech text={cpuResultLine} accent={cpuPersona?.color ?? VS_ACCENT} />}
            </div>
          ) : (
            /* The result host: S pops on a win, R on a loss, U on a draw. */
            <ResultHost id={vsResultHost(outcome)} pop={outcome === 'win'} />
          ))}
          {/* The one-window result (home palette). */}
          {matchResult && (
            <VsResultWindow
              modeIcon={<VsModeIcon mode={mode} size={14} />}
              sub={resultSub}
              why={whyLine}
              outcome={outcome}
              me={{ name: myName, avatarUrl: (profile as any)?.avatar_url ?? null, accent: meTile.accent, score: matchResult.playerScore ?? matchResult.playerGuesses, guesses: matchResult.playerGuesses, timeMs: matchResult.playerTime, solved: mySolved }}
              opponent={{ name: oppName, avatarUrl: isGhostOpp ? null : opponentInfo?.avatarUrl ?? null, isBot: isCpu, ghost: isGhostOpp ? meTile : undefined, score: matchResult.opponentScore ?? matchResult.opponentGuesses, guesses: matchResult.opponentGuesses, timeMs: matchResult.opponentTime, solved: oppSolved }}
            />
          )}
          {matchResult && (
            <p className="text-center text-[10.5px] font-bold" style={{ color: VS.label }}>
              Score = guesses + time (1 pt per 45s) · lowest score wins — but solving always beats not solving
            </p>
          )}

          {/* Updated all-time head-to-head (refetched after the match was recorded) */}
          {opponentUserId && headToHead && !isCpu && (
            <VsCard accent="#7c3aed">
              <div className="flex items-center gap-3 p-3">
                <InitialAvatar name={oppName} url={opponentInfo?.avatarUrl ?? null} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black uppercase truncate" style={{ color: VS.label, letterSpacing: 0.8 }}>You and {oppName}</div>
                  <div className="text-[14px] font-black" style={{ color: '#4c1d95' }}>{headToHeadLine(oppName, headToHead)}</div>
                </div>
              </div>
            </VsCard>
          )}

          {/* Rematch offer — a tinted card, teal Accept / peach Decline. */}
          {rematchState === 'received' && (
            <VsCard accent="#7c3aed" className="animate-fade-in-up">
              <div className="p-4 text-center space-y-3">
                <p className="text-[14px] font-black uppercase" style={{ color: '#4c1d95', letterSpacing: 0.4 }}>{oppName} wants a rematch!</p>
                <div className="flex gap-2.5">
                  <CandyButton color="peach" size="md" className="flex-1" onClick={handleDeclineRematch}>Decline</CandyButton>
                  <CandyButton color="teal" size="md" className="flex-1" icon="replay" onClick={handleRematch}>Accept</CandyButton>
                </div>
              </div>
            </VsCard>
          )}

          {/* Actions (A8 candy): teal REMATCH / RUN IT BACK, peach HOME + SHARE. */}
          <div className="space-y-2.5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {rematchState === 'declined' ? (
              <div className="w-full py-3 text-[14px] font-black uppercase flex items-center justify-center gap-2" style={{ ...vsCard('#64748b', { radius: 999, shadow: false }), color: '#475569' }}>
                <X className="w-4 h-4" aria-hidden="true" /> No rematch
              </div>
            ) : rematchState === 'offered' ? (
              <CandyButton color="teal" size="lg" block disabled icon={<Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}>Waiting…</CandyButton>
            ) : rematchState !== 'received' ? (
              /* Honest label: for free users the tap opens the Pro upsell,
                 not a rematch — say so instead of a bait "Rematch". */
              <CandyButton
                color={isCpu || isPro ? 'teal' : 'purple'}
                size="lg"
                block
                onClick={handleRematch}
                icon={isCpu || isPro ? 'replay' : <Icon3D name="lock" size={20} />}
              >
                {isCpu ? (resultBotId ? `Run it back vs ${cpuPersona?.name}` : 'Run it back') : isPro ? 'Rematch' : 'Rematch — Pro'}
              </CandyButton>
            ) : null}
            <div className="flex gap-2.5">
              <CandyButton color="peach" size="md" className="flex-1" onClick={handleHome} icon={<Icon3D name="tab-home" size={18} />}>Home</CandyButton>
              <CandyButton color="peach" size="md" className="flex-1" onClick={handleShare} icon={<Icon3D name="share" size={18} />}>Share</CandyButton>
            </div>
          </div>

          {/* Bot game: session tally, streak / unlocks and the record note — below the window. */}
          {isCpu && (
            <div className="text-center space-y-1">
              {(cpuSession.wins + cpuSession.losses) > 0 && (
                <p className="flex items-baseline justify-center gap-1 text-[12px] font-black uppercase" style={{ color: '#4c1d95', letterSpacing: 0.4 }}>
                  This session — You <SoftNum size={17}>{cpuSession.wins}</SoftNum> · Bots <SoftNum size={17}>{cpuSession.losses}</SoftNum>
                </p>
              )}
              {cpuMilestone ? (
                // STREAK! lettering over the milestone (docs/ART_SPEC.md §6).
                <div className="flex flex-col items-center gap-0.5">
                  <MomentArt moment="streak" as="div" level={2} maxHeight={56} widthPct={60} />
                  <p className="flex items-baseline gap-1 text-[13px] font-black" style={{ color: '#b45309' }}><SoftNum size={20}>{cpuMilestone}</SoftNum>-win bot streak</p>
                </div>
              ) : cpuStreak > 0 ? (
                <p className="flex items-center justify-center gap-1 text-[11.5px] font-extrabold" style={{ color: VS.label }}>
                  <Icon3D name="flame" size={16} /> Bot win streak: <SoftNum size={15}>{cpuStreak}</SoftNum>
                </p>
              ) : null}
              {cpuUnlock && (
                // The badge of the bot you just beat (cpu-progression: a cast id).
                <p className="flex items-center justify-center gap-1 text-[12px] font-black" style={{ color: darken(botPersona(cpuUnlock).color, 0.3) }}>
                  <Icon3D name="badge-check" size={18} /> Unlocked {botPersona(cpuUnlock).name}’s badge!
                </p>
              )}
              <p className="text-[11px] font-bold" style={{ color: VS.label }}>Bot game — counts in your Bots record, not People</p>
            </div>
          )}

          {/* Final boards with letters — opponent's reconstructed from the
              match-end guess log + solutions */}
          {(matchResult?.solutions?.length ?? 0) > 0 && (
            <FinalBoards
              myName={myName}
              opponentName={oppName}
              myGuessLog={myGuessLog}
              opponentGuessLog={matchResult?.opponentGuessLog ?? []}
              solutions={matchResult?.solutions ?? []}
              mode={mode}
              seed={seed}
              myTimeMs={matchResult?.playerTime ?? 0}
              opponentTimeMs={matchResult?.opponentTime ?? 0}
              answerDisplay={puzzleMetadata?.display}
              myFinalRows={myFinalRows ?? undefined}
            />
          )}
        </div>

        {message && <VsToast text={message} />}
      </PageBackground>
    );
  }

  // Spectator waiting screen — you finished; watch the opponent's live
  // board (colors only, letters stay hidden until match end).
  if (screen === 'waiting') {
    const oppName = opponentInfo?.username || 'Opponent';
    const liveTotalBoards = opponentProgress.totalBoards || totalBoards;
    const oppRowsUsed = Math.max(0, ...Object.values(opponentTiles).map((rows) => rows.length));
    // Full static frame from the start (no row-by-row growth); the min() cap
    // only matters for Gauntlet, whose 50-guess TOTAL budget would otherwise
    // blow up the layout — its frame grows past 6 only when a board does.
    const spectatorRows = Math.min(modeMaxGuesses, Math.max(VS_MODE_FRAME_ROWS[mode] || 6, oppRowsUsed));
    // ProperNoundle's answer length varies per puzzle (MODE_WORD_LEN says 5) —
    // size the frame columns to the real answer so opponent rows aren't cut off.
    const specWordLen = mode === GameMode.PROPERNOUNDLE ? (puzzleMetadata?.answerLength || wordLen) : wordLen;
    const clockStr = clockOf(waitingClock);
    const myNameForGhost = profile?.username || 'You';

    // STAKES copy. The real win rule is: solve, then tie-break on
    // boardsSolved, then composite score = guesses + timeSeconds/45.
    // We approximate the composite by guess count: the opponent is still
    // playing, so they're almost always behind you on time and need
    // strictly FEWER guesses; if they're somehow still ahead of your
    // clock, matching your guess count could win on time.
    const stakes = (() => {
      if (!playerStats) return '';
      const boardsLeft = liveTotalBoards - opponentProgress.boardsSolved;
      if (myStatus === 'lost') {
        return liveTotalBoards > 1
          ? `${oppName} needs ${boardsLeft} more board${boardsLeft === 1 ? '' : 's'} to win`
          : `${oppName} just needs to solve to win`;
      }
      if (liveTotalBoards > 1 && boardsLeft > 1) {
        return `${oppName} needs ${boardsLeft} more boards to stay alive`;
      }
      const opponentTimeBehind = Date.now() - startTime > playerStats.timeMs;
      const target = opponentTimeBehind ? playerStats.guesses - 1 : playerStats.guesses;
      if (target <= 0 || opponentProgress.attempts >= target) {
        return `${oppName} can no longer beat your score!`;
      }
      return `${oppName} must solve in ${target} or fewer to beat you`;
    })();

    // CPU only: once the bot can no longer beat you, offer to end now instead of
    // watching its timer run down (mirrors the win-locked branch of `stakes`).
    const cpuWinLocked = (isCpu || flow === 'race') && !!playerStats && myStatus !== 'lost' && (() => {
      const boardsLeft = liveTotalBoards - opponentProgress.boardsSolved;
      if (liveTotalBoards > 1 && boardsLeft > 1) return false;
      const opponentTimeBehind = Date.now() - startTime > playerStats.timeMs;
      const target = opponentTimeBehind ? playerStats.guesses - 1 : playerStats.guesses;
      return target <= 0 || opponentProgress.attempts >= target;
    })();

    // The challenge-send game has nobody to watch — its result follows at once.
    if (opponentUserId === SOLO_OPPONENT_ID) {
      return (
        <PageBackground tint="vs" scheme="light" className="h-screen-stable flex items-center justify-center" style={VS_LIGHT_VARS}>
          <VsStartingScreen mode={mode} title="SENDING YOUR RUN" />
        </PageBackground>
      );
    }

    // Their live boards, laid out for the mode. Gauntlet shows the stage the
    // opponent is on (its board indices restart every stage).
    const gStage = mode === GameMode.GAUNTLET ? GAUNTLET_STAGES[Math.min(opponentStage, GAUNTLET_STAGES.length - 1)] : null;
    const liveIndices = Array.from({ length: gStage ? gStage.boardCount : liveTotalBoards }, (_, i) => i);
    const liveRows = gStage ? Math.max(gStage.maxGuesses, oppRowsUsed) : spectatorRows;
    const solvedLive = new Set(
      Object.entries(opponentTiles)
        .filter(([, rows]) => rows.some((r) => r.length > 0 && r.every((t) => t === 'CORRECT')))
        .map(([k]) => Number(k)),
    );
    const progressLine = [
      `${opponentProgress.attempts} ${opponentProgress.attempts === 1 ? 'guess' : 'guesses'}`,
      clockStr,
      gStage ? `Stage ${opponentStage + 1}/5` : liveTotalBoards > 1 ? `${opponentProgress.boardsSolved}/${liveTotalBoards} boards` : null,
    ].filter(Boolean).join(' · ');
    const myBoardsLine = myStatus === 'won' ? totalBoards : Math.min(totalBoards, myBoardsSolved);

    // Who is still playing: a cast bot in its 'waiting' pose (D3), Your Ghost
    // as your own faded letter tile, a person (or a friend's run) as their avatar.
    const waitBotId = isCpu && cpuPersona && isBotCastId(cpuPersona.botId) ? cpuPersona.botId : null;
    const waitGhost = isCpu && cpuPersona?.botId === 'ghost';
    const waitAccent = waitBotId ? cpuPersona?.color ?? VS_ACCENT : VS_ACCENT;
    return (
      <PageBackground tint="vs" scheme="light" className="h-screen-stable overflow-y-auto relative" style={{ ...VS_LIGHT_VARS, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {disconnectBannerEl}
        <div className="max-w-md w-full mx-auto px-4 py-4 space-y-3.5">
          {/* One tinted window (A1): who's still playing, the stakes, their live boards. */}
          <VsCard accent={waitAccent} className="relative animate-fade-in-up">
            <div className="relative flex flex-col gap-1 text-center" style={{ padding: '12px 12px 4px' }}>
              <span className="font-black" style={{ fontSize: 19, letterSpacing: 0.4, lineHeight: 1.2, color: VS.deep }}>
                {oppName.toUpperCase()} IS STILL PLAYING
              </span>
              {stakes && <span className="text-[12px] font-extrabold" style={{ color: VS.ink }}>{stakes}</span>}
            </div>

            <div className="relative flex items-center gap-3 px-4 pt-2">
              {waitBotId ? (
                <BotFigure id={waitBotId} pose="waiting" size={64} />
              ) : (
                /* Breathing "live" ring signals an active opponent while you wait. */
                <span className="relative flex items-center justify-center shrink-0" style={{ width: 44, height: 44 }}>
                  {/* Circle around a photo; rounded square around a letter tile (ART_SPEC §20). */}
                  <span
                    className={`absolute inset-0 animate-ping${opponentInfo?.avatarUrl && !waitGhost ? ' rounded-full' : ''}`}
                    style={{ border: `2px solid ${VS.ink}`, opacity: 0.35, borderRadius: opponentInfo?.avatarUrl && !waitGhost ? undefined : letterTileRadius(44) }}
                  />
                  {waitGhost ? (
                    <GhostAvatar name={myNameForGhost} emoji={(profile as any)?.avatar_emoji ?? null} accent={(profile as any)?.accent_color ?? null} size={44} />
                  ) : (
                    <InitialAvatar name={oppName} url={opponentInfo?.avatarUrl ?? null} size={44} />
                  )}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-black truncate" style={{ color: VS.deep }}>{oppName}</div>
                <div className="flex items-baseline gap-1 text-[11.5px] font-bold" style={{ color: '#4b5563' }}>
                  <SoftNum size={15}>{opponentProgress.attempts}</SoftNum> {opponentProgress.attempts === 1 ? 'guess' : 'guesses'}
                  <span aria-hidden="true">·</span> <SoftNum size={15}>{clockStr}</SoftNum>
                  {gStage ? <><span aria-hidden="true">·</span> Stage <SoftNum size={15}>{opponentStage + 1}/5</SoftNum></> : liveTotalBoards > 1 ? <><span aria-hidden="true">·</span> <SoftNum size={15}>{opponentProgress.boardsSolved}/{liveTotalBoards}</SoftNum> boards</> : null}
                </div>
              </div>
              <span className={`flex gap-0.5 items-center shrink-0 transition-opacity duration-200 ${opponentTyping ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: VS.ink, animationDelay: `${i * 0.2}s` }} />
                ))}
              </span>
            </div>
            <span className="sr-only">{progressLine}</span>

            {/* Opponent live board(s) — the solo mini-board, colors only. */}
            <div className="relative px-3 pt-3 pb-4">
              <OpponentLiveBoards
                opponentTiles={opponentTiles}
                boardIndices={liveIndices}
                solvedBoards={solvedLive}
                maxGuesses={liveRows}
                wordLength={specWordLen}
              />
            </div>
          </VsCard>

          {/* Your stats (A2 soft numbers) */}
          {playerStats && (
            <VsCard accent="#7c3aed">
              <div className="p-4">
                <div className="text-[11px] font-black uppercase mb-2" style={{ color: VS.label, letterSpacing: 1.2 }}>Your result</div>
                <div className="flex">
                  {[
                    { k: 'Guesses', v: String(playerStats.guesses) },
                    { k: 'Time', v: formatTime(playerStats.timeMs) },
                    { k: totalBoards > 1 ? 'Boards' : 'Solved', v: totalBoards > 1 ? `${myBoardsLine}/${totalBoards}` : myStatus === 'won' ? 'Yes' : 'No' },
                  ].map((c) => (
                    <div key={c.k} className="flex-1 text-center">
                      <SoftNum size={22} as="div">{c.v}</SoftNum>
                      <div className="text-[10.5px] font-bold uppercase" style={{ color: VS.label, letterSpacing: 0.6 }}>{c.k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </VsCard>
          )}

          {(isCpu || flow === 'race') && (
            cpuWinLocked ? (
              <CandyButton color="teal" size="lg" block icon="trophy" onClick={() => matchService.resolveNow?.()}>Claim your win</CandyButton>
            ) : (
              <CandyButton color="peach" size="md" block icon="arrow" onClick={() => matchService.resolveNow?.()}>Skip to result</CandyButton>
            )
          )}

          <div className="flex justify-center">
            <CandyButton color="peach" size="sm" onClick={handleForfeit} icon={<X className="w-3.5 h-3.5" aria-hidden="true" strokeWidth={3} />}>Leave</CandyButton>
          </div>
        </div>

        {message && <VsToast text={message} />}
      </PageBackground>
    );
  }

  // Match screen
  const renderModeComponent = () => {
    const commonProps = {
      seed,
      mode,
      solutions: serverSolutions,
      onBoardSolved: handleBoardSolved,
      onCompleted: handleCompleted,
      onGuessSubmitted: handleGuessSubmitted,
      // The MODE's board count is known from match start — the server's
      // opponentProgress.totalBoards stays 0 until the opponent's first
      // progress event, which made Quad/Octo render a single placeholder
      // board in the opponent HUD until they typed (iOS build-87 parity).
      opponentProgress: {
        ...opponentProgress,
        totalBoards: opponentProgress.totalBoards || totalBoards,
      },
      opponentTiles,
      startTime,
      onTyping: handleTyping,
      onFinalBoard: handleFinalBoard,
    };

    switch (mode) {
      case GameMode.DUEL:
        return <VsClassic {...commonProps} />;
      case GameMode.QUORDLE:
        return <VsQuadword {...commonProps} />;
      case GameMode.OCTORDLE:
        return <VsOctoword {...commonProps} />;
      case GameMode.SEQUENCE:
        return <VsSuccession {...commonProps} />;
      case GameMode.RESCUE:
        return <VsDeliverance {...commonProps} />;
      case GameMode.GAUNTLET:
        return <VsGauntlet {...commonProps} opponentProgress={{ ...commonProps.opponentProgress, currentStage: opponentStage }} onStageCompleted={handleStageCompleted} />;
      case GameMode.PROPERNOUNDLE:
        return <VsProperNoundle {...commonProps} puzzleMetadata={puzzleMetadata} />;
      case GameMode.DUEL_6:
        return <VsClassic {...commonProps} />;
      case GameMode.DUEL_7:
        return <VsClassic {...commonProps} />;
      default:
        return <VsClassic {...commonProps} />;
    }
  };

  // Who the opponent strip shows (VS polish §1): the bot's art + "Bot", a
  // friend's run, or the live opponent.
  const hudBotId = isCpu && cpuPersona && isBotCastId(cpuPersona.botId) ? cpuPersona.botId : undefined;
  const hudGhost = isCpu && cpuPersona?.botId === 'ghost';
  const opponentIdentity = {
    name: opponentInfo?.username || (isCpu ? 'Bot' : 'Opponent'),
    avatarUrl: opponentInfo?.avatarUrl ?? null,
    isBot: isCpu,
    tag: hudBotId ? `Rung ${botPersona(hudBotId).rung}` : hudGhost ? 'Your best run' : isCpu ? 'Bot' : flow === 'race' ? 'Their run' : undefined,
    typing: opponentTyping,
    // The bot's own character + color on the strip (D3); Your Ghost = your faded tile.
    botId: hudBotId,
    color: hudBotId ? botPersona(hudBotId).color : undefined,
    ghost: hudGhost ? { name: profile?.username || 'You', emoji: (profile as any)?.avatar_emoji ?? null, accent: (profile as any)?.accent_color ?? null } : undefined,
  };
  const soloTitle = SOLO_TITLES[mode];

  return (
    // FINISH_SPEC AG: the match is the 560 px centered game column on desktop web (globals.css .page-col).
    <div className="h-screen-stable flex flex-col relative page-col" style={{ backgroundColor: 'var(--color-bg)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* 3-2-1-GO: the screen flips to 'match' the moment the count hits 0,
          so the overlay must render HERE too — otherwise the "GO!" beat
          (held ~600ms over the board, native parity) never showed and the
          countdown appeared to end at 1. */}
      {countdownOverlayEl}
      {disconnectBannerEl}
      {/* Input shield: a player who tap-skipped the intro sees the countdown
          overlay clear BEFORE the shared input-lock ends — keep the on-screen
          keys (and everything else) untouchable until the shared timeline
          completes, matching the un-skipped player exactly. */}
      {sharedInputLock && <div className="fixed inset-0 z-40" aria-hidden="true" />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}
      {/* Match header = the solo header + a teal VS pill (VS polish §1). The
          Home button forfeits the match first so the server can end it
          cleanly and credit the opponent — just navigating away mid-VS leaves
          a dangling match. Gauntlet's solo screen has no title row: its home
          button and the VS pill overlay the stage stepper, like solo. */}
      {soloTitle ? (
        <div className="text-center pt-2 pb-1 px-[52px] shrink-0 relative min-h-[52px] flex items-center justify-center gap-2">
          <GameHomeButton accentColor={accentColor} onClick={handleForfeit} />
          {/* Long titles step down a size on narrow phones so the pill never collides with Home. */}
          <h1 className={`${soloTitle.className} max-[400px]:text-2xl font-black truncate min-w-0`} style={soloTitle.style}>
            {soloTitle.title}
          </h1>
          <VsPill />
        </div>
      ) : (
        <>
          <GameHomeButton accentColor={accentColor} onClick={handleForfeit} positionClass="absolute top-[calc(env(safe-area-inset-top)+4px)] left-2 z-10" />
          <span className="absolute right-3 z-10" style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}><VsPill /></span>
        </>
      )}

      {/* Moment callout — opponent milestones (greens / board solved / last guess) as a soft pill. */}
      {callout && (
        <div className="absolute left-0 right-0 text-center z-40 pointer-events-none px-4" style={{ top: 'calc(env(safe-area-inset-top) + 52px)' }} role="status" aria-live="polite">
          {callout.botId ? (
            // A bot's line, in its own voice and color, beside its character (D3).
            <span key={callout.id} className="inline-flex items-center gap-1.5 text-xs font-extrabold pl-1 pr-4 py-1 rounded-full animate-fade-in-up" style={{ ...vsCard(botPersona(callout.botId).color, { radius: 999 }), color: VS.deep }}>
              <BotPoseAvatar id={callout.botId} pose={callout.pose ?? 'waiting'} accent={botPersona(callout.botId).color} size={28} />
              <span><b className="font-black">{botPersona(callout.botId).name}:</b> {callout.text}</span>
            </span>
          ) : (
            <span
              key={callout.id}
              className="inline-block text-xs font-extrabold px-4 py-2 rounded-full animate-fade-in-up"
              style={{ ...vsCard(VS_ACCENT, { radius: 999 }), color: VS.deep }}
            >
              {callout.text}
            </span>
          )}
        </div>
      )}

      {/* Game content fills remaining space */}
      {/* MUST be a flex column: every mode component's root is
          'flex-1 min-h-0 flex flex-col' — inside a plain block that flex-1
          is inert, the height chain breaks, and the board renders at its
          natural aspect height instead of shrinking to fit, pushing the
          keyboard below the fold. */}
      <div className="flex-1 min-h-0 flex flex-col">
        <VsOpponentContext.Provider value={opponentIdentity}>
          <VsSoloHudContext.Provider value={opponentUserId === SOLO_OPPONENT_ID ? soloHudLine : null}>
            {renderModeComponent()}
          </VsSoloHudContext.Provider>
        </VsOpponentContext.Provider>
      </div>

      {message && <VsToast text={message} className="bottom-24" />}
    </div>
  );
}

/** Mode icon + `VS · MODE` caps headline for the screens around a match. */
function VsScreenTitle({ mode }: { mode: GameMode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <VsModeTile mode={mode} size={48} icon={24} />
      <h1 className="text-center text-[24px] font-black uppercase" style={{ color: VS.deep, letterSpacing: 0.5 }}>
        VS · {modeTitle(mode)}
      </h1>
    </div>
  );
}

/**
 * "Already played today" screen for freemium daily VS.
 *
 * Shown when a freemium user revisits /practice/vs?daily=true after
 * using their free daily VS match. Mirrors how the Classic mode's
 * "View Solved Puzzle" upsell works: the user can see today's answer
 * word, a countdown until tomorrow's puzzle, and a Go Pro CTA for
 * unlimited matches.
 */
function DailyVsAlreadyPlayed({
  answer,
  titleGradient,
  isPro,
  won = null,
}: {
  answer: string;
  titleGradient: string;
  isPro: boolean;
  won?: boolean | null;
}) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const update = () => setCountdown(formatCountdown(getSecondsUntilMidnightLocal()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const displayWord = answer ? answer.toUpperCase() : '';
  const letters = displayWord.split('');

  return (
    <PageBackground
      tint="vs"
      scheme="light"
      className="h-screen-stable flex flex-col items-center justify-center relative overflow-y-auto"
      style={{ ...VS_LIGHT_VARS, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="text-center space-y-5 max-w-sm w-full px-5 py-6">
        {/* U, all done for today (docs/ART_SPEC.md §7). */}
        <ArtScene scene={PAGE_SCENES.allDone} height={120} className="animate-fade-in-scale" />
        {/* Headline */}
        <div className="space-y-1 animate-fade-in-scale">
          <div className="text-[11px] font-black uppercase" style={{ color: VS.ink, letterSpacing: 1.2 }}>
            Today&apos;s VS puzzle
          </div>
          <h1 className="text-[26px] font-black uppercase" style={{ color: VS.deep, letterSpacing: 0.4 }}>
            Already played
          </h1>
        </div>

        {/* Today's outcome as YOU WIN! / YOU LOSE lettering, ≈28 tall
            (docs/ART_SPEC.md §10 parity with Android). */}
        {won !== null && (
          <MomentArt moment={resultMoment(won ? 'win' : 'loss')} maxHeight={28} as="div" level={2} className="animate-fade-in-scale" />
        )}

        {/* Answer tiles */}
        {letters.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            {letters.map((ch, i) => (
              <div key={i} className="w-11 h-11 rounded-md flex items-center justify-center text-lg font-black text-white tile-correct border">
                {ch}
              </div>
            ))}
          </div>
        )}

        {/* Countdown */}
        <div
          className="inline-flex items-baseline gap-1.5 px-4 py-2 animate-fade-in-up"
          style={{ ...vsCard('#7c3aed', { radius: 999 }), animationDelay: '0.25s' }}
        >
          <span className="text-xs font-black" style={{ color: '#6d28d9' }}>Next daily VS in</span>
          <SoftNum size={16}>{countdown}</SoftNum>
        </div>

        {/* Pro: prompt unlimited VS. Freemium: upsell to Pro. */}
        <p className="text-[12.5px] font-bold px-2 animate-fade-in" style={{ color: '#4b5563', animationDelay: '0.35s' }}>
          {isPro
            ? 'Want more? Jump into unlimited VS battles with fresh puzzles.'
            : 'Upgrade to Pro for unlimited VS matches, rematches, and ad-free battles.'}
        </p>

        {/* Actions */}
        <div className="space-y-2.5 animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
          <CandyLink
            href={isPro ? '/practice/vs' : '/pro'}
            color={isPro ? 'teal' : 'purple'}
            size="lg"
            block
            icon={isPro ? <Swords className="w-5 h-5 text-white" aria-hidden="true" /> : <Icon3D name="crown" size={20} />}
          >
            {isPro ? 'Play unlimited VS' : 'Upgrade to Pro'}
          </CandyLink>
          <CandyLink href="/" color="peach" size="md" block icon={<Icon3D name="tab-home" size={18} />}>
            Home
          </CandyLink>
        </div>
      </div>
    </PageBackground>
  );
}
