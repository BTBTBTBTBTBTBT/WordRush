'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb } from 'lucide-react';
import { CLUE_SLOT, clueSlotHeight } from '@/lib/hint-layout';

// ProperNoundle's clue slot (solo + VS). Founder 10-03: a hint must never
// resize the board. The slot is ALWAYS present at three lines of the 13 px clue
// (empty until the Clue hint is used); the clue is clamped to three lines, and
// tapping it opens the whole clue as a card over the game (tap anywhere to
// close). Fade + scale only; no outlines.

const RED = '#dc2626';
const WASH = 'linear-gradient(rgba(220, 38, 38, 0.08), rgba(220, 38, 38, 0.08)), var(--color-card-base, #ffffff)';

export function ClueSlot({ clue, className = '' }: { clue: string | null | undefined; className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!clue) setOpen(false); }, [clue]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`shrink-0 mx-4 mb-1 ${className}`} style={{ height: clueSlotHeight(clue) }}>
      {clue && (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Clue: ${clue}. Tap to read it all.`}
          className="animate-fade-in w-full h-full flex items-center gap-1.5 rounded-xl px-3 text-left"
          style={{ background: WASH, paddingTop: CLUE_SLOT.padY, paddingBottom: CLUE_SLOT.padY }}>
          <Lightbulb className="w-3.5 h-3.5 shrink-0" fill="#fca5a5" color={RED} strokeWidth={2} aria-hidden="true" />
          <span className="min-w-0 flex-1 italic font-semibold line-clamp-3"
            style={{ fontSize: CLUE_SLOT.fontPx, lineHeight: `${CLUE_SLOT.linePx}px`, color: 'var(--color-text-secondary)' }}>
            {clue}
          </span>
        </button>
      )}
      {open && clue && mounted && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 animate-modal-overlay"
          style={{ background: 'rgba(30, 12, 60, 0.35)' }} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Clue">
          <div className="animate-modal-content w-full max-w-sm rounded-2xl px-5 py-4"
            style={{ background: WASH, boxShadow: '0 12px 32px rgba(60, 30, 110, 0.28)' }}>
            <div className="flex items-center gap-1.5 text-[11px] font-black tracking-wider mb-1.5" style={{ color: RED }}>
              <Lightbulb className="w-3.5 h-3.5" fill="#fca5a5" color={RED} strokeWidth={2} aria-hidden="true" /> CLUE
            </div>
            <p className="text-sm italic font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>{clue}</p>
            <div className="text-[11px] font-bold mt-3 text-center" style={{ color: 'var(--color-text-muted)' }}>Tap anywhere to close</div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
