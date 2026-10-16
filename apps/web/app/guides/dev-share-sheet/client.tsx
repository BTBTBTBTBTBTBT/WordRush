'use client';

import { useEffect } from 'react';
import type { Season } from '@/lib/season';
import { openShareSheet } from '@/components/share/share-sheet';
import { finishedSheetContext, lookToSeason } from '@/lib/share-sheet-web';
import { SHARE_SAMPLES } from '@/lib/share-samples';
import { generateShareImage } from '@/lib/share-image';

export function ShareSheetDemoClient({ sample, season, cards, spoilers }: { sample: string; season: string | null; cards: number; spoilers: boolean }) {
  useEffect(() => {
    const pick = (id: string) => SHARE_SAMPLES.find((s) => s.id === id) ?? SHARE_SAMPLES[0];
    const main = pick(sample);
    const ctx = finishedSheetContext({
      catalogMode: 'quordle', gameName: 'QuadWord', isDaily: true, won: true, multi: true, guesses: 8, time: '5:30', boardsTotal: 4,
      date: '2026-10-16', season, hasSpoilerVariant: spoilers,
    });
    if (cards > 1) ctx.cards = ['result', 'profile', 'moment'].slice(0, cards) as typeof ctx.cards;
    const extra: Record<string, string> = { profile: 'profile', moment: 'moment-levelup' };
    openShareSheet({
      fileMode: 'QuadWord',
      ctx,
      render: (card, variant, look) => {
        const input = card === 'result' ? { ...main.input, reveal: variant === 'full' } : pick(extra[card] ?? 'profile').input;
        return generateShareImage(input, { season: lookToSeason(look) as Season | null });
      },
    });
  }, [sample, season, cards, spoilers]);
  return <div style={{ minHeight: '100vh', background: '#120a2e' }} />;
}
