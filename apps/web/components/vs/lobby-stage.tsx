'use client';

// THE WAITING-ROOM LOBBY (FRIDAY-QUEUE item 22, 2.8 wave 3): a little scene instead of an empty card.
// Your mascot stands center-stage on the spotlit platform (art-lobby-stage) next to an empty "?" seat
// (art-lobby-seat-medallion) where your opponent will appear; ONE status line in the bubble lettering
// ("Waiting for Johnny…"), the real counting timer, a no-stakes keepy-uppy tile to tap while you wait,
// and (private matches) a compact invite: the code chip with the family Share + Copy buttons.
// Words and the clock math are core (waiting-room.ts) so iOS and Android say the same things.
// Smooth: transforms/opacity only; Reduce Motion = no bob, no bounce.
// iOS: VSLobbyView.swift · Android: VSLobbyScreen.kt. Also used for bot / random search + pocket waits.

import { useEffect, useRef, useState } from 'react';
import { idleBit, keepyLine, waitClock, waitingStatusLine, type WaitingKind } from '@wordle-duel/core';
import { BubbleText } from '@/components/ui/bubble-text';
import { FamIcon } from '@/components/ui/family-button';
import { FriendAvatar } from '@/components/friends/friends-ui';
import { ART_SIZE, artSrc, type ArtName } from '@/lib/art';
import { prefersReducedMotion } from '@/lib/motion';
import { softMix } from '@/lib/soft-surface';
import { useAuth } from '@/lib/auth-context';
import { VS } from '@/lib/vs-lobby';

function Art({ name, width, className, style }: { name: ArtName; width: number; className?: string; style?: React.CSSProperties }) {
  const [w, h] = ART_SIZE[name];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc(name)} alt="" width={width} height={Math.round((width * h) / w)} draggable={false} className={className} style={{ width, height: 'auto', ...style }} />;
}

/** Tap to bounce a letter tile; it falls if you wait too long. No stakes, nothing saved. */
export function KeepyUppy({ letter = 'W' }: { letter?: string }) {
  const tileRef = useRef<HTMLButtonElement>(null);
  const animRef = useRef<Animation | null>(null);
  const [count, setCount] = useState(0);
  const [best, setBest] = useState(0);
  const calm = prefersReducedMotion();
  const countRef = useRef(0);

  useEffect(() => () => animRef.current?.cancel(), []);

  const bounce = () => {
    const el = tileRef.current;
    countRef.current += 1;
    setCount(countRef.current);
    if (calm || !el || typeof el.animate !== 'function') return;
    animRef.current?.cancel();
    // Up fast, hang, then drop: 1.1 s in the air; if no tap lands before the end, the count resets.
    const a = el.animate(
      [
        { transform: 'translateY(0) scale(1.05, 0.92)', easing: 'cubic-bezier(.2,.7,.3,1)' },
        { transform: 'translateY(-56px) scale(1, 1)', offset: 0.4, easing: 'cubic-bezier(.6,0,.9,.5)' },
        { transform: 'translateY(0) scale(1.06, 0.9)' },
      ],
      { duration: 1100 },
    );
    animRef.current = a;
    a.onfinish = () => {
      setBest((b) => Math.max(b, countRef.current));
      countRef.current = 0;
      setCount(0);
    };
  };

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div style={{ height: 76 }} className="flex items-end">
        <button data-tile type="button" ref={tileRef} onClick={bounce} aria-label="Bounce the tile" className="block active:scale-95" style={{ width: 52, height: 52, position: 'relative' }}>
          <Art name="art-pocket-tile-purple" width={52} />
          <span className="absolute inset-0 flex items-center justify-center font-black text-white" style={{ fontSize: 24, textShadow: '0 1px 2px rgba(60,20,120,0.5)' }}>{letter}</span>
        </button>
      </div>
      <p className="text-[11.5px] font-extrabold" style={{ color: VS.label }} aria-live="off">{keepyLine(count, best)}</p>
    </div>
  );
}

export function LobbyScene({ kind, name, elapsed, seatLabel, children }: {
  kind: WaitingKind;
  /** The friend's name when invited by name. */
  name?: string | null;
  /** Whole seconds waited (the parent's real timer). */
  elapsed: number;
  /** Shown under the empty seat ("Your friend"), optional. */
  seatLabel?: string;
  children?: React.ReactNode;
}) {
  const { profile, user } = useAuth();
  const calm = prefersReducedMotion();
  const bit = idleBit(elapsed);
  const line = waitingStatusLine({ kind, name });
  const myName = profile?.username ?? 'You';
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="relative flex items-end justify-center" style={{ width: '100%', maxWidth: 340, height: 172 }}>
        <Art name="art-lobby-stage" width={300} className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none" style={{ opacity: 0.95 }} />
        {/* You, center stage on the left platform; the empty "?" seat opposite. */}
        <div className="relative flex items-end justify-center gap-8" style={{ paddingBottom: 26 }}>
          <div className={calm ? '' : 'rp-bob'} style={{ textAlign: 'center' }}>
            <FriendAvatar name={myName} userId={user?.id} url={profile?.avatar_url ?? null} accent={(profile as { accent_color?: string | null } | null)?.accent_color ?? null} size={84} />
            <p className="mt-1 text-[11px] font-black truncate max-w-[96px]" style={{ color: VS.ink }}>{myName}</p>
          </div>
          <div style={{ textAlign: 'center' }} aria-label="Waiting for your opponent">
            <Art name="art-lobby-seat-medallion" width={84} style={{ opacity: 0.95 }} />
            <p className="mt-1 text-[11px] font-black truncate max-w-[96px]" style={{ color: VS.label }}>{seatLabel ?? (name ? `@${name.replace(/^@+/, '')}` : '?')}</p>
          </div>
        </div>
        {/* An idle bit from your mascot, as a tiny speech chip. */}
        {bit && (
          <span className="absolute left-2 top-2 px-2 py-0.5 rounded-full text-[10.5px] font-extrabold animate-fade-in" style={{ background: softMix('#ffffff', 0.9), color: VS.ink }}>
            …{bit}
          </span>
        )}
      </div>

      {/* ONE status line (a polite live region) and the real clock. */}
      <div className="w-full text-center" role="status" aria-live="polite" aria-label={line}>
        <BubbleText text={line} palette="vs" maxSize={30} minSize={22} level={2} className="w-full" />
        <p className="mt-1 text-[15px] font-black tabular-nums" style={{ color: VS.ink }} aria-label={`Waited ${waitClock(elapsed)}`}>{waitClock(elapsed)}</p>
      </div>

      <KeepyUppy />
      {children}
    </div>
  );
}

/** The private-match invite: the code chip with compact family Share + Copy buttons. */
export function InviteChips({ code, onShare, onCopy }: { code: string; onShare: () => void; onCopy: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-black tabular-nums px-4 py-1.5 rounded-2xl" style={{ fontSize: 22, letterSpacing: 5, color: VS.deep, background: softMix('#2dd4bf', 0.14) }}>{code}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onShare} className="candy candy-sm"><FamIcon name="share" /><span className="candy-label">Share</span></button>
        <button type="button" onClick={onCopy} className="candy candy-sm candy-peach"><FamIcon name="copy" /><span className="candy-label">Copy code</span></button>
      </div>
    </div>
  );
}
