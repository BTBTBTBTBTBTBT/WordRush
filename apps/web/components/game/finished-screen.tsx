'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react';
import { FitBox, MoreDisclosure, useBlockCentering } from './finished-kit';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * The More summary's room (finished-kit MoreDisclosure: 8 + 8 px padding
 * around a ~24 px pill). The first screen ends this much above the bottom so
 * the closed "More" pill peeks just under the dock.
 */
export const MORE_PEEK = 42;

/**
 * The one-screen finished screen's body (docs/FINISH_SPEC.md R2) for the word
 * games: it sits under the game's header in the game's full-height flex column
 * (the column ends above the tab bar via `paddingBottom: var(--bottom-nav-h)`)
 * and lays out, top → bottom:
 *   the compact ResultStrip (+ an optional `sub` line: the daily rank badge,
 *   "Finished on another device"), the board(s) in whatever height is left,
 *   then the FinishedDock — all inside the first screen, so the buttons never
 *   need a scroll. Extras (`more`: score breakdown, today's word, stage rows)
 *   go in a MoreDisclosure BELOW the dock; its closed pill peeks under the dock
 *   and opening it scrolls the extras into view.
 *
 * `fit`:
 *   - 'scale' (default): the board renders at its natural size inside a FitBox,
 *     which shrinks it (never grows it) to the room left.
 *   - 'self': the board sizes itself to its box (useBoardFit / its own
 *     ResizeObserver) — the box is a definite `flex-1 min-h-0` area, the board
 *     is laid in it absolutely and centered. `boardRef` is that area, for the
 *     game's measuring hook. No FitBox, so no double shrink.
 */
export function FinishedScreen({
  strip,
  sub,
  board,
  fit = 'scale',
  boardRef,
  dock,
  more,
  moreLabel = 'More',
  moreAccent,
}: {
  strip: ReactNode;
  sub?: ReactNode;
  board: ReactNode;
  fit?: 'scale' | 'self';
  boardRef?: Ref<HTMLDivElement>;
  dock: ReactNode;
  more?: ReactNode;
  moreLabel?: string;
  moreAccent?: string;
}) {
  const moreRef = useRef<HTMLDivElement>(null);
  const hasMore = !!more;

  // Opening "More" scrolls its extras into view (the toggle event does not
  // bubble, so listen in the capture phase on the wrapper).
  useEffect(() => {
    const wrap = moreRef.current;
    if (!wrap) return;
    const onToggle = (e: Event) => {
      const details = e.target as HTMLDetailsElement | null;
      if (!details?.open) return;
      details.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    };
    wrap.addEventListener('toggle', onToggle, true);
    return () => wrap.removeEventListener('toggle', onToggle, true);
  }, [hasMore]);

  // Founder 10-02: the block sits vertically centered — the room the board
  // leaves in its box is split above the strip and below the dock + More.
  const { onSlack, down, up } = useBlockCentering();
  const selfRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (fit !== 'self') return;
    const area = selfRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return;
    // 'self' boards size themselves to the box and sit centered in it; the
    // slack is the box height minus what the board(s) actually draw. A
    // full-height wrapper (FittedBoardsRecap's measuring box) is looked
    // through, two levels at most.
    let watched: Element[] = [];
    const ro = new ResizeObserver(() => measure());
    const drawn = (el: Element, depth: number, areaH: number): { top: number; bottom: number } | null => {
      watched.push(el);
      const r = el.getBoundingClientRect();
      if (depth > 0 && r.height >= areaH - 1 && el.children.length) {
        let top = Infinity;
        let bottom = -Infinity;
        for (const c of Array.from(el.children)) {
          const d = drawn(c, depth - 1, areaH);
          if (d) { top = Math.min(top, d.top); bottom = Math.max(bottom, d.bottom); }
        }
        return top < bottom ? { top, bottom } : { top: r.top, bottom: r.bottom };
      }
      return r.height > 0 ? { top: r.top, bottom: r.bottom } : null;
    };
    function measure() {
      const areaH = area!.clientHeight;
      const before = watched;
      watched = [];
      let top = Infinity;
      let bottom = -Infinity;
      for (const k of Array.from(area!.children)) {
        const d = drawn(k, 2, areaH);
        if (d) { top = Math.min(top, d.top); bottom = Math.max(bottom, d.bottom); }
      }
      for (const el of watched) if (!before.includes(el)) ro.observe(el);
      onSlack(top < bottom ? Math.max(0, areaH - (bottom - top)) : 0);
    }
    // A board that mounts its content a frame later (the recap after its own measure).
    let raf = 0;
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });
    mo.observe(area, { childList: true, subtree: true });
    ro.observe(area);
    measure();
    return () => { cancelAnimationFrame(raf); mo.disconnect(); ro.disconnect(); };
  }, [fit, onSlack]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
      <div
        className="flex flex-col px-3 animate-fade-in-up"
        style={{ height: hasMore ? `calc(100% - ${MORE_PEEK}px)` : '100%' }}
      >
        <div className="shrink-0 pt-1 flex flex-col items-center gap-1" style={down}>
          {strip}
          {sub}
        </div>
        {fit === 'self' ? (
          <div ref={boardRef} className="relative flex-1 min-h-0 w-full mt-1.5">
            <div ref={selfRef} className="absolute inset-0 flex items-center justify-center">{board}</div>
          </div>
        ) : (
          <div ref={boardRef} className="flex-1 min-h-0 w-full flex flex-col mt-1.5">
            <FitBox onSlack={onSlack}>{board}</FitBox>
          </div>
        )}
        <div className="shrink-0" style={up}>{dock}</div>
      </div>
      {hasMore && (
        <div ref={moreRef} className="px-3 pb-3" style={up}>
          <MoreDisclosure label={moreLabel} accent={moreAccent}>{more}</MoreDisclosure>
        </div>
      )}
    </div>
  );
}

/** The finished game column's bottom room: the docked tab bar (BottomNav publishes --bottom-nav-h). */
export const FINISHED_NAV_CLEAR = 'pb-[var(--bottom-nav-h,80px)]';

/** m:ss, the strip's time. */
export function clockTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
