'use client';

import type { CSSProperties, ReactNode } from 'react';
import { alphaHex, darken, softBackground, softMix } from '@/lib/soft-surface';

// FINISH_SPEC BB2: a real candy segmented control — a tinted track, a filled
// thumb in the accent that SLIDES (transform only) to the chosen option with a
// white bold label on it, the other labels in a deep accent ink (≥ 4.5:1 on the
// track), 38 px tall, squishy (the global squish host). `value` matching no
// option hides the thumb (e.g. Stats with a game tile picked).

export interface CandySegmentOption<K extends string> { key: K; label: ReactNode }

export function CandySegment<K extends string>({ options, value, onChange, accent, label, height = 38, className = '' }: {
  options: CandySegmentOption<K>[];
  value: K | '';
  onChange: (key: K) => void;
  accent: string;
  /** Accessible name of the group. */
  label: string;
  height?: number;
  className?: string;
}) {
  const n = Math.max(1, options.length);
  const index = options.findIndex((o) => o.key === value);
  const ink = darken(accent, 0.45);
  const pad = 3;
  const thumb: CSSProperties = {
    position: 'absolute', top: pad, bottom: pad + 1, left: pad,
    width: `calc((100% - ${pad * 2}px) / ${n})`,
    borderRadius: 999,
    background: `linear-gradient(${softMix(accent, 0.7)}, ${accent})`,
    boxShadow: `0 2px 0 ${darken(accent, 0.35)}, 0 4px 10px ${alphaHex(accent, 0.3)}, inset 0 1px 0 rgba(255,255,255,0.45)`,
    transform: `translateX(${Math.max(0, index) * 100}%)`,
    opacity: index < 0 ? 0 : 1,
    transition: 'transform 320ms var(--m-spring, cubic-bezier(0.3, 1.35, 0.5, 1)), opacity 160ms ease-out',
    willChange: 'transform',
    pointerEvents: 'none',
  };
  return (
    <div
      role="group"
      aria-label={label}
      className={`relative grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
        height,
        padding: pad,
        borderRadius: 999,
        background: softBackground(accent, 0.12),
        boxShadow: `inset 0 1.5px 3px ${alphaHex(darken(accent, 0.4), 0.18)}, inset 0 0 0 1.5px ${alphaHex(accent, 0.22)}`,
      }}
    >
      <span aria-hidden="true" style={thumb} />
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className="relative z-10 inline-flex items-center justify-center font-black text-[13px] rounded-full"
            style={{ color: on ? '#ffffff' : ink, textShadow: on ? `0 1px 0 ${alphaHex(darken(accent, 0.4), 0.5)}` : undefined, transition: 'color 160ms ease-out' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
