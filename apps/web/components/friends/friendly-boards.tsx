'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CHAIN_TARGET, CHAIN_WORD_MAX, PASS_MAX_GUESSES, WORD_MIN, tttLine, whoseTurn,
  type ChainState, type CoinFace, type CoinState, type FriendlyMove, type GhostState, type PassState, type RpsPick, type RpsState,
  type Side, type TttState,
} from '@wordle-duel/core';
import { Flag, Lock } from 'lucide-react';
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
import { haptic } from '@/lib/haptics';
import { BubbleOneLine } from '@/components/ui/bubble-text';
import type { TrayState } from '@/lib/game-tray';
import { softMix } from '@/lib/soft-surface';
import {
  CHAIN_BOARD_H, CHAIN_BOARD_W, CHAIN_INTERIOR, CHAIN_LINK_ASPECT, GHOST_PANEL, GHOST_TRAY_H, GHOST_TRAY_W, PASS_TRAY_H, PASS_TRAY_W,
  TTT_GRID_H, TTT_GRID_W, chainInputTile, chainLayout, ghostTileSize, passGeometry, tttCell, tttStrike,
} from '@/lib/pocket-boards';

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
  /** The last move's error (keyboard games show it right above their keyboard, iOS parity). */
  error?: string | null;
}

const PICKS: RpsPick[] = ['rock', 'paper', 'scissors'];
/** 2.8 item 9d: the ChatGPT pocket set (docs/design/brand/2.8/pocket) — mitten hands and the Call It coin faces. */
const POCKET_ART: Record<string, ArtName> = {
  rock: 'art-pocket-rps-rock', paper: 'art-pocket-rps-paper', scissors: 'art-pocket-rps-scissors',
  heads: 'art-pocket-coin-heads-w', tails: 'art-pocket-coin-tails-crest',
};

/**
 * A hand standing on the ring's mat: the outlined variant (art-pocket-rps-<hand>-ring: a baked deep-plum outline + shadow, ~8% padding each
 * side). It is drawn at the SAME scale the plain hand has in a `size` box, so the visible hand is unchanged. `clipTop` crops the top
 * share of the art (the face-down fist hides its ? bubble: the bottom 62% only).
 */
function RingHand({ name, size, clipTop = 0 }: { name: 'rock' | 'paper' | 'scissors' | 'hidden'; size: number; clipTop?: number }) {
  const plain = ART_SIZE[`art-pocket-rps-${name}` as ArtName];
  const ring = ART_SIZE[`art-pocket-rps-${name}-ring` as ArtName];
  const k = size / Math.max(plain[0], plain[1]);
  const w = Math.round(ring[0] * k);
  const h = Math.round(ring[1] * k);
  const shown = Math.round(h * (1 - clipTop));
  return (
    <div aria-hidden="true" style={{ width: w, height: shown, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artSrc(`art-pocket-rps-${name}-ring` as ArtName)} alt="" draggable={false} decoding="async" width={ring[0]} height={ring[1]}
        style={{ position: 'absolute', left: 0, bottom: 0, width: w, height: h, maxWidth: 'none' }} />
    </div>
  );
}

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
 * The width a board can use (px), measured once and on resize, capped at `max` (the art is laid out from it, never stretched).
 * Starts at a phone-ish default so the first paint is already close.
 */
function useBoardWidth(max: number, deskMax: number = max): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(Math.min(max, 340));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Desktop (>= 1024 px, the website layout): the board column is wide, so the board may grow to `deskMax`; phones and tablets keep `max`.
    const cap = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches ? deskMax : max);
    const measure = () => { const w = Math.floor(el.getBoundingClientRect().width); if (w > 0) setWidth(Math.min(cap(), w)); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [max, deskMax]);
  return [ref, width];
}

/** A board's art as a full-width <img> sized from its real pixels (never stretched). */
function BoardArt({ name, width, style }: { name: ArtName; width: number; style?: React.CSSProperties }) {
  const [w, h] = ART_SIZE[name];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc(name)} alt="" aria-hidden="true" width={w} height={h} draggable={false} decoding="async" className="pointer-events-none select-none" style={{ display: 'block', width, height: Math.round((width * h) / w), maxWidth: 'none', ...style }} />;
}

/** "YOUR TURN" over a pocket board while it is your move: a gold capsule (flag + words) that pops in once, then rests (iOS / Android parity). */
export function YourTurnLabel() {
  return (
    <div role="status" aria-label="Your turn" className={`inline-flex items-center gap-[5px] rounded-full px-3 py-[5px] ${prefersReducedMotion() ? '' : 'gt-pop'}`}
      style={{ background: 'linear-gradient(#fde68a, #f5b82e)', border: '1px solid rgba(255, 255, 255, 0.55)', boxShadow: '0 3px 10px rgba(245, 158, 11, 0.35)', color: '#3b2300' }}>
      <Flag className="w-3 h-3" fill="#3b2300" strokeWidth={2.5} aria-hidden="true" />
      <span className="text-[12px] font-black tracking-[0.07em] leading-none">YOUR TURN</span>
    </div>
  );
}

/**
 * The opponent's well in Rock Paper Scissors (founder 10-10, iOS / Android parity): while they pick, their hand cycles
 * rock → paper → scissors (the "Your pick" art, one swap every 0.42 s; a still rock under Reduce Motion). Once their pick is
 * in: the face-down fist only (the bottom 63% of art-pocket-rps-hidden, clipped — never the ? bubble).
 */
function TheirHand({ picked, size = 80 }: { picked: boolean; size?: number }) {
  const [cycle, setCycle] = useState(0);
  const still = prefersReducedMotion();
  useEffect(() => {
    if (picked || still) return;
    const id = window.setInterval(() => setCycle((c) => (c + 1) % 3), 420);
    return () => window.clearInterval(id);
  }, [picked, still]);
  if (picked) return <RingHand name="hidden" size={size} clipTop={0.38} />;
  const hand = still ? 'rock' : (['rock', 'paper', 'scissors'] as const)[cycle];
  return <div aria-hidden="true" style={{ opacity: still ? 0.6 : 0.75 }}><RingHand name={hand} size={size} /></div>;
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
      // iOS PocketTile: house ink on the white tile, white letters on purple / gold (dark ink on the purple art was unreadable).
      style={{ width: size, height: size, fontSize, borderRadius: radius, color: tone === 'white' ? '#2a1650' : '#ffffff', ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artSrc(`art-pocket-tile-${tone}` as ArtName)} alt="" aria-hidden="true" draggable={false} decoding="async" className="absolute inset-0 w-full h-full pointer-events-none" style={{ objectFit: 'fill' }} />
      <span className="relative" style={{ textShadow: tone === 'white' ? undefined : '0 1px 1px rgba(0,0,0,0.3)' }}>{children}</span>
    </span>
  );
}

const COIN_ART: Record<CoinFace, ArtName> = { heads: 'art-pocket-coin-heads-w', tails: 'art-pocket-coin-tails-crest' };
/** The flip's timeline (ms, founder 10-10, iOS SpinningCoin): crouch, launch, the turns slowing as it falls, landing squash + bounce + teeter. */
const COIN_T = { crouch: 140, rise: 713, fall: 837, land: 80, bounce: 140, settle: 140, teeterA: 160, teeterB: 160, teeterC: 120 } as const;
/** The spin's haptic ticks slow with the turns: the gaps (ms) after launch. */
const COIN_TICKS = [120, 130, 150, 180, 220, 270, 340] as const;

/**
 * The Call It coin (2.8 item 9d; founder 10-10 "smoother and a bit more suspenseful"): heads is the canonical W coin, tails the
 * crest. A fresh flip crouches, launches, turns end over end in real 3D (five turns, fast at first and slowing as it falls,
 * ~1.55 s), lands with a squash, a small bounce and a teeter, THEN the gold glow, a success buzz and the result line (`caption`).
 * Web Animations on transform / opacity only (compositor). Reduce Motion: the landed face, the caption at once.
 */
function CoinFlip({ face, flipKey, caption, width }: { face: CoinFace; flipKey: number; caption?: string | null; width: number }) {
  // The stage (art-pocket-coin-stage) fills ~88% of the card; the coin floats over its top surface with room above for the hop.
  const W = width;
  const H = Math.round(W * 0.26);
  const stageW = Math.round(W * 0.88);
  const stageH = Math.round((stageW * ART_SIZE['art-pocket-coin-stage'][1]) / ART_SIZE['art-pocket-coin-stage'][0]);
  const padB = Math.round(W * 0.03);
  const rest = padB + Math.round(stageH * 0.9);   // the coin's bottom edge, from the card's bottom
  const hop = Math.round(W * 0.15);
  const cardH = rest + H + hop + Math.round(W * 0.03);
  const hopRef = useRef(hop);
  hopRef.current = hop;
  const [landed, setLanded] = useState<CoinFace>(face);
  const [settled, setSettled] = useState(true);
  const shown = useRef<CoinFace>(face);
  const liftRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!flipKey || prefersReducedMotion()) { shown.current = face; setLanded(face); setSettled(true); return; }
    const lift = liftRef.current; const turn = turnRef.current; const glow = glowRef.current;
    if (!lift || !turn || !glow || typeof lift.animate !== 'function') { shown.current = face; setLanded(face); setSettled(true); return; }
    // Start from the face showing now; end on the result after five whole turns (+ a half if it changes).
    const start = shown.current === face ? 0 : 180;
    shown.current = face;
    setLanded(face);
    setSettled(false);
    const T = COIN_T;
    const tUp = T.crouch + T.rise;
    const tDown = tUp + T.fall;
    const tLand = tDown + T.land;
    const tBounce = tLand + T.bounce;
    const tSettle = tBounce + T.settle;
    const tA = tSettle + T.teeterA;
    const tB = tA + T.teeterB;
    const total = tB + T.teeterC;
    const kf = (t: number, ty: number, sx: number, sy: number, rot: number, easing: string) =>
      ({ offset: t / total, transform: `translateY(${ty}px) scale(${sx}, ${sy}) rotate(${rot}deg)`, easing });
    const anims: Animation[] = [
      lift.animate([
        kf(0, 0, 1, 1, 0, 'ease-out'),
        kf(T.crouch, 0, 1.14, 0.86, 0, 'ease-out'),
        kf(tUp, -hopRef.current, 0.94, 1.06, 0, 'ease-in'),
        kf(tDown, 0, 1, 1, 0, 'ease-out'),
        kf(tLand, 0, 1.12, 0.88, 0, 'ease-out'),
        kf(tBounce, -12, 1, 1, 0, 'ease-in'),
        kf(tSettle, 0, 1, 1, 0, 'ease-in-out'),
        kf(tA, 0, 1, 1, 7, 'ease-in-out'),
        kf(tB, 0, 1, 1, -5, 'ease-out'),
        kf(total, 0, 1, 1, 0, 'linear'),
      ], { duration: total, fill: 'both' }),
      turn.animate([
        { transform: `rotateX(${start}deg)` },
        { transform: 'rotateX(1800deg)' },
      ], { duration: T.rise + T.fall, delay: T.crouch, easing: 'cubic-bezier(0.12, 0.55, 0.2, 1)', fill: 'both' }),
      // the reveal glow: blooms as the coin settles, holds, fades
      glow.animate([
        { opacity: 0, transform: 'scale(0.6)', offset: 0 },
        { opacity: 1, transform: 'scale(1)', offset: 0.18 },
        { opacity: 1, transform: 'scale(1)', offset: 0.6 },
        { opacity: 0, transform: 'scale(1)', offset: 1 },
      ], { duration: 1700, delay: total, fill: 'both' }),
    ];
    const ids: number[] = [];
    ids.push(window.setTimeout(() => haptic('medium'), T.crouch));
    let at = T.crouch;
    for (const gap of COIN_TICKS) { at += gap; ids.push(window.setTimeout(() => haptic('selection'), at)); }
    ids.push(window.setTimeout(() => haptic('heavy'), tLand));
    ids.push(window.setTimeout(() => { haptic('success'); setSettled(true); }, total));
    return () => { ids.forEach(clearTimeout); anims.forEach((a) => a.cancel()); };
  }, [flipKey, face]);
  const other: CoinFace = landed === 'heads' ? 'tails' : 'heads';
  const [cw, ch] = ART_SIZE[COIN_ART.heads];
  const CW = Math.round((H * cw) / ch);
  const faceStyle: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' };
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* The theater card: the backdrop fills it (aspect-fill, clipped to the corners), the velvet stage stands at the bottom, the coin hovers over it. */}
      <div className="relative overflow-hidden" style={{ width: W, height: cardH, borderRadius: 20 }} role="img" aria-label={settled ? `Coin, ${face}` : 'Coin flipping'}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc('art-pocket-coin-backdrop')} alt="" aria-hidden="true" draggable={false} decoding="async" width={1200} height={592}
          className="absolute inset-0 pointer-events-none select-none" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <PocketPiece name="art-pocket-coin-stage" height={stageH} className="absolute" style={{ left: '50%', bottom: padB, marginLeft: -stageW / 2, width: stageW }} />
        <div ref={glowRef} aria-hidden="true" className="absolute pointer-events-none"
          style={{ left: '50%', bottom: rest - Math.round(H * 0.55), width: Math.round(H * 2), height: Math.round(H * 2), marginLeft: -H, opacity: 0, background: 'radial-gradient(circle, rgba(253,230,138,0.7), rgba(253,230,138,0) 70%)' }} />
        <div className="absolute left-0 right-0 flex items-end justify-center" style={{ bottom: rest, height: H }}>
          <div ref={liftRef} style={{ transformOrigin: '50% 100%', willChange: 'transform' }}>
            <div style={{ perspective: 700 }}>
              <div ref={turnRef} style={{ position: 'relative', width: CW, height: H, transformStyle: 'preserve-3d' }}>
                <div style={faceStyle}><PocketPiece name={COIN_ART[landed]} height={H} /></div>
                <div style={{ ...faceStyle, transform: 'rotateX(180deg)' }}><PocketPiece name={COIN_ART[other]} height={H} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {caption !== undefined && (
        // The result line appears only once the coin has landed (no spoiler mid-flip); its space is held. It sits under the card, on the page.
        <p className="text-[12px] font-black uppercase text-center" style={{ color: FR.ink, letterSpacing: 0.6, opacity: settled ? 1 : 0, transition: 'opacity 250ms ease-out' }}>{caption}</p>
      )}
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
  // A fresh round result plays the suspense beat (founder 10-10): ROCK... PAPER... SCISSORS... SHOOT! with both fists pumping three
  // times, then both cards turn over together; once the match is over the result simply stays.
  const [revealing, setRevealing] = useState(false);
  const [beat, setBeat] = useState(-1);          // -1 not started, 0-2 the pumps, 3 SHOOT!
  const [turning, setTurning] = useState(false); // the cards are turning over
  const [flipped, setFlipped] = useState(false); // the turn has landed: the glow, the burst, the labels
  const iWon = !!last && last.winner === me;
  useEffect(() => {
    if (!revealKey) return;
    setRevealing(true);
    if (prefersReducedMotion()) { setBeat(-1); setTurning(false); setFlipped(true); const t = setTimeout(() => setRevealing(false), 2600); return () => clearTimeout(t); }
    setBeat(0); setTurning(false); setFlipped(false);
    haptic('light');
    const ids = [
      // each pump is 0.4 s (up, down, a beat); a light tick lands at the end of each
      window.setTimeout(() => { setBeat(1); haptic('light'); }, 400),
      window.setTimeout(() => { setBeat(2); haptic('light'); }, 800),
      window.setTimeout(() => { setBeat(3); haptic('light'); haptic('medium'); }, 1200),
      window.setTimeout(() => setTurning(true), 1420),
      window.setTimeout(() => { setFlipped(true); haptic('heavy'); }, 1600),
      window.setTimeout(() => { if (iWon) haptic('success'); }, 1800),
      window.setTimeout(() => setRevealing(false), 3600),
    ];
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Founder 10-12 (iOS / Android parity): the two hands square off in the wrestling ring (art-pocket-ring: back + side ropes, open at
  // the front), there for the whole countdown and the pick wells alike. The hands stand on its canvas, in front of the back ropes.
  // Before the reveal the left well holds your locked pick and the right the hidden fist; on a reveal both hands flip in together
  // with the clash burst between them. Reduce Motion: no flip, no burst.
  const calm = prefersReducedMotion();
  // The card (founder 10-13): the audience / spotlight backdrop fills it (cover, corners clipped) and the ring spans its FULL width,
  // bottom-aligned, with no inner padding; the hands are the outlined ring art with a soft contact shadow on the mat.
  const [ringRef, boxW] = useBoardWidth(420, 640);
  const ARENA_W = boxW;
  const [rw, rh] = ART_SIZE['art-pocket-ring'];
  const RING_H = Math.round((ARENA_W * rh) / rw);
  const HAND = Math.round(ARENA_W * 0.2);
  const ARENA_H = Math.round(ARENA_W * 0.44);
  const handCy = ARENA_H - Math.round(RING_H * 0.2) - Math.round(HAND / 2);   // the hands' feet stand on the canvas
  const wellStyle = (leftPct: number): React.CSSProperties => ({
    position: 'absolute', left: `${leftPct * 100}%`, top: handCy - HAND / 2, width: HAND, height: HAND, marginLeft: -HAND / 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  // Both hands pump together while the words count, then turn over around the vertical axis (the art only: labels never mirror).
  const countdown = revealing && !calm && !flipped;
  const hand = (side: Side, leftPct: number) => {
    const p = last![side];
    const won = flipped && last!.winner === side;
    const settledHand = !countdown && !turning;
    return (
      <div key={`${revealKey}-${side}`} style={{ ...wellStyle(leftPct), animation: countdown && !turning ? 'rps-pump 0.4s ease-in-out 3' : undefined, filter: won ? `drop-shadow(0 0 10px ${side === me ? TILE.you : TILE.them})` : undefined, perspective: 600 }}>
        <div
          style={{
            position: 'relative', width: HAND, height: HAND, transformStyle: 'preserve-3d',
            transform: countdown && !turning ? 'rotateY(180deg)' : undefined,
            animation: turning && !calm && !settledHand ? 'rps-turn 0.55s cubic-bezier(.2,.8,.3,1.1) both' : undefined,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}><RingHand name={p} size={HAND} /></div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} aria-hidden="true"><RingHand name="rock" size={HAND} /></div>
        </div>
      </div>
    );
  };
  const reveal = showReveal && !!last;
  // The winner's color and WON tag wait for the turn to land (a settled / finished board shows them at once).
  const flippedOrStatic = !revealing || calm || flipped;
  const lastLine = last
    ? last.winner === null ? 'Tie' : last.winner === me ? 'You won the round' : `${them.name} won the round`
    : null;

  // A static soft dark ellipse under a hand, on the mat (no animation; the pump and the turn move the hand over it).
  const shadow = (leftPct: number) => (
    <span aria-hidden="true" className="absolute pointer-events-none"
      style={{
        left: `${leftPct * 100}%`, top: handCy + Math.round(HAND * 0.34), width: Math.round(HAND * 1.05), height: Math.round(HAND * 0.24),
        marginLeft: -Math.round(HAND * 0.525), background: 'radial-gradient(ellipse at center, rgba(28, 10, 56, 0.5), rgba(28, 10, 56, 0) 70%)',
      }} />
  );
  const roundNo = reveal ? state.rounds.length : state.rounds.length + 1;

  return (
    <div className="pk-root flex flex-col items-center gap-3">
      <div ref={ringRef} className="pk-board w-full flex flex-col items-center gap-1.5">
        <div className="relative overflow-hidden" style={{ width: ARENA_W, height: ARENA_H, borderRadius: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artSrc('art-pocket-rps-backdrop')} alt="" aria-hidden="true" draggable={false} decoding="async" width={1200} height={475}
            className="absolute inset-0 pointer-events-none select-none" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <BoardArt name="art-pocket-ring" width={ARENA_W} style={{ position: 'absolute', left: 0, bottom: 0 }} />
          {(reveal || active) && (
            <span className="absolute left-0 right-0 text-center font-black uppercase pointer-events-none"
              style={{ top: Math.max(6, Math.round(ARENA_W * 0.022)), fontSize: Math.max(12, Math.round(ARENA_W * 0.04)), letterSpacing: '0.12em', color: '#ffffff', textShadow: '0 1px 3px rgba(20,8,40,0.9), 0 0 10px rgba(20,8,40,0.7)' }}>
              Round {roundNo}
            </span>
          )}
          {reveal ? (
            <>
              {shadow(0.28)}
              {shadow(0.72)}
              {hand(me, 0.28)}
              {hand(theirSide, 0.72)}
              {revealing && !calm && flipped && (
                <PocketPiece name="art-pocket-clash-burst" height={Math.round(HAND * 0.85)} className="absolute pointer-events-none"
                  style={{ left: '50%', top: handCy, marginLeft: -Math.round(HAND * 0.42), marginTop: -Math.round(HAND * 0.42), animation: 'friends-flip 0.35s ease-out both', opacity: 0.95 }} />
              )}
              {countdown && beat >= 0 && (
                // The words pop in the middle slot (over the star); SHOOT! is gold and bigger.
                <div key={beat} className="absolute pointer-events-none rps-word" style={{ left: '50%', top: handCy, width: 92, marginLeft: -46, marginTop: -14 }} aria-hidden="true">
                  <BubbleOneLine text={['ROCK...', 'PAPER...', 'SCISSORS...', 'SHOOT!'][Math.min(beat, 3)]} palette={beat === 3 ? 'leaderboard' : 'friends'} size={beat === 3 ? 20 : 15} minScale={0.5} />
                </div>
              )}
            </>
          ) : (
            <>
              {chosen && shadow(0.28)}
              {shadow(0.72)}
              <div style={wellStyle(0.28)}>{chosen ? <RingHand name={chosen} size={HAND} /> : null}</div>
              <div style={wellStyle(0.72)} aria-label={theirPick ? `${them.name} picked` : `${them.name} has not picked`}>
                <TheirHand picked={!!theirPick} size={HAND} />
              </div>
            </>
          )}
        </div>
      </div>
        <div className="w-full flex justify-between px-6 text-[10px] font-black uppercase" style={{ letterSpacing: 0.8, color: FR.label }}>
          <span style={{ color: reveal && flippedOrStatic && last!.winner === me ? TILE.you : undefined }}>YOU{reveal && flippedOrStatic && last!.winner === me ? ' · WON' : ''}</span>
          <span className="truncate" style={{ maxWidth: 120, color: reveal && flippedOrStatic && last!.winner === theirSide ? TILE.them : undefined }}>{them.name}{reveal && flippedOrStatic && last!.winner === theirSide ? ' · WON' : ''}</span>
        </div>
        {!reveal && active && (theirPick
          ? <span className="text-[11px] font-black" style={{ color: FR.online, letterSpacing: 0.6 }}>✓ {THEM} PICKED</span>
          : <span className="text-[11px] font-black" style={{ color: FR.label, letterSpacing: 0.6 }}>{THEM} IS PICKING</span>)}
        {!reveal && last && (
          <span className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: FR.label }}>
            Last round: <Art name={last[me]} size={18} /> vs <Art name={last[theirSide]} size={18} /> · {lastLine}
          </span>
        )}

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
                  className="pk-pick flex flex-col items-center justify-center gap-1 transition-transform active:scale-95"
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

/**
 * A Tic-Tac-Tile piece (J2): the 3D purple X (you) or pink O (them), filling its cell to the edges (founder 10-13: "go to the
 * edges", a ~4% inset); decorative, the cell carries the label. A winning three glows (static drop-shadow, no animation).
 */
function Piece({ side, win = false }: { side: 'x' | 'o'; win?: boolean }) {
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
      style={{ width: '92%', height: '92%', objectFit: 'contain', filter: win ? `drop-shadow(0 0 7px ${side === 'x' ? TILE.you : '#ec4899'})` : 'drop-shadow(0 2px 2px rgba(40,20,80,0.25))' }}
    />
  );
}

/** The O piece's pink (the legend dot). */
const TTT_O = '#ec4899';

export function TttBoard({ state, me, them, active, busy, onMove }: BoardProps<TttState>) {
  const [boxRef, boxW] = useBoardWidth(400, 600);
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

  const GW = boxW;
  const sc = GW / TTT_GRID_W;
  const GH = Math.round(TTT_GRID_H * sc);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <div className="pk-root flex flex-col items-center gap-3">
      <div ref={boxRef} className="pk-board w-full flex justify-center">
      {/* The lilac "#" slab (art-pocket-ttt-grid) is the board: nine cells between its bars; taps hit the cell rects. */}
      <div className="relative" style={{ width: GW, height: GH }}>
        <BoardArt name="art-pocket-ttt-grid" width={GW} />
        {board.map((m, i) => {
          const mine = m === me;
          const theirs = !!m && !mine;
          const threat = threats.includes(i);
          const win = winLine.includes(i);
          const r = tttCell(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              disabled={!myTurn || !!m}
              aria-label={m ? (mine ? 'Your tile' : `${them.name}'s tile`) : `Empty tile ${i + 1}`}
              className="pk-cell absolute flex items-center justify-center transition-transform active:scale-95"
              style={{
                left: pct(r.x, TTT_GRID_W), top: pct(r.y, TTT_GRID_H), width: pct(r.w, TTT_GRID_W), height: pct(r.h, TTT_GRID_H),
                borderRadius: 14, background: 'transparent',
                outline: threat ? `2px dashed ${TILE.you}` : undefined,
                outlineOffset: threat ? -6 : undefined,
                cursor: myTurn && !m ? 'pointer' : 'default',
              }}
            >
              {mine ? <Piece side="x" win={win} /> : theirs ? <Piece side="o" win={win} /> : null}
            </button>
          );
        })}
        {/* The win strike: the set's gold bar, stretched along the three tiles (scaleX in, transform only). */}
        {strike && (
          <span
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              left: (strike.cx - strike.len / 2) * sc, top: (strike.cy - strike.thick / 2) * sc, width: strike.len * sc, height: strike.thick * sc,
              backgroundImage: `url(${artSrc('art-pocket-ttt-strike')})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
              transform: `rotate(${strike.deg}deg)`, transformOrigin: '50% 50%',
              animation: prefersReducedMotion() ? undefined : 'ttt-strike-in 380ms cubic-bezier(.2,.7,.3,1) both',
            }}
          />
        )}
      </div>
      </div>
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

export function CoinBoard({ state, me, them, active, busy, revealKey, onMove }: BoardProps<CoinState>) {
  const last = state.rounds[state.rounds.length - 1];
  const face: CoinFace = last ? last.flip : 'heads';
  const myCall = active && whoseTurn(state) === me;
  const [calling, setCalling] = useState<CoinFace | null>(null);
  const THEM = them.name.toUpperCase();
  const [boxRef, boxW] = useBoardWidth(420, 640);

  const call = async (c: CoinFace) => {
    if (!myCall || busy || calling) return;
    setCalling(c);
    await onMove({ kind: 'coin', call: c });
    setCalling(null);
  };

  return (
    <div className="pk-root flex flex-col items-center gap-3">
      <div ref={boxRef} className="pk-board w-full flex flex-col items-center">
        <CoinFlip
          face={face}
          flipKey={revealKey}
          width={boxW}
          caption={last ? `${last.flip} · ${last.caller === me ? 'you' : them.name} called ${last.call}` : 'No flips yet'}
        />
      </div>

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

export function PassBoard({ state, me, you, them, active, busy, onMove, answer, error }: BoardProps<PassState> & { answer: string | null }) {
  const [boxRef, boxW] = useBoardWidth(400, 560);
  const [input, setInput] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const myTurn = active && whoseTurn(state) === me;
  const keyStates = passKeyStates(state.guesses);
  // A new guess on the board (theirs, or the fresh state after a "moved on" retry) clears a half-typed attempt (Android parity).
  useEffect(() => { setInput(''); setHint(null); }, [state.guesses.length]);

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

  usePhysicalKeys(active, onKey);

  // The puzzle-piece tray (art-pocket-pass-tray) is the board: the six rows + their ring markers sit centered as one group in its body.
  const TW = boxW;
  const TH = Math.round((TW * PASS_TRAY_H) / PASS_TRAY_W);
  const g = passGeometry(TW, PASS_MAX_GUESSES, 5);
  // A gold ring marker beside each row (close to the tiles); the guesser's avatar sits in it once the row is played.
  const marker = (p: Player | null, current: boolean) => (
    <span
      className="absolute flex items-center justify-center rounded-full"
      style={{ left: 0, top: (g.t - g.ring) / 2, width: g.ring, height: g.ring, border: `${Math.max(1.5, g.t * 0.05)}px solid #f5b82e`, opacity: p || current ? 1 : 0.55, boxSizing: 'border-box', overflow: 'hidden' }}
    >
      {p && <FriendAvatar name={p.name} userId={p.userId} url={p.url} accent={p.accent} config={p.config} castId={p.castId} frame={p.frame} pro={p.pro} size={Math.max(10, Math.round(g.ring - g.t * 0.14))} />}
    </span>
  );

  return (
    <div className="pk-root flex flex-col items-center gap-3">
      <div ref={boxRef} className="pk-board w-full flex justify-center">
      <div className="relative" style={{ width: TW, height: TH }}>
        <BoardArt name="art-pocket-pass-tray" width={TW} />
        {Array.from({ length: PASS_MAX_GUESSES }, (_, r) => {
          const gu = state.guesses[r];
          const current = !gu && r === state.guesses.length && active;
          const who = gu ? (gu.by === me ? you : them) : current ? (myTurn ? you : them) : null;
          return (
            <div key={r} className="absolute" style={{ left: g.ringX, top: g.top + r * g.pitch, width: g.tileX - g.ringX + 4 * g.pitch + g.t, height: g.t }}>
              {marker(who, current)}
              {Array.from({ length: 5 }, (_, i) => {
                const letter = gu ? gu.word[i] : current && myTurn ? input[i] ?? '' : '';
                const pos: React.CSSProperties = { position: 'absolute', left: g.tileX - g.ringX + i * g.pitch, top: 0 };
                const st = gu ? tileState(gu.tiles[i] ?? 'ABSENT') : null;
                return (
                  <ArtTile key={i} tone={st === 'correct' ? 'purple' : st === 'present' ? 'gold' : 'white'} size={g.t} fontSize={Math.round(g.t * 0.46)} radius={Math.round(g.t * 0.2)} pop={!!gu}
                    style={{ ...pos, ...(st === 'absent' ? { opacity: 0.55 } : null), ...(!gu && letter ? { boxShadow: '0 0 0 2px #f5b82e' } : null) }}>
                    {letter}
                  </ArtTile>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>

      {(hint || error) && <p className="text-[12px] font-bold" role="alert" style={{ color: '#dc2626' }}>{hint ?? error}</p>}
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

export function GhostBoard({ state, me, them, active, busy, revealKey, onMove, error }: BoardProps<GhostState>) {
  const [boxRef, boxW] = useBoardWidth(480, 640);
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
  const GW = boxW;
  const GH = Math.round((GW * GHOST_TRAY_H) / GHOST_TRAY_W);
  const gsc = GW / GHOST_TRAY_W;
  const size = ghostTileSize(GW, count);
  const gap = Math.max(3, Math.round(size * 0.14));

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
    <div className="pk-root flex flex-col items-center gap-3">
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

      <div ref={boxRef} className="pk-board w-full flex justify-center">
      {/* The ghost tray (art-pocket-ghost-tray): the fragment's tiles sit centered in its plum panel. */}
      <div className="relative" style={{ width: GW, height: GH }}>
        <BoardArt name="art-pocket-ghost-tray" width={GW} />
        <div className="absolute flex justify-center items-center"
          style={{ left: GHOST_PANEL.x * gsc, top: GHOST_PANEL.y * gsc, width: GHOST_PANEL.w * gsc, height: GHOST_PANEL.h * gsc, gap }}>
          {tiles.map((t, i) => (
            // The newest letter is gold, the rest purple.
            <ArtTile key={i} tone={i === tiles.length - 1 ? 'gold' : 'purple'} size={size} fontSize={Math.round(size * 0.5)} radius={Math.round(size * 0.2)} pop={i === tiles.length - 1}>
              {t.letter}
            </ArtTile>
          ))}
          {showSlot && (
            // A dashed outline marks the next slot.
            <span
              className="flex items-center justify-center font-black uppercase"
              style={{
                width: size, height: size, borderRadius: Math.round(size * 0.2), fontSize: Math.round(size * 0.5),
                background: pick ? 'rgba(252,211,77,0.18)' : 'transparent', color: '#fde68a', border: '2px dashed #fcd34d', boxSizing: 'border-box',
              }}
              aria-label={pick ? `Your letter ${pick}` : 'Your letter goes here'}
            >
              {pick ?? ''}
            </span>
          )}
          {tiles.length === 0 && !showSlot && (
            <span className="text-[12px] font-bold" style={{ color: '#e9d5ff' }}>No letters yet</span>
          )}
        </div>
      </div>
      </div>

      {(hint || error) && <p className="text-[12px] font-bold" role="alert" style={{ color: '#dc2626' }}>{hint ?? error}</p>}

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

const INPUT_TILE = 40;

export function ChainBoard({ state, me, them, active, busy, onMove, error }: BoardProps<ChainState>) {
  const [boxRef, boxW] = useBoardWidth(480, 640);
  const [rowRef, rowW] = useBoardWidth(480, 400);
  const myTurn = active && whoseTurn(state) === me;
  const locked = chainNeededLetter(state);
  const [typed, setTyped] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => { setTyped(''); setHint(null); }, [state.words.length]);
  const word = (locked ?? '') + typed;
  // Founder 10-13: a word is 5 to 15 letters (the server checks the dictionary).
  const room = CHAIN_WORD_MAX - (locked ? 1 : 0);

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

  // A new word keeps the chain's end in view (iOS parity): the newest word, then your input, never scrolled away.
  const endRef = useRef<HTMLDivElement>(null);
  const wordCount = useRef(state.words.length);
  useEffect(() => {
    if (state.words.length === wordCount.current) return;
    wordCount.current = state.words.length;
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [state.words.length]);

  // The chain board (art-pocket-chain-board) is the frame: the last words hang in a staircase inside its plum interior, each new word
  // starting under the previous word's last letter, joined by the gold link (art-pocket-chain-link).
  const BW = boxW;
  const BH = Math.round((BW * CHAIN_BOARD_H) / CHAIN_BOARD_W);
  const bsc = BW / CHAIN_BOARD_W;
  const inX = CHAIN_INTERIOR.w * bsc * 0.03;
  const inY = CHAIN_INTERIOR.h * bsc * 0.04;
  const iw = CHAIN_INTERIOR.w * bsc - 2 * inX;
  const ih = CHAIN_INTERIOR.h * bsc - 2 * inY;
  const lay = chainLayout(state.words.map((w) => w.word.length), iw, ih);
  const newest = state.words[state.words.length - 1];

  // The typing row: the typed letters plus ONE empty next-slot, shrinking as the word grows so it always fits one row.
  const slots = Math.min(CHAIN_WORD_MAX, word.length + 1);
  const itile = chainInputTile(rowW, slots, INPUT_TILE);
  const igap = Math.max(2, Math.round(itile * 0.12));

  return (
    <div className="pk-root flex flex-col items-center gap-3">
      <div ref={boxRef} className="pk-board w-full flex justify-center">
      <div className="relative" style={{ width: BW, height: BH }}>
        <BoardArt name="art-pocket-chain-board" width={BW} />
        <div className="absolute" style={{ left: CHAIN_INTERIOR.x * bsc + inX, top: CHAIN_INTERIOR.y * bsc + inY, width: iw, height: ih }}>
          {!lay && (
            <p className="absolute inset-0 flex items-center justify-center text-center text-[12px] font-bold px-2" style={{ color: '#e9d5ff' }}>
              Any {WORD_MIN} to {CHAIN_WORD_MAX} letter word opens the chain.
            </p>
          )}
          {lay?.rows.map((row) => {
            const w = state.words[row.index];
            const mine = w.by === me;
            const isNewest = row.index === state.words.length - 1;
            return [...w.word].map((ch, i) => {
              const glow = isNewest && i === w.word.length - 1;
              return (
                <ArtTile
                  key={`${row.index}-${i}`}
                  tone={mine ? 'purple' : 'gold'} size={lay.t} fontSize={Math.round(lay.t * 0.5)} radius={Math.round(lay.t * 0.2)} pop={glow}
                  style={{ position: 'absolute', left: row.x + i * lay.pitchX, top: row.y, ...(glow ? { boxShadow: `0 0 0 2px #ffffff, 0 0 0 4px ${FR.solid}, 0 0 14px ${FR.solid}` } : null) }}
                >
                  {ch}
                </ArtTile>
              );
            });
          })}
          {lay?.links.map((l, i) => {
            const lw = lay.t * 0.79 * CHAIN_LINK_ASPECT;
            return (
              <span key={i} aria-hidden="true" className="absolute pointer-events-none"
                style={{
                  left: l.cx - lw / 2, top: l.cy - l.length / 2, width: lw, height: l.length, zIndex: 2,
                  backgroundImage: `url(${artSrc('art-pocket-chain-link')})`, backgroundSize: `${lw}px ${lay.t * 0.79}px`, backgroundRepeat: 'no-repeat round', backgroundPosition: 'center',
                  transform: `rotate(${l.deg}deg)`, transformOrigin: '50% 50%',
                }} />
            );
          })}
        </div>
      </div>
      </div>
      {newest && (
        <p className="text-[11.5px] font-black uppercase text-center" style={{ color: FR.label, letterSpacing: 0.6 }}>
          {newest.word} · +{newest.points} · {newest.by === me ? 'you' : them.name}
        </p>
      )}

      {/* Measured always (hidden until it is your word) so the row fits its own column: the narrower side column on desktop. */}
      <div ref={rowRef} className="w-full" style={{ display: active && myTurn ? 'block' : 'none' }}>
      {active && myTurn && (
        <div className="flex justify-center w-full" style={{ gap: igap }} aria-label="Your word">
          {Array.from({ length: slots }, (_, i) => {
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
                style={{ width: itile, height: itile, borderRadius: Math.round(itile * 0.2), fontSize: Math.round(itile * 0.46), boxSizing: 'border-box', ...style }}
              >
                {ch}
                {isLocked && <Lock className="absolute" style={{ width: Math.max(7, itile * 0.22), height: Math.max(7, itile * 0.22), top: 2, right: 2, color: '#ffffff' }} aria-label="Locked" />}
              </span>
            );
          })}
        </div>
      )}
      </div>

      {(hint || error) && <p className="text-[12px] font-bold" role="alert" style={{ color: '#dc2626' }}>{hint ?? error}</p>}

      {active && (
        <>
          <p className="text-[12px] font-bold text-center" style={{ color: FR.label }}>
            {myTurn
              ? locked ? `Your word. It starts with ${locked}.` : 'Your word. Any word opens the chain.'
              : locked ? `${them.name} needs a word starting with ${locked}. It lands here live.` : `${them.name} is opening the chain. It lands here live.`}
          </p>
          <div ref={endRef} className="w-full" style={{ opacity: myTurn ? 1 : 0.55 }}>
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
