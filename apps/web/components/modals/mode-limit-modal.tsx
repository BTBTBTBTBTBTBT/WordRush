'use client';

import { useState, useEffect, useRef } from 'react';

import { Icon3D } from '@/components/ui/icon3d';
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES } from '@/lib/art';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { SoftNum } from '@/components/ui/soft-number';
import { POPUP_ACCENT, POPUP_DIM, PopupBar, popupCard } from '@/components/ui/soft-popup';
import { softPill } from '@/lib/soft-surface';
import { getSecondsUntilMidnightLocal, formatCountdown } from '@/lib/play-limit-service';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { HeadingArt } from '@/components/ui/heading-art';

interface ModeLimitModalProps {
  open: boolean;
  onClose: () => void;
  modeName: string;
  onViewPuzzle?: () => void;
  /** R3: the mode's Unlimited route; a purchase from the Go Pro popup lands there. */
  unlimitedHref?: string;
}

export function ModeLimitModal({ open, onClose, modeName, onViewPuzzle, unlimitedHref }: ModeLimitModalProps) {
  const [countdown, setCountdown] = useState('');
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  useEffect(() => {
    if (!open) return;
    const update = () => setCountdown(formatCountdown(getSecondsUntilMidnightLocal()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // G5: the limit-reached window in the new look — a tinted card with the
  // brand top bar, U all done for today, the countdown as a soft number on a
  // tinted tile, Upgrade as the amber candy and the quiet action in peach.
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-modal-overlay"
          style={{ backgroundColor: POPUP_DIM }}
          onClick={onClose}
        >
          <div
            ref={focusRef}
            className="w-full max-w-sm text-center animate-modal-content"
            style={popupCard(POPUP_ACCENT.brand)}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${modeName} daily limit reached`}
          >
            <PopupBar accent={POPUP_ACCENT.brand} gradient="linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)" />
            <div className="px-6 pt-5 pb-5">
              {/* U, all done for today, new puzzles at midnight (docs/ART_SPEC.md §7). */}
              <div className="flex justify-center mb-2">
                <ArtScene scene={PAGE_SCENES.allDone} className="art-pop" />
              </div>
              {/* BJ16: the PLAYED TODAY lettering; the game's name rides under it. */}
              <HeadingArt slug="playedtoday" as="h2" label={`${modeName} — Played Today`} />
              <p aria-hidden="true" className="text-xs font-black uppercase mb-1" style={{ color: 'var(--color-text-muted)', letterSpacing: 0.6 }}>{modeName}</p>
              <p className="text-xs font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
                You've used your free play of {modeName} for today. Upgrade to Pro for unlimited replays and ad-free gameplay across every mode.
              </p>

              <div className="inline-flex flex-col items-center px-5 pt-2.5 pb-2 mb-4" style={softPill(POPUP_ACCENT.brand, { radius: 16 })}>
                <span className="text-[10px] font-black uppercase" style={{ letterSpacing: 1, color: 'var(--color-text-muted)' }}>
                  Play again tomorrow in
                </span>
                <SoftNum size={26} className="soft-num-auto mt-1">{countdown}</SoftNum>
              </div>

              {/* R3: the redesigned Go Pro popup (never a plain page); a purchase lands in Unlimited. */}
              <CastButton
                color="amber"
                size="lg"
                block
                className="mb-1"
                icon={<Icon3D name="crown" size={24} />}
                onClick={() => { onClose(); openGoProPopup({ afterPurchaseHref: unlimitedHref, reason: `Unlimited ${modeName}` }); }}
              >
                Upgrade to Pro
              </CastButton>

              {onViewPuzzle ? (
                <CastButton color="peach" size="md" block onClick={() => { onClose(); onViewPuzzle(); }}>
                  View Solved Puzzle
                </CastButton>
              ) : (
                <CandyButton color="peach" size="md" block onClick={onClose}>
                  Come back tomorrow
                </CandyButton>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
