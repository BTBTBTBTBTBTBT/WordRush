import { TileState } from '@wordle-duel/core';

export const TILE_CLASSES = {
  border: 'border-2 border-gray-300',
  empty: 'bg-white',
  absent: 'bg-gray-500',
  present: 'bg-yellow-500',
  correct: 'bg-green-500',
  text: 'text-white',
} as const;

const COLORBLIND_CLASSES = {
  correct: 'bg-cyan-600 border-cyan-600',
  present: 'bg-orange-500 border-orange-500',
  absent: 'bg-gray-500 border-gray-500',
  empty: 'bg-white border-gray-300',
} as const;

const DARK_CLASSES = {
  correct: 'bg-green-500 border-green-400',
  present: 'bg-yellow-500 border-yellow-300',
  absent: 'bg-zinc-700 border-zinc-600',
  empty: 'bg-zinc-800 border-zinc-600',
} as const;

export function getTileClasses(
  state: TileState | string,
  opts?: { colorBlind?: boolean; dark?: boolean },
): string {
  const s = typeof state === 'string' ? state : state;

  if (opts?.colorBlind) {
    switch (s) {
      case TileState.CORRECT: case 'correct': return COLORBLIND_CLASSES.correct;
      case TileState.PRESENT: case 'present': return COLORBLIND_CLASSES.present;
      case TileState.ABSENT: case 'absent': return COLORBLIND_CLASSES.absent;
      default: return COLORBLIND_CLASSES.empty;
    }
  }

  if (opts?.dark) {
    switch (s) {
      case TileState.CORRECT: case 'correct': return DARK_CLASSES.correct;
      case TileState.PRESENT: case 'present': return DARK_CLASSES.present;
      case TileState.ABSENT: case 'absent': return DARK_CLASSES.absent;
      default: return DARK_CLASSES.empty;
    }
  }

  switch (s) {
    case TileState.CORRECT: case 'correct': return 'bg-green-500 border-green-500';
    case TileState.PRESENT: case 'present': return 'bg-yellow-500 border-yellow-500';
    case TileState.ABSENT: case 'absent': return 'bg-gray-500 border-gray-500';
    default: return 'bg-white border-gray-300';
  }
}

const HEX = {
  correct: { bg: '#22c55e', border: '#22c55e', text: '#ffffff' },
  present: { bg: '#eab308', border: '#eab308', text: '#ffffff' },
  absent: { bg: '#6b7280', border: '#6b7280', text: '#ffffff' },
  empty: { bg: '#ffffff', border: '#d1d5db', text: '#1a1a2e' },
} as const;

export function getTileHex(
  state: TileState | string,
): { bg: string; border: string; text: string } {
  switch (state) {
    case TileState.CORRECT: case 'correct': return HEX.correct;
    case TileState.PRESENT: case 'present': return HEX.present;
    case TileState.ABSENT: case 'absent': return HEX.absent;
    default: return HEX.empty;
  }
}
