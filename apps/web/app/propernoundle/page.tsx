'use client';

import { useSearchParams } from 'next/navigation';
import { ProperNoundleGame } from '@/components/propernoundle/propernoundle-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function ProperNoundlePage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="propernoundle"><ProperNoundleGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
