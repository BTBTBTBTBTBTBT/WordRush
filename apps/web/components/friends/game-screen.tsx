'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { GAME_HEADER_GLYPH, HeaderBack } from '@/components/ui/page-header';
import { PocketHelpCard } from './pocket-help-card';
import { useTutorialsSeen } from '@/lib/tutorials-seen';
import { Icon3D } from '@/components/ui/icon3d';
import {
  FIRST_PLAY_FLAG, FRIENDLY_TITLES, LIVE_OPTIMISTIC_TIMEOUT_MS, LIVE_PLAY_SWITCH, LIVE_REACTIONS, LIVE_REACT_LIFETIME_MS, PRESENCE_COPY,
  beginMove, confirmMove, displayed, emptySnapshot, pocketTutorialKey, pollIntervalMs, presenceLabel, receiveView, rejectMove, shouldAutoShowTutorial, whoseTurn,
  type FriendlyMove, type LiveReaction, type LiveSnapshot,
} from '@wordle-duel/core';
import { useFlags } from '@/hooks/use-flags';
import { useLiveGame, type LiveReactionEvent } from '@/hooks/use-live-game';
import { feedback } from '@/lib/sound-events';
import { ReactionIcon } from './reaction-icon';
import { RoundIconSlot } from '@/components/ui/family-button';
import { useAuth } from '@/lib/auth-context';
import { getFriends, loadFriends, onFriendsChange } from '@/lib/friends-service';
import { fetchGame, sendMove, startGame, type GameView } from '@/lib/friendly-games-client';
import { FR, KIND_COLOR, KIND_GRADIENT, friendOnline, gameSubLine, scoreOf, screenHeadline } from '@/lib/friends-play';
import { ChainBoard, CoinBoard, GhostBoard, PassBoard, RpsBoard, TttBoard, type Player } from './friendly-boards';
import { FriendAvatar, GameGlyph, Sheet } from './friends-ui';
import { BrandEmptyState } from '@/components/ui/brand-empty-state';
import { CastLoader } from '@/components/ui/cast-loader';
import { PAGE_SCENES } from '@/lib/art';
import { ResultHost } from '@/components/ui/mascot';
import { pocketResultHost } from '@/lib/mascots';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { SoftNum } from '@/components/ui/soft-number';
import { PageBackground } from '@/components/ui/page-background';
import { frBar } from '@/lib/friends-look';
import { softMix } from '@/lib/soft-surface';

// A Friends pocket game (Friends overhaul §4, canvas board AE; also the push
// deep link /friends/games/<id>). The server runs the rules; this screen polls
// the game every 2 s while it is open and visible (which also tells the server
// we're watching, so moves arrive live instead of as a push), sends moves,
// retries on a 409, and offers REMATCH / FRIENDS when it's over. RESIGN lives
// in the close confirm while the game is still going. Finishing build (A1, A2,
// A8, L): the Friends wallpaper (light-only), the score card with the game's
// top bar and soft numbers, every board on the shared game tray, candy actions.

/** Floating live reactions currently on screen. */
interface Floater { id: number; reaction: LiveReaction; mine: boolean; x: number }

const reduceMotion = (): boolean => {
  try {
    return document.documentElement.dataset.reducedMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
};

/** How many rounds / flips the state holds (a new one triggers the reveal). */
function roundCount(g: GameView): number {
  const s = g.state;
  return s.kind === 'rps' || s.kind === 'coin' || s.kind === 'ghost' ? s.rounds.length : 0;
}

export function FriendlyGameScreen({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [game, setGame] = useState<GameView | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  // 2.8 items 9c + 12: the "?" How to Play card; it also opens once by itself the first time (synced).
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpFirst, setHelpFirst] = useState(false);
  const helpAuto = useRef(false);
  const { seen: tutorialsSeen, mark: markTutorial } = useTutorialsSeen();
  const [rematching, setRematching] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [, setFriendsTick] = useState(0);
  const gameRef = useRef<GameView | null>(null);
  const busyRef = useRef(false);

  // 9b live play (isLive('live_play'); off = today's 2 s poll, no optimistic moves, no presence).
  const { isLive } = useFlags();
  const liveOn = isLive(LIVE_PLAY_SWITCH);
  const liveRef = useRef(liveOn);
  liveRef.current = liveOn;
  const snapRef = useRef<LiveSnapshot<GameView>>(emptySnapshot<GameView>());
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const pulseRef = useRef<HTMLDivElement | null>(null);
  const [fx, setFx] = useState({ arrive: 0, pulse: 0, shake: 0 });

  /** Draw the confirmed game with my in-flight prediction over it. */
  const publish = useCallback(() => {
    gameRef.current = snapRef.current.confirmed;
    setGame(displayed(snapRef.current));
  }, []);

  /**
   * Take a fresh game (poll, broadcast, backup refetch) unless it is not newer than the one on
   * screen. `own` = the reply to MY move (it replaces my prediction).
   */
  const accept = useCallback((g: GameView, own = false) => {
    const cur = snapRef.current.confirmed;
    const rounds = cur && cur.id === g.id && roundCount(g) > roundCount(cur);
    if (own) {
      snapRef.current = confirmMove(snapRef.current, g);
      if (rounds) setRevealKey((k) => k + 1);
      publish();
      return;
    }
    const r = receiveView(snapRef.current, g);
    if (!r.applied) return;
    snapRef.current = r.snap;
    if (rounds) setRevealKey((k) => k + 1);
    // A change that lands while my own move is in flight is my move, not the friend's.
    if (liveRef.current && !busyRef.current) {
      if (r.change.moved && g.status === 'active') { feedback('key'); setFx((f) => ({ ...f, arrive: f.arrive + 1 })); }
      if (r.change.yourTurnStarted) { setTimeout(() => feedback('notify'), 140); setFx((f) => ({ ...f, pulse: f.pulse + 1 })); }
    }
    publish();
  }, [publish]);

  const refetch = useCallback(() => {
    void fetchGame(id).then((g) => { if (g && g !== 'error') accept(g); });
  }, [id, accept]);

  const onReaction = useCallback((e: LiveReactionEvent) => {
    const f: Floater = { id: e.id + Math.random(), reaction: e.reaction, mine: false, x: 10 + Math.random() * 70 };
    setFloaters((l) => [...l.slice(-5), f]);
    setTimeout(() => setFloaters((l) => l.filter((x) => x.id !== f.id)), LIVE_REACT_LIFETIME_MS);
    feedback('notify');
  }, []);

  const live = useLiveGame({
    gameId: id,
    userId: user?.id ?? null,
    opponentId: game?.opponent.id ?? null,
    enabled: liveOn && !!user && !!game && game.status === 'active',
    onView: (g) => accept(g),
    onRefetch: refetch,
    onReaction,
  });

  const react = (reaction: LiveReaction) => {
    if (!live.sendReaction(reaction)) return;
    const f: Floater = { id: Math.random(), reaction, mine: true, x: 10 + Math.random() * 70 };
    setFloaters((l) => [...l.slice(-5), f]);
    setTimeout(() => setFloaters((l) => l.filter((x) => x.id !== f.id)), LIVE_REACT_LIFETIME_MS);
    feedback('press');
  };

  // Friend's move lands: the board gives a quick bounce. Your turn: a soft ring. A rejected move: a gentle shake.
  useEffect(() => {
    if (!fx.arrive || reduceMotion()) return;
    boardRef.current?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.014)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
  }, [fx.arrive]);
  useEffect(() => {
    if (!fx.pulse || reduceMotion()) return;
    pulseRef.current?.animate?.(
      [{ opacity: 0, transform: 'scale(0.985)' }, { opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.015)' }],
      { duration: 900, easing: 'ease-in-out' },
    );
  }, [fx.pulse]);
  useEffect(() => {
    if (!fx.shake || reduceMotion()) return;
    boardRef.current?.animate?.(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
      { duration: 320, easing: 'ease-out' },
    );
  }, [fx.shake]);

  const socketUp = liveOn && live.socketUp;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    gameRef.current = null;
    snapRef.current = emptySnapshot<GameView>();
    const tick = async (first = false) => {
      if (!first) {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        if (busyRef.current) return;
        if (gameRef.current && gameRef.current.status !== 'active') return;
      }
      const g = await fetchGame(id);
      if (!alive) return;
      if (g === null) setMissing(true);
      else if (g !== 'error') accept(g);
    };
    void tick(true);
    // Live play on + socket up: a slow keep-alive (it also stamps "watching" and repairs a missed
    // broadcast); socket down: a 4 s fallback poll; switch off: today's 2 s poll.
    const t = setInterval(() => void tick(), pollIntervalMs(liveOn, socketUp));
    return () => { alive = false; clearInterval(t); };
  }, [id, user, accept, liveOn, socketUp]);

  // Their presence (the friends digest) for the "live while they're on" line and ring.
  useEffect(() => {
    if (!user) return;
    void loadFriends();
    return onFriendsChange(() => setFriendsTick((v) => v + 1));
  }, [user]);

  const onMove = useCallback(async (move: FriendlyMove): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    // Optimistic: my piece / pick / word lands at once, with its sound; the server can still say no.
    let optimistic = false;
    if (liveRef.current) {
      const b = beginMove(snapRef.current, move);
      if (b.optimistic) { snapRef.current = b.snap; optimistic = true; publish(); feedback('key'); }
    }
    const rollBack = () => {
      const rb = rejectMove(snapRef.current);
      snapRef.current = rb.snap;
      publish();
      if (rb.rolledBack) { setFx((f) => ({ ...f, shake: f.shake + 1 })); feedback('invalid'); }
    };
    try {
      const timeout = new Promise<{ ok: false; error: string }>((res) => setTimeout(() => res({ ok: false, error: 'Network error. Try again.' }), LIVE_OPTIMISTIC_TIMEOUT_MS));
      const r = optimistic ? await Promise.race([sendMove(id, move), timeout]) : await sendMove(id, move);
      if (r.ok) { accept(r.game, true); return true; }
      if (optimistic) rollBack();
      if ('retry' in r && r.retry) {
        // Someone moved first: show the fresh state and let the player try again.
        const g = await fetchGame(id);
        if (g && g !== 'error') accept(g);
      }
      setError(r.error);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [id, accept, publish]);

  const rematch = async () => {
    if (!game || rematching) return;
    setRematching(true);
    const r = await startGame(game.kind, game.opponent.id, game.state.kind === 'coin' ? game.state.stake : undefined);
    setRematching(false);
    if ('error' in r) { setError(r.error); return; }
    router.push(`/friends/games/${r.game.id}`);
  };

  const gameKind = game?.kind ?? null;
  useEffect(() => {
    if (helpAuto.current || !gameKind) return;
    if (shouldAutoShowTutorial({ live: isLive(FIRST_PLAY_FLAG), seen: tutorialsSeen, key: pocketTutorialKey(gameKind) })) {
      helpAuto.current = true;
      setHelpFirst(true);
      setHelpOpen(true);
    }
  }, [gameKind, tutorialsSeen, isLive]);
  const closeHelp = () => {
    setHelpOpen(false);
    if (helpFirst && gameKind) { markTutorial(pocketTutorialKey(gameKind)); setHelpFirst(false); }
  };

  const close = () => {
    if (game?.status === 'active') setConfirmClose(true);
    else router.push('/friends');
  };

  const title = game ? FRIENDLY_TITLES[game.kind] : 'Friends';
  const gradient = game ? KIND_GRADIENT[game.kind] : FR.title;

  const topBar = (
    <div className="relative flex items-center justify-center" style={{ minHeight: 44 }}>
      <HeaderBack kind="close" onClick={close} className="absolute left-0" />
      {/* The pocket game's 3D icon beside its title (docs/ART_SPEC.md §9). */}
      <span className="flex items-center gap-1.5 px-10 min-w-0">
        {game && <GameGlyph kind={game.kind} size={16} color={KIND_COLOR[game.kind]} />}
        <span
          className="font-black uppercase text-center"
          style={{ fontSize: 19, letterSpacing: 0.3, backgroundImage: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', color: 'transparent' }}
        >
          {title}
        </span>
      </span>
      {/* 9c: the family "?" in the top-right corner, where every other game keeps it. */}
      {game && (
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="How to play"
          aria-haspopup="dialog"
          className="absolute right-0 hdr-glyph w-11 h-11 flex items-center justify-center"
        >
          <Icon3D name="help" size={GAME_HEADER_GLYPH} />
        </button>
      )}
    </div>
  );

  if (!authLoading && !user) {
    return (
      <Shell>
        {topBar}
        <p className="text-center text-sm font-bold py-10" style={{ color: FR.label }}>Sign in to play with your friends.</p>
      </Shell>
    );
  }
  if (missing) {
    return (
      <Shell>
        {topBar}
        <BrandEmptyState
          scene={PAGE_SCENES.notFound}
          accent="friends"
          className="py-10"
          title="GAME NOT FOUND"
          line="This game isn't here anymore."
          actionLabel="Back to Friends"
          actionColor="peach"
          actionIcon="arrow"
          onAction={() => router.push('/friends')}
        />
      </Shell>
    );
  }
  if (!game) {
    return (
      <Shell>
        {topBar}
        <div className="flex items-center justify-center py-16" role="status" aria-label="Loading game"><CastLoader /></div>
      </Shell>
    );
  }

  const me = game.me;
  const active = game.status === 'active';
  const friend = getFriends().find((f) => f.id === game.opponent.id);
  const online = !!friend && friendOnline(friend, Date.now());
  const you: Player = {
    name: profile?.username ?? 'You',
    url: profile?.avatar_url ?? null,
    emoji: (profile as { avatar_emoji?: string | null } | null)?.avatar_emoji ?? null,
    accent: (profile as { accent_color?: string | null } | null)?.accent_color ?? null,
    userId: profile?.id ?? null,
  };
  const them: Player = {
    name: game.opponent.username, url: game.opponent.avatarUrl, emoji: game.opponent.avatarEmoji,
    // AN5: the opponent's saved mascot (undefined = the avatar directory fills it).
    userId: game.opponent.id, config: game.opponent.avatar_config, castId: game.opponent.avatar_cast_id,
    frame: game.opponent.avatar_frame, pro: game.opponent.is_pro,
  };
  const headline = screenHeadline(game);
  const sub = active ? gameSubLine(game.state, me, them.name, online) : game.line.toUpperCase();
  const score = scoreOf(game.state, me);
  const turn = active ? whoseTurn(game.state) : null;
  const youWon = game.result === 'win';
  const theyWon = game.result === 'loss';
  const left = youWon ? '#ddd6fe' : '#ede9fe';
  const right = theyWon ? '#fde68a' : '#fef3c7';

  // 9b presence: the friend's mascot is "here now" (alive ring) while they are in the channel,
  // "thinking…" on their turn, "left the game" when they go. Off / socket down = the old online dot.
  const presence = liveOn && socketUp && active
    ? presenceLabel({ peerPresent: live.peer.present, everSeen: live.peer.everSeen, theirTurn: !!turn && turn !== me, peerThinking: live.peer.thinking })
    : null;
  const theirOnline = presence ? live.peer.present : online;

  const half = (label: string, p: Player, isMe: boolean, value: number | null, toPlay: boolean, won: boolean) => {
    // The chip under each name: TO PLAY, or (friend side, live) THINKING… / HERE NOW / LEFT THE GAME.
    const chip = !isMe && presence ? (toPlay && presence === 'thinking' ? PRESENCE_COPY.thinking : toPlay ? 'TO PLAY' : PRESENCE_COPY[presence]) : toPlay ? 'TO PLAY' : '';
    const presenceChip = !isMe && !!presence && presence !== 'away' && !(toPlay && presence !== 'thinking');
    const tone = presence === 'left' ? '#94a3b8' : presence === 'here' ? '#16a34a' : FR.solid;
    return (
    <div className="flex-1 flex flex-col items-center gap-1.5" style={{ padding: '12px 8px 14px' }}>
      <FriendAvatar name={p.name} userId={p.userId} url={p.url} accent={p.accent} config={p.config} castId={p.castId} frame={p.frame} pro={p.pro} size={40} online={!isMe && theirOnline} pulse={!isMe && presence === 'thinking'} />
      <span className="flex items-center gap-1 text-[10px] font-black uppercase truncate max-w-full" style={{ color: isMe ? '#4c1d95' : '#92400e', letterSpacing: 0.8 }}>
        {won && <Icon3D name="trophy" size={14} className="shrink-0" />}
        {label}
      </span>
      {value !== null && <SoftNum size={34}>{value}</SoftNum>}
      <span
        className="text-[9.5px] font-black px-2 rounded-full"
        style={{
          height: 18, display: 'flex', alignItems: 'center', letterSpacing: 0.6,
          background: presenceChip ? softMix(tone, 0.12) : toPlay ? softMix('#ec4899', 0.14) : 'transparent',
          border: `1.5px solid ${presenceChip ? softMix(tone, 0.3) : toPlay ? softMix('#ec4899', 0.36) : 'transparent'}`,
          color: presenceChip ? tone : toPlay ? FR.solid : 'transparent',
        }}
        aria-live="polite"
      >
        {chip || 'TO PLAY'}
      </span>
    </div>
    );
  };

  const boardProps = {
    me, you, them, active, busy, revealKey, onMove,
    accent: KIND_COLOR[game.kind],
    tray: youWon ? 'won' as const : theyWon ? 'lost' as const : 'playing' as const,
  };

  return (
    <Shell>
      {topBar}

      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: 16,
          background: `linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(90deg, ${left} 0%, ${left} 50%, ${right} 50%, ${right} 100%)`,
          border: `1.5px solid ${softMix(KIND_COLOR[game.kind], 0.32)}`,
          boxShadow: '0 8px 20px rgba(60,30,110,0.10)',
        }}
      >
        <div aria-hidden="true" className="relative" style={frBar(KIND_COLOR[game.kind])} />
        {youWon && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="absolute" style={{ top: '-20%', left: 0, width: '38%', height: '140%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))', animation: 'banner-shimmer 2.6s ease-in-out 1 both' }} />
          </div>
        )}
        <div className="relative flex flex-col gap-1" style={{ padding: '12px 12px 10px', background: 'rgba(255,255,255,0.5)' }}>
          <span className="font-black" style={{ fontSize: 16, letterSpacing: 0.4, lineHeight: 1.2, color: FR.ink }}>{headline}</span>
          <span className="font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.4, color: FR.mid }}>{sub}</span>
        </div>
        <div className="relative flex">
          {half('YOU', you, true, score ? score.mine : null, turn === me || turn === 'both', youWon)}
          {half(`@${them.name}`, them, false, score ? score.theirs : null, !!turn && turn !== me, theyWon)}
        </div>
      </div>

      {error && <p className="text-center text-[12.5px] font-bold" style={{ color: '#dc2626' }}>{error}</p>}

      <div ref={boardRef} className="relative">
        {game.state.kind === 'rps' && <RpsBoard state={game.state} {...boardProps} />}
        {game.state.kind === 'ttt' && <TttBoard state={game.state} {...boardProps} />}
        {game.state.kind === 'coin' && <CoinBoard state={game.state} {...boardProps} />}
        {game.state.kind === 'pass' && <PassBoard state={game.state} {...boardProps} answer={game.answer} />}
        {game.state.kind === 'ghost' && <GhostBoard state={game.state} {...boardProps} />}
        {game.state.kind === 'chain' && <ChainBoard state={game.state} {...boardProps} />}
        {/* Your-turn pulse: a soft ring that breathes once when the move comes back to you. */}
        <div ref={pulseRef} aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ borderRadius: 20, opacity: 0, boxShadow: `0 0 0 2px ${softMix(KIND_COLOR[game.kind], 0.55)}, 0 0 22px ${softMix(KIND_COLOR[game.kind], 0.4)}` }} />
        {/* Live reactions float up from the bottom of the board. */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-2 h-0 pointer-events-none">
          {floaters.map((f) => (
            <span key={f.id} className="live-float absolute" style={{ left: `${f.x}%`, bottom: 0, opacity: f.mine ? 0.85 : 1 }}>
              <ReactionIcon reaction={f.reaction} size={34} />
            </span>
          ))}
        </div>
      </div>

      {active && liveOn && socketUp && (
        <div className="flex items-center justify-center gap-2" role="group" aria-label="Send a reaction">
          {LIVE_REACTIONS.map((r) => (
            <RoundIconSlot key={r} onClick={() => react(r)} label={`Send ${r}`}>
              <ReactionIcon reaction={r} size={26} />
            </RoundIconSlot>
          ))}
        </div>
      )}

      {!active && (
        <div className="space-y-2.5 pt-1">
          {/* Pocket game result host: O3 pops on a win, R on a loss, U on a draw. */}
          <ResultHost id={pocketResultHost(youWon ? 'win' : theyWon ? 'loss' : 'draw')} pop={youWon} />
          <CastButton screen="pink"
            color="pink"
            block
            onClick={rematch}
            disabled={rematching}
            icon={rematching ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : 'replay'}
          >
            Rematch
          </CastButton>
          <CandyButton color="peach" block onClick={() => router.push('/friends')}>
            Friends
          </CandyButton>
        </div>
      )}

      {helpOpen && game && <PocketHelpCard kind={game.kind} onClose={closeHelp} firstPlay={helpFirst} />}

      {confirmClose && (
        // 2.8 item 9: ONE themed button. No Resign in-game (it lives in the friend's ⋯ menu on the Friends tab);
        // tapping the scrim or Escape keeps you playing.
        <Sheet onClose={() => setConfirmClose(false)} label="Leave the game">
          <div className="space-y-3 text-center pb-1">
            <p className="text-[16px] font-black" style={{ color: FR.ink }}>Your game waits for you</p>
            <p className="text-[12.5px] font-bold" style={{ color: FR.label }}>
              {them.name} gets a ping. It keeps going for 3 days.
            </p>
            <CastButton screen="pink" color="pink" size="md" block onClick={() => router.push('/friends')}>
              Back to Friends
            </CastButton>
          </div>
        </Sheet>
      )}
    </Shell>
  );
}

/** Light-only: the shared washes (the game tray) mix over white here in every theme. */
const LIGHT_CARD_BASE = { ['--color-card-base' as string]: '#ffffff' } as React.CSSProperties;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageBackground tint="friends" scheme="light" className="min-h-screen overflow-y-auto" style={LIGHT_CARD_BASE}>
      <div className="relative max-w-md mx-auto px-4 pt-2 pb-10 space-y-3.5">{children}</div>
    </PageBackground>
  );
}
