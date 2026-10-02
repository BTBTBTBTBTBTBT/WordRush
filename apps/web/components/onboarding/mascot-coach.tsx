'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { poseSrc } from '@/lib/art';
import { feedback } from '@/lib/sound-events';
import { softCard } from '@/lib/soft-surface';

// FINISH_SPEC AO step 4: W coaches the mascot builder. A small W pose in a
// speech-bubble card, four short tips, tap anywhere to advance; a spotlight
// dims everything except the control W points at. The builder exposes no data
// attributes, so targets are found inside its container by stable aria-labels
// (the preview, the "Mascot parts" tablist) and button text (Randomize, Save).

interface Tip {
  text: string;
  pose: 'wave' | 'point';
  find: (root: HTMLElement) => Element | null;
}

function buttonByText(root: HTMLElement, text: string): Element | null {
  return Array.from(root.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim().startsWith(text)) ?? null;
}

const TIPS: Tip[] = [
  { text: 'This is you! Your initial is on your belly.', pose: 'wave', find: (r) => r.querySelector('[aria-label="Your avatar preview"]')?.parentElement ?? null },
  { text: 'Change your body, colors, face and hats here.', pose: 'point', find: (r) => r.querySelector('[role="tablist"][aria-label="Mascot parts"]') },
  { text: 'Stuck? Let me pick!', pose: 'point', find: (r) => buttonByText(r, 'Randomize') },
  { text: 'Love it? Save it!', pose: 'point', find: (r) => buttonByText(r, 'Save') },
];

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 6;

export function MascotCoach({ rootRef, reduced, onDone }: { rootRef: React.RefObject<HTMLElement | null>; reduced: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const tip = TIPS[step];

  const measure = useCallback(() => {
    const root = rootRef.current;
    const el = root ? tip.find(root) : null;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
  }, [rootRef, tip]);

  // Bring the target into view, then follow it (scroll, resize).
  useLayoutEffect(() => {
    const root = rootRef.current;
    const el = root ? tip.find(root) : null;
    el?.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    measure();
    const t = setTimeout(measure, reduced ? 0 : 380);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [rootRef, tip, reduced, measure]);

  const next = useCallback(() => {
    feedback('press');
    if (step >= TIPS.length - 1) onDone();
    else setStep(step + 1);
  }, [step, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next]);

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const below = !rect || rect.y + rect.h / 2 < vh / 2;
  const cardTop = rect ? (below ? rect.y + rect.h + 12 : undefined) : vh * 0.3;
  const cardBottom = rect && !below ? vh - rect.y + 12 : undefined;
  const move = reduced ? 'opacity 200ms ease' : 'left 300ms ease, top 300ms ease, width 300ms ease, height 300ms ease';

  return (
    <div className="absolute inset-0 z-[5]" onClick={next} role="presentation">
      {/* The spotlight: a hole in the dim around the pointed control. */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={rect
          ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 18, boxShadow: '0 0 0 9999px rgba(18, 8, 38, 0.62)', outline: '3px solid rgba(255,255,255,0.85)', transition: move }
          : { inset: 0, background: 'rgba(18, 8, 38, 0.62)' }}
      />
      {/* W in a speech-bubble card. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 w-[calc(100%-32px)]"
        style={{ top: cardTop, bottom: cardBottom, maxWidth: 400, ...softCard('#7c3aed', { radius: 22 }), padding: '10px 14px 10px 8px', transition: reduced ? 'none' : 'top 300ms ease, bottom 300ms ease' }}
        role="dialog"
        aria-live="polite"
        aria-label={`Tip ${step + 1} of ${TIPS.length}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poseSrc('w', tip.pose)} alt="" aria-hidden width={64} height={64} draggable={false} style={{ flex: 'none', width: 64, height: 64 }} />
        <div className="flex-1 min-w-0">
          <p className="m-0 text-[15px] font-black leading-snug" style={{ color: 'var(--color-text)' }}>{tip.text}</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>{step + 1} of {TIPS.length}</span>
            <button
              type="button"
              autoFocus
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="text-[12px] font-black uppercase px-3 py-1 rounded-full"
              style={{ background: '#7c3aed', color: '#fff', letterSpacing: '0.06em' }}
            >
              {step >= TIPS.length - 1 ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
