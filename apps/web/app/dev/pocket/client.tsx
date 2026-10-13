'use client';

import { useEffect, useState } from 'react';
import { FRIENDLY_KINDS, type FriendlyKind } from '@wordle-duel/core';
import { FriendlyGameScreen } from '@/components/friends/game-screen';

/** Dev only: starts the local scripted game, then renders the REAL game screen against it. */
export function PocketDemoClient({ kind, autoplay, pace }: { kind: string; autoplay: boolean; pace: number }) {
  const [ready, setReady] = useState(false);
  const base = (kind === 'passfull' ? 'pass' : kind) as FriendlyKind;
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !FRIENDLY_KINDS.includes(base)) return;
    let alive = true;
    void import('@/lib/pocket-demo').then((m) => { if (!alive) return; m.startPocketDemo(base, kind, autoplay, pace); setReady(true); });
    return () => { alive = false; };
  }, [base, kind, autoplay, pace]);
  if (!FRIENDLY_KINDS.includes(base)) return <p>Unknown kind</p>;
  return ready ? <FriendlyGameScreen id={`debug-pocket-${base}`} /> : null;
}
