'use client';

import { ProperNoundleGame } from '@/components/propernoundle/propernoundle-game';
import { AdGate } from '@/components/ads/ad-gate';

export default function ProperNoundlePage() {
  return <AdGate><ProperNoundleGame /></AdGate>;
}
