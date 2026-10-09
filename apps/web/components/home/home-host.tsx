'use client';

import * as React from 'react';
import Image from 'next/image';

import { castPreset } from '@wordle-duel/core';

import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { ART_SIZE, artSrc } from '@/lib/art';
import { decodeImage } from '@/lib/predecode';
import { HOME_HOST_PORTRAIT, HOME_HOST_SIZE, takeHomeHostWave, type HomeHostChoice } from '@/lib/home-host';
import { HOME_HOST_CROSSFADE_MS, homeHostChoiceKey, homeHostTransition } from '@/lib/home-host-cache';

const W_POSE = 'art-pose-w-wave' as const;

// BJ6 round 4: fetch + decode W's wave pose as soon as Home's code loads (the <Image priority>
// also preloads it in the server-rendered head), so the guest host never pops in.
if (typeof window !== 'undefined') void decodeImage(artSrc(W_POSE));
const W_FALLBACK = { ...castPreset('w'), display: 'mascot' as const };

/**
 * FINISH_SPEC BJ6 (plan A): the Home card's host standing on a soft floor
 * shadow — the player's photo whole as a framed portrait, their full mascot,
 * or W waving (lib/home-host.ts picks). It waves ONCE per launch when Home
 * appears (transform only: a small hop with a wag around its feet; none under
 * Reduce Motion), then rests — no idle bob. `hidden` = opacity 0, the slot kept.
 * Standalone, so option B (the end of the cast row) is a placement change only.
 */
export function HomeHost({ choice, initial, level, pro, hidden = false, size = HOME_HOST_SIZE }: {
  choice: HomeHostChoice;
  initial: string;
  level?: number | null;
  pro?: boolean | null;
  hidden?: boolean;
  size?: number;
}) {
  // Once per launch (module flag), started after mount so the server render never differs.
  const [wave, setWave] = React.useState(false);
  React.useEffect(() => {
    if (takeHomeHostWave()) setWave(true);
  }, []);
  const portrait = Math.round((size * HOME_HOST_PORTRAIT) / HOME_HOST_SIZE);
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
      className="relative block shrink-0 select-none pointer-events-none"
      style={{ width: size, height: size, opacity: hidden ? 0 : 1, transition: 'opacity 160ms ease-out' }}
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
        {figure}
      </span>
    </span>
  );
}
