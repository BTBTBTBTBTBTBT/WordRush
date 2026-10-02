'use client';

import { useEffect } from 'react';

export type PhotoFinishKind = 'photo' | 'clutch';

/**
 * A short, distinct win flourish for a CPU photo-finish — intentionally NOT the
 * standard victory confetti. A quick camera-flash, a checkered-flag sweep,
 * horizontal speed-lines, and a stamped label. Self-dismisses after ~1.8s and
 * degrades to a static stamp under prefers-reduced-motion (handled in CSS).
 */
export function PhotoFinish({ kind, onDone }: { kind: PhotoFinishKind; onDone?: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  const label = kind === 'clutch' ? 'CLUTCH!' : 'PHOTO FINISH!';
  const checker =
    'repeating-conic-gradient(#111 0% 25%, #fff 0% 50%) 0 / 22px 22px';

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden flex items-center justify-center">
      {/* Camera flash */}
      <div className="absolute inset-0 animate-pf-flash" style={{ background: 'white' }} />

      {/* Checkered-flag diagonal sweep */}
      <div
        className="absolute top-0 bottom-0 animate-pf-sweep"
        style={{ left: 0, width: '55%', background: checker, opacity: 0.9 }}
      />

      {/* Speed lines */}
      {[18, 38, 58, 78].map((top, i) => (
        <div
          key={top}
          className="absolute animate-pf-speed"
          style={{
            top: `${top}%`,
            left: 0,
            right: 0,
            height: i % 2 === 0 ? 6 : 3,
            background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.9), transparent)',
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}

      {/* Stamp (G5): a big glossy amber candy plate — gold ring, darker lip,
          white gloss, the white label with the dark-purple outline. */}
      <div
        className="animate-pf-stamp relative overflow-hidden px-7 py-3 rounded-[28px]"
        style={{
          background: 'linear-gradient(#ffc56b, #f97316)',
          boxShadow: 'inset 0 0 0 3px #f5c542, 0 7px 0 #a24b0e, 0 14px 36px rgba(59, 26, 120, 0.35)',
        }}
      >
        <span aria-hidden="true" className="absolute rounded-full" style={{ left: '6%', right: '6%', top: '7%', height: '44%', background: 'linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0))' }} />
        <span
          className="relative text-4xl md:text-5xl font-black tracking-tight text-white"
          style={{ textShadow: '2px 0 0 #3b1a78, -2px 0 0 #3b1a78, 0 2px 0 #3b1a78, 0 -2px 0 #3b1a78, 1.5px 1.5px 0 #3b1a78, -1.5px 1.5px 0 #3b1a78, 1.5px -1.5px 0 #3b1a78, -1.5px -1.5px 0 #3b1a78, 0 4px 6px rgba(40, 10, 80, 0.4)' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
