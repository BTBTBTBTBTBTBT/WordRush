'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import type { DailyCompletion } from '@/lib/daily-service';
import { hasPlayedModeToday } from '@/lib/play-limit-service';
import { moreSections } from '@/lib/more-games';
import { MORE_GAME_MODES } from '@/lib/modes.generated';
import { buildHomeCard, type HomeCard } from './mode-chrome';
import { ModeCard, modeCardState } from './mode-card';

// The More Games sheet (More Games §18, Stage 5): the SAME mode card as the
// home grid, two across, under small section headers from the catalog's
// moreCategories (Word · Trivia · Logic). Shell copied from menu-modal.tsx
// (overlay, focus trap, Escape, accent bar). The Daily/Unlimited toggle is
// respected inside the sheet exactly as on the grid; a locked card opens the
// same ModeLimitModal via onLocked.

const MORE_PARAM = 'more';

/**
 * Sheet open/closed state kept in the URL (`/?more=1`) so Back from a game
 * returns to the sheet. Hand-rolled on the History API rather than
 * useSearchParams: reading search params in the home page would deopt the
 * whole page to client rendering in this Next version. history.state is
 * carried across so the app router keeps its tree on Back.
 */
export function useMoreSheetUrl(): { open: boolean; openSheet: () => void; closeSheet: () => void } {
  const [open, setOpen] = useState(false);
  const read = () => {
    try { return new URLSearchParams(window.location.search).get(MORE_PARAM) === '1'; } catch { return false; }
  };
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
  playMode: 'daily' | 'unlimited';
  todayDailies: Map<string, DailyCompletion>;
  isPro: boolean;
  signedIn: boolean;
  resetCountdownText: string;
  /** A free user tapped a played daily — open the ModeLimitModal for it. */
  onLocked: (card: HomeCard, href: string) => void;
}

export function MoreGamesSheet({ open, onClose, playMode, todayDailies, isPro, signedIn, resetCountdownText, onLocked }: MoreGamesSheetProps) {
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const sections = moreSections(MORE_GAME_MODES);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-overlay"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        ref={focusRef}
        className="relative w-full max-w-sm animate-modal-content max-h-modal"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
        }}
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

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="min-w-0">
            <h2
              className="text-xl font-black uppercase text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
            >
              More Games
            </h2>
            <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              {playMode === 'daily' ? 'One free daily each · not part of the Daily Sweep' : 'Unlimited play'}
            </div>
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
  );
}
