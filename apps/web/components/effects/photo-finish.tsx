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

      {/* Stamp */}
      <div
        className="animate-pf-stamp px-6 py-3 rounded-2xl"
        style={{
          background: 'rgba(17,17,17,0.9)',
          border: '3px solid #fff',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}
      >
        <span
          className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(135deg,#facc15,#f97316,#ec4899)' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
