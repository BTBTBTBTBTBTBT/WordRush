'use client';

import { useState, useEffect } from 'react';
import { HeadingArt } from '@/components/ui/heading-art';

export function RotateOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => setShow(e.matches);
    update(mq);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 px-8"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* A code-drawn candy phone (no phone emoji — FINISH_SPEC AM3). */}
      <div
        aria-hidden="true"
        className="animate-bounce-in"
        style={{
          animationDuration: '0.6s',
          width: 40,
          height: 66,
          borderRadius: 12,
          padding: 5,
          background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.55), 0 6px 14px rgba(124,58,237,0.28)',
        }}
      >
        <div style={{ width: '100%', height: '100%', borderRadius: 7, background: 'rgba(255,255,255,0.88)' }} />
      </div>
      {/* BJ16: the ROTATE YOUR PHONE lettering. */}
      <HeadingArt slug="rotate" as="h2" height={36} maxWidth={320} />
      <p
        className="text-sm font-bold text-center max-w-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Wordocious plays best in portrait mode
      </p>
    </div>
  );
}
