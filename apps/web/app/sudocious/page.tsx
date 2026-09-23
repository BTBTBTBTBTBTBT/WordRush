'use client';

import { useSearchParams } from 'next/navigation';
import { SudokuGame } from '@/components/sudoku/sudoku-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';

export default function SudokuPage() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="sudoku"><SudokuGame isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
