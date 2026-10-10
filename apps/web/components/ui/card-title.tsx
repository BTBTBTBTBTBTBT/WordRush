'use client';

import { BubbleText } from '@/components/ui/bubble-text';

/**
 * Founder 10-09: a card's title in the Wordocious bubble lettering (Word of the Day, Medals, Your trophy shelf ...), never plain
 * text. Small, leading, tinted in the card's color. iOS CardTitle, Android CardTitle.
 */
export function CardTitle({ children, color = '#7c3aed', maxSize = 19, className = '' }: { children: string; color?: string; maxSize?: number; className?: string }) {
  return (
    <div className={`min-w-0 flex-1 ${className}`} style={{ maxWidth: 240 }}>
      <BubbleText text={children.toUpperCase()} accent={color} align="left" maxSize={maxSize} minSize={12} level={3} />
    </div>
  );
}

/** A medal's count in the bubble numbers, under its art (founder 10-09: the count reads big, centered in a 44px slot). */
export function BubbleCount({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ width: 44 }} className="mx-auto">
      <BubbleText text={String(value)} accent={color} maxSize={20} minSize={12} slotWidth={44} level={3} />
    </div>
  );
}
