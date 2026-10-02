'use client';

import type { ReactNode } from 'react';
import { SOFT, alphaHex, softBackground } from '@/lib/soft-surface';

// A tinted segmented control (docs/FINISH_SPEC.md A1 / A8: segmented options
// are tappable surfaces, not candy buttons, but never plain white): a soft
// wash track in the accent; the chosen option takes a stronger wash, an accent
// ring and the accent's ink. Squishes via the global squish host.

export interface SegmentOption<K extends string> {
  key: K;
  label: ReactNode;
  icon?: ReactNode;
}

export function TintSegment<K extends string>({ options, value, onChange, accent, ink, label, size = 'md', className = '' }: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  accent: string;
  /** The chosen option's text color (a deep shade of the accent). */
  ink: string;
  /** Accessible name of the group. */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const h = size === 'sm' ? 28 : 34;
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex gap-1 p-1 ${className}`}
      style={{ background: softBackground(accent, 0.1), border: `1.5px solid ${alphaHex(accent, 0.22)}`, borderRadius: 999 }}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 font-black ${size === 'sm' ? 'text-[11px] px-3' : 'text-[13px] px-4'}`}
            style={{
              height: h,
              borderRadius: 999,
              background: on ? softBackground(accent, SOFT.strong) : 'transparent',
              border: on ? `2px solid ${accent}` : '2px solid transparent',
              boxShadow: on ? `0 3px 8px ${alphaHex(accent, 0.2)}` : undefined,
              color: 'var(--color-text-muted)',
            }}
          >
            {o.icon}
            <span className={on ? 'tint-ink-strong' : undefined} style={on ? { color: ink } : undefined}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
