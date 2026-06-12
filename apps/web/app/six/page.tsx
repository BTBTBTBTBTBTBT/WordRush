'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PracticeGame } from '@/components/practice/practice-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';
import { GameMode } from '@wordle-duel/core';
import { generateDailySeed } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';

export default function SixPage() {
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

  const seed = isDaily ? generateDailySeed(getTodayLocal(), 'DUEL_6') : undefined;

  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="six"><PracticeGame mode={GameMode.DUEL_6} onBack={() => window.location.href = '/'} initialSeed={seed} isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
