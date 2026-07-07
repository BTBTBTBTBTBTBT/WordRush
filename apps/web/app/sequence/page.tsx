'use client';

import { useState, useEffect } from 'react';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { useSearchParams } from 'next/navigation';
import { SequenceGame } from '@/components/sequence/sequence-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';
import { generateDailySeed } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';

export default function SequencePage() {
  const [ready, setReady] = useState(false);
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';

  useEffect(() => {
    ensureDictionaryInitialized();
    setReady(true);
  }, []);

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="text-lg font-black animate-pulse" style={{ color: 'var(--color-text)' }}>Loading...</div>
    </div>
  );

  const seed = isDaily ? generateDailySeed(getTodayLocal(), 'SEQUENCE') : undefined;

  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="sequence"><SequenceGame initialSeed={seed} isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
