'use client';

import * as React from 'react';
import Image from 'next/image';

import { castPreset } from '@wordle-duel/core';

import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { ART_SIZE, artSrc } from '@/lib/art';
import { decodeImage } from '@/lib/predecode';
import { HOME_HOST_PORTRAIT, HOME_HOST_SIZE, takeHomeHostWave, type HomeHostChoice } from '@/lib/home-host';

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

  let figure: React.ReactNode;
  if (choice.kind === 'photo') {
    figure = <MascotAvatar config={choice.config} initial={initial} size={portrait} photoUrl={choice.photoUrl} level={level} pro={pro} />;
  } else if (choice.kind === 'mascot') {
    figure = <MascotAvatar config={choice.config} initial={initial} size={size} />;
  } else if (wArtFailed) {
    // Never an empty host: if W's pose art can't load, the code-drawn W mascot stands in.
    figure = <MascotAvatar config={W_FALLBACK} initial="W" size={size} />;
  } else {
    figure = (
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
  }

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
