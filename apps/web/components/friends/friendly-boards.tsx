'use client';

import { useEffect, useState } from 'react';
import {
  CHAIN_TARGET, PASS_MAX_GUESSES, WORD_MAX, WORD_MIN, tttLine, whoseTurn,
  type ChainState, type CoinFace, type CoinState, type FriendlyMove, type GhostState, type PassState, type RpsPick, type RpsState,
  type Side, type TttState,
} from '@wordle-duel/core';
import { Lock } from 'lucide-react';
import { Keyboard } from '@/components/game/keyboard';
import {
  FR, TILE, chainNeededLetter, chainPrecheck, ghostRoundCard, ghostTiles, otherSide, passKeyStates, tileState, tttThreats,
} from '@/lib/friends-play';
import { FriendAvatar, SectionLabel } from './friends-ui';
import { GameTray } from '@/components/ui/game-tray';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { ART_SIZE, artSrc, pieceSrc, type ArtName } from '@/lib/art';
import { prefersReducedMotion } from '@/lib/motion';
import type { TrayState } from '@/lib/game-tray';
import { softMix } from '@/lib/soft-surface';

// The six pocket-game boards (Friends overhaul §4 + §9, canvas board AE). Each one
// only renders the server's state and hands a move up; the screen sends it.
// Tiles always use our colors: purple = you, amber = them, slate = absent.
// Finishing build (docs/FINISH_SPEC.md L, J2, A1, A8): every board sits on the
// shared GameTray in the game's color (purple once won, slate once lost), no
// plain-white tiles or keys (a soft lilac wash), Tic-Tac-Tile draws the 3D
// X / O pieces (they drop in with the type pop; a winning three glows), and
// the actions are candy buttons.

/** The light lilac wash every empty tile / key / pick card takes (A1: never plain white). */
const EMPTY = { background: softMix('#7c3aed', 0.08), border: `1.5px solid ${softMix('#7c3aed', 0.26)}` } as const;
/** A key / pick card's soft bottom lip. */
const LIP = `inset 0 -2.5px 0 ${softMix('#7c3aed', 0.3)}`;

export interface Player {
  name: string; url: string | null; emoji: string | null;
  /** Profile accent for the letter tile (ART_SPEC §20), when known. */
  accent?: string | null;
  /** FINISH_SPEC AN5: the player's id / saved mascot / cast / frame / Pro flag when known. */
  userId?: string | null;
  config?: unknown;
  castId?: string | null;
  frame?: string | null;
  pro?: boolean | null;
}

interface BoardProps<S> {
  state: S;
  me: Side;
  you: Player;
  them: Player;
  active: boolean;
  busy: boolean;
  /** Bumps when a new round / flip arrives, so the reveal animates once. */
  revealKey: number;
  onMove: (move: FriendlyMove) => Promise<boolean>;
  /** The game's accent (its tray color while playing). */
  accent: string;
  /** The tray's wash: playing, or purple / slate once the match is won / lost. */
  tray: TrayState;
}

const PICKS: RpsPick[] = ['rock', 'paper', 'scissors'];
/** 2.8 item 9d: the ChatGPT pocket set (docs/design/brand/2.8/pocket) — mitten hands and the Call It coin faces. */
const POCKET_ART: Record<string, ArtName> = {
  rock: 'art-pocket-rps-rock', paper: 'art-pocket-rps-paper', scissors: 'art-pocket-rps-scissors',
  heads: 'art-pocket-coin-heads-w', tails: 'art-pocket-coin-tails-crest',
};

function Art({ name, size }: { name: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc(POCKET_ART[name] ?? 'art-pocket-rps-rock')} alt={name} loading="lazy" decoding="async" width={size} height={size} draggable={false} style={{ width: size, height: size, objectFit: 'contain' }} />;
}

/** One shipped pocket piece at a given height (aspect from the real size). */
function PocketPiece({ name, height, style, className }: { name: ArtName; height: number; style?: React.CSSProperties; className?: string }) {
  const [w, h] = ART_SIZE[name];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc(name)} alt="" aria-hidden="true" width={Math.round((height * w) / h)} height={height} draggable={false} decoding="async" className={className} style={{ width: 'auto', height, ...style }} />;
}

/**
 * A glossy word tile from the pocket set (art-pocket-tile-purple / gold / white), the letter drawn live on
 * top in the house ink; it pops in when placed (<= 250 ms; Reduce Motion: static).
 */
function ArtTile({ tone, size, fontSize, radius = 8, pop = false, style, children }: {
  tone: 'purple' | 'gold' | 'white'; size: number; fontSize: number; radius?: number; pop?: boolean; style?: React.CSSProperties; children?: React.ReactNode;
}) {
  return (
    <span
      className={`relative inline-flex items-center justify-center font-black uppercase ${pop && !prefersReducedMotion() ? 'gt-pop' : ''}`}
      style={{ width: size, height: size, fontSize, borderRadius: radius, color: '#2a1650', ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artSrc(`art-pocket-tile-${tone}` as ArtName)} alt="" aria-hidden="true" draggable={false} decoding="async" className="absolute inset-0 w-full h-full pointer-events-none" style={{ objectFit: 'fill' }} />
      <span className="relative" style={{ textShadow: tone === 'white' ? undefined : '0 1px 0 rgba(255,255,255,0.45)' }}>{children}</span>
    </span>
  );
}

/**
 * The Call It coin (2.8 item 9d): heads is the canonical W coin, tails the crest. A fresh flip plays the
 * set's frames — face, tilt, edge, tilt, the landed face — with a lift and a soft shadow (transform/opacity
 * only, about 0.9 s). Reduce Motion: the landed face, nothing else.
 */
function CoinFlip({ face, flipKey }: { face: CoinFace; flipKey: number }) {
  const landed: ArtName = face === 'heads' ? 'art-pocket-coin-heads-w' : 'art-pocket-coin-tails-crest';
  const [frame, setFrame] = useState<ArtName>(landed);
  const [lift, setLift] = useState(false);
  useEffect(() => {
    if (!flipKey || prefersReducedMotion()) { setFrame(landed); return; }
    const seq: Array<[ArtName, number]> = [['art-pocket-coin-tilt', 0], ['art-pocket-coin-edge', 150], ['art-pocket-coin-tilt', 300], ['art-pocket-coin-edge', 420], ['art-pocket-coin-tilt', 540], [landed, 680]];
    setLift(true);
    const ids = seq.map(([f, at]) => window.setTimeout(() => setFrame(f), at));
    const end = window.setTimeout(() => setLift(false), 700);
    return () => { ids.forEach(clearTimeout); clearTimeout(end); };
  }, [flipKey, landed]);
  return (
    // The Call It table (art-pocket-board-call-it-table): the coin hovers over its cushion and lands on it.
    <div className="relative" style={{ width: 210, height: 214 }}>
      <PocketPiece name="art-pocket-board-call-it-table" height={138} className="absolute" style={{ left: '50%', bottom: 0, marginLeft: -105, width: 210 }} />
      <div className="absolute left-0 right-0 flex items-center justify-center" style={{ top: 0, height: 130, transform: lift ? 'translateY(-26px)' : 'translateY(8px)', transition: 'transform 340ms cubic-bezier(.2,.7,.3,1)', willChange: 'transform' }}>
        <PocketPiece name={frame} height={frame === 'art-pocket-coin-edge' ? 36 : 118} />
      </div>
    </div>
  );
}

// ── Rock Paper Scissors ─────────────────────────────────────────────────────

export function RpsBoard({ state, me, them, active, busy, revealKey, onMove, accent, tray }: BoardProps<RpsState>) {
  const theirSide = otherSide(me);
  const theirPick = state.picks[theirSide] as string | undefined;
  const myPick = state.picks[me];
  const [pending, setPending] = useState<RpsPick | null>(null);
  const last = state.rounds[state.rounds.length - 1];
  // A fresh round result flips over for a moment; once the match is over it stays.
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    if (!revealKey) return;
    setRevealing(true);
    const t = setTimeout(() => setRevealing(false), 2600);
    return () => clearTimeout(t);
  }, [revealKey]);
  // My pick landed (or the round resolved and reset the picks): drop the optimistic one.
  useEffect(() => { setPending(null); }, [myPick, state.rounds.length]);
  const showReveal = !!last && (revealing || !active);
  const THEM = them.name.toUpperCase();
  const chosen = myPick ?? pending;

  const pick = async (p: RpsPick) => {
    if (!active || busy || myPick || pending) return;
    setPending(p);
    const ok = await onMove({ kind: 'rps', pick: p });
    if (!ok) setPending(null);
  };

  // 2.8 item 9d: the arena (art-pocket-board-rps-arena) is the stage: the two hands sit in its two wells.
  // Before the reveal the left well holds your locked pick and the right the hidden fist; on a reveal both
  // hands flip in together with the clash burst between them. Reduce Motion: no flip, no burst.
  const calm = prefersReducedMotion();
  const ARENA_W = 300;
  const ARENA_H = Math.round((ARENA_W * ART_SIZE['art-pocket-board-rps-arena'][1]) / ART_SIZE['art-pocket-board-rps-arena'][0]);
  const wellStyle = (leftPct: number): React.CSSProperties => ({
    position: 'absolute', left: `${leftPct * 100}%`, top: '43%', width: 84, height: 84, marginLeft: -42, marginTop: -42,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  const hand = (side: Side, leftPct: number) => {
    const p = last![side];
    const won = last!.winner === side;
    return (
      <div key={`${revealKey}-${side}`} style={{ ...wellStyle(leftPct), animation: revealing && !calm ? 'friends-flip 0.45s ease-out both' : undefined, filter: won ? `drop-shadow(0 0 10px ${side === me ? TILE.you : TILE.them})` : undefined }}>
        <Art name={p} size={80} />
      </div>
    );
  };
  const reveal = showReveal && !!last;
  const lastLine = last
    ? last.winner === null ? 'Tie' : last.winner === me ? 'You won the round' : `${them.name} won the round`
    : null;

  return (
    <div className="flex flex-col items-center gap-3">
      <GameTray accent={accent} state={tray} className="w-full flex flex-col items-center gap-1.5">
        <div className="relative" style={{ width: ARENA_W, height: ARENA_H }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artSrc('art-pocket-board-rps-arena')} alt="" aria-hidden="true" width={ARENA_W} height={ARENA_H} draggable={false} decoding="async" style={{ width: ARENA_W, height: ARENA_H }} />
          {reveal ? (
            <>
              {hand(me, 0.30)}
              {hand(theirSide, 0.74)}
              {revealing && !calm && (
                <PocketPiece name="art-pocket-clash-burst" height={70} className="absolute pointer-events-none"
                  style={{ left: '52%', top: '43%', marginLeft: -35, marginTop: -35, animation: 'friends-flip 0.35s ease-out both', opacity: 0.95 }} />
              )}
            </>
          ) : (
            <>
              <div style={wellStyle(0.30)}>{chosen ? <Art name={chosen} size={80} /> : null}</div>
              <div style={wellStyle(0.74)} aria-label={theirPick ? `${them.name} picked` : `${them.name} has not picked`}>
                <PocketPiece name="art-pocket-rps-hidden" height={80} style={{ opacity: theirPick ? 1 : 0.4 }} />
              </div>
            </>
          )}
        </div>
        <div className="w-full flex justify-between px-6 text-[10px] font-black uppercase" style={{ letterSpacing: 0.8, color: FR.label }}>
          <span style={{ color: reveal && last!.winner === me ? TILE.you : undefined }}>YOU{reveal && last!.winner === me ? ' · WON' : ''}</span>
          <span className="truncate" style={{ maxWidth: 120, color: reveal && last!.winner === theirSide ? TILE.them : undefined }}>{them.name}{reveal && last!.winner === theirSide ? ' · WON' : ''}</span>
        </div>
        {!reveal && active && (theirPick
          ? <span className="text-[11px] font-black" style={{ color: FR.online, letterSpacing: 0.6 }}>✓ {THEM} PICKED</span>
          : <span className="text-[11px] font-black" style={{ color: FR.label, letterSpacing: 0.6 }}>{THEM} IS PICKING</span>)}
        {!reveal && last && (
          <span className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: FR.label }}>
            Last round: <Art name={last[me]} size={18} /> vs <Art name={last[theirSide]} size={18} /> · {lastLine}
          </span>
        )}
      </GameTray>

      {active && (
        <>
          <div className="w-full"><SectionLabel>Your pick</SectionLabel></div>
          <div className="flex justify-center gap-2.5">
            {PICKS.map((p) => {
              const sel = chosen === p;
              const locked = !!chosen || busy;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => pick(p)}
                  disabled={locked && !sel}
                  aria-pressed={sel}
                  aria-label={p}
                  className="flex flex-col items-center justify-center gap-1 transition-transform active:scale-95"
                  style={{
                    width: 104, height: 118, borderRadius: 16,
                    ...(sel ? { background: TILE.you, border: `1.5px solid ${TILE.you}` } : EMPTY),
                    boxShadow: sel ? '0 0 16px rgba(124,58,237,0.55)' : `${LIP}, 0 4px 10px rgba(124,58,237,0.12)`,
                    opacity: locked && !sel ? 0.5 : 1,
                  }}
                >
                  <Art name={p} size={70} />
                  <span className="text-[11px] font-black uppercase" style={{ color: sel ? '#ffffff' : '#2a1650', letterSpacing: 0.6 }}>{p}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[12px] font-bold" style={{ color: FR.label }}>
            {chosen ? `Locked in. ${theirPick ? 'Flipping…' : `Waiting on ${them.name}.`}` : 'Both picks flip at once.'}
          </p>
        </>
      )}
    </div>
  );
}

// ── Tic-Tac-Tile ────────────────────────────────────────────────────────────

/** A Tic-Tac-Tile piece (J2): the 3D purple X (you) or pink O (them); decorative, the cell carries the label. */
function Piece({ side }: { side: 'x' | 'o' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={pieceSrc(side === 'x' ? 'ttt-x' : 'ttt-o')}
      alt=""
      aria-hidden="true"
      width={256}
      height={256}
      draggable={false}
      className="gt-pop pointer-events-none select-none"
      style={{ width: '76%', height: '76%', objectFit: 'contain', filter: 'drop-shadow(0 2px 2px rgba(40,20,80,0.25))' }}
    />
  );
}

const TTT_CELL = 92;
const TTT_GAP = 10;

/** Where the win strike sits over the 3 x 3 grid: the middle, length and angle of the line through its three cells. */
export function tttStrike(line: [number, number, number]): { cx: number; cy: number; len: number; deg: number } {
  const pos = (i: number) => ({ x: (i % 3) * (TTT_CELL + TTT_GAP) + TTT_CELL / 2, y: Math.floor(i / 3) * (TTT_CELL + TTT_GAP) + TTT_CELL / 2 });
  const a = pos(line[0]);
  const b = pos(line[2]);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) + TTT_CELL * 0.7;
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, len, deg: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** The O piece's pink (the legend dot). */
const TTT_O = '#ec4899';

export function TttBoard({ state, me, them, active, busy, onMove, accent, tray }: BoardProps<TttState>) {
  const [pendingCell, setPendingCell] = useState<number | null>(null);
  const myTurn = active && whoseTurn(state) === me;
  const sig = `${state.board.join(',')}|${state.games.length}`;
  useEffect(() => { setPendingCell(null); }, [sig]);
  const board = [...state.board];
  if (pendingCell !== null && !board[pendingCell]) board[pendingCell] = me;
  const threats = myTurn && pendingCell === null ? tttThreats(state.board, me) : [];
  // The winning three glow (the server clears the board after a game, so this shows only when a line is on it).
  const winLine = tttLine(board)?.cells ?? [];

  const strike = winLine.length === 3 ? tttStrike(winLine as [number, number, number]) : null;

  const tap = async (i: number) => {
    if (!myTurn || busy || pendingCell !== null || state.board[i]) return;
    setPendingCell(i);
    const ok = await onMove({ kind: 'ttt', cell: i });
    if (!ok) setPendingCell(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 2.8 item 9d: the YOUR TURN flag waves in when it is your move. */}
      {myTurn && <PocketPiece name="art-pocket-yourturn-flag" height={44} className={prefersReducedMotion() ? undefined : 'gt-pop'} />}
      <GameTray accent={accent} state={tray}>
      <div className="relative grid grid-cols-3" style={{ gap: TTT_GAP }}>
        {board.map((m, i) => {
          const mine = m === me;
          const theirs = !!m && !mine;
          const threat = threats.includes(i);
          const win = winLine.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              disabled={!myTurn || !!m}
              aria-label={m ? (mine ? 'Your tile' : `${them.name}'s tile`) : `Empty tile ${i + 1}`}
              className="flex items-center justify-center transition-transform active:scale-95"
              style={{
                width: TTT_CELL, height: TTT_CELL, borderRadius: 16,
                background: mine ? softMix(TILE.you, 0.16) : theirs ? softMix(TTT_O, 0.14) : EMPTY.background,
                border: mine ? `1.5px solid ${softMix(TILE.you, 0.4)}` : theirs ? `1.5px solid ${softMix(TTT_O, 0.4)}` : EMPTY.border,
                boxShadow: win
                  ? `${LIP}, 0 0 0 2.5px ${mine ? TILE.you : TTT_O}, 0 0 18px ${mine ? TILE.you : TTT_O}aa`
                  : threat ? `${LIP}, 0 0 14px rgba(124,58,237,0.35)` : LIP,
                outline: threat ? `2px dashed ${TILE.you}` : undefined,
                outlineOffset: threat ? -6 : undefined,
                cursor: myTurn && !m ? 'pointer' : 'default',
              }}
            >
              {mine ? <Piece side="x" /> : theirs ? <Piece side="o" /> : null}
            </button>
          );
        })}
        {/* The win strike: the set's gold bar, stretched along the three tiles (scaleX in, transform only). */}
        {strike && (
          <span
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              left: strike.cx - strike.len / 2, top: strike.cy - 17, width: strike.len, height: 34,
              backgroundImage: `url(${artSrc('art-pocket-ttt-strike')})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
              transform: `rotate(${strike.deg}deg)`, transformOrigin: '50% 50%',
              animation: prefersReducedMotion() ? undefined : 'ttt-strike-in 380ms cubic-bezier(.2,.7,.3,1) both',
            }}
          />
        )}
      </div>
      </GameTray>
      <div className="flex items-center gap-4 text-[11px] font-black" style={{ letterSpacing: 0.8 }}>
        <span className="flex items-center gap-1.5" style={{ color: TILE.you }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: TILE.you }} /> YOU · X
        </span>
        <span className="flex items-center gap-1.5 uppercase" style={{ color: '#be185d' }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: TTT_O }} /> {them.name} · O
        </span>
      </div>
      {active && !myTurn && (
        <p className="text-[12px] font-bold" style={{ color: FR.label }}>{them.name}&apos;s move. It lands here live.</p>
      )}
    </div>
  );
}

// ── Call It ─────────────────────────────────────────────────────────────────

export function CoinBoard({ state, me, them, active, busy, revealKey, onMove, accent, tray }: BoardProps<CoinState>) {
  const last = state.rounds[state.rounds.length - 1];
  const face: CoinFace = last ? last.flip : 'heads';
  const myCall = active && whoseTurn(state) === me;
  const [calling, setCalling] = useState<CoinFace | null>(null);
  const THEM = them.name.toUpperCase();

  const call = async (c: CoinFace) => {
    if (!myCall || busy || calling) return;
    setCalling(c);
    await onMove({ kind: 'coin', call: c });
    setCalling(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <GameTray accent={accent} state={tray} className="w-full flex flex-col items-center gap-2">
        <CoinFlip face={face} flipKey={revealKey} />
        <p className="text-[12px] font-black uppercase text-center" style={{ color: FR.ink, letterSpacing: 0.6 }}>
          {last
            ? `${last.flip} · ${last.caller === me ? 'you' : them.name} called ${last.call}`
            : 'No flips yet'}
        </p>
      </GameTray>

      {active && (
        <>
          <div className="w-full"><SectionLabel>{myCall ? 'Your call' : `${THEM} calls`}</SectionLabel></div>
          {myCall ? (
            <div className="w-full grid grid-cols-2 gap-2.5">
              {(['heads', 'tails'] as CoinFace[]).map((c) => (
                <CandyButton
                  key={c}
                  color={c === 'heads' ? 'purple' : 'pink'}
                  size="md"
                  block
                  onClick={() => call(c)}
                  disabled={busy || calling !== null}
                >
                  {calling === c ? 'Flipping…' : c}
                </CandyButton>
              ))}
            </div>
          ) : (
            <p className="text-[12px] font-bold" style={{ color: FR.label }}>{them.name} calls this one. You&apos;ll see it land live.</p>
          )}
        </>
      )}

      <div className="w-full"><SectionLabel>What&apos;s on the line</SectionLabel></div>
      <span className="self-start px-3 flex items-center text-[12px] font-black rounded-full" style={{ height: 30, background: FR.soft, color: FR.ink }}>
        {state.stake}
      </span>
    </div>
  );
}

// ── Pass the Puzzle ─────────────────────────────────────────────────────────

const PASS_TILE = 44;

function passTileStyle(st: 'correct' | 'present' | 'absent'): React.CSSProperties {
  if (st === 'correct') return { background: TILE.you, color: '#ffffff', boxShadow: '0 0 6px rgba(124,58,237,0.45)' };
  if (st === 'present') return { background: TILE.them, color: '#ffffff' };
  return { background: TILE.absent, color: '#475569' };
}

export function PassBoard({ state, me, you, them, active, busy, onMove, answer, accent, tray }: BoardProps<PassState> & { answer: string | null }) {
  const [input, setInput] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const myTurn = active && whoseTurn(state) === me;
  const keyStates = passKeyStates(state.guesses);

  const submit = async () => {
    if (!myTurn || busy) return;
    if (input.length < 5) { setHint('Five letters, please'); return; }
    const ok = await onMove({ kind: 'pass', word: input });
    if (ok) setInput('');
  };

  const onKey = (key: string) => {
    setHint(null);
    if (!myTurn) { setHint(`It's ${them.name}'s guess`); return; }
    if (key === 'ENTER') { void submit(); return; }
    if (key === 'BACK') { setInput((v) => v.slice(0, -1)); return; }
    if (/^[A-Z]$/.test(key)) setInput((v) => (v.length < 5 ? v + key : v));
  };

  // Physical keyboard on desktop.
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') onKey('ENTER');
      else if (e.key === 'Backspace') onKey('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const chip = (p: Player | null, faded = false) => (
    <span className="shrink-0 flex items-center justify-center" style={{ width: 28, opacity: faded ? 0.4 : 1 }}>
      {p ? <FriendAvatar name={p.name} userId={p.userId} url={p.url} accent={p.accent} config={p.config} castId={p.castId} frame={p.frame} pro={p.pro} size={26} /> : <span style={{ width: 26, height: 26 }} />}
    </span>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <GameTray accent={accent} state={tray}>
      <div className="flex flex-col" style={{ gap: 5 }}>
        {Array.from({ length: PASS_MAX_GUESSES }, (_, r) => {
          const g = state.guesses[r];
          const current = !g && r === state.guesses.length && active;
          const who = g ? (g.by === me ? you : them) : current ? (myTurn ? you : them) : null;
          return (
            <div key={r} className="flex items-center" style={{ gap: 6 }}>
              {chip(who, current && !myTurn)}
              <div className="flex" style={{ gap: 5 }}>
                {Array.from({ length: 5 }, (_, i) => {
                  const letter = g ? g.word[i] : current && myTurn ? input[i] ?? '' : '';
                  const style: React.CSSProperties = g
                    ? passTileStyle(tileState(g.tiles[i] ?? 'ABSENT'))
                    : { ...EMPTY, color: '#2a1650', boxShadow: letter ? `0 0 0 2px #c4b5fd` : current ? `0 0 0 1.5px ${softMix('#7c3aed', 0.3)}` : undefined };
                  if (g) {
                    const st = tileState(g.tiles[i] ?? 'ABSENT');
                    return (
                      <ArtTile key={i} tone={st === 'correct' ? 'purple' : st === 'present' ? 'gold' : 'white'} size={PASS_TILE} fontSize={20} pop
                        style={st === 'absent' ? { opacity: 0.62 } : undefined}>
                        {letter}
                      </ArtTile>
                    );
                  }
                  return (
                    <span
                      key={i}
                      className="flex items-center justify-center font-black uppercase"
                      style={{ width: PASS_TILE, height: PASS_TILE, borderRadius: 8, fontSize: 20, ...style }}
                    >
                      {letter}
                    </span>
                  );
                })}
              </div>
              <span style={{ width: 28 }} />
            </div>
          );
        })}
      </div>
      </GameTray>

      {hint && <p className="text-[12px] font-bold" style={{ color: '#dc2626' }}>{hint}</p>}
      {answer && (
        <p className="text-[12px] font-black uppercase" style={{ color: FR.ink, letterSpacing: 0.8 }}>
          The word was <span style={{ color: TILE.you, letterSpacing: 2 }}>{answer}</span>
        </p>
      )}
      {active && (
        <>
          <p className="text-[12px] font-bold" style={{ color: FR.label }}>
            {myTurn ? 'Your guess. Then it passes to ' + them.name + '.' : `${them.name} is guessing. The board fills in live.`}
          </p>
          <div className="w-full" style={{ opacity: myTurn ? 1 : 0.55 }}>
            <Keyboard onKey={onKey} letterStates={keyStates} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared: physical keys on desktop ────────────────────────────────────────

function usePhysicalKeys(active: boolean, onKey: (key: string) => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') onKey('ENTER');
      else if (e.key === 'Backspace') onKey('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
}

const LETTER_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** Ghost's keyboard: letters only (no ENTER / backspace); the picked key fills purple. */
function LetterKeys({ onKey, selected, disabled }: { onKey: (k: string) => void; selected: string | null; disabled: boolean }) {
  return (
    <div className="w-full flex flex-col" style={{ gap: 6, opacity: disabled ? 0.55 : 1 }}>
      {LETTER_ROWS.map((row) => (
        <div key={row} className="flex justify-center" style={{ gap: 5 }}>
          {[...row].map((k) => {
            const sel = k === selected;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onKey(k)}
                aria-label={k}
                aria-pressed={sel}
                className="flex items-center justify-center font-black transition-transform active:scale-95"
                style={{
                  flex: '1 1 0', maxWidth: 36, height: 46, borderRadius: 8, fontSize: 16,
                  ...(sel ? { background: TILE.you, border: `1.5px solid ${TILE.you}` } : EMPTY), color: sel ? '#ffffff' : '#2a1650',
                  boxShadow: sel ? '0 0 10px rgba(124,58,237,0.45)' : LIP,
                }}
              >
                {k}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const sideColor = (mine: boolean) => (mine ? TILE.you : TILE.them);
const sideGlow = (mine: boolean) => (mine ? '0 0 6px rgba(124,58,237,0.4)' : '0 0 6px rgba(245,158,11,0.4)');

// ── Ghost ───────────────────────────────────────────────────────────────────

export function GhostBoard({ state, me, them, active, busy, revealKey, onMove, accent, tray }: BoardProps<GhostState>) {
  const myTurn = active && whoseTurn(state) === me;
  const [pick, setPick] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const sig = `${state.fragment}|${state.rounds.length}`;
  useEffect(() => { setPick(null); setHint(null); }, [sig]);
  const tiles = ghostTiles(state, me);
  const last = state.rounds[state.rounds.length - 1];
  const card = last && state.fragment === '' ? ghostRoundCard(last, me, them.name) : null;
  const showSlot = myTurn;
  const count = tiles.length + (showSlot ? 1 : 0);
  const size = Math.min(52, Math.floor((340 - Math.max(0, count - 1) * 6) / Math.max(1, count)));

  const send = async () => {
    if (!myTurn || busy || !pick) return;
    const ok = await onMove({ kind: 'ghost', letter: pick });
    if (ok) setPick(null);
  };

  const onKey = (key: string) => {
    setHint(null);
    if (!myTurn) { setHint(`It's ${them.name}'s letter`); return; }
    if (key === 'ENTER') { void send(); return; }
    if (key === 'BACK') { setPick(null); return; }
    if (/^[A-Z]$/.test(key)) setPick(key);
  };
  usePhysicalKeys(active, onKey);

  return (
    <div className="flex flex-col items-center gap-3">
      {card && (
        <div
          key={revealKey}
          className="w-full flex flex-col items-center gap-0.5 px-3 py-2.5 text-center"
          style={{ background: FR.soft, borderRadius: 14, animation: revealKey ? 'friends-flip 0.45s ease-out both' : undefined }}
        >
          <span className="text-[13px] font-black" style={{ color: FR.ink }}>
            <span style={{ letterSpacing: 2 }}>{card.letters}</span> — {card.text}
          </span>
          <span className="text-[10.5px] font-black uppercase" style={{ color: FR.mid, letterSpacing: 0.8 }}>
            Round {state.rounds.length} to {card.youLost ? them.name : 'you'}
          </span>
        </div>
      )}

      <GameTray accent={accent} state={tray} className="w-full">
      <div className="flex justify-center items-center" style={{ gap: 6, minHeight: 56 }}>
        {tiles.map((t, i) => (
          <ArtTile key={i} tone={t.mine ? 'purple' : 'gold'} size={size} fontSize={Math.round(size * 0.46)} radius={10} pop={i === tiles.length - 1}>
            {t.letter}
          </ArtTile>
        ))}
        {showSlot && (
          <span
            className="flex items-center justify-center font-black uppercase"
            style={{
              width: size, height: size, borderRadius: 10, fontSize: Math.round(size * 0.46),
              background: softMix('#7c3aed', pick ? 0.16 : 0.06), color: TILE.you, border: `2px dashed ${TILE.you}`,
            }}
            aria-label={pick ? `Your letter ${pick}` : 'Your letter goes here'}
          >
            {pick ?? ''}
          </span>
        )}
        {tiles.length === 0 && !showSlot && (
          <span className="text-[12px] font-bold" style={{ color: FR.label }}>No letters yet</span>
        )}
      </div>
      </GameTray>

      {hint && <p className="text-[12px] font-bold" style={{ color: '#dc2626' }}>{hint}</p>}

      {active && (
        <>
          <p className="text-[12px] font-bold text-center" style={{ color: FR.label }}>
            {myTurn
              ? state.fragment ? 'Your letter. Pick one, then add it.' : 'You start this round. Pick any letter.'
              : `${them.name} is adding a letter. It lands here live.`}
          </p>
          {myTurn && (
            <CastButton screen="pink" color="pink" block icon={pick ? 'plus' : undefined} onClick={() => void send()} disabled={!pick || busy}>
              {pick ? `ADD ${pick}` : 'PICK A LETTER'}
            </CastButton>
          )}
          <LetterKeys onKey={onKey} selected={pick} disabled={!myTurn} />
        </>
      )}
      <p className="text-[11.5px] font-bold text-center" style={{ color: FR.label }}>
        Spell a word and you lose the round. Leave a dead end and you lose it too.
      </p>
    </div>
  );
}

// ── Word Chain ──────────────────────────────────────────────────────────────

const CHAIN_TILE = 30;
const INPUT_TILE = 40;

export function ChainBoard({ state, me, you, them, active, busy, onMove, accent, tray }: BoardProps<ChainState>) {
  const myTurn = active && whoseTurn(state) === me;
  const locked = chainNeededLetter(state);
  const [typed, setTyped] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => { setTyped(''); setHint(null); }, [state.words.length]);
  const word = (locked ?? '') + typed;
  const room = WORD_MAX - (locked ? 1 : 0);

  const submit = async () => {
    if (!myTurn || busy) return;
    const err = chainPrecheck(state, me, word);
    if (err) { setHint(err); return; }
    const ok = await onMove({ kind: 'chain', word });
    if (ok) setTyped('');
  };

  const onKey = (key: string) => {
    setHint(null);
    if (!myTurn) { setHint(`It's ${them.name}'s word`); return; }
    if (key === 'ENTER') { void submit(); return; }
    if (key === 'BACK') { setTyped((v) => v.slice(0, -1)); return; }
    if (/^[A-Z]$/.test(key)) setTyped((v) => (v.length < room ? v + key : v));
  };
  usePhysicalKeys(active, onKey);

  return (
    <div className="flex flex-col items-center gap-3">
      <GameTray accent={accent} state={tray} className="w-full">
      <div className="w-full flex flex-col" style={{ gap: 6 }}>
        {state.words.length === 0 && (
          <p className="text-center text-[12px] font-bold py-2" style={{ color: FR.label }}>
            Any {WORD_MIN} to {WORD_MAX} letter word opens the chain.
          </p>
        )}
        {state.words.map((w, wi) => {
          const mine = w.by === me;
          const newest = wi === state.words.length - 1;
          const p = mine ? you : them;
          return (
            <div key={wi} className="flex items-center" style={{ gap: 6 }}>
              <FriendAvatar name={p.name} userId={p.userId} url={p.url} accent={p.accent} config={p.config} castId={p.castId} frame={p.frame} pro={p.pro} size={22} />
              <div className="flex-1 flex" style={{ gap: 3 }}>
                {[...w.word].map((ch, i) => {
                  const glow = newest && i === w.word.length - 1;
                  return (
                    <ArtTile
                      key={i}
                      tone={mine ? 'purple' : 'gold'} size={CHAIN_TILE} fontSize={14} radius={6} pop={glow}
                      style={glow ? { boxShadow: `0 0 0 2px #ffffff, 0 0 0 4px ${FR.solid}, 0 0 14px ${FR.solid}` } : undefined}
                    >
                      {ch}
                    </ArtTile>
                  );
                })}
              </div>
              <span
                className="shrink-0 px-2 flex items-center text-[11px] font-black rounded-full"
                style={{ height: 22, background: mine ? '#ede9fe' : '#fef3c7', color: mine ? '#6d28d9' : '#b45309' }}
              >
                +{w.points}
              </span>
            </div>
          );
        })}
      </div>
      </GameTray>

      {active && myTurn && (
        <div className="flex justify-center" style={{ gap: 5 }} aria-label="Your word">
          {Array.from({ length: WORD_MAX }, (_, i) => {
            const ch = word[i] ?? '';
            const isLocked = !!locked && i === 0;
            const optional = i >= WORD_MIN;
            const style: React.CSSProperties = isLocked
              ? { background: TILE.you, color: '#ffffff', boxShadow: `0 0 10px ${TILE.you}88` }
              : ch
                ? { ...EMPTY, color: '#2a1650', boxShadow: '0 0 0 2px #c4b5fd' }
                : optional
                  ? { background: softMix('#7c3aed', 0.04), color: '#2a1650', border: '1.5px dashed #c4b5fd' }
                  : { ...EMPTY, color: '#2a1650', boxShadow: LIP };
            return (
              <span
                key={i}
                className="relative flex items-center justify-center font-black uppercase"
                style={{ width: INPUT_TILE, height: INPUT_TILE, borderRadius: 8, fontSize: 18, ...style }}
              >
                {ch}
                {isLocked && <Lock className="absolute" style={{ width: 9, height: 9, top: 3, right: 3, color: '#ffffff' }} aria-label="Locked" />}
              </span>
            );
          })}
        </div>
      )}

      {hint && <p className="text-[12px] font-bold" style={{ color: '#dc2626' }}>{hint}</p>}

      {active && (
        <>
          <p className="text-[12px] font-bold text-center" style={{ color: FR.label }}>
            {myTurn
              ? locked ? `Your word. It starts with ${locked}.` : 'Your word. Any word opens the chain.'
              : locked ? `${them.name} needs a word starting with ${locked}. It lands here live.` : `${them.name} is opening the chain. It lands here live.`}
          </p>
          <div className="w-full" style={{ opacity: myTurn ? 1 : 0.55 }}>
            <Keyboard onKey={onKey} />
          </div>
        </>
      )}
      <p className="text-[11.5px] font-bold text-center" style={{ color: FR.label }}>
        A word scores its letters. No repeats. First to {CHAIN_TARGET} wins.
      </p>
    </div>
  );
}
