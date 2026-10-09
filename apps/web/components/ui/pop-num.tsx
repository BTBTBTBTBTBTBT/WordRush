'use client';

import { useEffect, useRef, useState } from 'react';
import { SoftNum } from '@/components/ui/soft-number';

// 2.8 items 7 + 48: a header counter number (streak flame, flawless trophy, shields) pops and glows for a beat the
// moment it GROWS — the streak just extended. One CSS animation (transform + opacity only); none under Reduce Motion
// (globals.css .hdr-pop / .hdr-pop-glow). Server components render the plain number first; this only adds the pop.
export function PopNum({ value, size }: { value: number | string; size: number }) {
  const prev = useRef<number | null>(typeof value === 'number' ? value : null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof value !== 'number') return;
    if (prev.current !== null && value > prev.current) setTick((t) => t + 1);
    prev.current = value;
  }, [value]);
  return (
    <span className="relative inline-flex items-center justify-center">
      {tick > 0 && <span key={`g${tick}`} aria-hidden="true" className="hdr-pop-glow absolute pointer-events-none" />}
      <span key={`n${tick}`} className={tick > 0 ? 'hdr-pop inline-block' : 'inline-block'}>
        <SoftNum size={size}>{value}</SoftNum>
      </span>
    </span>
  );
}
