'use client';

import { useSearchParams } from 'next/navigation';
import { LadderGame } from '@/components/ladder/ladder-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function LetterLadderPage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="letter-ladder"><LadderGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
