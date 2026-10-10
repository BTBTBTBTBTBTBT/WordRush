'use client';

import * as React from 'react';
import Image from 'next/image';

import { castPreset } from '@wordle-duel/core';

import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { ART_SIZE, artSrc } from '@/lib/art';
import { decodeImage } from '@/lib/predecode';
import { useLivingMascotOn } from '@/hooks/use-flags';
import { prefersReducedMotion } from '@/lib/motion';
import { HOME_HOST_PORTRAIT, HOME_HOST_SIZE, takeHomeHostWave, type HomeHostChoice } from '@/lib/home-host';
import { HOME_HOST_CROSSFADE_MS, homeHostChoiceKey, homeHostTransition } from '@/lib/home-host-cache';

const W_POSE = 'art-pose-w-wave' as const;

// BJ6 round 4: fetch + decode W's wave pose as soon as Home's code loads (the <Image priority>
// also preloads it in the server-rendered head), so the guest host never pops in.
if (typeof window !== 'undefined') void decodeImage(artSrc(W_POSE));
const W_FALLBACK = { ...castPreset('w'), display: 'mascot' as const };

/**
 * Founder 10-09 (iOS HomeHostMascot.trick): crouch (squash .86), launch, the move in the air, land with a squash (.88), spring
 * back. Kind 0 = backflip (-360 deg about the body), 1 = twirl around Y, 2 = a happy bounce (a wag and a second little hop).
 * Web Animations, transform only; each one ends back at rest so the next starts clean.
 */
export function homeHostTrick(kind: number, size: number, outer: HTMLElement, inner: HTMLElement): void {
  const sq = (y: number) => `scale(${(2 - y).toFixed(2)}, ${y})`;
  const ease = 'ease-in-out';
  if (kind === 2) {
    const T = 1300;
    outer.animate([
      { offset: 0, transform: `translateY(0) rotate(0deg) ${sq(1)}` },
      { offset: 120 / T, transform: `translateY(0) rotate(0deg) ${sq(0.86)}` },
      { offset: 250 / T, transform: `translateY(-14px) rotate(9deg) ${sq(1.06)}` },
      { offset: 380 / T, transform: `translateY(0) rotate(-9deg) ${sq(1)}` },
      { offset: 480 / T, transform: `translateY(0) rotate(-9deg) ${sq(0.88)}` },
      { offset: 700 / T, transform: `translateY(0) rotate(0deg) ${sq(1)}` },
      { offset: 880 / T, transform: `translateY(0) rotate(0deg) ${sq(1)}` },
      { offset: 1010 / T, transform: `translateY(-9px) rotate(0deg) ${sq(1)}` },
      { offset: 1, transform: `translateY(0) rotate(0deg) ${sq(1)}` },
    ], { duration: T, easing: ease });
    return;
  }
  const T = 1100;
  outer.animate([
    { offset: 0, transform: `translateY(0) ${sq(1)}` },
    { offset: 120 / T, transform: `translateY(0) ${sq(0.86)}` },
    { offset: 370 / T, transform: `translateY(${-Math.round(size * 0.34)}px) ${sq(1.06)}` },
    { offset: 620 / T, transform: `translateY(0) ${sq(1)}` },
    { offset: 720 / T, transform: `translateY(0) ${sq(0.88)}` },
    { offset: 1, transform: `translateY(0) ${sq(1)}` },
  ], { duration: T, easing: ease });
  const turn = kind === 0 ? 'rotate(-360deg)' : `perspective(${size * 3}px) rotateY(360deg)`;
  const rest = kind === 0 ? 'rotate(0deg)' : `perspective(${size * 3}px) rotateY(0deg)`;
  inner.animate([
    { offset: 0, transform: rest },
    { offset: 120 / T, transform: rest },
    { offset: 620 / T, transform: turn },
    { offset: 1, transform: turn },
  ], { duration: T, easing: ease });
}

/**
 * FINISH_SPEC BJ6 (plan A): the Home card's host standing on a soft floor
 * shadow — the player's photo whole as a framed portrait, their full mascot,
 * or W waving (lib/home-host.ts picks). It waves ONCE per launch when Home
 * appears (transform only: a small hop with a wag around its feet; none under
 * Reduce Motion), then rests — no idle bob. `hidden` = opacity 0, the slot kept.
 * Standalone, so option B (the end of the cast row) is a placement change only.
 */
export function HomeHost({ choice, initial, level, pro, hidden = false, size = HOME_HOST_SIZE, celebrates = false }: {
  choice: HomeHostChoice;
  initial: string;
  level?: number | null;
  pro?: boolean | null;
  hidden?: boolean;
  size?: number;
  /** Founder 10-09: on a Flawless / Sweep day the host shows off (a backflip, a twirl, a bounce, in turn, every ~4.5 s). */
  celebrates?: boolean;
}) {
  const trickOuter = React.useRef<HTMLSpanElement>(null);
  const trickInner = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    if (!celebrates || prefersReducedMotion()) return;
    let n = 0;
    let timer: ReturnType<typeof setTimeout>;
    const run = () => {
      const o = trickOuter.current;
      const i = trickInner.current;
      const kind = n % 3;
      if (o && i && !prefersReducedMotion()) homeHostTrick(kind, size, o, i);
      n += 1;
      timer = setTimeout(run, 4500 + (kind === 2 ? 1300 : 1100));
    };
    timer = setTimeout(run, 1600);
    return () => clearTimeout(timer);
  }, [celebrates, size]);
  // Once per launch (module flag), started after mount so the server render never differs.
  const [wave, setWave] = React.useState(false);
  React.useEffect(() => {
    if (takeHomeHostWave()) setWave(true);
  }, []);
  const portrait = Math.round((size * HOME_HOST_PORTRAIT) / HOME_HOST_SIZE);
  // Founder 10-09: YOUR own living mascot answers a tap (the living hook hops it with its sound); the cast host still
  // lets taps through to the card. Only a mascot host while the living switch is on takes pointer events.
  const livingOn = useLivingMascotOn();
  const interactive = livingOn && choice.kind === 'mascot' && !hidden;
  const [wArtFailed, setWArtFailed] = React.useState(false);

  // 2.7.1: the live look replacing a different one on screen (e.g. this device's cached look)
  // crossfades over ~200 ms instead of popping; the same look changes nothing.
  const key = homeHostChoiceKey(choice);
  const shown = React.useRef<{ key: string; choice: HomeHostChoice; visible: boolean } | null>(null);
  const [leaving, setLeaving] = React.useState<{ key: string; choice: HomeHostChoice } | null>(null);
  React.useLayoutEffect(() => {
    const prev = shown.current;
    if (prev && homeHostTransition(prev.key, key, prev.visible) === 'crossfade') setLeaving({ key: prev.key, choice: prev.choice });
    shown.current = { key, choice, visible: !hidden };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  React.useEffect(() => {
    if (shown.current) shown.current.visible = !hidden;
  }, [hidden]);
  // The outgoing layer leaves when the fade is done (a timer, so a paused / skipped animation can't strand it).
  React.useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), HOME_HOST_CROSSFADE_MS + 60);
    return () => clearTimeout(t);
  }, [leaving]);

  const figureFor = (c: HomeHostChoice): React.ReactNode => {
    if (c.kind === 'photo') {
      return <MascotAvatar config={c.config} initial={initial} size={portrait} photoUrl={c.photoUrl} level={level} pro={pro} />;
    }
    if (c.kind === 'mascot') {
      // BJ6 round 5: the host's mascot is a full-body cutout (no tile, backdrop or frame) — like W.
      // 10-06: the living mascot (behind the livingMascot flag); the outgoing crossfade layer stays still
      return <MascotAvatar config={c.config} initial={initial} size={size} cutout living={c === choice} />;
    }
    if (wArtFailed) {
      // Never an empty host: if W's pose art can't load, the code-drawn W mascot stands in.
      return <MascotAvatar config={W_FALLBACK} initial="W" size={size} cutout />;
    }
    return (
      <Image
        src={artSrc(W_POSE)}
        alt=""
        width={ART_SIZE[W_POSE][0]}
        height={ART_SIZE[W_POSE][1]}
        priority
        draggable={false}
        onError={() => setWArtFailed(true)}
        style={{ width: 'auto', height: size, maxWidth: size, objectFit: 'contain' }}
      />
    );
  };
  const fading = leaving && leaving.key !== key ? leaving : null;
  const layer = (c: HomeHostChoice, k: string, anim: string | undefined) => (
    <span key={k} className="absolute inset-0 flex items-end justify-center" style={{ lineHeight: 0, animation: anim }}>
      {figureFor(c)}
    </span>
  );
  // Keyed siblings in one array, so the incoming layer is never remounted when the outgoing one leaves.
  const figure = [
    fading ? layer(fading.choice, `out:${fading.key}`, `home-host-fade-out ${HOME_HOST_CROSSFADE_MS}ms ease-out both`) : null,
    layer(choice, key, fading ? `home-host-fade-in ${HOME_HOST_CROSSFADE_MS}ms ease-out both` : undefined),
  ];

  return (
    // BJ6 round 3 (the missing host): `block` — inside the banner's absolute (non-flex) slot an
    // inline span had no box, so the figure hung above it and the Home scroller clipped it away.
    <span
      aria-hidden="true"
      className="relative block shrink-0 select-none"
      style={{ width: size, height: size, opacity: hidden ? 0 : 1, transition: 'opacity 160ms ease-out', pointerEvents: interactive ? 'auto' : 'none' }}
    >
      {/* The soft floor shadow at its feet (~78% wide, ~13% tall). */}
      <span
        className="absolute"
        style={{
          left: '11%', width: '78%', bottom: -Math.round(size * 0.04), height: Math.round(size * 0.13),
          background: 'radial-gradient(ellipse at center, rgba(46, 16, 101, 0.2), rgba(46, 16, 101, 0) 70%)',
        }}
      />
      <span className={`mascot absolute inset-0 flex items-end justify-center${wave ? ' home-host-wave' : ''}`} style={{ lineHeight: 0 }}>
        {/* the trick layers (iOS order): the hop / wag / squash about the feet outside, the turn about the body's center inside */}
        <span ref={trickOuter} className="absolute inset-0 flex items-end justify-center" style={{ transformOrigin: '50% 100%' }}>
          <span ref={trickInner} className="absolute inset-0 flex items-end justify-center" style={{ transformOrigin: '50% 50%' }}>
            {figure}
          </span>
        </span>
      </span>
    </span>
  );
}
