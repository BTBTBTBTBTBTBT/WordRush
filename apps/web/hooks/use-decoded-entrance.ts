'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { DECODE_WAIT_MS, entranceWait } from '@/lib/predecode';

// FINISH_SPEC AZ ("prepare heavy content BEFORE the animation starts"), web:
// a popup's art (the host, the lettering, the badge, the scene) is decoded
// before its spring-in starts, so frame 1 of the entrance is ready instead of
// the art popping in mid-spring. Until then the popup is held on its first
// frame, invisible, its animations paused (globals.css `.motion-wait`) — at
// most DECODE_WAIT_MS; already-decoded art (the common case: the game warmed
// it) starts at once with no hold at all.
//
//   const { ref, waiting } = useDecodedEntrance<HTMLDivElement>();
//   <div ref={ref} className={`… ${waiting ? 'motion-wait' : ''}`}>

export function useDecodedEntrance<T extends HTMLElement>(maxMs: number = DECODE_WAIT_MS): { ref: React.RefObject<T>; waiting: boolean } {
  const ref = useRef<T>(null);
  const [waiting, setWaiting] = useState(true);
  useLayoutEffect(() => {
    const root = ref.current;
    // The eager art only (lazy images below the fold load when scrolled to).
    const imgs = root ? Array.from(root.querySelectorAll('img')).filter((i) => i.loading !== 'lazy') : [];
    if (entranceWait(imgs.map((i) => ({ complete: i.complete, naturalWidth: i.naturalWidth }))) === 'none') { setWaiting(false); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; setWaiting(false); } };
    const t = setTimeout(finish, maxMs);
    Promise.all(imgs.map((img) => (typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve()))).then(finish);
    return () => { done = true; clearTimeout(t); };
  }, [maxMs]);
  return { ref, waiting };
}
