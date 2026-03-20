'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Delete } from 'lucide-react';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['BACK', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'ENTER']
];

interface KeyboardProps {
  onKey: (key: string) => void;
  letterStates?: Record<string, 'correct' | 'present' | 'absent'>;
  blackedOutLetters?: Set<string>;
}

export function Keyboard({ onKey, letterStates = {}, blackedOutLetters }: KeyboardProps) {
  return (
    <div className="flex flex-col gap-2 max-w-lg mx-auto">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1 justify-center">
          {row.map((key) => {
            const isBlackedOut = blackedOutLetters?.has(key);
            return (
              <Button
                key={key}
                onClick={() => !isBlackedOut && onKey(key)}
                variant="outline"
                size="sm"
                disabled={isBlackedOut}
                className={cn(
                  'h-14 font-bold transition-all duration-300',
                  key === 'ENTER' || key === 'BACK' ? 'px-4' : 'w-10',
                  isBlackedOut && 'bg-red-900/80 text-red-900/80 border-red-900/60 opacity-40 cursor-not-allowed animate-pulse',
                  !isBlackedOut && letterStates[key] === 'correct' && 'bg-green-600 text-white border-green-600',
                  !isBlackedOut && letterStates[key] === 'present' && 'bg-yellow-600 text-white border-yellow-600',
                  !isBlackedOut && letterStates[key] === 'absent' && 'bg-zinc-700 text-white border-zinc-600'
                )}
              >
                {key === 'BACK' ? <Delete className="h-5 w-5" /> : isBlackedOut ? '?' : key}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
