'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CAST, mascotSrc } from '@/lib/mascots';
import { Icon3D } from '@/components/ui/icon3d';

// The cast title (docs/HEADER_SPEC.md §1): the ten mascots side by side in
// WORDOCIOUS order, ~36 px tall, ~8% overlap, bottoms aligned, centered. It
// replaces the WORDOCIOUS text and the PRO pill. Pro / premium: W wears the
// 3D crown (~45% of its width) on its top edge and the row sits on a soft gold
// glow line; free: neither. A gentle one-time hop wave on first appearance
// (once per page load; the .mascot class stops it under Reduce Motion).
// Decorative: aria-hidden, never takes a tap.

/** Tile size: 36 px, shrinking on narrow screens so ten tiles with nine 8% overlaps fit the 16 px gutters. */
const TILE = 'min(36px, calc((100vw - 32px) / 9.28))';

// Client-only (set in an effect), so the server never shares it across requests.
let wavedThisLoad = false;

export function CastTitle({ crown = false }: { crown?: boolean }) {
  const [wave, setWave] = useState(false);
  useEffect(() => {
    if (wavedThisLoad) return;
    wavedThisLoad = true;
    setWave(true);
  }, []);

  return (
    <span
      aria-hidden="true"
      className="relative inline-flex flex-col items-center pointer-events-none select-none"
      style={{ ['--tile' as string]: TILE, paddingTop: crown ? 'calc(var(--tile) * 0.3)' : 0 } as React.CSSProperties}
    >
      <span className="inline-flex items-end">
        {CAST.map((id, i) => (
          <span
            key={id}
            className={`mascot ${wave ? 'mascot-wave' : 'mascot-none'} relative inline-block shrink-0`}
            style={{
              width: 'var(--tile)',
              height: 'var(--tile)',
              marginLeft: i === 0 ? 0 : 'calc(var(--tile) * -0.08)',
              lineHeight: 0,
              '--mascot-hop': '6px',
              '--mascot-delay': `${i * 60}ms`,
              '--mascot-dur': '900ms',
              '--mascot-iter': '1',
            } as React.CSSProperties}
          >
            <Image
              src={mascotSrc(id)}
              alt=""
              width={72}
              height={72}
              priority
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            {crown && id === 'w' && (
              <Icon3D
                name="crown"
                size={16}
                priority
                className="absolute left-1/2"
                style={{
                  width: 'calc(var(--tile) * 0.45)',
                  height: 'calc(var(--tile) * 0.45)',
                  top: 'calc(var(--tile) * -0.3)',
                  transform: 'translateX(-50%) rotate(-8deg)',
                  filter: 'drop-shadow(0 1px 1px rgba(146, 64, 14, 0.3))',
                }}
              />
            )}
          </span>
        ))}
      </span>
      {crown && (
        <span
          className="block rounded-full"
          style={{
            width: '94%',
            height: 2,
            marginTop: 2,
            background: 'rgba(245, 158, 11, 0.25)',
            boxShadow: '0 0 6px 2px rgba(245, 158, 11, 0.25)',
            filter: 'blur(0.6px)',
          }}
        />
      )}
    </span>
  );
}
