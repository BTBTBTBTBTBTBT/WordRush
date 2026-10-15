'use client';

import * as React from 'react';
import Link from 'next/link';
import { openDressUp } from '@/components/profile/dress-up';
import type { ReactNode } from 'react';
import { type BoardAvatarData } from '@/components/leaderboard/board-rows';
import { PODIUM_ART, PODIUM_ART_ORDER, PODIUM_WINNER_INTRO, podiumArtStep, placeWord, podiumStageCardLabel } from '@wordle-duel/core';
import { BubbleOneLine } from '@/components/ui/bubble-text';
import { nameColorHex, secondaryColorHex } from '@/lib/player-tint';
import { PodiumFigure } from '@/components/leaderboard/podium-figure';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { PodiumStageCard } from '@/components/leaderboard/podium-stage-card';
import { useFlags, useLivingMascotOn } from '@/hooks/use-flags';
import { PODIUM_TONE_PLACE, podiumSlots, podiumTone } from '@/lib/leaderboard-podium';
import { alphaHex } from '@/lib/soft-surface';
import { artSrc } from '@/lib/art';

// The podium (founder 10-15: "B, build both into the app"): ONE stadium image (art-podium-stage, 1536x1024, transparent soft
// fade) with three tall glossy steps (silver 2 left, gold 1 center, bronze 3 right), each with its number baked in and a blank
// light satin panel under it. It replaces the three separate step blocks AND the colored per-player stat cards. Each player's
// real mascot stands with its FEET on the step-top center (a soft contact ellipse under it), the name floats above, and the
// stats print INSIDE the panel (score, then guesses + time). Geometry = core PODIUM_ART (fractions of the image; mirrored on
// iOS / Android by podium-layout-fixtures.json). A free place keeps its step: no mascot, the panel reads "Open spot" · "Claim
// #N". Static image, decoded once, no per-frame work. Used by every 3-place podium: Leaderboard (today + Yesterday), Records,
// Sweep and the Friends race.

export interface PodiumPlace {
  key: string;
  rank: number;
  userId: string;
  username: string;
  /** The name printed above the mascot when it differs from the avatar's own name (the Friends race calls you "You"). */
  label?: string;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  /** FINISH_SPEC AN3: the row's avatar_config / accent / Pro flag when the data carries them. */
  avatar?: BoardAvatarData;
  isMe: boolean;
  /** FINISH_SPEC V3: the player's level. */
  level?: number | null;
  points: ReactNode;
  /** The row's result badge (W / L, the Sweep pill); not drawn on the one-image podium (the panel holds numbers only). */
  badge?: ReactNode;
  /** The stats under the points as plain text ("4 Guesses · 1m 45s"); printed in the panel as at most two lines. */
  detail?: string;
  /** Not drawn on the one-image podium (the Sweep's pill + dot strip live on its rows). */
  extra?: ReactNode;
  /** After the name (the week leader's crown). */
  nameSuffix?: ReactNode;
  /** An action beside the name (the friends board's taunt bell). */
  action?: ReactNode;
  /** False: no crown on first place (a Friends race nobody has scored in yet). */
  crown?: boolean;
}

/** The sleepy cast member that keeps an open step company (373 x 302). */
export const OPEN_SPOT_ART = 'art-scene-r-asleep';

/** Sweep / Yesterday's sweep stage accent (BJ4). */
export const STAGE_GOLD = '#F5A524';

/** The podium's pixel width: measured from its box so every size follows the page width (360 until measured). */
function useBoxWidth(ref: React.RefObject<HTMLElement>, initial = 360): number {
  const [w, setW] = React.useState(initial);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW((prev) => { const next = Math.round(el.getBoundingClientRect().width); return next > 0 && next !== prev ? next : prev; });
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** A last soft fade on the image's left / right edges so its stadium melts into any wallpaper behind it. */
const EDGE_FADE = 'linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%)';

/** The standing mascot's box (px) by place: the winner a touch larger (today's 60 / 51 tile at 2x ≈ 0.33 / 0.29 of 360). */
function mascotSize(w: number, place: 1 | 2 | 3): number {
  return Math.round(w * (place === 1 ? 0.33 : 0.29));
}

/** One panel line, centerd, on ONE line, scaled down (floor 0.5) so a long value never overflows the panel. */
function FitLine({ text, size, weight = 900 }: { text: string; size: number; weight?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const fit = () => {
      const avail = box.clientWidth;
      const natural = el.offsetWidth;
      setScale(natural > 0 && avail > 0 ? Math.max(0.5, Math.min(1, avail / natural)) : 1);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    // the web font landing (or the panel resizing) changes the natural width: refit
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text, size]);
  return (
    <span className="flex w-full justify-center" style={{ height: size * 1.15, lineHeight: `${size * 1.15}px` }}>
      <span ref={ref} className="block shrink-0 whitespace-nowrap tabular-nums" style={{ fontSize: size, fontWeight: weight, transform: `scale(${scale})`, transformOrigin: 'center', lineHeight: 'inherit' }}>{text}</span>
    </span>
  );
}

/** The panel text color on all three light satin panels: rgb(70, 30, 100). */
const PANEL_INK = `rgb(${PODIUM_ART.textRgb.join(',')})`;

/** Stats inside a step's panel: the score at 0.29 of the panel height, then up to two lines at 0.19. */
function PanelText({ w, place, score, lines }: { w: number; place: 1 | 2 | 3; score: string; lines: string[] }) {
  const { panel } = podiumArtStep(place);
  const pw = (panel.x1 - panel.x0) * w;
  const ph = (panel.y1 - panel.y0) * (w / PODIUM_ART.aspect);
  return (
    <div
      className="absolute flex flex-col items-center justify-center pointer-events-none"
      style={{
        left: `${panel.x0 * 100}%`, top: `${panel.y0 * 100}%`, width: `${(panel.x1 - panel.x0) * 100}%`, height: `${(panel.y1 - panel.y0) * 100}%`,
        padding: `0 ${pw * 0.06}px`, color: PANEL_INK, zIndex: 2, gap: ph * 0.03,
      }}
    >
      <FitLine text={score} size={ph * PODIUM_ART.scoreHeight} weight={900} />
      {lines.map((line) => <FitLine key={line} text={line.toUpperCase()} size={ph * PODIUM_ART.detailHeight} weight={800} />)}
    </div>
  );
}

/**
 * Founder 10-09: the player's NAME rides ABOVE their head in the bubble lettering, one line that shrinks to fit, in their own
 * name color with a soft glow behind it in their SECONDARY color. `YOU` for your own place (one-image podium, founder 10-15).
 */
function PodiumNameAbove({ place, size, width }: { place: PodiumPlace; size: number; width: number }) {
  const look = usePlayerAvatar({
    name: place.username, userId: place.userId, url: place.avatarUrl, accent: place.avatar?.accent,
    config: place.avatar?.config, castId: place.avatar?.castId, frame: place.avatar?.frame, level: place.level, pro: place.avatar?.pro,
  });
  const nameColor = nameColorHex(look.config.bg, look.config.color);
  const glow = secondaryColorHex(look.config.patternColor);
  const text = (place.label ?? (place.isMe ? 'YOU' : place.username)).toUpperCase();
  return (
    <div className="flex items-center justify-center" style={{ gap: 2, maxWidth: '100%' }}>
      <Link
        href={place.isMe ? '/profile' : `/profile/${place.userId}`}
        aria-label={`${place.label ?? (place.isMe ? 'You' : place.username)}, profile`}
        className="relative block hover:opacity-90 transition-opacity"
        style={{ width }}
      >
        <span aria-hidden="true" className="absolute pointer-events-none" style={{ left: -2, right: -2, top: -6, bottom: -2, borderRadius: 999, background: alphaHex(glow, 0.5), filter: 'blur(10px)' }} />
        <span aria-hidden="true" className="absolute pointer-events-none" style={{ left: 10, right: 10, top: 1, bottom: 1, borderRadius: 999, background: alphaHex(glow, 0.9), filter: 'blur(6px)' }} />
        <span className="relative block">
          <BubbleOneLine text={text} accent={nameColor} size={size} />
        </span>
      </Link>
      {place.nameSuffix}
      {place.action}
    </div>
  );
}

/**
 * The #1 mascot's calm load-in (core PODIUM_WINNER_INTRO): a soft gold radial glow behind the mascot that fades and scales
 * in once and rests at low opacity, plus a few small sparkles that fade in, drift up and fade out once (staggered).
 * Transform + opacity only; the crown's drop lives in PodiumFigure. Static glow under Reduce Motion (globals.css).
 */
function WinnerGlow({ feetX, feetY, size, crown }: { feetX: number; feetY: number; size: number; crown: boolean }) {
  const { glow, sparkles } = PODIUM_WINNER_INTRO;
  const d = size * glow.size;
  const rgb = glow.colorRgb.join(',');
  const sp = size * sparkles.size;
  const cx = `${feetX * 100}%`;
  // the mascot box is centered half its size above the planted feet
  const cy = `calc(${feetY * 100}% + ${PODIUM_ART.plantPt}px - ${size / 2}px)`;
  return (
    <>
      <div aria-hidden="true" className="absolute pointer-events-none" style={{ left: cx, top: cy, width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2, zIndex: 1 }}>
        <div
          className="podium-glow w-full h-full"
          style={{
            borderRadius: '50%',
            background: `radial-gradient(circle at center, rgba(${rgb},0.95) 0%, rgba(${rgb},0.55) 32%, rgba(${rgb},0.18) 58%, rgba(${rgb},0) 72%)`,
            '--from-scale': glow.fromScale, '--rest': glow.restOpacity, opacity: glow.restOpacity,
            animation: `podium-glow-in ${glow.durationMs}ms cubic-bezier(${glow.ease.join(',')}) both`, willChange: 'transform, opacity',
          } as React.CSSProperties}
        />
      </div>
      {crown && sparkles.offsets.map(([ox, oy], i) => (
        <div key={i} aria-hidden="true" className="absolute pointer-events-none" style={{ left: cx, top: cy, width: sp, height: sp, marginLeft: ox * size - sp / 2, marginTop: oy * size - sp / 2, zIndex: 4 }}>
          <svg
            viewBox="0 0 24 24" width={sp} height={sp} className="podium-sparkle block"
            style={{
              opacity: 0, '--drift': `${sparkles.driftPt}px`, '--peak': sparkles.peakOpacity,
              animation: `podium-sparkle ${sparkles.durationMs}ms ease-out ${sparkles.delayMs + i * sparkles.staggerMs}ms both`, willChange: 'transform, opacity',
            } as React.CSSProperties}
          >
            <path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" fill={`rgb(${sparkles.colorRgb.join(',')})`} />
          </svg>
        </div>
      ))}
    </>
  );
}

/** A standing player: name, mascot (feet on the step-top center, planted a little lower), contact shadow. */
function Standing({ place, step, w }: { place: PodiumPlace; step: 1 | 2 | 3; w: number }) {
  const tone = podiumTone(place.rank);
  const first = tone === 'gold';
  const livingOn = useLivingMascotOn();
  const { isLive } = useFlags();
  const cardOn = livingOn && isLive('podium_stage_card');
  // 2.8 winner intro (founder 10-15, replaces the confetti burst): a calm glow + a few sparkles + the crown's drop, once.
  const introOn = isLive('podium_burst') && step === 1;
  const [stageOpen, setStageOpen] = React.useState(false);
  const { feet } = podiumArtStep(step);
  const size = mascotSize(w, step);
  const nameSize = Math.max(11, Math.round(w * (first ? 0.053 : 0.046)));
  const nameW = Math.round(w * (first ? 0.3 : 0.27));
  const tile = Math.round(size / 2);
  const crown = place.crown !== false;
  // The name's bottom clears the DRAWN head top (box top + headTop) by nameGapPt; a crowned winner's name instead clears the
  // crown that rides above the box by crownGapPt. Never tucked into the box.
  const nameGap = first && crown ? PODIUM_ART.crownRise * size + PODIUM_ART.crownGapPt : Math.max(0, PODIUM_ART.nameGapPt - PODIUM_ART.headTop * size);
  const figure = place.isMe || cardOn ? (
    // Founder 10-05 (door 1): your own place opens your Stage; with the living mascot on, anyone else's opens their mini Stage card.
    <button type="button" onClick={() => (place.isMe ? openDressUp() : setStageOpen(true))}
      aria-label={place.isMe ? 'Dress up your mascot' : podiumStageCardLabel(place.username, place.rank)}
      className="block border-0 bg-transparent p-0 cursor-pointer" style={{ lineHeight: 0 }}>
      <PodiumFigure place={place} tone={PODIUM_TONE_PLACE[tone]} size={tile} planted crown={crown} intro={introOn} ring={place.isMe ? '#f59e0b' : undefined} />
    </button>
  ) : (
    <Link href={`/profile/${place.userId}`} tabIndex={-1} aria-hidden="true" className="block" style={{ lineHeight: 0 }}>
      <PodiumFigure place={place} tone={PODIUM_TONE_PLACE[tone]} size={tile} planted crown={crown} intro={introOn} />
    </Link>
  );
  const points = typeof place.points === 'string' || typeof place.points === 'number' ? String(place.points) : '';
  return (
    <>
      <span className="sr-only">{placeWord(place.rank)} place: {place.label ?? place.username}{points ? `, ${points}` : ''}{place.detail ? `, ${place.detail}` : ''}</span>
      {/* the contact shadow: a soft dark ellipse ~0.9 of the mascot's width under its feet */}
      <span
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          left: `${feet.x * 100}%`, top: `calc(${feet.y * 100}% + ${PODIUM_ART.plantPt}px)`, width: size * PODIUM_ART.shadowWidth, height: size * 0.17,
          transform: 'translate(-50%, -50%)', borderRadius: '50%', zIndex: 1,
          background: 'radial-gradient(ellipse at center, rgba(10,0,30,0.55) 0%, rgba(10,0,30,0.3) 45%, rgba(10,0,30,0) 72%)',
        }}
      />
      {introOn && <WinnerGlow feetX={feet.x} feetY={feet.y} size={size} crown={crown} />}
      <div
        className="absolute flex flex-col items-center"
        style={{ left: `${feet.x * 100}%`, top: `calc(${feet.y * 100}% + ${PODIUM_ART.plantPt}px)`, transform: 'translate(-50%, -100%)', zIndex: 3, gap: nameGap }}
      >
        <PodiumNameAbove place={place} size={nameSize} width={nameW} />
        {figure}
      </div>
      <PanelText w={w} place={step} score={points} lines={place.detail ? plaqueDetailLines(place.detail) : []} />
      {cardOn && !place.isMe && <PodiumStageCard place={place} tone={PODIUM_TONE_PLACE[tone]} open={stageOpen} onOpenChange={setStageOpen} />}
    </>
  );
}

/** BJ4: a free place — its step stays; the sleepy R keeps it company; the panel reads "Open spot" · "Claim #N". Not tappable. */
function OpenStep({ step, title, line, w }: { step: 1 | 2 | 3; title: string; line: string; w: number }) {
  const { feet } = podiumArtStep(step);
  const h = Math.round(w * 0.14);
  const iw = Math.round((h * 373) / 302);
  return (
    <>
      <span className="sr-only">{title}, {line}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={artSrc(OPEN_SPOT_ART)}
        alt=""
        aria-hidden="true"
        width={iw}
        height={h}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute select-none pointer-events-none"
        style={{ left: `${feet.x * 100}%`, top: `calc(${feet.y * 100}% + ${PODIUM_ART.plantPt}px)`, width: iw, height: h, transform: 'translate(-50%, -100%)', objectFit: 'contain', opacity: 0.9, zIndex: 3 }}
      />
      <PanelText w={w} place={step} score={title} lines={[line]} />
    </>
  );
}

/**
 * The podium: the places in board order (1st, 2nd, 3rd; DOM = reading order) standing on the one-image stage, with an open
 * spot for every free place (BJ4, core podiumLayout). Spans its container's width (the image is 3:2), tablets scale with the
 * page up to core PODIUM_ART.maxWidthPt (680, so the whole podium fits above the tab bar). The mascots and names overflow the image's top, so the box keeps headroom (a % of its width).
 */
export function Podium({ places, label = 'Top three' }: { places: PodiumPlace[]; label?: string }) {
  const shown = places.slice(0, 3);
  const slots = podiumSlots(shown.map((p) => p.rank));
  const ref = React.useRef<HTMLDivElement>(null);
  const w = useBoxWidth(ref);
  if (slots.length === 0) return null;
  return (
    <div role="group" aria-label={label} ref={ref} className="relative w-full mx-auto" style={{ maxWidth: PODIUM_ART.maxWidthPt, paddingTop: 'calc(13% + 30px)' }}>
      <div className="relative w-full" style={{ aspectRatio: String(PODIUM_ART.aspect) }}>
        {/* the stage: static, decoded once (the soft fade melts into the page wallpaper behind it) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc('art-podium-stage')} alt="" aria-hidden="true" width={1536} height={1024} decoding="async" draggable={false}
          className="absolute inset-0 w-full h-full select-none pointer-events-none" style={{ zIndex: 0, WebkitMaskImage: EDGE_FADE, maskImage: EDGE_FADE }} />
        {slots.map((s) => {
          const step = PODIUM_ART_ORDER[s.column - 1];
          return s.kind === 'place'
            ? <Standing key={shown[s.index].key} place={shown[s.index]} step={step} w={w} />
            : <OpenStep key={`open-${s.place}`} step={step} title={s.title} line={s.line} w={w} />;
        })}
      </div>
    </div>
  );
}

/** A plaque's detail ("3 guesses · 1m 14s · 4/4") as at most two lines: the first part, then the rest (parity: iOS
 *  PodiumView.detailLines, Android PlaqueDetail). */
export function plaqueDetailLines(detail: string): string[] {
  const parts = detail.split('·').map((p) => p.trim()).filter(Boolean);
  // Founder 10-12 ("3M 13S · 2/4 · 1 HI…"): with time, boards AND hints the hints part joins the first line instead.
  const h = parts.findIndex((p, i) => i > 0 && /hint/i.test(p));
  if (parts.length >= 3 && h > 0) return [`${parts[0]} · ${parts[h]}`, parts.filter((_, i) => i !== 0 && i !== h).join(' · ')];
  return parts.length <= 1 ? parts : [parts[0], parts.slice(1).join(' · ')];
}
