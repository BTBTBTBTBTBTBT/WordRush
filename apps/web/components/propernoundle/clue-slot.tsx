'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb, X } from 'lucide-react';
import { CLUE_SLOT, clueSlotHeight } from '@/lib/hint-layout';

// ProperNoundle's clue slot (solo + VS). Founder 10-03: a hint must never
// resize the board. The slot is ALWAYS present at three lines of the 13 px clue
// (empty until the Clue hint is used); the clue is clamped to three lines, and
// tapping it opens the whole clue as a card over the game. Johnny 10-05: the
// card was centered on the screen and covered the title art — it now hangs from
// the slot's own top edge (below the title art + category line), full width with
// margins, scrolls inside when a clue outgrows the room, and closes on the X, a
// tap outside or Escape. Fade + scale only; no outlines.

const RED = '#dc2626';
const WASH = 'linear-gradient(rgba(220, 38, 38, 0.08), rgba(220, 38, 38, 0.08)), var(--color-card-base, #ffffff)';

export function ClueSlot({ clue, className = '' }: { clue: string | null | undefined; className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [top, setTop] = useState<number | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const openCard = () => { setTop(slotRef.current?.getBoundingClientRect().top ?? null); setOpen(true); };
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!clue) setOpen(false); }, [clue]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={slotRef} className={`shrink-0 mx-4 mb-1 ${className}`} style={{ height: clueSlotHeight(clue) }}>
      {clue && (
        <button type="button" onClick={openCard} aria-label={`Clue: ${clue}. Tap to read it all.`}
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
        <div className={`fixed inset-0 z-[80] flex justify-center px-3.5 pb-4 animate-modal-overlay ${top == null ? 'items-center' : 'items-start'}`}
          style={{ background: 'rgba(30, 12, 60, 0.28)', paddingTop: top == null ? 16 : Math.max(0, top - 4) }}
          onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Clue">
          <div className="animate-modal-content w-full max-w-[460px] rounded-[22px] pl-5 pr-2 pt-1.5 pb-4 flex flex-col"
            style={{
              background: WASH, boxShadow: '0 14px 36px rgba(40, 15, 80, 0.30)',
              maxHeight: top == null ? 'calc(100dvh - 32px)' : `calc(100dvh - ${Math.max(0, top - 4)}px - 16px)`,
            }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 text-[13px] font-black tracking-wider shrink-0" style={{ color: RED }}>
              <Lightbulb className="w-4 h-4" fill="#fca5a5" color={RED} strokeWidth={2} aria-hidden="true" /> CLUE
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="ml-auto w-11 h-11 flex items-center justify-center active:scale-90 transition-transform"
                style={{ color: 'var(--color-text-muted)' }}>
                <X className="w-5 h-5" strokeWidth={2.75} aria-hidden="true" />
              </button>
            </div>
            <p className="min-h-0 overflow-y-auto pr-3 text-base italic font-semibold leading-relaxed" style={{ color: 'var(--color-text)' }}>{clue}</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
