'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { getGuide } from '@/lib/guide-content';
import { setGuidePaused } from '@/hooks/use-active-play-timer';

interface Props {
  /** Guide slug (matches lib/guide-content.ts): classic, six, quadword, … */
  slug: string;
  accentColor?: string;
  /** Override positioning — defaults to top-right, mirroring GameHomeButton. */
  positionClass?: string;
}

/**
 * In-game "?" button (top-right, mirroring GameHomeButton at top-left). Opens a
 * slide-up sheet with this mode's strategy guide — the /guides content up to but
 * excluding "Keep reading". Reading it pauses the game clock (setGuidePaused),
 * and the sheet closes via the X, a backdrop tap, or a swipe-down.
 */
export function GameGuideButton({
  slug,
  accentColor = '#7c3aed',
  positionClass = 'absolute top-2 right-2 z-10',
}: Props) {
  const [open, setOpen] = useState(false);
  const guide = getGuide(slug);

  // Pause the clock while the guide is open.
  useEffect(() => {
    setGuidePaused(open);
    return () => setGuidePaused(false);
  }, [open]);

  // Swipe-down-to-close.
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  if (!guide) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How to play"
        className={`${positionClass} w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95`}
        style={{
          background: 'var(--color-surface)',
          border: `2px solid ${accentColor}`,
          boxShadow: `0 2px 0 ${accentColor}33, 0 4px 12px rgba(0,0,0,0.08)`,
        }}
      >
        <HelpCircle className="w-5 h-5" style={{ color: accentColor }} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(26,26,46,0.5)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl overflow-hidden flex flex-col animate-slide-up"
            style={{ background: 'var(--color-bg)', maxHeight: '88vh', transform: `translateY(${dragY}px)` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — also the swipe-to-close grabber */}
            <div
              className="pt-2.5 pb-1.5 flex justify-center cursor-grab touch-none"
              onTouchStart={(e) => { startY.current = e.touches[0].clientY; }}
              onTouchMove={(e) => {
                if (startY.current !== null) setDragY(Math.max(0, e.touches[0].clientY - startY.current));
              }}
              onTouchEnd={() => {
                if (dragY > 90) setOpen(false);
                setDragY(0);
                startY.current = null;
              }}
            >
              <div className="w-10 h-1.5 rounded-full" style={{ background: 'var(--color-border)' }} />
            </div>

            <div className="flex items-start justify-between px-5 pb-2">
              <div>
                <h2 className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>{guide.title}</h2>
                <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{guide.tagline}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
                style={{ background: 'var(--color-surface)' }}
              >
                <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-8 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {guide.facts.map((f) => (
                  <div key={f.label} className="px-3 py-2.5" style={card}>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{f.label}</div>
                    <div className="text-sm font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{f.value}</div>
                  </div>
                ))}
              </div>

              <div className="p-5" style={card}>
                <h3 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>How it works</h3>
                {guide.rules.map((p, i) => (
                  <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
                ))}
              </div>

              <div className="p-5" style={card}>
                <h3 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>How scoring works</h3>
                {guide.scoring.map((p, i) => (
                  <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
                ))}
              </div>

              <div className="p-5" style={card}>
                <h3 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>Strategy</h3>
                <div className="space-y-4">
                  {guide.tips.map((tip) => (
                    <div key={tip.heading}>
                      <h4 className="text-xs font-black mb-1" style={{ color: guide.accent }}>{tip.heading}</h4>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{tip.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const card = {
  background: 'var(--color-surface)',
  border: '1.5px solid var(--color-border)',
  borderRadius: '16px',
} as const;
