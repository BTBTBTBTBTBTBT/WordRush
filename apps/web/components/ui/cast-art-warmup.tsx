'use client';

import { useEffect } from 'react';
import { castArtPaths } from '@/components/ui/cast-button';

// FINISH_SPEC BJ15: decode every cast-button skin + label at idle after the first paint, so a
// button never decodes on the frame that presents it (or on a press, when the -pressed skin swaps in).
// The decoded images stay referenced so the browser keeps them in its decoded-image cache.
const held: HTMLImageElement[] = [];

export function CastArtWarmup() {
  useEffect(() => {
    if (held.length) return;
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const idle = (cb: () => void) => (ric ? ric.call(window, cb, { timeout: 2500 }) : setTimeout(cb, 800));
    const paths = castArtPaths();
    let i = 0;
    const step = () => {
      // A few per idle slice — never a long task.
      for (let n = 0; n < 12 && i < paths.length; n++, i++) {
        const img = new Image();
        img.decoding = 'async';
        img.src = paths[i];
        img.decode().catch(() => {});
        held.push(img);
      }
      if (i < paths.length) idle(step);
    };
    idle(step);
  }, []);
  return null;
}
