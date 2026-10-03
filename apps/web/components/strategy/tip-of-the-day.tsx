'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GuideHeroCard, GuideTitleArt, ReadChip } from '@/components/strategy/guide-family';
import type { GameTitleArtName } from '@/lib/art';
import type { MascotId } from '@/lib/mascots';
import { tipOfDayIndex } from '@/lib/strategy-games';

export interface TipItem {
  slug: string;
  title: string;
  dek: string;
  minutes: number;
  accent: string;
  host: MascotId;
  art: GameTitleArtName | null;
  /** Shown in the art slot when there is no title art (VS). */
  artText: string | null;
}

/**
 * TIP OF THE DAY on the Strategy index: the article at (local day % count) in
 * the grouped order (lib/strategy-games.ts, same formula on iOS / Android), as
 * a mini reader hero. The server renders the first item; the visitor's local
 * date swaps it in on mount. Fixed-height slots keep the card the same size.
 */
export function TipOfTheDay({ items }: { items: TipItem[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(tipOfDayIndex(new Date(), items.length));
  }, [items.length]);
  const tip = items[index];
  if (!tip) return null;
  return (
    <Link href={`/strategy/${tip.slug}`} className="block" aria-label={`Tip of the day: ${tip.title}`}>
      <GuideHeroCard key={tip.slug} accent={tip.accent} host={tip.host} poseSize={90} priority className="px-5 pt-3 pb-5 gap-2">
        <div className="flex items-center justify-center w-full" style={{ height: 40 }}>
          <GuideTitleArt art={tip.art} height={40} fallback={tip.artText} accent={tip.accent} />
        </div>
        <h3 className="m-0 font-black leading-tight line-clamp-2" style={{ fontSize: 18, color: 'var(--color-text)', minHeight: '2.5em' }}>
          {tip.title}
        </h3>
        <p className="m-0 font-bold leading-snug line-clamp-2" style={{ fontSize: 13, color: 'var(--color-text-secondary)', minHeight: '2.75em' }}>
          {tip.dek}
        </p>
        <ReadChip accent={tip.accent}>{tip.minutes} min read</ReadChip>
      </GuideHeroCard>
    </Link>
  );
}
