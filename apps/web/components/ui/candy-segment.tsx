'use client';

import type { CSSProperties, ReactNode } from 'react';
import { CANDY_INK, candyPad, threeSlice } from '@/lib/candy-toggle';

// FINISH_SPEC BB2 + the candy toggle sprites (night art 10-03, "Small menus with flair" proposal 1):
// the glossy candy track (art-toggle-*-track) with a glossy purple thumb (art-toggle-*-thumb-on),
// both three-sliced so their round ends keep their shape, the thumb SLIDING (transform only) to the
// chosen option with a white bold label on it and the others in the deep purple ink. 38 px tall,
// squishy (the global squish host). `value` matching no option hides the thumb.

export interface CandySegmentOption<K extends string> { key: K; label: ReactNode; ariaLabel?: string }

export function CandySegment<K extends string>({ options, value, onChange, label, height = 38, itemPad = 0, className = '', style }: {
  options: CandySegmentOption<K>[];
  value: K | '';
  onChange: (key: K) => void;
  /** Kept for callers; the candy sprites are the app's purple in every context. */
  accent?: string;
  /** Accessible name of the group. */
  label: string;
  height?: number;
  /** Horizontal padding of each option (a hugging segmented, e.g. Everyone | Friends). */
  itemPad?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const n = Math.max(1, options.length);
  const index = options.findIndex((o) => o.key === value);
  const pad = candyPad(height);
  const thumbH = height - pad * 2;
  const thumb: CSSProperties = {
    position: 'absolute', top: pad, left: pad, height: thumbH,
    width: `calc((100% - ${pad * 2}px) / ${n})`,
    ...threeSlice('thumb-on', thumbH, '--candy-thumb'),
    transform: `translateX(${Math.max(0, index) * 100}%)`,
    opacity: index < 0 ? 0 : 1,
    pointerEvents: 'none',
  };
  return (
    <div
      role="group"
      aria-label={label}
      className={`relative grid ${className}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, height, padding: `0 ${pad}px`, ...style }}
    >
      <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={threeSlice('track', height, '--candy-track')} />
      <span aria-hidden="true" className="candy-slide" style={thumb} />
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.key)}
            className={`relative z-10 inline-flex items-center justify-center gap-1 font-black rounded-full ${height < 36 ? 'text-[12px]' : 'text-[13px]'}`}
            style={{ minHeight: height, padding: itemPad ? `0 ${itemPad}px` : undefined, whiteSpace: 'nowrap', color: on ? CANDY_INK.on : CANDY_INK.off, textShadow: on ? '0 1px 0 rgba(76, 29, 149, 0.45)' : undefined, transition: 'color 160ms ease-out' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
