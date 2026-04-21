'use client';

import { useSearchParams } from 'next/navigation';
import { ProperNoundleGame } from '@/components/propernoundle/propernoundle-game';
import { AdGate } from '@/components/ads/ad-gate';

export default function ProperNoundlePage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><ProperNoundleGame isDaily={isDaily} /></AdGate>;
}
