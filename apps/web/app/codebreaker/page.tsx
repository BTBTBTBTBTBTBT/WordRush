'use client';

import { useSearchParams } from 'next/navigation';
import { CryptogramGame } from '@/components/cryptogram/cryptogram-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function CodebreakerPage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="codebreaker"><CryptogramGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
