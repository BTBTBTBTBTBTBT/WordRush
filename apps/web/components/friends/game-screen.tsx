'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { HeaderBack } from '@/components/ui/page-header';
import { Icon3D } from '@/components/ui/icon3d';
import { FRIENDLY_TITLES, whoseTurn, type FriendlyMove } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { getFriends, loadFriends, onFriendsChange } from '@/lib/friends-service';
import { fetchGame, resignGame, sendMove, startGame, type GameView } from '@/lib/friendly-games-client';
import { FR, KIND_COLOR, KIND_GRADIENT, TILE, friendOnline, gameSubLine, scoreOf, screenHeadline } from '@/lib/friends-play';
import { ChainBoard, CoinBoard, GhostBoard, PassBoard, RpsBoard, TttBoard, type Player } from './friendly-boards';
import { FriendAvatar, GameGlyph, Sheet } from './friends-ui';
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES } from '@/lib/art';
import { ResultHost } from '@/components/ui/mascot';
import { pocketResultHost } from '@/lib/mascots';

// A Friends pocket game (Friends overhaul §4, canvas board AE; also the push
// deep link /friends/games/<id>). The server runs the rules; this screen polls
// the game every 2 s while it is open and visible (which also tells the server
// we're watching, so moves arrive live instead of as a push), sends moves,
// retries on a 409, and offers REMATCH / FRIENDS when it's over. RESIGN lives
// in the close confirm while the game is still going.

const POLL_MS = 2000;

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
  const [rematching, setRematching] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [, setFriendsTick] = useState(0);
  const gameRef = useRef<GameView | null>(null);
  const busyRef = useRef(false);

  /** Take a fresh game unless it is older than the one on screen (a slow poll after a move). */
  const accept = useCallback((g: GameView) => {
    const cur = gameRef.current;
    if (cur && cur.id === g.id && g.updatedAt < cur.updatedAt) return;
    if (cur && cur.id === g.id && roundCount(g) > roundCount(cur)) setRevealKey((k) => k + 1);
    gameRef.current = g;
    setGame(g);
  }, []);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    gameRef.current = null;
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
    const t = setInterval(() => void tick(), POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [id, user, accept]);

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
    try {
      const r = await sendMove(id, move);
      if (r.ok) { accept(r.game); return true; }
      if (r.retry) {
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
  }, [id, accept]);

  const resign = async () => {
    setConfirmClose(false);
    const g = await resignGame(id);
    if (g) accept(g);
    else setError('Could not resign. Try again.');
  };

  const rematch = async () => {
    if (!game || rematching) return;
    setRematching(true);
    const r = await startGame(game.kind, game.opponent.id, game.state.kind === 'coin' ? game.state.stake : undefined);
    setRematching(false);
    if ('error' in r) { setError(r.error); return; }
    router.push(`/friends/games/${r.game.id}`);
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
        <div className="text-center py-10 space-y-3">
          <ArtScene scene={PAGE_SCENES.notFound} />
          <p className="text-sm font-bold" style={{ color: FR.label }}>This game isn&apos;t here anymore.</p>
          <button type="button" onClick={() => router.push('/friends')} className="px-5 py-2.5 text-[13px] font-black rounded-full" style={{ background: FR.soft, color: FR.mid }}>FRIENDS</button>
        </div>
      </Shell>
    );
  }
  if (!game) {
    return (
      <Shell>
        {topBar}
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: FR.solid }} /></div>
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
  };
  const them: Player = { name: game.opponent.username, url: game.opponent.avatarUrl, emoji: game.opponent.avatarEmoji };
  const headline = screenHeadline(game);
  const sub = active ? gameSubLine(game.state, me, them.name, online) : game.line.toUpperCase();
  const score = scoreOf(game.state, me);
  const turn = active ? whoseTurn(game.state) : null;
  const youWon = game.result === 'win';
  const theyWon = game.result === 'loss';
  const left = youWon ? '#ddd6fe' : '#ede9fe';
  const right = theyWon ? '#fde68a' : '#fef3c7';

  const half = (label: string, p: Player, isMe: boolean, value: number | null, toPlay: boolean, won: boolean) => (
    <div className="flex-1 flex flex-col items-center gap-1.5" style={{ padding: '12px 8px 14px' }}>
      <FriendAvatar name={p.name} url={p.url} emoji={p.emoji} size={40} online={!isMe && online} />
      <span className="flex items-center gap-1 text-[10px] font-black uppercase truncate max-w-full" style={{ color: isMe ? '#4c1d95' : '#92400e', letterSpacing: 0.8 }}>
        {won && <Icon3D name="trophy" size={14} className="shrink-0" />}
        {label}
      </span>
      {value !== null && <span className="font-black" style={{ fontSize: 34, lineHeight: 1, color: isMe ? TILE.you : '#b45309' }}>{value}</span>}
      <span
        className="text-[9.5px] font-black px-2 rounded-full"
        style={{ height: 18, display: 'flex', alignItems: 'center', letterSpacing: 0.6, background: toPlay ? '#ffffff' : 'transparent', color: toPlay ? FR.solid : 'transparent' }}
      >
        TO PLAY
      </span>
    </div>
  );

  const boardProps = { me, you, them, active, busy, revealKey, onMove };

  return (
    <Shell>
      {topBar}

      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: 16,
          background: `linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(90deg, ${left} 0%, ${left} 50%, ${right} 50%, ${right} 100%)`,
          boxShadow: '0 4px 14px rgba(131,24,67,0.10)',
        }}
      >
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

      {game.state.kind === 'rps' && <RpsBoard state={game.state} {...boardProps} />}
      {game.state.kind === 'ttt' && <TttBoard state={game.state} {...boardProps} />}
      {game.state.kind === 'coin' && <CoinBoard state={game.state} {...boardProps} />}
      {game.state.kind === 'pass' && <PassBoard state={game.state} {...boardProps} answer={game.answer} />}
      {game.state.kind === 'ghost' && <GhostBoard state={game.state} {...boardProps} />}
      {game.state.kind === 'chain' && <ChainBoard state={game.state} {...boardProps} />}

      {!active && (
        <div className="space-y-2.5 pt-1">
          {/* Pocket game result host: O3 pops on a win, R on a loss, U on a draw. */}
          <ResultHost id={pocketResultHost(youWon ? 'win' : theyWon ? 'loss' : 'draw')} pop={youWon} />
          <button
            type="button"
            onClick={rematch}
            disabled={rematching}
            className="w-full py-3 flex items-center justify-center gap-2 text-[15px] font-black text-white transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{ background: FR.solid, borderRadius: 14, letterSpacing: 0.6 }}
          >
            {rematching && <Loader2 className="w-4 h-4 animate-spin" />} REMATCH
          </button>
          <button
            type="button"
            onClick={() => router.push('/friends')}
            className="w-full py-3 text-[14px] font-black transition-transform active:scale-[0.98]"
            style={{ background: FR.soft, color: FR.mid, borderRadius: 14, letterSpacing: 0.6 }}
          >
            FRIENDS
          </button>
        </div>
      )}

      {confirmClose && (
        <Sheet onClose={() => setConfirmClose(false)} label="Leave the game">
          <div className="space-y-2.5">
            <p className="text-[16px] font-black" style={{ color: FR.ink }}>LEAVE THE GAME?</p>
            <p className="text-[12.5px] font-bold" style={{ color: FR.label }}>
              It keeps going. Come back from YOUR TURN on the Friends tab any time in the next 3 days.
            </p>
            <button type="button" onClick={() => router.push('/friends')} className="w-full py-3 text-[14px] font-black text-white rounded-[14px]" style={{ background: FR.solid, letterSpacing: 0.6 }}>
              BACK TO FRIENDS
            </button>
            <button type="button" onClick={() => setConfirmClose(false)} className="w-full py-3 text-[14px] font-black rounded-[14px]" style={{ background: FR.soft, color: FR.mid, letterSpacing: 0.6 }}>
              KEEP PLAYING
            </button>
            <button type="button" onClick={resign} className="w-full py-2.5 text-[12.5px] font-black" style={{ color: '#dc2626', letterSpacing: 0.6 }}>
              RESIGN ({them.name.toUpperCase()} WINS)
            </button>
          </div>
        </Sheet>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-y-auto" style={{ backgroundColor: FR.page }}>
      <div className="max-w-md mx-auto px-4 pt-2 pb-10 space-y-3.5">{children}</div>
    </div>
  );
}
