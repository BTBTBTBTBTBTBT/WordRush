'use client';

import { useSearchParams } from 'next/navigation';
import { HubGame } from '@/components/hub/hub-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function HubbubPage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="hubbub"><HubGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
