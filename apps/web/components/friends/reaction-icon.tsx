'use client';

import { useEffect, useState } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { darken, softMix } from '@/lib/soft-surface';

// Moment reactions in our own style (FINISH_SPEC AM1, founder 10-02: "all new
// emojis made using our style"). The stored keys never change (clap, fire, wow,
// grr, rematch — app/api/friends/react); each renders as the glossy candy art
// `public/art/art-react-<key>.webp` once it ships. The art is NOT in lib/art.ts
// ART_SIZE yet, so it is probed once per session (load-then-show) and, until it
// exists, fire → the 3D flame and the rest → a small tinted word pill. Never a
// phone emoji.

export type ReactionArtKey = 'clap' | 'fire' | 'wow' | 'grr' | 'rematch' | 'heart';

export const REACTION_ART_LABEL: Record<ReactionArtKey, string> = {
  clap: 'Clap!', fire: 'Fire!', wow: 'Wow!', grr: 'Grr!', rematch: 'Rematch', heart: 'Love',
};

/** Each reaction's tint (the pill wash and the burst sparks). */
export const REACTION_TINT: Record<ReactionArtKey, string> = {
  clap: '#f59e0b', fire: '#f97316', wow: '#8b5cf6', grr: '#ef4444', rematch: '#ec4899', heart: '#ec4899',
};

export function reactionArtSrc(key: ReactionArtKey): string {
  return `/art/art-react-${key}.webp`;
}

/** Per-session probe result, so every chip after the first renders the right thing at once. */
const probed = new Map<ReactionArtKey, boolean>();
const waiting = new Map<ReactionArtKey, Array<(ok: boolean) => void>>();

function probe(key: ReactionArtKey, done: (ok: boolean) => void): void {
  const known = probed.get(key);
  if (known !== undefined) { done(known); return; }
  const list = waiting.get(key);
  if (list) { list.push(done); return; }
  waiting.set(key, [done]);
  const img = new window.Image();
  const finish = (ok: boolean) => {
    probed.set(key, ok);
    for (const cb of waiting.get(key) ?? []) cb(ok);
    waiting.delete(key);
  };
  img.onload = () => finish(img.naturalWidth > 0);
  img.onerror = () => finish(false);
  img.src = reactionArtSrc(key);
}

export function ReactionIcon({ reaction, size = 22 }: { reaction: ReactionArtKey; size?: number }) {
  const [art, setArt] = useState<boolean>(() => probed.get(reaction) === true);
  useEffect(() => {
    let live = true;
    probe(reaction, (ok) => { if (live) setArt(ok); });
    return () => { live = false; };
  }, [reaction]);

  if (art) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- probed art outside ART_SIZE (not shipped yet)
      <img
        src={reactionArtSrc(reaction)}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        width={size}
        height={size}
        draggable={false}
        className="block shrink-0 select-none pointer-events-none"
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  if (reaction === 'fire') return <Icon3D name="flame" size={size} />;
  const tint = REACTION_TINT[reaction];
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center shrink-0 rounded-full font-black whitespace-nowrap select-none"
      style={{
        // The pill is always a light candy wash, so its ink stays dark in both themes.
        color: darken(tint, 0.42),
        height: Math.round(size * 0.82),
        padding: `0 ${Math.max(5, Math.round(size * 0.28))}px`,
        fontSize: Math.max(9, Math.round(size * 0.44)),
        letterSpacing: '0.02em',
        background: `linear-gradient(180deg, ${softMix(tint, 0.2)}, ${softMix(tint, 0.34)})`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px ${softMix(tint, 0.5)}`,
      }}
    >
      {REACTION_ART_LABEL[reaction]}
    </span>
  );
}
