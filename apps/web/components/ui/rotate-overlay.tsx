'use client';

import { useState, useEffect } from 'react';

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
      style={{ backgroundColor: '#f8f7ff' }}
    >
      <div
        className="text-5xl animate-bounce-in"
        style={{ animationDuration: '0.6s' }}
      >
        📱
      </div>
      <h2
        className="text-2xl font-black text-transparent bg-clip-text text-center"
        style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
      >
        Rotate Your Phone
      </h2>
      <p
        className="text-sm font-bold text-center max-w-xs"
        style={{ color: '#9ca3af' }}
      >
        Wordocious plays best in portrait mode
      </p>
    </div>
  );
}
