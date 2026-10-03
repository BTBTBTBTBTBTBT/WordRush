'use client';

import { useEffect } from 'react';
import { LOOP_SELECTOR, MAX_RUNNING_LOOPS, SCROLL_IDLE_MS, capLoops } from '@/lib/motion-pause';

// FINISH_SPEC AQ2: pause looping CSS animations off-screen (IntersectionObserver
// → data-offscreen) and while any scroll is in flight (html[data-scrolling]).
// One observer for the whole app; new elements are picked up on DOM changes
// (batched to one frame). Smoothness pass: at most MAX_RUNNING_LOOPS visible
// loops run at once (lib/motion-pause.ts capLoops; loops inside a dialog
// first) — the rest wait (data-loop-capped) until one leaves the screen.
// LiveHeadline roots are watched for their on-screen state only (their sweep
// is a scheduled one-shot, lib/gloss-sweep.ts), so they don't count. Renders
// nothing.

const inDialog = (el: Element) => !!el.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');

export function MotionPause() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const root = document.documentElement;
    const visible = new Set<Element>();
    let capRaf = 0;
    const recap = () => {
      capRaf = 0;
      const live: Element[] = [];
      visible.forEach((el) => {
        if (!el.isConnected) { visible.delete(el); return; }
        if (!el.classList.contains('lh-sweep')) live.push(el);
      });
      live.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const { run, wait } = capLoops(live, MAX_RUNNING_LOOPS, inDialog);
      for (const el of run) if (el.hasAttribute('data-loop-capped')) el.removeAttribute('data-loop-capped');
      for (const el of wait) if (!el.hasAttribute('data-loop-capped')) el.setAttribute('data-loop-capped', 'true');
    };
    const scheduleRecap = () => { if (!capRaf) capRaf = requestAnimationFrame(recap); };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) { el.removeAttribute('data-offscreen'); visible.add(el); }
        else { el.setAttribute('data-offscreen', 'true'); el.removeAttribute('data-loop-capped'); visible.delete(el); }
      }
      scheduleRecap();
    }, { rootMargin: '64px' });
    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll(LOOP_SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
      // Loops that left the DOM free their slot.
      if (visible.size > 0) scheduleRecap();
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
      if (capRaf) cancelAnimationFrame(capRaf);
      if (idle) clearTimeout(idle);
      root.removeAttribute('data-scrolling');
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, []);
  return null;
}
