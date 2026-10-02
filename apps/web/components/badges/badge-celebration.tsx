'use client';

import { useEffect, useRef } from 'react';
import { Confetti } from '@/components/effects/confetti';
import { CandyButton } from '@/components/ui/candy-button';
import { SoftNum } from '@/components/ui/soft-number';
import { BRAND_BAR } from '@/components/ui/soft-popup';
import { BadgeArt } from './badge-art';
import { levelTierLabel } from '@wordle-duel/core';
import { type BadgeCelebration } from '@/lib/badges';
import { alphaHex, darken } from '@/lib/soft-surface';

// The unlock moment (docs/FINISH_SPEC.md V2, and the V3 new-tier popup) in the
// R1 card language: the accent's soft gradient over the warm cream (a deep
// accent tint in dark mode — globals.css `.badge-pop`), the rainbow top bar,
// the big badge springing in on a stage of slow rays + glow, one confetti
// burst, "ACHIEVEMENT UNLOCKED" in lettering-style ink, the name and the
// story, and a candy "Nice!". Reduce Motion: no rays, spring, bob or confetti
// (the shared `.rp-*` rules).

const CONFETTI = ['#7c3aed', '#f97316', '#22c55e', '#2563eb', '#ec4899', '#0ea5e9', '#f5c542', '#ef4444'];

export function BadgeCelebrationPopup({ item, remaining, onClose }: {
  item: BadgeCelebration;
  /** How many more are waiting after this one. */
  remaining: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const accent = item.accent;
  const deep = darken(accent, 0.35);
  const isTier = item.kind === 'tier';
  const headline = isTier ? 'New tier!' : 'Achievement unlocked';
  const title = isTier ? `${levelTierLabel(item.tier)} tier` : item.name;
  const badge = isTier ? (`level-${item.tier}` as const) : item.badge;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center px-5 animate-fade-in"
      style={{ backgroundColor: 'rgba(30, 15, 60, 0.55)' }}
      onClick={onClose}
    >
      <Confetti colors={CONFETTI} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${headline}: ${title}`}
        tabIndex={-1}
        className="badge-pop relative max-w-sm w-full overflow-hidden text-center outline-none animate-fade-in-scale"
        style={{
          background: `linear-gradient(${alphaHex(accent, 0.1)}, ${alphaHex(accent, 0.04)}), var(--popup-cream)`,
          borderRadius: 28,
          boxShadow: `0 24px 60px rgba(40, 15, 80, 0.3), 0 0 0 1.5px ${alphaHex(accent, 0.22)}, 0 0 36px ${alphaHex(accent, 0.28)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" style={{ height: 10, background: BRAND_BAR }} />
        <div className="px-5 pt-4 pb-5 flex flex-col items-center">
          {/* The stage: slow rays + a glow + a ground shadow; the badge springs in, then bobs. */}
          <div className="relative" style={{ width: 200, height: 176 }} aria-hidden="true">
            <span
              className="absolute rp-rays"
              style={{
                left: '50%', top: '48%', width: 230, height: 230, marginLeft: -115, marginTop: -115, borderRadius: '50%',
                background: `repeating-conic-gradient(${alphaHex(accent, 0.16)} 0deg 10deg, transparent 10deg 24deg)`,
                maskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
              }}
            />
            <span className="absolute" style={{ left: '50%', top: '48%', width: 150, height: 150, marginLeft: -75, marginTop: -75, borderRadius: '50%', background: `radial-gradient(circle, ${alphaHex(accent, 0.34)}, transparent 68%)` }} />
            <span className="absolute" style={{ left: '50%', bottom: 4, width: 84, height: 12, marginLeft: -42, borderRadius: '50%', background: alphaHex(deep, 0.22), filter: 'blur(3px)' }} />
            <div className="absolute rp-spring" style={{ left: '50%', bottom: 10, marginLeft: -76 }}>
              <div className="rp-bob">
                <BadgeArt name={badge} size={152} priority style={{ filter: `drop-shadow(0 0 16px ${alphaHex(accent, 0.45)}) drop-shadow(0 6px 8px rgba(59, 26, 120, 0.22))` }} />
              </div>
            </div>
          </div>

          <div className="relative rp-gloss mt-1" style={{ width: 'fit-content', maxWidth: '100%' }}>
            <div className="badge-lettering" style={{ fontSize: isTier ? 30 : 24 }}>{headline}</div>
          </div>

          <h2 className="m-0 mt-2 text-[22px] font-black leading-tight" style={{ color: 'var(--color-text)' }}>{title}</h2>
          {isTier ? (
            <p className="m-0 mt-1 text-[13.5px] font-bold inline-flex items-baseline gap-1" style={{ color: 'var(--color-text-muted)' }}>
              You reached Level <SoftNum size={16} className="soft-num-auto">{item.level}</SoftNum>
            </p>
          ) : (
            <p className="m-0 mt-1 text-[13.5px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{item.description}</p>
          )}

          <div className="mt-4">
            <CandyButton size="md" color="purple" onClick={onClose}>Nice!</CandyButton>
          </div>
          {remaining > 0 && (
            <div className="mt-2 text-[11px] font-black inline-flex items-baseline gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <SoftNum size={12} className="soft-num-auto">{remaining}</SoftNum> more unlocked
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
