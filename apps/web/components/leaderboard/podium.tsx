'use client';

import * as React from 'react';
import Link from 'next/link';
import { openDressUp } from '@/components/profile/dress-up';
import type { ReactNode } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { type BoardAvatarData } from '@/components/leaderboard/board-rows';
import { placeWord, plateForConfig, podiumStageCardLabel } from '@wordle-duel/core';
import { BubbleOneLine } from '@/components/ui/bubble-text';
import { nameColorHex, platePaletteSpec, secondaryColorHex } from '@/lib/player-tint';
import { PodiumFigure, PODIUM_FIGURE_SCALE } from '@/components/leaderboard/podium-figure';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { PodiumStageCard } from '@/components/leaderboard/podium-stage-card';
import { useFlags, useLivingMascotOn } from '@/hooks/use-flags';
import { LevelBadge } from '@/components/badges/badge-art';
import { PODIUM_GLOW, PODIUM_SPARKLES, PODIUM_STEP_HEIGHT, PODIUM_STEP_HEIGHT_COMPACT, PODIUM_TONE_PLACE, podiumColumn, podiumPedestalArt, podiumSlots, podiumTone, type PodiumTone } from '@/lib/leaderboard-podium';
import { alphaHex } from '@/lib/soft-surface';
import { ART_SIZE, artSrc } from '@/lib/art';
import { AVATAR_CAST_COLOR } from '@/lib/avatar-cast';

// The top-3 podium (docs/FINISH_SPEC.md C2; mockup
// docs/design/brand/mockups/leaderboard-polish.html `.podium`): three columns
// — 2nd, 1st, 3rd — each the player's mascot (or photo; FINISH_SPEC AN5), the name (→
// profile) and the soft-number points on a gold / silver / bronze step with
// the rank on it; the crown sits on 1st. Ties share a metal and a height.
// It heads the board card; ranks 4+ list below it as rows.
// FINISH_SPEC BJ4: on EVERY board as soon as one result is in — the places
// still free are open spots (the step in its metal, dimmed, with the sleepy R
// where the avatar goes: "Open spot" · "Claim #N"; not tappable), and the
// whole podium stands on a static stage (accent gradient, faint sunburst rays
// + a few confetti dots in ONE svg layer, a soft floor shadow). No motion.
// Podium art 10-03: the steps are the glossy pedestal sprites (art-podium-N) on
// the floor plate (art-podium-floor); same heights, open spots dimmed.

export interface PodiumPlace {
  key: string;
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  /** FINISH_SPEC AN3: the row's avatar_config / accent / Pro flag when the data carries them. */
  avatar?: BoardAvatarData;
  isMe: boolean;
  /** FINISH_SPEC V3: the player's level → the small tier badge after the name. */
  level?: number | null;
  points: ReactNode;
  /** The row's result badge (W / L, the Sweep pill), beside the points. */
  badge?: ReactNode;
  /** Founder 10-09: the stats line under the points as plain text, drawn in the bubble lettering ("4 Guesses · 1m 45s"). */
  detail?: string;
  /** Extra line under the points (the Sweep dot strip). */
  extra?: ReactNode;
  /** After the name (the week leader's crown). */
  nameSuffix?: ReactNode;
  /** An action under the name (the friends board's taunt bell). */
  action?: ReactNode;
}

/**
 * One glossy pedestal (podium art 10-03) at `height` px, centered in its column, the
 * width following the art. A `label` other than the place's own number takes the plain
 * pedestal with the label on it. Explicit width/height + async decode: no layout shift.
 */
export function PodiumPedestal({ place, height, label, dim = false }: { place: number; height: number; label?: number; dim?: boolean }) {
  const name = podiumPedestalArt(place, label);
  const [aw, ah] = ART_SIZE[name];
  const w = Math.round((height * aw) / ah);
  const plain = name.endsWith('-plain');
  return (
    <div
      className="relative w-full flex items-center justify-center"
      style={{ height, marginTop: 2, opacity: dim ? 0.45 : undefined }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={artSrc(name)}
        alt=""
        width={w}
        height={height}
        decoding="async"
        draggable={false}
        className="select-none pointer-events-none"
        style={{ width: w, height, maxWidth: '100%', objectFit: 'contain' }}
      />
      {plain && label !== undefined && (
        <span
          className="absolute font-black text-white tabular-nums"
          style={{ fontSize: 20, top: '56%', transform: 'translateY(-50%)', textShadow: '0 2px 0 rgba(0,0,0,0.18)' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/** How far the floor plate rises under the pedestals' feet (px). */
export const PODIUM_FLOOR_RISE = 10;

/** The glossy floor plate the pedestals stand on (absolute, at the bottom of a `relative` podium). */
export function PodiumFloor({ inset = 12 }: { inset?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={artSrc('art-podium-floor')}
      alt=""
      aria-hidden="true"
      width={ART_SIZE['art-podium-floor'][0]}
      height={PODIUM_FLOOR_RISE * 2 + 4}
      decoding="async"
      draggable={false}
      className="absolute select-none pointer-events-none"
      style={{ left: inset, right: inset, bottom: 0, width: `calc(100% - ${inset * 2}px)`, height: PODIUM_FLOOR_RISE * 2 + 4, zIndex: 0 }}
    />
  );
}

function Step({ tone, rank, dim = false, compact = false }: { tone: PodiumTone; rank: number; dim?: boolean; compact?: boolean }) {
  return <PodiumPedestal place={PODIUM_TONE_PLACE[tone]} height={compact ? PODIUM_STEP_HEIGHT_COMPACT[tone] : PODIUM_STEP_HEIGHT[tone]} label={rank} dim={dim} />;
}

/**
 * The soft radial glow behind a standing figure (never over it: z-index -1 inside the grid's stacking context, under
 * the figure and the plaque). Gold also carries a few gently twinkling sparkles; `.podium-twinkle` is still under
 * Reduce Motion (OS or the in-app calm-motion toggle). `top` is the figure's vertical center in the column (px).
 */
export function PodiumGlow({ tone, figureHeight, top }: { tone: PodiumTone; figureHeight: number; top: number }) {
  const g = PODIUM_GLOW[tone];
  const d = Math.round(figureHeight * g.scale);
  return (
    <span
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{
        left: '50%', top, width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2, zIndex: -1, borderRadius: '50%',
        background: `radial-gradient(circle at 50% 50%, ${alphaHex(g.core, g.alpha)} 0%, ${alphaHex(g.core, g.alpha * 0.45)} 38%, ${alphaHex(g.core, 0)} 70%)`,
      }}
    >
      {tone === 'gold' && PODIUM_SPARKLES.map((s, i) => (
        <svg key={i} className="podium-twinkle absolute" viewBox="0 0 10 10" width={s.size} height={s.size}
          style={{ left: `${s.x}%`, top: `${s.y}%`, marginLeft: -s.size / 2, marginTop: -s.size / 2, animationDelay: `${s.delay}s` }}>
          <path d="M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z" fill="#FFF1B8" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Founder 10-09: the plaque under a podium player wears THEIR mascot-maker backdrop (the fill, a top-left to bottom-right
 * gradient) and frame (the border gradient), 12px radius, soft shadow, and holds only the NUMBERS now (the name rides above the
 * head): points and the detail line, both in the bubble lettering on the plate palette (pale plate: purple letters + numbers
 * with a white outline; dark plate: white letters + gold numbers). Colors: core plateHexes (pinned to Swift + Kotlin by
 * player-tint-fixtures.json); the config comes through the same resolver as the avatar above it.
 */
export function PodiumPlaque({ place, compact = false, first = false }: { place: PodiumPlace; compact?: boolean; first?: boolean }) {
  const look = usePlayerAvatar({
    name: place.username, userId: place.userId, url: place.avatarUrl, accent: place.avatar?.accent,
    config: place.avatar?.config, castId: place.avatar?.castId, frame: place.avatar?.frame, level: place.level, pro: place.avatar?.pro,
  });
  const plate = React.useMemo(() => plateForConfig(look.config), [look.config]);
  const spec = React.useMemo(() => platePaletteSpec(plate.lightInk), [plate.lightInk]);
  const fill = plate.fill.length > 1 ? plate.fill : [plate.fill[0], plate.fill[0]];
  const edge = plate.border.length > 1 ? plate.border : [plate.border[0], plate.border[0]];
  const points = typeof place.points === 'string' || typeof place.points === 'number' ? String(place.points).toUpperCase() : null;
  return (
    <div
      className="podium-plaque relative flex flex-col items-center max-w-full w-full"
      style={{
        gap: 2, padding: '4px 10px', zIndex: 2, borderRadius: 12, boxShadow: '0 2px 3px rgba(0,0,0,0.18)', border: `${plate.borderWidth}px solid transparent`,
        // the fill paints under the padding box, the border gradient under the border box (the usual two-layer gradient border)
        background: `linear-gradient(135deg, ${fill.join(', ')}) padding-box, linear-gradient(to bottom, ${edge.join(', ')}) border-box`,
        // the badge and extra nodes inherit the ink
        color: plate.lightInk ? '#ffffff' : '#2a1650',
      }}
    >
      <div className="flex items-center justify-center gap-1 w-full min-w-0">
        <div className="flex-1 min-w-0">
          {points !== null
            ? <BubbleOneLine text={points} spec={spec} size={(compact ? 14 : 17) + (first ? 2 : 0)} />
            : <span className="font-black" style={{ fontSize: compact ? 11 : 13 }}>{place.points}</span>}
        </div>
        {place.badge}
      </div>
      {place.detail ? <BubbleOneLine text={place.detail.toUpperCase()} spec={spec} size={compact ? 10 : 11.5} minScale={0.55} /> : null}
      {place.extra && <div style={{ color: plate.lightInk ? '#f5b82e' : '#b45309' }}>{place.extra}</div>}
      {place.nameSuffix}
      {place.action}
    </div>
  );
}

/**
 * Founder 10-09: the player's NAME rides ABOVE their head in the bubble lettering, one line that shrinks to fit (never wraps or
 * clips; floor 0.3), in their own name color, with a soft glow behind it in their SECONDARY color (their pattern color): two blurred
 * capsules (outer 55% blur 12, inner 90% blur 6). The slot is 10px wider than its column on each side, and `pull` px of its height
 * overlap the figure below, so the name sits close to the head (standing figures 18px, the winner only 4px so it stays above the
 * crown, a framed tile 2px).
 */
function PodiumNameAbove({ place, size, pull }: { place: PodiumPlace; size: number; pull: number }) {
  const look = usePlayerAvatar({
    name: place.username, userId: place.userId, url: place.avatarUrl, accent: place.avatar?.accent,
    config: place.avatar?.config, castId: place.avatar?.castId, frame: place.avatar?.frame, level: place.level, pro: place.avatar?.pro,
  });
  const nameColor = nameColorHex(look.config.bg, look.config.color);
  const glow = secondaryColorHex(look.config.patternColor);
  return (
    <Link
      href={`/profile/${place.userId}`}
      className="relative block hover:opacity-90 transition-opacity"
      style={{ width: 'calc(100% + 20px)', marginLeft: -10, marginRight: -10, marginBottom: -pull, zIndex: 2 }}
    >
      <span aria-hidden="true" className="absolute pointer-events-none" style={{ left: -2, right: -2, top: -6, bottom: -6, borderRadius: 999, background: alphaHex(glow, 0.55), filter: 'blur(12px)' }} />
      <span aria-hidden="true" className="absolute pointer-events-none" style={{ left: 10, right: 10, top: 1, bottom: 1, borderRadius: 999, background: alphaHex(glow, 0.9), filter: 'blur(6px)' }} />
      <span className="relative block">
        <BubbleOneLine text={place.username.toUpperCase()} accent={nameColor} size={size} />
      </span>
    </Link>
  );
}

function Column({ place, index, compact = false }: { place: PodiumPlace; index: number; compact?: boolean }) {
  const tone = podiumTone(place.rank);
  const first = tone === 'gold';
  // 2.8 item 13 (behind the living mascot switch): the name + points ride on a soft plaque overlapping the step,
  // the winner's spot opens with a confetti burst, and tapping another player's mascot opens their mini Stage card.
  const livingOn = useLivingMascotOn();
  const { isLive } = useFlags();
  const cardOn = livingOn && isLive('podium_stage_card');
  const burstOn = livingOn && isLive('podium_burst');
  const [stageOpen, setStageOpen] = React.useState(false);
  // the figure's box in the column (for the glow behind it): the standing mascot is 2x the tile; the framed tile has the crown above it
  const tile = compact ? (first ? 48 : 40) : (first ? 54 : 44);
  const figH = livingOn ? tile * PODIUM_FIGURE_SCALE : tile;
  const figTop = livingOn ? figH / 2 : (first ? 18 : 0) + figH / 2;
  return (
    <div className="relative flex flex-col items-center min-w-0" style={{ gap: 4, gridColumn: podiumColumn(index), gridRow: 1 }}>
      <span className="sr-only">{placeWord(place.rank)} place</span>
      <PodiumGlow tone={tone} figureHeight={figH} top={figTop} />
      {burstOn && first && (
        // eslint-disable-next-line @next/next/no-img-element
        <img aria-hidden="true" alt="" src="/art/celebrate-burst-party.webp" width={150} draggable={false}
          className="podium-burst absolute pointer-events-none" style={{ left: '50%', top: 0, marginLeft: -75, zIndex: 0 }} />
      )}
      <PodiumNameAbove place={place} size={compact ? 14 : (first ? 19 : 16)} pull={livingOn ? (first ? 4 : 18) : 2} />
      {place.isMe || cardOn ? (
        // Founder 10-05 (door 1): your own place opens your Stage; with the living mascot on, anyone else's opens their mini Stage card.
        <button type="button" onClick={() => (place.isMe ? openDressUp() : setStageOpen(true))}
          aria-label={place.isMe ? 'Dress up your mascot' : podiumStageCardLabel(place.username, place.rank)}
          className="block border-0 bg-transparent p-0 cursor-pointer" style={{ lineHeight: 0 }}>
          <PodiumFigure place={place} tone={PODIUM_TONE_PLACE[tone]} size={tile} ring={place.isMe ? '#f59e0b' : undefined} />
        </button>
      ) : (
        <Link href={`/profile/${place.userId}`} tabIndex={-1} aria-hidden="true" className="block" style={{ lineHeight: 0 }}>
          <PodiumFigure place={place} tone={PODIUM_TONE_PLACE[tone]} size={tile} />
        </Link>
      )}
      <PodiumPlaque place={place} compact={compact} first={first} />
      <Step tone={tone} rank={place.rank} compact={compact} />
      {cardOn && !place.isMe && <PodiumStageCard place={place} tone={PODIUM_TONE_PLACE[tone]} open={stageOpen} onOpenChange={setStageOpen} />}
    </div>
  );
}

/** The sleepy cast member's art (373 x 302). */
export const OPEN_SPOT_ART = 'art-scene-r-asleep';
const OPEN_SPOT_H = 44;
const OPEN_SPOT_W = Math.round((OPEN_SPOT_H * 373) / 302);

/** BJ4: a free place — its step dimmed, the sleepy R where the avatar goes, "Open spot" · "Claim #N". Not tappable. */
function OpenSpot({ place, column, title, line, compact = false }: { place: number; column: 1 | 2 | 3; title: string; line: string; compact?: boolean }) {
  return (
    <div className="relative flex flex-col items-center min-w-0" style={{ gap: 4, gridColumn: column, gridRow: 1 }}>
      <span className="sr-only">{title}, {line}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={artSrc(OPEN_SPOT_ART)}
        alt=""
        aria-hidden="true"
        width={OPEN_SPOT_W}
        height={OPEN_SPOT_H}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="select-none pointer-events-none"
        style={{ width: OPEN_SPOT_W, height: OPEN_SPOT_H, objectFit: 'contain' }}
      />
      <span aria-hidden="true" className="max-w-full truncate text-[13px] font-black leading-tight" style={{ color: 'var(--color-text-secondary)' }}>{title}</span>
      <span aria-hidden="true" className="text-[11px] font-extrabold leading-tight" style={{ color: 'var(--color-text-muted)' }}>{line}</span>
      <Step tone={podiumTone(place)} rank={place} dim compact={compact} />
    </div>
  );
}

/** Sweep / Yesterday's sweep stage accent (BJ4). */
export const STAGE_GOLD = '#F5A524';

// The stage's one shape layer: 12 rays fanning down from just above the #1
// column, and 7 confetti dots (2–4 px) in cast colors at fixed spots.
const STAGE_W = 360;
const STAGE_H = 230;
const RAY_ORIGIN = { x: STAGE_W / 2, y: -14 };
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const mid = (Math.PI * (18 + (i * 144) / 11)) / 180; // 18°…162° below the horizon
  const half = (2.4 * Math.PI) / 180;
  const r = 520;
  const p = (a: number) => `${(RAY_ORIGIN.x + Math.cos(a) * r).toFixed(1)},${(RAY_ORIGIN.y + Math.sin(a) * r).toFixed(1)}`;
  return `${RAY_ORIGIN.x},${RAY_ORIGIN.y} ${p(mid - half)} ${p(mid + half)}`;
});
const CONFETTI: Array<{ x: number; y: number; r: number; c: keyof typeof AVATAR_CAST_COLOR }> = [
  { x: 34, y: 26, r: 2, c: 'o1' },
  { x: 92, y: 58, r: 1.5, c: 'r' },
  { x: 128, y: 16, r: 1, c: 'c' },
  { x: 236, y: 22, r: 1.5, c: 'u' },
  { x: 274, y: 64, r: 2, c: 'd' },
  { x: 322, y: 30, r: 1, c: 's' },
  { x: 58, y: 104, r: 1, c: 'i' },
];

/** BJ4: the static stage behind the podium (clipped by the board card's top corners). */
function Stage({ accent }: { accent: string }) {
  return (
    <div aria-hidden="true" className="podium-stage absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${alphaHex(accent, 0.16)}, ${alphaHex(accent, 0)})` }} />
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} preserveAspectRatio="xMidYMin slice">
        <g fill={accent} fillOpacity={0.09}>
          {RAYS.map((pts) => <polygon key={pts} points={pts} />)}
        </g>
        {CONFETTI.map((d) => <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={d.r} fill={AVATAR_CAST_COLOR[d.c]} fillOpacity={0.5} />)}
      </svg>
      <div
        className="absolute left-0 right-0"
        style={{ bottom: -14, height: 28, margin: '0 4%', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.10), rgba(0,0,0,0) 70%)' }}
      />
    </div>
  );
}

/**
 * The podium (the places in board order: 1st, 2nd, 3rd; DOM order = reading
 * order), with an open spot for every free place (BJ4, core podiumLayout) on
 * the static stage in the board's `accent`.
 */
export function Podium({ places, label = 'Top three', accent = STAGE_GOLD, bare = false, compact = false }: { places: PodiumPlace[]; label?: string; accent?: string; bare?: boolean; compact?: boolean }) {
  const shown = places.slice(0, 3);
  const slots = podiumSlots(shown.map((p) => p.rank));
  if (slots.length === 0) return null;
  return (
    <div role="group" aria-label={label} className="relative overflow-hidden" style={{ padding: bare ? '2px 12px 0' : '8px 12px 0' }}>
      {/* 11b: on the Leaderboard stage the shared backdrop already draws the light + glow */}
      {!bare && <Stage accent={accent} />}
      <PodiumFloor />
      <div className="relative grid items-end" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, zIndex: 1, paddingBottom: PODIUM_FLOOR_RISE }}>
        {slots.map((s) => (s.kind === 'place'
          ? <Column key={shown[s.index].key} place={shown[s.index]} index={s.index} compact={compact} />
          : <OpenSpot key={`open-${s.place}`} place={s.place} column={s.column} title={s.title} line={s.line} compact={compact} />))}
      </div>
    </div>
  );
}
