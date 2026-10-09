'use client';

import { ART_SIZE, artSrc } from '@/lib/art';
import { SoftNum } from '@/components/ui/soft-number';

// FRIDAY-QUEUE item 17 (founder 10-07): the trophy case is a ChatGPT trophy SHELF with 3D gold / silver / bronze
// medals standing in its three holders and their counts under each, not three flat boxes. The shelf art
// (art-pf-trophy-shelf) is drawn with the gold holder raised in the middle; the medals (art-pf-medal-*) are placed
// over the holders by the fractions below (measured off the art's contact sheet; VISUAL CHECK on a real build).

const SHELF_W = 343;
const SHELF_H = 247;
/** Holder centers as fractions of the shelf art (x, y), and each medal disc's diameter as a fraction of the shelf width. */
const HOLDERS = {
  silver: { x: 0.19, y: 0.33, disc: 0.26 },
  gold: { x: 0.51, y: 0.24, disc: 0.29 },
  bronze: { x: 0.81, y: 0.33, disc: 0.26 },
} as const;
/** The medal art: the disc is ~74% of its width and its center sits ~64% down its height (ribbons above). */
const DISC_OF_WIDTH = 0.74;
const DISC_CENTER_Y = 0.64;
const [MW, MH] = [256, 351];

export function TrophyShelf({ gold, silver, bronze, width = 260 }: { gold: number; silver: number; bronze: number; width?: number }) {
  const h = (width * SHELF_H) / SHELF_W;
  const counts = { gold, silver, bronze } as const;
  return (
    <div className="mx-auto" style={{ width }} role="img" aria-label={`${gold} gold, ${silver} silver, ${bronze} bronze medals`}>
      <div className="relative" style={{ width, height: h }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc('art-pf-trophy-shelf')} alt="" aria-hidden="true" draggable={false} decoding="async" width={SHELF_W} height={SHELF_H}
          style={{ position: 'absolute', inset: 0, width, height: h }} />
        {(['silver', 'gold', 'bronze'] as const).map((m) => {
          const spot = HOLDERS[m];
          const mw = (spot.disc * width) / DISC_OF_WIDTH;
          const mh = (mw * MH) / MW;
          const dim = counts[m] === 0;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m} src={artSrc(`art-pf-medal-${m}`)} alt="" aria-hidden="true" draggable={false} decoding="async"
              width={ART_SIZE[`art-pf-medal-${m}` as keyof typeof ART_SIZE]?.[0] ?? MW} height={ART_SIZE[`art-pf-medal-${m}` as keyof typeof ART_SIZE]?.[1] ?? MH}
              style={{
                position: 'absolute', width: mw, height: mh,
                left: spot.x * width - mw / 2, top: spot.y * h - DISC_CENTER_Y * mh,
                opacity: dim ? 0.35 : 1, filter: dim ? 'grayscale(0.6)' : 'drop-shadow(0 3px 3px rgba(60,20,110,0.28))',
              }} />
          );
        })}
      </div>
      <div className="relative" style={{ width, height: 28 }}>
        {(['silver', 'gold', 'bronze'] as const).map((m) => (
          <div key={m} className="absolute text-center" style={{ left: HOLDERS[m].x * width - 28, width: 56 }}>
            <SoftNum size={m === 'gold' ? 20 : 17} as="div" className="soft-num-auto leading-none">{counts[m]}</SoftNum>
          </div>
        ))}
      </div>
    </div>
  );
}
