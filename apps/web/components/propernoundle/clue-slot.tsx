'use client';

import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb, X } from 'lucide-react';

// ProperNoundle's clue card (solo + VS). Founder 10-03: a hint must never resize
// the board. Founder 10-05 ("always fix empty space issues"): the clue has NO band
// on the play screen — not even an empty, always-present slot. The whole clue opens
// as this card when the Clue hint lands, and the used Clue pill becomes "Read clue"
// to reopen it, so the board and keyboard keep all the room. Johnny 10-05: the card
// hangs from the header's bottom edge (below the title art + category line), full
// width with margins, scrolls inside when a clue outgrows the room, and closes on
// the X, a tap outside or Escape. Fade + scale only; no outlines.

const RED = '#dc2626';
const WASH = 'linear-gradient(rgba(220, 38, 38, 0.08), rgba(220, 38, 38, 0.08)), var(--color-card-base, #ffffff)';

export function ClueCard({ clue, open, onClose, anchorRef }: {
  clue: string | null | undefined;
  open: boolean;
  onClose: () => void;
  /** The header the card hangs from (its bottom edge); centered when absent. */
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const [mounted, setMounted] = useState(false);
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const r = anchorRef?.current?.getBoundingClientRect();
    setTop(r ? r.bottom + 6 : null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, anchorRef, onClose]);

  if (!open || !clue || !mounted) return null;
  return createPortal(
    <div className={`fixed inset-0 z-[80] flex justify-center px-3.5 pb-4 animate-modal-overlay ${top == null ? 'items-center' : 'items-start'}`}
      style={{ background: 'rgba(30, 12, 60, 0.28)', paddingTop: top == null ? 16 : Math.max(0, top) }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label="Clue">
      <div className="animate-modal-content w-full max-w-[460px] rounded-[22px] pl-5 pr-2 pt-1.5 pb-4 flex flex-col"
        style={{
          background: WASH, boxShadow: '0 14px 36px rgba(40, 15, 80, 0.30)',
          maxHeight: top == null ? 'calc(100dvh - 32px)' : `calc(100dvh - ${Math.max(0, top)}px - 16px)`,
        }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 text-[13px] font-black tracking-wider shrink-0" style={{ color: RED }}>
          <Lightbulb className="w-4 h-4" fill="#fca5a5" color={RED} strokeWidth={2} aria-hidden="true" /> CLUE
          <button type="button" onClick={onClose} aria-label="Close"
            className="ml-auto w-11 h-11 flex items-center justify-center active:scale-90 transition-transform"
            style={{ color: 'var(--color-text-muted)' }}>
            <X className="w-5 h-5" strokeWidth={2.75} aria-hidden="true" />
          </button>
        </div>
        <p className="min-h-0 overflow-y-auto pr-3 text-base italic font-semibold leading-relaxed" style={{ color: 'var(--color-text)' }}>{clue}</p>
      </div>
    </div>,
    document.body,
  );
}
