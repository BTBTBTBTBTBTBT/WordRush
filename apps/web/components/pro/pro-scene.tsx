'use client';

import { useEffect, useState } from 'react';
import { PRO_BENEFIT_CAPTION, PRO_BENEFIT_ORDER, PRO_PEDESTAL, PRO_SCENES, type ProBenefit } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { HelperButton } from '@/components/ui/family-button';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { useLivingMascotOn } from '@/hooks/use-flags';
import { ART_SIZE, artSrc } from '@/lib/art';
import { prefersReducedMotion } from '@/lib/motion';

// FRIDAY-QUEUE item 20 (founder 10-07): every Go Pro screen shows the FREE player's own mascot (alive when
// `living_mascot` is on: breathes, blinks, hops on a tap) standing on the spotlight pedestal, with ONE distinct scene
// per benefit beside it (gopro/out: gold infinity = Unlimited, open gift = Pro items, two arenas + bolt = VS and bots,
// rising bars = Stats, open padlock = No limits). The mascot is always the real resolver render, never an illustration.

const PED = ART_SIZE['art-pro-stage-pedestal' as keyof typeof ART_SIZE] as readonly [number, number] | undefined;

function Art({ name, style, className = '' }: { name: string; style?: React.CSSProperties; className?: string }) {
  const dims = (ART_SIZE as Record<string, readonly [number, number]>)[name];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc(name)} alt="" aria-hidden="true" draggable={false} decoding="async" width={dims?.[0]} height={dims?.[1]} className={`select-none pointer-events-none ${className}`} style={{ position: 'absolute', ...style }} />;
}

/** The player's own mascot (or the default one for a guest), standing on the pedestal, `size` px tall. */
function ProMascot({ size }: { size: number }) {
  const { profile } = useAuth();
  const livingOn = useLivingMascotOn();
  const p = profile as (Record<string, unknown> & { id?: string; username?: string }) | null;
  const look = usePlayerAvatar({
    name: p?.username ?? null, userId: p?.id ?? null, url: (p?.avatar_url as string | null) ?? null, accent: (p?.accent_color as string | null) ?? null,
    config: p?.avatar_config, castId: p?.avatar_cast_id, frame: p?.avatar_frame, level: (p?.level as number | null) ?? null, pro: false,
  });
  return <MascotAvatar config={look.config} initial={look.initial} size={size} cutout living={livingOn ? true : undefined} />;
}

/**
 * One Go Pro scene: pedestal + the player's mascot on the left, the benefit's scene on the right, a caption under it.
 * `benefit` picks the scene; `height` is the art box (the caption sits below it).
 */
export function ProScene({ benefit, height = 170, caption = true }: { benefit: ProBenefit; height?: number; caption?: boolean }) {
  const pedW = height * 0.92;
  const pedH = PED ? (pedW * PED[1]) / PED[0] : pedW * 0.74;
  const sceneName = PRO_SCENES[benefit];
  const sceneDims = (ART_SIZE as Record<string, readonly [number, number]>)[sceneName] ?? [400, 300];
  const sceneH = height * 0.78;
  const sceneW = (sceneH * sceneDims[0]) / sceneDims[1];
  const mascot = height * 0.82;
  return (
    <figure className="m-0 flex flex-col items-center" aria-label={PRO_BENEFIT_CAPTION[benefit]}>
      <div className="relative" style={{ width: pedW + sceneW * 0.7, maxWidth: '100%', height }}>
        {/* the spotlight pedestal with the mascot on it */}
        <Art name={PRO_PEDESTAL} style={{ left: 0, bottom: 0, width: pedW, height: pedH }} />
        <div className="absolute" style={{ left: (pedW - mascot) / 2, bottom: pedH * 0.34, width: mascot, height: mascot, lineHeight: 0 }}>
          <ProMascot size={mascot} />
        </div>
        {/* the benefit's scene, a little in front of the pedestal's edge */}
        <div key={benefit} className="absolute intro-pop" style={{ right: 0, bottom: 4, width: sceneW, height: sceneH }}>
          <Art name={sceneName} style={{ inset: 0, width: sceneW, height: sceneH, objectFit: 'contain', filter: 'drop-shadow(0 6px 10px rgba(80, 40, 140, 0.25))' }} />
        </div>
      </div>
      {caption && (
        <figcaption className="mt-1 text-center text-[12px] font-black" style={{ color: '#b45309' }}>{PRO_BENEFIT_CAPTION[benefit]}</figcaption>
      )}
    </figure>
  );
}

/**
 * The /pro page's hero: the scenes take turns (every 3.4 s; dots to pick one; Reduce Motion stays on the first until a
 * dot is tapped), so each benefit gets its own scene on the one page.
 */
export function ProSceneCarousel({ height = 190 }: { height?: number }) {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held || prefersReducedMotion()) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % PRO_BENEFIT_ORDER.length), 3400);
    return () => window.clearInterval(t);
  }, [held]);
  return (
    <div className="flex flex-col items-center gap-1">
      <ProScene benefit={PRO_BENEFIT_ORDER[i]} height={height} />
      <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Pro benefits">
        {PRO_BENEFIT_ORDER.map((b, n) => (
          <HelperButton key={b} circle on={n === i} tint="#f5a524" role="tab" aria-selected={n === i} aria-label={PRO_BENEFIT_CAPTION[b]}
            onClick={() => { setHeld(true); setI(n); }}
            icon={/* eslint-disable-next-line @next/next/no-img-element */ <img src={artSrc(PRO_SCENES[b])} alt="" aria-hidden="true" draggable={false} width={20} height={20} style={{ width: 20, height: 20, objectFit: 'contain' }} />} />
        ))}
      </div>
    </div>
  );
}
