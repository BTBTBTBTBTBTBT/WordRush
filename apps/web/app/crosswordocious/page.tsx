'use client';

import { useSearchParams } from 'next/navigation';
import { CrosswordGame } from '@/components/crossword/crossword-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function CrosswordociousPage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="crosswordocious"><CrosswordGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
