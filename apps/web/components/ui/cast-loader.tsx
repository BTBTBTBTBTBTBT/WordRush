'use client';

import { useEffect, useState } from 'react';
import { CastRow } from './mascot';
import { loadingTip } from '@/lib/mascots';

// §3 loading: the CastRow at 22 px per tile doing a staggered wave (each tile
// hops 8 px, 70 ms apart, 1.1 s loop). It replaces the spinner; the caller
// keeps its LOADING <MODE> label. §6: an optional rotating tip voiced by D.

const TIP_MS = 3200;

export function CastLoader({ size = 22 }: { size?: number }) {
  return <CastRow size={size} motion="wave" hop={8} stagger={70} duration={1100} iterations="infinite" />;
}

/** One short real tip at a time, rotating (D's voice). Starts on a random tip. */
export function LoadingTip({ color = 'var(--color-text-muted)' }: { color?: string }) {
  const [tick, setTick] = useState<number | null>(null);
  useEffect(() => {
    setTick(Math.floor(Math.random() * 1000));
    const t = setInterval(() => setTick((n) => (n ?? 0) + 1), TIP_MS);
    return () => clearInterval(t);
  }, []);
  // Nothing until mounted, so server and client render the same markup.
  if (tick === null) return <p className="text-[11.5px] font-bold min-h-[16px]" aria-hidden="true" />;
  return (
    // aria-hidden: the loader's live region shouldn't re-announce every rotation.
    <p className="text-[11.5px] font-bold text-center min-h-[16px] max-w-xs" style={{ color }} aria-hidden="true">
      {loadingTip(tick)}
    </p>
  );
}
