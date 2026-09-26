'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import type { DailyCompletion } from '@/lib/daily-service';
import { hasPlayedModeToday } from '@/lib/play-limit-service';
import { moreSections, moreSweepTier, moreDailyModes, MORE_SWEEP_COPY } from '@/lib/more-games';
import { MORE_GAME_MODES, type ModeMeta } from '@/lib/modes.generated';
import { buildHomeCard, type HomeCard } from './mode-chrome';
import { ModeCard, modeCardState } from './mode-card';

// The More Games sheet (More Games §18, Stage 5): the SAME mode card as the
// home grid, two across, under small section headers from the catalog's
// moreCategories (Word · Trivia · Logic). Shell copied from menu-modal.tsx
// (overlay, focus trap, Escape, accent bar). The Daily/Unlimited toggle is
// respected inside the sheet exactly as on the grid; a locked card opens the
// same ModeLimitModal via onLocked.
//
// Entry (founder, 2026-09-26: "a fluid entry into the menu from the current
// shape of the board, like the OctoWord zooms"): the panel GROWS OUT OF the
// More Games band. It starts as the band's exact rectangle (same 14px radius),
// swells to the centered menu panel while the scrim fades in, and the menu
// content fades in over the second half; closing runs the same path in
// reverse, shrinking back onto the band. The band is found by id so the
// morph also runs when Home from a More Games title reopens the sheet. With
// no band on screen (or reduced motion) the old modal fade is used.

const MORE_PARAM = 'more';
/** The band's DOM id — the morph's origin rectangle. */
export const MORE_GAMES_BAND_ID = 'more-games-band';
const MORPH_MS = 320;
const MORPH_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * Sheet open/closed state kept in the URL (`/?more=1`) so Back from a game
 * returns to the sheet. Hand-rolled on the History API rather than
 * useSearchParams: reading search params in the home page would deopt the
 * whole page to client rendering in this Next version. history.state is
 * carried across so the app router keeps its tree on Back.
 */
export function useMoreSheetUrl(): { open: boolean; openSheet: () => void; closeSheet: () => void } {
  const read = () => {
    try { return new URLSearchParams(window.location.search).get(MORE_PARAM) === '1'; } catch { return false; }
  };
  // Starts closed on both server and client (a lazy window read would mismatch
  // hydration); the mount effect below opens it when the URL says ?more=1 —
  // that is how Home from a More Games title lands back on the sheet.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(read());
    const onPop = () => setOpen(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openSheet = useCallback(() => {
    try { if (!read()) window.history.pushState(window.history.state, '', `/?${MORE_PARAM}=1`); } catch {}
    setOpen(true);
  }, []);
  const closeSheet = useCallback(() => {
    try { if (read()) window.history.replaceState(window.history.state, '', '/'); } catch {}
    setOpen(false);
  }, []);
  return { open, openSheet, closeSheet };
}

interface MoreGamesSheetProps {
  open: boolean;
  onClose: () => void;
  /** The More Games titles visible to this viewer (catalog ∩ remote flags). */
  modes?: ModeMeta[];
  playMode: 'daily' | 'unlimited';
  todayDailies: Map<string, DailyCompletion>;
  isPro: boolean;
  signedIn: boolean;
  resetCountdownText: string;
  /** A free user tapped a played daily — open the ModeLimitModal for it. */
  onLocked: (card: HomeCard, href: string) => void;
}

type Phase = 'closed' | 'measuring' | 'from' | 'to' | 'open' | 'closing';
type Box = { top: number; left: number; width: number; height: number; radius: number };

function bandBox(): Box | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(MORE_GAMES_BAND_ID);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height, radius: 14 };
}

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function MoreGamesSheet({ open, onClose, modes = MORE_GAME_MODES, playMode, todayDailies, isPro, signedIn, resetCountdownText, onLocked }: MoreGamesSheetProps) {
  const focusRef = useRef<HTMLDivElement>(null);
  // Morph state. `phase` runs closed → measuring (one hidden frame at the final
  // layout, to learn the panel's real size) → from (pinned to the band's box)
  // → to (transitioning to the measured box) → open (normal layout again) →
  // closing (back onto the band) → closed. `box` is the panel's fixed
  // geometry while it is in flight.
  const [phase, setPhase] = useState<Phase>('closed');
  const [box, setBox] = useState<Box | null>(null);
  const targetRef = useRef<Box | null>(null);
  const originRef = useRef<Box | null>(null);
  const morph = phase !== 'closed' && phase !== 'open';
  const mounted = phase !== 'closed';
  useFocusTrap(focusRef, phase === 'open');

  // Open: start the morph when a band is on screen, else plain mount.
  useLayoutEffect(() => {
    if (!open) return;
    if (phase !== 'closed' && phase !== 'closing') return;
    const origin = reducedMotion() ? null : bandBox();
    originRef.current = origin;
    setBox(null);
    setPhase(origin ? 'measuring' : 'open');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Measure the final layout, then pin the panel to the band's box.
  useLayoutEffect(() => {
    if (phase !== 'measuring') return;
    const el = focusRef.current;
    const origin = originRef.current;
    if (!el || !origin) { setPhase('open'); return; }
    const r = el.getBoundingClientRect();
    targetRef.current = { top: r.top, left: r.left, width: r.width, height: r.height, radius: 20 };
    setBox(origin);
    setPhase('from');
  }, [phase]);

  // One frame at the band's box, then transition to the measured box.
  useEffect(() => {
    if (phase !== 'from') return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (targetRef.current) setBox(targetRef.current);
      setPhase('to');
    }));
    return () => cancelAnimationFrame(id);
  }, [phase]);

  // Settle: hand the panel back to normal flow once it has landed.
  useEffect(() => {
    if (phase !== 'to') return;
    const t = setTimeout(() => { setPhase('open'); setBox(null); }, MORPH_MS + 30);
    return () => clearTimeout(t);
  }, [phase]);

  // Close: shrink back onto the band (if it is still there), then unmount.
  useLayoutEffect(() => {
    if (open || phase === 'closed' || phase === 'closing') return;
    const origin = reducedMotion() ? null : bandBox();
    const el = focusRef.current;
    if (!origin || !el) { setPhase('closed'); setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height, radius: 20 });
    setPhase('closing');
    // Two frames so the fixed "from" geometry paints before the target applies.
    requestAnimationFrame(() => requestAnimationFrame(() => setBox(origin)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (phase !== 'closing') return;
    const t = setTimeout(() => { setPhase('closed'); setBox(null); }, MORPH_MS + 30);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!mounted) return null;

  const sections = moreSections(modes);
  // Panel opacity: fully in by 40% of the way out (so the band appears to
  // swell rather than a white slab popping over it); content fades in over the
  // second half and out first on the way back.
  const inFlight = phase === 'from' || phase === 'to' || phase === 'closing';
  const landed = phase === 'to' || phase === 'open';
  const panelOpacity = phase === 'from' || phase === 'closing' && box === originRef.current ? 0 : 1;
  const contentOpacity = landed ? 1 : 0;
  const scrimOpacity = phase === 'measuring' || phase === 'from' || (phase === 'closing') ? 0 : 1;
  const plainMount = phase === 'open' && !originRef.current;

  const panelStyle: CSSProperties = {
    background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    borderRadius: box ? `${box.radius}px` : '20px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    ...(box
      ? {
          position: 'fixed' as const, top: box.top, left: box.left, width: box.width, height: box.height, maxWidth: 'none',
          opacity: panelOpacity,
          transition: inFlight && phase !== 'from'
            ? `top ${MORPH_MS}ms ${MORPH_EASE}, left ${MORPH_MS}ms ${MORPH_EASE}, width ${MORPH_MS}ms ${MORPH_EASE}, height ${MORPH_MS}ms ${MORPH_EASE}, border-radius ${MORPH_MS}ms ${MORPH_EASE}, opacity ${Math.round(MORPH_MS * 0.4)}ms ease-out${phase === 'closing' ? ` ${Math.round(MORPH_MS * 0.6)}ms` : ''}`
            : 'none',
        }
      : { visibility: (phase === 'measuring' ? 'hidden' : 'visible') as CSSProperties['visibility'] }),
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${plainMount ? 'animate-modal-overlay' : ''}`}
      style={{
        backgroundColor: 'rgba(0,0,0,0.4)',
        opacity: morph ? scrimOpacity : 1,
        transition: morph ? `opacity ${MORPH_MS}ms ease-out` : undefined,
      }}
      onClick={onClose}
    >
      <div
        ref={focusRef}
        className={`relative w-full max-w-sm max-h-modal ${plainMount ? 'animate-modal-content' : ''}`}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="More Games"
      >
        {/* Top accent bar */}
        <div
          className="h-1.5 flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }}
        />

        {/* Everything below the bar fades in once the panel has grown (and out first on close). */}
        <div
          className="flex flex-col flex-1 min-h-0"
          style={{ opacity: morph ? contentOpacity : 1, transition: morph ? `opacity ${Math.round(MORPH_MS * 0.5)}ms ease-out ${phase === 'closing' ? 0 : Math.round(MORPH_MS * 0.4)}ms` : undefined }}
        >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="min-w-0">
            <h2
              className="text-xl font-black uppercase text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
            >
              More Games
            </h2>
            {/* More Games Sweep / Flawless (founder, 2026-09-26): the win shows where the games are.
                Purely visual — derived from today's completions, never a bonus or a score. */}
            {(() => {
              const tier = playMode === 'daily' ? moreSweepTier(todayDailies, modes) : null;
              if (tier) {
                const gold = tier === 'flawless';
                return (
                  <div className="text-[10px] font-black" style={{ color: gold ? '#b45309' : '#4338ca' }}>
                    {gold ? '🏆 ' : '✦ '}{MORE_SWEEP_COPY[tier].short} · all {moreDailyModes(modes).length} {gold ? 'won' : 'played'} today
                  </div>
                );
              }
              return (
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  {playMode === 'daily' ? 'One free daily each · not part of the Daily Sweep' : 'Unlimited play'}
                </div>
              );
            })()}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Sections */}
        <div className="px-4 pb-5 overflow-y-auto flex-1 min-h-0 space-y-3">
          {sections.length === 0 && (
            <div className="text-center text-[12px] font-bold py-8" style={{ color: 'var(--color-text-muted)' }}>
              New games are on the way.
            </div>
          )}
          {sections.map((section) => (
            <div key={section.key}>
              <div className="section-header mb-1">{section.title.toUpperCase()}</div>
              <div className="grid grid-cols-2 gap-2">
                {section.modes.map((m) => {
                  const card = buildHomeCard(m);
                  const dailyResult = playMode === 'daily' && card.dbKey ? todayDailies.get(card.dbKey) : undefined;
                  const state = modeCardState({
                    card, playMode, dailyResult, vsWon: null,
                    playedToday: hasPlayedModeToday(card.id), isPro, signedIn, resetCountdownText,
                  });
                  // In Unlimited (Pro-only) route to the non-daily variant so
                  // each tap lands on a fresh seed — same rule as the grid.
                  const href = playMode === 'unlimited' ? card.href.split('?')[0] : card.href;
                  return (
                    <Link
                      key={card.id}
                      href={href}
                      onClick={(e) => {
                        if (state.isLocked) { e.preventDefault(); onLocked(card, href); }
                      }}
                    >
                      <ModeCard card={card} state={state} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
