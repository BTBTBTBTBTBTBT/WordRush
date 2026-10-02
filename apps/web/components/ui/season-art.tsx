'use client';

import { useEffect, useRef, useState } from 'react';

// FINISH_SPEC X: slots for seasonal art that hasn't shipped yet (the
// Halloween props art-halloween-prop-* and art-scene-banner-halloween). The
// image stays hidden until it has actually loaded, and a missing file (404)
// renders nothing — so the slots can be wired before the art exists. Plain
// <img> (not next/image) so a missing file never goes through the optimizer.
// Decorative: empty alt, aria-hidden, no taps.

export function SeasonArt({ src, className = '', style, onReady }: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  /** Called with true once the file has loaded (false if it's missing). */
  onReady?: (ok: boolean) => void;
}) {
  const [ok, setOk] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  const done = (v: boolean) => { setOk(v); readyRef.current?.(v); };

  // Already in the cache (loaded before React attached onLoad)?
  useEffect(() => {
    const el = ref.current;
    if (el?.complete) done(el.naturalWidth > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      onLoad={() => done(true)}
      onError={() => done(false)}
      className={`select-none pointer-events-none ${className}`}
      style={{ ...style, display: ok ? style?.display : 'none' }}
    />
  );
}
