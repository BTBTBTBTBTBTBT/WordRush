'use client';

import type { ReactNode } from 'react';
import { CandySegment } from '@/components/ui/candy-segment';

// A tinted segmented control (docs/FINISH_SPEC.md A1 / A8: segmented options
// are tappable surfaces, not candy buttons, but never plain white): a soft
// wash track in the accent; the chosen option takes a stronger wash, an accent
// ring and the accent's ink. Squishes via the global squish host.

export interface SegmentOption<K extends string> {
  key: K;
  label: ReactNode;
  icon?: ReactNode;
}

export function TintSegment<K extends string>({ options, value, onChange, label, size = 'md', className = '' }: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Kept for callers; the family candy segmented control is the app's purple in every context. */
  accent?: string;
  ink?: string;
  /** Accessible name of the group. */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  // 2.8 item 23: one segmented look — the family candy segment (was a hand-rolled wash + ring).
  return (
    <CandySegment<K>
      label={label}
      value={value}
      onChange={onChange}
      height={size === 'sm' ? 30 : 36}
      itemPad={size === 'sm' ? 12 : 16}
      className={`inline-grid ${className}`.trim()}
      options={options.map((o) => ({
        key: o.key,
        label: (<>{o.icon}{o.label}</>),
      }))}
    />
  );
}
