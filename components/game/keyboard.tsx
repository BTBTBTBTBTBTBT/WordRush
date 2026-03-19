'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Delete } from 'lucide-react';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
];

interface KeyboardProps {
  onKey: (key: string) => void;
  letterStates?: Record<string, 'correct' | 'present' | 'absent'>;
}

export function Keyboard({ onKey, letterStates = {} }: KeyboardProps) {
  return (
    <div className="flex flex-col gap-2 max-w-lg mx-auto">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1 justify-center">
          {row.map((key) => (
            <Button
              key={key}
              onClick={() => onKey(key)}
              variant="outline"
              size="sm"
              className={cn(
                'h-14 font-bold',
                key === 'ENTER' || key === 'BACK' ? 'px-4' : 'w-10',
                letterStates[key] === 'correct' && 'bg-green-600 text-white border-green-600',
                letterStates[key] === 'present' && 'bg-yellow-600 text-white border-yellow-600',
                letterStates[key] === 'absent' && 'bg-zinc-700 text-white border-zinc-600'
              )}
            >
              {key === 'BACK' ? <Delete className="h-5 w-5" /> : key}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
