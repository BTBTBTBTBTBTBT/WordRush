'use client';

import { useSearchParams } from 'next/navigation';
import { MuddleGame } from '@/components/scramble/muddle-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function MuddlePage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="muddle"><MuddleGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
