'use client';

import { useSearchParams } from 'next/navigation';
import { RegionsGame } from '@/components/regions/regions-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function StarsweepPage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="starsweep"><RegionsGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
