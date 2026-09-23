'use client';

import { useSearchParams } from 'next/navigation';
import { GroupsGame } from '@/components/groups/groups-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function KindredPage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="kindred"><GroupsGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
