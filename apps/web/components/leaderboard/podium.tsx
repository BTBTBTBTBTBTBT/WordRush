import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { BoardAvatar, type BoardAvatarData } from '@/components/leaderboard/board-rows';
import { LevelBadge } from '@/components/badges/badge-art';
import { PODIUM_STEP_HEIGHT, PODIUM_TONE_PLACE, podiumColumn, podiumPedestalArt, podiumSlots, podiumTone, type PodiumTone } from '@/lib/leaderboard-podium';
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
  /** Extra line under the points (the Sweep dot strip, a stats line). */
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

function Step({ tone, rank, dim = false }: { tone: PodiumTone; rank: number; dim?: boolean }) {
  return <PodiumPedestal place={PODIUM_TONE_PLACE[tone]} height={PODIUM_STEP_HEIGHT[tone]} label={rank} dim={dim} />;
}

function Column({ place, index }: { place: PodiumPlace; index: number }) {
  const tone = podiumTone(place.rank);
  const first = tone === 'gold';
  return (
    <div className="relative flex flex-col items-center min-w-0" style={{ gap: 4, gridColumn: podiumColumn(index), gridRow: 1 }}>
      {first && <Icon3D name="crown" size={26} style={{ marginBottom: -8, position: 'relative', zIndex: 2 }} />}
      <span className="sr-only">Rank {place.rank}</span>
      <Link href={`/profile/${place.userId}`} tabIndex={-1} aria-hidden="true" className="block" style={{ lineHeight: 0 }}>
        <BoardAvatar url={place.avatarUrl} name={place.username} userId={place.userId} level={place.level} size={first ? 54 : 44} ring={place.isMe ? '#f59e0b' : undefined} {...place.avatar} />
      </Link>
      <Link
        href={`/profile/${place.userId}`}
        className="max-w-full truncate text-[13px] font-black leading-tight hover:opacity-80 transition-opacity"
        style={{ color: place.isMe ? '#d97706' : 'var(--color-text)' }}
      >
        {place.username}
        {place.level ? <LevelBadge level={place.level} size={16} numberSize={11} className="ml-1 align-middle" /> : null}
        {place.nameSuffix}
      </Link>
      <div className="flex items-center justify-center gap-1 max-w-full">
        <SoftNum size={13}>{place.points}</SoftNum>
        {place.badge}
      </div>
      {place.extra}
      {place.action}
      <Step tone={tone} rank={place.rank} />
    </div>
  );
}

/** The sleepy cast member's art (373 x 302). */
export const OPEN_SPOT_ART = 'art-scene-r-asleep';
const OPEN_SPOT_H = 44;
const OPEN_SPOT_W = Math.round((OPEN_SPOT_H * 373) / 302);

/** BJ4: a free place — its step dimmed, the sleepy R where the avatar goes, "Open spot" · "Claim #N". Not tappable. */
function OpenSpot({ place, column, title, line }: { place: number; column: 1 | 2 | 3; title: string; line: string }) {
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
      <Step tone={podiumTone(place)} rank={place} dim />
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
export function Podium({ places, label = 'Top three', accent = STAGE_GOLD }: { places: PodiumPlace[]; label?: string; accent?: string }) {
  const shown = places.slice(0, 3);
  const slots = podiumSlots(shown.map((p) => p.rank));
  if (slots.length === 0) return null;
  return (
    <div role="group" aria-label={label} className="relative overflow-hidden" style={{ padding: '8px 12px 0' }}>
      <Stage accent={accent} />
      <PodiumFloor />
      <div className="relative grid items-end" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, zIndex: 1, paddingBottom: PODIUM_FLOOR_RISE }}>
        {slots.map((s) => (s.kind === 'place'
          ? <Column key={shown[s.index].key} place={shown[s.index]} index={s.index} />
          : <OpenSpot key={`open-${s.place}`} place={s.place} column={s.column} title={s.title} line={s.line} />))}
      </div>
    </div>
  );
}
