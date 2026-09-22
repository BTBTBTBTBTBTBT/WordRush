'use client';

import { useSearchParams } from 'next/navigation';
import { SpyglassGame } from '@/components/wordsearch/spyglass-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function SpyglassPage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="spyglass"><SpyglassGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
