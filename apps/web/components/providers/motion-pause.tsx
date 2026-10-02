'use client';

import { useEffect } from 'react';
import { LOOP_SELECTOR, SCROLL_IDLE_MS } from '@/lib/motion-pause';

// FINISH_SPEC AQ2: pause looping CSS animations off-screen (IntersectionObserver
// → data-offscreen) and while any scroll is in flight (html[data-scrolling]).
// One observer for the whole app; new elements are picked up on DOM changes
// (batched to one frame). Renders nothing.
export function MotionPause() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const root = document.documentElement;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) el.removeAttribute('data-offscreen');
        else el.setAttribute('data-offscreen', 'true');
      }
    }, { rootMargin: '64px' });
    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll(LOOP_SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };
    let raf = 0;
    const mo = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; scan(); });
    });
    scan();
    mo.observe(document.body, { childList: true, subtree: true });

    let idle: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (!idle) root.setAttribute('data-scrolling', 'true');
      else clearTimeout(idle);
      idle = setTimeout(() => { idle = null; root.removeAttribute('data-scrolling'); }, SCROLL_IDLE_MS);
    };
    // Capture: inner scroll views (tab pages, sheets) don't bubble `scroll`.
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (idle) clearTimeout(idle);
      root.removeAttribute('data-scrolling');
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, []);
  return null;
}
