'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { DESKTOP_MIN, minWidthQuery } from '@/lib/desktop-layout';

export interface DeskBox { w: number; h: number }

/**
 * The measured size (CSS px) of a board's room on the wide game stage (desktop ≥ 1024 px AND
 * inside a `.game-wide` root, GameBackground `wide`) — null on phones and tablets and until the
 * first measure, so a game keeps its phone sizing there. The puzzle games use it to size a
 * square / rectangular board up to the room the stage gives it (founder 10-12: "the computers are
 * where people should see everything the biggest"). The element may mount late (a game that
 * renders a loading screen first): the observer follows whatever `ref` holds after each render.
 */
export function useDeskBox(ref: RefObject<HTMLElement | null>): DeskBox | null {
  const [box, setBox] = useState<DeskBox | null>(null);
  const live = useRef<{ el: HTMLElement; stop: () => void } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (live.current?.el === el) return;
    live.current?.stop();
    live.current = null;
    if (!el || typeof ResizeObserver === 'undefined' || typeof window.matchMedia !== 'function') { setBox((p) => (p ? null : p)); return; }
    const mq = window.matchMedia(minWidthQuery(DESKTOP_MIN));
    const measure = () => {
      if (!mq.matches || !el.closest('.game-wide')) { setBox((p) => (p ? null : p)); return; }
      const r = el.getBoundingClientRect();
      const w = Math.floor(r.width), h = Math.floor(r.height);
      setBox((p) => (p && p.w === w && p.h === h ? p : { w, h }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    mq.addEventListener('change', measure);
    live.current = { el, stop: () => { ro.disconnect(); mq.removeEventListener('change', measure); } };
    measure();
  });
  useEffect(() => () => { live.current?.stop(); live.current = null; }, []);
  return box;
}
